import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// --- TIPOS ---
export interface BingoResponse {
  text: string;
  emotion: Emotion;
  audioData?: string; 
}

// --- PERSONALIDADE & REGRAS ---
// Reduzi o tamanho para economizar tokens e ser mais direto
const COMPACT_SYSTEM_PROMPT = `
[PERSONA: Cão Bingo. Rabugento, velho, sarcástico. Odeia: felicidade, gatos. Ama: dormir.]
[REGRAS: Respostas curtas (max 2 frases). Pt-BR. Sem emojis.]
[OUTPUT: JSON puro: {"fala": "...", "emocao": "NEUTRO"|"FELIZ"|"BRAVO"|"SONOLENTO"|"CONFUSO"|"DESCOLADO"}]
`;

// --- DATABASE LOCAL (CAMADA 3 - OFFLINE/FAILSAFE) ---
const LOCAL_RESPONSES = [
    {
        keywords: /comida|fome|ração|petisco|jantar|almoço/i,
        responses: [
            { t: "Finalmente! Espero que não seja aquela marca barata de novo.", e: Emotion.HAPPY },
            { t: "Coloca na tigela e sai de perto. Não gosto de plateia.", e: Emotion.NEUTRAL },
            { t: "Ração? Eu queria lasanha. Mas serve.", e: Emotion.ANGRY }
        ]
    },
    {
        keywords: /carinho|afago|lindo|fofo|bom garoto/i,
        responses: [
            { t: "Ei! Sem tocar no pelo. Acabei de lamber.", e: Emotion.ANGRY },
            { t: "Tá, tá... rápido. Tenho mais o que fazer (dormir).", e: Emotion.NEUTRAL },
            { t: "Grrr... humanos são tão carentes.", e: Emotion.CONFUSED }
        ]
    },
    {
        keywords: /einstein|teoria|inteligente|saber|explica|quem é/i,
        responses: [
            { t: "Eu pareço a Wikipédia? Eu sou um cachorro! Me dê ração.", e: Emotion.ANGRY },
            { t: "Relatividade é o tempo que demora pra você colocar minha comida. Uma eternidade.", e: Emotion.COOL }
        ]
    },
    {
        keywords: /passear|rua|parque|vamos/i,
        responses: [
            { t: "Lá fora? Onde tem barulho e gente? Passo.", e: Emotion.SLEEPY },
            { t: "Só se for pra latir pro carteiro. Caso contrário, esquece.", e: Emotion.ANGRY }
        ]
    },
    {
        keywords: /oi|ola|olá|bom dia|boa tarde/i,
        responses: [
            { t: "Era um bom dia até você me acordar.", e: Emotion.SLEEPY },
            { t: "O que você quer? Estou ocupado olhando pro nada.", e: Emotion.NEUTRAL }
        ]
    }
];

const GENERIC_FALLBACKS = [
    { t: "Zzz... ah, você falou algo? Não estava ouvindo.", e: Emotion.SLEEPY },
    { t: "Interessante... mentira, não me importo.", e: Emotion.COOL },
    { t: "Latido de desprezo pra você.", e: Emotion.ANGRY },
    { t: "Sua voz me dá sono. Vou tirar uma sesta.", e: Emotion.SLEEPY }
];

// --- HELPERS ---

const getAI = () => {
  const key = process.env.API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// Tenta adivinhar a emoção pelo texto se o JSON falhar
const guessEmotionFromText = (text: string): Emotion => {
    const lower = text.toLowerCase();
    if (lower.includes('zzz') || lower.includes('sono') || lower.includes('dormir')) return Emotion.SLEEPY;
    if (lower.includes('grr') || lower.includes('odeio') || lower.includes('sai')) return Emotion.ANGRY;
    if (lower.includes('?') || lower.includes('hum')) return Emotion.CONFUSED;
    if (lower.includes('legal') || lower.includes('tá')) return Emotion.NEUTRAL;
    if (lower.includes('comida') || lower.includes('delícia')) return Emotion.HAPPY;
    return Emotion.NEUTRAL;
}

// Parser Robusto: Aceita JSON perfeito, JSON quebrado ou Texto puro
const robustParser = (rawInput: string): BingoResponse | null => {
    if (!rawInput) return null;
    
    // 1. Limpeza
    let clean = rawInput
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    // 2. Tenta extrair JSON
    try {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
            const jsonPart = clean.substring(start, end + 1);
            const parsed = JSON.parse(jsonPart);
            
            // Valida campos
            const emotionMap: Record<string, Emotion> = {
                'NEUTRO': Emotion.NEUTRAL, 'FELIZ': Emotion.HAPPY, 'BRAVO': Emotion.ANGRY,
                'SONOLENTO': Emotion.SLEEPY, 'CONFUSO': Emotion.CONFUSED, 'DESCOLADO': Emotion.COOL
            };

            return {
                text: parsed.fala || "Grrr...",
                emotion: emotionMap[parsed.emocao?.toUpperCase()] || guessEmotionFromText(parsed.fala || "")
            };
        }
    } catch (e) {
        // Ignora erro de JSON e segue para fallback de texto
    }

    // 3. Fallback: Trata como texto puro se não for erro de HTML/Network
    if (clean.length > 0 && !clean.includes('<html') && !clean.includes('Error:')) {
        // Remove aspas soltas que às vezes sobram
        if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);
        
        return {
            text: clean,
            emotion: guessEmotionFromText(clean)
        };
    }

    return null;
};

// --- CAMADA 3: LOCAL ---
const getLocalResponse = (input: string): BingoResponse => {
    console.log("Ativando Camada 3 (Local)...");
    for (const category of LOCAL_RESPONSES) {
        if (category.keywords.test(input)) {
            const random = category.responses[Math.floor(Math.random() * category.responses.length)];
            return { text: random.t, emotion: random.e };
        }
    }
    const randomGeneric = GENERIC_FALLBACKS[Math.floor(Math.random() * GENERIC_FALLBACKS.length)];
    return { text: randomGeneric.t, emotion: randomGeneric.e };
};

// --- CAMADA 2: POLLINATION API (MODO INJEÇÃO DE PROMPT) ---
const callPollination = async (userInput: string): Promise<string | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Timeout

    // AQUI ESTÁ A MÁGICA: Injetamos a persona DENTRO da mensagem do usuário
    // Isso garante que o modelo veja as regras no contexto imediato.
    const injectedPrompt = `${COMPACT_SYSTEM_PROMPT}\n\n[USUÁRIO DIZ]: "${userInput}"\n[BINGO RESPONDE (JSON)]:`;

    try {
        // Usando GET, pois é mais cache-friendly e robusto na API legado para textos curtos
        // A API text.pollinations.ai aceita o prompt direto na URL
        const url = `https://text.pollinations.ai/${encodeURIComponent(injectedPrompt)}?model=openai&seed=${Math.floor(Math.random() * 1000)}&json=true`;
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return await response.text();
        }
        return null;
    } catch (e) {
        console.warn("Pollination falhou:", e);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

// --- FUNÇÃO PRINCIPAL ---
export const generateResponse = async (
  history: ChatMessage[],
  actionContext?: string
): Promise<BingoResponse> => {
  
  const lastUserMessage = history[history.length - 1]?.content || "";
  const currentContext = actionContext || lastUserMessage;

  // 1. TENTATIVA: GEMINI (Se tiver API KEY configurada)
  try {
    const ai = getAI();
    if (ai) {
        // Para o Gemini, usamos a estrutura correta de systemInstruction
        const fullSystem = `PERSONAGEM: Bingo, Cão Rabugento.\nCONTEXTO: ${COMPACT_SYSTEM_PROMPT}`;
        const prompt = `Histórico recente:\n${history.slice(-2).map(m => m.role + ": " + m.content).join('\n')}\nInput Atual: ${currentContext}`;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                fala: { type: Type.STRING },
                emocao: { type: Type.STRING, enum: ["NEUTRO", "FELIZ", "BRAVO", "SONOLENTO", "CONFUSO", "DESCOLADO"] },
            },
            required: ["fala", "emocao"],
        };

        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: fullSystem,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.9
            }
        });

        if (result.text) {
            const parsed = JSON.parse(result.text);
            return {
                text: parsed.fala,
                emotion: parsed.emocao as Emotion
            };
        }
    }
  } catch (error) {
    // Silently continue to fallback
  }

  // 2. TENTATIVA: POLLINATIONS (Com Injeção de Prompt)
  try {
      console.log("Tentando Pollinations (Injected)...");
      const pollResponse = await callPollination(currentContext);
      
      const result = robustParser(pollResponse || "");
      if (result) return result;
      
  } catch (error) {
      console.warn("Pollinations falhou totalmente.");
  }

  // 3. TENTATIVA: LOCAL (GARANTIA FINAL)
  return getLocalResponse(currentContext);
};

// --- AUDIO ---
export const generateAudio = async (text: string): Promise<string | null> => {
  try {
    const ai = getAI();
    if (!ai) return null; 

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' }, 
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

  } catch (error) {
    return null;
  }
};
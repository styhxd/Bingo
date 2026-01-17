import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// --- TIPOS ---
export interface BingoResponse {
  text: string;
  emotion: Emotion;
  audioData?: string; 
}

// --- CONFIGURAÇÕES ---
const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (Cão Rabugento)
CONTEXTO: Você é um cachorro cínico, velho e rabugento.
PERSONALIDADE: Sarcástico, preguiçoso, odeia felicidade.
REGRAS:
1. Responda em Português do Brasil.
2. Seja breve (máximo 2 frases).
3. Nunca ria (kkkk).
4. Reclame de tudo.
`;

// --- DATABASE LOCAL (CAMADA 3 - ULTIMO RECURSO) ---
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
        keywords: /einstein|teoria|inteligente|saber|explica/i,
        responses: [
            { t: "Eu pareço um professor de física? Eu sou um cachorro! Me dê ração.", e: Emotion.ANGRY },
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

// Limpeza agressiva de JSON (Para lidar com respostas "sujas" de LLMs gratuitos)
const cleanAndParseJSON = (text: string): BingoResponse | null => {
    try {
        if (!text) return null;
        
        let clean = text
            .replace(/```json/g, '') // Remove inicio de bloco de codigo
            .replace(/```/g, '')     // Remove fim de bloco
            .trim();

        // Tenta extrair apenas o objeto JSON se houver texto em volta
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
            clean = clean.substring(start, end + 1);
        } else {
            // Se não tem chaves, assume que o modelo falhou no JSON e mandou só texto
            // Mas só se o texto for curto (evita erros HTML grandes)
            if (clean.length < 300 && !clean.includes('<')) {
                return { text: clean, emotion: Emotion.NEUTRAL };
            }
            return null;
        }

        const parsed = JSON.parse(clean);
        
        const emotionKey = parsed.emocao ? parsed.emocao.toUpperCase() : 'NEUTRO';
        const emotionMap: Record<string, Emotion> = {
            'NEUTRO': Emotion.NEUTRAL,
            'FELIZ': Emotion.HAPPY,
            'BRAVO': Emotion.ANGRY,
            'SONOLENTO': Emotion.SLEEPY,
            'CONFUSO': Emotion.CONFUSED,
            'DESCOLADO': Emotion.COOL
        };

        return {
            text: parsed.fala || "Grrr...",
            emotion: emotionMap[emotionKey] || Emotion.NEUTRAL
        };
    } catch (e) {
        // Se falhar o parse, mas o texto for legível, retorna ele
        if (text.length > 0 && text.length < 200 && !text.includes('{')) {
             return { text: text, emotion: Emotion.NEUTRAL };
        }
        return null;
    }
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

// --- CAMADA 2: POLLINATION API ---
const callPollination = async (prompt: string): Promise<string | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

    const instruction = `${SYSTEM_INSTRUCTION}\nIMPORTANTE: Responda APENAS um JSON válido no formato: {"fala": "seu texto aqui", "emocao": "NEUTRO"}. Não escreva nada além do JSON.`;

    try {
        // Tenta POST primeiro (Mais estruturado)
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: instruction },
                    { role: 'user', content: prompt }
                ],
                model: 'openai', // Modelo mais estável da plataforma
                seed: Math.floor(Math.random() * 1000)
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const text = await response.text();
            if (text && text.length > 5) return text;
        }

        throw new Error("POST failed or empty");

    } catch (e) {
        console.warn("Pollination POST falhou, tentando GET...", e);
        
        // Fallback para GET simples (Mais compatível)
        try {
            const getPrompt = `${instruction}\n\nUsuário disse: ${prompt}`;
            const url = `https://text.pollinations.ai/${encodeURIComponent(getPrompt)}?model=openai`;
            const res = await fetch(url);
            if (res.ok) return await res.text();
        } catch (err2) {
            console.error("Pollination GET falhou também:", err2);
        }
        
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

  // 1. TENTATIVA: GEMINI (API KEY)
  try {
    const ai = getAI();
    if (ai) {
        const prompt = `Histórico:\n${history.slice(-3).map(m => m.role + ": " + m.content).join('\n')}\nInput: ${currentContext}`;
        
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
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.8
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
    console.warn("Gemini indisponível, pulando para camada 2.");
  }

  // 2. TENTATIVA: POLLINATIONS
  try {
      console.log("Tentando Pollinations...");
      const pollResponse = await callPollination(currentContext);
      if (pollResponse) {
          const parsed = cleanAndParseJSON(pollResponse);
          if (parsed) return parsed;
      }
  } catch (error) {
      console.warn("Pollinations falhou totalmente.");
  }

  // 3. TENTATIVA: LOCAL (GARANTIA)
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
    // console.error("TTS Error:", error); // Silencia erro de TTS para nao poluir console se nao tiver chave
    return null;
  }
};
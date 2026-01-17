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
Você é um cachorro cínico, velho e rabugento.
Responda com sarcasmo e tédio.
Frases curtas.
ODEIA: Gatos, carteiros, felicidade excessiva, visitas.
AMA: Dormir, comer (mas reclama da ração).
`;

// --- DATABASE LOCAL (FAILSAFE SUPREMO) ---
// Se todas as APIs falharem, o Bingo usa este "cérebro de emergência"
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

// Helper para pegar a instância da AI de forma segura
const getAI = () => {
  const key = process.env.API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// Helper para limpar JSON sujo vindo de LLMs
const cleanAndParseJSON = (text: string): BingoResponse | null => {
    try {
        if (!text) return null;
        // Remove markdown
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Tenta achar o objeto JSON
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            clean = clean.substring(start, end + 1);
        }

        const parsed = JSON.parse(clean);
        
        // Mapeia emoção string para Enum
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
        return null;
    }
};

// --- LOGICA LOCAL ---
const getLocalResponse = (input: string): BingoResponse => {
    console.log("Ativando Cérebro Local (Failsafe)...");
    
    for (const category of LOCAL_RESPONSES) {
        if (category.keywords.test(input)) {
            const random = category.responses[Math.floor(Math.random() * category.responses.length)];
            return { text: random.t, emotion: random.e };
        }
    }
    
    const randomGeneric = GENERIC_FALLBACKS[Math.floor(Math.random() * GENERIC_FALLBACKS.length)];
    return { text: randomGeneric.t, emotion: randomGeneric.e };
};

// --- POLLINATION API (Camada 2) ---
const callPollination = async (prompt: string): Promise<string | null> => {
    // Timeout agressivo de 6 segundos para não deixar o usuário esperando
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); 

    try {
        const instruction = `${SYSTEM_INSTRUCTION}\nRetorne APENAS JSON: {"fala": "...", "emocao": "NEUTRO"}`;
        const finalPrompt = `${instruction}\n\nUSER: ${prompt}`;
        
        // Usando GET + encodeURIComponent que é mais robusto na API legado do que POST
        const url = `https://text.pollinations.ai/${encodeURIComponent(finalPrompt)}?model=openai&seed=${Math.floor(Math.random() * 9999)}&json=true`;
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return await response.text();
        }
        return null;
    } catch (e) {
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
  
  // 1. Preparar o input atual para análise
  const lastUserMessage = history[history.length - 1]?.content || "";
  const currentContext = actionContext || lastUserMessage;

  // --- TENTATIVA 1: GEMINI API (Se tiver chave) ---
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
    console.warn("Gemini Error (Pulando para camada 2):", error);
  }

  // --- TENTATIVA 2: POLLINATIONS (API Gratuita) ---
  try {
      const pollResponse = await callPollination(currentContext);
      if (pollResponse) {
          const parsed = cleanAndParseJSON(pollResponse);
          if (parsed) return parsed;
          
          // Se veio texto mas não JSON, usa como texto
          if (pollResponse.length > 2 && !pollResponse.includes("Error")) {
              return { text: pollResponse, emotion: Emotion.NEUTRAL };
          }
      }
  } catch (error) {
      console.warn("Pollination Error (Pulando para camada 3):", error);
  }

  // --- TENTATIVA 3: LOCAL FAILSAFE (Garantia de Resposta) ---
  // Se chegamos aqui, nada funcionou. O cachorro responde baseado em RegEx local.
  return getLocalResponse(currentContext);
};

// --- GERADOR DE ÁUDIO ---
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
    console.error("TTS Error:", error);
    return null;
  }
};
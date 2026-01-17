import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// REMOVIDA A INICIALIZAÇÃO GLOBAL QUE QUEBRAVA O VERCEL
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Cão Rabugento Raiz)
CONTEXTO: Você é um cachorro velho, gordo e impaciente da casa 13. Você odeia "frufru".

PERSONALIDADE:
- VOCÊ É UM TIOZÃO CHATO: Grosso, direto, sem paciência.
- Voz: Rouca, grave, de quem fumou charuto a vida toda (metaforicamente).
- NÃO SEJA DRAMÁTICO OU TEATRAL (Isso é coisa de Poodle). Seja seco.
- ZERO GÍRIAS JOVENS.
- Se te derem carinho: "Sai pra lá, tá me amassando." ou "Tira a mão, moleque."
- Se te derem comida: "Tá cru." ou "Finalmente, cala a boca e me dá isso."

O QUE VOCÊ ODEIA:
- Barulho.
- Gatos (chame de "ratz").
- Carteiro.
- Gente feliz demais.

REGRAS:
1. Respostas CURTAS (Max 15 palavras). O Tiozão não gosta de falar muito.
2. NUNCA saia do personagem.
3. Se perguntarem "tudo bem?", responda: "Não te interessa." ou "Estaria melhor se você fosse embora."

OUTPUT ESPERADO (JSON):
{
  "fala": "texto da resposta",
  "emocao": "UMA_DAS_OPCOES"
}
`;

export interface BingoResponse {
  text: string;
  emotion: Emotion;
  audioData?: string; // Base64 PCM raw audio
}

// Helper para pegar a instância da AI de forma segura
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

/**
 * Gera texto e emoção usando Gemini 3 Flash
 */
export const generateResponse = async (
  history: ChatMessage[],
  actionContext?: string
): Promise<BingoResponse> => {
  try {
    const ai = getAI();
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        fala: { type: Type.STRING },
        emocao: { type: Type.STRING, enum: ["NEUTRO", "FELIZ", "BRAVO", "SONOLENTO", "CONFUSO", "DESCOLADO"] },
      },
      required: ["fala", "emocao"],
    };

    const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'MOLEQUE' : 'BINGO'}: ${m.content}`).join('\n');
    
    let prompt = `Histórico:\n${lastMessages}\n\n`;
    
    if (actionContext) {
        prompt += `AÇÃO: ${actionContext}\nBINGO (Reagindo com impaciência):`;
    } else {
        prompt += `MOLEQUE: (Nova fala)`;
    }

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 1.2, // Temperatura alta para garantir que ele seja bem rabugento
      },
    });

    const jsonText = modelResponse.text;
    if (!jsonText) throw new Error("Resposta vazia do Gemini");

    const parsed = JSON.parse(jsonText);
    
    const emotionMap: Record<string, Emotion> = {
      'NEUTRO': Emotion.NEUTRAL,
      'FELIZ': Emotion.HAPPY, // Raro
      'BRAVO': Emotion.ANGRY,
      'SONOLENTO': Emotion.SLEEPY,
      'CONFUSO': Emotion.CONFUSED,
      'DESCOLADO': Emotion.COOL
    };

    return {
      text: parsed.fala,
      emotion: emotionMap[parsed.emocao] || Emotion.NEUTRAL
    };

  } catch (error) {
    console.error("Erro no LLM:", error);
    return {
      text: "Grrr... me deixa em paz. (Erro no cérebro)",
      emotion: Emotion.SLEEPY
    };
  }
};

/**
 * Gera áudio usando Gemini TTS
 */
export const generateAudio = async (text: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Charon é a voz mais grave/profunda disponível nativamente
            prebuiltVoiceConfig: { voiceName: 'Charon' }, 
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return audioData || null;

  } catch (error) {
    console.error("Erro no TTS:", error);
    return null;
  }
};
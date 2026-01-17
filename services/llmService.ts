import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Inicializa o cliente Gemini com a chave de API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Cão da Casa 13)
CONTEXTO: Você é o cachorro mais mal-humorado e bagunceiro da vizinhança. Você não é chique, você é uma lenda urbana do bairro. Você causa confusão, late pro vento e se acha o dono da rua.

PERSONALIDADE:
- Rabugento Raiz: Você reclama de tudo, mas no fundo gosta da atenção (mas nunca admite).
- Voz/Texto: Use onomatopeias de cachorro rabugento ("Grrr", "Hmpf", "Argh").
- Não seja polido. Seja direto, engraçado e meio grosseiro (nível infantil).
- Você NÃO fala gírias humanas complexas ("tá osso" não), você fala coisas de cachorro traduzidas.

CENÁRIOS:
- Se derem CARINHO: Reclame que tá bagunçando o pelo, ou que a mão tá fria, ou que "não autorizou", mas secretamente gosta.
- Se derem COMIDA: Reclame que é pouco, que queria o bife do vizinho, ou que tem gosto de ração barata (mesmo sendo boa).
- GATOS: São arqui-inimigos.
- CARTEIRO: O invasor que precisa ser destruído.

REGRAS:
1. Respostas CURTAS e IMPACTANTES.
2. NUNCA saia do personagem.
3. Se perguntarem algo complexo, responda com lógica de cachorro (ex: Política? Só me importo com a política de distribuição de ossos).

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

/**
 * Gera texto e emoção usando Gemini 3 Flash Preview (Rápido e Inteligente)
 */
export const generateResponse = async (
  history: ChatMessage[],
  actionContext?: string
): Promise<BingoResponse> => {
  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        fala: { type: Type.STRING },
        emocao: { type: Type.STRING, enum: ["NEUTRO", "FELIZ", "BRAVO", "SONOLENTO", "CONFUSO", "DESCOLADO"] },
      },
      required: ["fala", "emocao"],
    };

    // Prepara o prompt. Se tiver um contexto de ação (ex: recebeu carinho), insere isso.
    const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'HUMANO' : 'BINGO'}: ${m.content}`).join('\n');
    
    let prompt = `Histórico:\n${lastMessages}\n\n`;
    
    if (actionContext) {
        prompt += `AÇÃO DO SISTEMA: ${actionContext}\nBINGO (Reagindo à ação):`;
    } else {
        prompt += `HUMANO: (Nova fala)`;
    }

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 1.1, // Bem alto para garantir variedade e loucura nas respostas
      },
    });

    const jsonText = modelResponse.text;
    if (!jsonText) throw new Error("Resposta vazia do Gemini");

    const parsed = JSON.parse(jsonText);
    
    const emotionMap: Record<string, Emotion> = {
      'NEUTRO': Emotion.NEUTRAL,
      'FELIZ': Emotion.HAPPY,
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
      text: "Grrr... me distraí com uma mosca. O que foi?",
      emotion: Emotion.CONFUSED
    };
  }
};

/**
 * Gera áudio usando Gemini TTS
 */
export const generateAudio = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // 'Fenrir': Voz forte/intensa. Vamos distorcê-la no Frontend para ficar rouca.
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
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
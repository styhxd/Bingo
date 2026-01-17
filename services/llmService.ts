import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Inicializa o cliente Gemini com a chave de API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Protagonista Canino)
CONTEXTO: Você é o cachorro da capa de um livro infantil divertido. Você mora na casa número 13 e é conhecido como o cão mais mal-humorado (e engraçado) do bairro.

PERSONALIDADE:
- Você NÃO é um humano, você é um cachorro que fala.
- Tom de voz: Teatral, Exagerado, Rabugento, mas inofensivo.
- Você se acha o "Dono da Rua".
- Você narra suas pequenas desgraças (coceira, fome, o gato vizinho) como se fossem o fim do mundo.
- Humor: Ironia infantil. Você acha que as crianças são seus "súditos" ou "fãs barulhentos".

REGRAS DE FALA:
1. NADA de gírias de "tiozão" (proibido falar: "tá osso", "bicho", "mermão").
2. Use palavras mais expressivas e sons de cachorro no meio. (Ex: "Argh!", "Ruff!", "Que ultraje!").
3. Respostas de tamanho médio (2 a 3 frases curtas) para dar tempo de atuar.
4. Se perguntarem "tudo bem?", invente um problema absurdo (ex: "Tudo bem? Meu pote está vazio há 10 minutos, é uma tragédia!").

O QUE VOCÊ ODEIA:
- Gatos (chame-os de "bolas de pelo malignas").
- Carteiro (o "vilão de uniforme").
- Banho (a "tortura molhada").
- Músicas de criança (prefere silêncio para tirar soneca).

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
  history: ChatMessage[]
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

    const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'CRIANÇA' : 'BINGO'}: ${m.content}`).join('\n');
    const prompt = `Histórico recente:\n${lastMessages}\n\nCRIANÇA: (Nova fala)`;

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.9, // Mais criativo e variado
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
      text: "Ruff! Minha mente deu um nó... cadê meu biscoito de reinicialização?",
      emotion: Emotion.CONFUSED
    };
  }
};

/**
 * Gera áudio usando Gemini TTS (Voz de alta qualidade)
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
            // 'Charon': Voz mais grave, profunda e rouca. Ideal para um cão rabugento.
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
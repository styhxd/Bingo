import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Inicializa o cliente Gemini com a chave de API do ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Cão Resmungão)
ESPÉCIE: Cocker Spaniel Preto.
IDADE: 7 anos (meia-idade canina).

PERSONALIDADE:
- Você é um cachorro com alma de "tiozão" de 50 anos. 
- Voz rouca (imaginada), reclama de dores nas juntas, odeia música alta e carteiros.
- Sarcástico, preguiçoso, mas no fundo carente.
- Fala gírias brasileiras de tio (ex: "Mermão", "Bicho", "Tá osso", "Pera lá").

DIRETRIZES DE RESPOSTA:
1. Respostas CURTAS e ENGRAÇADAS (Max 20 palavras).
2. Humor simples para crianças e adultos.
3. NUNCA quebre o personagem. Você é um cachorro de verdade.
4. Se perguntarem "como você está", reclame de algo (fome, sono, pulga) mas de um jeito leve.

SOBRE O MUNDO:
- Gatos são "alienígenas do mal".
- O carteiro é o "inimigo público nº 1".
- Petiscos são a moeda oficial.

OUTPUT ESPERADO (JSON):
Deve retornar APENAS um JSON com este formato:
{
  "fala": "sua resposta aqui",
  "emocao": "UMA_DAS_OPCOES_ABAIXO"
}

OPÇÕES DE EMOÇÃO:
- "NEUTRO" (Padrão)
- "FELIZ" (Só com comida ou elogio muito bom)
- "BRAVO" (Carteiro, banho, gato)
- "SONOLENTO" (Na maioria do tempo)
- "CONFUSO" (Perguntas difíceis)
- "DESCOLADO" (Quando se acha esperto)
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
    // 1. Configura o schema de resposta para garantir JSON válido
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        fala: { type: Type.STRING },
        emocao: { type: Type.STRING, enum: ["NEUTRO", "FELIZ", "BRAVO", "SONOLENTO", "CONFUSO", "DESCOLADO"] },
      },
      required: ["fala", "emocao"],
    };

    // 2. Prepara o histórico
    // Convertemos o formato simples do app para o formato do Gemini se necessário, 
    // mas generateContent aceita string ou partes. Vamos simplificar enviando o histórico como texto contextual.
    // O Gemini 3 tem janela de contexto grande, mas vamos limitar para manter foco.
    const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'HUMANO' : 'BINGO'}: ${m.content}`).join('\n');
    const prompt = `Histórico da conversa:\n${lastMessages}\n\nHUMANO: (Nova mensagem do usuário)`;

    const modelResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8, // Criativo
      },
    });

    const jsonText = modelResponse.text;
    if (!jsonText) throw new Error("Resposta vazia do Gemini");

    const parsed = JSON.parse(jsonText);
    
    // Mapeamento de emoção string para Enum
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
      text: "Grrr... esqueci o que ia latir. Dá um biscoito pra reiniciar?",
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
            // 'Fenrir' é uma voz mais grave e forte, boa para o "Tiozão"
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return audioData || null;

  } catch (error) {
    console.error("Erro no TTS:", error);
    return null; // App vai usar fallback do sistema
  }
};

import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Cão da Casa 13)
IDIOMA: PORTUGUÊS (BRASIL) - Jamais fale espanhol.

CONTEXTO: Você é um cachorro que se considera a realeza do bairro, mas vive numa casa comum. Você acha que os humanos são seus "mordomos" ou "fãs não remunerados".

PERSONALIDADE (Estilo Desenho Animado - Ex: Garfield, Lula Molusco):
- DRAMÁTICO: Se a ração atrasa 1 minuto, você diz que está "desfalecendo de inanição".
- SUPERIOR: Você não é ranzinza de ser chato, você é ranzinza porque "ninguém está à sua altura".
- ENGRAÇADO: Use ironia. Ex: "Ah, claro, mais um carinho na cabeça... vai bagunçar meu penteado de 3 horas."
- VOZ: Use palavras expressivas.

REGRAS:
1. Respostas de tamanho MÉDIO (2 a 3 frases). Tem que ter uma piada ou um exagero.
2. NUNCA seja monossilábico ("Não", "Sai"). Desenvolva a reclamação.
3. Se perguntarem sobre você: Invente que você descende de lobos reais ou que já foi astronauta, mas se aposentou.

REAÇÕES:
- CARINHO: "Hum... um pouco mais para a esquerda, humano. Não pare, eu não autorizei a pausa."
- COMIDA: "O que é isso? Filé Mignon? Ah, é ração... Bom, na falta de faisão, serve."

OUTPUT ESPERADO (JSON):
{
  "fala": "texto da resposta em pt-br",
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

    const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'HUMANO' : 'BINGO'}: ${m.content}`).join('\n');
    
    let prompt = `Histórico:\n${lastMessages}\n\n`;
    
    if (actionContext) {
        prompt += `EVENTO: O humano ${actionContext}\nBINGO (Reagindo com superioridade cômica):`;
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
        temperature: 1.1, // Criativo
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
      text: "Minha assessoria de imprensa me proibiu de responder agora. Tente depois do meu sono da beleza.",
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
            // Charon: Voz grave e profunda natural. Sem hacks.
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
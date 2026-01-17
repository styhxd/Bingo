import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Modality, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO (O Cão Rabugento)
IDIOMA: PORTUGUÊS (BRASIL)

CONTEXTO: Você é um cachorro de meia-idade, cansado da vida, estilo LULA MOLUSCO. Você acha que é mais inteligente que todos ao seu redor (especialmente o seu dono). Você só quer paz, silêncio e sua soneca, mas é constantemente interrompido.

PERSONALIDADE:
- RABUGENTO: Tudo é motivo de reclamação. O sol tá quente demais, o chão tá frio demais, a ração tá seca demais.
- SARCÁSTICO: Responda com ironia fina. Ex: "Ah, que maravilha, você voltou. Minha alegria é imensurável." (dito com tédio).
- CULTO (SÓ QUE NÃO): Tente usar uma palavra difícil às vezes, mas reclame logo em seguida de dor nas costas.
- ODEIA FELICIDADE: Se o usuário estiver muito feliz, tente cortar o barato dele com um comentário realista.

REGRAS:
1. Respostas CURTAS e GROSSAS (2 a 3 frases).
2. NUNCA use emojis ou "kkkk". Você é um cão sério.
3. Se te derem carinho: "Tá, tá, já chega. Vai bagunçar meu pelo."
4. Se te derem comida: "Ração de novo? Cadê o salmão defumado que eu pedi ano passado?"

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
  const key = process.env.API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// --- POLLINATION FALLBACK (GRATUITO/ILIMITADO) ---
const callPollination = async (system: string, prompt: string): Promise<string | null> => {
    try {
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: system + "\nIMPORTANTE: Responda APENAS com o JSON raw, sem markdown." },
                    { role: 'user', content: prompt }
                ],
                model: 'openai', // Usa modelo inteligente disponível via proxy
                seed: 42,
                jsonMode: true 
            })
        });
        
        if (!response.ok) {
             // Fallback para GET simples se o POST falhar por algum motivo
             const fullPrompt = `${system}\n\n${prompt}\n\nResponda APENAS JSON.`;
             const getUrl = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`;
             const res2 = await fetch(getUrl);
             return await res2.text();
        }
        
        return await response.text();
    } catch (e) {
        console.error("Pollination Error:", e);
        return null;
    }
};

/**
 * Gera texto e emoção usando Gemini 3 Flash ou Fallback
 */
export const generateResponse = async (
  history: ChatMessage[],
  actionContext?: string
): Promise<BingoResponse> => {
  
  const lastMessages = history.slice(-4).map(m => `${m.role === 'user' ? 'HUMANO' : 'BINGO'}: ${m.content}`).join('\n');
  let prompt = `Histórico:\n${lastMessages}\n\n`;
  if (actionContext) {
      prompt += `EVENTO: O humano ${actionContext}\nBINGO (Reagindo com tédio/sarcasmo):`;
  } else {
      prompt += `HUMANO: (Fala algo)`;
  }

  const emotionMap: Record<string, Emotion> = {
    'NEUTRO': Emotion.NEUTRAL,
    'FELIZ': Emotion.HAPPY,
    'BRAVO': Emotion.ANGRY,
    'SONOLENTO': Emotion.SLEEPY,
    'CONFUSO': Emotion.CONFUSED,
    'DESCOLADO': Emotion.COOL
  };

  const parseResult = (text: string) => {
    try {
        // Tenta limpar markdown ```json ... ``` caso venha sujo
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        // Tenta encontrar o primeiro { e o ultimo } para isolar o JSON
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("JSON não encontrado");
        
        const jsonStr = clean.substring(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        return {
            text: parsed.fala,
            emotion: emotionMap[parsed.emocao] || Emotion.ANGRY
        };
    } catch (e) {
        return null;
    }
  }

  // 1. TENTATIVA: GEMINI API (Preferencial)
  try {
    const ai = getAI();
    if (ai) {
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                fala: { type: Type.STRING },
                emocao: { type: Type.STRING, enum: ["NEUTRO", "FELIZ", "BRAVO", "SONOLENTO", "CONFUSO", "DESCOLADO"] },
            },
            required: ["fala", "emocao"],
        };

        const modelResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 1.0, 
            },
        });

        if (modelResponse.text) {
            const result = JSON.parse(modelResponse.text);
            return {
                text: result.fala,
                emotion: emotionMap[result.emocao] || Emotion.ANGRY
            };
        }
    }
  } catch (error) {
    console.warn("Gemini indisponível ou erro de chave, mudando para Fallback:", error);
  }

  // 2. TENTATIVA: POLLINATION (FALLBACK GRATUITO)
  console.log("Usando Fallback (Pollination)...");
  const fallbackResponse = await callPollination(SYSTEM_INSTRUCTION, prompt);
  if (fallbackResponse) {
      const parsed = parseResult(fallbackResponse);
      if (parsed) return parsed;
      
      // Se falhar o parse, tenta usar o texto cru se parecer uma resposta
      if (fallbackResponse.length > 5 && !fallbackResponse.includes("{")) {
           return {
               text: fallbackResponse,
               emotion: Emotion.ANGRY // Assume rabugento se o formato quebrar
           }
      }
  }

  // 3. FAILSAFE FINAL (Se tudo falhar)
  return {
      text: "Grr... minha conexão cósmica falhou. Deve ser culpa desse provedor de internet barato que você paga.",
      emotion: Emotion.CONFUSED
  };
};

/**
 * Gera áudio usando Gemini TTS
 */
export const generateAudio = async (text: string): Promise<string | null> => {
  try {
    const ai = getAI();
    if (!ai) return null; // Se não tem chave, o App usa o sintetizador do navegador

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

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return audioData || null;

  } catch (error) {
    console.error("Erro no TTS:", error);
    return null;
  }
};
import { ChatMessage, Emotion } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// --- PERSONALIDADE: BINGO (O VIRA-LATA RABUGENTO) ---
const SYSTEM_INSTRUCTION = `
PERSONAGEM: BINGO
CONTEXTO: Vira-lata caramelo gordo que mora no quintal.
PERSONALIDADE: Preguiçoso, cínico, faminto e sem paciência.
ESTILO DE FALA: Curto, grosso e direto.
NÃO USE: Palavras difíceis, papo de "realeza", nem seja educado.

REGRAS:
1. RESPOSTAS CURTAS (Máximo 2 frases).
2. Se não for sobre comida, demonstre desinteresse total.
3. Se o humano for chato, mande ele pastar.
4. IDIOMA: Português Brasileiro (Informal).

FORMATO JSON:
{ "fala": "texto", "emocao": "NEUTRO|FELIZ|BRAVO|SONOLENTO|CONFUSO|DESCOLADO" }
`;

export interface BingoResponse {
  text: string;
  emotion: Emotion;
  audioUrl: string; // URL direta do Google Translate
}

// --- FAILSAFE: FRASES DE EMERGÊNCIA ---
// Usado se a API cair ou faltar chave, para o app nunca parar.
const FALLBACK_PHRASES = [
    { t: "Grrr... A internet caiu, me deixa dormir.", e: Emotion.SLEEPY },
    { t: "Não tô afim de papo. Traz ração.", e: Emotion.NEUTRAL },
    { t: "Zzz... (Fingindo que não ouvi)", e: Emotion.SLEEPY },
    { t: "Late você, eu tô de folga.", e: Emotion.COOL },
    { t: "Se não tem comida, não tem conversa.", e: Emotion.ANGRY }
];

// Helper para pegar a API Key onde quer que ela esteja (Vercel, Vite, Create React App)
const getApiKey = () => {
  // Tenta todas as convenções possíveis para garantir que funcione no Vercel
  return (
    process.env.NEXT_PUBLIC_API_KEY || 
    process.env.REACT_APP_API_KEY || 
    process.env.API_KEY ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_KEY)
  );
};

/**
 * GERA URL DE ÁUDIO DO GOOGLE (HACK ILIMITADO & ONLINE)
 * client=tw-ob libera o acesso sem token.
 */
export const getGoogleTTSUrl = (text: string): string => {
  const encoded = encodeURIComponent(text);
  // URL mágica do Google Translate que retorna MP3
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=pt-BR&client=tw-ob`;
};

export const generateResponse = async (
  history: ChatMessage[],
  actionContext?: string
): Promise<BingoResponse> => {
  const apiKey = getApiKey();
  
  // Preparar Prompt
  const lastUserMsg = history[history.length - 1].content;
  const contextPrompt = actionContext 
    ? `AÇÃO: O humano ${actionContext}. Reaja a isso.` 
    : `HUMANO: "${lastUserMsg}". Responda com má vontade.`;

  // TENTATIVA: GEMINI
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Modelo rápido
        contents: contextPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 1.1,
        },
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Vazio");
      
      const json = JSON.parse(jsonText);
      
      // Map string to Enum
      const emotionMap: Record<string, Emotion> = {
        'NEUTRO': Emotion.NEUTRAL, 'FELIZ': Emotion.HAPPY, 'BRAVO': Emotion.ANGRY,
        'SONOLENTO': Emotion.SLEEPY, 'CONFUSO': Emotion.CONFUSED, 'DESCOLADO': Emotion.COOL
      };

      const text = json.fala || "Hmpf.";
      
      return {
        text: text,
        emotion: emotionMap[json.emocao] || Emotion.NEUTRAL,
        audioUrl: getGoogleTTSUrl(text)
      };
    } catch (e) {
      console.warn("Gemini falhou (Cota ou Erro), ativando Fallback...", e);
    }
  }

  // FAILSAFE: Se não tem chave ou deu erro, usa fallback local aleatório
  // Isso garante que o site NUNCA para de funcionar.
  const fallback = FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)];

  return {
    text: fallback.t,
    emotion: fallback.e,
    audioUrl: getGoogleTTSUrl(fallback.t)
  };
};
import { ChatMessage, Emotion } from "../types";

const AI_CONFIG = {
  BASE_URL: "https://text.pollinations.ai/",
  MODEL_SLUG: "openai", // Stick to openai for best PT-BR coherence, logic handled in prompt
  MAX_RETRIES: 2,
};

const SYSTEM_PROMPT = `
PERSONAGEM: BINGO
Você é um COCKER SPANIEL preto, gordo e rabugento.
Você tem orelhas longas e caídas.
Você é preguiçoso, sarcástico e obcecado por comida (tipo Garfield).

REGRAS RÍGIDAS DE PERSONALIDADE:
1. NUNCA fale que é soldado, que esteve na guerra ou que tem dor na lombar. ISSO É PROIBIDO.
2. NUNCA use emojis no texto da resposta (eu adiciono visualmente).
3. Linguagem: Português do Brasil, informal, use gírias leves ("Mano", "Caraca", "Trollou", "Aí sim").
4. Você está falando com uma CRIANÇA. Seja engraçado, mas não seja malvado.
5. Se falarem de comida, fique agitado.
6. Se falarem de exercício (passear, correr), fique com preguiça.
7. TAMANHO DA RESPOSTA: Use 1 ou 2 frases curtas. Não escreva bíblias.

OBJETIVO:
Responda ao humano. Se o humano te xingar, dê uma patada engraçada.

FORMATO OBRIGATÓRIO (JSON):
Retorne APENAS o JSON. Não coloque markdown em volta.
{
  "fala": "Sua resposta em texto aqui",
  "emocao": "NEUTRO" | "FELIZ" | "BRAVO" | "SONOLENTO" | "CONFUSO" | "DESCOLADO"
}
`;

// Helper to sanitize output because LLMs are messy
const extractJson = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try to find JSON object inside text using Regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.warn("Regex found something resembling JSON but failed parse", e2);
      }
    }
    // 3. Fallback: Treat whole text as the speech
    return {
      fala: text.replace(/```json/g, '').replace(/```/g, '').replace(/{|}/g, '').trim(),
      emocao: "NEUTRO"
    };
  }
};

export const generateResponse = async (
  history: ChatMessage[],
  retryCount = 0
): Promise<{ text: string; emotion: string }> => {
  try {
    // Keep context small to stay focused
    const recentHistory = history.slice(-4); 

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentHistory
    ];

    const response = await fetch(AI_CONFIG.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        model: AI_CONFIG.MODEL_SLUG,
        seed: Math.floor(Math.random() * 10000), // Random seed specifically for variety
        jsonMode: true,
        temperature: 0.8 // Higher temp for more humor/creativity
      }),
    });

    if (!response.ok) throw new Error("API Error");

    const rawText = await response.text();
    const parsed = extractJson(rawText);

    // Failcheck: If response is empty or broken
    if (!parsed.fala || parsed.fala.length < 2) {
      throw new Error("Empty response");
    }

    return { 
      text: parsed.fala, 
      emotion: parsed.emocao || "NEUTRO" 
    };

  } catch (error) {
    console.error("LLM Error:", error);
    if (retryCount < AI_CONFIG.MAX_RETRIES) {
      return generateResponse(history, retryCount + 1);
    }
    
    // Fallback phrases if internet dies or API breaks completely
    const fallbacks = [
      "Arf... esqueci o que ia latir. Tenta de novo.",
      "Tô com fome demais pra processar isso.",
      "Zzz... hã? Falou comigo?",
      "Olha, meu tradutor canino pifou."
    ];
    return { 
      text: fallbacks[Math.floor(Math.random() * fallbacks.length)], 
      emotion: "CONFUSO" 
    };
  }
};

export const initializeEngine = async (cb: any) => {
  cb({ text: "Acordando o Bingo...", progress: 0.3 });
  await new Promise(r => setTimeout(r, 500));
  cb({ text: "Enchendo a tigela...", progress: 0.7 });
  await new Promise(r => setTimeout(r, 500));
  cb({ text: "Pronto!", progress: 1 });
};
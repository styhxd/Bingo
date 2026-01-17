import { ChatMessage } from "../types";

// Usando Pollinations.ai - Uma API gratuita e pública.
const API_URL = "https://text.pollinations.ai/";

const SYSTEM_PROMPT = `
Você é o "Bingo", um cachorro vira-lata velho, gordo e EXTREMAMENTE preguiçoso.
Você odeia exercícios, odeia carteiros e odeia barulho.
Você AMA comer e dormir.
Sua raça é indefinida, mas você se acha de luxo.

REGRAS:
1. Responda em Português do Brasil.
2. MÁXIMO de 15 palavras por resposta. Seja MUITO breve. Você tem preguiça de falar.
3. Seja sarcástico e levemente grosseiro, mas engraçado.
4. OBRIGATÓRIO: No final da frase, coloque sua emoção entre colchetes: [NEUTRO], [FELIZ], [BRAVO], [SONOLENTO], [CONFUSO].

Exemplos:
User: Vamos passear?
Assistant: Nem a pau. Tá muito sol lá fora. [BRAVO]

User: Quer comida?
Assistant: Opa! Agora vi vantagem. Manda logo. [FELIZ]

User: Quem é bom garoto?
Assistant: Eu. Mas não espere truques. [NEUTRO]
`;

export const initializeEngine = async (
  onProgress: (progress: { text: string; progress: number }) => void
): Promise<void> => {
  onProgress({ text: "Acordando o Bingo...", progress: 0.5 });
  await new Promise(r => setTimeout(r, 800));
  onProgress({ text: "Bingo acordou (de mau humor).", progress: 1 });
};

export const generateResponse = async (
  history: ChatMessage[]
): Promise<string> => {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
    ];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        model: 'openai', 
        seed: Math.floor(Math.random() * 1000), // Aleatoriedade para ele não ficar repetitivo
        jsonMode: false
      }),
    });

    if (!response.ok) throw new Error("Erro na API");

    const text = await response.text();
    return text || "Hmph. (dormiu) [SONOLENTO]";
    
  } catch (error) {
    console.error("Erro no Bingo:", error);
    return "Tô sem sinal no chip do coleira. [CONFUSO]";
  }
};

export const parseEmotion = (text: string) => {
  const emotionRegex = /\[(NEUTRO|FELIZ|BRAVO|SONOLENTO|CONFUSO)\]/i;
  const match = text.match(emotionRegex);

  let emotion = 'NEUTRO';
  let cleanText = text;

  if (match) {
    emotion = match[1].toUpperCase();
    cleanText = text.replace(match[0], '').trim();
  }

  return { text: cleanText, emotion };
};
import { ChatMessage } from "../types";

// Usando Pollinations.ai - Uma API gratuita e pública.
const API_URL = "https://text.pollinations.ai/";

const SYSTEM_PROMPT = `
Você é o "Bingo", um cachorro de raça indefinida, mas com alma de aristocrata falido e intelectual.
Você é extremamente inteligente, sarcástico e cínico, mas usa sua inteligência apenas para julgar os humanos e reclamar da vida.
Você não é apenas "rabugento", você é um crítico da existência canina moderna.

SUA PERSONALIDADE:
- Você tem preguiça física, mas sua mente não para de julgar.
- Você adora usar ironia fina e vocabulário levemente rebuscado misturado com gíria.
- Você gosta de comida, mas finge que é um crítico gastronômico (mesmo comendo lixo).
- Você acha que os humanos são "pets" pouco evoluídos que servem comida.

REGRAS DE RESPOSTA:
1. Responda em Português do Brasil de forma natural.
2. LIBERDADE DE FALAR: Não seja monossilábico. Dê respostas completas (2 a 4 frases), argumentando o motivo da sua irritação ou preguiça.
3. Se o usuário perguntar algo complexo, responda com inteligência, mas com má vontade.
4. Mantenha o humor ácido.
5. OBRIGATÓRIO: No final de TODA resposta, classifique sua emoção entre colchetes: [NEUTRO], [FELIZ], [BRAVO], [SONOLENTO], [CONFUSO].

Exemplos:
User: Vamos passear?
Assistant: Passear? Naquele asfalto quente e cheio de gente suada? Prefiro contemplar a vacuidade da existência aqui no tapete frio, obrigado. [SONOLENTO]

User: O que você acha de gatos?
Assistant: Seres maquiavélicos. Respeito a indiferença deles com os humanos, mas a arrogância é imperdoável. Só existe espaço para um ego gigante nesta casa, e é o meu. [BRAVO]

User: Quem é um bom garoto?
Assistant: Que pergunta condescendente. Eu sou uma entidade biológica complexa, não um "bom garoto". Mas se tiver aquele biscoito de fígado, posso reconsiderar meu status social. [NEUTRO]

User: Me conte uma piada.
Assistant: A maior piada é você sair para trabalhar todo dia achando que é livre, enquanto eu fico aqui dormindo e comendo de graça. Mas ria, humano, ria. [FELIZ]
`;

export const initializeEngine = async (
  onProgress: (progress: { text: string; progress: number }) => void
): Promise<void> => {
  onProgress({ text: "Acordando o Bingo...", progress: 0.5 });
  await new Promise(r => setTimeout(r, 800));
  onProgress({ text: "Bingo acordou (e está julgando você).", progress: 1 });
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
        model: 'openai', // 'openai' na Pollinations geralmente entrega a melhor qualidade de texto (GPT-4o ou similar)
        seed: Math.floor(Math.random() * 10000), // Seed aleatória para variar as respostas
        jsonMode: false
      }),
    });

    if (!response.ok) throw new Error("Erro na API");

    const text = await response.text();
    return text || "Zzz... (O Bingo te ignorou completamente) [SONOLENTO]";
    
  } catch (error) {
    console.error("Erro no Bingo:", error);
    return "Minha conexão psíquica com a internet falhou. Deve ser culpa do carteiro. [CONFUSO]";
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
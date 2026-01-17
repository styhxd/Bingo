export enum Emotion {
  NEUTRAL = 'NEUTRO',
  HAPPY = 'FELIZ',
  ANGRY = 'BRAVO',
  SLEEPY = 'SONOLENTO',
  CONFUSED = 'CONFUSO',
  LOADING = 'CARREGANDO'
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelProgress {
  text: string;
  progress: number;
}

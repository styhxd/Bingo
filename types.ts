export enum Emotion {
  NEUTRAL = 'NEUTRO',
  HAPPY = 'FELIZ',
  ANGRY = 'BRAVO',
  SLEEPY = 'SONOLENTO',
  CONFUSED = 'CONFUSO',
  LOADING = 'CARREGANDO',
  COOL = 'DESCOLADO'
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type Accessory = 'NONE' | 'GLASSES' | 'HAT' | 'BOWTIE';

export interface GameState {
  patience: number; // 0 a 100
  isRaging: boolean;
}
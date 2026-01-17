import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, RefreshCcw, Hand, Bone, Volume2 } from 'lucide-react';
import { generateResponse, generateAudio } from './services/llmService';
import DogAvatar from './components/DogAvatar';
import { ChatMessage, Emotion, GameState } from './types';

// --- LOCAL BRAIN (Apenas frases de carregamento) ---
const LOADING_PHRASES = [
    "Rosnando pro nada...",
    "Coçando a pulga...",
    "Julgando sua roupa...",
    "Ignorando o carteiro...",
    "Limpando a pata..."
];

// --- AUDIO UTILS ---
const decodeAudioData = async (
  base64String: string,
  ctx: AudioContext
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
};

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Pensando...");
  const [emotion, setEmotion] = useState<Emotion>(Emotion.SLEEPY);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    xp: 0,
    level: 1,
    unlockedAccessories: ['NONE'],
    currentAccessory: 'NONE'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        const random = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
        setLoadingText(random);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playAudio = async (text: string, pcmBase64?: string | null) => {
    if (!voiceEnabled) return;
    initAudioContext();

    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    window.speechSynthesis.cancel();

    if (pcmBase64 && audioContextRef.current) {
      try {
        const buffer = await decodeAudioData(pcmBase64, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        
        // --- HACK DA VOZ ROUCA ---
        // Diminui a velocidade de reprodução. Isso baixa o tom (pitch) da voz.
        // 0.85 = Voz mais grossa, lenta e "monstruosa/canina".
        source.playbackRate.value = 0.85; 

        source.connect(audioContextRef.current.destination);
        source.start();
        currentSourceRef.current = source;
        return; 
      } catch (e) {
        console.warn("Falha ao decodificar áudio Gemini, usando fallback.", e);
      }
    }

    // Fallback System Voice
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.pitch = 0.1; // Mínimo possível
    utterance.rate = 0.8; 
    
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.includes('BR') && v.name.toLowerCase().includes('google')) || 
                      voices.find(v => v.lang.includes('BR'));
    
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  };

  const addXp = (amount: number) => {
    setGameState(prev => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(newXp / 100) + 1;
      
      let newAccessories = [...prev.unlockedAccessories];
      let newCurrent = prev.currentAccessory;

      if (newLevel >= 2 && !newAccessories.includes('HAT')) {
        newAccessories.push('HAT');
        if (prev.level < 2) newCurrent = 'HAT'; 
      } else if (newLevel >= 5 && !newAccessories.includes('GLASSES')) {
        newAccessories.push('GLASSES');
        if (prev.level < 5) newCurrent = 'GLASSES';
      }

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        unlockedAccessories: newAccessories,
        currentAccessory: newCurrent
      };
    });
  };

  const handleStart = async () => {
    setStarted(true);
    initAudioContext();
    const intro = "Hmpf... Quem acordou a fera? Espero que tenha um bom motivo.";
    
    if (audioContextRef.current) {
       const emptyBuffer = audioContextRef.current.createBuffer(1, 1, 22050);
       const source = audioContextRef.current.createBufferSource();
       source.buffer = emptyBuffer;
       source.connect(audioContextRef.current.destination);
       source.start();
    }

    // Delay artificial pequeno para garantir que o audioContext esteja pronto
    setLoading(true);
    setLoadingText("Acordando mal-humorado...");
    
    const audioData = await generateAudio(intro);
    setLoading(false);
    
    setMessages([{ role: 'assistant', content: intro }]);
    setEmotion(Emotion.ANGRY);
    playAudio(intro, audioData);
  };

  const processInteraction = async (userText: string, actionContext?: string) => {
    if (loading) return;

    // Atualiza UI
    // Se for ação (carinho/comida), mostramos uma mensagem descritiva do usuário
    const visibleUserMessage = actionContext 
        ? (actionContext === 'CARINHO' ? '*Tenta fazer carinho*' : '*Oferece um petisco duvidoso*') 
        : userText;

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: visibleUserMessage }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    setEmotion(Emotion.LOADING);
    
    // Se for carinho/comida dá mais XP
    addXp(actionContext ? 50 : 20);

    try {
        // Prepara contexto para IA
        const aiActionContext = actionContext 
            ? (actionContext === 'CARINHO' ? 'O usuário tentou fazer carinho na sua cabeça.' : 'O usuário te ofereceu um petisco.') 
            : undefined;

        const response = await generateResponse(newHistory, aiActionContext);
        
        let audioData = null;
        if (voiceEnabled) {
            audioData = await generateAudio(response.text);
        }

        setEmotion(response.emotion);
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
        playAudio(response.text, audioData);
        
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'assistant', content: "Grrr... buguei. Tenta de novo." }]);
    } finally {
        setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    processInteraction(input);
  };

  const handleInstantAction = (type: 'PET' | 'FOOD') => {
    // Agora chama a IA para gerar a resposta
    processInteraction('', type === 'PET' ? 'CARINHO' : 'FOOD');
  };

  if (!started) {
    return (
      <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-6 font-fredoka overflow-hidden relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-200 via-orange-400 to-red-500 animate-pulse"></div>
        
        <div className="bg-white border-4 border-black p-8 rounded-[2rem] shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] text-center max-w-sm w-full relative z-10 transform -rotate-1 flex flex-col items-center">
          
          <div className="mb-6 transform scale-110 hover:scale-125 transition-transform duration-500">
             <DogAvatar 
                emotion={Emotion.SLEEPY} 
                isTalking={false} 
                onInteraction={handleStart} 
                accessory={'NONE'} 
             />
          </div>

          <h1 className="text-7xl font-black text-black mb-2 tracking-tighter drop-shadow-sm uppercase" style={{ WebkitTextStroke: '2px white' }}>Bingo</h1>
          <p className="text-black font-bold text-xl bg-yellow-300 inline-block px-4 py-1 border-2 border-black rounded-full mb-8 rotate-2">
            O Cão Resmungão
          </p>
          
          <button 
            onClick={handleStart}
            className="w-full bg-blue-500 hover:bg-blue-400 text-white border-4 border-black text-2xl font-black py-4 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <Volume2 size={32} strokeWidth={3} />
            ACORDAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#87CEEB] overflow-hidden font-fredoka relative">
      
      {/* Background Elements */}
      <div className="absolute bottom-0 w-full h-1/3 bg-green-400 border-t-8 border-black z-0"></div>
      <div className="absolute top-10 left-10 w-24 h-24 bg-white rounded-full opacity-50 blur-xl"></div>
      
      {/* HUD */}
      <div className="relative z-20 px-4 pt-4 flex justify-between items-start">
        <div className="flex items-center gap-3 bg-white border-4 border-black rounded-2xl p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-12 h-12 bg-yellow-400 rounded-xl border-2 border-black flex items-center justify-center font-black text-2xl">
            {gameState.level}
          </div>
          <div className="flex flex-col pr-2">
            <span className="text-xs font-black uppercase text-slate-500">Nível de Preguiça</span>
            <div className="w-32 h-4 bg-slate-200 rounded-full border-2 border-black overflow-hidden relative">
               <div 
                 className="h-full bg-gradient-to-r from-green-400 to-green-500"
                 style={{ width: `${Math.min((gameState.xp % 100), 100)}%` }}
               />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-3 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all ${voiceEnabled ? 'bg-white text-black' : 'bg-red-400 text-white'}`}>
            <Volume2 size={24} strokeWidth={3} />
          </button>
          <button onClick={() => window.location.reload()} className="p-3 bg-white text-black border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
            <RefreshCcw size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Main Scene */}
      <div className="flex-none h-[45vh] flex flex-col items-center justify-center relative z-10 mt-4">
        <DogAvatar 
          emotion={emotion} 
          isTalking={false} 
          onInteraction={() => handleInstantAction('PET')}
          accessory={gameState.currentAccessory}
        />
        
        <div className="flex gap-4 mt-6">
            <button 
                onClick={() => handleInstantAction('PET')}
                disabled={loading}
                className="group bg-pink-400 hover:bg-pink-300 border-4 border-black px-6 py-2 rounded-full font-black text-white text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
            >
                <Hand size={24} strokeWidth={3} />
                <span className="hidden md:inline">CARINHO</span>
            </button>
            <button 
                onClick={() => handleInstantAction('FOOD')}
                disabled={loading}
                className="group bg-orange-400 hover:bg-orange-300 border-4 border-black px-6 py-2 rounded-full font-black text-white text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
            >
                <Bone size={24} strokeWidth={3} />
                <span className="hidden md:inline">PETISCO</span>
            </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white border-t-4 border-black relative z-20 flex flex-col min-h-0">
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                relative max-w-[85%] px-5 py-3 text-lg font-bold border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]
                ${msg.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-2xl rounded-tr-none mr-2' 
                    : 'bg-yellow-100 text-black rounded-2xl rounded-tl-none ml-2'}
                `}>
                {msg.content}
                </div>
            </div>
            ))}
            
            {loading && (
             <div className="flex justify-start ml-2">
                <div className="bg-slate-200 border-4 border-black px-4 py-2 rounded-2xl rounded-tl-none animate-pulse text-slate-500 font-bold italic">
                   {loadingText}
                </div>
             </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-100 border-t-4 border-black">
            <div className="flex gap-2 max-w-3xl mx-auto">
                <button 
                    onClick={() => {
                        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                        if (SpeechRecognition) {
                          const recognition = new SpeechRecognition();
                          recognition.lang = 'pt-BR';
                          recognition.start();
                          setIsListening(true);
                          recognition.onresult = (e: any) => {
                              const text = e.results[0][0].transcript;
                              processInteraction(text);
                              setIsListening(false);
                          };
                          recognition.onend = () => setIsListening(false);
                        } else {
                          alert("Seu navegador não suporta voz :(");
                        }
                    }}
                    className={`p-3 border-4 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-500'}`}
                >
                    <Mic size={24} strokeWidth={3} />
                </button>
                
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Fale com o Bingo..."
                    className="flex-1 bg-white border-4 border-black p-3 rounded-xl outline-none font-bold text-slate-800 placeholder-slate-400 text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    disabled={loading}
                />
                
                <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="p-3 bg-blue-500 hover:bg-blue-400 text-white border-4 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={24} strokeWidth={3} />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;
import React, { useState, useEffect, useRef } from 'react';
import { Send, Volume2, VolumeX, Hand, Bone, Activity, BatteryWarning } from 'lucide-react';
import { generateResponse } from './services/llmService';
import DogAvatar from './components/DogAvatar';
import { ChatMessage, Emotion } from './types';

const LOADING_PHRASES = [
    "Coçando a orelha...",
    "Ignorando você...",
    "Pensando na janta...",
    "Suspirando...",
    "Olhando pro nada..."
];

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("...");
  const [emotion, setEmotion] = useState<Emotion>(Emotion.SLEEPY);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // --- NOVIDADE: SISTEMA DE PACIÊNCIA ---
  // Substitui o XP. Se zerar, o cachorro fica bravo.
  const [patience, setPatience] = useState(100); 
  const [isRaging, setIsRaging] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Loading animado
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingText(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Lógica de FÚRIA (Paciência Zero)
  useEffect(() => {
    if (patience <= 0 && !isRaging) {
      triggerRageMode();
    }
  }, [patience]);

  const triggerRageMode = () => {
    setIsRaging(true);
    setEmotion(Emotion.ANGRY);
    setLoading(false);
    
    // Toca som de latido/rosnado usando o Google TTS Hack com texto de latido
    playAudio(`https://translate.google.com/translate_tts?ie=UTF-8&q=GRRRRRRRRRRRRRRRRRRRRRRR&tl=pt-BR&client=tw-ob`, true);
    
    setMessages(prev => [...prev, { role: 'assistant', content: "*LATINDO FURIOSAMENTE*" }]);

    // Recupera após 4 segundos
    setTimeout(() => {
      setIsRaging(false);
      setPatience(40); // Volta um pouco calmo
      setEmotion(Emotion.NEUTRAL);
    }, 4000);
  };

  const updatePatience = (amount: number) => {
    if (isRaging) return;
    setPatience(prev => Math.min(Math.max(prev + amount, 0), 100));
  };

  /**
   * PLAYER DE ÁUDIO COM MODIFICADOR DE VOZ
   * Usa playbackRate para transformar a voz do Google em voz de cachorro velho.
   */
  const playAudio = (url: string, isBark = false) => {
    if (!voiceEnabled) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    // TRUQUE: 0.85 deixa a voz grossa e ranzinza. 
    // 1.2 deixa o latido (GRRR) mais agudo e agressivo.
    audio.playbackRate = isBark ? 1.1 : 0.85; 
    
    audio.play().catch(e => console.error("Erro playback:", e));
    audioRef.current = audio;
  };

  const handleStart = () => {
    setStarted(true);
    const intro = "Já acordei, que saco. O que você quer?";
    setMessages([{ role: 'assistant', content: intro }]);
    setEmotion(Emotion.SLEEPY);
    playAudio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(intro)}&tl=pt-BR&client=tw-ob`);
  };

  const processInteraction = async (userText: string, actionContext?: string) => {
    if (loading || isRaging) return;

    // Mecânica de Paciência
    if (actionContext === 'CARINHO') updatePatience(-25); // Odeia ser tocado
    else if (actionContext === 'FOOD') updatePatience(50); // Ama comida
    else updatePatience(-10); // Falar cansa ele

    const visibleUserMessage = actionContext 
        ? (actionContext === 'CARINHO' ? '*Cutuquei*' : '*Dei comida*') 
        : userText;

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: visibleUserMessage }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    setEmotion(Emotion.LOADING);

    try {
        const aiActionContext = actionContext 
            ? (actionContext === 'CARINHO' ? 'te cutucou' : 'te deu comida') 
            : undefined;

        const response = await generateResponse(newHistory, aiActionContext);
        
        if (!isRaging) {
            setEmotion(response.emotion);
            setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
            playAudio(response.audioUrl);
        }
    } catch (e) {
        // Fallback final
        setMessages(prev => [...prev, { role: 'assistant', content: "Hmpf." }]);
    } finally {
        setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    processInteraction(input);
  };

  const handleInstantAction = (type: 'PET' | 'FOOD') => {
    processInteraction('', type === 'PET' ? 'CARINHO' : 'FOOD');
  };

  // --- TELA INICIAL ---
  if (!started) {
    return (
      <div className="min-h-screen bg-sky-600 flex flex-col items-center justify-center p-6 font-fredoka overflow-hidden relative">
        <div className="absolute inset-0 bg-sky-700 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent"></div>
        
        <div className="bg-stone-100 border-8 border-black p-8 rounded-[2rem] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-center max-w-sm w-full relative z-10 flex flex-col items-center rotate-1">
          
          <div className="mb-8 transform scale-110">
             <DogAvatar emotion={Emotion.SLEEPY} isTalking={false} onInteraction={handleStart} accessory={'NONE'} />
          </div>

          <h1 className="text-6xl font-black text-black mb-2 uppercase tracking-tighter">Bingo</h1>
          <p className="text-stone-500 font-bold text-lg mb-8 bg-white px-4 py-1 rounded-full border-2 border-black">
            Cão Rabugento
          </p>
          
          <button 
            onClick={handleStart}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white border-4 border-black text-2xl font-black py-4 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
          >
            ACORDAR
          </button>
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL ---
  return (
    <div className={`flex flex-col h-screen overflow-hidden font-fredoka relative transition-colors duration-300 ${isRaging ? 'bg-red-900' : 'bg-[#a3c9db]'}`}>
      
      {/* Background */}
      <div className={`absolute bottom-0 w-full h-1/3 border-t-8 border-black z-0 transition-colors ${isRaging ? 'bg-red-800' : 'bg-[#7eb568]'}`}></div>
      
      {/* HUD SUPERIOR */}
      <div className="relative z-20 px-4 pt-4 flex justify-between items-start">
        
        {/* Pacienciômetro */}
        <div className={`flex flex-col w-full max-w-[180px] border-4 border-black rounded-xl p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white transition-transform ${isRaging ? 'animate-bounce bg-red-200' : ''}`}>
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs font-black uppercase text-black flex items-center gap-1">
               <BatteryWarning size={14} /> Paciência
             </span>
             <span className="text-xs font-bold">{patience}%</span>
          </div>
          <div className="w-full h-6 bg-stone-300 rounded-lg border-2 border-black overflow-hidden relative">
             <div 
               className={`h-full transition-all duration-300 ${patience < 30 ? 'bg-red-500' : (patience < 60 ? 'bg-yellow-400' : 'bg-green-500')}`}
               style={{ width: `${patience}%` }}
             />
          </div>
        </div>

        {/* Botão de Som */}
        <div className="flex gap-2 ml-4">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-3 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all ${voiceEnabled ? 'bg-white text-black' : 'bg-stone-400 text-stone-600'}`}>
            {voiceEnabled ? <Volume2 size={24} strokeWidth={3} /> : <VolumeX size={24} strokeWidth={3} />}
          </button>
        </div>
      </div>

      {/* ÁREA DO CACHORRO */}
      <div className="flex-none h-[40vh] flex flex-col items-center justify-center relative z-10 mt-4">
        
        {isRaging && (
            <div className="absolute -top-10 text-red-500 font-black text-6xl animate-ping opacity-75 drop-shadow-[0_4px_0_#000]">GRRR!</div>
        )}

        <div className={`${isRaging ? 'animate-[spin_0.5s_ease-in-out_infinite]' : 'animate-float'}`}>
            <DogAvatar 
                emotion={emotion} 
                isTalking={loading} 
                onInteraction={() => handleInstantAction('PET')}
                accessory={'NONE'} 
            />
        </div>
        
        {/* Ações Rápidas */}
        <div className="flex gap-4 mt-8">
            <button 
                onClick={() => handleInstantAction('PET')}
                disabled={loading || isRaging}
                className="group bg-rose-400 hover:bg-rose-300 disabled:bg-stone-500 border-4 border-black px-6 py-3 rounded-2xl font-black text-white text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
            >
                <Hand size={24} strokeWidth={3} />
                <span className="hidden md:inline">CUTUCAR</span>
            </button>
            <button 
                onClick={() => handleInstantAction('FOOD')}
                disabled={loading || isRaging}
                className="group bg-orange-500 hover:bg-orange-400 disabled:bg-stone-500 border-4 border-black px-6 py-3 rounded-2xl font-black text-white text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
            >
                <Bone size={24} strokeWidth={3} />
                <span className="hidden md:inline">COMIDA</span>
            </button>
        </div>
      </div>

      {/* ÁREA DE CHAT */}
      <div className="flex-1 bg-white border-t-8 border-black relative z-20 flex flex-col min-h-0">
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                relative max-w-[85%] px-5 py-3 text-xl font-bold border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]
                ${msg.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-2xl rounded-tr-none mr-2' 
                    : 'bg-stone-200 text-black rounded-2xl rounded-tl-none ml-2'}
                `}>
                {msg.content}
                </div>
            </div>
            ))}
            
            {loading && !isRaging && (
             <div className="flex justify-start ml-2">
                <div className="bg-stone-100 border-4 border-black px-4 py-2 rounded-2xl rounded-tl-none animate-pulse text-stone-500 font-bold">
                   {loadingText}
                </div>
             </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 bg-stone-100 border-t-4 border-black">
            <div className="flex gap-2 max-w-3xl mx-auto">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder={isRaging ? "ELE ESTÁ FURIOSO..." : "Fale logo..."}
                    className="flex-1 bg-white border-4 border-black p-3 rounded-xl outline-none font-bold text-black placeholder-stone-400 text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                    disabled={loading || isRaging}
                />
                
                <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading || isRaging}
                    className="p-3 bg-green-500 hover:bg-green-400 text-white border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
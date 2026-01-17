import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, RefreshCcw, Sparkles, Volume2, Hand } from 'lucide-react';
import { generateResponse } from './services/llmService';
import DogAvatar from './components/DogAvatar';
import { ChatMessage, Emotion, GameState } from './types';

// Speech Recognition Types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>(Emotion.SLEEPY);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    xp: 0,
    level: 1,
    unlockedAccessories: ['NONE'],
    currentAccessory: 'NONE'
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // --- FEATURE: TTS (Text to Speech) ---
  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    // Stop previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.pitch = 0.6; // Deep voice for a big dog
    utterance.rate = 1.1;  // Slightly faster
    
    // Try to find a male voice
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => v.name.includes('Google Português') || v.name.includes('Daniel'));
    if (maleVoice) utterance.voice = maleVoice;

    window.speechSynthesis.speak(utterance);
  };

  // --- FEATURE: Background Color Mood ---
  const getBgColor = () => {
    switch (emotion) {
      case Emotion.ANGRY: return "bg-red-50";
      case Emotion.HAPPY: return "bg-yellow-50";
      case Emotion.SLEEPY: return "bg-slate-100";
      case Emotion.COOL: return "bg-purple-50";
      case Emotion.CONFUSED: return "bg-orange-50";
      default: return "bg-[#F7F9FC]";
    }
  };

  // --- LOGIC: Voice Input ---
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Navegador sem suporte a voz! Use o Chrome.");
      return;
    }
    
    if (isListening) return;

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setInput(text);
      handleSend(text);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const addXp = (amount: number) => {
    setGameState(prev => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(newXp / 50) + 1;
      
      let newAccessories = [...prev.unlockedAccessories];
      let newCurrent = prev.currentAccessory;

      if (newLevel >= 2 && !newAccessories.includes('HAT')) {
        newAccessories.push('HAT');
        newCurrent = 'HAT'; 
      } else if (newLevel >= 4 && !newAccessories.includes('GLASSES')) {
        newAccessories.push('GLASSES');
        newCurrent = 'GLASSES';
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

  const handleStart = () => {
    setStarted(true);
    // Initial message
    const intro = "E aí? Já trouxe minha comida ou só veio gastar meu tempo?";
    setMessages([{ role: 'assistant', content: intro }]);
    setEmotion(Emotion.NEUTRAL);
    setTimeout(() => speak(intro), 500);
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || loading) return;

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    
    // Determine emotion based on user text keywords while waiting (instant feedback)
    if (textToSend.match(/comida|biscoito|osso|fome/i)) setEmotion(Emotion.HAPPY);
    else if (textToSend.match(/chato|feio|bobo/i)) setEmotion(Emotion.ANGRY);
    else setEmotion(Emotion.LOADING);

    addXp(15);

    // Call LLM
    const response = await generateResponse(newHistory);
    
    // Map response emotion
    const emotionMap: Record<string, Emotion> = {
      'NEUTRO': Emotion.NEUTRAL,
      'FELIZ': Emotion.HAPPY,
      'BRAVO': Emotion.ANGRY,
      'SONOLENTO': Emotion.SLEEPY,
      'CONFUSO': Emotion.CONFUSED,
      'DESCOLADO': Emotion.COOL
    };

    const finalEmotion = emotionMap[response.emotion] || Emotion.NEUTRAL;
    
    setEmotion(finalEmotion);
    setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
    setLoading(false);
    speak(response.text);
  };

  const handleInteraction = () => {
    if (loading) return;
    addXp(5);
    setEmotion(Emotion.HAPPY);
    speak("Ah, aí sim! Coça atrás da orelha agora.");
  };

  const handleFoodDrop = () => {
    if (loading) return;
    addXp(30); 
    setEmotion(Emotion.HAPPY);
    const msg = "HAMBÚRGUER?! ISSO SIM É VIDA!";
    setMessages(prev => [...prev, 
      { role: 'user', content: '🍔 Joguei um hambúrguer' },
      { role: 'assistant', content: msg }
    ]);
    speak(msg);
  };

  if (!started) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center p-6 relative overflow-hidden font-fredoka">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4A5568_1px,transparent_1px)] [background-size:20px_20px]"></div>
        
        <div className="bg-white p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] text-center max-w-sm w-full relative z-10 animate-float border-4 border-slate-100">
          <div className="text-8xl mb-6 transform -rotate-12">🦴</div>
          <h1 className="text-6xl font-black text-slate-800 mb-2 tracking-tighter">BINGO</h1>
          <p className="text-slate-500 font-semibold mb-8 text-xl">O Cão Resmungão</p>
          
          <button 
            onClick={handleStart}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white text-2xl font-black py-6 rounded-2xl shadow-[0_8px_0_#1a202c] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-3"
          >
            <Volume2 size={32} />
            ACORDAR ELE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${getBgColor()} transition-colors duration-1000 overflow-hidden font-fredoka`}>
      
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex justify-between items-center z-10 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-2xl rotate-3 flex items-center justify-center font-black text-yellow-900 border-b-4 border-yellow-600 text-xl shadow-sm">
            {gameState.level}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Preguiçômetro</span>
            <div className="w-32 h-4 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
               <div 
                 className="h-full bg-green-400 transition-all duration-500 relative" 
                 style={{ width: `${(gameState.xp % 50) * 2}%` }}
               >
                 <div className="absolute top-0 right-0 w-full h-full bg-white opacity-20 animate-pulse"></div>
               </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-2 rounded-xl ${voiceEnabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-400'}`}>
            {voiceEnabled ? <Volume2 size={24} /> : <Volume2 size={24} className="opacity-50" />}
          </button>
          <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
            <RefreshCcw size={24} />
          </button>
        </div>
      </div>

      {/* Avatar Scene */}
      <div className="flex-none pt-4 pb-2 flex flex-col items-center justify-center relative">
        <DogAvatar 
          emotion={emotion} 
          isTalking={loading}
          onInteraction={handleInteraction}
          accessory={gameState.currentAccessory}
        />
        
        {/* Interaction Buttons */}
        <div className="flex gap-4 mt-2">
            <button 
            onClick={handleInteraction}
            disabled={loading}
            className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
            <Hand size={18} />
            CARINHO
            </button>
            <button 
            onClick={handleFoodDrop}
            disabled={loading}
            className="bg-orange-100 border-2 border-orange-200 hover:bg-orange-200 text-orange-700 px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
            <Sparkles size={18} />
            DAR PETISCO
            </button>
        </div>
      </div>

      {/* Chat Area - Comic Style */}
      <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-4 pt-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`
               relative max-w-[85%] px-6 py-4 text-xl font-bold shadow-sm transition-all animate-in slide-in-from-bottom-2
               ${msg.role === 'user' 
                 ? 'bg-blue-500 text-white rounded-2xl rounded-tr-sm' 
                 : 'bg-white text-slate-800 rounded-3xl rounded-tl-none border-2 border-slate-200'}
             `}>
               {msg.content}
             </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-6 py-4 rounded-3xl rounded-tl-none text-slate-400 font-bold animate-pulse flex items-center gap-2">
              <span className="animate-bounce">thinking</span>
              <span className="animate-bounce delay-100">about</span>
              <span className="animate-bounce delay-200">bacon...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 pb-8">
        <div className="flex gap-3 items-center max-w-3xl mx-auto">
          <button 
            onClick={toggleListening}
            className={`p-4 rounded-2xl transition-all shadow-[0_4px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-1 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Mic size={28} />
          </button>
          
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Fale algo para o Bingo..."
            className="flex-1 bg-slate-100 border-2 border-transparent focus:border-blue-400 p-4 rounded-2xl outline-none font-bold text-slate-700 placeholder-slate-400 transition-all text-lg"
            disabled={loading}
          />
          
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-4 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_0_#2b6cb0] active:shadow-none active:translate-y-1 transition-all"
          >
            <Send size={28} />
          </button>
        </div>
      </div>

    </div>
  );
};

export default App;
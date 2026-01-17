import React, { useState, useEffect, useRef } from 'react';
import { Send, Power, Trash2, Globe } from 'lucide-react';
import { initializeEngine, generateResponse, parseEmotion } from './services/llmService';
import DogAvatar from './components/DogAvatar';
import { ChatMessage, Emotion } from './types';

const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>(Emotion.SLEEPY);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStart = async () => {
    setHasStarted(true);
    setCurrentEmotion(Emotion.NEUTRAL);
    setMessages([{ role: 'assistant', content: "Aff... quem me acordou? Fala logo." }]);
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isProcessing) return;

    const userMsg: ChatMessage = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMsg]);
    setCurrentInput('');
    setIsProcessing(true);
    setCurrentEmotion(Emotion.LOADING);

    const recentHistory = [...messages, userMsg].slice(-8);

    try {
      const rawResponse = await generateResponse(recentHistory);
      const { text, emotion } = parseEmotion(rawResponse);
      
      const mappedEmotion = Object.values(Emotion).includes(emotion as Emotion) 
        ? (emotion as Emotion) 
        : Emotion.NEUTRAL;
      
      setCurrentEmotion(mappedEmotion);
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Grrr... bugou tudo. [CONFUSO]" }]);
      setCurrentEmotion(Emotion.CONFUSED);
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', content: "Memória apagada. Ainda bem. [SONOLENTO]" }]);
    setCurrentEmotion(Emotion.SLEEPY);
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
          <div className="text-7xl mb-6 animate-bounce">🐕</div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">BINGO</h1>
          <p className="text-slate-400 mb-8 font-medium">
            O cachorro mais preguiçoso e resmungão da web.
          </p>

          <button 
            onClick={handleStart}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20"
          >
            <Power size={24} />
            ACORDAR BINGO
          </button>

          <div className="mt-8 pt-4 border-t border-slate-700 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Globe size={14} className="text-green-400"/>
            <span>100% Online & Grátis (Pollinations AI)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-950 shadow-2xl border-x border-slate-800 relative">
      
      {/* Header */}
      <div className="flex-none p-4 bg-slate-900 z-10 border-b border-slate-800/50">
        <div className="flex justify-between items-center mb-2">
            <button onClick={() => window.location.reload()} className="p-2 text-slate-500 hover:text-white transition-colors rounded-full hover:bg-slate-800">
                <Power size={20} />
            </button>
            <button onClick={resetChat} className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-full hover:bg-slate-800" title="Limpar">
                <Trash2 size={20} />
            </button>
        </div>
        <DogAvatar emotion={currentEmotion} isTalking={isProcessing} />
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
                max-w-[85%] p-4 rounded-3xl text-sm md:text-base font-medium leading-relaxed animate-[fadeIn_0.3s_ease-out]
                ${msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-900/30' 
                  : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}
              `}>
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
             <div className="bg-slate-800 px-4 py-3 rounded-3xl rounded-bl-none border border-slate-700 flex gap-1.5 items-center">
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none p-4 bg-slate-900 border-t border-slate-800">
        <div className="relative flex items-center group">
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Fale com o Bingo..."
            disabled={isProcessing}
            className="w-full bg-slate-950 text-white placeholder-slate-600 border border-slate-700 rounded-full py-4 pl-6 pr-14 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentInput.trim() || isProcessing}
            className="absolute right-2 p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 transition-all transform active:scale-90 shadow-lg"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
import React from 'react';
import { Emotion } from '../types';

interface DogAvatarProps {
  emotion: Emotion;
  isTalking: boolean;
}

const DogAvatar: React.FC<DogAvatarProps> = ({ emotion, isTalking }) => {
  
  const getContainerStyles = () => {
    switch (emotion) {
      case Emotion.ANGRY: return "bg-red-900/40 border-red-500 shadow-red-500/20";
      case Emotion.HAPPY: return "bg-yellow-900/40 border-yellow-500 shadow-yellow-500/20";
      case Emotion.SLEEPY: return "bg-blue-900/40 border-blue-500 opacity-80";
      case Emotion.CONFUSED: return "bg-purple-900/40 border-purple-500";
      case Emotion.LOADING: return "bg-slate-800 animate-pulse border-slate-600";
      default: return "bg-slate-800 border-slate-600";
    }
  };

  const getEmoji = () => {
    switch (emotion) {
      case Emotion.ANGRY: return "🗯️";
      case Emotion.HAPPY: return "🍖";
      case Emotion.SLEEPY: return "💤";
      case Emotion.CONFUSED: return "❔";
      case Emotion.LOADING: return "⏳";
      case Emotion.NEUTRAL: 
      default: return "😑";
    }
  };

  const getAnimation = () => {
    if (isTalking) return "animate-bounce";
    if (emotion === Emotion.ANGRY) return "animate-[wiggle_0.3s_ease-in-out_infinite]";
    if (emotion === Emotion.SLEEPY) return "animate-pulse";
    return "";
  };

  return (
    <div className="flex flex-col items-center justify-center transition-all duration-500">
      <div className={`
        relative w-40 h-40 md:w-56 md:h-56 rounded-full border-4 
        flex items-center justify-center text-7xl md:text-9xl shadow-2xl transition-colors duration-500
        ${getContainerStyles()}
      `}>
        <div className={`transform transition-transform duration-300 ${getAnimation()} cursor-default select-none`}>
           {emotion === Emotion.HAPPY ? '🐶' : '🐕'}
        </div>
        
        {/* Balão de Status */}
        <div className="absolute -top-2 -right-2 bg-slate-900 border border-slate-700 rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg">
           {getEmoji()}
        </div>
      </div>
      
      <h2 className="mt-4 text-3xl font-extrabold text-slate-100 tracking-wide uppercase drop-shadow-lg">
        {emotion === Emotion.LOADING ? 'Acordando...' : 'Bingo'}
      </h2>
      <p className="text-slate-400 text-sm mt-1 font-medium">
        {emotion === Emotion.SLEEPY ? '(Ronca alto)' : emotion === Emotion.ANGRY ? '(Rosnando)' : '(Julgando)'}
      </p>
    </div>
  );
};

export default DogAvatar;
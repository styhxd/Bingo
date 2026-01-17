import React, { useMemo } from 'react';
import { Emotion, Accessory } from '../types';

interface DogAvatarProps {
  emotion: Emotion;
  isTalking: boolean;
  onInteraction: () => void;
  accessory: Accessory;
}

const DogAvatar: React.FC<DogAvatarProps> = ({ emotion, isTalking, onInteraction, accessory }) => {
  
  // Dynamic Styles based on Emotion
  const eyeStyle = useMemo(() => {
    switch (emotion) {
      case Emotion.ANGRY: return "h-3 rotate-12 bg-white";
      case Emotion.SLEEPY: return "h-1 bg-slate-800"; // Eyes closed
      case Emotion.HAPPY: return "h-8 bg-white";
      case Emotion.CONFUSED: return "h-6 bg-white";
      case Emotion.COOL: return "h-8 bg-black border-2 border-white"; // Sunglasses logic handled in render, but base eyes
      default: return "h-6 bg-white"; // Neutral
    }
  }, [emotion]);

  const mouthStyle = useMemo(() => {
    if (isTalking) return "h-6 w-8 animate-[ping_0.5s_ease-in-out_infinite] bg-red-900 rounded-full";
    switch (emotion) {
      case Emotion.HAPPY: return "h-8 w-10 bg-red-700 rounded-b-full border-t-4 border-black";
      case Emotion.ANGRY: return "h-1 w-12 bg-black rotate-3";
      case Emotion.SLEEPY: return "h-4 w-4 bg-pink-300 rounded-full translate-x-4"; // Drool?
      default: return "h-2 w-10 bg-black rounded-full";
    }
  }, [emotion, isTalking]);

  return (
    <div 
      className="relative w-64 h-64 md:w-80 md:h-80 cursor-pointer group transition-transform duration-300 hover:scale-105" 
      onClick={onInteraction}
    >
      {/* --- EARS (Back Layer) --- */}
      {/* Left Ear */}
      <div className={`absolute top-12 -left-8 w-24 h-48 bg-black rounded-[40px] origin-top transform transition-all duration-700 ease-in-out z-10 
        ${emotion === Emotion.HAPPY ? 'rotate-12 translate-x-2' : '-rotate-6'}
        ${isTalking ? 'animate-[bounce_0.5s_infinite]' : ''}
      `}></div>
      {/* Right Ear */}
      <div className={`absolute top-12 -right-8 w-24 h-48 bg-black rounded-[40px] origin-top transform transition-all duration-700 ease-in-out z-10
        ${emotion === Emotion.HAPPY ? '-rotate-12 -translate-x-2' : 'rotate-6'}
        ${isTalking ? 'animate-[bounce_0.5s_infinite_0.1s]' : ''}
      `}></div>

      {/* --- HEAD BASE --- */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-56 h-52 bg-[#1a1a1a] rounded-[50px] shadow-2xl z-20 overflow-hidden">
        {/* Shine on forehead */}
        <div className="absolute top-4 left-10 w-8 h-4 bg-white opacity-10 rounded-full rotate-12"></div>
      </div>

      {/* --- EYES --- */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-40 flex justify-between z-30 px-2">
        {/* Left Eye Container */}
        <div className="relative">
          {accessory === 'GLASSES' || emotion === Emotion.COOL ? (
             <span className="text-6xl absolute -top-4 -left-2">🕶️</span>
          ) : (
            <div className={`w-10 rounded-full transition-all duration-300 flex items-center justify-center overflow-hidden ${eyeStyle}`}>
               {/* Pupil */}
               {emotion !== Emotion.SLEEPY && <div className="w-4 h-4 bg-black rounded-full translate-x-[2px]"></div>}
            </div>
          )}
          {/* Eyebrow */}
          <div className={`absolute -top-4 left-0 w-10 h-2 bg-slate-700 rounded-full transition-all duration-500
            ${emotion === Emotion.ANGRY ? 'rotate-45 top-0' : ''}
            ${emotion === Emotion.CONFUSED ? '-rotate-12 -top-6' : ''}
          `}></div>
        </div>

        {/* Right Eye Container */}
        <div className="relative">
           {accessory === 'GLASSES' || emotion === Emotion.COOL ? (
             <span className="text-6xl absolute -top-4 -left-6 opacity-0">🕶️</span> // Invisible placeholder to keep spacing
          ) : (
            <div className={`w-10 rounded-full transition-all duration-300 flex items-center justify-center overflow-hidden ${eyeStyle}`}>
               {/* Pupil */}
               {emotion !== Emotion.SLEEPY && <div className="w-4 h-4 bg-black rounded-full -translate-x-[2px]"></div>}
            </div>
          )}
           {/* Eyebrow */}
           <div className={`absolute -top-4 left-0 w-10 h-2 bg-slate-700 rounded-full transition-all duration-500
            ${emotion === Emotion.ANGRY ? '-rotate-45 top-0' : ''}
          `}></div>
        </div>
      </div>

      {/* --- SNOUT --- */}
      <div className="absolute top-36 left-1/2 transform -translate-x-1/2 w-28 h-20 bg-[#2a2a2a] rounded-[30px] z-30 flex flex-col items-center">
        {/* Nose */}
        <div className="w-14 h-8 bg-black rounded-full mt-2 flex items-center justify-center">
            <div className="w-4 h-1 bg-white opacity-20 rounded-full -translate-y-1"></div>
        </div>
        
        {/* Mouth */}
        <div className={`mt-2 transition-all duration-200 ${mouthStyle}`}></div>
        
        {/* Tongue (Happy only) */}
        {emotion === Emotion.HAPPY && (
          <div className="w-6 h-8 bg-pink-400 rounded-b-full absolute -bottom-4 animate-[pulse_1s_infinite]"></div>
        )}
      </div>

      {/* --- ACCESSORIES --- */}
      {accessory === 'HAT' && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-40 text-7xl drop-shadow-lg rotate-6">
          🧢
        </div>
      )}
      {accessory === 'BOWTIE' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 text-6xl drop-shadow-md">
          🎀
        </div>
      )}

      {/* --- SNOT BUBBLE (Sleepy) --- */}
      {emotion === Emotion.SLEEPY && (
        <div className="absolute top-40 right-16 w-8 h-8 bg-blue-200 opacity-60 rounded-full z-50 animate-[ping_2s_infinite]"></div>
      )}

    </div>
  );
};

export default DogAvatar;
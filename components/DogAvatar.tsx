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
      case Emotion.ANGRY: return "h-4 rotate-12 bg-white";
      case Emotion.SLEEPY: return "h-1 bg-slate-800"; // Eyes closed
      case Emotion.HAPPY: return "h-8 bg-white";
      case Emotion.CONFUSED: return "h-6 bg-white";
      case Emotion.COOL: return "h-8 bg-black"; // Hidden behind glasses usually
      default: return "h-6 bg-white"; // Neutral
    }
  }, [emotion]);

  const mouthStyle = useMemo(() => {
    if (isTalking) return "h-6 w-8 animate-[ping_0.5s_ease-in-out_infinite] bg-red-900 rounded-full";
    switch (emotion) {
      case Emotion.HAPPY: return "h-8 w-10 bg-red-700 rounded-b-full border-t-4 border-black";
      case Emotion.ANGRY: return "h-2 w-12 bg-black rotate-3 rounded-full";
      case Emotion.SLEEPY: return "h-4 w-4 bg-pink-300 rounded-full translate-x-4";
      case Emotion.CONFUSED: return "h-2 w-8 bg-black rounded-full -rotate-6";
      default: return "h-2 w-10 bg-black rounded-full";
    }
  }, [emotion, isTalking]);

  return (
    <div 
      className="relative w-64 h-64 md:w-80 md:h-80 cursor-pointer group transition-transform duration-300 hover:scale-105" 
      onClick={onInteraction}
    >
      {/* --- EARS (Back Layer) --- */}
      <div className={`absolute top-12 -left-8 w-24 h-48 bg-black rounded-[40px] origin-top transform transition-all duration-700 ease-in-out z-10 
        ${emotion === Emotion.HAPPY ? 'rotate-12 translate-x-2' : '-rotate-6'}
        ${isTalking ? 'animate-[bounce_0.5s_infinite]' : ''}
      `}></div>
      <div className={`absolute top-12 -right-8 w-24 h-48 bg-black rounded-[40px] origin-top transform transition-all duration-700 ease-in-out z-10
        ${emotion === Emotion.HAPPY ? '-rotate-12 -translate-x-2' : 'rotate-6'}
        ${isTalking ? 'animate-[bounce_0.5s_infinite_0.1s]' : ''}
      `}></div>

      {/* --- HEAD BASE --- */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-56 h-52 bg-[#1a1a1a] rounded-[50px] shadow-2xl z-20 overflow-hidden">
        <div className="absolute top-4 left-10 w-8 h-4 bg-white opacity-10 rounded-full rotate-12"></div>
      </div>

      {/* --- EYES CONTAINER --- */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-40 flex justify-between z-30 px-2">
        {/* Left Eye Group */}
        <div className="relative flex flex-col items-center justify-center">
            {/* Eyebrow - Moved OUTSIDE the eye div and adjusted position/index */}
            <div className={`absolute -top-6 w-12 h-3 bg-slate-600 rounded-full transition-all duration-500 z-40
              ${emotion === Emotion.ANGRY ? 'rotate-12 translate-y-2' : ''}
              ${emotion === Emotion.CONFUSED ? '-rotate-12 -translate-y-2' : ''}
              ${emotion === Emotion.HAPPY ? '-translate-y-2' : ''}
            `}></div>
            
            {/* Eye Ball */}
            <div className={`w-12 rounded-full transition-all duration-300 flex items-center justify-center overflow-hidden border-2 border-black/20 ${eyeStyle}`}>
               {emotion !== Emotion.SLEEPY && emotion !== Emotion.COOL && <div className="w-4 h-4 bg-black rounded-full translate-x-[2px]"></div>}
            </div>
        </div>

        {/* Right Eye Group */}
        <div className="relative flex flex-col items-center justify-center">
             {/* Eyebrow */}
             <div className={`absolute -top-6 w-12 h-3 bg-slate-600 rounded-full transition-all duration-500 z-40
              ${emotion === Emotion.ANGRY ? '-rotate-12 translate-y-2' : ''}
              ${emotion === Emotion.CONFUSED ? 'rotate-6' : ''}
              ${emotion === Emotion.HAPPY ? '-translate-y-2' : ''}
            `}></div>

            {/* Eye Ball */}
            <div className={`w-12 rounded-full transition-all duration-300 flex items-center justify-center overflow-hidden border-2 border-black/20 ${eyeStyle}`}>
               {emotion !== Emotion.SLEEPY && emotion !== Emotion.COOL && <div className="w-4 h-4 bg-black rounded-full -translate-x-[2px]"></div>}
            </div>
        </div>
      </div>

      {/* --- ACCESSORY: GLASSES (SVG) --- */}
      {(accessory === 'GLASSES' || emotion === Emotion.COOL) && (
        <div className="absolute top-[4.5rem] left-1/2 transform -translate-x-1/2 z-40 w-48 drop-shadow-xl pointer-events-none">
          <svg viewBox="0 0 200 80" className="w-full h-full">
            {/* Left Lens */}
            <path d="M10,20 Q10,10 30,10 L80,10 Q100,10 100,20 L100,50 Q100,70 80,70 L30,70 Q10,70 10,50 Z" className="fill-slate-900 stroke-2 stroke-white"/>
            {/* Right Lens */}
            <path d="M110,20 Q110,10 130,10 L180,10 Q200,10 200,20 L200,50 Q200,70 180,70 L130,70 Q110,70 110,50 Z" className="fill-slate-900 stroke-2 stroke-white"/>
            {/* Bridge */}
            <rect x="95" y="25" width="20" height="5" className="fill-white"/>
            {/* Shine */}
            <path d="M20,20 L40,20 L30,40 Z" className="fill-white opacity-20"/>
            <path d="M120,20 L140,20 L130,40 Z" className="fill-white opacity-20"/>
          </svg>
        </div>
      )}

      {/* --- SNOUT --- */}
      <div className="absolute top-36 left-1/2 transform -translate-x-1/2 w-28 h-20 bg-[#2a2a2a] rounded-[30px] z-30 flex flex-col items-center shadow-lg">
        <div className="w-14 h-8 bg-black rounded-full mt-2 flex items-center justify-center">
            <div className="w-4 h-1 bg-white opacity-20 rounded-full -translate-y-1"></div>
        </div>
        <div className={`mt-2 transition-all duration-200 ${mouthStyle}`}></div>
        {emotion === Emotion.HAPPY && (
          <div className="w-6 h-8 bg-pink-400 rounded-b-full absolute -bottom-4 animate-[pulse_1s_infinite] border-2 border-black/10"></div>
        )}
      </div>

      {/* --- ACCESSORY: HAT (SVG) --- */}
      {accessory === 'HAT' && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-40 w-56 drop-shadow-xl pointer-events-none">
           <svg viewBox="0 0 200 120" className="w-full h-full">
             {/* Cap Main */}
             <path d="M40,80 Q40,10 100,10 T160,80 Z" className="fill-blue-600 stroke-4 stroke-black"/>
             {/* Visor */}
             <path d="M30,75 Q100,60 170,75 L190,95 Q100,85 10,95 Z" className="fill-blue-800 stroke-4 stroke-black"/>
             {/* Button */}
             <circle cx="100" cy="10" r="8" className="fill-blue-800"/>
             {/* Logo */}
             <text x="100" y="60" textAnchor="middle" className="fill-white font-black text-4xl font-fredoka">B</text>
           </svg>
        </div>
      )}

      {/* --- ACCESSORY: BOWTIE (SVG) --- */}
      {accessory === 'BOWTIE' && (
        <div className="absolute top-[13.5rem] left-1/2 transform -translate-x-1/2 z-40 w-24 drop-shadow-md pointer-events-none">
          <svg viewBox="0 0 100 50" className="w-full h-full">
             <path d="M50,25 L10,0 L10,50 Z" className="fill-red-600 stroke-2 stroke-black"/>
             <path d="M50,25 L90,0 L90,50 Z" className="fill-red-600 stroke-2 stroke-black"/>
             <circle cx="50" cy="25" r="10" className="fill-red-800 stroke-2 stroke-black"/>
          </svg>
        </div>
      )}

      {/* --- SNOT BUBBLE (Sleepy) --- */}
      {emotion === Emotion.SLEEPY && (
        <div className="absolute top-40 right-16 w-10 h-10 bg-blue-200 opacity-60 rounded-full z-50 animate-[ping_3s_infinite] border border-white"></div>
      )}

    </div>
  );
};

export default DogAvatar;
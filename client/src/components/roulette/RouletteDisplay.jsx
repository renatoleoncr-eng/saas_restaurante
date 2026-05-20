import React, { useState, useEffect } from 'react';

export default function RouletteDisplay({ config, onComplete }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showWinner, setShowWinner] = useState(false);

  const slices = config?.categories || [];
  const SLICE_COUNT = slices.length;
  const SLICE_ANGLE = SLICE_COUNT > 0 ? 360 / SLICE_COUNT : 0;

  // Control spin via isSpinning prop
  useEffect(() => {
    if (config?.isSpinning) {
      if (!spinning && !showWinner) {
        spinRoulette();
      }
    } else {
      // If isSpinning is false (Prepare phase), reset for a new session
      setSpinning(false);
      setShowWinner(false);
      setSelectedCategory(null);
      setRotation(0);
    }
  }, [config?.isSpinning]);

  const spinRoulette = () => {
    if (spinning) return;
    setSpinning(true);
    setShowWinner(false);

    let winnerIndex = 0;
    
    // Check if we have a forced winning index from the admin
    if (typeof config?.winningIndex === 'number') {
      console.log("[Roulette Sync] Using forced winnerIndex:", config.winningIndex);
      winnerIndex = config.winningIndex;
    } else {
      console.log("[Roulette Sync] No winningIndex provided, falling back to random");
      const totalWeight = slices.reduce((acc, slice) => acc + (slice.weight || 1), 0);
      let randomNum = Math.random() * totalWeight;
      for (let i = 0; i < slices.length; i++) {
        if (randomNum < (slices[i].weight || 1)) {
          winnerIndex = i;
          break;
        }
        randomNum -= (slices[i].weight || 1);
      }
    }

    const winner = slices[winnerIndex];
    
    // Calculate rotation: Slices end at top (0 deg). Slices go clockwise.
    const targetAngle = 360 - (winnerIndex * SLICE_ANGLE) - (SLICE_ANGLE * 0.8);
    const totalRotation = rotation + 2880 + targetAngle;
    setRotation(totalRotation);

    setTimeout(() => {
      setSpinning(false);
      setSelectedCategory(winner);
      setShowWinner(true);
      if (onComplete) {
        onComplete(winner);
      }
    }, 8500);
  };

  if (config?.stop) return null;

  if (!config || SLICE_COUNT === 0) {
    return null;
  }

  // Premium harmonized colors (Vibrant Emerald and Gold Theme)
  const colors = [
    "#064E3B", // Emerald 900
    "#D97706", // Amber 600
    "#F8FAFC", // Slate 50 (White)
    "#065F46", // Emerald 800
    "#F59E0B", // Amber 500
    "#F1F5F9"  // Slate 100
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center w-screen h-screen overflow-hidden bg-slate-950 select-none">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] animate-pulse delay-700"></div>

      <div className="relative text-center mb-8">
        <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tighter uppercase italic">
          Ruleta <span className="text-emerald-400">Ganadora</span>
        </h1>
        <div className="h-1.5 w-36 bg-gradient-to-r from-emerald-500 to-amber-500 mx-auto rounded-full mb-3"></div>
        <p className="text-xl md:text-2xl text-slate-300 font-medium tracking-wide">
          ¡Felicidades por su consumo! Gire la ruleta y descubra su premio.
        </p>
      </div>

      <div className="relative w-[min(70vw,70vh)] h-[min(70vw,70vh)] flex items-center justify-center p-4 aspect-square shrink-0">
        
        {/* Outer Ring Decoration */}
        <div className="absolute inset-0 rounded-full border-[20px] border-emerald-950/40 shadow-[0_0_80px_rgba(16,185,129,0.15)] scale-105"></div>
        
        {/* Pointer (Top Center) */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-2xl">
          <div className="relative">
            <svg width="50" height="70" viewBox="0 0 24 32" fill="#10B981" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                <path d="M12 32L0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12L12 32Z" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-60 blur-[1px]"></div>
          </div>
        </div>

        {/* Roulette Wheel */}
        <div 
          className={`w-full h-full rounded-full border-[12px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden bg-white ${spinning ? 'scale-[1.02]' : 'scale-100'} transition-transform duration-1000`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 8s cubic-bezier(0.15, 0, 0.15, 1)'
          }}
        >
          {/* Slices Background */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(
                ${slices.map((_, i) => `${colors[i % colors.length]} ${i * SLICE_ANGLE}deg ${(i + 1) * SLICE_ANGLE}deg`).join(', ')}
              )`
            }}
          />

          {/* Slices Content */}
          {slices.map((slice, index) => {
            const angle = index * SLICE_ANGLE + (SLICE_ANGLE / 2);
            const isDark = (index % colors.length) % 3 !== 2;
            
            return (
              <div 
                key={index}
                className="absolute top-1/2 left-1/2 flex flex-col items-center justify-center pointer-events-none"
                style={{
                  width: '40%',
                  height: '20%',
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-160%)`
                }}
              >
                <div className="flex flex-col items-center justify-center w-full h-full text-center">
                   <span className="text-[min(4.5vw,4.5vh)] mb-1 drop-shadow-md leading-none">
                     {slice.icon || '🎁'}
                   </span>
                   <div className="w-full px-1">
                     <span className={`text-[min(1.8vw,1.8vh)] font-black uppercase leading-tight tracking-tighter break-words line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}
                           style={{ textShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.5)' }}>
                        {slice.name}
                      </span>
                   </div>
                </div>
              </div>
            );
          })}
          
          {/* Glass Overlay for Depth */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
          
          {/* Center Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-b from-slate-700 to-slate-900 rounded-full border-4 border-slate-600 shadow-2xl z-20 flex items-center justify-center">
             <div className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-full flex items-center justify-center shadow-inner">
                <div className="w-3.5 h-3.5 bg-white/30 rounded-full animate-ping"></div>
             </div>
          </div>
        </div>
      </div>

      {spinning && (
         <div className="h-12 mt-4 flex items-center justify-center">
            <div className="text-emerald-400 font-black animate-pulse tracking-[0.5em] uppercase text-base">
                Sorteando Premio...
            </div>
         </div>
      )}

      {/* Winner Announcement Overlay */}
      {showWinner && selectedCategory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="flex flex-col items-center max-w-md w-full animate-in zoom-in-90 duration-500">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-10 rounded-[30px] border-4 border-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.3)] flex flex-col items-center w-full relative overflow-hidden text-center">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse"></div>

                    <div className="text-7xl md:text-8xl mb-6 animate-bounce bg-white/5 w-24 h-24 flex items-center justify-center rounded-3xl">
                        {selectedCategory.icon}
                    </div>
                    
                    <p className="text-emerald-400 font-black tracking-[0.3em] uppercase text-xs mb-2">¡PREMIO OBTENIDO!</p>
                    <h2 className="text-white text-3xl md:text-4xl font-black leading-tight mb-8">
                        {selectedCategory.name}
                    </h2>
                    
                    <div className="h-px w-full bg-slate-700/50 mb-6"></div>
                    <p className="text-slate-200 font-bold text-lg mb-2">
                        ¡Muchas gracias por visitarnos!
                    </p>
                    <p className="text-slate-400 text-sm">
                        Indique este premio en caja para reclamar su obsequio.
                    </p>

                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse"></div>
                </div>
                
                <div className="mt-6 text-emerald-400/60 font-bold text-xs tracking-widest animate-pulse">
                    ESPERE A QUE EL CAJERO CONFIRME EL PREMIO
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

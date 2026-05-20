import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import RouletteDisplay from '../components/roulette/RouletteDisplay';

const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = isLocalhost ? 'http://localhost:3003' : window.location.origin;
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getRemainingCaption = (qr) => {
    const isUnlimited = qr.isUnlimited === true || qr.isUnlimited === 1 || qr.isUnlimited === 'true';
    if (isUnlimited) return "Cupo disponible: Ilimitado";
    const remaining = parseFloat(qr.limitAmount || 0) - parseFloat(qr.accumulated_month_sum || 0);
    return `Cupo disponible: S/ ${Math.max(0, remaining).toFixed(2)}`;
};

const isVideo = (url) => url?.toLowerCase()?.match(/\.(mp4|webm|ogg)$/);

export default function QrDisplay() {
  const [activeQr, setActiveQr] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [showMode, setShowMode] = useState('ads'); // 'qr' | 'ads'
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [message, setMessage] = useState('Iniciando Pantalla del Cliente...');
  const [projection, setProjection] = useState(null); // { type, duration, images, promoUrl, promoName }
  const [projectionTimer, setProjectionTimer] = useState(0);
  const [currentProjImageIndex, setCurrentProjImageIndex] = useState(0);
  const [rouletteConfig, setRouletteConfig] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const { socket } = useRestaurant();
  const timerRef = useRef(null);
  const projIntervalRef = useRef(null);
  const rouletteTimeoutRef = useRef(null);

  const fetchActiveQr = async () => {
    try {
      const res = await axios.get('/api/qrs/active');
      console.log("Active QR result:", res.data);
      if (res.data.activeQr) {
          setActiveQr(res.data.activeQr);
      } else {
          console.warn("No active QR returned from server");
          setActiveQr(null);
          setMessage(res.data.message || 'No hay QRs disponibles');
      }
    } catch (error) {
      console.error('Error fetching active QR:', error);
    }
  };

  const fetchPromotions = async () => {
    try {
      const res = await axios.get('/api/promotions/active');
      setPromotions(res.data);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  const startQrTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowMode('qr');
    timerRef.current = setTimeout(() => {
      setShowMode('ads');
    }, 20000); // 20 seconds standard QR countdown
  };

  useEffect(() => {
    fetchActiveQr();
    fetchPromotions();
    
    // Initial Sync on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, syncing data...');
        fetchActiveQr();
        fetchPromotions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleTrigger = () => {
      console.log('Socket event received: show_qr_display');
      fetchActiveQr();
      startQrTimer();
    };

    const handleModeUpdate = (data) => {
      console.log('Mode update received:', data.mode);
      if (data.mode === 'qr_fixed') {
        if (timerRef.current) clearTimeout(timerRef.current);
        fetchActiveQr();
        setShowMode('qr');
        setProjection(null); // Override projection if QR is forced
      } else if (data.mode === 'qr_countdown') {
        fetchActiveQr();
        startQrTimer();
      } else if (data.mode === 'ads') {
        if (timerRef.current) clearTimeout(timerRef.current);
        setShowMode('ads');
      }
    };

    const handleProjStart = (data) => {
        console.log('Projection started:', data);
        setProjection(data);
        setProjectionTimer(data.duration || (data.type === 'group' ? 300 : 120));
        setCurrentProjImageIndex(0);
        setShowMode('ads'); // Force ads mode to show the projected media
    };

    const handleProjStop = () => {
        console.log('Stopping projection via socket event');
        setProjection(null);
        setProjectionTimer(0);
        if (projIntervalRef.current) clearInterval(projIntervalRef.current);
    };

    const handleConnect = () => {
      console.log('Socket reconnected, forcing sync...');
      fetchActiveQr();
      fetchPromotions();
    };

    const handleStartRoulette = (config) => {
        console.log('Starting Roulette Projection', config);

        if (config?.stop) {
            setShowRoulette(false);
            setRouletteConfig(null);
            if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
            return;
        }
        
        // Reset timeout if exists
        if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
        
        setRouletteConfig(config);
        setShowRoulette(true);
        
        if (config?.isSpinning) {
            rouletteTimeoutRef.current = setTimeout(() => setShowRoulette(false), 90000); // 90s safety unmount
        }
    };

    const handleInteractionRecorded = (data) => {
        console.log('Roulette interaction recorded on server:', data);
        
        if (data.interaction === 'skipped') {
            setShowRoulette(false);
            setRouletteConfig(null);
            if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
        } else if (data.interaction === 'played') {
            if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
            rouletteTimeoutRef.current = setTimeout(() => {
                setShowRoulette(false);
                setRouletteConfig(null);
            }, 20000);
        }
    };

    socket.on('connect', handleConnect);
    socket.on('show_qr_display', handleTrigger);
    socket.on('update_client_screen_mode', handleModeUpdate);
    socket.on('promotions_updated', fetchPromotions);
    socket.on('qr_config_changed', fetchActiveQr);
    socket.on('check_active_qr', fetchActiveQr);
    socket.on('client_start_projection', handleProjStart);
    socket.on('client_stop_projection', handleProjStop);
    socket.on('start_roulette_projection', handleStartRoulette);
    socket.on('roulette_interaction_recorded', handleInteractionRecorded);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('show_qr_display', handleTrigger);
      socket.off('update_client_screen_mode', handleModeUpdate);
      socket.off('promotions_updated', fetchPromotions);
      socket.off('qr_config_changed', fetchActiveQr);
      socket.off('check_active_qr', fetchActiveQr);
      socket.off('client_start_projection', handleProjStart);
      socket.off('client_stop_projection', handleProjStop);
      socket.off('start_roulette_projection', handleStartRoulette);
      socket.off('roulette_interaction_recorded', handleInteractionRecorded);
    };
  }, [socket]);

  // Default Slide transition looping
  useEffect(() => {
    if (showMode === 'ads' && promotions.length > 1 && !projection) {
      const slideInterval = setInterval(() => {
        setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
      }, 8000); 
      return () => clearInterval(slideInterval);
    }
  }, [showMode, promotions.length, projection]);

  // Group Projection Cycling Logic
  useEffect(() => {
    if (projection?.type === 'group' && projection.images?.length > 1) {
      const groupCycleInterval = setInterval(() => {
        setCurrentProjImageIndex((prev) => (prev + 1) % projection.images.length);
      }, 7000); 
      return () => clearInterval(groupCycleInterval);
    }
  }, [projection]);

  // Projection Timer Logic
  useEffect(() => {
    if (projection) {
        if (projIntervalRef.current) clearInterval(projIntervalRef.current);
        
        projIntervalRef.current = setInterval(() => {
            setProjectionTimer(prev => {
                if (prev <= 1) {
                    if (projIntervalRef.current) clearInterval(projIntervalRef.current);
                    setProjection(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else {
        if (projIntervalRef.current) clearInterval(projIntervalRef.current);
        setProjectionTimer(0);
    }

    return () => {
        if (projIntervalRef.current) clearInterval(projIntervalRef.current);
    };
  }, [projection]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden m-0 p-0 select-none cursor-none relative">
      
      {/* ROULETTE MODE OVERLAY */}
      {showRoulette && rouletteConfig && (
         <RouletteDisplay 
            config={rouletteConfig.config || rouletteConfig} 
            onComplete={(winner) => {
               console.log("Roulette spin completed, reporting winner:", winner);
               if (socket) {
                   socket.emit('report_roulette_winner', {
                       winnerName: winner.name,
                       winnerIcon: winner.icon,
                       accountId: rouletteConfig.accountId,
                       prize: winner
                   });
               }
            }}
         />
      )}

      {/* QR COUNTDOWN / STEADY MODE */}
      {showMode === 'qr' && activeQr && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
          
          <div className="bg-slate-950/60 backdrop-blur-xl border-2 border-emerald-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col items-center max-w-lg w-full relative">
            <h2 className="text-3xl font-black text-white uppercase italic tracking-wider mb-2">
               Pago con <span className="text-emerald-400">Código QR</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium mb-6">{activeQr.name}</p>

            {activeQr.imageUrl ? (
              isVideo(activeQr.imageUrl) ? (
                 <video 
                     src={getMediaUrl(activeQr.imageUrl)} 
                     className="w-full h-64 object-contain rounded-2xl mb-6" 
                     autoPlay loop muted playsInline 
                 />
              ) : (
                 <img 
                     src={getMediaUrl(activeQr.imageUrl)} 
                     alt={activeQr.name} 
                     className="w-64 h-64 object-contain rounded-2xl mb-6 shadow-md transition-all duration-700"
                     onError={(e) => {
                         console.error("Failed to load QR image:", activeQr.imageUrl);
                         e.target.style.display = 'none';
                         e.target.parentElement.innerHTML = '<div class="flex items-center justify-center p-8 bg-slate-900 text-slate-500 text-center border-2 border-dashed border-slate-700 rounded-2xl h-64 w-64"><div class="flex flex-col items-center">❗<br/>Código no disponible</div></div>';
                     }}
                 />
              )
            ) : (
               <div className="flex items-center justify-center p-8 bg-slate-900 text-slate-500 text-center border-2 border-dashed border-slate-700 rounded-2xl h-64 w-64 mb-6">
                 <div className="flex flex-col items-center">❗<br/>Código no disponible</div>
               </div>
            )}

            <div className="w-full bg-slate-900/60 border border-slate-800 p-4 rounded-2xl text-center">
              <p className="text-slate-300 font-bold text-base leading-none mb-1">
                 {getRemainingCaption(activeQr)}
              </p>
              {activeQr.phoneNumber && (
                <p className="text-emerald-400 font-mono text-sm tracking-widest mt-1">
                  Celular: {activeQr.phoneNumber}
                </p>
              )}
            </div>
            
            {/* Elegant Peruvian Watermark or instruction */}
            <div className="mt-6 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
               <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Transacción Segura</span>
            </div>
          </div>
        </div>
      )}

      {/* ADS / SLIDESHOW MODE (Default background visual loop) */}
      {(showMode === 'ads' || !activeQr) && (
        <div className="w-full h-full relative overflow-hidden bg-slate-950">
          
          {/* PROJECTION CARD OVERLAY */}
          {projection ? (
             <div className="w-full h-full animate-in zoom-in-95 duration-700">
                {projection.type === 'group' ? (
                    // Group slideshow cycling view
                    <div className="w-full h-full relative">
                        {projection.images.map((img, idx) => (
                            <div key={img.id} className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentProjImageIndex ? 'opacity-100' : 'opacity-0'}`}>
                                {isVideo(img.url) ? (
                                    <video src={getMediaUrl(img.url)} className="w-full h-full object-cover" autoPlay={idx === currentProjImageIndex} loop muted playsInline />
                                ) : (
                                    <img src={getMediaUrl(img.url)} alt={img.name} className="w-full h-full object-cover" />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // Individual slide view
                    <>
                        {isVideo(projection.promoUrl) ? (
                            <video 
                                src={getMediaUrl(projection.promoUrl)} 
                                className="w-full h-full object-cover" 
                                autoPlay loop muted playsInline 
                            />
                        ) : (
                            <img 
                                src={getMediaUrl(projection.promoUrl)} 
                                alt={projection.promoName} 
                                className="w-full h-full object-cover" 
                            />
                        )}
                    </>
                )}
                
                {/* Visual projection floating countdown timer */}
                <div className="absolute top-8 right-8 bg-slate-900/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4 shadow-2xl animate-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 leading-none mb-1">
                            {projection.type === 'group' ? 'PROYECTANDO GRUPO' : 'PROYECCIÓN ACTIVA'}
                        </span>
                        <span className="text-2xl font-mono font-bold tabular-nums text-slate-100">{formatTime(projectionTimer)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                </div>
             </div>
          ) : (
            <>
              {promotions.length > 0 ? (
                <div className="w-full h-full">
                  {promotions.map((promo, index) => (
                    <div 
                      key={promo.id}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentPromoIndex ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {isVideo(promo.imageUrl) ? (
                        <video 
                            src={getMediaUrl(promo.imageUrl)} 
                            className="w-full h-full object-cover" 
                            autoPlay={index === currentPromoIndex} 
                            loop muted playsInline 
                        />
                      ) : (
                        <img 
                            src={getMediaUrl(promo.imageUrl)} 
                            alt={promo.name} 
                            className="w-full h-full object-cover" 
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    </div>
                  ))}
                  
                  {/* Rotating visual progression indicators */}
                  <div className="absolute bottom-8 right-12 flex gap-2">
                    {promotions.map((_, i) => (
                        <div key={i} className={`h-2 transition-all duration-500 rounded-full ${i === currentPromoIndex ? 'w-10 bg-emerald-500' : 'w-3 bg-white/20'}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600/30 gap-4">
                  <span className="text-5xl font-black uppercase tracking-[0.25em] animate-pulse">
                     GESTION RESTAURANTE
                  </span>
                  <p className="text-xs uppercase tracking-[0.3em] font-semibold text-slate-700">Pantalla del Cliente</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
    </div>
  );
}

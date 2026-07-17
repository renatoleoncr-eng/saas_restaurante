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
    <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden m-0 p-8 select-none relative">
      
      {activeQr ? (
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/50 p-12 rounded-[48px] shadow-2xl flex flex-col items-center max-w-3xl w-full relative animate-in zoom-in-95 duration-700">
          
          <h2 className="text-5xl font-black text-white uppercase italic tracking-wider mb-3 text-center">
             Pago con <span className="text-emerald-400">QR</span>
          </h2>
          <p className="text-slate-400 text-2xl font-medium mb-10 text-center">{activeQr.name}</p>

          {activeQr.imageUrl ? (
            isVideo(activeQr.imageUrl) ? (
               <video 
                   src={getMediaUrl(activeQr.imageUrl)} 
                   className="w-full max-h-[500px] object-contain rounded-3xl mb-10 shadow-2xl" 
                   autoPlay loop muted playsInline 
               />
            ) : (
               <img 
                   src={getMediaUrl(activeQr.imageUrl)} 
                   alt={activeQr.name} 
                   className="w-full max-h-[500px] object-contain rounded-3xl mb-10 shadow-2xl transition-all duration-700"
                   onError={(e) => {
                       console.error("Failed to load QR image:", activeQr.imageUrl);
                       e.target.style.display = 'none';
                       e.target.parentElement.innerHTML = '<div class="flex items-center justify-center p-12 bg-slate-900/50 text-slate-500 text-center border-2 border-dashed border-slate-700 rounded-3xl h-64 w-full"><div class="flex flex-col items-center text-xl">❗<br/>Código no disponible</div></div>';
                   }}
               />
            )
          ) : (
             <div className="flex items-center justify-center p-12 bg-slate-900/50 text-slate-500 text-center border-2 border-dashed border-slate-700 rounded-3xl h-64 w-full mb-10">
               <div className="flex flex-col items-center text-xl">❗<br/>Código no disponible</div>
             </div>
          )}

          <div className="w-full bg-slate-950/80 border border-slate-800/50 p-8 rounded-3xl text-center shadow-inner">

            {activeQr.phoneNumber && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-slate-500 text-sm uppercase tracking-[0.3em] mb-2">Número de Celular</p>
                <p className="text-emerald-400 font-mono text-5xl tracking-widest font-black drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  {activeQr.phoneNumber}
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-12 flex items-center gap-3 bg-slate-950/50 px-6 py-3 rounded-full border border-slate-800/50">
             <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
             <span className="text-sm uppercase font-black tracking-widest text-slate-400">Transacción Segura</span>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-700/50 gap-6">
           <span className="text-6xl font-black uppercase tracking-[0.25em] animate-pulse">
              GESTION RESTAURANTE
           </span>
           <p className="text-lg uppercase tracking-[0.4em] font-semibold text-slate-600">Pantalla del Cliente</p>
        </div>
      )}
      
    </div>
  );
}

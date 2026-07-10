import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export default function PinPadModal({ isOpen, onClose, onConfirm, errorMsg }) {
    const [pin, setPin] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useModalBackHandler(isOpen, () => {
        if (isSubmitting) return;
        setPin('');
        onClose();
    });

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setPin('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || isSubmitting) return;

        const handleGlobalKeyDown = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                setPin(prev => {
                    if (prev.length < 4) {
                        return prev + e.key;
                    }
                    return prev;
                });
            } else if (e.key === 'Backspace') {
                setPin(prev => prev.slice(0, -1));
            } else if (e.key === 'Enter') {
                if (pin.length === 4) {
                    handleSubmitRef.current();
                }
            } else if (e.key === 'Escape') {
                setPin('');
                onClose();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, onClose, pin, isSubmitting]);

    const handleSubmit = async () => {
        if (pin.length !== 4 || isSubmitting) return;
        setIsSubmitting(true);
        await onConfirm(pin);
        setIsSubmitting(false);
    };

    // Use a ref to avoid dependency cycles in useEffect
    const handleSubmitRef = React.useRef(handleSubmit);
    useEffect(() => {
        handleSubmitRef.current = handleSubmit;
    }, [handleSubmit]);

    if (!isOpen) return null;

    const handleKeyPress = (num) => {
        if (pin.length < 4) {
            setPin(pin + num);
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    const handleClear = () => {
        setPin('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col p-6 overflow-hidden transform scale-100 transition-all duration-300">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-wide">Autorizar Pedido</h2>
                        <p className="text-xs text-slate-400 mt-1">Ingrese su PIN de 4 dígitos para continuar</p>
                    </div>
                    <button 
                        onClick={() => {
                            handleClear();
                            onClose();
                        }} 
                        className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-full transition duration-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Display dots */}
                <div className="flex flex-col items-center justify-center mb-6">
                    <div className="flex gap-4 justify-center items-center h-16 w-full bg-slate-950/55 rounded-xl border border-slate-800 mb-2">
                        {[0, 1, 2, 3].map((index) => (
                            <div 
                                key={index} 
                                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                                    index < pin.length 
                                        ? 'bg-emerald-400 scale-125 shadow-[0_0_10px_rgba(52,211,153,0.6)]' 
                                        : 'bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>
                    {errorMsg && (
                        <div className="text-rose-400 text-sm font-semibold animate-pulse text-center mt-1">
                            {errorMsg}
                        </div>
                    )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            type="button"
                            onClick={() => handleKeyPress(num.toString())}
                            className="h-16 rounded-xl bg-slate-800/80 text-white font-bold text-2xl hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all duration-100 shadow-md border border-slate-700/50 flex items-center justify-center"
                        >
                            {num}
                        </button>
                    ))}
                    
                    {/* Clear Button */}
                    <button
                        type="button"
                        onClick={handleClear}
                        className="h-16 rounded-xl bg-slate-800/40 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 font-semibold text-lg active:scale-95 transition-all duration-100 flex items-center justify-center border border-slate-800/50"
                    >
                        Limpiar
                    </button>

                    {/* 0 Button */}
                    <button
                        type="button"
                        onClick={() => handleKeyPress('0')}
                        className="h-16 rounded-xl bg-slate-800/80 text-white font-bold text-2xl hover:bg-slate-700 active:bg-slate-600 active:scale-95 transition-all duration-100 shadow-md border border-slate-700/50 flex items-center justify-center"
                    >
                        0
                    </button>

                    {/* Backspace Button */}
                    <button
                        type="button"
                        onClick={handleBackspace}
                        className="h-16 rounded-xl bg-slate-800/40 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 font-semibold active:scale-95 transition-all duration-100 flex items-center justify-center border border-slate-800/50"
                    >
                        <Delete size={24} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-2">
                    <button
                        type="button"
                        onClick={() => {
                            handleClear();
                            onClose();
                        }}
                        className="flex-1 py-3 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 font-bold tracking-wide transition duration-200"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={pin.length < 4 || isSubmitting}
                        className={`flex-1 py-3 rounded-xl font-bold tracking-wide transition duration-200 ${
                            pin.length === 4 && !isSubmitting
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? 'Validando...' : 'Ingresar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { X, Delete } from 'lucide-react';

export default function PinPadModal({ isOpen, onClose, onConfirm, errorMsg }) {
    const [pin, setPin] = useState('');

    if (!isOpen) return null;

    const handleKeyPress = (num) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            // Auto confirm on 4 digits
            if (newPin.length === 4) {
                onConfirm(newPin);
            }
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

                {/* Cancel Button */}
                <button
                    type="button"
                    onClick={() => {
                        handleClear();
                        onClose();
                    }}
                    className="w-full py-3 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800/50 font-bold tracking-wide transition duration-200 mt-2"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

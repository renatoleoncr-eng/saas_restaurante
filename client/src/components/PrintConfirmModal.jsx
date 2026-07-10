import React from 'react';
import { X, Printer, Printer as PrinterIcon } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export default function PrintConfirmModal({ isOpen, onClose, onConfirm }) {
    useModalBackHandler(isOpen, onClose);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col p-6 overflow-hidden transform scale-100 transition-all duration-300">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-wide">Imprimir Comanda</h2>
                        <p className="text-xs text-slate-400 mt-1">¿Deseas enviar a imprimir?</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-full transition duration-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col items-center justify-center mb-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
                        <PrinterIcon size={32} className="text-indigo-400" />
                    </div>
                    <p className="text-slate-300">¿Deseas imprimir la comanda de este pedido en <strong className="text-white">Cocina/Barra</strong>?</p>
                </div>

                <div className="flex gap-3 mt-2">
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm(false);
                            onClose();
                        }}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-bold tracking-wide transition duration-200"
                    >
                        No Imprimir
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm(true);
                            onClose();
                        }}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide transition duration-200 shadow-lg shadow-indigo-500/25"
                    >
                        Imprimir
                    </button>
                </div>
            </div>
        </div>
    );
}

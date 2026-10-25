import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, Phone } from 'lucide-react';
import { getMediaUrl } from '../../utils/mediaUtils';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';

/**
 * Reusable modal for maximizing QR code images in full screen.
 * Uses createPortal into document.body with z-[300] to guarantee
 * it sits cleanly above any modal, navigation bar, or backdrop.
 */
export default function QrPreviewModal({
    isOpen,
    onClose,
    qrData // { imageUrl, name, phoneNumber }
}) {
    useModalBackHandler(isOpen, onClose);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !qrData || !qrData.imageUrl) return null;

    const isVideo = qrData.imageUrl?.toLowerCase()?.match(/\.(mp4|webm|ogg)$/);

    return createPortal(
        <div
            className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 text-center animate-in fade-in duration-200 select-none"
            onClick={onClose}
        >
            <div
                className="relative max-w-sm sm:max-w-md w-full animate-in zoom-in-95 duration-200 flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Floating Close Button (top-right) */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute -top-12 right-0 sm:-right-2 text-white hover:text-gray-200 hover:bg-white/30 text-lg font-bold bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition border border-white/40 shadow-lg cursor-pointer backdrop-blur-md active:scale-95"
                    aria-label="Cerrar vista previa"
                    title="Cerrar (Esc)"
                >
                    <X size={20} />
                </button>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-5 w-full border border-white/30 flex flex-col items-center">
                    {/* Header with Title and inner Close button */}
                    <div className="w-full flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                        <div className="flex items-center gap-2 text-left min-w-0">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                <QrCode size={18} />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                                    Código QR
                                </span>
                                <h3 className="text-base font-bold text-gray-800 leading-tight truncate">
                                    {qrData.name || 'Código QR'}
                                </h3>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                            aria-label="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* QR Image Box */}
                    <div className="w-full bg-white rounded-xl border-2 border-dashed border-gray-200 p-2 sm:p-3 flex items-center justify-center shadow-inner">
                        {isVideo ? (
                            <video
                                src={getMediaUrl(qrData.imageUrl)}
                                className="w-full max-h-[55vh] object-contain rounded-lg"
                                controls
                                autoPlay
                            />
                        ) : (
                            <img
                                src={getMediaUrl(qrData.imageUrl)}
                                alt={qrData.name || 'QR'}
                                className="w-full max-h-[55vh] object-contain rounded-lg"
                            />
                        )}
                    </div>

                    {/* Phone Number if available */}
                    {qrData.phoneNumber && (
                        <div className="mt-3 bg-gray-50 border border-gray-200/80 rounded-xl px-3 py-1.5 w-full flex items-center justify-center gap-2">
                            <Phone size={14} className="text-gray-500 shrink-0" />
                            <span className="text-xs text-gray-500 font-medium">Celular:</span>
                            <span className="text-sm font-bold text-gray-800 font-mono">
                                {qrData.phoneNumber}
                            </span>
                        </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2.5 text-center font-medium">
                        Muestra este código al cliente para escanear
                    </p>

                    {/* Bottom Close Button for mobile ergonomics */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 w-full py-2.5 bg-gray-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <X size={16} />
                        Cerrar QR
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

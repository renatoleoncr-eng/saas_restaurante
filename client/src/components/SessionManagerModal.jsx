import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Lock, Unlock, Calculator, AlertCircle, Save, CheckCircle, ArrowLeft } from 'lucide-react';

export default function SessionManagerModal({ onClose }) {
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null); // { session, expected, paymentTotals, expenseTotals }
    const [openingCash, setOpeningCash] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [isClosingMode, setIsClosingMode] = useState(false);
    const [countedValues, setCountedValues] = useState({
        efectivo: '',
        tarjeta: '',
        yape: '',
        transferencia: ''
    });

    const fetchCurrentSession = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/sessions/current');
            setSessionData(res.data);
            // Pre-fill notes if any
            setClosingNotes(res.data.session.closingNotes || '');
        } catch (err) {
            if (err.response?.status === 404) {
                setSessionData(null);
            } else {
                console.error("Error fetching session:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentSession();
    }, []);

    const handleOpenSession = async () => {
        try {
            const userString = localStorage.getItem('user');
            const user = userString ? JSON.parse(userString) : null;
            
            await axios.post('/api/sessions/open', {
                openingCash: parseFloat(openingCash) || 0,
                userId: user?.id
            });
            fetchCurrentSession();
        } catch (err) {
            alert(err.response?.data?.error || "Error al abrir sesión");
        }
    };

    const handleCloseSession = async () => {
        if (!confirm('¿Está seguro de cerrar el turno? Esta acción no se puede deshacer.')) return;
        
        try {
            const userString = localStorage.getItem('user');
            const user = userString ? JSON.parse(userString) : null;
            
            const closingDetails = {
                expected: sessionData.expected,
                counted: countedValues,
                differences: {
                    efectivo: (parseFloat(countedValues.efectivo) || 0) - sessionData.expected.efectivo,
                    tarjeta: (parseFloat(countedValues.tarjeta) || 0) - sessionData.expected.tarjeta,
                    yape: (parseFloat(countedValues.yape) || 0) - sessionData.expected.yape,
                    transferencia: (parseFloat(countedValues.transferencia) || 0) - sessionData.expected.transferencia
                }
            };

            await axios.post('/api/sessions/close', {
                sessionId: sessionData.session.id,
                closingNotes,
                closingDetails,
                userId: user?.id
            });
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || "Error al cerrar sesión");
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-2xl animate-pulse">Cargando datos de caja...</div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Calculator className="text-blue-100" size={24} />
                        <div>
                            <h2 className="text-xl font-bold">Gestión de Turno y Caja</h2>
                            <p className="text-blue-100 text-xs opacity-80">
                                {sessionData ? `Sesión activa #${sessionData.session.id}` : 'No hay sesión activa'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {!sessionData ? (
                        /* OPEN SESSION VIEW */
                        <div className="space-y-6 py-4">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg flex gap-3">
                                <Unlock className="text-blue-600 shrink-0" size={20} />
                                <p className="text-blue-800 text-sm">
                                    Para comenzar el turno, debe indicar con cuánto efectivo está iniciando la caja.
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Efectivo de Apertura (S/)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">S/</span>
                                    <input 
                                        type="number" 
                                        value={openingCash}
                                        onChange={e => setOpeningCash(e.target.value)}
                                        className="w-full pl-10 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-all text-2xl font-bold"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleOpenSession}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={20} /> Abrir Turno de Salón
                            </button>
                        </div>
                    ) : !isClosingMode ? (
                        /* SHIFT SUMMARY VIEW */
                        <div className="space-y-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg flex gap-3">
                                <CheckCircle className="text-blue-600 shrink-0" size={20} />
                                <p className="text-blue-800 text-sm font-semibold">
                                    El turno está actualmente abierto y operando.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Apertura</span>
                                    <span className="text-xl font-bold text-gray-800">S/ {parseFloat(sessionData.session.openingCash).toFixed(2)}</span>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Iniciado por</span>
                                    <span className="text-sm font-bold text-gray-800">{sessionData.session.Opener?.displayName || sessionData.session.Opener?.username || 'Sistema'}</span>
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-xl p-5 text-white flex justify-between items-center shadow-xl">
                                <div>
                                    <span className="text-xs text-gray-400 block uppercase font-bold tracking-widest">Total Esperado en Caja</span>
                                    <span className="text-2xl font-bold">
                                        S/ {Object.values(sessionData.expected).reduce((a, b) => a + b, 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-400 block uppercase font-bold tracking-widest">Gastos Caja</span>
                                    <span className="text-lg font-bold text-red-400">
                                        - S/ {(sessionData.expenseTotals.efectivo || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <button 
                                onClick={() => setIsClosingMode(true)}
                                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-bold py-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                                <Lock size={20} /> Iniciar Cierre de Turno
                            </button>
                        </div>
                    ) : (
                        /* CLOSE SESSION VIEW */
                        <div className="space-y-6">
                            <div 
                                className="flex items-center gap-2 text-gray-500 mb-2 cursor-pointer hover:text-gray-800 transition-colors w-max font-semibold text-sm bg-gray-100 px-3 py-1.5 rounded-lg" 
                                onClick={() => setIsClosingMode(false)}
                            >
                                <ArrowLeft size={16} /> Volver al resumen
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Apertura</span>
                                    <span className="text-xl font-bold text-gray-800">S/ {parseFloat(sessionData.session.openingCash).toFixed(2)}</span>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Iniciado por</span>
                                    <span className="text-sm font-bold text-gray-800">{sessionData.session.Opener?.displayName || sessionData.session.Opener?.username || 'Sistema'}</span>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden shadow-inner">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 text-gray-600">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold uppercase tracking-tighter text-[10px]">Método</th>
                                            <th className="px-4 py-3 text-right font-bold uppercase tracking-tighter text-[10px]">Esperado</th>
                                            <th className="px-4 py-3 text-right w-32 font-bold uppercase tracking-tighter text-[10px]">Contado</th>
                                            <th className="px-4 py-3 text-right font-bold uppercase tracking-tighter text-[10px]">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {['efectivo', 'tarjeta', 'yape', 'transferencia'].map(m => {
                                            const expected = sessionData.expected[m] || 0;
                                            const countedStr = countedValues[m];
                                            const counted = parseFloat(countedStr) || 0;
                                            const diff = countedStr !== '' ? counted - expected : 0;
                                            
                                            return (
                                                <tr key={m} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-4 capitalize font-semibold text-gray-700">{m}</td>
                                                    <td className="px-4 py-4 text-right font-mono font-bold text-gray-600">S/ {expected.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <input 
                                                            type="number"
                                                            value={countedValues[m]}
                                                            onChange={e => setCountedValues({...countedValues, [m]: e.target.value})}
                                                            className="w-full border p-2 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                    <td className={`px-4 py-4 text-right font-bold ${countedStr === '' ? 'text-gray-300' : diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-blue-500'}`}>
                                                        {countedStr !== '' ? (diff !== 0 ? `S/ ${diff.toFixed(2)}` : 'OK') : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Summary */}
                            <div className="bg-gray-900 rounded-xl p-5 text-white flex justify-between items-center shadow-xl">
                                <div>
                                    <span className="text-xs text-gray-400 block uppercase font-bold tracking-widest">Total Esperado</span>
                                    <span className="text-2xl font-bold">
                                        S/ {Object.values(sessionData.expected).reduce((a, b) => a + b, 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-400 block uppercase font-bold tracking-widest">Gastos Caja</span>
                                    <span className="text-lg font-bold text-red-400">
                                        - S/ {(sessionData.expenseTotals.efectivo || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas de Cierre</label>
                                <textarea 
                                    value={closingNotes}
                                    onChange={e => setClosingNotes(e.target.value)}
                                    className="w-full border-2 border-gray-100 rounded-xl p-4 text-sm focus:border-blue-500 outline-none transition-all resize-none"
                                    placeholder="Describa cualquier descuadre o detalle del turno..."
                                    rows={3}
                                />
                            </div>

                            <button 
                                onClick={handleCloseSession}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-red-200 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                            >
                                <Lock size={20} /> Confirmar Cierre de Turno y Caja
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Footer info */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                    Sistema de Gestión Mak Suites - Control de Auditoría
                </div>
            </div>
        </div>
    );
}

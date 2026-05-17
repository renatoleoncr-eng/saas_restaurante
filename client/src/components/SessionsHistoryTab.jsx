import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, ChevronDown, ChevronUp, DollarSign, FileText, User } from 'lucide-react';

export default function SessionsHistoryTab() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSessionId, setExpandedSessionId] = useState(null);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/sessions/history?limit=50');
            setSessions(res.data);
        } catch (error) {
            console.error("Error loading sessions history:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id) => {
        if (expandedSessionId === id) {
            setExpandedSessionId(null);
        } else {
            setExpandedSessionId(id);
        }
    };

    const parseClosingDetails = (detailsStr) => {
        if (!detailsStr) return null;
        try {
            return JSON.parse(detailsStr);
        } catch (e) {
            console.error("Error parsing closing details", e);
            return null;
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                            <th className="p-4 font-bold text-gray-600 text-sm"># Turno</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Apertura</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Cierre</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Responsable (Cierre)</th>
                            <th className="p-4 font-bold text-gray-600 text-sm text-right">Efectivo Apertura</th>
                            <th className="p-4 font-bold text-gray-600 text-sm text-center">Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center p-8 text-gray-500">Cargando historial de turnos...</td>
                            </tr>
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center p-8 text-gray-500">No hay turnos cerrados aún.</td>
                            </tr>
                        ) : (
                            sessions.map((session) => {
                                const details = parseClosingDetails(session.closingDetails);
                                const isExpanded = expandedSessionId === session.id;

                                // Calculate total difference if details exist
                                let totalDiff = 0;
                                if (details) {
                                    ['efectivo', 'tarjeta', 'yape', 'transferencia'].forEach(m => {
                                        const expected = Number(details.expected?.[m] || 0);
                                        const counted = Number(details.counted?.[m] || 0);
                                        totalDiff += (counted - expected);
                                    });
                                }

                                return (
                                    <React.Fragment key={session.id}>
                                        <tr className={`border-b hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                                            <td className="p-4 font-mono font-medium text-gray-700">{session.id}</td>
                                            <td className="p-4 text-gray-600 text-sm">{formatDate(session.openedAt)}</td>
                                            <td className="p-4 text-gray-600 text-sm">{formatDate(session.closedAt)}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-blue-100 p-1.5 rounded-full text-blue-600">
                                                        <User size={14} />
                                                    </div>
                                                    <span className="font-medium text-sm text-gray-700">
                                                        {session.Closer?.displayName || session.Closer?.username || 'Sistema'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-medium text-gray-800">
                                                S/ {parseFloat(session.openingCash).toFixed(2)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleExpand(session.id)}
                                                    className={`flex items-center justify-center gap-1 mx-auto px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                                        isExpanded ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    Cuadre
                                                </button>
                                            </td>
                                        </tr>

                                        {/* EXPANDED DETAILS */}
                                        {isExpanded && (
                                            <tr className="bg-gray-50/80 border-b">
                                                <td colSpan="6" className="p-0">
                                                    <div className="p-6 border-l-4 border-blue-500 m-4 bg-white rounded-r-xl shadow-sm">
                                                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                            <FileText size={18} className="text-blue-600" />
                                                            Detalle del Cuadre de Caja
                                                        </h4>
                                                        
                                                        {details ? (
                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                                <div className="lg:col-span-2 border rounded-xl overflow-hidden">
                                                                    <table className="w-full text-sm">
                                                                        <thead className="bg-gray-100 text-gray-600">
                                                                            <tr>
                                                                                <th className="px-4 py-2 text-left font-bold uppercase tracking-tighter text-[10px]">Método</th>
                                                                                <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter text-[10px]">Esperado</th>
                                                                                <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter text-[10px]">Contado</th>
                                                                                <th className="px-4 py-2 text-right font-bold uppercase tracking-tighter text-[10px]">Diferencia</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100">
                                                                            {['efectivo', 'tarjeta', 'yape', 'transferencia'].map(m => {
                                                                                const expected = Number(details.expected?.[m] || 0);
                                                                                const counted = Number(details.counted?.[m] || 0);
                                                                                const diff = counted - expected;
                                                                                
                                                                                return (
                                                                                    <tr key={m} className="hover:bg-gray-50/50">
                                                                                        <td className="px-4 py-3 capitalize font-semibold text-gray-700">{m}</td>
                                                                                        <td className="px-4 py-3 text-right font-mono text-gray-600">S/ {expected.toFixed(2)}</td>
                                                                                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">S/ {counted.toFixed(2)}</td>
                                                                                        <td className={`px-4 py-3 text-right font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-blue-500'}`}>
                                                                                            {diff !== 0 ? `S/ ${diff.toFixed(2)}` : 'OK'}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                            <tr className="bg-gray-100">
                                                                                <td colSpan="3" className="px-4 py-3 text-right font-bold text-gray-700">DIFERENCIA TOTAL</td>
                                                                                <td className={`px-4 py-3 text-right font-bold text-lg ${totalDiff < 0 ? 'text-red-600' : totalDiff > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                                                                                    {totalDiff !== 0 ? `S/ ${totalDiff.toFixed(2)}` : 'CUADRADO'}
                                                                                </td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-4">
                                                                    <span className="text-xs text-yellow-800 block uppercase font-bold tracking-widest mb-2">Notas del Cajero</span>
                                                                    <p className="text-sm text-gray-700 italic">
                                                                        {session.closingNotes || "Sin notas adicionales."}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-500 text-sm italic">
                                                                No hay detalles JSON guardados para este turno.
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

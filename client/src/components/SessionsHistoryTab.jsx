import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Calendar, ChevronDown, ChevronUp, DollarSign, FileText, User, 
    X, Calculator, AlertCircle, CheckCircle, List, Package, 
    Coffee, Utensils, Sparkles, Clock, Receipt 
} from 'lucide-react';

export default function SessionsHistoryTab() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [sessionDetails, setSessionDetails] = useState({}); // Cache detailed session info
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleOpenDetails = async (sessionId) => {
        setSelectedSessionId(sessionId);
        setIsModalOpen(true);
        
        if (!sessionDetails[sessionId]) {
            setLoadingDetails(true);
            try {
                const res = await axios.get(`/api/sessions/${sessionId}/details`);
                setSessionDetails(prev => ({
                    ...prev,
                    [sessionId]: res.data
                }));
            } catch (error) {
                console.error("Error loading session details:", error);
                alert("Error al cargar los detalles del turno");
                setIsModalOpen(false);
            } finally {
                setLoadingDetails(false);
            }
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
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                            <th className="p-4 font-bold text-gray-600 text-sm"># Turno</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Apertura</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Cierre</th>
                            <th className="p-4 font-bold text-gray-600 text-sm">Responsable (Cierre)</th>
                            <th className="p-4 font-bold text-gray-600 text-sm text-center">Diferencia Caja</th>
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
                                
                                // Calculate total difference if details exist
                                let totalDiff = 0;
                                let diffBadge = null;
                                if (details) {
                                    ['efectivo', 'tarjeta', 'yape', 'transferencia'].forEach(m => {
                                        const expected = Number(details.expected?.[m] || 0);
                                        const counted = Number(details.counted?.[m] || 0);
                                        totalDiff += (counted - expected);
                                    });
                                    
                                    if (totalDiff === 0) {
                                        diffBadge = (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                                                <CheckCircle size={10} /> Cuadrado
                                            </span>
                                        );
                                    } else if (totalDiff < 0) {
                                        diffBadge = (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                <AlertCircle size={10} /> Faltante S/ {Math.abs(totalDiff).toFixed(2)}
                                            </span>
                                        );
                                    } else {
                                        diffBadge = (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                <AlertCircle size={10} /> Sobrante S/ {totalDiff.toFixed(2)}
                                            </span>
                                        );
                                    }
                                } else {
                                    diffBadge = <span className="text-xs text-gray-400 italic">No disponible</span>;
                                }

                                return (
                                    <tr key={session.id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-gray-800">#{session.id}</td>
                                        <td className="p-4 text-gray-600 text-sm">{formatDate(session.openedAt)}</td>
                                        <td className="p-4 text-gray-600 text-sm">{formatDate(session.closedAt)}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-blue-100 p-1.5 rounded-full text-blue-600 shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <span className="font-semibold text-sm text-gray-700 truncate max-w-[150px]">
                                                    {session.Closer?.displayName || session.Closer?.username || 'Sistema'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {diffBadge}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleOpenDetails(session.id)}
                                                className="inline-flex items-center justify-center gap-1.5 px-4.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 transition-all"
                                            >
                                                <Calculator size={14} />
                                                Cuadre
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Premium details modal */}
            <SessionDetailsModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                sessionId={selectedSessionId}
                details={selectedSessionId ? sessionDetails[selectedSessionId] : null}
                loading={loadingDetails}
            />
        </div>
    );
}

// Inner Component: SessionDetailsModal
function SessionDetailsModal({ isOpen, onClose, sessionId, details, loading }) {
    const [expandedCategory, setExpandedCategory] = useState(null);

    // Reset expanded category on modal open
    useEffect(() => {
        if (isOpen) {
            setExpandedCategory(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const parseClosingDetails = (detailsStr) => {
        if (!detailsStr) return null;
        try {
            return JSON.parse(detailsStr);
        } catch (e) {
            return null;
        }
    };

    const session = details?.session;
    const expected = details?.expected || {};
    const salesSummary = details?.salesSummary || {};

    const closingDetailsParsed = session?.closingDetails ? parseClosingDetails(session.closingDetails) : null;
    const countedValues = closingDetailsParsed?.counted || {};
    const expectedValues = closingDetailsParsed?.expected || expected || {};

    let totalExpected = 0;
    let totalCounted = 0;
    let totalDiff = 0;

    const methods = ['efectivo', 'tarjeta', 'yape', 'transferencia'];
    methods.forEach(m => {
        const exp = Number(expectedValues[m] || 0);
        const cnt = Number(countedValues[m] || 0);
        totalExpected += exp;
        totalCounted += cnt;
        totalDiff += (cnt - exp);
    });

    const getMovements = () => {
        if (!details) return [];
        
        const paymentsList = (details.payments || []).map(p => ({
            id: `pay-${p.id}`,
            type: 'ingreso',
            amount: parseFloat(p.amount),
            method: p.method || 'efectivo',
            time: p.createdAt,
            user: p.User ? (p.User.displayName || p.User.username) : 'N/A',
            reference: p.Account?.Table?.number ? `Mesa ${p.Account.Table.number}` : 'Caja/Llevar'
        }));

        const expensesList = (details.expenses || []).map(e => ({
            id: `exp-${e.id}`,
            type: 'egreso',
            amount: parseFloat(e.amount),
            method: e.paymentMethod || 'efectivo',
            time: e.date || e.createdAt,
            user: e.User?.displayName || e.User?.username || 'N/A',
            reference: e.description || 'Gasto General'
        }));

        return [...paymentsList, ...expensesList].sort((a, b) => new Date(b.time) - new Date(a.time));
    };

    const movements = getMovements();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            {/* Backdrop click to close */}
            <div className="fixed inset-0" onClick={onClose}></div>
            
            <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 z-10 relative animate-duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 sm:p-5 text-white flex justify-between items-center shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Calculator size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold">Arqueo e Historial de Turno #{sessionId}</h2>
                            <p className="text-blue-100 text-[10px] sm:text-xs opacity-90">
                                Apertura por {session?.Opener?.displayName || session?.Opener?.username || 'Sistema'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 active:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-500 font-medium">Obteniendo arqueo detallado...</span>
                        </div>
                    ) : !details ? (
                        <div className="text-center py-20 text-gray-500">
                            No se pudieron obtener los detalles de este turno.
                        </div>
                    ) : (
                        <>
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 bg-white p-4 rounded-xl border shadow-xs">
                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Apertura</span>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                        <Calendar size={13} className="text-gray-400 shrink-0" />
                                        {formatDate(session?.openedAt)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Cierre</span>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                        <Clock size={13} className="text-gray-400 shrink-0" />
                                        {formatDate(session?.closedAt)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Fondo Inicial</span>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                        <DollarSign size={13} className="text-gray-400 shrink-0" />
                                        S/ {parseFloat(session?.openingCash || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Responsable</span>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                        <User size={13} className="text-gray-400 shrink-0" />
                                        {session?.Closer?.displayName || session?.Closer?.username || 'Sistema'}
                                    </div>
                                </div>
                            </div>

                            {/* Cash Balance Cards Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4.5 rounded-xl border shadow-xs flex flex-col justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Esperado</span>
                                    <span className="text-xl sm:text-2xl font-extrabold text-gray-800 mt-1">S/ {totalExpected.toFixed(2)}</span>
                                </div>
                                <div className="bg-white p-4.5 rounded-xl border shadow-xs flex flex-col justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Contado</span>
                                    <span className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">S/ {totalCounted.toFixed(2)}</span>
                                </div>
                                <div className={`p-4.5 rounded-xl border shadow-xs flex flex-col justify-between ${
                                    totalDiff === 0 
                                        ? 'bg-green-50 border-green-200' 
                                        : totalDiff < 0 
                                            ? 'bg-rose-50 border-rose-200' 
                                            : 'bg-amber-50 border-amber-200'
                                }`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                                        totalDiff === 0 ? 'text-green-700' : totalDiff < 0 ? 'text-rose-700' : 'text-amber-700'
                                    }`}>
                                        Diferencia Total
                                    </span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className={`text-xl sm:text-2xl font-extrabold ${
                                            totalDiff === 0 ? 'text-green-700' : totalDiff < 0 ? 'text-rose-700' : 'text-amber-700'
                                        }`}>
                                            {totalDiff !== 0 ? `S/ ${totalDiff.toFixed(2)}` : 'S/ 0.00'}
                                        </span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                            totalDiff === 0 
                                                ? 'bg-green-200 text-green-800' 
                                                : totalDiff < 0 
                                                    ? 'bg-rose-200 text-rose-800' 
                                                    : 'bg-amber-200 text-amber-800'
                                        }`}>
                                            {totalDiff === 0 ? 'CUADRADO' : totalDiff < 0 ? 'FALTANTE' : 'SOBRANTE'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1: Detailed Payment Method Breakdown */}
                            <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                                <div className="bg-gray-50 px-5 py-3 border-b flex items-center justify-between">
                                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <DollarSign size={16} className="text-gray-500" />
                                        Desglose de Caja por Método de Pago
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50/50 text-gray-500 border-b">
                                                <th className="px-5 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Método</th>
                                                <th className="px-5 py-2.5 text-right font-bold uppercase tracking-wider text-[10px]">Esperado</th>
                                                <th className="px-5 py-2.5 text-right font-bold uppercase tracking-wider text-[10px]">Contado</th>
                                                <th className="px-5 py-2.5 text-right font-bold uppercase tracking-wider text-[10px]">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {methods.map(m => {
                                                const exp = Number(expectedValues[m] || 0);
                                                const cnt = Number(countedValues[m] || 0);
                                                const diff = cnt - exp;
                                                
                                                return (
                                                    <tr key={m} className="hover:bg-gray-50/30 transition-colors">
                                                        <td className="px-5 py-3 capitalize font-semibold text-gray-700 flex items-center gap-2">
                                                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                                m === 'efectivo' ? 'bg-emerald-500' :
                                                                m === 'tarjeta' ? 'bg-blue-500' :
                                                                m === 'yape' ? 'bg-purple-500' : 'bg-orange-500'
                                                            }`}></span>
                                                            {m}
                                                        </td>
                                                        <td className="px-5 py-3 text-right font-mono text-gray-600">S/ {exp.toFixed(2)}</td>
                                                        <td className="px-5 py-3 text-right font-mono font-bold text-gray-800">S/ {cnt.toFixed(2)}</td>
                                                        <td className={`px-5 py-3 text-right font-bold font-mono ${
                                                            diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-blue-500'
                                                        }`}>
                                                            {diff !== 0 ? `S/ ${diff.toFixed(2)}` : 'OK'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Movimientos de Caja Section */}
                            <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
                                <div className="bg-gray-50 px-5 py-3 border-b flex items-center justify-between">
                                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <Receipt size={16} className="text-gray-500" />
                                        Movimientos de Caja
                                    </h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                        {movements.length} Transacciones
                                    </span>
                                </div>
                                <div className="p-3 max-h-60 overflow-y-auto no-scrollbar">
                                    {movements.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-gray-100 text-gray-400">
                                                        <th className="p-2 font-bold uppercase tracking-wider text-[9px]">Hora</th>
                                                        <th className="p-2 font-bold uppercase tracking-wider text-[9px]">Mesa/Gasto</th>
                                                        <th className="p-2 font-bold uppercase tracking-wider text-[9px]">Usuario</th>
                                                        <th className="p-2 font-bold uppercase tracking-wider text-[9px]">Método</th>
                                                        <th className="p-2 font-bold uppercase tracking-wider text-[9px] text-right">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {movements.map(m => (
                                                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="p-2 text-gray-400 font-mono">
                                                                {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="font-semibold text-gray-700 max-w-[150px] truncate" title={m.reference}>
                                                                    {m.reference}
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 capitalize">
                                                                    {m.type === 'ingreso' ? 'Ingreso' : 'Egreso/Gasto'}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-gray-500 font-medium truncate max-w-[100px]" title={m.user}>
                                                                {m.user}
                                                            </td>
                                                            <td className="p-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${
                                                                    m.method === 'efectivo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                    m.method === 'tarjeta' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                                    m.method === 'yape' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                                    'bg-amber-50 text-amber-700 border border-amber-100'
                                                                }`}>
                                                                    {m.method}
                                                                </span>
                                                            </td>
                                                            <td className={`p-2 text-right font-mono font-bold ${
                                                                m.type === 'ingreso' ? 'text-green-600' : 'text-red-500'
                                                            }`}>
                                                                {m.type === 'ingreso' ? '+' : '-'} S/ {m.amount.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-gray-400 italic text-xs">
                                            No hay movimientos registrados en este turno.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Sales Summary Categories */}
                            {salesSummary && Object.keys(salesSummary).length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <List size={16} className="text-gray-500" />
                                        Resumen de Ventas por Categoría
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5 items-start">
                                        {Object.entries(salesSummary)
                                            .filter(([catKey, catData]) => catKey !== 'otros' || catData.count > 0)
                                            .map(([catKey, catData]) => {
                                            const isCatExpanded = expandedCategory === catKey;
                                            
                                            let displayLabel = catKey;
                                            let catColorClass = "border-gray-200 hover:border-gray-300";
                                            let icon = <Package size={16} />;
                                            
                                            if (catKey === 'menus') {
                                                displayLabel = "Menús";
                                                icon = <List size={16} className="text-orange-500" />;
                                                catColorClass = isCatExpanded ? "border-orange-500 shadow-lg shadow-orange-50/50" : "hover:border-orange-300";
                                            } else if (catKey === 'platos') {
                                                displayLabel = "Platos";
                                                icon = <Utensils size={16} className="text-red-500" />;
                                                catColorClass = isCatExpanded ? "border-red-500 shadow-lg shadow-red-50/50" : "hover:border-red-300";
                                            } else if (catKey === 'bebidas') {
                                                displayLabel = "Bebidas";
                                                icon = <Coffee size={16} className="text-blue-500" />;
                                                catColorClass = isCatExpanded ? "border-blue-500 shadow-lg shadow-blue-50/50" : "hover:border-blue-300";
                                            } else if (catKey === '2x1 / Promos') {
                                                displayLabel = "2x1 / Promos";
                                                icon = <Sparkles size={16} className="text-purple-500" />;
                                                catColorClass = isCatExpanded ? "border-purple-500 shadow-lg shadow-purple-50/50" : "hover:border-purple-300";
                                            } else if (catKey === 'otros') {
                                                displayLabel = "Otros";
                                                icon = <Package size={16} className="text-teal-500" />;
                                                catColorClass = isCatExpanded ? "border-teal-500 shadow-lg shadow-teal-50/50" : "hover:border-teal-300";
                                            }

                                            return (
                                                <div 
                                                    key={catKey} 
                                                    className={`bg-white border rounded-xl overflow-hidden shadow-xs flex flex-col transition-all duration-200 ${catColorClass} ${
                                                        isCatExpanded ? 'col-span-2 sm:col-span-4 lg:col-span-5' : ''
                                                    }`}
                                                >
                                                    <div 
                                                        className="p-3.5 cursor-pointer hover:bg-gray-50 flex flex-col items-center text-center transition-colors relative"
                                                        onClick={() => setExpandedCategory(isCatExpanded ? null : catKey)}
                                                    >
                                                        <div className="p-2 rounded-lg bg-gray-50 mb-1.5">
                                                            {icon}
                                                        </div>
                                                        <span className="uppercase text-[8px] font-bold text-gray-400 tracking-wider mb-0.5">
                                                            {displayLabel}
                                                        </span>
                                                        <span className="text-sm font-extrabold text-gray-800 leading-none">
                                                            {catData.count} <span className="text-[8px] text-gray-400 font-normal">unid.</span>
                                                        </span>
                                                        <span className="text-xs font-bold text-blue-600 mt-1">
                                                            S/ {catData.total.toFixed(2)}
                                                        </span>
                                                        <div className="absolute top-2 right-2 text-gray-300">
                                                            {isCatExpanded ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} />}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Expanded Category Items */}
                                                    {isCatExpanded && (
                                                        <div className="bg-gray-50 p-2.5 border-t border-gray-100 max-h-48 overflow-y-auto flex-1">
                                                            {catData.items && catData.items.length > 0 ? (
                                                                <ul className="space-y-2">
                                                                    {catData.items.map((item, idx) => (
                                                                        <li key={idx} className="flex justify-between items-start text-[9px] border-b border-gray-200/50 pb-2 last:border-0 last:pb-0">
                                                                            <div className="flex flex-col flex-1 pr-1">
                                                                                <span className="font-semibold text-gray-700 leading-tight">{item.name}</span>
                                                                                {item.presentation && <span className="text-[7px] text-gray-500">{item.presentation}</span>}
                                                                            </div>
                                                                            <div className="flex flex-col items-end shrink-0">
                                                                                <span className="font-bold text-gray-400">{item.quantity} x S/ {parseFloat(item.price || 0).toFixed(2)}</span>
                                                                                <span className="font-mono font-bold text-gray-800">S/ {parseFloat(item.total || 0).toFixed(2)}</span>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="text-[8px] text-gray-400 italic text-center py-2">Sin ventas</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Notes of the shift closing */}
                            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4.5 shadow-xs">
                                <h4 className="text-[10px] text-amber-800 uppercase font-bold tracking-wider mb-1.5">Bitácora / Notas de Cierre</h4>
                                <p className="text-xs text-gray-700 italic leading-relaxed">
                                    {session?.closingNotes || "Sin notas adicionales reportadas para este turno."}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-5 py-3.5 border-t flex justify-end shrink-0">
                    <button 
                        onClick={onClose} 
                        className="bg-gray-800 hover:bg-gray-950 text-white font-bold px-6 py-2 rounded-xl shadow active:scale-95 transition-all text-xs"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

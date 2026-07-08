import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Lock, Unlock, Calculator, AlertCircle, Save, CheckCircle, ArrowLeft, ChevronDown, ChevronUp, Receipt, List, Coffee, MinusCircle, Printer } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { useRestaurant } from '../contexts/RestaurantContext';

export default function SessionManagerModal({ onClose, initialIsClosingMode = false }) {
    const { printingEnabled } = useRestaurant();
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null); // { session, expected, paymentTotals, expenseTotals, payments, salesSummary }
    const [openingCash, setOpeningCash] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [isClosingMode, setIsClosingMode] = useState(initialIsClosingMode);
    const [expandedPaymentMethod, setExpandedPaymentMethod] = useState(null);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false);
    const [justOpened, setJustOpened] = useState(false);
    const [selectedMethodFilter, setSelectedMethodFilter] = useState('todos');

    // Expense Modal states
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        description: '', amount: '', paymentMethod: 'efectivo', category: 'Insumos', notes: ''
    });

    const [countedValues, setCountedValues] = useState({
        efectivo: '',
        tarjeta: '',
        yape: '',
        transferencia: ''
    });

    useModalBackHandler(true, onClose);
    useModalBackHandler(showExpenseModal, () => setShowExpenseModal(false));
    useModalBackHandler(showConfirmCloseModal, () => setShowConfirmCloseModal(false));

    const displayNames = {
        efectivo: 'Efectivo',
        tarjeta: 'TC/TD',
        yape: 'Yape',
        transferencia: 'Transf'
    };

    const getMovements = () => {
        if (!sessionData) return [];
        
        const paymentsList = (sessionData.payments || []).map(p => ({
            id: `pay-${p.id}`,
            type: 'ingreso',
            amount: parseFloat(p.amount),
            method: p.method || 'efectivo',
            time: p.createdAt,
            user: p.User?.displayName || p.User?.username || 'N/A',
            reference: p.Account?.Table?.number ? `Mesa ${p.Account.Table.number}` : 'Caja/Llevar'
        }));

        const expensesList = (sessionData.expenses || []).map(e => ({
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

    const allMovements = getMovements();
    const movements = selectedMethodFilter === 'todos'
        ? allMovements
        : allMovements.filter(m => m.method === selectedMethodFilter);

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
            setJustOpened(true);
            fetchCurrentSession();
        } catch (err) {
            alert(err.response?.data?.error || "Error al abrir sesión");
        }
    };

    const handleReprintApertura = async () => {
        if (!sessionData?.session?.id) return;
        try {
            const userString = localStorage.getItem('user');
            const user = userString ? JSON.parse(userString) : null;
            const res = await axios.post(`/api/sessions/${sessionData.session.id}/print`, {
                type: 'apertura',
                userId: user?.id
            });
            if (res.data.success) {
                alert("Ticket de apertura enviado a la impresora.");
            } else {
                alert("Error al enviar el ticket a la impresora.");
            }
        } catch (err) {
            alert(err.response?.data?.error || "Error al imprimir ticket de apertura");
            console.error(err);
        }
    };

    const handleRequestCloseSession = () => {
        if (!closingNotes || closingNotes.trim() === '') {
            alert("Es obligatorio ingresar las notas de cierre.");
            return;
        }
        setShowConfirmCloseModal(true);
    };

    const handleConfirmCloseSession = async () => {
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
            setShowConfirmCloseModal(false);
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || "Error al cerrar sesión");
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            const userString = localStorage.getItem('user');
            const user = userString ? JSON.parse(userString) : null;
            await axios.post('/api/expenses', {
                ...expenseForm,
                userId: user?.id
            });
            setShowExpenseModal(false);
            setExpenseForm({ description: '', amount: '', paymentMethod: 'efectivo', category: 'Insumos', notes: '' });
            fetchCurrentSession();
        } catch (err) {
            alert(err.response?.data?.error || "Error al registrar egreso");
        }
    };

    if (loading) return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-2xl animate-pulse text-gray-700 font-bold">Cargando datos de caja...</div>
        </div>,
        document.body
    );

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-stretch md:items-center justify-center p-0 md:p-4 animate-in fade-in">
            <div className="bg-white w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className={`bg-gradient-to-r ${sessionData && !isClosingMode ? 'from-green-600 to-emerald-700' : 'from-blue-600 to-indigo-700'} p-4 md:p-5 text-white flex justify-between items-center shadow-md shrink-0`}>
                    <div className="flex items-center gap-3">
                        <Calculator className={sessionData && !isClosingMode ? 'text-green-100' : 'text-blue-100'} size={24} />
                        <div>
                            <h2 className="text-lg md:text-xl font-bold">Gestión de Turno y Caja</h2>
                            <p className={`${sessionData && !isClosingMode ? 'text-green-100' : 'text-blue-100'} text-xs opacity-80`}>
                                {sessionData ? `Sesión activa #${sessionData.session.id}` : 'No hay sesión activa'}
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="p-3 hover:bg-white/10 active:bg-white/20 rounded-full text-white/80 hover:text-white transition-all duration-200 relative z-50 cursor-pointer pointer-events-auto shrink-0 flex items-center justify-center -mr-2"
                        aria-label="Cerrar modal"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-gray-50/50 no-scrollbar">
                    {!sessionData ? (
                        /* OPEN SESSION VIEW */
                        <div className="space-y-6 py-4">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-xl flex gap-3 shadow-sm">
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
                                        onWheel={(e) => e.target.blur()}
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-all text-xl font-bold bg-gray-50"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleOpenSession}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-blue-200 hover:shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200"
                            >
                                <CheckCircle size={20} /> Abrir Turno de Salón
                            </button>
                        </div>
                    ) : justOpened ? (
                        /* JUST OPENED CONFIRMATION VIEW */
                        <div className="space-y-6 py-6 text-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                                <CheckCircle size={36} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">¡Turno Abierto Exitosamente!</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    La caja ha sido iniciada con <span className="font-bold text-gray-700">S/ {parseFloat(openingCash || 0).toFixed(2)}</span>
                                </p>
                            </div>
                            
                            <button 
                                onClick={onClose}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-green-100 transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200"
                            >
                                <Coffee size={20} /> Empezar / Ir al Salón
                            </button>
                        </div>
                    ) : !isClosingMode ? (
                        /* SHIFT SUMMARY VIEW */
                        <div className="space-y-4 md:space-y-6">
                            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg flex gap-3">
                                <CheckCircle className="text-green-600 shrink-0" size={20} />
                                <p className="text-green-800 text-sm font-semibold">
                                    El turno está actualmente abierto y operando.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Apertura</span>
                                    <span className="text-lg md:text-xl font-bold text-gray-800">S/ {parseFloat(sessionData.session.openingCash).toFixed(2)}</span>
                                </div>
                                <div className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-500 block uppercase font-bold tracking-wider">Iniciado por</span>
                                    <span className="text-sm font-bold text-gray-800 truncate block">{sessionData.session.Opener?.displayName || sessionData.session.Opener?.username || 'Sistema'}</span>
                                </div>
                            </div>

                            {printingEnabled && (
                                <button
                                    onClick={handleReprintApertura}
                                    className="w-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200 text-xs"
                                >
                                    <Printer size={16} /> Reimprimir Ticket de Apertura
                                </button>
                            )}

                            {/* Movimientos de Caja Section */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm space-y-3">
                                <div className="bg-gray-50 px-4 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                            <Receipt size={16} className="text-gray-500" />
                                            Movimientos de Caja
                                        </h3>
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                            {movements.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {['todos', 'efectivo', 'tarjeta', 'yape', 'transferencia'].map(method => {
                                            const count = method === 'todos' 
                                                ? allMovements.length 
                                                : allMovements.filter(mov => mov.method === method).length;
                                            
                                            const isPillSelected = selectedMethodFilter === method;
                                            return (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => setSelectedMethodFilter(method)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize transition-all active:scale-95 ${
                                                        isPillSelected
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {method === 'todos' ? 'Todos' : method} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button 
                                        onClick={() => setShowExpenseModal(true)}
                                        className="text-[11px] bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                    >
                                        + Registrar Egreso
                                    </button>
                                </div>
                                
                                <div className="p-2 max-h-60 overflow-y-auto no-scrollbar">
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
                                                                <div className="font-semibold text-gray-700 max-w-[120px] truncate" title={m.reference}>
                                                                    {m.reference}
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 capitalize">
                                                                    {m.type === 'ingreso' ? 'Ingreso' : 'Egreso/Gasto'}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-gray-500 font-medium truncate max-w-[80px]" title={m.user}>
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

                            <button 
                                onClick={onClose}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-green-100 transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200"
                            >
                                <Coffee size={20} /> Abrir Salón (Ir a las Mesas)
                            </button>
                        </div>
                    ) : (
                        /* CLOSE SESSION VIEW */
                        <div className="space-y-6">
                            <div 
                                className="flex items-center gap-2 text-gray-500 mb-2 cursor-pointer hover:text-gray-800 transition-colors w-max font-semibold text-sm bg-gray-100 px-3 py-1.5 rounded-lg" 
                                onClick={onClose}
                            >
                                <ArrowLeft size={16} /> Volver al salón
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

                            {/* DESKTOP VIEW: Standard Table */}
                            <div className="hidden md:block border rounded-2xl overflow-hidden shadow-inner bg-white">
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-sm table-fixed">
                                        <thead className="bg-gray-100 text-gray-600">
                                            <tr>
                                                <th className="w-[30%] px-2 py-2.5 md:px-4 md:py-3 text-left font-bold uppercase tracking-tighter text-[9px] md:text-[10px]">Método</th>
                                                <th className="w-[23%] px-2 py-2.5 md:px-4 md:py-3 text-right font-bold uppercase tracking-tighter text-[9px] md:text-[10px]">Esperado</th>
                                                <th className="w-[27%] px-2 py-2.5 md:px-4 md:py-3 text-right font-bold uppercase tracking-tighter text-[9px] md:text-[10px]">Contado</th>
                                                <th className="w-[20%] px-2 py-2.5 md:px-4 md:py-3 text-right font-bold uppercase tracking-tighter text-[9px] md:text-[10px]">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {['efectivo', 'tarjeta', 'yape', 'transferencia'].map(m => {
                                                const expected = sessionData.expected[m] || 0;
                                                const countedStr = countedValues[m];
                                                const counted = parseFloat(countedStr) || 0;
                                                let diff = countedStr !== '' ? counted - expected : 0;
                                                if (Math.abs(diff) < 0.01) diff = 0;
                                                
                                                return (
                                                    <React.Fragment key={m}>
                                                    <tr className={`hover:bg-gray-50/50 transition-colors ${expandedPaymentMethod === m ? 'bg-blue-50/50' : ''}`}>
                                                        <td 
                                                            className="px-2 py-3 md:px-4 md:py-4 font-semibold text-gray-700 flex items-center gap-1 md:gap-2 cursor-pointer select-none text-xs md:text-sm truncate"
                                                            onClick={() => setExpandedPaymentMethod(expandedPaymentMethod === m ? null : m)}
                                                        >
                                                            {expandedPaymentMethod === m ? <ChevronUp size={12} className="text-blue-500 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
                                                            {displayNames[m]}
                                                        </td>
                                                        <td className="px-2 py-3 md:px-4 md:py-4 text-right font-mono font-bold text-gray-600 text-xs md:text-sm truncate">S/ {expected.toFixed(2)}</td>
                                                        <td className="px-2 py-1.5 md:px-4 md:py-2 text-right">
                                                            <input 
                                                                type="number"
                                                                value={countedValues[m]}
                                                                onChange={e => setCountedValues({...countedValues, [m]: e.target.value})}
                                                                onWheel={(e) => e.target.blur()}
                                                                className="w-full border p-1 md:p-2 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs md:text-sm"
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                        <td className={`px-2 py-3 md:px-4 md:py-4 text-right font-bold text-xs md:text-sm truncate ${countedStr === '' ? 'text-gray-300' : diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-blue-500'}`}>
                                                            {countedStr !== '' ? (diff !== 0 ? `S/ ${diff.toFixed(2)}` : 'OK') : '-'}
                                                        </td>
                                                    </tr>
                                                    {/* Expanded Payments Breakdown */}
                                                    {expandedPaymentMethod === m && (
                                                        <tr>
                                                            <td colSpan="4" className="p-0 bg-gray-50 border-t border-gray-100">
                                                                <div className="p-4 max-h-48 overflow-y-auto">
                                                                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                                                                        <Receipt size={14} /> Transacciones en {m}
                                                                    </h4>
                                                                    {sessionData.payments?.filter(p => (p.method || 'efectivo').toLowerCase() === m).length > 0 ? (
                                                                        <ul className="space-y-2">
                                                                            {sessionData.payments.filter(p => (p.method || 'efectivo').toLowerCase() === m).map(p => (
                                                                                <li key={p.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-gray-100 shadow-sm">
                                                                                    <span className="font-semibold text-gray-700">
                                                                                        Mesa {p.Account?.Table?.number || 'Caja/Llevar'}
                                                                                        {p.User && (
                                                                                            <span className="text-[10px] text-gray-400 font-normal ml-1.5">
                                                                                                ({p.User.displayName || p.User.username})
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                    <span className="font-mono font-bold text-gray-600">S/ {parseFloat(p.amount).toFixed(2)}</span>
                                                                                    <span className="text-gray-400">{new Date(p.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <div className="text-xs text-gray-400 italic">No hay transacciones reportadas.</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* MOBILE VIEW: Responsive list of payment methods instead of squished table */}
                            <div className="md:hidden space-y-3">
                                {['efectivo', 'tarjeta', 'yape', 'transferencia'].map(m => {
                                    const expected = sessionData.expected[m] || 0;
                                    const countedStr = countedValues[m];
                                    const counted = parseFloat(countedStr) || 0;
                                    let diff = countedStr !== '' ? counted - expected : 0;
                                    if (Math.abs(diff) < 0.01) diff = 0;
                                    
                                    return (
                                        <div key={m} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                            {/* Header of Payment Card */}
                                            <div className="flex justify-between items-center">
                                                <button
                                                    onClick={() => setExpandedPaymentMethod(expandedPaymentMethod === m ? null : m)}
                                                    className="font-bold text-gray-800 text-sm flex items-center gap-1.5 hover:text-blue-600 transition-colors select-none"
                                                >
                                                    {expandedPaymentMethod === m ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                    {displayNames[m]}
                                                </button>
                                                <span className="text-xs text-gray-500 font-medium">
                                                    Esperado: <span className="font-bold text-gray-700 font-mono">S/ {expected.toFixed(2)}</span>
                                                </span>
                                            </div>
                                            
                                            {/* Input + Difference row */}
                                            <div className="grid grid-cols-2 gap-3 items-center">
                                                <div>
                                                    <label className="block text-[9px] uppercase font-extrabold text-gray-400 mb-1">Monto Contado</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">S/</span>
                                                        <input 
                                                            type="number"
                                                            value={countedValues[m]}
                                                            onChange={e => setCountedValues({...countedValues, [m]: e.target.value})}
                                                            onWheel={(e) => e.target.blur()}
                                                            className="w-full pl-7 pr-3 py-2 border rounded-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs text-right bg-gray-50/50"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-[9px] uppercase font-extrabold text-gray-400 mb-1">Diferencia</span>
                                                    <span className={`text-xs font-bold font-mono ${countedStr === '' ? 'text-gray-300' : diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-blue-500'}`}>
                                                        {countedStr !== '' ? (diff !== 0 ? (diff < 0 ? `- S/ ${Math.abs(diff).toFixed(2)}` : `+ S/ ${diff.toFixed(2)}`) : '✓ OK') : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Expanded Transactions for Mobile */}
                                            {expandedPaymentMethod === m && (
                                                <div className="p-3 bg-gray-50 border-t border-gray-100 rounded-lg max-h-40 overflow-y-auto mt-2">
                                                    <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                                        <Receipt size={12} /> Transacciones
                                                    </h4>
                                                    {sessionData.payments?.filter(p => (p.method || 'efectivo').toLowerCase() === m).length > 0 ? (
                                                        <ul className="space-y-1.5">
                                                            {sessionData.payments.filter(p => (p.method || 'efectivo').toLowerCase() === m).map(p => (
                                                                <li key={p.id} className="flex justify-between items-center text-[10px] bg-white p-2 rounded border border-gray-100 shadow-sm">
                                                                    <span className="font-semibold text-gray-700">
                                                                        Mesa {p.Account?.Table?.number || 'Caja/Llevar'}
                                                                        {p.User && (
                                                                            <span className="text-[9px] text-gray-400 font-normal ml-1.5">
                                                                                ({p.User.displayName || p.User.username})
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className="font-mono font-bold text-gray-600">S/ {parseFloat(p.amount).toFixed(2)}</span>
                                                                    <span className="text-gray-400">{new Date(p.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div className="text-[10px] text-gray-400 italic">No hay transacciones.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                             {/* Movimientos de Caja Section */}
                             <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm space-y-3">
                                 <div className="bg-gray-50 px-4 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                     <div className="flex items-center gap-2">
                                         <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                             <Receipt size={16} className="text-gray-500" />
                                             Movimientos
                                         </h3>
                                         <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                             {movements.length}
                                         </span>
                                     </div>
                                     <div className="flex flex-wrap gap-1">
                                         {['todos', 'efectivo', 'tarjeta', 'yape', 'transferencia'].map(method => {
                                             const count = method === 'todos' 
                                                 ? allMovements.length 
                                                 : allMovements.filter(mov => mov.method === method).length;
                                             
                                             const isPillSelected = selectedMethodFilter === method;
                                             return (
                                                 <button
                                                     key={method}
                                                     type="button"
                                                     onClick={() => setSelectedMethodFilter(method)}
                                                     className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize transition-all active:scale-95 ${
                                                         isPillSelected
                                                             ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                             : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                     }`}
                                                 >
                                                     {method === 'todos' ? 'Todos' : method} ({count})
                                                 </button>
                                             );
                                         })}
                                     </div>
                                     <button 
                                         onClick={() => setShowExpenseModal(true)}
                                         className="text-[11px] bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                     >
                                         + Registrar Egreso
                                     </button>
                                 </div>
                                 
                                 <div className="p-2 max-h-60 overflow-y-auto no-scrollbar">
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
                                                                 <div className="font-semibold text-gray-700 max-w-[120px] truncate" title={m.reference}>
                                                                     {m.reference}
                                                                 </div>
                                                                 <div className="text-[10px] text-gray-400 capitalize">
                                                                     {m.type === 'ingreso' ? 'Ingreso' : 'Egreso/Gasto'}
                                                                 </div>
                                                             </td>
                                                             <td className="p-2 text-gray-500 font-medium truncate max-w-[80px]" title={m.user}>
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

                             {/* Sales Summary Categories */}
                            {sessionData.salesSummary && (
                                <div className="space-y-3">
                                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <List size={16} /> Resumen de Ventas
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
                                        {Object.entries(sessionData.salesSummary)
                                            .filter(([catKey, catData]) => catKey !== 'otros' || catData.count > 0)
                                            .map(([catKey, catData]) => (
                                            <div 
                                                key={catKey} 
                                                className={`bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col transition-all duration-200 ${
                                                    expandedCategory === catKey ? 'col-span-2 md:col-span-4' : ''
                                                }`}
                                            >
                                                <div 
                                                    className="p-3 cursor-pointer hover:bg-gray-50 flex flex-col items-center text-center transition-colors relative"
                                                    onClick={() => setExpandedCategory(expandedCategory === catKey ? null : catKey)}
                                                >
                                                    <span className="uppercase text-[10px] font-bold text-gray-400 tracking-wider mb-1">
                                                        {catKey === 'menus' ? 'Menús' : 
                                                         catKey === 'platos' ? 'Platos' : 
                                                         catKey === 'bebidas' ? 'Bebidas' : 
                                                         catKey}
                                                    </span>
                                                    <span className="text-lg font-bold text-gray-800">{catData.count} <span className="text-[10px] text-gray-400 font-normal">unid.</span></span>
                                                    <span className="text-sm font-bold text-blue-600 mt-1">S/ {catData.total.toFixed(2)}</span>
                                                    <div className="absolute top-2 right-2 text-gray-300">
                                                        {expandedCategory === catKey ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} />}
                                                    </div>
                                                </div>
                                                
                                                {/* Expanded Category Items */}
                                                {expandedCategory === catKey && (
                                                    <div 
                                                        className="bg-gray-50 p-3 border-t border-gray-100 max-h-[40vh] overflow-y-auto touch-pan-y"
                                                        style={{ WebkitOverflowScrolling: 'touch' }}
                                                    >
                                                        {catData.items.length > 0 ? (
                                                            <ul className="space-y-2">
                                                                {catData.items.map((item, idx) => (
                                                                    <li key={idx} className="flex justify-between items-start text-[11px] border-b border-gray-200/50 pb-2 last:border-0 last:pb-0">
                                                                        <div className="flex flex-col flex-1 pr-2">
                                                                            <span className="font-semibold text-gray-700 leading-tight">{item.name}</span>
                                                                            {item.presentation && <span className="text-[9px] text-gray-500">{item.presentation}</span>}
                                                                        </div>
                                                                        <div className="flex flex-col items-end shrink-0">
                                                                            <span className="font-bold text-gray-500">{item.quantity} x S/ {item.price.toFixed(2)}</span>
                                                                            <span className="font-mono font-bold text-gray-800">S/ {item.total.toFixed(2)}</span>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <div className="text-[10px] text-gray-400 italic text-center py-2">Sin ventas</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas de Cierre <span className="text-red-500">*</span></label>
                                <textarea 
                                    value={closingNotes}
                                    onChange={e => setClosingNotes(e.target.value)}
                                    className="w-full border-2 border-gray-100 rounded-xl p-4 text-sm focus:border-red-500 outline-none transition-all resize-none"
                                    placeholder="Describa cualquier descuadre o detalle del turno..."
                                    rows={3}
                                />
                            </div>

                             <button 
                                 onClick={handleRequestCloseSession}
                                 className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-red-200 transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200"
                             >
                                 <Lock size={20} /> Confirmar Cierre de Turno y Caja
                             </button>
                             <button 
                                 onClick={() => setShowExpenseModal(true)}
                                 className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-amber-200 transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200"
                             >
                                 <MinusCircle size={20} /> Registrar Egreso / Gasto
                             </button>
                        </div>
                    )}
                </div>
            {/* EXPENSE MODAL */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Registrar Egreso / Gasto</h3>
                            <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:bg-gray-200 p-1.5 rounded-lg"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleAddExpense} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Monto (S/)</label>
                                <input 
                                    type="number" step="0.01" required 
                                    value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-lg font-bold focus:border-blue-500 outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Concepto / Motivo</label>
                                <input 
                                    type="text" required 
                                    value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm"
                                    placeholder="Ej. Compra de hielo, Pago proveedor..."
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Categoría</label>
                                    <select 
                                        value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 outline-none text-sm bg-white"
                                    >
                                        <option>Insumos</option>
                                        <option>Personal</option>
                                        <option>Servicios</option>
                                        <option>Movilidad</option>
                                        <option>Otros</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl mt-2 transition-colors">
                                Guardar Egreso
                            </button>
                        </form>
                    </div>
                </div>
            )}
                
                {/* Footer info */}
                <div className="bg-gray-50 p-3 border-t border-gray-100 text-[9px] text-gray-400 text-center uppercase tracking-widest font-bold shrink-0">
                    Sistema de Gestión Mak Suites - Control de Auditoría
                </div>
            </div>

            {/* CONFIRMATION CLOSE MODAL */}
            {showConfirmCloseModal && (() => {
                    let diffEfectivo = (parseFloat(countedValues.efectivo) || 0) - (sessionData.expected.efectivo || 0);
                    if (Math.abs(diffEfectivo) < 0.01) diffEfectivo = 0;
                    let diffTarjeta = (parseFloat(countedValues.tarjeta) || 0) - (sessionData.expected.tarjeta || 0);
                    if (Math.abs(diffTarjeta) < 0.01) diffTarjeta = 0;
                    let diffYape = (parseFloat(countedValues.yape) || 0) - (sessionData.expected.yape || 0);
                    if (Math.abs(diffYape) < 0.01) diffYape = 0;
                    let diffTransferencia = (parseFloat(countedValues.transferencia) || 0) - (sessionData.expected.transferencia || 0);
                    if (Math.abs(diffTransferencia) < 0.01) diffTransferencia = 0;
                    
                    const hasDifferences = diffEfectivo !== 0 || diffTarjeta !== 0 || diffYape !== 0 || diffTransferencia !== 0;
                    
                    return (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                                {/* Alert Banner based on differences */}
                                {hasDifferences ? (
                                    <div className="bg-red-50 border-b border-red-100 p-6 flex flex-col items-center text-center">
                                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                                            <AlertCircle size={28} />
                                        </div>
                                        <h3 className="text-lg font-extrabold text-red-900">¡Descuadre en Caja Detectado!</h3>
                                        <p className="text-xs text-red-700 mt-2">
                                            Se han encontrado diferencias entre los montos esperados por el sistema y los montos físicos contados.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 border-b border-green-100 p-6 flex flex-col items-center text-center">
                                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                                            <CheckCircle size={28} />
                                        </div>
                                        <h3 className="text-lg font-extrabold text-green-900">¡Caja Cuadrada Correctamente!</h3>
                                        <p className="text-xs text-green-700 mt-2">
                                            Los montos contados coinciden perfectamente con los montos esperados en el sistema.
                                        </p>
                                    </div>
                                )}

                                {/* Details Table */}
                                <div className="p-6 space-y-4">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalles de Cuadre:</h4>
                                    <div className="divide-y divide-gray-100 text-xs">
                                        {['efectivo', 'tarjeta', 'yape', 'transferencia'].map(m => {
                                            const expected = sessionData.expected[m] || 0;
                                            const counted = parseFloat(countedValues[m]) || 0;
                                            let diff = counted - expected;
                                            if (Math.abs(diff) < 0.01) diff = 0;
                                            
                                            return (
                                                <div key={m} className="py-2 flex justify-between items-center">
                                                    <span className="font-semibold text-gray-700 capitalize">{displayNames[m]}</span>
                                                    <div className="flex gap-4 font-mono">
                                                        <span className="text-gray-400">Esp: S/ {expected.toFixed(2)}</span>
                                                        <span className="text-gray-600 font-bold">Cont: S/ {counted.toFixed(2)}</span>
                                                        {diff !== 0 ? (
                                                            <span className={`font-bold ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                {diff < 0 ? '-' : '+'}S/ {Math.abs(diff).toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-green-600 font-bold">OK</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <p className="text-gray-500 text-[11px] leading-relaxed italic text-center mt-2">
                                        ¿Está seguro de que desea proceder con el cierre del turno? Esta acción no se puede deshacer.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setShowConfirmCloseModal(false)}
                                        className="flex-1 bg-white hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl border transition-all text-xs"
                                    >
                                        Cancelar y Revisar
                                    </button>
                                    <button
                                        onClick={handleConfirmCloseSession}
                                        className={`flex-1 text-white font-bold py-3 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-1 ${
                                            hasDifferences 
                                                ? 'bg-red-600 hover:bg-red-700 hover:shadow-red-100' 
                                                : 'bg-green-600 hover:bg-green-700 hover:shadow-green-100'
                                        }`}
                                    >
                                        <Lock size={14} /> Confirmar Cierre
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
        </div>,
        document.body
    );
}

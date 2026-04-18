import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Search, Calendar, Filter, ChevronDown, ChevronRight, CheckCircle, FileText, Download, X, DollarSign, TrendingUp, TrendingDown, Receipt, Plus, ArrowUpRight, ArrowDownLeft, Trash2 } from 'lucide-react';
import AccountDetailsModal from '../components/AccountDetailsModal';
import { formatTableName } from '../utils/tableUtils';

export default function ReportesView() {
    const { socket, user } = useRestaurant();
    // STATE
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const getLocalDate = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        return new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
    };

    const [dateRange, setDateRange] = useState({
        startDate: getLocalDate(),
        endDate: getLocalDate()
    });
    const [activeTab, setActiveTab] = useState('transactions'); // transactions, active
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // EXPENSE MODAL
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', paymentMethod: 'efectivo', category: 'otros' });



    // EFFECT
    useEffect(() => {
        fetchReport();
    }, [dateRange]);

    // Real-time Listener for Cash updates
    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => {
            console.log("[ReportesView] Cash update received");
            fetchReport();
        };

        socket.on('new_order', handleUpdate);
        socket.on('order_updated', handleUpdate);

        return () => {
            socket.off('new_order', handleUpdate);
            socket.off('order_updated', handleUpdate);
        };
    }, [socket]);

    // ACTIONS
    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/reports/daily?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
            setReport(res.data);
        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExpense = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/expenses', {
                ...expenseForm,
                userId: user?.id || 1
            });
            setShowExpenseModal(false);
            setExpenseForm({ description: '', amount: '', paymentMethod: 'efectivo', category: 'otros' });
            fetchReport(); // Refresh
        } catch (error) {
            const msg = error.response?.data?.error || 'Error creando egreso';
            alert(msg);
        }
    };

    const handleDeleteTransaction = async (t) => {
        if (!window.confirm(`¿Estás seguro de eliminar este ${t.type === 'income' ? 'pago' : 'egreso'}?`)) return;

        try {
            const endpoint = t.type === 'income' ? `/api/payments/${t.id}` : `/api/expenses/${t.id}`;
            await axios.delete(`${endpoint}?userId=${user?.id}`);
            fetchReport();
        } catch (error) {
            alert(error.response?.data?.error || 'Error eliminando movimiento');
        }
    };

    // HELPERS
    const formatCurrency = (val) => `S/ ${Number((parseFloat(val) || 0)).toFixed(2)}`;
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (loading && !report) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando reporte...</div>;
    if (!report) return <div className="p-8 text-center text-red-500">Error cargando datos.</div>;

    // PREPARE TRANSACTIONS LIST (MERGE INCOME & EXPENSES)
    const transactions = [
        ...report.movements.map(p => {
            return {
                id: p.id,
                type: 'income',
                date: p.createdAt,
                amount: p.amount,
                description: `Abono Cuenta #${p.AccountId || '?'}`,
                details: p.Account || {}, // Store full account obj
                paymentDetails: p, // Store specific payment obj
                user: p.User ? (p.User.displayName || p.User.username) : 'Sistema',
                method: p.method
            };
        }),
        ...report.expenses.map(e => ({
            id: e.id,
            type: 'expense',
            date: e.date,
            amount: e.amount,
            description: e.description,
            details: e,
            user: e.User?.displayName || 'Admin',
            method: e.paymentMethod
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort desc

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in">
            {/* FILTERS & HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full md:w-auto bg-white p-3 rounded-xl shadow-sm border flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex flex-col w-full md:w-auto">
                        <span className="text-xs font-bold text-gray-500 uppercase">Desde</span>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="border rounded-lg p-2 text-sm font-medium w-full"
                        />
                    </div>
                    <div className="hidden md:block text-gray-300">|</div>
                    <div className="flex flex-col w-full md:w-auto">
                        <span className="text-xs font-bold text-gray-500 uppercase">Hasta</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="border rounded-lg p-2 text-sm font-medium w-full"
                        />
                    </div>
                </div>

                {user?.role === 'admin' && (
                    <button
                        onClick={() => setShowExpenseModal(true)}
                        className="w-full md:w-auto bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-red-700 transition-colors flex items-center justify-center gap-2 order-last md:order-none"
                    >
                        <ArrowDownLeft size={20} /> Registrar Egreso
                    </button>
                )}
            </div>

            {/* STATS CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* 1. EFECTIVO EN CAJA (REAL) - Now a main card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-emerald-500 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Efectivo en Caja (Real)</div>
                        <div className="text-3xl font-black text-gray-800 tracking-tight">{formatCurrency(report.currentCashBalance)}</div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-emerald-50 rounded-full text-emerald-600 group-hover:scale-110 transition-transform">
                        <DollarSign size={24} strokeWidth={3} />
                    </div>
                </div>

                {/* 2. INGRESOS */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ingresos Totales</div>
                        <div className="text-3xl font-black text-green-600 tracking-tight">{formatCurrency(report.totalSales)}</div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-green-50 rounded-full text-green-500 group-hover:scale-110 transition-transform">
                        <ArrowUpRight size={24} strokeWidth={3} />
                    </div>
                </div>

                {/* 3. EGRESOS */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-500 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Egresos Totales</div>
                        <div className="text-3xl font-black text-red-600 tracking-tight">{formatCurrency(report.totalExpenses)}</div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-red-50 rounded-full text-red-500 group-hover:scale-110 transition-transform">
                        <ArrowDownLeft size={24} strokeWidth={3} />
                    </div>
                </div>

                {/* 4. BALANCE */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Balance Periodo</div>
                        <div className={`text - 3xl font - black tracking - tight ${report.balance >= 0 ? 'text-blue-600' : 'text-red-600'} `}>
                            {formatCurrency(report.balance)}
                        </div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-blue-50 rounded-full text-blue-500 group-hover:scale-110 transition-transform">
                        <TrendingUp size={24} strokeWidth={3} />
                    </div>
                </div>
            </div>


            {/* TRANSACTIONS TABLE */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold border-b">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Concepto</th>
                                <th className="px-6 py-4">Reserva/Mesa</th>
                                <th className="px-6 py-4">Monto</th>
                                <th className="px-6 py-4">Método</th>
                                <th className="px-6 py-4">Descripción</th>
                                {user?.role === 'admin' && <th className="px-6 py-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {transactions.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-400">No hay movimientos en este periodo.</td></tr>
                            ) : (
                                transactions.map(t => (
                                    <tr key={`${t.type} -${t.id} `} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.date)}</td>
                                        <td className="px-6 py-4 font-medium text-gray-700">{t.user}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px - 2 py - 1 rounded text - xs font - bold ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} `}>
                                                {t.type === 'income' ? 'Venta' : 'Egreso'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {t.type === 'income' ? (
                                                <button onClick={() => setSelectedTransaction(t)} className="text-blue-600 hover:underline font-bold">
                                                    #{t.details?.id || t.id} <span className="text-xs font-normal text-gray-500 block">{formatTableName(t.details?.Table || { number: t.details?.TableId })}</span>
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className={`px - 6 py - 4 font - bold ${t.type === 'income' ? 'text-gray-800' : 'text-red-600'} `}>
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 capitalize">{t.method}</td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={t.description}>
                                            {t.type === 'income' ? `${t.description} - ${t.details?.customerName || 'Cliente'} ` : t.description}
                                        </td>
                                        {user?.role === 'admin' && (
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteTransaction(t)}
                                                    className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Eliminar movimiento"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* EXPENSE MODAL */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Registrar Egreso</h3>
                            <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateExpense} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
                                <input
                                    required
                                    className="w-full border rounded p-2"
                                    placeholder="Ej: Compra de agua"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Monto (S/)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        className="w-full border rounded p-2"
                                        placeholder="0.00"
                                        value={expenseForm.amount}
                                        onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Método</label>
                                    <select
                                        className="w-full border rounded p-2"
                                        value={expenseForm.paymentMethod}
                                        onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="yape">Yape</option>
                                        <option value="transferencia">Transferencia</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                                <select
                                    className="w-full border rounded p-2"
                                    value={expenseForm.category}
                                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                >
                                    <option value="otros">Otros</option>
                                    <option value="proveedores">Proveedores</option>
                                    <option value="servicios">Servicios</option>
                                    <option value="personal">Personal</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 shadow-lg mt-2">
                                Registrar Egreso
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TRANSACTION DETAIL MODAL (Previously Account Summary) */}
            {selectedTransaction && selectedTransaction.type === 'income' && (
                <AccountDetailsModal
                    account={selectedTransaction.details}
                    onClose={() => setSelectedTransaction(null)}
                    title="Detalle de Reserva"
                    subtitle={`#${selectedTransaction.details?.id || selectedTransaction.id} - ${formatTableName(selectedTransaction.details?.Table || { number: selectedTransaction.details?.TableId })}`}
                    currentPaymentId={selectedTransaction.paymentDetails?.id}
                />
            )}

            {/* FULL SCREEN IMAGE PREVIEW */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-in fade-in">
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors p-4 rounded-full bg-black/50"
                    >
                        <X size={48} />
                    </button>
                    <img
                        src={previewImage}
                        alt="Previsualización Ampliada"
                        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}

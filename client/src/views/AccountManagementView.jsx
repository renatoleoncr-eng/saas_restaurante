import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Calendar, FileText, ChevronRight, Edit2, Trash2, CreditCard, CheckCircle, X, Loader2 } from 'lucide-react';
import TableControl from '../components/TableControl';
import { useRestaurant } from '../contexts/RestaurantContext';
import AccountDetailsModal from '../components/AccountDetailsModal';
import { formatTableName } from '../utils/tableUtils';
import SessionsHistoryTab from '../components/SessionsHistoryTab';

export default function AccountManagementView() {
    const { user } = useRestaurant();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('cuentas'); // 'cuentas' | 'turnos'

    // Local timezone aware date string (YYYY-MM-DD)
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    const localDateStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    // Filters
    const [startDate, setStartDate] = useState(localDateStr);
    const [statusFilter, setStatusFilter] = useState(() => {
        return localStorage.getItem('account_statusFilter') || 'open';
    }); // 'all', 'open', 'closed'
    const [searchTerm, setSearchTerm] = useState('');

    // Table Control Modal
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [viewingHistoryAccount, setViewingHistoryAccount] = useState(null);

    // Edit Name Modal
    const [editingAccount, setEditingAccount] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDni, setEditDni] = useState('');
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    const searchClientData = async () => {
        const doc = editDni.trim();
        if (doc.length !== 8 && doc.length !== 11) {
            alert('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');
            return;
        }
        setIsSearchingClient(true);
        try {
            const res = await axios.get(`/api/billing/consulta?doc=${doc}`);
            if (res.data) {
                let fullName = '';
                if (doc.length === 11) {
                    fullName = res.data.razon_social || res.data.razonSocial || '';
                } else {
                    fullName = `${res.data.nombres || ''} ${res.data.apellidoPaterno || ''} ${res.data.apellidoMaterno || ''}`.trim();
                    if (!fullName) fullName = res.data.nombre || res.data.nombreCompleto || '';
                }
                if (fullName) {
                    setEditName(fullName);
                } else {
                    alert('No se encontró el nombre para este documento.');
                }
            }
        } catch (err) {
            alert(err.response?.data?.error || 'No se encontró información para este documento.');
        } finally {
            setIsSearchingClient(false);
        }
    };

    // Partial Payment Modal
    const [payAccount, setPayAccount] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('efectivo');
    const [payFiles, setPayFiles] = useState([]);
    const [isPaying, setIsPaying] = useState(false);

    // View Payments Modal
    const [viewPaymentsAccount, setViewPaymentsAccount] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const openPayModal = (acc) => {
        setPayAccount(acc);
        setPayAmount(acc.deuda || 0);
        setPayMethod('efectivo');
        setPayFiles([]);
    };

    const handlePartialPayment = async () => {
        // ... (existing payment logic)
        if (!payAccount || !payAmount || isNaN(payAmount) || Number(payAmount) <= 0) {
            alert("Ingrese un monto válido mayor a 0.");
            return;
        }
        setIsPaying(true);
        try {
            const formData = new FormData();
            formData.append('amount', payAmount);
            formData.append('paymentMethod', payMethod);
            if (user?.id) formData.append('userId', user.id);
            payFiles.forEach(file => {
                formData.append('evidence', file);
            });

            await axios.post(`/api/accounts/${payAccount.id}/pay`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setPayAccount(null);
            loadAccounts();
        } catch (error) {
            console.error("Error sending partial payment", error);
            alert(error.response?.data?.error || "Error al registrar el abono");
        } finally {
            setIsPaying(false);
        }
    };

    const handleViewHistory = async (id) => {
        try {
            const res = await axios.get(`/api/accounts/specific/${id}?t=${Date.now()}`);
            setViewingHistoryAccount(res.data);
        } catch (err) {
            console.error("Error fetching history account:", err);
            alert("Error al cargar el detalle de la cuenta.");
        }
    };

    useEffect(() => {
        loadAccounts();
    }, [startDate, statusFilter]);

    useEffect(() => {
        localStorage.setItem('account_statusFilter', statusFilter);
    }, [statusFilter]);

    // Handle search debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadAccounts();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/accounts/all', {
                params: {
                    startDate,
                    status: statusFilter,
                    search: searchTerm,
                    _t: new Date().getTime()
                }
            });
            const filteredAccounts = res.data.filter(acc => acc.status !== 'cancelled');
            setAccounts(filteredAccounts);
        } catch (error) {
            console.error("Error loading accounts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (account) => {
        if (!window.confirm(`¿Estás seguro de eliminar la cuenta #${account.id}?\nEsta acción eliminará pedidos y pagos asociados.`)) {
            return;
        }
        try {
            await axios.delete(`/api/accounts/${account.id}`);
            loadAccounts();
        } catch (error) {
            console.error("Error deleting account:", error);
            alert("Error al eliminar cuenta.");
        }
    };

    const handleEditSave = async () => {
        if (!editingAccount) return;
        try {
            await axios.put(`/api/accounts/${editingAccount.id}`, {
                customerName: editName,
                clientDni: editDni
            });
            setEditingAccount(null);
            loadAccounts();
        } catch (error) {
            console.error("Error updating customer name", error);
            alert("Hubo un problema actualizando el nombre del cliente.");
        }
    };

    const openEditModal = (acc) => {
        setEditingAccount(acc);
        setEditName(acc.customerName || '');
        setEditDni(acc.clientDni || '');
    };

    if (user.role !== 'admin' && user.role !== 'waiter') {
        return <div className="p-8 text-center text-gray-500">Acceso Denegado. Solo personal autorizado pueden ver esta sección.</div>;
    }

    const isAdmin = user.role === 'admin';

    return (
        <div className="p-6 flex flex-col bg-gray-50">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Historial de Cuentas</h2>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar # Cuenta o Cliente..."
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-500 font-medium">Desde:</span>
                        <input
                            type="date"
                            className="outline-none text-sm text-gray-700 bg-transparent"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    {/* Status */}
                    <select
                        className="bg-white border rounded-lg px-3 py-2 outline-none text-sm text-gray-700"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todas las Cuentas</option>
                        <option value="open">Abiertas</option>
                        <option value="closed">Completadas</option>
                    </select>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-6 border-b mb-6 px-2">
                <button 
                    onClick={() => setActiveTab('cuentas')}
                    className={`pb-3 font-bold transition-colors relative ${activeTab === 'cuentas' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    Cuentas de Mesa
                    {activeTab === 'cuentas' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                </button>
                <button 
                    onClick={() => setActiveTab('turnos')}
                    className={`pb-3 font-bold transition-colors relative flex items-center gap-2 ${activeTab === 'turnos' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    <FileText size={16} />
                    Cierres de Turno
                    {activeTab === 'turnos' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                </button>
            </div>

            {/* CONTENT */}
            {activeTab === 'turnos' ? (
                <div className="flex-1 min-h-[400px]">
                    <SessionsHistoryTab />
                </div>
            ) : (
                /* Table (Cuentas) */
                <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
                    <div className="flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-bold text-gray-600 text-sm">Cuenta #</th>
                                <th className="p-4 font-bold text-gray-600 text-sm">Estado</th>
                                <th className="p-4 font-bold text-gray-600 text-sm">Mesa</th>
                                <th className="p-4 font-bold text-gray-600 text-sm">Fecha</th>
                                <th className="p-4 font-bold text-gray-600 text-sm text-right">Debe</th>
                                <th className="p-4 font-bold text-gray-600 text-sm text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center p-8 text-gray-500">Cargando cuentas...</td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center p-8 text-gray-500">No se encontraron cuentas.</td>
                                </tr>
                            ) : (
                                accounts.map((acc) => {
                                    const isComplete = acc.status === 'closed';
                                    return (
                                        <tr key={acc.id} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono font-medium text-gray-700">{acc.id}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    {acc.status === 'cancelled' ? (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                            Cancelada
                                                        </span>
                                                    ) : (
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isComplete ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                                            {isComplete ? 'Completada' : 'Abierta'}
                                                        </span>
                                                    )}
                                                    {acc.accountType === 'staff' && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                                                            STAFF
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-800">{acc.Table ? formatTableName(acc.Table) : `Mesa #${acc.TableId}`}</td>
                                            <td className="p-4 text-gray-500 text-sm">
                                                {new Date(acc.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`font-bold ${acc.deuda > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                    S/ {Number(acc.deuda).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* View / Pay Button - Opens TableControl */}
                                                    {(acc.TableId || isComplete || acc.status === 'cancelled') && (
                                                        <button
                                                            onClick={() => {
                                                                if (isComplete || acc.status === 'cancelled') {
                                                                    handleViewHistory(acc.id);
                                                                } else {
                                                                    setSelectedTableId(acc.TableId);
                                                                }
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            title={(isComplete || acc.status === 'cancelled') ? "Ver Detalles" : "Ver Pedidos"}
                                                        >
                                                            <FileText size={16} />
                                                            {(isComplete || acc.status === 'cancelled') ? "Ver" : "Pedidos"}
                                                        </button>
                                                    )}



                                                    {/* Pay Partial Button */}
                                                    {!isComplete && acc.status !== 'cancelled' && acc.accountType !== 'staff' && isAdmin && (
                                                        <button
                                                            onClick={() => openPayModal(acc)}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-bold bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                            title="Abonar Pago"
                                                        >
                                                            <CreditCard size={16} /> Abonar
                                                        </button>
                                                    )}



                                                    {/* Delete */}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDelete(acc)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="Eliminar Cuenta"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Modals */}
            {selectedTableId && (
                <TableControl
                    tableId={selectedTableId}
                    onClose={() => { setSelectedTableId(null); loadAccounts(); }}
                />
            )}



            {editingAccount && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Editar Cliente</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">DNI / RUC</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editDni}
                                        onChange={(e) => setEditDni(e.target.value)}
                                        placeholder="Ingrese DNI o RUC"
                                        onKeyDown={(e) => { if (e.key === 'Enter') searchClientData() }}
                                        autoFocus
                                    />
                                    <button 
                                        onClick={searchClientData} 
                                        disabled={isSearchingClient} 
                                        className="bg-gray-100 p-3 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center min-w-[48px]"
                                        title="Buscar datos"
                                    >
                                        {isSearchingClient ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <Search size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Cliente / Razón Social</label>
                                <input
                                    type="text"
                                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setEditingAccount(null)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">Cancelar</button>
                            <button onClick={handleEditSave} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PARTIAL PAYMENT MODAL */}
            {payAccount && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Registrar Abono</h2>

                        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-col items-center justify-center border border-blue-100">
                            <div className="text-sm text-gray-500">Saldo Pendiente</div>
                            <div className="text-3xl font-bold text-blue-600">S/ {Number(payAccount.deuda || 0).toFixed(2)}</div>
                            <div className="mt-1 text-xs text-gray-400">Total: S/ {Number(payAccount.total || 0).toFixed(2)}</div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Monto a Abonar (S/)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Método de Pago:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['efectivo', 'yape', 'tarjeta', 'transferencia'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPayMethod(method)}
                                            className={`p-2 rounded-lg text-sm border flex justify-center items-center transition-all ${payMethod === method ? 'border-green-500 bg-green-50 text-green-700 cursor-default font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="capitalize">{method}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* EVIDENCE UPLOAD */}
                            {payMethod !== 'efectivo' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Subir Comprobante (Opcional):
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => setPayFiles(Array.from(e.target.files))}
                                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {payFiles.length > 0 && (
                                        <div className="text-xs text-green-600 mt-2 flex flex-col gap-1 max-h-20 overflow-y-auto">
                                            <span className="font-bold text-gray-700 mb-1">Archivos seleccionados:</span>
                                            {payFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <CheckCircle size={10} /> {file.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setPayAccount(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200"
                                disabled={isPaying}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePartialPayment}
                                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold shadow-md hover:bg-green-700 disabled:opacity-50"
                                disabled={isPaying}
                            >
                                {isPaying ? "Abonando..." : "Confirmar Abono"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSACTION DETAIL MODAL */}
            {viewingHistoryAccount && (
                <AccountDetailsModal
                    account={viewingHistoryAccount}
                    onClose={() => setViewingHistoryAccount(null)}
                />
            )}

            {/* FULL SCREEN IMAGE PREVIEW */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
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

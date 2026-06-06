import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Calendar, FileText, ChevronRight, Edit2, Trash2, CreditCard, CheckCircle, X, Loader2, Camera, Image } from 'lucide-react';
import TableControl from '../components/TableControl';
import { useRestaurant } from '../contexts/RestaurantContext';
import AccountDetailsModal from '../components/AccountDetailsModal';
import { formatTableName } from '../utils/tableUtils';
import SessionsHistoryTab from '../components/SessionsHistoryTab';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

const WhatsAppIcon = ({ size = 16, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
    </svg>
);

export default function AccountManagementView() {
    const { user, socket } = useRestaurant();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('cuentas'); // 'cuentas' | 'turnos'

    // Local timezone aware date string (YYYY-MM-DD) with 7 AM business day logic
    const todayLocal = new Date();
    if (todayLocal.getHours() < 7) {
        todayLocal.setDate(todayLocal.getDate() - 1);
    }
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
    const [tableControlShowCart, setTableControlShowCart] = useState(false);
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
    const handlePayFileChange = (e) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setPayFiles(prev => [...prev, ...files]);
        }
    };
    const [isPaying, setIsPaying] = useState(false);

    // Invoice emission states for abono
    const [billingConfig, setBillingConfig] = useState(null);
    const [issueInvoice, setIssueInvoice] = useState(false);
    const [invoiceType, setInvoiceType] = useState('boleta');
    const [invoiceClientDoc, setInvoiceClientDoc] = useState('');
    const [invoiceClientName, setInvoiceClientName] = useState('');
    const [invoiceClientDir, setInvoiceClientDir] = useState('');
    const [isSearchingInvoiceClient, setIsSearchingInvoiceClient] = useState(false);
    const [invoiceResult, setInvoiceResult] = useState(null); // { success, pdf, error }

    // Load billing config on mount
    useEffect(() => {
        axios.get('/api/billing/config').then(r => setBillingConfig(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (!socket) return;
        if (payAccount) {
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        } else {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        }

        return () => {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        };
    }, [socket, payAccount]);

    // View Payments Modal
    const [viewPaymentsAccount, setViewPaymentsAccount] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    useModalBackHandler(!!editingAccount, () => setEditingAccount(null));
    useModalBackHandler(!!payAccount, () => setPayAccount(null));
    useModalBackHandler(!!previewImage, () => setPreviewImage(null));
    useModalBackHandler(!!viewPaymentsAccount, () => setViewPaymentsAccount(null));
    useModalBackHandler(!!invoiceResult, () => setInvoiceResult(null));

    const openPayModal = (acc) => {
        setPayAccount(acc);
        setPayAmount(acc.deuda || 0);
        setPayMethod('efectivo');
        setPayFiles([]);
        setIssueInvoice(false);
        setInvoiceType('boleta');
        setInvoiceClientDoc('');
        setInvoiceClientName('');
        setInvoiceClientDir('');
        setInvoiceResult(null);
    };

    const searchInvoiceClientData = async () => {
        const doc = invoiceClientDoc.trim();
        if (doc.length !== 8 && doc.length !== 11) {
            alert('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');
            return;
        }
        setIsSearchingInvoiceClient(true);
        try {
            const res = await axios.get(`/api/billing/consulta?doc=${doc}`);
            if (res.data) {
                let fullName = '';
                let dir = '';
                if (doc.length === 11) {
                    fullName = res.data.razon_social || res.data.razonSocial || '';
                    dir = res.data.direccion || res.data.direccion_fiscal || '';
                    setInvoiceType('factura');
                } else {
                    fullName = `${res.data.nombres || ''} ${res.data.apellidoPaterno || ''} ${res.data.apellidoMaterno || ''}`.trim();
                    if (!fullName) fullName = res.data.nombre || res.data.nombreCompleto || '';
                    setInvoiceType('boleta');
                }
                if (fullName) {
                    setInvoiceClientName(fullName);
                    if (dir) setInvoiceClientDir(dir);
                } else {
                    alert('No se encontró el nombre para este documento.');
                }
            }
        } catch (err) {
            alert(err.response?.data?.error || 'No se encontró información para este documento.');
        } finally {
            setIsSearchingInvoiceClient(false);
        }
    };

    // Autocomplete client billing data when issuing electronic invoice
    useEffect(() => {
        if (!issueInvoice) return;
        const doc = (invoiceClientDoc || '').trim();
        const isRucPrefix = ['10', '15', '17', '20'].some(p => doc.startsWith(p));
        if (invoiceType === 'boleta' && doc.length === 8 && !isRucPrefix) {
            searchInvoiceClientData();
        } else if (invoiceType === 'factura' && doc.length === 11) {
            searchInvoiceClientData();
        }
    }, [invoiceClientDoc, invoiceType, issueInvoice]);

    const handlePartialPayment = async () => {
        if (!payAccount || !payAmount || isNaN(payAmount) || Number(payAmount) <= 0) {
            alert("Ingrese un monto válido mayor a 0.");
            return;
        }
        const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(payMethod);
        if (isEvidenceMandatory && payFiles.length === 0) {
            alert("Se requiere subir al menos un comprobante o foto de evidencia.");
            return;
        }
        // Validate invoice fields if issuing
        if (issueInvoice && invoiceType === 'factura') {
            if (!invoiceClientDoc || invoiceClientDoc.trim().length !== 11) {
                alert('Para factura se requiere un RUC de 11 dígitos.');
                return;
            }
            if (!invoiceClientName.trim()) {
                alert('Para factura se requiere la Razón Social.');
                return;
            }
        }
        setIsPaying(true);
        try {
            // Step 1: Register the abono payment
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

            // Step 2: Issue invoice if requested
            if (issueInvoice) {
                try {
                    const invoiceRes = await axios.post('/api/billing/invoices', {
                        tipo: invoiceType,
                        clienteDocumento: invoiceClientDoc.trim() || (invoiceType === 'factura' ? '' : '00000000'),
                        clienteNombre: invoiceClientName.trim() || 'CLIENTES VARIOS',
                        clienteDireccion: invoiceClientDir.trim() || '',
                        items: [{
                            description: `Abono parcial - Cuenta #${payAccount.id}${payAccount.clientName ? ` (${payAccount.clientName})` : ''}`,
                            quantity: 1,
                            amount: Number(payAmount)
                        }],
                        userId: user?.id,
                        accountId: payAccount.id
                    });

                    // Parse PDF URL from sunat response
                    let pdfUrl = null;
                    if (invoiceRes.data?.sunatResponse) {
                        const sr = typeof invoiceRes.data.sunatResponse === 'string'
                            ? JSON.parse(invoiceRes.data.sunatResponse)
                            : invoiceRes.data.sunatResponse;
                        pdfUrl = sr?.url_ticket || sr?.links?.pdf || sr?.pdf || null;
                        if (pdfUrl && (pdfUrl.includes('72.61.57.199') || pdfUrl.includes('maksuites') || pdfUrl.includes('bluzcx'))) {
                            pdfUrl = pdfUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                        }
                    }
                    setInvoiceResult({ success: true, pdf: pdfUrl, invoice: invoiceRes.data?.invoice });
                } catch (invErr) {
                    console.error('Error emitting invoice for abono', invErr);
                    setInvoiceResult({ success: false, error: invErr.response?.data?.error || 'Error al emitir comprobante' });
                }
                // Don't close modal yet — show invoice result
                loadAccounts();
            } else {
                setPayAccount(null);
                loadAccounts();
            }
        } catch (error) {
            console.error("Error sending partial payment", error);
            alert(error.response?.data?.error || "Error al registrar el abono");
        } finally {
            setIsPaying(false);
        }
    };

    const handleShareWhatsappAbono = () => {
        if (!invoiceResult || !invoiceResult.invoice || !invoiceResult.pdf) return;
        const inv = invoiceResult.invoice;
        const url = invoiceResult.pdf;
        const busterUrl = `${url}?v=${Date.now()}`;
        
        const docName = inv.tipo === 'factura' ? 'Factura' : 'Boleta';
        const docId = `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
        
        const userPhone = window.prompt('Ingrese el número de WhatsApp del cliente (ej. 999888777):', invoiceClientDoc.length === 9 ? invoiceClientDoc : '');
        if (userPhone === null) return;
        const cleanPhone = userPhone.replace(/\D/g, '');
        
        const message = `Hola ${invoiceClientName || 'Cliente'}, le adjuntamos su comprobante de abono (${docName} ${docId}): ${busterUrl}`;
        const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('51') ? (cleanPhone.length > 2 ? cleanPhone : '51' + cleanPhone) : '51' + cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
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
            const filteredAccounts = res.data.filter(acc => {
                if (statusFilter === 'all') {
                    return acc.status !== 'cancelled' || parseFloat(acc.totalPaid) > 0;
                }
                return true; // The server already filters by acc.status = statusFilter
            });
            setAccounts(filteredAccounts);
        } catch (error) {
            console.error("Error loading accounts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (account) => {
        if (!window.confirm(`¿Estás seguro de eliminar la cuenta #${account.id}?\nEsta acción eliminará los pedidos asociados. Los pagos registrados en caja NO se eliminarán.`)) {
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

    if (user.role !== 'admin' && user.role !== 'waiter' && user.role !== 'cashier') {
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
                        <option value="cancelled">Canceladas</option>
                    </select>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-6 border-b mb-6 px-2">
                <button 
                    onClick={() => setActiveTab('cuentas')}
                    className={`pb-3 font-bold transition-colors relative ${activeTab === 'cuentas' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    Cuentas
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
                    <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
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
                                            <td className="p-4">
                                                <button 
                                                    onClick={() => {
                                                        if (isComplete || acc.status === 'cancelled') {
                                                            handleViewHistory(acc.id);
                                                        } else if (acc.TableId) {
                                                            setTableControlShowCart(false);
                                                            setSelectedTableId(acc.TableId);
                                                        } else {
                                                            handleViewHistory(acc.id);
                                                        }
                                                    }}
                                                    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none"
                                                    title="Ver detalle de la cuenta"
                                                >
                                                    #{acc.id}
                                                </button>
                                            </td>
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
                                                                } else if (acc.TableId) {
                                                                    setTableControlShowCart(true);
                                                                    setSelectedTableId(acc.TableId);
                                                                } else {
                                                                    handleViewHistory(acc.id);
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
                                                    {(!isComplete || acc.deuda > 0.01) && acc.status !== 'cancelled' && acc.accountType !== 'staff' && (isAdmin || user.role === 'waiter' || user.role === 'cashier') && (
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
                    initialShowCart={tableControlShowCart}
                    onClose={() => { setSelectedTableId(null); setTableControlShowCart(false); loadAccounts(); }}
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
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">

                        {/* INVOICE RESULT SCREEN */}
                        {invoiceResult ? (
                            <div className="text-center space-y-4">
                                {invoiceResult.success ? (
                                    <>
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                            <CheckCircle size={32} className="text-green-600" />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-800">Abono Registrado</h2>
                                        <p className="text-sm text-gray-500">El comprobante fue emitido exitosamente.</p>
                                        {invoiceResult.invoice && (
                                            <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                                                <span className="font-bold">{invoiceResult.invoice.serie}-{invoiceResult.invoice.correlativo}</span>
                                                <span className="ml-2 text-gray-500 capitalize">{invoiceResult.invoice.tipo}</span>
                                            </div>
                                        )}
                                        {invoiceResult.pdf && (
                                            <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                                                <a
                                                    href={invoiceResult.pdf}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex justify-center items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors w-full"
                                                >
                                                    <FileText size={16} /> Ver Comprobante PDF
                                                </a>
                                                <button
                                                    onClick={handleShareWhatsappAbono}
                                                    className="inline-flex justify-center items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors w-full"
                                                >
                                                    <WhatsAppIcon size={16} /> Enviar por WhatsApp
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                                            <CreditCard size={32} className="text-yellow-600" />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-800">Abono Registrado</h2>
                                        <p className="text-sm text-red-500">El abono se registró pero hubo un error al emitir el comprobante:</p>
                                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{invoiceResult.error}</p>
                                    </>
                                )}
                                <button
                                    onClick={() => { setPayAccount(null); setInvoiceResult(null); }}
                                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 mt-4"
                                >
                                    Cerrar
                                </button>
                            </div>
                        ) : (
                            <>
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
                                    {payMethod !== 'efectivo' && (() => {
                                        const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(payMethod);
                                        return (
                                            <div className="animate-in slide-in-from-top-2">
                                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                                    Subir Evidencia {isEvidenceMandatory ? '(Obligatorio)' : '(Opcional)'}:
                                                </label>
                                                
                                                <div className="flex gap-2 mb-3">
                                                    {/* Gallery button (Mobile only) */}
                                                    <label
                                                        htmlFor="pay-evidence-gallery"
                                                        className="md:hidden flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                                                    >
                                                        <Image size={14} /> Galería
                                                    </label>
                                                    <input
                                                        type="file"
                                                        id="pay-evidence-gallery"
                                                        accept="image/*"
                                                        multiple
                                                        disabled={isPaying}
                                                        onChange={handlePayFileChange}
                                                        className="hidden"
                                                    />

                                                    {/* Camera button (Mobile only) */}
                                                    <label
                                                        htmlFor="pay-evidence-camera"
                                                        className="md:hidden flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 active:scale-95 transition-all cursor-pointer"
                                                    >
                                                        <Camera size={14} /> Cámara
                                                    </label>
                                                    <input
                                                        type="file"
                                                        id="pay-evidence-camera"
                                                        accept="image/*"
                                                        capture="environment"
                                                        disabled={isPaying}
                                                        onChange={handlePayFileChange}
                                                        className="hidden"
                                                    />

                                                    {/* File Upload button (Desktop only) */}
                                                    <label
                                                        htmlFor="pay-evidence-desktop"
                                                        className="hidden md:flex w-full items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                                                    >
                                                        <Image size={14} /> Seleccionar Archivo(s)
                                                    </label>
                                                    <input
                                                        type="file"
                                                        id="pay-evidence-desktop"
                                                        accept="image/*"
                                                        multiple
                                                        disabled={isPaying}
                                                        onChange={handlePayFileChange}
                                                        className="hidden"
                                                    />
                                                </div>

                                                {payFiles.length > 0 && (
                                                    <div className="text-xs text-green-600 mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded border border-gray-150">
                                                        <span className="font-bold text-gray-700 mb-1">Archivos seleccionados ({payFiles.length}):</span>
                                                        {payFiles.map((file, idx) => (
                                                            <div key={idx} className="flex items-center justify-between gap-1 text-gray-600 py-0.5 border-b border-gray-100 last:border-0">
                                                                <div className="flex items-center gap-1 truncate">
                                                                    <CheckCircle size={12} className="text-green-500 shrink-0" />
                                                                    <span className="truncate">{file.name}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPayFiles(prev => prev.filter((_, i) => i !== idx))}
                                                                    className="text-red-500 hover:text-red-700 p-0.5"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* ELECTRONIC INVOICE SECTION */}
                                    {billingConfig?.facturacionElectronica && (
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 animate-in fade-in">
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    type="checkbox"
                                                    id="abono_issue_invoice"
                                                    checked={issueInvoice}
                                                    onChange={(e) => setIssueInvoice(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    disabled={isPaying}
                                                />
                                                <label htmlFor="abono_issue_invoice" className="text-sm font-bold text-gray-700 cursor-pointer">
                                                    Emitir Comprobante Electrónico
                                                </label>
                                            </div>

                                            {issueInvoice && (
                                                <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setInvoiceType('boleta')}
                                                            disabled={isPaying}
                                                            className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'boleta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isPaying ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            Boleta
                                                        </button>
                                                        <button
                                                            onClick={() => setInvoiceType('factura')}
                                                            disabled={isPaying}
                                                            className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'factura' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isPaying ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            Factura
                                                        </button>
                                                    </div>
                                                    <div>
                                                         <label className="block text-xs font-bold text-gray-600 mb-1">Documento (DNI/RUC)</label>
                                                         <div className="relative">
                                                             <input
                                                                 type="text"
                                                                 placeholder={invoiceType === 'factura' ? "RUC (11 dígitos)" : "DNI (8 dígitos) u Opcional"}
                                                                 value={invoiceClientDoc}
                                                                 onChange={e => {
                                                                     const val = e.target.value;
                                                                     setInvoiceClientDoc(val);
                                                                     if (val.length === 11) setInvoiceType('factura');
                                                                     else if (val.length === 8 && !['10', '15', '17', '20'].some(p => val.startsWith(p))) setInvoiceType('boleta');
                                                                 }}
                                                                 disabled={isPaying}
                                                                 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white pr-10"
                                                                 onKeyDown={e => e.key === 'Enter' && searchInvoiceClientData()}
                                                             />
                                                             {isSearchingInvoiceClient && (
                                                                 <div className="absolute right-3 top-2.5 text-blue-500">
                                                                     <Loader2 size={16} className="animate-spin" />
                                                                 </div>
                                                             )}
                                                         </div>
                                                     </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 mb-1">{invoiceType === 'factura' ? 'Razón Social' : 'Nombre del Cliente'}</label>
                                                        <input
                                                            type="text"
                                                            placeholder={invoiceType === 'factura' ? "Razón Social" : "Nombre del Cliente"}
                                                            value={invoiceClientName}
                                                            onChange={e => setInvoiceClientName(e.target.value)}
                                                            disabled={isPaying}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                        />
                                                    </div>
                                                    {(invoiceType === 'factura' || (invoiceClientDoc && invoiceClientDoc.trim().length === 11)) && (
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-600 mb-1">Dirección Fiscal</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Dirección Fiscal de la Empresa"
                                                                value={invoiceClientDir}
                                                                onChange={e => setInvoiceClientDir(e.target.value)}
                                                                disabled={isPaying}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(payMethod);
                                    const isPayDisabled = isPaying || (isEvidenceMandatory && payFiles.length === 0);

                                    return (
                                        <>
                                            {isEvidenceMandatory && payFiles.length === 0 && (
                                                <p className="text-xs text-red-500 font-bold mb-2 text-center animate-pulse">
                                                    * Se requiere subir comprobante o foto para continuar.
                                                </p>
                                            )}
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
                                                    className={`flex-1 py-3 text-white rounded-lg font-bold shadow-md transition-colors ${isPayDisabled ? 'bg-gray-400 cursor-not-allowed shadow-none' : issueInvoice ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                                                    disabled={isPayDisabled}
                                                >
                                                    {isPaying ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <Loader2 size={16} className="animate-spin" />
                                                            {issueInvoice ? 'Emitiendo...' : 'Abonando...'}
                                                        </span>
                                                    ) : issueInvoice ? 'Abonar y Emitir' : 'Confirmar Abono'}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </>
                        )}
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

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Loader2, FileText, Receipt, Printer } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import { useRestaurant } from '../contexts/RestaurantContext';
import InvoiceManagementModal from './InvoiceManagementModal';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

const AccountDetailsModal = ({
    account: initialAccount,
    accountId, // Added prop for fetching by ID
    onClose,
    title = "Detalle de Cuenta",
    subtitle = "",
    currentPaymentId = null,
    totalToDisplay = null,
    amountToDisplay = null
}) => {
    useModalBackHandler(true, onClose);

    const { socket, user } = useRestaurant();
    const [account, setAccount] = useState(initialAccount);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    // Handle nested back buttons
    useModalBackHandler(showInvoiceModal, () => setShowInvoiceModal(false));
    useModalBackHandler(!!previewImage, () => setPreviewImage(null));

    useEffect(() => {
        if (socket) {
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        }
        return () => {
            if (socket) {
                socket.emit('set_client_screen_mode', { mode: 'ads' });
            }
        };
    }, [socket]);

    useEffect(() => {
        const id = accountId || (initialAccount && initialAccount.id);
        if (id) {
            fetchAccount(id);
        }
    }, [accountId, initialAccount]);

    const fetchAccount = async (id) => {
        setLoading(true);
        setError(null);
        try {
            // Use the existing endpoint that returns account with orders, payments and invoices
            const response = await axios.get(`/api/accounts/specific/${id}`);
            setAccount(response.data);
        } catch (err) {
            console.error("Error fetching account details:", err);
            setError("No se pudo cargar el detalle de la cuenta.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintPreCuenta = async () => {
        const id = accountId || (account && account.id);
        if (!id) return;
        try {
            const res = await axios.post(`/api/accounts/${id}/print-pre-cuenta`);
            if (res.data.success) {
                alert("Detalle de consumos enviado a la impresora.");
            } else {
                alert("Error al enviar el ticket a la impresora.");
            }
        } catch (err) {
            alert(err.response?.data?.error || "Error al imprimir consumos");
            console.error(err);
        }
    };

    if (loading) {
        return createPortal(
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={48} />
                    <p className="text-gray-600 font-medium">Cargando detalles...</p>
                </div>
            </div>,
            document.body
        );
    }

    if (error) {
        return createPortal(
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-4 text-center">
                    <div className="bg-red-100 text-red-600 p-3 rounded-full">
                        <X size={32} />
                    </div>
                    <p className="text-gray-800 font-bold text-lg">Error</p>
                    <p className="text-gray-600">{error}</p>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors relative z-50 pointer-events-auto"
                    >
                        Cerrar
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    if (!account) return null;

    const originalTotal = account.Orders ? account.Orders.reduce((sum, ord) => {
        const itemPrice = ord.priceAtOrder && !isNaN(ord.priceAtOrder) ? ord.priceAtOrder : (ord.Product?.price || 0);
        return sum + (itemPrice * ord.quantity);
    }, 0) : account.total;

    const actualTotalPaid = account.Payments && account.Payments.length > 0
        ? account.Payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        : Number(account.totalPaid || 0);

    const formatCurrency = (amount) => {
        return `S/ ${Number(amount || 0).toFixed(2)}`;
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 z-[60] flex sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl overflow-hidden flex flex-col">
                {/* HEADER */}
                <div 
                    className="p-4 sm:p-6 border-b flex justify-between items-center bg-white gap-4 sm:!pt-6"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
                >
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg sm:text-xl text-gray-800 truncate">{title}</h3>
                        <div className="text-xs sm:text-sm text-blue-600 font-medium mt-1 truncate">
                            {subtitle || `#${account.id} - ${account.Table ? formatTableName(account.Table) : `Mesa #${account.TableId}`}`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {['admin', 'cashier', 'waiter'].includes(user?.role) && (
                            <button
                                onClick={handlePrintPreCuenta}
                                className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            >
                                <Printer size={16} className="sm:w-[18px] sm:h-[18px]" />
                                <span>Imprimir Consumos</span>
                            </button>
                        )}
                        {account.status === 'closed' && (
                            <button
                                onClick={() => setShowInvoiceModal(true)}
                                className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-colors ${
                                    account.Invoices?.some(i => i.status !== 'anulado') 
                                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
                                }`}
                            >
                                {account.Invoices?.some(i => i.status !== 'anulado') ? (
                                    <><FileText size={16} className="sm:w-[18px] sm:h-[18px]" /> <span>Comprobantes</span></>
                                ) : (
                                    <><Receipt size={16} className="sm:w-[18px] sm:h-[18px]" /> <span>Facturar</span></>
                                )}
                            </button>
                        )}
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }} 
                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors cursor-pointer pointer-events-auto shrink-0 flex items-center justify-center"
                            aria-label="Cerrar"
                        >
                            <X size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {/* CONTENT LIST */}
                <div 
                    className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 bg-white sm:!pb-6"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                >

                    {/* CONSUMOS SECTION */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-500 mb-3">Consumos / Cargos a la Mesa</h4>
                        <div className="space-y-3">
                            {account.Orders && account.Orders.length > 0 ? (
                                account.Orders.map((ord, idx) => {
                                    const isCombo = !ord.ProductId && ord.notes;
                                    const productName = isCombo ? `2x1: ${ord.notes}` : (ord.Product?.name || 'Producto Desconocido');
                                    const displayNotes = isCombo ? null : ord.notes;

                                    return (
                                        <div key={idx} className="bg-orange-50/50 border border-orange-100/50 rounded-lg p-3 sm:p-4 flex justify-between items-start gap-4">
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">Venta Productos</div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    <span className="text-orange-600 font-bold">{ord.quantity}x</span> {productName}
                                                    {ord.presentation && <span className="text-blue-500 font-medium ml-1">({ord.presentation})</span>}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-2">
                                                    {new Date(ord.createdAt || new Date()).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {displayNotes && <span className="italic block mt-1 text-gray-500">Nota: "{displayNotes}"</span>}
                                                </div>
                                            </div>
                                            <div className="font-bold text-orange-600 text-sm whitespace-nowrap">
                                                + {formatCurrency(ord.priceAtOrder && !isNaN(ord.priceAtOrder) ? (ord.priceAtOrder * ord.quantity) : (ord.Product?.price || 0) * ord.quantity)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-sm text-gray-400 italic p-4 bg-gray-50 rounded-lg border">Sin consumos registrados.</div>
                            )}
                        </div>
                    </section>

                    {/* PAGOS SECTION */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-500 mb-3">Pagos Realizados</h4>
                        <div className="space-y-3">
                            {account.Payments && account.Payments.length > 0 ? (
                                account.Payments.map((payment, idx) => {
                                    const isCurrentPayment = currentPaymentId && payment.id === currentPaymentId;
                                    return (
                                        <div key={idx} className={`border rounded-lg p-3 sm:p-4 flex justify-between items-start gap-4 ${isCurrentPayment ? 'bg-green-100/50 border-green-300' : 'bg-green-50/50 border-green-100/50'}`}>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">Pago consumo</div>
                                                <div className="text-xs text-gray-400 mt-2">
                                                    {new Date(payment.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    <span className="capitalize ml-1">- {payment.method}</span>
                                                </div>
                                            </div>
                                            <div className="font-bold text-green-600 text-sm whitespace-nowrap">
                                                - {formatCurrency(payment.amount)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-sm text-gray-400 italic p-4 bg-gray-50 rounded-lg border">Sin pagos registrados.</div>
                            )}
                        </div>
                    </section>

                    {/* RESUMEN SECTION */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-500 mb-3">Resumen de la Cuenta</h4>
                        <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Consumos:</span>
                                <span className={`font-medium ${account.accountType === 'staff' && account.status === 'closed' ? 'line-through decoration-red-500 decoration-2 text-gray-500' : 'text-gray-800'}`}>
                                    {formatCurrency(originalTotal)}
                                </span>
                            </div>
                            {account.accountType === 'staff' && account.status === 'closed' && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Total Final Staff:</span>
                                        <span className="font-medium text-gray-800">
                                            {formatCurrency(account.total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-2 mt-2 border-t border-gray-200">
                                        <span className="text-orange-600 font-bold">Monto Real Pagado:</span>
                                        <span className="font-bold text-gray-800">
                                            {formatCurrency(actualTotalPaid)}
                                        </span>
                                    </div>
                                </>
                            )}
                            {!(account.accountType === 'staff' && account.status === 'closed') && (
                                <div className="flex justify-between text-sm pt-2 mt-2 border-t border-gray-200">
                                    <span className="text-gray-600 font-bold">Total Pagado:</span>
                                    <span className="font-bold text-gray-800">
                                        {formatCurrency(actualTotalPaid)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* COMPROBANTES SECTION */}
                    {account.Invoices && account.Invoices.length > 0 && (
                        <section>
                            <h4 className="text-sm font-bold text-gray-500 mb-3">Comprobantes Emitidos</h4>
                            <div className="space-y-3">
                                {account.Invoices.map((inv, idx) => (
                                    <div key={idx} className="bg-blue-50/50 border border-blue-100/50 rounded-lg p-3 sm:p-4 flex justify-between items-center gap-4">
                                        <div>
                                            <div className="font-bold text-blue-800 text-sm uppercase">
                                                {inv.tipo === 'factura' ? 'Factura' : 'Boleta'} Electrónica
                                            </div>
                                            <div className="text-sm font-mono font-bold text-gray-700 mt-1">
                                                {inv.serie}-{String(inv.correlativo).padStart(6, '0')}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2">
                                                {new Date(inv.emitidoAt || inv.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-blue-700 text-sm">
                                                {formatCurrency(inv.total)}
                                            </div>
                                            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                                {inv.sunatResponse ? 'Aceptado SUNAT' : 'Local'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* EVIDENCIAS SECTION */}
                    {(account.Payments?.some(p => p.evidence) || account.paymentEvidence) && (
                        <section>
                            <h4 className="text-sm font-bold text-gray-500 mb-3">Evidencias Adjuntas</h4>
                            <div className="bg-gray-50 border rounded-lg p-4">
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                    {/* Evidencias de los pagos individuales */}
                                    {account.Payments?.map(payment => {
                                        if (!payment.evidence) return null;
                                        const isCurrentPayment = currentPaymentId && payment.id === currentPaymentId;
                                        try {
                                            const paths = JSON.parse(payment.evidence);
                                            if (Array.isArray(paths)) {
                                                return paths.map((path, i) => (
                                                    <div key={`p-${payment.id}-${i}`} className="relative group aspect-square">
                                                        <img src={path} alt="Comprobante" className={`w-full h-full object-cover rounded shadow-sm border cursor-pointer hover:opacity-80 transition-all ${isCurrentPayment ? 'ring-2 ring-green-500' : ''}`} onClick={() => setPreviewImage(path)} />
                                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">{formatCurrency(payment.amount)}</div>
                                                    </div>
                                                ));
                                            }
                                        } catch (e) {
                                            return (
                                                <div key={`p-${payment.id}`} className="relative group aspect-square">
                                                    <img src={payment.evidence} alt="Comprobante" className={`w-full h-full object-cover rounded shadow-sm border cursor-pointer hover:opacity-80 transition-all ${isCurrentPayment ? 'ring-2 ring-green-500' : ''}`} onClick={() => setPreviewImage(payment.evidence)} />
                                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">{formatCurrency(payment.amount)}</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}

                                    {/* Legacy account evidence */}
                                    {(!account.Payments || account.Payments.length === 0) && account.paymentEvidence && (() => {
                                        try {
                                            const paths = JSON.parse(account.paymentEvidence);
                                            if (Array.isArray(paths)) {
                                                return paths.map((path, i) => (
                                                    <img key={`legacy-${i}`} src={path} alt="Comprobante" className="w-full aspect-square object-cover rounded shadow-sm border cursor-pointer hover:opacity-80 transition-all" onClick={() => setPreviewImage(path)} />
                                                ));
                                            }
                                        } catch (e) {
                                            return (
                                                <img src={account.paymentEvidence} alt="Comprobante" className="w-full aspect-square object-cover rounded shadow-sm border cursor-pointer hover:opacity-80 transition-all" onClick={() => setPreviewImage(account.paymentEvidence)} />
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                {/* FOOTER TOTALS (Optional, only for ReportesView) */}
                {totalToDisplay !== null && amountToDisplay !== null && (
                    <div 
                        className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm sm:!pb-4"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                    >
                        <div>
                            <div className="text-gray-500">Total Cuenta</div>
                            <div className="font-bold text-gray-800">{formatCurrency(totalToDisplay)}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-gray-600">Este Abono</div>
                            <span className="text-2xl font-bold text-green-600">{formatCurrency(amountToDisplay)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* FULL SCREEN IMAGE PREVIEW */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(null);
                        }}
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

            {showInvoiceModal && (
                <InvoiceManagementModal 
                    account={account} 
                    onClose={() => setShowInvoiceModal(false)}
                    onRefresh={() => fetchAccount(account.id)}
                />
            )}
        </div>,
        document.body
    );
};

export default AccountDetailsModal;

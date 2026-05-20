import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import { useRestaurant } from '../contexts/RestaurantContext';

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
    const { socket } = useRestaurant();
    const [account, setAccount] = useState(initialAccount);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

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
        if (!initialAccount && accountId) {
            fetchAccount();
        }
    }, [accountId, initialAccount]);

    const fetchAccount = async () => {
        setLoading(true);
        setError(null);
        try {
            // Use the existing endpoint that returns account with orders and payments
            const response = await axios.get(`/api/accounts/specific/${accountId}`);
            setAccount(response.data);
        } catch (err) {
            console.error("Error fetching account details:", err);
            setError("No se pudo cargar el detalle de la cuenta.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={48} />
                    <p className="text-gray-600 font-medium">Cargando detalles...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-4 text-center">
                    <div className="bg-red-100 text-red-600 p-3 rounded-full">
                        <X size={32} />
                    </div>
                    <p className="text-gray-800 font-bold text-lg">Error</p>
                    <p className="text-gray-600">{error}</p>
                    <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    if (!account) return null;

    const formatCurrency = (amount) => {
        return `S/ ${Number(amount || 0).toFixed(2)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* HEADER */}
                <div className="p-6 border-b flex justify-between items-start bg-white">
                    <div>
                        <h3 className="font-bold text-xl text-gray-800">{title}</h3>
                        <div className="text-sm text-blue-600 font-medium mt-1">
                            {subtitle || `#${account.id} - ${account.Table ? formatTableName(account.Table) : `Mesa #${account.TableId}`}`}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                        <X size={24} strokeWidth={2} />
                    </button>
                </div>

                {/* CONTENT LIST */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">

                    {/* CONSUMOS SECTION */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-500 mb-3">Consumos / Cargos a la Mesa</h4>
                        <div className="space-y-3">
                            {account.Orders && account.Orders.length > 0 ? (
                                account.Orders.map((ord, idx) => (
                                    <div key={idx} className="bg-orange-50/50 border border-orange-100/50 rounded-lg p-4 flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">Venta Productos</div>
                                            <div className="text-sm text-gray-600 mt-1">
                                                <span className="text-orange-600 font-bold">{ord.quantity}x</span> {ord.Product?.name || 'Producto Desconocido'}
                                                {ord.presentation && <span className="text-blue-500 font-medium ml-1">({ord.presentation})</span>}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2">
                                                {new Date(ord.createdAt || new Date()).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                {ord.notes && <span className="italic block mt-1 text-gray-500">Nota: "{ord.notes}"</span>}
                                            </div>
                                        </div>
                                        <div className="font-bold text-orange-600 text-sm whitespace-nowrap">
                                            + {formatCurrency(ord.priceAtOrder && !isNaN(ord.priceAtOrder) ? (ord.priceAtOrder * ord.quantity) : (ord.Product?.price || 0) * ord.quantity)}
                                        </div>
                                    </div>
                                ))
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
                                        <div key={idx} className={`border rounded-lg p-4 flex justify-between items-start ${isCurrentPayment ? 'bg-green-100/50 border-green-300' : 'bg-green-50/50 border-green-100/50'}`}>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">Pago consumo {isCurrentPayment && <span className="ml-2 text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Abono Actual</span>}</div>
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
                    <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm">
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
        </div>
    );
};

export default AccountDetailsModal;

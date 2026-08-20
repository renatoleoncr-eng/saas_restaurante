import React from 'react';
import { X, ShoppingCart, AlertCircle, Minus, Trash2, Printer } from 'lucide-react';
import axios from 'axios';

export default function CartSidebar({
    viewMode = 'desktop', // 'desktop' or 'mobile'
    onCloseMobile,        // callback for closing mobile sidebar
    // State and Actions
    account,
    clientForm,
    setClientForm,
    handleClose,
    handleCloseClick,
    setStaffTotalInput,
    setStaffCommentInput,
    setShowStaffConfirm,
    groupedOrders,
    products,
    user,
    deleteConfirmId,
    setDeleteConfirmId,
    handleDeleteOrder,
    handleDecrementOrder,
    cart,
    updateQuantity,
    removeItem,
    totalPaid,
    isStaff,
    staffPayableTotal,
    accountTotal,
    originalGrandTotal,
    grandTotal,
    orderError,
    sendOrder,
    isSendingOrder,
    printingEnabled,
    handlePrintPreCuenta
}) {

    const renderHeader = () => {
        if (viewMode === 'mobile') {
            return (
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <ShoppingCart size={20} /> Carrito
                        {account && <span className="text-sm font-normal text-gray-500 ml-2">Cuenta #{account.id}</span>}
                    </h2>
                    <button onClick={onCloseMobile} className="p-2 hover:bg-gray-200 rounded-full"><X /></button>
                </div>
            );
        }
        return (
            <div className="p-5 border-b bg-gray-50 shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">
                        {account ? `Cuenta #${account.id}` : <span className="text-green-600">Nueva Cuenta</span>}
                    </h2>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClose();
                        }}
                        className="p-2.5 hover:bg-gray-200 active:bg-gray-300 rounded-full text-gray-500 hover:text-gray-800 transition-all duration-200 relative z-50 cursor-pointer pointer-events-auto shrink-0 flex items-center justify-center -mr-1"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>
        );
    };

    const renderAccountToggle = () => {
        if (account) {
            return (
                <div className={`${viewMode === 'mobile' ? 'bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4' : 'mt-3 bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2'}`}>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`staff_toggle_direct_${viewMode}`}
                            checked={account.accountType === 'staff'}
                            onChange={async (e) => {
                                if (e.target.checked) {
                                    setStaffTotalInput(account.accountType === 'staff' ? (parseFloat(account.total) || 0) : 0);
                                    setStaffCommentInput(account.clientAddress || '');
                                    setShowStaffConfirm(true);
                                } else {
                                    const newClientForm = { name: 'Cliente', dni: '', direccion: '', accountType: 'standard', staffTotal: 0 };
                                    setClientForm(newClientForm);
                                    try {
                                        const res = await axios.put(`/api/accounts/${account.id}`, {
                                            customerName: newClientForm.name,
                                            clientDni: newClientForm.dni,
                                            clientAddress: newClientForm.direccion,
                                            accountType: newClientForm.accountType
                                        });
                                    } catch (err) {
                                        console.error("Error setting account to standard:", err);
                                        alert('Error al actualizar la cuenta a consumo estándar');
                                    }
                                }
                            }}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor={`staff_toggle_direct_${viewMode}`} className="text-xs font-bold text-orange-800 cursor-pointer flex-1 select-none">
                            Consumo de Trabajador
                        </label>
                        {account.accountType === 'staff' && (
                            <span className="text-xs font-bold text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded shadow-sm">
                                S/ {Number(account.total).toFixed(1)}
                            </span>
                        )}
                    </div>
                    {account.accountType === 'staff' && account.clientAddress && (
                        <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded px-2 py-1 mt-2 font-medium italic">
                            Nota: {account.clientAddress}
                        </div>
                    )}
                </div>
            );
        }

        // NO ACCOUNT
        return (
            <div className={`${viewMode === 'mobile' ? 'bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4 space-y-3' : 'mt-3 space-y-3'}`}>
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-100">
                    <input
                        type="checkbox"
                        id={`staff_toggle_new_${viewMode}`}
                        checked={clientForm.accountType === 'staff'}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setStaffTotalInput(clientForm.staffTotal || 0);
                                setStaffCommentInput(clientForm.direccion || '');
                                setShowStaffConfirm(true); // Open custom modal
                            } else {
                                setClientForm({ ...clientForm, accountType: 'standard', staffTotal: 0 });
                            }
                        }}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`staff_toggle_new_${viewMode}`} className="text-xs font-bold text-orange-800 cursor-pointer">Consumo de Trabajador</label>
                </div>
                {clientForm.accountType === 'staff' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">Total a cobrar (S/)</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={clientForm.staffTotal}
                                onChange={e => {
                                    let val = e.target.value;
                                    if (val !== '' && accountTotal > 0 && Number(val) > accountTotal) {
                                        val = accountTotal;
                                    }
                                    setClientForm({ ...clientForm, staffTotal: val });
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">Comentario / Nota de Consumo</label>
                            <input
                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={clientForm.direccion || ''}
                                onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })}
                                placeholder="Escriba un comentario..."
                            />
                        </div>
                    </div>
                )}
                {viewMode === 'desktop' && (
                    <div className="text-sm text-gray-500 italic">
                        Agrega productos para abrir la mesa.
                    </div>
                )}
            </div>
        );
    };

    const renderSentOrders = () => {
        if (!groupedOrders || groupedOrders.length === 0) return null;
        return (
            <div className={`${viewMode === 'mobile' ? 'bg-white p-3 rounded-lg border border-gray-200 mb-4 shadow-sm' : 'space-y-2'}`}>
                <h3 className={`text-xs font-bold text-gray-400 uppercase ${viewMode === 'mobile' ? 'mb-2 border-b pb-1' : ''}`}>Pedidos Enviados</h3>
                {viewMode === 'mobile' ? (
                    <div className="space-y-2">
                        {groupedOrders.map(renderSentOrderItem)}
                    </div>
                ) : (
                    groupedOrders.map(renderSentOrderItem)
                )}
            </div>
        );
    };

    const renderSentOrderItem = (o) => {
        let pName = "Producto desconocido";
        let displayNotes = o.notes;
        let originalP = null;

        if (!o.ProductId && o.notes) {
            const cleanNote = o.notes.replace(/^2x1:\s*/i, '');
            pName = cleanNote.includes(' + ') ? `2x1: ${cleanNote}` : cleanNote;
            displayNotes = null;
        } else if (o.Product && o.Product.name) {
            pName = o.Product.name;
        }

        if (products.length > 0 && o.ProductId) {
            const localP = products.find(p => p.id === o.ProductId);
            if (localP) {
                pName = localP.name;
                if (o.presentation) {
                    if (localP.ProductVariants && localP.ProductVariants.length > 0) {
                        const v = localP.ProductVariants.find(v => v.name === o.presentation);
                        if (v) originalP = v.price;
                    } else if (localP.presentations) {
                        try {
                            const vars = typeof localP.presentations === 'string' ? JSON.parse(localP.presentations) : localP.presentations;
                            const v = vars.find(v => v.name === o.presentation);
                            if (v) originalP = v.price;
                        } catch (e) { }
                    }
                }
                if (originalP === null) originalP = localP.price;
            }
        }

        return (
            <div key={o.key} className={`flex justify-between items-center text-sm ${viewMode === 'mobile' ? 'border-b border-dashed pb-2 last:border-b-0 last:pb-0' : 'py-2 border-b border-dashed'}`}>
                <div className="flex flex-col">
                    <span className="font-bold text-gray-700">
                        {o.quantity}x {pName}
                        <span className="text-blue-600 ml-1">
                            {isStaff ? (
                                o.quantity > 1 ? (
                                    <span className="text-orange-600">({o.quantity}x S/ {Number(parseFloat(o.priceAtOrder || 0).toFixed(1))} = S/ {Number((o.quantity * parseFloat(o.priceAtOrder || 0)).toFixed(1))})</span>
                                ) : (
                                    <span className="text-orange-600">(S/ {Number(parseFloat(o.priceAtOrder || 0).toFixed(1))})</span>
                                )
                            ) : (
                                o.quantity > 1 ? (
                                    `(${o.quantity} x S/ ${Number(parseFloat(o.priceAtOrder).toFixed(1))} = S/ ${Number((o.quantity * parseFloat(o.priceAtOrder)).toFixed(1))})`
                                ) : (
                                    `(S/ ${Number(parseFloat(o.priceAtOrder).toFixed(1))})`
                                )
                            )}
                        </span>
                    </span>
                    {o.presentation && <span className="text-xs text-blue-500">({o.presentation})</span>}
                    {displayNotes && <span className="text-xs text-red-400 italic">"{displayNotes}"</span>}
                </div>

                <div className="flex items-center gap-2">
                    {user?.role === 'admin' && (
                        deleteConfirmId === o.id ? (
                            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                <span className="text-xs text-red-700 font-bold mr-1">¿Eliminar?</span>
                                <button
                                    onClick={() => handleDeleteOrder(o.id)}
                                    className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                >Sí</button>
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                                >No</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                {o.quantity > 1 && (
                                    <button
                                        onClick={() => handleDecrementOrder(o.id)}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-lg transition-colors"
                                        title="Reducir Cantidad"
                                    >
                                        <Minus size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setDeleteConfirmId(o.id)}
                                    className="bg-red-100 hover:bg-red-200 text-red-600 p-1.5 rounded-lg transition-colors"
                                    title="Eliminar Pedido"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        );
    };

    const renderNewOrders = () => {
        if (viewMode === 'mobile' && cart.length === 0) {
            return <div className="text-center py-10 text-gray-400">Carrito vacío</div>;
        }
        if (cart.length === 0) return null;

        return (
            <div className={`${viewMode === 'mobile' ? '' : 'space-y-3'}`}>
                {viewMode === 'desktop' && <h3 className="text-xs font-bold text-blue-600 uppercase">Nuevo Pedido</h3>}
                {cart.map((item, idx) => (
                    <div key={idx} className={`${viewMode === 'mobile' ? 'flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm mb-2' : 'bg-blue-50 p-3 rounded-lg flex justify-between items-center relative group'}`}>
                        <div>
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className={`text-xs flex items-center gap-1 mt-0.5 ${viewMode === 'mobile' ? 'text-blue-600 font-bold' : 'text-blue-600'}`}>
                                {item.originalPrice !== undefined && item.originalPrice !== item.price && (
                                    <span className="line-through text-gray-400">S/ {Number((item.originalPrice * item.quantity).toFixed(1))}</span>
                                )}
                                <span className={item.price === 0 ? "text-orange-600 font-bold" : ""}>
                                    S/ {Number((item.price * item.quantity).toFixed(1))}
                                </span>
                            </div>
                            {item.notes && <div className="text-xs text-gray-400 max-w-[200px] truncate">{item.notes}</div>}
                        </div>
                        <div className={`flex items-center gap-2 ${viewMode === 'mobile' ? '' : 'bg-white rounded px-1 border'}`}>
                            <button onClick={() => updateQuantity(idx, -1)} className={`${viewMode === 'mobile' ? 'w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600' : 'px-2 font-bold'}`}>-</button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(idx, 1)} className={`${viewMode === 'mobile' ? 'w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600' : 'px-2 font-bold'}`}>+</button>
                            {viewMode === 'mobile' && (
                                <button onClick={() => removeItem(idx)} className="ml-2 text-red-400"><X size={18} /></button>
                            )}
                        </div>
                        {viewMode === 'desktop' && (
                            <button onClick={() => removeItem(idx)} className="absolute -top-1 -right-1 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderFooter = () => {
        return (
            <div className="p-4 border-t bg-gray-50 shrink-0">
                {totalPaid > 0 && (
                    <div className={`space-y-1 border-b pb-2 mb-2 text-gray-500 ${viewMode === 'mobile' ? 'text-xs' : 'text-sm'}`}>
                        <div className="flex justify-between">
                            <span>{isStaff ? 'Total a cobrar:' : 'Total consumido:'}</span>
                            <span className="font-semibold">S/ {(isStaff ? staffPayableTotal : accountTotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                            <span>Abonado:</span>
                            <span className="font-semibold">- S/ {totalPaid.toFixed(2)}</span>
                        </div>
                    </div>
                )}
                <div className={`flex justify-between items-center font-bold text-gray-800 mb-4 ${viewMode === 'mobile' ? '' : 'text-xl'}`}>
                    <span>{totalPaid > 0 ? (viewMode === 'mobile' ? 'Saldo Pendiente' : 'Saldo Pendiente') : (viewMode === 'mobile' ? 'Total a Pagar' : 'Total')}</span>
                    <div className="flex flex-col items-end">
                        {viewMode === 'desktop' && account?.accountType === 'staff' && (
                            <span className="text-[10px] text-orange-600 uppercase font-bold bg-orange-50 px-2 py-0.5 rounded -mb-1">Consumo Personal</span>
                        )}
                        <div className="flex items-center gap-2">
                            {isStaff && (
                                <span className={`text-gray-400 line-through ${viewMode === 'mobile' ? 'text-sm' : 'text-sm font-normal'}`}>
                                    S/ {Number(originalGrandTotal).toFixed(1)}
                                </span>
                            )}
                            <span className={`text-blue-800 font-bold ${viewMode === 'mobile' ? 'text-2xl' : ''}`}>S/ {Number(grandTotal).toFixed(1)}</span>
                        </div>
                    </div>
                </div>

                {viewMode === 'desktop' && cart.length > 0 && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 text-left">
                        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">⚠️ Atención:</span> Una vez enviado el pedido, <span className="font-bold text-red-950">no se podrá modificar ni eliminar</span> (salvo por un administrador). Por favor, revise bien los productos y las cantidades antes de enviar.
                        </div>
                    </div>
                )}

                {orderError && (
                    <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-3 font-bold text-center text-xs">
                        {orderError}
                    </div>
                )}

                {viewMode === 'desktop' ? (
                    <>
                        {cart.length > 0 ? (
                            <button onClick={sendOrder} disabled={isSendingOrder} className={`w-full text-white py-3 rounded-xl font-bold shadow-lg transition-all ${isSendingOrder ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>{isSendingOrder ? 'Enviando...' : 'Enviar Pedido'}</button>
                        ) : (!account || (account.Orders && account.Orders.length === 0)) ? (
                            <button onClick={handleCloseClick} className="w-full border-2 border-gray-400 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100">Liberar Mesa</button>
                        ) : ['admin', 'cashier', 'waiter'].includes(user?.role) ? (
                            <div className="flex gap-2 w-full">
                                {printingEnabled && (
                                    <button
                                        onClick={() => handlePrintPreCuenta(account.id)}
                                        className="flex-1 border-2 border-amber-600 text-amber-600 py-3 rounded-xl font-bold hover:bg-amber-50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                    >
                                        <Printer size={16} /> Pre-cuenta
                                    </button>
                                )}
                                <button
                                    onClick={handleCloseClick}
                                    className={`${printingEnabled ? 'flex-1' : 'w-full'} border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 active:scale-95 transition-all`}
                                >
                                    Pagar
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleCloseClick} className="w-full border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 active:scale-95 transition-all">Pagar</button>
                        )}
                    </>
                ) : (
                    // MOBILE ACTIONS
                    <>
                        {cart.length > 0 ? (
                            <button onClick={sendOrder} disabled={isSendingOrder} className={`w-full text-white py-3 rounded-xl font-bold shadow-lg transition-all mb-2 ${isSendingOrder ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>{isSendingOrder ? 'Enviando...' : 'Enviar Pedido'}</button>
                        ) : (!account || (account.Orders && account.Orders.length === 0)) ? (
                            <button onClick={handleCloseClick} className="w-full border-2 border-gray-400 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100 mb-2">Liberar Mesa</button>
                        ) : ['admin', 'cashier', 'waiter'].includes(user?.role) ? (
                            <div className="flex gap-2 w-full mb-2">
                                {printingEnabled && (
                                    <button
                                        onClick={() => handlePrintPreCuenta(account.id)}
                                        className="flex-1 border-2 border-amber-600 text-amber-600 py-3 rounded-xl font-bold hover:bg-amber-50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                    >
                                        <Printer size={16} /> Pre-cuenta
                                    </button>
                                )}
                                <button
                                    onClick={handleCloseClick}
                                    className={`${printingEnabled ? 'flex-1' : 'w-full'} border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 active:scale-95 transition-all`}
                                >
                                    Pagar
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleCloseClick} className="w-full border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 active:scale-95 transition-all mb-2">Pagar Cuenta</button>
                        )}
                        <button
                            onClick={onCloseMobile}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all"
                        >
                            Seguir Agregando
                        </button>
                    </>
                )}
            </div>
        );
    };


    if (viewMode === 'mobile') {
        return (
            <div className="md:hidden absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right">
                {renderHeader()}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* The structure renders account toggle, sent orders and new orders directly here */}
                    {renderAccountToggle()}
                    {renderSentOrders()}
                    {renderNewOrders()}
                </div>
                {renderFooter()}
            </div>
        );
    }

    return (
        <div className="hidden md:flex w-[380px] bg-white border-l flex-col shadow-xl z-20">
            {renderHeader()}
            {/* Desktop uses an inner wrapper in the header? No, it's just under it. */}
            <div className="p-5 border-b bg-gray-50 shrink-0" style={{ paddingBottom: '0.5rem', paddingTop: '0.5rem', borderBottom: 'none' }}>
                {renderAccountToggle()}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {renderSentOrders()}
                {renderNewOrders()}
            </div>
            {renderFooter()}
        </div>
    );
}

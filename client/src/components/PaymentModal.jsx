import React from 'react';
import { CheckCircle, Check, AlertCircle, Printer, Image, Camera, X, Info, Loader2 } from 'lucide-react';
import axios from 'axios';

const PaymentModal = ({
    showPaymentModal,
    paymentFlow,
    account,
    tableData,
    clientForm,
    setClientForm,
    isSearchingClient,
    searchClientData,
    printingEnabled,
    onClose
}) => {
    if (!showPaymentModal) return null;

    const {
        successInvoice, setSuccessInvoice,
        paymentMethod, setPaymentMethod,
        qrsList, selectedQrId, setSelectedQrId,
        evidenceFiles, setEvidenceFiles,
        payAmount, setPayAmount,
        isLastPaymentPartial, setIsLastPaymentPartial,
        isConfirmingPayment, setIsConfirmingPayment,
        issueInvoice, setIssueInvoice,
        invoiceType, setInvoiceType,
        isProcessingPayment, setIsProcessingPayment,
        billingConfig, whatsappPhone, setwhatsappPhone,
        showWhatsappInput, setShowWhatsappInput,
        confirmPayment, handleShareWhatsapp, handlePrintLocalInvoice, handleDownloadLocalXml, fetchAccount
    } = paymentFlow;

    // We will extract isInvoiceDataMissing & isStaffCommentMissing logic that was hardcoded
    const isInvoiceDataMissing = issueInvoice && (
        (invoiceType === 'factura' && (!clientForm.dni || clientForm.dni.trim().length !== 11 || !clientForm.name || !clientForm.direccion)) ||
        (invoiceType === 'boleta' && clientForm.dni && (!clientForm.name || clientForm.name.trim() === ''))
    );
    const isPayDisabled = isConfirmingPayment || isProcessingPayment || isInvoiceDataMissing;
    
    // We also need handleFileChange if it's not exported from usePaymentFlow.
    // wait, handleFileChange from TableControl needs to be reconstructed here or exposed.
    // Let's create it locally for the modal.
    const localHandleFileChange = (e) => {
        if (e.target.files) {
            setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    return (
                (
                    <div className="absolute inset-0 bg-black/60 z-[60] flex justify-center items-start overflow-y-auto p-4">
                        {successInvoice ? (
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm border border-gray-100 animate-in zoom-in-95 duration-200 my-auto">
                                {/* Premium Green/Mint Gradient Header */}
                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-center text-white relative">
                                    <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-3 shadow-inner">
                                        <CheckCircle size={36} className="text-white" />
                                    </div>
                                    <h2 className="text-xl font-extrabold tracking-tight">¡Comprobante Emitido!</h2>
                                    <p className="text-emerald-100 text-xs mt-1">El comprobante se generó y registró correctamente</p>
                                </div>

                                {/* Voucher Body */}
                                <div className="p-6 space-y-4">
                                    {/* Monospace Serial code */}
                                    <div className="text-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            {successInvoice.invoice.tipo === 'factura' ? 'Factura Electrónica' : 'Boleta Electrónica'}
                                        </div>
                                        <div className="text-2xl font-mono font-bold text-slate-800 tracking-normal mt-1">
                                            {successInvoice.invoice.serie}-{String(successInvoice.invoice.correlativo).padStart(6, '0')}
                                        </div>
                                    </div>

                                    {/* SUNAT Status pill badge */}
                                    {(() => {
                                        const { pdf } = (() => {
                                            const sunatResp = successInvoice.sunatResponse;
                                            if (!sunatResp) return { pdf: null, xml: null };
                                            let parsed = sunatResp;
                                            if (typeof sunatResp === 'string') {
                                                try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
                                            }
                                            if (!parsed) return { pdf: null, xml: null };
                                            let pdfUrl = parsed.url_ticket || parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || parsed.url || null;
                                            let xmlUrl = parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null;
                                            
                                            // Apply SSL fix
                                            if (pdfUrl && typeof pdfUrl === 'string') {
                                                if (pdfUrl.includes('72.61.57.199') || pdfUrl.includes('maksuites') || pdfUrl.includes('bluzcx')) {
                                                    pdfUrl = pdfUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                                                }
                                            }
                                            if (xmlUrl && typeof xmlUrl === 'string') {
                                                if (xmlUrl.includes('72.61.57.199') || xmlUrl.includes('maksuites') || xmlUrl.includes('bluzcx')) {
                                                    xmlUrl = xmlUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                                                }
                                            }
                                            return { pdf: pdfUrl, xml: xmlUrl };
                                        })();

                                        return (
                                            <div className="flex justify-center">
                                                {pdf ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-200 font-bold uppercase shadow-sm">
                                                        <Check size={12} className="stroke-[3]" /> Aceptado por SUNAT
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full border border-amber-200 font-bold uppercase shadow-sm">
                                                        <AlertCircle size={12} /> Guardado Localmente
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Details Grid */}
                                    <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm text-gray-600">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Cliente:</span>
                                            <span className="font-semibold text-gray-800 truncate max-w-[200px]" title={successInvoice.invoice.clienteNombre}>
                                                {successInvoice.invoice.clienteNombre}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Documento:</span>
                                            <span className="font-semibold text-gray-800 font-mono">
                                                {successInvoice.invoice.clienteDocumento || '00000000'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Método de Pago:</span>
                                            <span className="font-semibold text-gray-800 capitalize bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                {paymentMethod}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline border-t border-gray-100 pt-3 mt-1">
                                            <span className="text-gray-500 font-bold">Total Pagado:</span>
                                            <span className="text-xl font-black text-slate-800 font-mono">
                                                S/ {parseFloat(successInvoice.invoice.total).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: PDF & XML */}
                                    {(() => {
                                        const { pdf, xml } = (() => {
                                            const sunatResp = successInvoice.sunatResponse;
                                            if (!sunatResp) return { pdf: null, xml: null };
                                            let parsed = sunatResp;
                                            if (typeof sunatResp === 'string') {
                                                try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
                                            }
                                            if (!parsed) return { pdf: null, xml: null };
                                            return {
                                                pdf: (() => {
                                                    let u = parsed.url_ticket || parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || parsed.url || null;
                                                    if (u && typeof u === 'string' && (u.includes('72.61.57.199') || u.includes('maksuites') || u.includes('bluzcx'))) {
                                                        u = u.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                                                    }
                                                    return u;
                                                })(),
                                                xml: (() => {
                                                    let u = parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null;
                                                    if (u && typeof u === 'string' && (u.includes('72.61.57.199') || u.includes('maksuites') || u.includes('bluzcx'))) {
                                                        u = u.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                                                    }
                                                    return u;
                                                })()
                                            };
                                        })();

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex gap-2 pt-2">
                                                    <button
                                                        onClick={() => {
                                                            if (pdf) {
                                                                if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                                                                    window.location.href = pdf;
                                                                } else {
                                                                    window.open(pdf, '_blank');
                                                                }
                                                            } else if (printingEnabled) {
                                                                axios.post(`/api/billing/invoices/${successInvoice.invoice.id}/print`).catch(() => {});
                                                            }
                                                        }}
                                                        className="flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200"
                                                    >
                                                        <Printer size={16} />
                                                        {pdf ? 'Ver PDF' : (printingEnabled ? 'Imprimir' : 'Comprobante')}
                                                    </button>
                                                    {printingEnabled && (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await axios.post(`/api/billing/invoices/${successInvoice.invoice.id}/print`);
                                                                    alert("Comprobante enviado a la cola de impresión.");
                                                                } catch (err) {
                                                                    alert("Error al enviar a la impresora.");
                                                                }
                                                            }}
                                                            className="flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm bg-slate-800 border-slate-800 text-white hover:bg-slate-900 hover:shadow-slate-200"
                                                        >
                                                            <Printer size={16} />
                                                            Imprimir
                                                        </button>
                                                    )}
                                                </div>

                                                {/* WhatsApp Sharing Block */}
                                                <div className="border-t border-gray-100 pt-4">
                                                    {showWhatsappInput ? (
                                                        <div className="space-y-2 animate-in slide-in-from-bottom-2">
                                                            <label className="block text-xs font-bold text-gray-500 text-left">Número de WhatsApp</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="51987654321"
                                                                    value={whatsappPhone}
                                                                    onChange={e => setwhatsappPhone(e.target.value)}
                                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                />
                                                                <button
                                                                    onClick={handleShareWhatsapp}
                                                                    disabled={!whatsappPhone.trim()}
                                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                                                                >
                                                                    Enviar
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowWhatsappInput(false)}
                                                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                                                >
                                                                    X
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowWhatsappInput(true)}
                                                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-md hover:shadow-emerald-200 flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.233-1.372a9.954 9.954 0 0 0 4.781 1.218h.004c5.502 0 9.987-4.478 9.988-9.984C22.008 6.478 17.521 2 12.012 2zm6.935 14.177c-.285.807-1.42 1.48-1.956 1.58-.466.086-1.077.126-1.722-.08-.415-.133-.943-.327-1.605-.595-2.822-1.139-4.646-3.99-4.786-4.179-.142-.19-1.157-1.528-1.157-2.917 0-1.39.73-2.072 1.01-2.355.28-.28.618-.35.823-.35.205 0 .41.002.59.01.19.01.446-.073.7.535.263.63.898 2.167.978 2.327.08.16.133.348.028.563-.106.216-.16.348-.316.53-.158.18-.33.4-.47.53-.158.146-.323.305-.14.618.18.305.8 1.3 1.713 2.112.915.811 1.685 1.06 1.99 1.182.305.123.48.103.66-.1.18-.205.776-.897.98-1.206.205-.308.41-.256.69-.153.284.103 1.8.847 2.11 1.002.312.155.518.23.593.36.075.13.075.753-.21 1.56z"/>
                                                            </svg>
                                                            Compartir por WhatsApp
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Finalize Button */}
                                    <button
                                        onClick={() => {
                                            setSuccessInvoice(null);
                                            setwhatsappPhone('');
                                            setShowWhatsappInput(false);
                                            setShowPaymentModal(false);
                                            if (isLastPaymentPartial) {
                                                fetchAccount();
                                            } else {
                                                onClose();
                                            }
                                        }}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm mt-2"
                                    >
                                        <Check size={18} className="stroke-[3]" />
                                        {isLastPaymentPartial ? 'Finalizar Abono' : 'Finalizar y Liberar Mesa'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 my-auto">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirmar Pago</h2>

                                {(() => {
                                    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                                    const remaining = account ? Math.max(0, parseFloat(account.total) - totalPaid) : 0;
                                    const enteredAmount = parseFloat(payAmount) || 0;
                                    const isPartial = enteredAmount < (remaining - 0.01);

                                    return (
                                        <>
                                            <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100 space-y-1">
                                                <div className="flex justify-between items-center text-xs text-gray-500">
                                                    <span>Total de la Cuenta:</span>
                                                    <span className="font-semibold text-gray-700">S/ {parseFloat(account?.total || 0).toFixed(2)}</span>
                                                </div>
                                                {totalPaid > 0 && (
                                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                                        <span>Abonado anteriormente:</span>
                                                        <span className="font-semibold text-green-600">- S/ {totalPaid.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center pt-1 border-t border-blue-200/50">
                                                    <span className="text-sm font-bold text-blue-800 font-mono">Saldo Pendiente:</span>
                                                    <span className="text-2xl font-black text-blue-600 font-mono">S/ {remaining.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="mb-6 text-left">
                                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Monto a Pagar (S/):</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    max={remaining}
                                                    disabled={isConfirmingPayment}
                                                    value={payAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setPayAmount(val);
                                                        const enteredVal = parseFloat(val) || 0;
                                                        if (enteredVal < (remaining - 0.01)) {
                                                            setIssueInvoice(false);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0.00"
                                                />
                                                {isPartial && enteredAmount > 0 && (
                                                    <p className="text-xs text-orange-600 font-bold mt-1.5 animate-pulse">
                                                        ⚠️ Se registrará como un abono parcial. La mesa seguirá ocupada.
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="space-y-3 mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Método de Pago:</label>
                                    {['efectivo', 'yape', 'tarjeta', 'transferencia'].map(method => (
                                        <button
                                            key={method}
                                            disabled={isConfirmingPayment}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all
                                        ${paymentMethod === method ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-1' : 'border-gray-200 hover:bg-gray-50'}
                                        ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="capitalize font-medium text-gray-700">{method}</span>
                                            {paymentMethod === method && <CheckCircle size={18} className="text-blue-500" />}
                                        </button>
                                    ))}
                                </div>

                                {paymentMethod === 'yape' && (
                                    <div className="space-y-3 mb-6 animate-in slide-in-from-top-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Seleccione el QR Destino (Obligatorio):</label>
                                        <div className="flex flex-col gap-2">
                                            {qrsList.map(qr => (
                                                <button
                                                    key={qr.id}
                                                    disabled={isConfirmingPayment}
                                                    onClick={() => setSelectedQrId(qr.id)}
                                                    className={`w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                                                        selectedQrId === qr.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-1' : 'border-gray-200 hover:bg-gray-50'
                                                    } ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <span className="font-medium text-gray-700">{qr.name}</span>
                                                    {selectedQrId === qr.id && <CheckCircle size={18} className="text-blue-500" />}
                                                </button>
                                            ))}
                                            {qrsList.length === 0 && (
                                                <div className="text-sm text-red-500 p-2 border border-red-200 rounded bg-red-50">
                                                    No hay QRs activos configurados.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* EVIDENCE UPLOAD */}
                                {paymentMethod !== 'efectivo' && (() => {
                                    const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(paymentMethod);
                                    return (
                                        <div className="mb-6 animate-in slide-in-from-top-2">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Subir Evidencia {isEvidenceMandatory ? '(Obligatorio)' : '(Opcional)'}:
                                            </label>
                                            
                                            <div className="flex gap-2 mb-3">
                                                {/* Gallery button (Mobile only) */}
                                                <label
                                                    htmlFor="evidence-gallery"
                                                    className="md:hidden flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <Image size={16} /> Galería
                                                </label>
                                                <input
                                                    type="file"
                                                    id="evidence-gallery"
                                                    accept="image/*"
                                                    multiple
                                                    disabled={isConfirmingPayment}
                                                    onChange={localHandleFileChange}
                                                    className="hidden"
                                                />

                                                {/* Camera button (Mobile only) */}
                                                <label
                                                    htmlFor="evidence-camera"
                                                    className="md:hidden flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-semibold hover:bg-orange-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <Camera size={16} /> Cámara
                                                </label>
                                                <input
                                                    type="file"
                                                    id="evidence-camera"
                                                    accept="image/*"
                                                    capture="environment"
                                                    disabled={isConfirmingPayment}
                                                    onChange={localHandleFileChange}
                                                    className="hidden"
                                                />

                                                {/* File Upload button (Desktop only) */}
                                                <label
                                                    htmlFor="evidence-desktop"
                                                    className="hidden md:flex w-full items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <Image size={16} /> Seleccionar Archivo(s)
                                                </label>
                                                <input
                                                    type="file"
                                                    id="evidence-desktop"
                                                    accept="image/*"
                                                    multiple
                                                    disabled={isConfirmingPayment}
                                                    onChange={localHandleFileChange}
                                                    className="hidden"
                                                />
                                            </div>

                                            {evidenceFiles.length > 0 && (
                                                <div className="text-xs text-green-600 mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded border border-gray-150">
                                                    <span className="font-bold text-gray-700 mb-1">Archivos seleccionados ({evidenceFiles.length}):</span>
                                                    {evidenceFiles.map((file, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-1 text-gray-600 py-0.5 border-b border-gray-100 last:border-0">
                                                            <div className="flex items-center gap-1 truncate">
                                                                <CheckCircle size={12} className="text-green-500 shrink-0" />
                                                                <span className="truncate">{file.name}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEvidenceFiles(prev => prev.filter((_, i) => i !== idx))}
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
                                
                                {/* INVOICE OPTIONS */}
                                {billingConfig?.facturacionElectronica && (() => {
                                    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                                    const accountTotal = account ? parseFloat(account.total) : 0;
                                    const remaining = account ? Math.max(0, accountTotal - totalPaid) : 0;
                                    const enteredVal = parseFloat(payAmount) || 0;
                                    const isPartial = enteredVal < (remaining - 0.01);

                                    const previousInvoices = account?.Invoices ? account.Invoices.filter(inv => inv.status !== 'anulado') : [];
                                    const totalInvoiced = previousInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
                                    const availableToInvoice = Math.max(0, accountTotal - totalInvoiced);

                                    const showInvoiceWarning = issueInvoice && totalInvoiced === 0 && !isPartial && enteredVal < accountTotal;
                                    const showPreviousInvoicesInfo = issueInvoice && totalInvoiced > 0;

                                    return (
                                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            {isPartial ? (
                                                <div className="text-xs text-amber-600 font-bold text-center flex items-center justify-center gap-1.5 py-1">
                                                    <Info size={14} className="text-amber-500 shrink-0" />
                                                    <span>No se pueden emitir comprobantes para abonos parciales. Pague el saldo restante para facturar la cuenta.</span>
                                                </div>
                                            ) : totalInvoiced >= accountTotal ? (
                                                <div className="text-xs text-gray-500 font-bold text-center flex items-center justify-center gap-1.5 py-1">
                                                    <Info size={14} className="text-blue-500 shrink-0" />
                                                    <span>La cuenta ya ha sido facturada por completo (S/ {totalInvoiced.toFixed(2)}).</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <input 
                                                            type="checkbox" 
                                                            id="issue_invoice"
                                                            checked={issueInvoice}
                                                            onChange={(e) => setIssueInvoice(e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            disabled={isConfirmingPayment}
                                                        />
                                                        <label htmlFor="issue_invoice" className="text-sm font-bold text-gray-700 cursor-pointer">
                                                            Emitir Comprobante Electrónico
                                                        </label>
                                                    </div>
                                                    
                                                    {issueInvoice && (
                                                        <div className="animate-in fade-in slide-in-from-top-2">
                                                            <div className="flex gap-2 mb-3">
                                                                <button
                                                                    onClick={() => setInvoiceType('boleta')}
                                                                    disabled={isConfirmingPayment}
                                                                    className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'boleta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    Boleta
                                                                 </button>
                                                                <button
                                                                    onClick={() => setInvoiceType('factura')}
                                                                    disabled={isConfirmingPayment}
                                                                    className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'factura' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    Factura
                                                                 </button>
                                                            </div>
                                                            <div className="space-y-2 text-left">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Documento (DNI/RUC)</label>
                                                                    <div className="relative">
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder={invoiceType === 'factura' ? "RUC (11 dígitos)" : "DNI (8 dígitos) u Opcional"}
                                                                            value={clientForm.dni}
                                                                            onChange={e => {
                                                                                const val = e.target.value;
                                                                                setClientForm({...clientForm, dni: val});
                                                                                if (val.length === 11) setInvoiceType('factura');
                                                                                else if (val.length === 8 && !['10', '15', '17', '20'].some(p => val.startsWith(p))) setInvoiceType('boleta');
                                                                            }}
                                                                            disabled={isConfirmingPayment}
                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white pr-10"
                                                                            onKeyDown={e => e.key === 'Enter' && searchClientData()}
                                                                        />
                                                                        {isSearchingClient && (
                                                                            <div className="absolute right-3 top-2.5 text-blue-500">
                                                                                <Loader2 size={16} className="animate-spin" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Nombre / Razón Social</label>
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder={invoiceType === 'factura' ? "Razón Social" : "Nombre del Cliente"}
                                                                        value={clientForm.name}
                                                                        onChange={e => setClientForm({...clientForm, name: e.target.value})}
                                                                        disabled={isConfirmingPayment}
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                    />
                                                                </div>
                                                                {((invoiceType === 'factura' || (clientForm.dni && clientForm.dni.trim().length === 11))) && (
                                                                    <div>
                                                                        <label className="block text-xs font-bold text-gray-600 mb-1">Dirección Fiscal</label>
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder="Dirección Fiscal de la Empresa"
                                                                            value={clientForm.direccion || ''}
                                                                            onChange={e => setClientForm({...clientForm, direccion: e.target.value})}
                                                                            disabled={isConfirmingPayment}
                                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {showInvoiceWarning && (
                                                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                                                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                                    <div>
                                                                        <span className="font-bold text-amber-950 block mb-0.5">Nota de Facturación</span> 
                                                                        Este cobro final es por <span className="font-bold">S/ {enteredVal.toFixed(2)}</span>, pero el comprobante se emitirá por el <span className="font-bold">total de la cuenta (S/ {accountTotal.toFixed(2)})</span> debido a los abonos parciales registrados anteriormente.
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {showPreviousInvoicesInfo && (
                                                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-[11px] flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                                                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                                                    <div>
                                                                        <span className="font-bold text-blue-950 block mb-0.5">Nota de Facturación</span> 
                                                                        Se han emitido comprobantes previos por <span className="font-bold">S/ {totalInvoiced.toFixed(2)}</span>. Este comprobante se emitirá por la diferencia disponible para facturar (<span className="font-bold">S/ {availableToInvoice.toFixed(2)}</span>).
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                                    const remaining = account ? Math.max(0, parseFloat(account.total) - totalPaid) : 0;
                                    const enteredVal = parseFloat(payAmount) || 0;
                                    const isAmountInvalid = isNaN(enteredVal) || enteredVal <= 0 || (account && enteredVal > (remaining + 0.01));
                                    const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(paymentMethod);
                                    const isInvoiceDataMissing = issueInvoice && (
                                        !clientForm.dni?.trim() || 
                                        !clientForm.name?.trim() || 
                                        ((invoiceType === 'factura' || clientForm.dni?.trim().length === 11) && !clientForm.direccion?.trim())
                                    );
                                    const isStaffCommentMissing = isStaff && (!clientForm.direccion || !clientForm.direccion.trim());
                                    const isPayDisabled = isProcessingPayment || (isEvidenceMandatory && evidenceFiles.length === 0) || isAmountInvalid || isInvoiceDataMissing || isStaffCommentMissing;
                                    const isPartial = enteredVal < (remaining - 0.01);

                                    return (
                                        <>
                                            {isEvidenceMandatory && evidenceFiles.length === 0 && (
                                                <p className="text-xs text-red-500 font-bold mb-2 text-center animate-pulse">
                                                    * Se requiere subir comprobante o foto para continuar.
                                                </p>
                                            )}
                                            {isAmountInvalid && enteredVal > 0 && (
                                                <p className="text-xs text-red-500 font-bold mb-2 text-center animate-pulse">
                                                    * El monto a pagar no puede superar el saldo pendiente de S/ {remaining.toFixed(2)}.
                                                </p>
                                            )}
                                            {issueInvoice && isInvoiceDataMissing && (
                                                <p className="text-xs text-red-500 font-bold mb-2 text-center animate-pulse">
                                                    * Busque/complete los datos del cliente {(invoiceType === 'factura' || clientForm.dni?.trim().length === 11) ? '(DNI/RUC, nombre y dirección)' : '(DNI y nombre)'} para cobrar.
                                                </p>
                                            )}
                                            {isStaffCommentMissing && (
                                                <p className="text-xs text-red-500 font-bold mb-2 text-center animate-pulse">
                                                    * Es obligatorio ingresar un comentario o nota para el consumo de personal.
                                                </p>
                                            )}
                                            <div className="flex gap-3 mt-4">
                                                <button
                                                    onClick={() => {
                                                        if (isProcessingPayment) return;
                                                        if (isConfirmingPayment) {
                                                            setIsConfirmingPayment(false);
                                                        } else {
                                                            setShowPaymentModal(false);
                                                            setIssueInvoice(false);
                                                        }
                                                    }}
                                                    disabled={isProcessingPayment}
                                                    className={`flex-1 py-3 text-gray-700 rounded-lg font-bold transition-colors ${isProcessingPayment ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
                                                >
                                                    {isConfirmingPayment ? 'Atrás' : 'Cancelar'}
                                                </button>
                                                <button
                                                    onClick={confirmPayment}
                                                    disabled={isPayDisabled}
                                                    className={`flex-1 py-3 text-white rounded-lg font-black shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center leading-tight
                                                    ${isPayDisabled ? 'bg-gray-400 cursor-not-allowed shadow-none' : isConfirmingPayment ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'}`}
                                                >
                                                    {isProcessingPayment ? (
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="animate-spin text-white" size={18} />
                                                            <span>{issueInvoice ? 'Generando...' : isPartial ? 'Abonando...' : 'Cobrando...'}</span>
                                                        </div>
                                                    ) : isConfirmingPayment ? (
                                                        <>
                                                            <span className="text-xs opacity-90 uppercase">Confirmar</span>
                                                            <span>{isPartial ? 'SI, ABONAR' : 'SI, COBRAR'}</span>
                                                        </>
                                                    ) : (
                                                        isPartial ? 'Registrar Abono' : 'Cobrar'
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )
    );
};
export default PaymentModal;

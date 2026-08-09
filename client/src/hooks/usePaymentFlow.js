import { useState, useEffect } from 'react';
import axios from 'axios';
import { generatePrintableHtml, triggerIframePrint } from '../utils/billingPrintUtils';

export function usePaymentFlow({ account, clientForm, user, tableData, groupedOrders, fetchAccount, onClose }) {
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [qrsList, setQrsList] = useState([]);
    const [selectedQrId, setSelectedQrId] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [payAmount, setPayAmount] = useState('');
    const [isLastPaymentPartial, setIsLastPaymentPartial] = useState(false);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [issueInvoice, setIssueInvoice] = useState(false);
    const [invoiceType, setInvoiceType] = useState('boleta');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [successInvoice, setSuccessInvoice] = useState(null);
    const [billingConfig, setBillingConfig] = useState(null);
    const [whatsappPhone, setwhatsappPhone] = useState('');
    const [showWhatsappInput, setShowWhatsappInput] = useState(false);

    useEffect(() => {
        fetchBillingConfig();
        fetchQrs();
    }, []);

    async function fetchBillingConfig() {
        try {
            const res = await axios.get('/api/billing/config');
            setBillingConfig(res.data);
        } catch (err) {
            console.error("Error fetching billing config:", err);
        }
    }

    async function fetchQrs() {
        try {
            const res = await axios.get('/api/qrs');
            setQrsList(res.data.filter(qr => qr.isActive));
        } catch (err) {
            console.error("Error fetching QRs:", err);
        }
    }

    const confirmPayment = async () => {
        if (!isConfirmingPayment) {
            setIsConfirmingPayment(true);
            return;
        }

        if (isProcessingPayment) return;
        setIsProcessingPayment(true);

        const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
        const remaining = Math.max(0, Math.round((parseFloat(account?.total || 0) - totalPaid) * 100) / 100);
        const enteredAmount = parseFloat(payAmount);

        if (isNaN(enteredAmount) || enteredAmount <= 0) {
            alert('Por favor ingrese un monto a pagar válido.');
            setIsConfirmingPayment(false);
            setIsProcessingPayment(false);
            return;
        }

        if (paymentMethod === 'yape' && !selectedQrId) {
            alert('Por favor seleccione a qué código QR se está haciendo el pago.');
            setIsConfirmingPayment(false);
            setIsProcessingPayment(false);
            return;
        }

        const isPartial = enteredAmount < (remaining - 0.01);
        setIsLastPaymentPartial(isPartial);

        if (isPartial && issueInvoice) {
            setIssueInvoice(false);
            alert('No se pueden emitir comprobantes para abonos parciales.');
            setIsConfirmingPayment(false);
            setIsProcessingPayment(false);
            return;
        }

        if (issueInvoice) {
            if (invoiceType === 'factura') {
                if (!clientForm.dni || clientForm.dni.length !== 11) {
                    alert('Para emitir una Factura es obligatorio ingresar un RUC válido de 11 dígitos. Por favor, ingréselo en el formulario.');
                    setIsConfirmingPayment(false);
                    setIsProcessingPayment(false);
                    return;
                }
            } else if (invoiceType === 'boleta') {
                if (!clientForm.dni) {
                    const proceed = window.confirm('No ha ingresado un documento. La boleta se emitirá a "CLIENTES VARIOS". ¿Desea continuar o prefiere cancelar para ingresar los datos del cliente?');
                    if (!proceed) {
                        setIsConfirmingPayment(false);
                        setIsProcessingPayment(false);
                        return;
                    }
                }
            }
        }

        try {
            if (account && (clientForm.dni !== account.clientDni || clientForm.name !== account.customerName || clientForm.direccion !== account.clientAddress)) {
                await axios.put(`/api/accounts/${account.id}`, {
                    customerName: clientForm.name,
                    clientDni: clientForm.dni,
                    clientAddress: clientForm.direccion,
                    accountType: clientForm.accountType
                });
            }

            let resInvoiceData = null;
            if (issueInvoice) {
                let itemsToBill = [];
                const previousInvoices = account?.Invoices ? account.Invoices.filter(inv => inv.status !== 'anulado') : [];
                const totalInvoiced = previousInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);

                if (totalInvoiced > 0) {
                    const availableToInvoice = Math.max(0, parseFloat(account.total) - totalInvoiced);
                    itemsToBill = [{
                        description: `Saldo restante - Mesa ${tableData ? (tableData.number || tableData.id) : account.TableId} - Cuenta #${account.id}`,
                        qty: 1,
                        amount: availableToInvoice
                    }];
                } else if (isPartial) {
                    itemsToBill = [{
                        description: `Abono parcial - Mesa ${tableData ? (tableData.number || tableData.id) : account.TableId} - Cuenta #${account.id}`,
                        qty: 1,
                        amount: enteredAmount
                    }];
                } else {
                    itemsToBill = groupedOrders.map(o => {
                        let pName = "Producto";
                        let displayNotes = o.notes;
                        if (!o.ProductId && o.notes) {
                            const cleanNote = o.notes.replace(/^2x1:\s*/i, '');
                            pName = cleanNote.includes(' + ') ? `2x1: ${cleanNote}` : cleanNote;
                            displayNotes = null;
                        } else if (o.Product && o.Product.name) {
                            pName = o.Product.name;
                        }
                        const fullDesc = `${pName} ${o.presentation ? `(${o.presentation})` : ''} ${displayNotes ? `- ${displayNotes}` : ''}`.trim();
                        
                        return {
                            description: fullDesc,
                            qty: o.quantity,
                            amount: o.quantity * parseFloat(o.priceAtOrder)
                        };
                    });
                }
                
                const resInvoice = await axios.post('/api/billing/invoices', {
                    tipo: invoiceType,
                    clienteDocumento: clientForm.dni || '00000000',
                    clienteNombre: clientForm.name || 'CLIENTES VARIOS',
                    clienteDireccion: clientForm.direccion || '',
                    items: itemsToBill,
                    userId: user.id,
                    accountId: account.id
                });
                resInvoiceData = resInvoice.data;
            }

            const formData = new FormData();
            if (isPartial) {
                formData.append('amount', enteredAmount);
            }
            formData.append('paymentMethod', paymentMethod);
            if (paymentMethod === 'yape' && selectedQrId) {
                formData.append('qr_id', selectedQrId);
            }
            if (user?.id) {
                formData.append('userId', user.id);
            }
            if (evidenceFiles && evidenceFiles.length > 0) {
                for (let i = 0; i < evidenceFiles.length; i++) {
                    formData.append('evidence', evidenceFiles[i]);
                }
            }

            const endpoint = isPartial 
                ? `/api/accounts/${account.id}/pay`
                : `/api/accounts/${account.id}/close`;

            await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (issueInvoice && resInvoiceData && resInvoiceData.success) {
                setSuccessInvoice({
                    invoice: resInvoiceData.invoice,
                    sunatResponse: resInvoiceData.sunatResponse
                });
                setIsConfirmingPayment(false);
                setEvidenceFiles([]);
            } else {
                setIsConfirmingPayment(false);
                setShowPaymentModal(false);
                setEvidenceFiles([]);
                if (isPartial) {
                    if (fetchAccount) fetchAccount();
                } else {
                    if (onClose) onClose();
                }
            }
        } catch (err) {
            alert('Error al procesar el pago: ' + (err.response?.data?.error || err.message));
            setIsConfirmingPayment(false);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleShareWhatsapp = () => {
        if (!whatsappPhone) {
            alert('Ingrese un número de teléfono válido.');
            return;
        }
        
        let url = '';
        if (successInvoice.invoice.tipo === 'factura' || successInvoice.invoice.tipo === 'boleta') {
            url = `${window.location.origin}/api/billing/pdf/${successInvoice.invoice.id}`;
        }
        
        const message = encodeURIComponent(`Hola, le adjuntamos su comprobante de pago: ${url}`);
        window.open(`https://wa.me/${whatsappPhone}?text=${message}`, '_blank');
        setShowWhatsappInput(false);
    };

    const handlePrintLocalInvoice = (invoice) => {
        if (!invoice) return;
        
        const html = generatePrintableHtml(invoice, billingConfig, paymentMethod, successInvoice);
        triggerIframePrint(html);
    };

    const handleDownloadLocalXml = (invoice) => {
        if (!invoice) return;
        const sunatResp = invoice.sunatResponse;
        if (!sunatResp) {
            alert('No se encontró respuesta de SUNAT (XML) para este comprobante.');
            return;
        }

        let parsed = sunatResp;
        if (typeof sunatResp === 'string') {
            try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
        }

        if (parsed && parsed.xml) {
            const xmlContent = parsed.xml;
            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ruc = billingConfig?.ruc || '20614409593';
            const tipoComp = invoice.tipo === 'factura' ? '01' : '03';
            a.download = `${ruc}-${tipoComp}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            alert('El XML no está disponible en la respuesta.');
        }
    };

    return {
        // State
        showPaymentModal,
        setShowPaymentModal,
        paymentMethod,
        setPaymentMethod,
        qrsList,
        setQrsList,
        selectedQrId,
        setSelectedQrId,
        evidenceFiles,
        setEvidenceFiles,
        payAmount,
        setPayAmount,
        isLastPaymentPartial,
        setIsLastPaymentPartial,
        isConfirmingPayment,
        setIsConfirmingPayment,
        issueInvoice,
        setIssueInvoice,
        invoiceType,
        setInvoiceType,
        isProcessingPayment,
        setIsProcessingPayment,
        successInvoice,
        setSuccessInvoice,
        billingConfig,
        setBillingConfig,
        whatsappPhone,
        setwhatsappPhone,
        showWhatsappInput,
        setShowWhatsappInput,
        
        // Functions
        fetchBillingConfig,
        fetchQrs,
        confirmPayment,
        handleShareWhatsapp,
        handlePrintLocalInvoice,
        handleDownloadLocalXml
    };
}

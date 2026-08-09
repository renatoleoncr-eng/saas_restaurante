import { useState, useEffect } from 'react';
import axios from 'axios';

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

    const fetchBillingConfig = async () => {
        try {
            const res = await axios.get('/api/billing/config');
            setBillingConfig(res.data);
        } catch (err) {
            console.error("Error fetching billing config:", err);
        }
    };

    const fetchQrs = async () => {
        try {
            const res = await axios.get('/api/qrs');
            setQrsList(res.data.filter(qr => qr.isActive));
        } catch (err) {
            console.error("Error fetching QRs:", err);
        }
    };

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

        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
        const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : new Date().toLocaleString();
        const docName = invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA';
        
        const rucEmpresa = billingConfig?.ruc || '20614409593';
        const nameEmpresa = billingConfig?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
        const addressEmpresa = billingConfig?.direccion || 'Av. Larco 123, Miraflores, Lima';

        const isExonerated = billingConfig?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
        const totalAmount = parseFloat(invoice.total || 0);
        const igvAmount = isExonerated ? 0 : parseFloat(invoice.igv || 0);
        const opAmount = isExonerated ? totalAmount : parseFloat(invoice.subtotal || 0);
        const opLabel = isExonerated ? 'OP. EXONERADA:' : 'OP. GRAVADA:';
        const igvLabel = isExonerated ? 'I.G.V. (0%):' : `I.G.V. (${billingConfig?.igvTasa || 18}%):`;

        const tipoComp = invoice.tipo === 'factura' ? '01' : '03';
        let tipoDocAdq = '0';
        if (invoice.clienteDocumento) {
            if (invoice.clienteDocumento.length === 11) tipoDocAdq = '6';
            else if (invoice.clienteDocumento.length === 8) tipoDocAdq = '1';
        }
        const nroDocAdq = invoice.clienteDocumento || '00000000';
        
        const rawDate = invoice.emitidoAt || invoice.createdAt || new Date();
        const d = new Date(rawDate);
        const fechaEmi = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const qrData = [
            rucEmpresa,
            tipoComp,
            invoice.serie,
            invoice.correlativo,
            igvAmount.toFixed(2),
            totalAmount.toFixed(2),
            fechaEmi,
            tipoDocAdq,
            nroDocAdq
        ].join('|');

        let html = `
            <html>
            <head>
                <style>
                    body { font-family: monospace; width: 300px; margin: 0 auto; font-size: 12px; }
                    .center { text-align: center; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    td { vertical-align: top; padding: 2px 0; }
                    .qr-code { display: block; margin: 10px auto; width: 120px; height: 120px; }
                </style>
                <script src="https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"></script>
            </head>
            <body>
                <div class="center">
                    <h2 style="margin: 5px 0;">${nameEmpresa}</h2>
                    <div>RUC: ${rucEmpresa}</div>
                    <div>${addressEmpresa}</div>
                    <div class="divider"></div>
                    <div class="bold" style="font-size: 14px;">${docName}</div>
                    <div>${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}</div>
                </div>
                <div class="divider"></div>
                <div>Fecha: ${dateStr}</div>
                <div>Cliente: ${invoice.clienteNombre || 'CLIENTES VARIOS'}</div>
                <div>${invoice.tipo === 'factura' ? 'RUC' : 'Doc'}: ${invoice.clienteDocumento || '00000000'}</div>
                ${invoice.clienteDireccion ? `<div>Dir: ${invoice.clienteDireccion}</div>` : ''}
                <div class="divider"></div>
                <table>
                    <tr><td colspan="4" class="divider"></td></tr>
                    <tr>
                        <td class="bold">Cant</td>
                        <td class="bold">Descripción</td>
                        <td class="bold right">P.Unit</td>
                        <td class="bold right">Total</td>
                    </tr>
                    <tr><td colspan="4" class="divider"></td></tr>
                    ${items.map(item => `
                        <tr>
                            <td>${item.qty}</td>
                            <td>${item.description}</td>
                            <td class="right">${(item.amount / item.qty).toFixed(2)}</td>
                            <td class="right">${parseFloat(item.amount).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </table>
                <div class="divider"></div>
                <table style="width:100%">
                    <tr>
                        <td class="bold right" style="width: 70%;">${opLabel}</td>
                        <td class="right">S/ ${opAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td class="bold right">${igvLabel}</td>
                        <td class="right">S/ ${igvAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td class="bold right" style="font-size:14px;">TOTAL:</td>
                        <td class="bold right" style="font-size:14px;">S/ ${totalAmount.toFixed(2)}</td>
                    </tr>
                </table>
                
                <div id="qrcode" class="qr-code"></div>

                <div class="center" style="margin-top: 10px; font-size: 10px;">
                    Representación impresa del comprobante electrónico.<br>
                    Consulte su comprobante en SUNAT.
                </div>
                <div class="divider" style="margin-bottom: 20px;"></div>

                <script>
                    var qr = new QRCode(document.getElementById("qrcode"), {
                        text: "${qrData}",
                        width: 120,
                        height: 120,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.M
                    });
                    
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        const iframe = document.getElementById('print-iframe');
        if (iframe) {
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
        }
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

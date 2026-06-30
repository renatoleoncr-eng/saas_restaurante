import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    FileText, 
    Calendar, 
    ShoppingCart, 
    ChevronDown, 
    ChevronUp, 
    Check, 
    User, 
    CreditCard, 
    ArrowRight, 
    ArrowLeft,
    Printer, 
    Trash2,
    FileX,
    RefreshCw,
    Search,
    AlertCircle,
    Loader,
    Building,
    MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

const WhatsAppIcon = ({ size = 16, className = "" }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.395 0 .01 5.385.01 12.037c0 2.125.547 4.197 1.59 6.042L0 24l6.135-1.61a11.745 11.745 0 005.907 1.577h.005c6.65 0 12.034-5.388 12.037-12.04a11.744 11.744 0 00-3.465-8.52z" />
    </svg>
);

const getSunatUrls = (sunatResp) => {
    if (!sunatResp) return { pdf: null, xml: null };
    let parsed = sunatResp;
    if (typeof sunatResp === 'string') {
        try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
    }
    if (!parsed) return { pdf: null, xml: null };
    let pdf = parsed.url_ticket || parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || parsed.url || null;
    let xml = parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null;

    // Apply SSL fix
    if (pdf && typeof pdf === 'string') {
        if (pdf.includes('72.61.57.199') || pdf.includes('maksuites') || pdf.includes('bluzcx')) {
            pdf = pdf.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
        }
    }
    if (xml && typeof xml === 'string') {
        if (xml.includes('72.61.57.199') || xml.includes('maksuites') || xml.includes('bluzcx')) {
            xml = xml.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
        }
    }
    return { pdf, xml };
};

const InvoiceManagementModal = ({ account, onClose, onRefresh }) => {
    useModalBackHandler(true, onClose);

    const { socket, user } = useRestaurant();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [expandedGroups, setExpandedGroups] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [activeTab, setActiveTab] = useState('emit');
    const [selectedDocId, setSelectedDocId] = useState(null);

    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [lastIssuedUrl, setLastIssuedUrl] = useState(null);
    const [lastIssuedDoc, setLastIssuedDoc] = useState(null);
    const [successType, setSuccessType] = useState('invoice'); // 'invoice' or 'nc'
    const [isExonerado, setIsExonerado] = useState(false);
    const [igvRateInput, setIgvRateInput] = useState(10.5);
    const [errorMsg, setErrorMsg] = useState(null);
    const [config, setConfig] = useState(null);

    // Handle back button for inline success view
    useModalBackHandler(isSuccess, () => setIsSuccess(false));

    useEffect(() => {
        if (socket) {
            console.log('FolioSplitModal mounted: setting qr_fixed');
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        }
        return () => {
            if (socket) {
                console.log('FolioSplitModal unmounting: setting qr_countdown');
                socket.emit('set_client_screen_mode', { mode: 'qr_countdown' });
            }
        };
    }, [socket]);
    // Form fields
    const [docType, setDocType] = useState('03'); // 03 = Boleta
    const [docNumber, setDocNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [series, setSeries] = useState('B002');

    // Toggle between Boleta (DNI) and Factura (RUC)
    useEffect(() => {
        setSeries(docType === '03' ? 'B002' : 'F002');

        if (docType === '03') {
            // Initial Pre-fill from account for Boleta
            if (account) {
                setDocNumber(account.clientDni || '');
                setCustomerName(account.customerName || '');
                setCustomerAddress(account.clientAddress || '');
            }
        } else {
            // Clear fields for RUC/Factura to start fresh
            setDocNumber('');
            setCustomerName('');
            setCustomerAddress('');
            setCustomerEmail('');
        }
    }, [docType, account]);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/billing/config');
            if (res.data) {
                setConfig(res.data);
                setIsExonerado(res.data.operacionesExoneradas === true || res.data.operacionesExoneradas === 'true');
                setIgvRateInput(parseFloat(res.data.igvTasa || '18'));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    // Fetch History
    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/accounts/specific/${account.id}`);
            if (res.data && res.data.Invoices) {
                setHistory(res.data.Invoices);
            }
        } catch (error) {
            console.error('Error fetching billing history:', error);
        }
    };

    useEffect(() => {
        if (account?.id) {
            fetchHistory();
            fetchSettings();
        }
    }, [account.id]);

    // Generate Items from Account (Orders)
    const availableItems = useMemo(() => {
        const items = [];
        
        if (account.Orders && account.Orders.length > 0) {
            account.Orders.forEach((ord, idx) => {
                if (ord.status === 'cancelled') return;

                const price = ord.priceAtOrder && !isNaN(ord.priceAtOrder) ? parseFloat(ord.priceAtOrder) : (ord.Product?.price || 0);

                let pName = "Producto";
                let displayNotes = ord.notes;
                if (!ord.ProductId && ord.notes) {
                    pName = ord.notes.includes(' + ') ? `2x1: ${ord.notes}` : ord.notes;
                    displayNotes = null;
                } else if (ord.Product && ord.Product.name) {
                    pName = ord.Product.name;
                }
                const fullDesc = `${pName} ${ord.presentation ? `(${ord.presentation})` : ''} ${displayNotes ? `- ${displayNotes}` : ''}`.trim().replace(/\s+/g, ' ');

                items.push({
                    id: `ord-${ord.id || idx}`,
                    group: 'Consumos',
                    description: fullDesc,
                    amount: parseFloat((price * (ord.quantity || 1)).toFixed(2)),
                    qty: ord.quantity || 1,
                    icon: <ShoppingCart size={16} />,
                    orderId: ord.id
                });
            });
        }

        return items;
    }, [account]);

    // Calculate totals for summary (excluding cancelled/anulado)
    const activeHistory = useMemo(() => history.filter(d => d.status !== 'anulado'), [history]);

    // Track which items are already billed (Only from active/non-cancelled documents)
    const billedMap = useMemo(() => {
        const counts = new Map();
        activeHistory.forEach(doc => {
            try {
                const items = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []);
                items.forEach(i => {
                    const current = counts.get(i.description) || 0;
                    counts.set(i.description, current + (parseInt(i.quantity || i.qty || 1)));
                });
            } catch (e) {}
        });
        return counts;
    }, [activeHistory]);

    // NEW Robust Billed Item Matching (Sequential)
    const pendingItems = useMemo(() => {
        // 1. Get total count of items already billed from history
        let totalQtyBilled = 0;
        activeHistory.forEach(doc => {
            try {
                const items = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []);
                items.forEach(i => {
                    totalQtyBilled += parseInt(i.quantity || i.qty || 1);
                });
            } catch (e) {}
        });

        // 2. Consume items from the top of availableItems
        // This is more robust than matching by description string, which can change
        return availableItems.slice(totalQtyBilled);
    }, [availableItems, activeHistory]);
    
    // Unified Sync & Auto-Select Hook
    useEffect(() => {
        setSelectedItems(prevSelection => {
            // Priority 1: Sync (Remove stale items that are no longer pending)
            const stillPending = prevSelection.filter(s => 
                pendingItems.some(p => p.id === s.id)
            );
            
            // Priority 2: Auto-select everything ONLY if nothing is selected yet 
            // AND the user hasn't explicitly unselected everything.
            // This also automatically selects everything on first open.
            if (stillPending.length === 0 && pendingItems.length > 0 && prevSelection.length === 0 && history.length > 0) {
               return pendingItems;
            }

            // Provide initial fallback if history is 0 but we want to auto-select
            if (history.length === 0 && pendingItems.length > 0 && prevSelection.length === 0) {
               return pendingItems;
            }

            return stillPending;
        });
    }, [pendingItems, history.length]);

    // Grouping logic for the sidebar
    const groupedItems = useMemo(() => {
        const groups = {};
        pendingItems.forEach(item => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        });
        return groups;
    }, [pendingItems]);

    // Calculate totals
    const totalSelected = selectedItems.reduce((acc, item) => acc + item.amount, 0);
    const totalAlreadyBilled = useMemo(() => activeHistory.reduce((acc, doc) => acc + parseFloat(doc.total || 0), 0), [activeHistory]);
    const totalPossible = availableItems.reduce((acc, item) => acc + item.amount, 0);
    const remainingBalance = Math.max(0, totalPossible - totalAlreadyBilled);

    // Auto-select history if there is no pending balance
    useEffect(() => {
        if (remainingBalance <= 0.01 && history.length > 0) {
            setActiveTab('history');
        }
    }, [remainingBalance, history]);

    // Tax Breakdown Calculation (Wave 3 Match)
    const breakdown = useMemo(() => {
        const totalPay = totalSelected;
        const finalTotalPay = totalSelected;
        const rate = isExonerado ? 0 : (igvRateInput / 100);
        const finalTotalIgv = isExonerado ? 0 : parseFloat((finalTotalPay - (finalTotalPay / (1 + rate))).toFixed(2));
        const finalTotalBase = parseFloat((finalTotalPay - finalTotalIgv).toFixed(2));

        return {
            total_gravada: isExonerado ? 0 : finalTotalBase,
            total_exonerada: isExonerado ? finalTotalBase : 0,
            total_inafecta: 0,
            total_igv: finalTotalIgv,
            total_pay: finalTotalPay,
            total: finalTotalPay
        };
    }, [totalSelected, isExonerado, igvRateInput]);

    // Toggle item selection
    const toggleItem = (item) => {
        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    // UTILITIES from BillingModal
    const handleShareWhatsapp = (inv, type = 'invoice') => {
        let publicUrl;
        if (type === 'nc') {
            publicUrl = inv.notaCreditoUrl || inv.sunatResponse?.url_ticket || '#';
            if (!publicUrl || publicUrl === '#') {
                alert('No hay enlace de PDF disponible para compartir la Nota de Crédito');
                return;
            }
        } else {
            const hashId = btoa(`makala_${inv.id}`);
            publicUrl = `${window.location.origin}/c/${hashId}`;
        }
        
        const guestPhone = account?.clientPhone || inv.clienteDocumento || '';
        const userPhone = window.prompt('Ingrese el número de WhatsApp del cliente (ej. 999888777):', guestPhone);
        if (userPhone === null) return; // cancelled
        
        const cleanPhone = userPhone.replace(/\D/g, '');
        
        const docName = type === 'nc' ? 'Nota de Crédito' : (inv.tipo === 'factura' ? 'Factura' : 'Boleta');
        const docId = type === 'nc' ? inv.notaCredito : `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
        const message = `Hola ${inv.clienteNombre || customerName}, le adjuntamos su ${docName} ${docId}: ${publicUrl}`;
        
        const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('51') ? (cleanPhone.length > 2 ? cleanPhone : '51' + cleanPhone) : '51' + cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleDirectPrint = (url) => {
        if (!url) return;
        const busterUrl = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = busterUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            try { iframe.contentWindow.print(); } catch (e) { window.open(busterUrl, '_blank'); }
            setTimeout(() => document.body.removeChild(iframe), 5000);
        };
    };

    const handlePrintLocalInvoice = (invoice) => {
        if (!invoice) return;
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (!printWindow) {
            alert('Por favor habilite las ventanas emergentes (popups) para poder imprimir.');
            return;
        }

        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
        const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : new Date().toLocaleString();
        const docName = invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA';
        
        const rucEmpresa = config?.ruc || '20614409593';
        const nameEmpresa = config?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
        const addressEmpresa = config?.direccion || 'Av. Larco 123, Miraflores, Lima';

        // Check for Amazonas exoneration (exoneradas or igv === 0)
        const isExonerated = config?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
        const totalAmount = parseFloat(invoice.total || 0);
        const igvAmount = isExonerated ? 0 : parseFloat(invoice.igv || 0);
        const opAmount = isExonerated ? totalAmount : parseFloat(invoice.subtotal || 0);
        const opLabel = isExonerated ? 'OP. EXONERADA:' : 'OP. GRAVADA:';
        const igvLabel = isExonerated ? 'I.G.V. (0%):' : `I.G.V. (${config?.igvTasa || 18}%):`;

        // Generate SUNAT QR Code pipe-delimited string
        const tipoComp = invoice.tipo === 'factura' ? '01' : '03';
        let tipoDocAdq = '0';
        if (invoice.clienteDocumento) {
            if (invoice.clienteDocumento.length === 11) tipoDocAdq = '6'; // RUC
            else if (invoice.clienteDocumento.length === 8) tipoDocAdq = '1'; // DNI
        }
        const nroDocAdq = invoice.clienteDocumento || '00000000';
        
        const rawDate = invoice.emitidoAt || invoice.createdAt || new Date();
        const dateObj = new Date(rawDate);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        const qrString = `${rucEmpresa}|${tipoComp}|${invoice.serie}|${invoice.correlativo}|${igvAmount.toFixed(2)}|${totalAmount.toFixed(2)}|${formattedDate}|${tipoDocAdq}|${nroDocAdq}|`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrString)}`;

        // Verify if it is electronic
        const isElectronico = !!(
            invoice.sunatResponse && 
            (() => {
                try {
                    const parsed = typeof invoice.sunatResponse === 'string' ? JSON.parse(invoice.sunatResponse) : invoice.sunatResponse;
                    return parsed && !parsed.error && parsed.success !== false;
                } catch (e) {
                    return false;
                }
            })()
        );

        const clienteDireccionHtml = invoice.clienteDireccion ? `<div><b>DIRECCIÓN:</b> ${invoice.clienteDireccion.toUpperCase()}</div>` : '';

        printWindow.document.write(`
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
                <title>${invoice.tipo === 'factura' ? 'Factura' : 'Boleta'}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace, sans-serif;
                        margin: 0;
                        padding: 20px 0;
                        background-color: #e2e8f0;
                        display: flex;
                        justify-content: center;
                        min-height: 100vh;
                    }
                    .ticket {
                        width: 72mm;
                        background-color: #ffffff;
                        padding: 5mm 2mm;
                        color: #000;
                        font-size: 11px;
                        line-height: 1.3;
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .header { margin-bottom: 5mm; }
                    .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
                    .document-title { font-size: 12px; font-weight: bold; border: 1px solid #000; padding: 4px; margin: 4mm 0; text-transform: uppercase; }
                    .divider { border-top: 1px dashed #000; margin: 3mm 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
                    th { border-bottom: 1px dashed #000; padding: 2px 0; font-size: 10px; text-transform: uppercase; }
                    td { padding: 3px 0; vertical-align: top; }
                    .totals { margin-top: 4mm; }
                    .totals-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
                    .footer { margin-top: 8mm; font-size: 9px; }
                    .sunat-badge {
                        background-color: #e6f4ea;
                        color: #137333;
                        font-weight: bold;
                        border: 1px solid #a8dab5;
                        padding: 4px 8px;
                        border-radius: 4px;
                        display: inline-block;
                        font-size: 10px;
                        text-transform: uppercase;
                        margin-bottom: 3mm;
                    }
                    .close-button {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background-color: #ffffff;
                        color: #0f172a;
                        border: 2px solid #cbd5e1;
                        border-radius: 50%;
                        width: 56px;
                        height: 56px;
                        font-size: 28px;
                        font-weight: bold;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
                        z-index: 1000;
                        transition: all 0.2s;
                    }
                    .close-button:hover {
                        background-color: #f8fafc;
                        transform: scale(1.05);
                    }
                    @media print {
                        body { background-color: #ffffff; padding: 0; display: block; }
                        .ticket { box-shadow: none; margin: 0 auto; }
                        .close-button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <button class="close-button" onclick="window.close()" title="Cerrar vista">✕</button>
                <div class="ticket">
                    <div class="text-center header">
                    <div class="company-name">${nameEmpresa}</div>
                    <div>RUC: ${rucEmpresa}</div>
                    <div>${addressEmpresa.toUpperCase()}</div>
                    <div class="document-title">
                        ${docName}<br>
                        ${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}
                    </div>
                </div>
                
                <div>
                    <div><b>FECHA EMISIÓN:</b> ${dateStr}</div>
                    <div><b>SEÑOR(ES):</b> ${(invoice.clienteNombre || 'CLIENTES VARIOS').toUpperCase()}</div>
                    <div><b>${invoice.tipo === 'factura' ? 'RUC' : 'DNI'}:</b> ${nroDocAdq}</div>
                    ${clienteDireccionHtml}
                    <div><b>MÉTODO PAGO:</b> EFECTIVO</div>
                </div>
                
                <div class="divider"></div>
                
                <table>
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 10%;">CANT</th>
                            <th style="width: 45%;">DESCRIPCIÓN</th>
                            <th class="text-right" style="width: 20%;">P.UNIT</th>
                            <th class="text-right" style="width: 25%;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
                            const qty = item.qty || item.quantity || 1;
                            const total = parseFloat(item.amount || item.subtotal || 0);
                            const pUnit = total / qty;
                            return `
                                <tr>
                                    <td class="text-center">${qty}</td>
                                    <td style="text-transform: uppercase;">${item.description}</td>
                                    <td class="text-right">S/ ${pUnit.toFixed(2)}</td>
                                    <td class="text-right">S/ ${total.toFixed(2)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div class="divider"></div>
                
                <div class="totals">
                    <div class="totals-row">
                        <span>${opLabel}</span>
                        <span>S/ ${opAmount.toFixed(2)}</span>
                    </div>
                    <div class="totals-row">
                        <span>OP. INAFECTA:</span>
                        <span>S/ 0.00</span>
                    </div>
                    <div class="totals-row">
                        <span>${igvLabel}</span>
                        <span>S/ ${igvAmount.toFixed(2)}</span>
                    </div>
                    <div class="totals-row bold" style="font-size: 13px;">
                        <span>TOTAL A PAGAR:</span>
                        <span>S/ ${totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                ${isElectronico ? `
                <div class="text-center" style="margin-top: 3mm; margin-bottom: 3mm;">
                    <div class="sunat-badge">
                        [✓] ACEPTADA POR SUNAT
                    </div>
                </div>
                ` : ''}

                <div class="text-center" style="margin-top: 4mm; margin-bottom: 4mm;">
                    <img src="${qrCodeUrl}" style="width: 120px; height: 120px;" alt="Código QR SUNAT" />
                </div>

                <div class="text-center footer">
                    <b>REPRESENTACIÓN IMPRESA DE COMPROBANTE DE PAGO</b><br>
                    <span>Autorizado mediante Resolución de SUNAT</span><br><br>
                    <b>¡Gracias por su preferencia!</b>
                </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleSearchCustomer = async () => {
        if (!docNumber || docNumber.length < 8) return;
        setIsSearchLoading(true);
        try {
            const res = await axios.get(`/api/billing/consulta?doc=${docNumber}`);
            if (res.data) {
                const name = res.data.razon_social
                    || res.data.nombre
                    || `${res.data.nombres || ''} ${res.data.apellidoPaterno || ''} ${res.data.apellidoMaterno || ''}`.trim();
                const address = res.data.direccion || '';
                if (name) setCustomerName(name);
                if (address) setCustomerAddress(address);
                if (docNumber.length === 11) setDocType('01');
                else setDocType('03');
            }
        } catch (error) {
            console.warn('Customer lookup failed');
        } finally {
            setIsSearchLoading(false);
        }
    };

    // Auto-search when docNumber has 8 or 11 digits
    useEffect(() => {
        const cleanDoc = docNumber.trim();
        if (cleanDoc.length === 8 || cleanDoc.length === 11) {
            const timer = setTimeout(() => {
                handleSearchCustomer();
            }, 500);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docNumber]);

    // Submit Invoice
    const handleSubmit = async () => {
        if (selectedItems.length === 0) return;
        if (!customerName) return;

        // Validar RUC para Facturas
        if (docType === '01') {
            if (!docNumber) {
                setErrorMsg('El número de RUC es requerido para emitir una factura.');
                return;
            }
            const cleanDoc = docNumber.trim();
            if (cleanDoc.length !== 11 || !/^\d+$/.test(cleanDoc)) {
                setErrorMsg('El RUC debe tener exactamente 11 dígitos numéricos.');
                return;
            }
            const prefix = cleanDoc.substring(0, 2);
            if (!['10', '15', '17', '20'].includes(prefix)) {
                setErrorMsg('El RUC ingresado no es válido (debe empezar con 10, 15, 17 o 20).');
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                accountId: account.id,
                userId: user?.id || null,
                items: selectedItems.map(i => ({
                    description: i.description,
                    amount: i.amount,
                    quantity: i.qty
                })),
                clienteDocumento: docNumber,
                clienteNombre: customerName,
                clienteDireccion: customerAddress || '-',
                tipo: docType === '01' ? 'factura' : 'boleta'
            };

            const res = await axios.post(`/api/billing/invoices`, payload);
            const ticketUrl = res.data.sunatResponse?.url_ticket || res.data.sunatResponse?.url || res.data.sunatResponse?.pdf_url || res.data.invoice?.pdfUrl;

            if (res.data.success) {
                setLastIssuedUrl(ticketUrl || '#');
                setLastIssuedDoc(res.data.invoice);
                setSuccessType('invoice');
                setIsSuccess(true);
                setSelectedItems([]);
                fetchHistory(); 
                if (onRefresh) onRefresh();
                if (socket) {
                    socket.emit('trigger_qr_display');
                }
            } else {
                throw new Error(res.data.error || 'Error desconocido al emitir comprobante');
            }
        } catch (error) {
            console.error('Split error:', error);
            setErrorMsg(error.response?.data?.error || 'Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleAnnul = async (doc) => {
        if (!window.confirm(`¿Está seguro de anular el comprobante ${doc.serie}-${doc.correlativo}? Se emitirá una Nota de Crédito.`)) return;
        
        setLoading(true);
        try {
            const res = await axios.post(`/api/billing/invoices/${doc.id}/anular`, {
                reason: 'Anulación por error en datos / Gestión de Comprobantes'
            });
            
            if (res.data.success) {
                const ncUrl = res.data.invoice?.notaCreditoUrl || res.data.sunatResponse?.url_ticket || '#';
                fetchHistory();
                if (onRefresh) onRefresh();
                
                // Show success modal for NC
                setLastIssuedUrl(ncUrl);
                setLastIssuedDoc(res.data.invoice);
                setSuccessType('nc');
                setIsSuccess(true);
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // RENDER HELPERS (DRY & RESPONSIVE DESIGN)
    // ==========================================

    const renderSummaryBox = () => (
        <div className="bg-indigo-700 p-6 md:p-8 text-white relative shrink-0 border-b border-indigo-800 shadow-xl shadow-slate-100/50 rounded-[1.5rem] md:rounded-none">
            <span className="text-[9px] font-bold text-indigo-200/80 uppercase tracking-widest block mb-2">SALDO PENDIENTE</span>
            
            <div className="text-4xl font-black mb-6 tracking-tighter">
                <span className="text-2xl font-bold text-indigo-100 mr-2">S/</span>
                {remainingBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold">
                <div className="text-indigo-100/80">
                    Total cuenta: <span className="text-white">S/ {totalPossible.toFixed(2)}</span>
                </div>
                <div className="text-indigo-100/80">
                    Emitido: <span className="text-white">S/ {totalAlreadyBilled.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );

    const renderItemsList = () => (
        <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Ítems Disponibles</h3>
            {Object.keys(groupedItems).length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center py-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No hay ítems pendientes<br/>de facturación</p>
                </div>
            ) : (
                Object.keys(groupedItems).map((groupName) => {
                    const groupItems = groupedItems[groupName];
                    const isExpanded = expandedGroups.includes(groupName);
                    const allSelected = groupItems.length > 0 && groupItems.every(i => selectedItems.find(s => s.id === i.id));

                    const handleToggleGroup = (e) => {
                        e.stopPropagation();
                        if (allSelected) {
                            setSelectedItems(prev => prev.filter(p => !groupItems.find(g => g.id === p.id)));
                        } else {
                            const newSelection = [...selectedItems];
                            groupItems.forEach(item => {
                                if (!newSelection.find(s => s.id === item.id)) {
                                    newSelection.push(item);
                                }
                            });
                            setSelectedItems(newSelection);
                        }
                    };

                    return (
                        <div key={groupName} className="mb-3">
                            <div 
                                onClick={() => setExpandedGroups(isExpanded ? expandedGroups.filter(g => g !== groupName) : [...expandedGroups, groupName])}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all border cursor-pointer group/header
                                    ${isExpanded ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent hover:bg-slate-50'}
                                `}
                            >
                                <div className="flex-1 flex items-center justify-between mr-6">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-black text-slate-700 tracking-tight capitalize">{groupName.toLowerCase()}</span>
                                        <span className="text-[10px] font-bold text-slate-300">({groupItems.length} {groupName.toLowerCase().includes('alojamiento') ? 'noches' : 'ítems'})</span>
                                    </div>
                                    <span className="text-[11px] font-black text-slate-800">
                                        {groupItems.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleToggleGroup}
                                        className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all
                                            ${allSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'}
                                        `}
                                    >
                                        {allSelected ? 'QUITAR' : 'TODO'}
                                    </button>
                                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="mt-2 space-y-1.5 ml-2 border-l-2 border-slate-100 pl-3">
                                    {groupItems.map((item) => {
                                        const isSelected = selectedItems.find(i => i.id === item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(item)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border
                                                    ${isSelected 
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-900/10' 
                                                        : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'}
                                                `}
                                            >
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className={`text-[8px] font-black px-1.5 rounded uppercase tracking-tighter ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            {item.qty} UNI
                                                        </span>
                                                        <span className="text-[10px] font-black truncate leading-tight block">{item.description}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>S/ {item.amount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {isSelected && <Check size={14} strokeWidth={4} className="shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );

    const renderHistoryList = (isMobile = false) => (
        <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Comprobantes Emitidos</h3>
            <div className="space-y-3">
                {remainingBalance > 0.01 && !isMobile && (
                    <button 
                        className="w-full text-left p-4 rounded-[1.5rem] border-2 border-dashed border-blue-100 bg-blue-50/20 hover:bg-blue-50 hover:border-blue-200 transition-all group"
                        onClick={() => document.getElementById('preparation-slide')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
                                <FileText size={18} />
                            </div>
                            <div>
                                <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest block leading-none">Nueva Emisión</span>
                            </div>
                        </div>
                    </button>
                )}

                {history.length === 0 && (
                    <p className="text-[10px] font-black text-slate-300 uppercase text-center py-4 tracking-widest">Sin historial de emisiones</p>
                )}

                {history.map((doc) => (
                    <button 
                        key={doc.id}
                        className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/30 transition-all group relative overflow-hidden active:scale-[0.98]"
                        onClick={() => {
                            if (isMobile) {
                                setSelectedDocId(doc.id);
                            } else {
                                const el = document.getElementById(`doc-slide-${doc.id}`);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                }
                            }
                        }}
                    >
                        <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all flex items-center justify-center shrink-0">
                                    <Printer size={18} />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded uppercase text-[10px] font-black shrink-0 ${doc.status === 'anulado' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                            {doc.tipoDocumento === '01' ? 'Factura' : 'Boleta'} {doc.serie}-{doc.correlativo}
                                        </span>
                                        {doc.status === 'anulado' && <span className="text-[9px] font-black text-rose-500 shrink-0">ANULADA</span>}
                                    </div>
                                    <div className="text-[11px] font-extrabold text-slate-500 truncate max-w-[125px] lg:max-w-[200px] uppercase tracking-tight">
                                        {doc.clienteNombre || account.customerName || 'Varios'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                                <div className="text-sm font-black text-slate-800">S/ {parseFloat(doc.total).toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                                    {new Date(doc.createdAt).toLocaleDateString([], {day:'2-digit', month:'2-digit'})} {new Date(doc.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderFormCard = (isMobile = false) => (
        <div className="bg-white rounded-none md:rounded-[2rem] h-full flex flex-col border border-slate-100 shadow-2xl shadow-blue-900/5 overflow-hidden transition-all relative">
            <div className="overflow-y-auto custom-scrollbar flex-1 p-6 md:p-10 space-y-8 md:space-y-10">
                {/* Header Area */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Preparación</span>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter leading-none">Comprobante</h1>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">TOTAL PARCIAL</span>
                        <div className="text-2xl md:text-3xl font-black text-slate-800 flex items-baseline justify-end gap-1 tracking-tighter leading-none">
                            <span className="text-sm font-medium text-slate-300">S/</span>
                            {totalSelected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                {/* Form UI - COMPACT VERSION */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">Doc. Cliente</label>
                            <div className="flex p-1 bg-slate-50 rounded-xl w-full border border-slate-100">
                                <button className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${docType === '03' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`} onClick={() => setDocType('03')}>DNI</button>
                                <button className={`flex-1 py-2 text-[9px] font-black rounded-lg transition-all ${docType === '01' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`} onClick={() => setDocType('01')}>RUC</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">Número</label>
                            <div className="relative">
                                <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} onBlur={handleSearchCustomer} className="w-full bg-slate-50 border-transparent px-4 py-3 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder={docType === '03' ? "DNI" : "RUC"} />
                                <button onClick={handleSearchCustomer} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${docNumber.length >= 8 ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>
                                    {isSearchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">Nombre / Razón Social</label>
                            <div className="relative">
                                 <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-slate-50 border-transparent px-4 py-3 rounded-xl text-xs font-black text-slate-700" />
                            </div>
                        </div>
                    </div>

                    {/* Voucher Details Selection */}
                    <div className="bg-blue-50/30 border border-blue-50 p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                                <FileText size={16} />
                            </div>
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{docType === '03' ? 'BOLETA' : 'FACTURA'}</span>
                        </div>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Serie {series}</span>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4">Ítems Seleccionados</div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                            {selectedItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-transparent">
                                    <span className="text-[10px] font-black text-slate-600 truncate max-w-[200px]">{item.description}</span>
                                    <span className="text-[10px] font-black text-slate-900 shrink-0">S/ {item.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            {selectedItems.length === 0 && (
                                <div className="py-8 text-center text-slate-200 text-[9px] font-bold uppercase tracking-widest border-2 border-dashed border-slate-50 flex flex-col gap-2 rounded-2xl">
                                    {isMobile ? 'Seleccione ítems arriba' : 'Seleccione ítems a la izquierda'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-50 shrink-0">
                <button 
                    onClick={handleSubmit} 
                    disabled={loading || selectedItems.length === 0}
                    className={`w-full py-4 md:py-5 rounded-[1.2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all active:scale-[0.98]
                        ${loading || selectedItems.length === 0 ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white shadow-xl shadow-blue-900/20 hover:bg-black'}`}
                >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : <><span>EMITIR COMPROBANTE</span><ArrowRight size={16} /></>}
                </button>
            </div>
        </div>
    );

    const renderDocCard = (doc, onBack = null) => {
        const isAnulado = doc.status === 'anulado';
        const docLabel = doc.tipo === 'factura' ? 'Factura' : 'Boleta';
        const docItems = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []);
        const { pdf: billingUrl, xml: xmlUrl } = getSunatUrls(doc.sunatResponse);
        const creditNoteId = doc.notaCredito;
        const creditNoteUrl = doc.notaCreditoUrl;

        return (
            <div className={`bg-white rounded-none md:rounded-[2rem] h-full flex flex-col border transition-all overflow-hidden shadow-2xl shadow-blue-900/5
                ${isAnulado ? 'border-rose-100 opacity-90' : 'border-slate-100'}
            `}>
                <div className="overflow-y-auto custom-scrollbar flex-1 p-6 md:p-10 space-y-8 md:space-y-10">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4 hover:underline"
                        >
                            <ArrowLeft size={14} /> Volver al Listado
                        </button>
                    )}
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm ${isAnulado ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                    {isAnulado ? 'ANULADO' : 'EMITIDO'}
                                </span>
                            </div>
                            <h2 className={`text-lg font-black tracking-tighter uppercase ${isAnulado ? 'text-slate-300' : 'text-slate-800'} flex flex-wrap items-center gap-2`}>
                                <span>{docLabel}</span>
                                <span className="text-slate-400 font-medium tracking-normal text-base">[{doc.serie}-{doc.correlativo}]</span>
                            </h2>
                            {isAnulado && creditNoteId && (
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[10px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-lg border border-rose-100 uppercase tracking-widest shadow-sm">
                                        NC: {creditNoteId}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="text-left sm:text-right">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">TOTAL</span>
                            <div className="text-3xl font-black text-slate-800 flex items-baseline sm:justify-end gap-1 tracking-tighter leading-none">
                                <span className="text-sm font-medium text-slate-300">S/</span>
                                {parseFloat(doc.total).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Client & Detail */}
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cliente</span>
                            <p className="text-sm font-black text-slate-700 leading-tight uppercase">{doc.clienteNombre || account.customerName || 'Varios'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{doc.clienteDocumento || '---'}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-50">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-3">Detalle de Cobro</span>
                            <div className="space-y-2">
                                {docItems.map((it, i) => (
                                    <div key={i} className="flex justify-between items-center py-2 px-3 bg-slate-50/50 rounded-lg">
                                        <span className="text-[9px] font-black text-slate-500 max-w-[200px] truncate">
                                            {it.quantity || it.qty || 1} x {it.description || it.name}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-800 shrink-0">S/ {parseFloat(it.amount || it.price || 0).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-50 mt-auto shrink-0">
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <button 
                                onClick={(e) => {
                                    if (billingUrl) {
                                        window.open(billingUrl.includes('?') ? `${billingUrl}&v=${Date.now()}` : `${billingUrl}?v=${Date.now()}`, '_blank');
                                    } else {
                                        e.preventDefault();
                                        handlePrintLocalInvoice(doc);
                                    }
                                }}
                                className={`flex-1 px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm border
                                    ${isAnulado ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-slate-600'}
                                `}
                            >
                                <FileText size={16} /> VER {doc.tipo === 'factura' ? 'FACTURA' : 'BOLETA'}
                            </button>
                            <div className="flex gap-2 shrink-0">
                                <button 
                                    onClick={() => handleShareWhatsapp(doc, 'invoice')} 
                                    className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                                    title="WhatsApp Comprobante"
                                >
                                    <WhatsAppIcon size={20} />
                                </button>
                                {!isAnulado && (
                                    <button 
                                        onClick={() => handleAnnul(doc)}
                                        className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all border border-rose-100 shadow-sm"
                                        title="Anular Documento"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {isAnulado && creditNoteUrl && (
                            <div className="flex gap-3 pt-3 border-t border-slate-100/50">
                                <a 
                                    href={creditNoteUrl.includes('?') ? `${creditNoteUrl}&v=${Date.now()}` : `${creditNoteUrl}?v=${Date.now()}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex-1 bg-rose-50 border border-rose-100 hover:border-rose-200 hover:bg-rose-100/30 text-rose-600 px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <FileText size={16} /> VER NOTA DE CRÉDITO
                                </a>
                                <button 
                                    onClick={() => handleShareWhatsapp(creditNoteUrl)} 
                                    className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                                    title="WhatsApp Nota de Crédito"
                                >
                                    <WhatsAppIcon size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isSuccess) {
        return createPortal(
            <div className="fixed inset-0 z-[10000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white">
                    <div className="p-8 text-center bg-slate-50/50 border-b border-slate-100">
                        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl shadow-emerald-900/10">
                            <Check className="text-emerald-600" size={40} strokeWidth={3} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">
                            {successType === 'nc' ? '¡Anulado!' : '¡Éxito!'}
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                            {successType === 'nc' ? 'Nota de Crédito generada' : 'Comprobante generado correctamente'}
                        </p>
                    </div>
                    
                    <div className="p-6 space-y-3">
                        <button
                            onClick={() => handleShareWhatsapp(lastIssuedDoc, successType === 'nc' ? 'nc' : 'invoice')}
                            className="w-full flex items-center justify-center gap-3 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95"
                        >
                            <WhatsAppIcon size={20} />
                            Compartir WhatsApp
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleDirectPrint(lastIssuedUrl)}
                                className="flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 text-slate-600 active:scale-95 transition-all"
                            >
                                <Printer size={16} />
                                Imprimir
                            </button>
                            <button
                                onClick={() => setIsSuccess(false)}
                                className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black active:scale-95 transition-all shadow-md"
                            >
                                Nueva Emisión
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full md:max-w-[1400px] h-full md:h-[94vh] rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                
                {/* Header Area */}
                <div className="px-6 md:px-10 py-4 md:py-6 border-b flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100 flex-shrink-0 animate-in zoom-in-50 duration-500">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Gestión de Comprobantes</h2>
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">Cuenta #{account.id}</span>
                                {account.Table && (
                                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">Mesa #{account.Table.number}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose} 
                        disabled={loading}
                        className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all group
                            ${loading ? 'bg-blue-50 text-blue-600' : 'hover:bg-red-50 text-slate-300 hover:text-red-500'}
                        `}
                    >
                        {loading ? (
                            <Loader size={24} className="animate-spin" />
                        ) : (
                            <X size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                        )}
                    </button>
                </div>

                {/* Error Alert Section */}
                {errorMsg && (
                    <div className="mx-6 md:mx-10 mt-4 animate-in slide-in-from-top-2 duration-300 shrink-0">
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                                <AlertCircle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Error de Comunicación SUNAT</h4>
                                <p className="text-xs font-bold text-rose-800 leading-tight">{errorMsg}</p>
                            </div>
                            <button onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-rose-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* MOBILE VIEW LAYOUT */}
                <div className="flex-1 flex flex-col md:hidden overflow-hidden bg-slate-50/50">
                    {/* Tab Selector for Mobile */}
                    <div className="flex border-b border-slate-100 bg-white shrink-0">
                        {remainingBalance > 0.01 && (
                            <button
                                onClick={() => {
                                    setActiveTab('emit');
                                    setSelectedDocId(null);
                                }}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 text-center transition-all ${
                                    activeTab === 'emit' ? 'border-blue-600 text-blue-600 bg-blue-50/10' : 'border-transparent text-slate-400'
                                }`}
                            >
                                Emitir
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setActiveTab('history');
                                setSelectedDocId(null);
                            }}
                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 text-center transition-all ${
                                activeTab === 'history' ? 'border-blue-600 text-blue-600 bg-blue-50/10' : 'border-transparent text-slate-400'
                            }`}
                        >
                            Comprobantes ({history.length})
                        </button>
                    </div>

                    {/* Mobile Contents */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeTab === 'emit' ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {renderSummaryBox()}
                                <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                                    {renderItemsList()}
                                </div>
                                <div className="rounded-[2rem] overflow-hidden">
                                    {renderFormCard(true)}
                                </div>
                            </div>
                        ) : (
                            // Tab = history
                            selectedDocId ? (
                                // Show specific voucher details
                                <div className="flex-1 overflow-y-auto p-4 h-full">
                                    {renderDocCard(
                                        history.find(d => d.id === selectedDocId),
                                        () => setSelectedDocId(null)
                                    )}
                                </div>
                            ) : (
                                // Show list of vouchers
                                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                    {renderSummaryBox()}
                                    <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                                        {renderHistoryList(true)}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* DESKTOP VIEW LAYOUT */}
                <div className="hidden md:flex flex-1 flex-row bg-slate-50/5 overflow-hidden">
                    {/* SIDEBAR: Financials + Items + History */}
                    <div className="w-[340px] min-w-[340px] basis-[340px] lg:w-[420px] lg:min-w-[420px] lg:basis-[420px] h-full border-r flex flex-col bg-white shrink-0 relative z-10">
                        {renderSummaryBox()}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-8">
                            {renderItemsList()}
                            {renderHistoryList(false)}
                        </div>
                    </div>

                    {/* CAROUSEL MAIN VIEW */}
                    <div className="flex-1 flex flex-col relative bg-slate-50/10 overflow-hidden">
                        <div className="flex-1 flex flex-row overflow-x-auto snap-x p-8 gap-8 items-start">
                            {remainingBalance > 0.01 && (
                                <div id="preparation-slide" className="min-w-[calc(100%/2.15)] h-[calc(100vh-250px)] max-h-[850px] snap-start shrink-0">
                                    {renderFormCard(false)}
                                </div>
                            )}

                            {remainingBalance > 0.01 && history.length > 0 && (
                                <div className="h-full border-r-2 border-dashed border-slate-200/50 shrink-0 mx-2 shadow-inner" />
                            )}

                            {history.map((doc) => (
                                <div id={`doc-slide-${doc.id}`} key={doc.id} className="min-w-[calc(100%/2.15)] h-[calc(100vh-250px)] max-h-[850px] snap-start shrink-0">
                                    {renderDocCard(doc)}
                                </div>
                            ))}
                            <div className="w-48 shrink-0 h-1" />
                        </div>
                    </div>
                </div>

            </div>

            {/* Custom Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>,
        document.body
    );
};

export default InvoiceManagementModal;

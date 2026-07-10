import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, Settings, FileText, Plus, Search, Trash2, 
    CheckCircle, AlertCircle, Printer, Download,
    CreditCard, Building2, ShieldCheck, Zap, Loader, Loader2,
    ArrowRight, ExternalLink, MessageCircle
} from 'lucide-react';
import axios from 'axios';
import AccountDetailsModal from './AccountDetailsModal';
import { useRestaurant } from '../contexts/RestaurantContext';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

const WhatsAppIcon = ({ size = 16, className = "" }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.395 0 .01 5.385.01 12.037c0 2.125.547 4.197 1.59 6.042L0 24l6.135-1.61a11.745 11.745 0 005.907 1.577h.005c6.65 0 12.034-5.388 12.037-12.04a11.744 11.744 0 00-3.465-8.52z" />
    </svg>
);

const BillingConfigModal = ({ onClose }) => {
    const { user, setBillingConfig } = useRestaurant();
    const [activeTab, setActiveTab] = useState('config');
    const [viewMode, setViewMode] = useState('config');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        ruc: '',
        razonSocial: '',
        direccion: '',
        facturacionElectronica: false,
        igvTasa: 10.5,
        operacionesExoneradas: false,
        serieFactura: 'F001',
        serieBoleta: 'B001',
        apiToken: '',
        billingMode: 'libre',
        habilitarImpresion: false
    });

    // New Invoice State
    const [newInvoice, setNewInvoice] = useState({
        tipo: 'boleta',      // 'boleta' = doc '03', 'factura' = doc '01'
        clienteDocumento: '',
        clienteNombre: '',
        clienteDireccion: '',
        items: [{ description: '', amount: '', quantity: 1 }],
        accountId: null
    });

    const [invoices, setInvoices] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filters, setFilters] = useState(() => {
        const todayLocal = new Date();
        const offset = todayLocal.getTimezoneOffset();
        const localDateStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        return { documento: '', desde: localDateStr, hasta: localDateStr };
    });
    const [selectedAccountId, setSelectedAccountId] = useState(null);

    // Printer States
    const [printers, setPrinters] = useState({
        caja: { type: 'disabled', path: '', printerName: '' },
        cocina: { type: 'disabled', path: '', printerName: '' },
        barra: { type: 'disabled', path: '', printerName: '' }
    });
    const [testLoading, setTestLoading] = useState({});
    const [windowsPrinters, setWindowsPrinters] = useState([]);
    const [agentStatus, setAgentStatus] = useState('unknown'); // 'active' | 'inactive' | 'unknown'
    const [agentLatestVersion, setAgentLatestVersion] = useState(null);
    const [hasOutdatedAgent, setHasOutdatedAgent] = useState(false);

    // Derived helpers
    const isFactura = newInvoice.tipo === 'factura';
    const docLabel = isFactura ? 'RUC (11 dígitos)' : 'DNI / Documento';
    const nameLabel = isFactura ? 'Razón Social' : 'Nombre Completo';
    const docPlaceholder = isFactura ? '20...' : '7... ó 8...';
    const maxDocLength = isFactura ? 11 : 8;

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

    const fetchPrintersConfig = async () => {
        try {
            const res = await axios.get('/api/config/printers');
            if (res.data) setPrinters(res.data);
        } catch (err) {
            console.error("Error fetching printers config:", err);
        }
    };

    const checkAgentStatus = async () => {
        try {
            const res = await axios.get('/api/config/printers/agent-status');
            if (res.data?.active) {
                setAgentStatus('active');
                if (res.data.latestVersion) setAgentLatestVersion(res.data.latestVersion);
                
                // Extraer e identificar las impresoras de todas las PCs conectadas
                const allPrinters = [];
                let outdated = false;
                if (res.data.agents) {
                    res.data.agents.forEach(agent => {
                        if (res.data.latestVersion && agent.version !== res.data.latestVersion) {
                            outdated = true;
                        }
                        if (agent.printers) {
                            agent.printers.forEach(p => {
                                allPrinters.push(`[${agent.agentId}] ${p}`);
                            });
                        }
                    });
                }
                setWindowsPrinters(allPrinters);
                setHasOutdatedAgent(outdated);
            } else {
                setAgentStatus('inactive');
                setWindowsPrinters([]);
                setHasOutdatedAgent(false);
            }
        } catch (err) {
            setAgentStatus('inactive');
            setWindowsPrinters([]);
            setHasOutdatedAgent(false);
        }
    };

    const handleSavePrinters = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('/api/config/printers', printers);
            // Tambien guardamos el config para que se guarde el flag de habilitarImpresion
            await axios.put('/api/billing/config', config);
            if (setBillingConfig) setBillingConfig(config);
            alert('✅ Configuración de impresoras guardada correctamente.');
        } catch (err) {
            alert('❌ Error al guardar impresoras: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleTestPrinter = async (key) => {
        setTestLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await axios.post('/api/config/printers/test', {
                printerKey: key,
                ...printers[key]
            });
            alert('✅ ' + res.data.message);
        } catch (err) {
            alert('❌ Error de prueba: ' + (err.response?.data?.error || err.message));
        } finally {
            setTestLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchInvoices();
        fetchPrintersConfig();
        checkAgentStatus();
    }, []);

    useEffect(() => {
        let interval;
        if (activeTab === 'printers') {
            checkAgentStatus();
            interval = setInterval(checkAgentStatus, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvoices();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        if (activeTab === 'new' && config.billingMode === 'reserva') {
            fetchAccounts();
        }
    }, [activeTab, config.billingMode]);

    const fetchAccounts = async () => {
        try {
            const res = await axios.get('/api/accounts/all?status=all');
            setAccounts(res.data);
        } catch (err) {
            console.error('Error fetching accounts for billing select', err);
        }
    };

    const handleSelectAccount = async (id) => {
        if (!id) {
            setNewInvoice(prev => ({
                ...prev,
                accountId: null,
                clienteDocumento: '',
                clienteNombre: '',
                clienteDireccion: '',
                items: [{ description: '', amount: '', quantity: 1 }]
            }));
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get(`/api/accounts/specific/${id}`);
            const acc = res.data;
            
            const newItems = acc.Orders && acc.Orders.length > 0
                ? acc.Orders.map(ord => {
                    const price = ord.priceAtOrder && !isNaN(ord.priceAtOrder) 
                        ? parseFloat(ord.priceAtOrder) 
                        : parseFloat(ord.Product?.price || 0);
                    const qty = parseInt(ord.quantity || 1);
                    return {
                        description: ord.Product?.name || 'Consumo',
                        quantity: qty,
                        amount: (price * qty).toFixed(2)
                    };
                })
                : [{ description: 'Consumo de Mesa', amount: parseFloat(acc.total).toFixed(2), quantity: 1 }];

            const doc = acc.clientDni || '';
            const newTipo = doc.length === 11 ? 'factura' : 'boleta';

            setNewInvoice(prev => ({
                ...prev,
                accountId: acc.id,
                tipo: newTipo,
                clienteDocumento: doc,
                clienteNombre: acc.customerName || '',
                clienteDireccion: acc.clientAddress || '',
                items: newItems
            }));
        } catch (err) {
            console.error("Error loading specific account for invoice", err);
            alert("Error al cargar detalles de la reserva");
        } finally {
            setLoading(false);
        }
    };

    // LOGIC: When tipo changes → clear customer fields (like Gestion Mak)
    // Factura always starts empty to avoid using DNI as RUC by mistake
    useEffect(() => {
        setNewInvoice(prev => ({
            ...prev,
            clienteDocumento: '',
            clienteNombre: '',
            clienteDireccion: ''
        }));
    }, [newInvoice.tipo]);

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

    const handleDownloadLocalXml = (invoice) => {
        if (!invoice) return;
        const rucEmpresa = config?.ruc || '20614409593';
        const nameEmpresa = config?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
        const clientDoc = invoice.clienteDocumento || '00000000';
        const clientName = invoice.clienteNombre || 'CLIENTES VARIOS';
        const dateStr = invoice.createdAt ? invoice.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const docType = invoice.tipo === 'factura' ? '01' : '03'; 
        const clientDocType = invoice.tipo === 'factura' ? '6' : '1'; 
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);

        const isExonerated = config?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
        const totalVal = parseFloat(invoice.total || 0);
        const subtotalVal = isExonerated ? totalVal : parseFloat(invoice.subtotal || 0);
        const igvVal = isExonerated ? 0 : parseFloat(invoice.igv || 0);

        let itemsXml = '';
        items.forEach((item, idx) => {
            const lineTotal = parseFloat(item.amount || item.subtotal || 0);
            const qty = parseInt(item.qty || item.quantity || 1);
            const unitVal = lineTotal / qty;

            const itemTaxAmount = isExonerated ? 0 : (lineTotal * 0.18 / 1.18);
            const itemTaxableAmount = isExonerated ? lineTotal : (lineTotal / 1.18);
            const itemPriceAmount = isExonerated ? unitVal : (unitVal / 1.18);
            const itemPercent = isExonerated ? "0.00" : "18.00";
            const itemExemptionCode = isExonerated ? "20" : "10";
            const taxSchemeId = isExonerated ? "9997" : "1000";
            const taxSchemeName = isExonerated ? "EXO" : "IGV";

            itemsXml += `
        <cac:InvoiceLine>
            <cbc:ID>${idx + 1}</cbc:ID>
            <cbc:InvoicedQuantity unitCode="NIU">${qty}</cbc:InvoicedQuantity>
            <cbc:LineExtensionAmount currencyID="PEN">${itemTaxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
            <cac:PricingReference>
                <cac:AlternativeConditionPrice>
                    <cbc:PriceAmount currencyID="PEN">${unitVal.toFixed(2)}</cbc:PriceAmount>
                    <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
                </cac:AlternativeConditionPrice>
            </cac:PricingReference>
            <cac:TaxTotal>
                <cbc:TaxAmount currencyID="PEN">${itemTaxAmount.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxSubtotal>
                    <cbc:TaxableAmount currencyID="PEN">${itemTaxableAmount.toFixed(2)}</cbc:TaxableAmount>
                    <cbc:TaxAmount currencyID="PEN">${itemTaxAmount.toFixed(2)}</cbc:TaxAmount>
                    <cac:TaxCategory>
                        <cbc:Percent>${itemPercent}</cbc:Percent>
                        <cbc:TaxExemptionReasonCode>${itemExemptionCode}</cbc:TaxExemptionReasonCode>
                        <cac:TaxScheme>
                            <cbc:ID>${taxSchemeId}</cbc:ID>
                            <cbc:Name>${taxSchemeName}</cbc:Name>
                            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                        </cac:TaxScheme>
                    </cac:TaxCategory>
                </cac:TaxSubtotal>
            </cac:TaxTotal>
            <cac:Item>
                <cbc:Description><![CDATA[${item.description}]]></cbc:Description>
            </cac:Item>
            <cac:Price>
                <cbc:PriceAmount currencyID="PEN">${itemPriceAmount.toFixed(2)}</cbc:PriceAmount>
            </cac:Price>
        </cac:InvoiceLine>`;
        });

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <!-- Firma Digital Mock -->
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ID>${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}</cbc:ID>
    <cbc:IssueDate>${dateStr}</cbc:IssueDate>
    <cbc:InvoiceTypeCode listID="0101">${docType}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${rucEmpresa}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${nameEmpresa}]]></cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${clientDocType}">${clientDoc}</cbc:ID>
            </cac:PartyIdentification>
            ${invoice.clienteDireccion ? `
            <cac:PostalAddress>
                <cbc:StreetName><![CDATA[${invoice.clienteDireccion}]]></cbc:StreetName>
            </cac:PostalAddress>
            ` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${clientName}]]></cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${igvVal.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="PEN">${subtotalVal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="PEN">${igvVal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:ID>${isExonerated ? '9997' : '1000'}</cbc:ID>
                    <cbc:Name>${isExonerated ? 'EXO' : 'IGV'}</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="PEN">${subtotalVal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="PEN">${totalVal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="PEN">${totalVal.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${itemsXml}
</Invoice>`;

        const blob = new Blob([xmlContent], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${rucEmpresa}-${docType}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleShareWhatsapp = (inv, type = 'invoice') => {
        let publicUrl;
        if (type === 'nc') {
            publicUrl = inv.notaCreditoUrl;
            if (!publicUrl) {
                alert('No hay enlace de PDF disponible para compartir la Nota de Crédito');
                return;
            }
        } else {
            const hashId = btoa(`makala_${inv.id}`);
            publicUrl = `${window.location.origin}/c/${hashId}`;
        }
        
        const phone = inv.clienteDocumento?.length === 9 ? inv.clienteDocumento : '';
        const docName = type === 'nc' ? 'Nota de Crédito' : (inv.tipo === 'factura' ? 'Factura' : 'Boleta');
        const docId = type === 'nc' ? inv.notaCredito : `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
        
        const userPhone = window.prompt('Ingrese el número de WhatsApp del cliente (ej. 999888777):', phone);
        if (userPhone === null) return; // cancelled
        const cleanPhone = userPhone.replace(/\D/g, '');
        
        const message = `Hola ${inv.clienteNombre}, le adjuntamos su ${docName} ${docId}: ${publicUrl}`;
        const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('51') ? (cleanPhone.length > 2 ? cleanPhone : '51' + cleanPhone) : '51' + cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleAnnulInvoice = async (inv) => {
        const docId = `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
        const reason = window.prompt(`¿Está seguro de anular el comprobante ${docId}? Ingrese el motivo de la anulación (se emitirá una Nota de Crédito):`, 'ANULACION DE LA OPERACION');
        if (reason === null) return; // cancelled

        setLoading(true);
        try {
            const res = await axios.post(`/api/billing/invoices/${inv.id}/anular`, { reason });
            if (res.data.success) {
                alert('✅ Comprobante anulado correctamente y Nota de Crédito emitida.');
                fetchInvoices();
                const ncUrl = res.data.invoice?.notaCreditoUrl;
                if (ncUrl && window.confirm('¿Desea abrir el PDF de la Nota de Crédito generada?')) {
                    window.open(ncUrl, '_blank');
                }
            }
        } catch (err) {
            console.error(err);
            alert('❌ Error al anular: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await axios.get('/api/billing/config');
            if (res.data) setConfig(res.data);
        } catch (err) {
            console.error('Error fetching config', err);
        }
    };

    const fetchInvoices = async () => {
        try {
            const res = await axios.get('/api/billing/invoices', { params: filters });
            setInvoices(res.data);
        } catch (err) {
            console.error('Error fetching invoices', err);
        }
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        if (!config.igvTasa || isNaN(config.igvTasa) || parseFloat(config.igvTasa) < 0) {
            alert('Por favor ingrese un valor de IGV válido');
            return;
        }
        setLoading(true);
        try {
            await axios.put('/api/billing/config', config);
            // Sync the global context so printingEnabled updates everywhere immediately
            if (setBillingConfig) setBillingConfig(config);
            alert('✅ Configuración guardada correctamente.\n\nLa conexión con Sunat Hub ha sido verificada con éxito.');
            onClose(); // Cierra el modal automáticamente
        } catch (err) {
            alert('❌ Error al guardar configuración o verificar conexión: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // LOGIC: Smart search — uses /ruc or /dni endpoint depending on document length
    const handleSearchClient = async () => {
        const doc = newInvoice.clienteDocumento?.trim();
        if (!doc) return;

        if (isFactura && doc.length !== 11) {
            alert('El RUC debe tener 11 dígitos');
            return;
        }
        if (!isFactura && doc.length !== 8) {
            alert('El DNI debe tener 8 dígitos');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get(`/api/billing/consulta?doc=${doc}`);
            if (res.data) {
                const nombre = res.data.razon_social
                    || res.data.nombre
                    || `${res.data.nombres || ''} ${res.data.apellidoPaterno || ''} ${res.data.apellidoMaterno || ''}`.trim();
                setNewInvoice(prev => ({
                    ...prev,
                    clienteNombre: nombre,
                    clienteDireccion: res.data.direccion || prev.clienteDireccion
                }));
            }
        } catch (err) {
            alert(err.response?.data?.error || 'No se encontró el documento');
        } finally {
            setLoading(false);
        }
    };

    // LOGIC: Auto-detect type by document length as user types
    const handleDocumentoChange = (value) => {
        // Strip non-numeric characters
        const clean = value.replace(/\D/g, '');
        const newTipo = clean.length === 11 ? 'factura' : 'boleta';
        setNewInvoice(prev => ({
            ...prev,
            clienteDocumento: clean,
            // Only auto-switch if we haven't already manually chosen
            tipo: clean.length === 11 ? 'factura' : clean.length === 8 ? 'boleta' : prev.tipo,
            // Clear name/address if doc changes (fresh search needed)
            clienteNombre: clean !== prev.clienteDocumento ? '' : prev.clienteNombre,
            clienteDireccion: clean !== prev.clienteDocumento ? '' : prev.clienteDireccion,
        }));
    };

    const addItem = () => {
        setNewInvoice(prev => ({
            ...prev,
            items: [...prev.items, { description: '', amount: '', quantity: 1 }]
        }));
    };

    const removeItem = (index) => {
        setNewInvoice(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const updateItem = (index, field, value) => {
        setNewInvoice(prev => {
            const updated = [...prev.items];
            updated[index][field] = value;
            return { ...prev, items: updated };
        });
    };

    const calculateTotal = () => {
        return newInvoice.items.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0).toFixed(2);
    };

    const handleEmit = async () => {
        // LOGIC: Validate required fields before emitting (same as Gestion Mak)
        if (!newInvoice.clienteDocumento || !newInvoice.clienteNombre) {
            alert('El número de documento y el nombre son obligatorios');
            return;
        }

        // Validar RUC para Facturas
        if (newInvoice.tipo === 'factura') {
            const cleanDoc = (newInvoice.clienteDocumento || '').trim();
            if (cleanDoc.length !== 11 || !/^\d+$/.test(cleanDoc)) {
                alert('El RUC debe tener exactamente 11 dígitos numéricos.');
                return;
            }
            const prefix = cleanDoc.substring(0, 2);
            if (!['10', '15', '17', '20'].includes(prefix)) {
                alert('El RUC ingresado no es válido (debe empezar con 10, 15, 17 o 20).');
                return;
            }
        }

        if (!newInvoice.items.some(i => i.description && parseFloat(i.amount) > 0)) {
            alert('Debe agregar al menos un ítem con descripción y monto');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('/api/billing/invoices', newInvoice);
            if (res.data.success) {
                alert('Comprobante emitido correctamente');
                setActiveTab('history');
                fetchInvoices();
                setNewInvoice({
                    tipo: 'boleta',
                    clienteDocumento: '',
                    clienteNombre: '',
                    clienteDireccion: '',
                    items: [{ description: '', amount: '', quantity: 1 }],
                    accountId: null
                });
            }
        } catch (err) {
            alert('Error al emitir: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] md:p-4">
            <div className="bg-white md:rounded-[24px] shadow-2xl w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="px-4 md:px-6 py-4 flex justify-between items-center bg-white z-10 shrink-0 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#f4f7fe] text-[#1f63fb] rounded-xl shadow-sm">
                            {viewMode === 'config' ? <Settings size={22} strokeWidth={2.5} /> : <FileText size={22} strokeWidth={2.5} />}
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[18px] md:text-[22px] font-black text-[#1d263b] tracking-tight leading-none">
                                {viewMode === 'config' ? 'Configuración' : 'Gestión de Comprobantes'}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        {['admin', 'waiter', 'cashier'].includes(user?.role) && (
                            <button 
                                onClick={() => {
                                    if (viewMode === 'comprobantes') {
                                        setViewMode('config');
                                        setActiveTab('config');
                                    } else {
                                        setViewMode('comprobantes');
                                        setActiveTab('history');
                                    }
                                }}
                                className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-bold text-[10px] md:text-xs tracking-wider uppercase transition-colors whitespace-nowrap"
                            >
                                {viewMode === 'comprobantes' ? 'Volver a config.' : 'Ver comprobantes'}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors shrink-0">
                            <X size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-white overflow-x-auto whitespace-nowrap scrollbar-none px-2 md:px-4 shrink-0">
                    {viewMode === 'comprobantes' ? (
                        <>
                            <button 
                                onClick={(e) => {
                                    setActiveTab('history');
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                }}
                                className={`flex-1 md:flex-none py-3 md:py-4 px-3 md:px-5 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'history' ? 'text-[#1f63fb] bg-blue-50/30' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <FileText size={16} strokeWidth={activeTab === 'history' ? 2.5 : 2} /> Comprobantes Generados
                                {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1f63fb] rounded-t-full"></div>}
                            </button>
                            <button 
                                onClick={(e) => {
                                    setActiveTab('new');
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                }}
                                className={`flex-1 md:flex-none py-3 md:py-4 px-3 md:px-5 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'new' ? 'text-[#1f63fb] bg-blue-50/30' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <Plus size={16} strokeWidth={activeTab === 'new' ? 2.5 : 2} /> Emitir Nuevo
                                {activeTab === 'new' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1f63fb] rounded-t-full"></div>}
                            </button>
                        </>
                    ) : (
                        <>
                            {['admin', 'waiter', 'cashier'].includes(user?.role) && (
                                <button 
                                    onClick={(e) => {
                                        setActiveTab('config');
                                        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                    }}
                                    className={`py-3 md:py-4 px-3 md:px-5 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'config' ? 'text-[#1f63fb] bg-blue-50/30' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    <Settings size={16} strokeWidth={activeTab === 'config' ? 2.5 : 2} /> Configuración
                                    {activeTab === 'config' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1f63fb] rounded-t-full"></div>}
                                </button>
                            )}
                            {['admin', 'waiter', 'cashier'].includes(user?.role) && (
                                <button 
                                    onClick={(e) => {
                                        setActiveTab('printers');
                                        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                    }}
                                    className={`py-3 md:py-4 px-3 md:px-5 text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${activeTab === 'printers' ? 'text-[#1f63fb] bg-blue-50/30' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    <Printer size={16} strokeWidth={activeTab === 'printers' ? 2.5 : 2} /> Impresoras
                                    {activeTab === 'printers' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1f63fb] rounded-t-full"></div>}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-white">
                    
                    {activeTab === 'history' && (
                        <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#f8fafc]">
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                                {/* Filtros en Tarjetas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                                    <div className="bg-white p-4 rounded-[20px] border border-gray-100 shadow-sm flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento Cliente</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Buscar por DNI o RUC..." 
                                                className="w-full pl-10 pr-4 py-3 bg-[#f8fafc] border border-transparent rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400"
                                                value={filters.documento}
                                                onChange={(e) => setFilters({...filters, documento: e.target.value})}
                                            />
                                            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-[20px] border border-gray-100 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rango de Fecha</label>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="date" 
                                                className="flex-1 px-3 py-3 bg-[#f8fafc] border border-transparent rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                                                value={filters.desde}
                                                onChange={(e) => setFilters({...filters, desde: e.target.value})}
                                            />
                                            <input 
                                                type="date" 
                                                className="flex-1 px-3 py-3 bg-[#f8fafc] border border-transparent rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                                                value={filters.hasta}
                                                onChange={(e) => setFilters({...filters, hasta: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Comprobantes (List Layout) */}
                                <div className="max-w-5xl mx-auto pb-8">
                                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                        <th className="p-4 pl-6">Documento</th>
                                                        <th className="p-4">Cliente</th>
                                                        <th className="p-4">Fecha</th>
                                                        <th className="p-4">Cuenta</th>
                                                        <th className="p-4">Total</th>
                                                        <th className="p-4">Estado</th>
                                                        <th className="p-4 pr-6 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {invoices.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="7" className="text-center py-12">
                                                                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                    <FileText size={24} className="text-gray-300" />
                                                                </div>
                                                                <p className="text-sm font-bold text-gray-400">No hay comprobantes emitidos en este rango</p>
                                                            </td>
                                                        </tr>
                                                    ) : invoices.map(inv => {
                                                        const { pdf } = getSunatUrls(inv.sunatResponse);
                                                        const docId = `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
                                                        
                                                        const formatDate = (dateStr) => {
                                                            if (!dateStr) return 'N/A';
                                                            try {
                                                                const d = new Date(dateStr);
                                                                const day = String(d.getDate()).padStart(2, '0');
                                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                                const year = String(d.getFullYear()).slice(-2);
                                                                const hours = String(d.getHours()).padStart(2, '0');
                                                                const minutes = String(d.getMinutes()).padStart(2, '0');
                                                                return `${day}/${month}/${year} ${hours}:${minutes}`;
                                                            } catch (e) {
                                                                return new Date(dateStr).toLocaleString();
                                                            }
                                                        };

                                                        return (
                                                            <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                                                                <td className="p-4 pl-6 align-middle">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-black text-[#1d263b]">{docId}</span>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className="text-[10px] font-bold text-gray-400">{inv.tipo === 'factura' ? 'FACTURA' : 'BOLETA'}</span>
                                                                            {(() => { try { const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; return items?.some(i => i.description?.includes('Abono')); } catch { return false; } })() && (
                                                                                <span className="inline-block bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold px-1.5 py-0 rounded-full uppercase">Abono</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[13px] font-bold text-gray-700 truncate max-w-[200px]" title={inv.clienteNombre}>
                                                                            {inv.clienteNombre}
                                                                        </span>
                                                                        <span className="text-[10px] font-medium text-gray-400 mt-0.5 font-mono">{inv.clienteDocumento}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <span className="text-[12px] font-medium text-gray-600">{formatDate(inv.emitidoAt)}</span>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    {inv.AccountId ? (
                                                                        <button 
                                                                            onClick={() => setSelectedAccountId(inv.AccountId)}
                                                                            className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100 uppercase tracking-widest shadow-sm hover:bg-blue-100 transition-colors cursor-pointer"
                                                                        >
                                                                            Cuenta #{inv.AccountId}
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[11px] font-bold text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <span className="text-[14px] font-black text-[#1d263b]">
                                                                        S/ {parseFloat(inv.total).toFixed(2)}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 align-middle">
                                                                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                                                                        inv.status === 'anulado' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                                                    }`}>
                                                                        {inv.status === 'anulado' ? 'ANULADA' : 'ACEPTADA'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 pr-6 align-middle">
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <button 
                                                                            onClick={() => pdf ? window.open(pdf, '_blank') : handlePrintLocalInvoice(inv)}
                                                                            className="p-2 text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-gray-200"
                                                                            title="Ver documento"
                                                                        >
                                                                            <ExternalLink size={16} />
                                                                        </button>

                                                                        {inv.status !== 'anulado' && (
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        setLoading(true);
                                                                                        await axios.post(`/api/billing/invoices/${inv.id}/print`);
                                                                                        alert('✅ Comprobante enviado a la impresora térmica.');
                                                                                    } catch (e) {
                                                                                        alert('❌ Error al imprimir ticket: ' + (e.response?.data?.error || e.message));
                                                                                    } finally {
                                                                                        setLoading(false);
                                                                                    }
                                                                                }}
                                                                                className="p-2 text-orange-500 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-gray-200"
                                                                                title="Imprimir Ticket Térmico"
                                                                            >
                                                                                <Printer size={16} />
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            onClick={() => handleShareWhatsapp(inv, inv.status === 'anulado' ? 'nc' : 'invoice')}
                                                                            className="p-2 text-green-500 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-gray-200"
                                                                            title="Compartir por WhatsApp"
                                                                        >
                                                                            <WhatsAppIcon size={16} />
                                                                        </button>

                                                                        {inv.status !== 'anulado' && (
                                                                            <button
                                                                                onClick={() => handleAnnulInvoice(inv)}
                                                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-gray-200"
                                                                                title="Anular"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'new' && (
                        <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#f8fafc]">
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                                {config.billingMode === 'reserva' && (
                                    <section className="bg-white p-4 md:p-5 rounded-[16px] border border-gray-100 shadow-sm max-w-4xl mx-auto w-full">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                                            🏢 Vincular a Reserva / Mesa
                                        </h3>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                            value={newInvoice.accountId || ''}
                                            onChange={(e) => handleSelectAccount(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar Mesa / Reserva --</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    Mesa {acc.tableNumber || acc.Table?.number || acc.TableId || '?'} - {acc.customerName} ({new Date(acc.createdAt).toLocaleDateString()} S/ {parseFloat(acc.total).toFixed(2)})
                                                </option>
                                            ))}
                                        </select>
                                    </section>
                                )}

                                {/* DATOS DEL CLIENTE */}
                                <section className="bg-white border border-gray-100 rounded-[20px] shadow-sm p-5 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
                                    <h3 className="text-[13px] font-black text-[#1d263b] flex items-center gap-3 uppercase tracking-wider border-b border-gray-100 pb-4">
                                        <div className="bg-[#f0f4ff] text-[#1f63fb] p-2 rounded-xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        </div>
                                        Datos del Cliente
                                    </h3>
                                    
                                    <div className="space-y-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Documento (DNI/RUC)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    maxLength={maxDocLength}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400"
                                                    placeholder="Buscar por DNI/RUC..."
                                                    value={newInvoice.clienteDocumento}
                                                    onChange={(e) => handleDocumentoChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClient(); }}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handleSearchClient}
                                                    disabled={loading}
                                                    className="px-6 bg-[#0f172a] text-white rounded-xl hover:bg-slate-800 transition flex items-center justify-center disabled:bg-slate-300 font-bold text-xs tracking-widest uppercase shrink-0"
                                                >
                                                    {loading ? <Loader size={16} className="animate-spin" /> : 'Buscar'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Tipo de Comprobante</label>
                                            <div className="flex bg-white rounded-xl border border-gray-200 p-1">
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'boleta'}))}
                                                    className={`flex-1 py-3 text-xs font-bold tracking-widest rounded-lg transition-all uppercase ${newInvoice.tipo === 'boleta' ? 'bg-white border-blue-500 text-[#1f63fb] shadow-sm border' : 'text-gray-400 hover:text-gray-600 border border-transparent'}`}
                                                >
                                                    Boleta
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'factura'}))}
                                                    className={`flex-1 py-3 text-xs font-bold tracking-widest rounded-lg transition-all uppercase ${newInvoice.tipo === 'factura' ? 'bg-white border-blue-500 text-[#1f63fb] shadow-sm border' : 'text-gray-400 hover:text-gray-600 border border-transparent'}`}
                                                >
                                                    Factura
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Razón Social / Nombre</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400"
                                                placeholder=""
                                                value={newInvoice.clienteNombre}
                                                onChange={(e) => setNewInvoice(prev => ({...prev, clienteNombre: e.target.value}))}
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Serie</label>
                                                <input 
                                                    type="text" 
                                                    readOnly
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold font-mono text-[#1f63fb] outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                                    value={newInvoice.tipo === 'factura' ? config.serieFactura : config.serieBoleta}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Dirección (Opcional)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400"
                                                    value={newInvoice.clienteDireccion}
                                                    onChange={(e) => setNewInvoice({...newInvoice, clienteDireccion: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* DETALLE DEL COMPROBANTE */}
                                <section className="bg-white border border-gray-100 rounded-[20px] shadow-sm p-5 md:p-6 space-y-5 max-w-4xl mx-auto w-full mb-8">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                        <h3 className="text-[13px] font-black text-[#1d263b] flex items-center gap-3 uppercase tracking-wider">
                                            <div className="bg-[#f0f4ff] text-[#1f63fb] p-2 rounded-xl">
                                                <FileText size={20} strokeWidth={2.5} />
                                            </div>
                                            Detalle del Comprobante
                                        </h3>
                                        <button 
                                            onClick={addItem}
                                            className="px-4 py-2.5 text-[10px] md:text-xs text-[#1f63fb] border border-[#1f63fb]/20 bg-white hover:bg-[#f0f4ff] font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-1.5"
                                        >
                                            <Plus size={16} strokeWidth={2.5} /> Agregar Item
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="hidden md:flex gap-3 px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <div className="w-16">Cant</div>
                                            <div className="flex-1">Descripción</div>
                                            <div className="w-28">Precio Unit</div>
                                            <div className="w-28 text-right">Subtotal</div>
                                            <div className="w-10"></div>
                                        </div>
                                        
                                        {newInvoice.items.map((item, idx) => {
                                            const qty = parseFloat(item.quantity) || 0;
                                            const total = parseFloat(item.amount) || 0;
                                            const unitPrice = qty > 0 ? (total / qty).toFixed(2) : '0.00';
                                            
                                            return (
                                            <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center py-3 md:py-0 border-b border-gray-50 md:border-none">
                                                <div className="w-full md:w-16 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest md:hidden">Cant</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-sm text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-full md:flex-1 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest md:hidden">Descripción</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:font-medium placeholder:text-gray-400"
                                                        placeholder="Concepto..."
                                                        value={item.description}
                                                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-full md:w-28 space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest md:hidden">Precio Unit</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-[13px] text-gray-400 text-xs font-bold">S/</span>
                                                        <input 
                                                            type="number" 
                                                            className="w-full pl-8 pr-3 py-3 bg-white border border-gray-200 rounded-xl text-sm text-right font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                            value={unitPrice}
                                                            onChange={(e) => {
                                                                const newUnit = parseFloat(e.target.value) || 0;
                                                                updateItem(idx, 'amount', (newUnit * qty).toFixed(2));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-28 md:py-2 flex flex-col md:items-end justify-between md:justify-end gap-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subtotal</label>
                                                    <div className="flex items-center gap-1 bg-[#f4f4f5] px-3 py-2.5 rounded-xl md:ml-auto w-full md:w-auto justify-end">
                                                        <span className="text-gray-500 text-[11px] font-black">S/</span>
                                                        <span className="text-[15px] font-black text-gray-900">{parseFloat(item.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => removeItem(idx)}
                                                    className="w-full md:w-auto p-3 md:mt-5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 size={20} />
                                                    <span className="md:hidden text-xs font-bold uppercase tracking-widest text-red-500">Eliminar Item</span>
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                </section>
                            </div>

                            {/* Sticky Footer */}
                            <div className="bg-white border-t border-gray-200 p-5 md:p-6 shrink-0 relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-5">
                                    <div className="flex flex-col text-center md:text-left w-full md:w-auto">
                                        <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                                            Subtotal: S/ {config.operacionesExoneradas ? calculateTotal() : (parseFloat(calculateTotal()) / (1 + config.igvTasa/100)).toFixed(2)} | IGV ({config.operacionesExoneradas ? '0' : config.igvTasa}%): S/ {config.operacionesExoneradas ? '0.00' : (parseFloat(calculateTotal()) - (parseFloat(calculateTotal()) / (1 + config.igvTasa/100))).toFixed(2)}
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-end justify-center md:justify-start gap-1 md:gap-3 mt-1">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest pb-1.5">Total a Pagar</span>
                                            <span className="text-[34px] font-black text-[#1d263b] tracking-tighter leading-none">S/ {calculateTotal()}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleEmit}
                                        disabled={loading}
                                        className="w-full md:w-auto bg-[#8ca8ff] text-white px-10 py-5 rounded-[16px] font-black text-sm md:text-base uppercase tracking-widest hover:bg-[#7294ff] active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:bg-gray-300 disabled:transform-none"
                                        style={{backgroundColor: loading ? '' : '#83a5ff'}}
                                    >
                                        {loading ? <Loader size={20} className="animate-spin" /> : <CheckCircle size={20} />} 
                                        Emitir Comprobante
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && ['admin', 'waiter', 'cashier'].includes(user?.role) && (
                        <form onSubmit={handleSaveConfig} className="max-w-xl mx-auto space-y-6 py-6 px-2">
                            {/* RUC */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">RUC de la Empresa</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        maxLength={11}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Ingrese RUC"
                                        value={config.ruc}
                                        onChange={async (e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setConfig({...config, ruc: val});
                                            if (val.length === 11) {
                                                setLoading(true);
                                                try {
                                                    const res = await axios.get(`/api/billing/consulta?doc=${val}`);
                                                    if (res.data) setConfig(prev => ({...prev, ruc: val, razonSocial: res.data.razon_social || res.data.nombre, direccion: res.data.direccion || prev.direccion || ''}));
                                                } catch (err) { console.error('RUC no encontrado'); }
                                                finally { setLoading(false); }
                                            }
                                        }}
                                    />
                                    <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
                                </div>
                            </div>

                            {/* Razón Social */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Razón Social</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    value={config.razonSocial}
                                    onChange={(e) => setConfig({...config, razonSocial: e.target.value})}
                                />
                            </div>

                            {/* Facturación Electrónica Toggle */}
                            <div className="bg-[#f4f7fe] border border-blue-100 p-5 rounded-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-blue-900 font-bold text-base">Encender Facturación Electrónica</h4>
                                    <p className="text-blue-600/80 text-sm leading-snug">Habilita la emisión de comprobantes en el sistema.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={config.facturacionElectronica}
                                        onChange={(e) => setConfig({...config, facturacionElectronica: e.target.checked})}
                                    />
                                    <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>

                            {/* IGV */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Tasa de IGV (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        value={config.igvTasa}
                                        onChange={(e) => setConfig({...config, igvTasa: e.target.value})}
                                    />
                                    <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-base">%</span>
                                </div>
                                <p className="text-gray-500 text-sm mt-1">Valor utilizado para calcular el IGV en la emision de comprobantes.</p>
                            </div>

                            {/* Operaciones Exoneradas */}
                            <div className="bg-[#fff6ef] border border-orange-100 p-5 rounded-xl flex items-center justify-between gap-4">
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                                        <h4 className="text-[#8b3d16] font-bold text-base leading-tight">Operaciones<br className="hidden sm:block" /> Exoneradas</h4>
                                        <span className="bg-[#ffdbb9] text-[#b3591b] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider w-max">LEY AMAZONÍA</span>
                                    </div>
                                    <p className="text-[#a54c1f] text-sm leading-snug font-medium">Usa código 20 y establece IGV a 0 en el comprobante.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={config.operacionesExoneradas}
                                        onChange={(e) => setConfig({...config, operacionesExoneradas: e.target.checked})}
                                    />
                                    <div className="w-14 h-8 bg-[#cdd5ea] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Otros Campos (Dirección, Series, Modo Facturación, API Token) */}
                            <div className="border-t pt-6 space-y-6 mt-6">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Configuraciones Adicionales</h3>
                                
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Dirección de la Empresa</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Se autocompleta al buscar RUC o ingrese manualmente"
                                        value={config.direccion || ''}
                                        onChange={(e) => setConfig({...config, direccion: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Serie Factura</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-bold font-mono text-blue-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                            value={config.serieFactura}
                                            onChange={(e) => setConfig({...config, serieFactura: e.target.value.toUpperCase()})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Serie Boleta</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-bold font-mono text-blue-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                            value={config.serieBoleta}
                                            onChange={(e) => setConfig({...config, serieBoleta: e.target.value.toUpperCase()})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Modo de Facturación</label>
                                    <select 
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-medium bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        value={config.billingMode || 'libre'}
                                        onChange={(e) => setConfig({...config, billingMode: e.target.value})}
                                    >
                                        <option value="libre">Emisión Libre (Manual)</option>
                                        <option value="reserva">Ligado a Reserva / Mesa</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">API Token de Integración</label>
                                    <input 
                                        type="password" 
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base font-mono focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Ingrese el token proporcionado"
                                        value={config.apiToken}
                                        onChange={(e) => setConfig({...config, apiToken: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-6 border-t mt-8">
                                <button 
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-3 border border-gray-300 bg-white rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="bg-[#1f63fb] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow-md disabled:bg-gray-400"
                                >
                                    {loading ? <Loader size={18} className="animate-spin" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                                    Guardar
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'printers' && ['admin', 'waiter', 'cashier'].includes(user?.role) && (
                        <form onSubmit={handleSavePrinters} className="max-w-4xl mx-auto space-y-8 py-4">

                            {/* Habilitar Impresión Toggle */}
                            <div className="bg-[#f0fdf4] border border-green-100 p-5 rounded-xl flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-green-900 font-bold text-base flex items-center gap-2">
                                        <Printer size={18} className="text-green-600" />
                                        Habilitar Impresión
                                    </h4>
                                    <p className="text-green-700/80 text-sm leading-snug">Activa los botones de impresión (pre-cuenta, comanda, apertura/cierre de turno). Desactivar oculta todos estos controles del UX.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={!!config.habilitarImpresion}
                                        onChange={(e) => setConfig({...config, habilitarImpresion: e.target.checked})}
                                    />
                                    <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>


                            {hasOutdatedAgent && (
                                <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="font-bold text-orange-900 text-sm">Actualización de Agente Disponible</h4>
                                        <p className="text-orange-800 text-xs mt-1">
                                            Tienes uno o más Agentes de Impresión conectados con una versión antigua.
                                            Para asegurar la compatibilidad con las últimas funciones del sistema, por favor 
                                            descarga el nuevo instalador y ejecútalo en las PCs donde el agente esté instalado.
                                        </p>
                                        <a
                                            href="/api/config/printers/agent-setup-exe"
                                            download="MakalaAgentSetup.exe"
                                            className="inline-flex items-center gap-2 mt-3 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange-700 transition shadow-sm"
                                        >
                                            <Download size={14} />
                                            Descargar Actualización (.exe)
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* === PANEL: INSTALAR AGENTE EN ESTA PC === */}
                            {/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                                <div className="border rounded-xl p-5 space-y-3 bg-blue-50 border-blue-200">
                                    <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-blue-600">1</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-blue-900">Agente de Impresión</h4>
                                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                                La impresión desde celulares o tablets funciona automáticamente siempre que haya al menos una computadora del restaurante configurada correctamente con el agente de impresión activo. No necesitas instalar nada en este dispositivo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={`border rounded-xl p-5 space-y-3 ${agentStatus === 'active' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${agentStatus === 'active' ? 'bg-green-600' : 'bg-blue-600'}`}>1</div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`font-bold text-sm ${agentStatus === 'active' ? 'text-green-900' : 'text-blue-900'}`}>Agente de Impresión en esta PC</h4>
                                                {agentStatus === 'active' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                                                        Activo
                                                    </span>
                                                )}
                                                {agentStatus === 'inactive' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                                        No instalado en esta PC
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-xs ${agentStatus === 'active' ? 'text-green-700' : 'text-blue-700'}`}>
                                                {agentStatus === 'active'
                                                    ? 'El agente está corriendo y arrancará automáticamente con Windows. No necesitas hacer nada más en esta PC.'
                                                    : 'Cada PC del restaurante que tenga una impresora conectada debe instalar el agente una sola vez. Funciona en segundo plano.'}
                                            </p>
                                        </div>
                                    </div>
                                    {agentStatus !== 'active' && (
                                        <div className="ml-10 space-y-2">
                                            <div className="text-xs text-blue-800 space-y-1">
                                                <p className="font-semibold">Pasos para esta PC:</p>
                                                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                                                    <li>Descarga el instalador haciendo clic en el botón de abajo</li>
                                                    <li>Abre el archivo descargado (MakalaAgentSetup.exe)</li>
                                                    <li>Haz clic en <strong>Instalar</strong> y espera a que termine</li>
                                                </ol>
                                            </div>
                                            <a
                                                href="/api/config/printers/agent-setup-exe"
                                                download="MakalaAgentSetup.exe"
                                                className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                                            >
                                                <Download size={14} />
                                                Descargar Instalador del Agente (.exe)
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === PANEL: CONFIGURAR IMPRESORAS === */}
                            <div className="flex justify-between items-center border-b pb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                                        <h3 className="text-lg font-bold text-gray-800">Configuración de Impresoras</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-10">Esta configuración es global — aplica a todas las PCs del restaurante.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {['caja', 'cocina', 'barra'].map(key => {
                                    const prt = printers[key] || { type: 'disabled', path: '', printerName: '' };
                                    return (
                                        <div key={key} className="bg-white border rounded-xl p-5 shadow-sm space-y-4 border-gray-200">
                                            <div className="flex items-center gap-2 font-bold text-gray-800 capitalize border-b pb-2">
                                                <Printer size={18} className="text-blue-600" />
                                                Impresora {key === 'caja' ? 'Caja / General' : key}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Puerto / Tipo</label>
                                                <select
                                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-medium"
                                                    value={prt.type}
                                                    onChange={(e) => {
                                                        const type = e.target.value;
                                                        setPrinters(prev => ({
                                                            ...prev,
                                                            [key]: { ...prev[key], type }
                                                        }));
                                                        if (type === 'windows_print') checkAgentStatus();
                                                    }}
                                                >
                                                    <option value="disabled">Deshabilitada</option>
                                                    <option value="usb">USB Directo (RAW)</option>
                                                    <option value="windows_print">Cola de Windows (Spooler)</option>
                                                    <option value="ethernet">Red Ethernet (IP Directo)</option>
                                                </select>
                                            </div>

                                            {prt.type === 'usb' && (
                                                <div className="space-y-1 animate-in fade-in duration-200">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">USB Device Path</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                                                        placeholder="\\?\USB#VID_0456&PID_0808#..."
                                                        value={prt.path || ''}
                                                        onChange={(e) => {
                                                            const path = e.target.value;
                                                            setPrinters(prev => ({
                                                                ...prev,
                                                                [key]: { ...prev[key], path }
                                                            }));
                                                        }}
                                                    />
                                                    <span className="text-[10px] text-gray-400 block">Ruta del puerto USB.</span>
                                                </div>
                                            )}

                                            {prt.type === 'ethernet' && (
                                                <div className="space-y-1 animate-in fade-in duration-200">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Dirección IP de la Impresora</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                                                        placeholder="Ej. 192.168.1.23"
                                                        value={prt.path || ''}
                                                        onChange={(e) => {
                                                            const path = e.target.value;
                                                            setPrinters(prev => ({
                                                                ...prev,
                                                                [key]: { ...prev[key], path }
                                                            }));
                                                        }}
                                                    />
                                                    <span className="text-[10px] text-gray-400 block">Dirección IP de la impresora en la red local.</span>
                                                </div>
                                            )}

                                            {prt.type === 'windows_print' && (
                                                <div className="space-y-1 animate-in fade-in duration-200">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Nombre en Windows</label>
                                                    {windowsPrinters.length > 0 ? (
                                                        <select
                                                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                                                            value={prt.printerName || ''}
                                                            onChange={(e) => {
                                                                const printerName = e.target.value;
                                                                setPrinters(prev => ({
                                                                    ...prev,
                                                                    [key]: { ...prev[key], printerName }
                                                                }));
                                                            }}
                                                        >
                                                            <option value="">-- Seleccionar impresora --</option>
                                                            {windowsPrinters.map(name => (
                                                                <option key={name} value={name}>{name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                                            placeholder="Ej. POS 80 Series, Advance, Cocina"
                                                            value={prt.printerName || ''}
                                                            onChange={(e) => {
                                                                const printerName = e.target.value;
                                                                setPrinters(prev => ({
                                                                    ...prev,
                                                                    [key]: { ...prev[key], printerName }
                                                                }));
                                                            }}
                                                        />
                                                    )}
                                                    <span className="text-[10px] text-gray-400 block">Nombre exacto de la impresora instalada en Windows.</span>
                                                </div>
                                            )}

                                            {prt.type !== 'disabled' && (
                                                <button
                                                    type="button"
                                                    disabled={testLoading[key] || loading}
                                                    onClick={() => handleTestPrinter(key)}
                                                    className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 border"
                                                >
                                                    {testLoading[key] ? (
                                                        <>
                                                            <Loader2 size={14} className="animate-spin text-gray-500" />
                                                            <span>Imprimiendo Prueba...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Printer size={14} />
                                                            <span>Probar Impresora</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end pt-6 border-t">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-400"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Impresoras'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
            {selectedAccountId && (
                <AccountDetailsModal 
                    accountId={selectedAccountId} 
                    onClose={() => setSelectedAccountId(null)} 
                />
            )}
        </div>
    );
};

export default BillingConfigModal;

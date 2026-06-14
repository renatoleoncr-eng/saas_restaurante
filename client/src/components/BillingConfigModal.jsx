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
    const { user } = useRestaurant();
    const [activeTab, setActiveTab] = useState('history');
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
        billingMode: 'libre'
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

    const fetchWindowsPrinters = async () => {
        try {
            // Consulta al agente local en esta PC (no al servidor en la nube)
            const res = await fetch('http://localhost:6789/windows-printers', { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (Array.isArray(data)) setWindowsPrinters(data);
        } catch (err) {
            // El agente no está corriendo o no está instalado — campo manual
            setWindowsPrinters([]);
        }
    };

    const checkAgentStatus = async () => {
        try {
            const res = await fetch('http://localhost:6789/status', { signal: AbortSignal.timeout(2000) });
            const data = await res.json();
            if (data?.ok) {
                setAgentStatus('active');
                // Si el agente está corriendo, también trae la lista de impresoras
                fetchWindowsPrinters();
            } else {
                setAgentStatus('inactive');
            }
        } catch {
            setAgentStatus('inactive');
        }
    };

    const handleSavePrinters = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('/api/config/printers', printers);
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
        fetchWindowsPrinters();
        checkAgentStatus();
    }, []);

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
        const igvLabel = isExonerated ? 'I.G.V. (0%):' : 'I.G.V. (18%):';

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
                <title>${invoice.tipo === 'factura' ? 'Factura' : 'Boleta'}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace, sans-serif;
                        width: 72mm;
                        margin: 0 auto;
                        padding: 5mm 2mm;
                        font-size: 11px;
                        color: #000;
                        line-height: 1.3;
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
                </style>
            </head>
            <body>
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
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    }
                </script>
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
        const { pdf } = getSunatUrls(inv.sunatResponse);
        const url = type === 'nc' ? inv.notaCreditoUrl : pdf;
        if (!url) {
            alert('No hay enlace de PDF disponible para compartir');
            return;
        }
        const busterUrl = `${url}?v=${Date.now()}`;
        const phone = inv.clienteDocumento?.length === 9 ? inv.clienteDocumento : '';
        const docName = type === 'nc' ? 'Nota de Crédito' : (inv.tipo === 'factura' ? 'Factura' : 'Boleta');
        const docId = type === 'nc' ? inv.notaCredito : `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
        
        const userPhone = window.prompt('Ingrese el número de WhatsApp del cliente (ej. 999888777):', phone);
        if (userPhone === null) return; // cancelled
        const cleanPhone = userPhone.replace(/\D/g, '');
        
        const message = `Hola ${inv.clienteNombre}, le adjuntamos su ${docName} ${docId}: ${busterUrl}`;
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Configuración del Sistema</h2>
                            <p className="text-sm text-gray-500">Gestión de comprobantes, impresoras y SUNAT</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-white">
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <FileText size={18} /> Historial
                    </button>
                    <button 
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'new' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Plus size={18} /> Nueva Emisión
                    </button>
                    {user?.role === 'admin' && (
                        <>
                            <button 
                                onClick={() => setActiveTab('config')}
                                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'config' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Settings size={18} /> Configuración
                            </button>
                            <button 
                                onClick={() => setActiveTab('printers')}
                                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'printers' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Printer size={18} /> Impresoras
                            </button>
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-white">
                    
                    {activeTab === 'history' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Documento Cliente</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="DNI / RUC" 
                                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                                            value={filters.documento}
                                            onChange={(e) => setFilters({...filters, documento: e.target.value})}
                                        />
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Desde</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-4 py-2 border rounded-lg text-sm"
                                        value={filters.desde}
                                        onChange={(e) => setFilters({...filters, desde: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Hasta</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-4 py-2 border rounded-lg text-sm"
                                        value={filters.hasta}
                                        onChange={(e) => setFilters({...filters, hasta: e.target.value})}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button 
                                        onClick={fetchInvoices}
                                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                                    >
                                        Filtrar
                                    </button>
                                </div>
                            </div>

                            <div className="border rounded-xl overflow-hidden bg-white shadow-sm border-gray-100">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Reserva</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {invoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="px-4 py-6 text-center text-gray-400 italic">No hay comprobantes emitidos</td>
                                                </tr>
                                            ) : invoices.map(inv => {
                                                const { pdf } = getSunatUrls(inv.sunatResponse);
                                                const docId = `${inv.serie}-${String(inv.correlativo).padStart(6, '0')}`;
                                                
                                                // Format Date/Time helper
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
                                                    <tr key={inv.id} className="hover:bg-gray-50/50 transition">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-gray-900">{docId}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] text-gray-400 font-medium">{inv.tipo === 'factura' ? 'FACTURA' : 'BOLETA'}</span>
                                                                    {(() => { try { const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; return items?.some(i => i.description?.includes('Abono')); } catch { return false; } })() && (
                                                                        <span className="inline-block bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold px-1.5 py-0 rounded-full uppercase">Abono</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm text-gray-700 font-medium truncate max-w-[200px]" title={inv.clienteNombre}>
                                                                {inv.clienteNombre}
                                                            </div>
                                                            <div className="text-[11px] text-gray-400 font-mono">{inv.clienteDocumento}</div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {formatDate(inv.emitidoAt)}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            {inv.AccountId ? (
                                                                <button
                                                                    onClick={() => setSelectedAccountId(inv.AccountId)}
                                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[11px] font-bold w-fit hover:bg-blue-100 transition cursor-pointer"
                                                                >
                                                                    Reserva #{inv.AccountId}
                                                                    {inv.Account?.Table && (
                                                                        <span className="text-[9px] text-gray-500 font-medium ml-1">
                                                                            (Mesa {inv.Account.Table.number})
                                                                        </span>
                                                                    )}
                                                                    <ArrowRight size={10} />
                                                                </button>
                                                            ) : (
                                                                <span className="text-[11px] font-bold text-gray-300 italic">Libre</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-gray-900">S/ {parseFloat(inv.total).toFixed(2)}</span>
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded w-fit ${
                                                                        inv.status === 'anulado' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                                                    }`}>
                                                                        {inv.status === 'anulado' ? 'ANULADA' : 'ACEPTADA'}
                                                                    </span>
                                                                    {inv.status === 'anulado' && inv.notaCredito && (
                                                                        <span className="text-[8px] font-bold text-gray-400">NC: {inv.notaCredito}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button 
                                                                    onClick={() => pdf ? window.open(pdf, '_blank') : handlePrintLocalInvoice(inv)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                    title={pdf ? "Ver PDF Original" : "Imprimir comprobante local"}
                                                                >
                                                                    <ExternalLink size={18} />
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
                                                                         className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition border border-orange-100"
                                                                         title="Imprimir Ticket Térmico"
                                                                     >
                                                                         <Printer size={18} />
                                                                     </button>
                                                                 )}

                                                                {inv.status === 'anulado' && inv.notaCreditoUrl && (
                                                                    <button
                                                                        onClick={() => window.open(inv.notaCreditoUrl, '_blank')}
                                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition border border-red-100"
                                                                        title="Ver Nota de Crédito"
                                                                    >
                                                                        <FileText size={18} />
                                                                    </button>
                                                                )}
                                                                
                                                                <button
                                                                    onClick={() => handleShareWhatsapp(inv, inv.status === 'anulado' ? 'nc' : 'invoice')}
                                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                                                    title="Compartir por WhatsApp"
                                                                >
                                                                    <WhatsAppIcon size={18} />
                                                                </button>

                                                                {inv.status !== 'anulado' && (
                                                                    <button
                                                                        onClick={() => handleAnnulInvoice(inv)}
                                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-2 border-l pl-3"
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
                    )}

                    {activeTab === 'new' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
                            <div className="md:col-span-2 space-y-6">
                                {config.billingMode === 'reserva' && (
                                    <section className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            🏢 Vincular a Reserva / Mesa
                                        </h3>
                                        <select
                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
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

                                <section className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide border-b pb-3">
                                        <Building2 size={16} className="text-blue-600" /> Datos del Cliente
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-4 space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{docLabel}</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    maxLength={maxDocLength}
                                                    className="w-full px-4 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                    placeholder={docPlaceholder}
                                                    value={newInvoice.clienteDocumento}
                                                    onChange={(e) => handleDocumentoChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClient(); }}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handleSearchClient}
                                                    disabled={loading}
                                                    className="px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition flex items-center justify-center disabled:bg-slate-300 min-w-[48px]"
                                                    title="Buscar"
                                                >
                                                    {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-8 space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{nameLabel}</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                placeholder="Se autocompleta al buscar"
                                                value={newInvoice.clienteNombre}
                                                onChange={(e) => setNewInvoice(prev => ({...prev, clienteNombre: e.target.value}))}
                                            />
                                        </div>
                                        
                                        <div className="md:col-span-4 space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo Comprobante</label>
                                            <div className="flex p-1 bg-slate-50 rounded-lg border border-slate-100">
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'boleta'}))}
                                                    className={`flex-1 py-1.5 text-[10px] font-black tracking-wider rounded-md transition-all ${newInvoice.tipo === 'boleta' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    BOLETA
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'factura'}))}
                                                    className={`flex-1 py-1.5 text-[10px] font-black tracking-wider rounded-md transition-all ${newInvoice.tipo === 'factura' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    FACTURA
                                                </button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serie</label>
                                            <input 
                                                type="text" 
                                                readOnly
                                                className="w-full px-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm font-bold text-slate-500 outline-none cursor-not-allowed"
                                                value={newInvoice.tipo === 'factura' ? config.serieFactura : config.serieBoleta}
                                            />
                                        </div>
                                        <div className="md:col-span-6 space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dirección (Opcional)</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-2 bg-slate-50 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                value={newInvoice.clienteDireccion}
                                                onChange={(e) => setNewInvoice({...newInvoice, clienteDireccion: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                                            <FileText size={16} className="text-blue-600" /> Detalle del Comprobante
                                        </h3>
                                        <button 
                                            onClick={addItem}
                                            className="text-[10px] text-blue-600 font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Agregar Item
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="hidden md:flex gap-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <div className="w-20">Cant</div>
                                            <div className="flex-1">Descripción</div>
                                            <div className="w-32">Precio Unit</div>
                                            <div className="w-32 text-right">Subtotal</div>
                                            <div className="w-10"></div>
                                        </div>
                                        
                                        {newInvoice.items.map((item, idx) => {
                                            const qty = parseFloat(item.quantity) || 0;
                                            const total = parseFloat(item.amount) || 0;
                                            const unitPrice = qty > 0 ? (total / qty).toFixed(2) : '0.00';
                                            
                                            return (
                                            <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100 animate-in fade-in duration-200">
                                                <div className="w-full md:w-20 space-y-1">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Cant"
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-full md:flex-1 space-y-1">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Concepto..."
                                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-full md:w-32 space-y-1">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">S/</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="0.00"
                                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-right font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                                                            value={unitPrice}
                                                            onChange={(e) => {
                                                                const newUnit = parseFloat(e.target.value) || 0;
                                                                updateItem(idx, 'amount', (newUnit * qty).toFixed(2));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-32 py-2 text-right">
                                                    <span className="text-slate-400 text-xs font-bold mr-1">S/</span>
                                                    <span className="text-sm font-black text-slate-800">{parseFloat(item.amount || 0).toFixed(2)}</span>
                                                </div>
                                                <button 
                                                    onClick={() => removeItem(idx)}
                                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                </section>
                            </div>

                            <div className="md:col-span-1 space-y-6">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 sticky top-6">
                                    <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Resumen de Venta</h3>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between text-slate-500 font-bold">
                                            <span>Subtotal</span>
                                            <span>S/ {config.operacionesExoneradas ? calculateTotal() : (parseFloat(calculateTotal()) / (1 + config.igvTasa/100)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-500 font-bold">
                                            <span>IGV ({config.operacionesExoneradas ? '0' : config.igvTasa}%)</span>
                                            <span>S/ {config.operacionesExoneradas ? '0.00' : (parseFloat(calculateTotal()) - (parseFloat(calculateTotal()) / (1 + config.igvTasa/100))).toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-end">
                                            <span className="font-black text-slate-800">Total</span>
                                            <span className="text-2xl font-black text-slate-900 tracking-tighter">S/ {calculateTotal()}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleEmit}
                                        disabled={loading}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:transform-none mt-6"
                                    >
                                        {loading ? <Loader size={16} className="animate-spin" /> : <Zap size={16} fill="currentColor" />} 
                                        Emitir Comprobante
                                    </button>
                                    <div className="text-[9px] font-black text-slate-400 text-center uppercase tracking-widest flex items-center justify-center gap-1.5 mt-4">
                                        <ShieldCheck size={12} className="text-blue-500" /> Conexión segura con Sunat Hub
                                    </div>
                                </div>
                                <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                                        <AlertCircle size={14} /> Información
                                    </div>
                                    <p className="text-[11px] text-blue-600/80 font-medium leading-relaxed">
                                        El comprobante se enviará automáticamente a SUNAT si la facturación electrónica está activada en la pestaña de configuración.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && user?.role === 'admin' && (
                        <form onSubmit={handleSaveConfig} className="max-w-2xl mx-auto space-y-8 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">RUC de la Empresa</label>
                                    <input 
                                        type="text" 
                                        maxLength={11}
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-bold"
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
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Razón Social</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-bold"
                                        value={config.razonSocial}
                                        onChange={(e) => setConfig({...config, razonSocial: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Dirección de la Empresa</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-bold"
                                        placeholder="Se autocompleta al buscar RUC o ingrese manualmente"
                                        value={config.direccion || ''}
                                        onChange={(e) => setConfig({...config, direccion: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Serie Factura</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono font-bold text-blue-600"
                                        value={config.serieFactura}
                                        onChange={(e) => setConfig({...config, serieFactura: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Serie Boleta</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono font-bold text-blue-600"
                                        value={config.serieBoleta}
                                        onChange={(e) => setConfig({...config, serieBoleta: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tasa IGV (%)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm"
                                        value={config.igvTasa}
                                        onChange={(e) => setConfig({...config, igvTasa: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Modo de Facturación</label>
                                    <select 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm font-bold bg-white"
                                        value={config.billingMode || 'libre'}
                                        onChange={(e) => setConfig({...config, billingMode: e.target.value})}
                                    >
                                        <option value="libre">Emisión Libre (Manual)</option>
                                        <option value="reserva">Ligado a Reserva / Mesa</option>
                                    </select>
                                </div>
                                <div className="flex items-end pb-1 gap-6">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={config.operacionesExoneradas}
                                                onChange={(e) => setConfig({...config, operacionesExoneradas: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition">Amazonía (Exonerado)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold text-gray-800">Facturación Electrónica (Sunat Hub)</h3>
                                        <p className="text-xs text-gray-500">Activa el envío real de documentos al servidor SUNAT</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={config.facturacionElectronica}
                                            onChange={(e) => setConfig({...config, facturacionElectronica: e.target.checked})}
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">API Token de Integración</label>
                                    <input 
                                        type="password" 
                                        className="w-full px-4 py-3 border rounded-xl text-sm font-mono"
                                        placeholder="Ingrese el token proporcionado por Mak Suites"
                                        value={config.apiToken}
                                        onChange={(e) => setConfig({...config, apiToken: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-6">
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:bg-gray-400"
                                >
                                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'printers' && user?.role === 'admin' && (
                        <form onSubmit={handleSavePrinters} className="max-w-4xl mx-auto space-y-8 py-4">

                            {/* === PANEL: INSTALAR AGENTE EN ESTA PC === */}
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
                                                <li>Instala <strong>Node.js</strong> si no está instalado (<a href="https://nodejs.org" target="_blank" rel="noreferrer" className="underline">nodejs.org</a>)</li>
                                                <li>Descarga el instalador haciendo clic en el botón de abajo</li>
                                                <li>Clic derecho sobre el archivo → <strong>"Ejecutar como Administrador"</strong></li>
                                                <li>¡Listo! El agente arranca automáticamente con cada inicio de sesión</li>
                                            </ol>
                                        </div>
                                        <a
                                            href="/api/config/printers/agent-download"
                                            download="instalar_servicio_impresion.ps1"
                                            className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                                        >
                                            <Download size={14} />
                                            Descargar Instalador del Agente (.ps1)
                                        </a>
                                    </div>
                                )}
                            </div>

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
                                                        if (type === 'windows_print') fetchWindowsPrinters();
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

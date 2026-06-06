import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ShoppingCart, Utensils, Beer, X, Check, FileText, Search, Plus, Minus, Trash2, Clock, CheckCircle, ArrowRightLeft, Wine, Tag, ChevronRight, AlertCircle, Loader2, Printer, Download, Camera, Image } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import TableTransferModal from './TableTransferModal';
import PinPadModal from './PinPadModal';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export default function TableControl({ tableId, accountId, onClose, initialShowCart = false }) {
    const { user, refreshTrigger, refreshData } = useRestaurant();
    const [account, setAccount] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [isAccountLoaded, setIsAccountLoaded] = useState(false);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('dish'); // Default to 'dish'
    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileCart, setShowMobileCart] = useState(initialShowCart);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false); // New State for Transfer

    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [payAmount, setPayAmount] = useState('');
    const [isLastPaymentPartial, setIsLastPaymentPartial] = useState(false);
    const handleFileChange = (e) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setEvidenceFiles(prev => [...prev, ...files]);
        }
    };
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [issueInvoice, setIssueInvoice] = useState(false);
    const [invoiceType, setInvoiceType] = useState('boleta');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Client Editing State
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [clientForm, setClientForm] = useState({ name: '', dni: '', direccion: '', accountType: 'standard' });
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [successInvoice, setSuccessInvoice] = useState(null);
    const [billingConfig, setBillingConfig] = useState(null);
    const [whatsappPhone, setwhatsappPhone] = useState('');
    const [showWhatsappInput, setShowWhatsappInput] = useState(false);

    const fetchBillingConfig = async () => {
        try {
            const res = await axios.get('/api/billing/config');
            setBillingConfig(res.data);
        } catch (err) {
            console.error("Error fetching billing config:", err);
        }
    };

    const handlePrintLocalInvoice = (invoice) => {
        if (!invoice) return;

        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
        const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : new Date().toLocaleString();
        const docName = invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA';
        
        const rucEmpresa = billingConfig?.ruc || '20614409593';
        const nameEmpresa = billingConfig?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
        const addressEmpresa = billingConfig?.direccion || 'Av. Larco 123, Miraflores, Lima';

        // Check for Amazonas exoneration (exoneradas or igv === 0)
        const isExonerated = billingConfig?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
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

        // Verify if it is electronic (successfully sent to SUNAT Hub)
        const isElectronico = !!(
            (invoice.sunatResponse || successInvoice?.sunatResponse) && 
            (() => {
                try {
                    const rawResp = invoice.sunatResponse || successInvoice?.sunatResponse;
                    const parsed = typeof rawResp === 'string' ? JSON.parse(rawResp) : rawResp;
                    return parsed && !parsed.error && parsed.success !== false;
                } catch (e) {
                    return false;
                }
            })()
        );

        const clienteDireccionHtml = invoice.clienteDireccion ? `<div><b>DIRECCIÓN:</b> ${invoice.clienteDireccion.toUpperCase()}</div>` : '';

        const printableHtml = `
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
                    <div><b>MÉTODO PAGO:</b> ${(paymentMethod ? paymentMethod : 'EFECTIVO').toUpperCase()}</div>
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
            </body>
            </html>
        `;

        // Create invisible iframe for printing
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(printableHtml);
        iframe.contentWindow.document.close();

        // Trigger print after load
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 300);
    };

    const handleDownloadLocalXml = (invoice) => {
        if (!invoice) return;
        const rucEmpresa = billingConfig?.ruc || '20614409593';
        const nameEmpresa = billingConfig?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
        const clientDoc = invoice.clienteDocumento || '00000000';
        const clientName = invoice.clienteNombre || 'CLIENTES VARIOS';
        const dateStr = invoice.createdAt ? invoice.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const docType = invoice.tipo === 'factura' ? '01' : '03'; 
        const clientDocType = invoice.tipo === 'factura' ? '6' : '1'; 
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);

        const isExonerated = billingConfig?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
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

    const handleShareWhatsapp = () => {
        if (!successInvoice || !successInvoice.invoice) return;
        const phone = whatsappPhone.trim();
        if (!phone) {
            alert('Por favor ingrese un número de teléfono válido.');
            return;
        }

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 9) {
            cleanPhone = '51' + cleanPhone;
        }

        const invoice = successInvoice.invoice;
        const docName = invoice.tipo === 'factura' ? 'Factura' : 'Boleta';
        const invoiceCode = `${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}`;
        
        // Extract PDF URL from sunatResponse
        const sunatResp = successInvoice.sunatResponse;
        let pdfUrl = '';
        if (sunatResp) {
            let parsed = sunatResp;
            if (typeof sunatResp === 'string') {
                try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
            }
            if (parsed) {
                pdfUrl = parsed.url_ticket || parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || parsed.url || '';
            }
        }

        // Apply SSL fix
        if (pdfUrl && typeof pdfUrl === 'string') {
            if (pdfUrl.includes('72.61.57.199') || pdfUrl.includes('maksuites') || pdfUrl.includes('bluzcx')) {
                pdfUrl = pdfUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
            }
        }

        const busterUrl = pdfUrl ? `${pdfUrl}?v=${Date.now()}` : '';
        
        let text = `Hola *${invoice.clienteNombre || 'Cliente'}*, adjuntamos tu *${docName} ${invoiceCode}* por un total de *S/ ${parseFloat(invoice.total).toFixed(2)}*.\n\n¡Gracias por tu preferencia!\n_Gestión Restaurante_`;
        
        if (busterUrl) {
            text = `Hola *${invoice.clienteNombre || 'Cliente'}*, adjuntamos tu *${docName} ${invoiceCode}* por un total de *S/ ${parseFloat(invoice.total).toFixed(2)}*:\n${busterUrl}\n\n¡Gracias por tu preferencia!\n_Gestión Restaurante_`;
        }

        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.location.href = waUrl;
        } else {
            window.open(waUrl, '_blank');
        }
    };

    const searchClientData = async () => {
        const doc = clientForm.dni.trim();
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
                const address = res.data.direccion || '';
                if (fullName) {
                    setClientForm(prev => ({ ...prev, name: fullName, direccion: address }));
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

    // Autocomplete client data
    useEffect(() => {
        const doc = (clientForm.dni || '').trim();
        if (doc.length === 8 || doc.length === 11) {
            const timer = setTimeout(() => {
                searchClientData();
            }, 500);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientForm.dni]);

    // Menu Daily State
    const [viewMode, setViewMode] = useState('products'); // 'products' | 'menu_builder'
    const [dailyMenu, setDailyMenu] = useState({ entries: [], mains: [], activeGroups: [] });
    const [menuSelection, setMenuSelection] = useState({ entry: '', main: '' });
    const [pendingMenuProduct, setPendingMenuProduct] = useState(null);
    const [pendingVariantProduct, setPendingVariantProduct] = useState(null); // For aggregating variant selection
    const [variantQuantities, setVariantQuantities] = useState({}); // local quantities state for variant selection
    const [deleteConfirmId, setDeleteConfirmId] = useState(null); // For inline delete confirmation

    // 2x1 Drink Promotions State
    const [drinkPromotions, setDrinkPromotions] = useState([]);
    const [pendingComboPromo, setPendingComboPromo] = useState(null); // promo being built
    const [comboSelection, setComboSelection] = useState([]); // array of up to 2 selected items

    // Helpers for 2x1 promotions quantities and counters
    const getComboItemCount = (itemId, promoId) => {
        return comboSelection.filter(s => s.id === itemId && s.promoId === promoId).length;
    };

    const handleIncrementComboItem = (item, promo) => {
        if (comboSelection.length >= 2) return;
        const instanceId = `${promo.id}:${item.id}:${Date.now()}:${Math.random()}`;
        setComboSelection(prev => [...prev, {
            ...item,
            promoId: promo.id,
            _uid: instanceId,
            _promoPrice: parseFloat(promo.price),
            _originalPrice: parseFloat(item.individualPrice || 0)
        }]);
    };

    const handleDecrementComboItem = (itemId, promoId) => {
        setComboSelection(prev => {
            const idx = prev.findIndex(s => s.id === itemId && s.promoId === promoId);
            if (idx === -1) return prev;
            return prev.filter((_, i) => i !== idx);
        });
    };

    // Helper to group identical orders (Optimized O(N))
    const groupOrders = (orders) => {
        if (!orders) return [];
        const groups = new Map();

        for (const o of orders) {
            const key = `${o.ProductId}|${o.subItemsData || ''}|${o.presentation || ''}|${o.notes || ''}|${o.priceAtOrder}`;
            if (groups.has(key)) {
                groups.get(key).quantity += o.quantity;
            } else {
                // Determine Name for sorting/display efficiency
                let pName = "Producto desconocido";
                if (o.Product && o.Product.name) {
                    pName = o.Product.name;
                }
                // Store a shallow copy to aggregate quantity without mutating original
                groups.set(key, { ...o, key, _pName: pName });
            }
        }
        return Array.from(groups.values());
    };

    // Memoize heavily to avoid re-calc on every render
    const groupedOrders = React.useMemo(() => groupOrders(account?.Orders), [account?.Orders]);

    // Happy Hour Check Utility
    const isHappyHourActive = (startStr, endStr) => {
        if (!startStr || !endStr) return false;
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        if (startStr <= endStr) {
            // Normal range (e.g., 10:00 to 17:00)
            return currentTimeStr >= startStr && currentTimeStr <= endStr;
        } else {
            // Cross-midnight range (e.g., 20:00 to 07:00)
            return currentTimeStr >= startStr || currentTimeStr <= endStr;
        }
    };

    // Reset viewMode when category changes
    useEffect(() => {
        if (selectedCategory !== 'combo') {
            setViewMode('products');
        } else {
            setViewMode('combo_categories');
        }
        setPendingMenuProduct(null);
        setPendingVariantProduct(null);
    }, [selectedCategory]);

    const parseMenuData = (items) => {
        if (!items) return [];
        // Support legacy string arrays or new objects
        return items.map(item => {
            if (typeof item === 'string') return { name: item, stock: 99, groupName: 'Menú del Día' };
            // Ensure groupName exists for compatibility
            return { ...item, groupName: item.groupName || 'Menú del Día' };
        });
    };

    const fetchDailyMenu = async () => {
        try {
            // Send client local date to avoid UTC mismatches
            const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            const res = await axios.get(`/api/menu/daily?date=${localDate}`);
            if (res.data) {
                const allItems = [...(res.data.entries || []), ...(res.data.mains || [])];
                const activeGroups = [...new Set(allItems.map(i => i.groupName).filter(n => n))];

                setDailyMenu({
                    entries: parseMenuData(res.data.entries),
                    mains: parseMenuData(res.data.mains),
                    activeGroups
                });
            }
        } catch (err) {
            console.error("Error fetching daily menu", err);
        }
    };

    const fetchDrinkPromotions = async () => {
        try {
            const res = await axios.get('/api/drink-promotions');
            setDrinkPromotions(res.data || []);
        } catch (err) {
            console.error('Error fetching drink promotions', err);
        }
    };

    useEffect(() => {
        loadTableData();
        fetchProducts();
        fetchAccount();
        fetchDailyMenu();
        fetchDrinkPromotions(); // Loading 2x1 promos
        fetchBillingConfig();

        // Escape Key Listener
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // If payment modal is open, close it first
                if (showPaymentModal) {
                    setShowPaymentModal(false);
                } else if (showTransferModal) {
                    setShowTransferModal(false);
                } else if (pendingVariantProduct) {
                    setPendingVariantProduct(null);
                } else if (isEditingClient) {
                    setIsEditingClient(false);
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tableId, refreshTrigger, showPaymentModal, pendingVariantProduct]);

    // Explicitly fetching products to ensure real-time sync
    const fetchProducts = async () => {
        try {
            console.log("[TableControl] Fetching Products...");
            const prodRes = await axios.get(`/api/products?t=${Date.now()}`);
            setProducts(prodRes.data);
            console.log("[TableControl] Products Loaded:", prodRes.data.length);
        } catch (pErr) {
            console.error("Error loading products:", pErr);
        }
    };

    // Explicitly fetching account
    const fetchAccount = async () => {
        try {
            let url = `/api/accounts/table/${tableId}?t=${Date.now()}`;
            if (accountId) {
                url = `/api/accounts/specific/${accountId}?t=${Date.now()}`;
            }

            const accRes = await axios.get(url);
            if (accRes.data) {
                setAccount(accRes.data);
                setClientForm({
                    name: accRes.data.customerName,
                    dni: accRes.data.clientDni || '',
                    direccion: accRes.data.clientAddress || '',
                    accountType: accRes.data.accountType || 'standard'
                });

                // If viewing a history account and we didn't pass tableId, try to load its historical table
                if (accountId && !tableId && accRes.data.TableId) {
                    loadTableDataFromAcc(accRes.data.TableId);
                }
            } else {
                setAccount(null);
                setClientForm(prev => ({ name: 'Cliente', dni: '', direccion: '', accountType: prev.accountType || 'standard' }));
            }
        } catch (aErr) {
            console.error("Error loading account:", aErr);
        } finally {
            setIsAccountLoaded(true);
        }
    };

    const loadTableDataFromAcc = async (resolvedTableId) => {
        try {
            const tableRes = await axios.get(`/api/tables/${resolvedTableId}?t=${Date.now()}`);
            setTableData(tableRes.data);
        } catch (tErr) {
            console.error("Error loading table from account:", tErr);
        }
    };

    const loadTableData = async () => {
        if (!tableId) return;
        try {
            const tableRes = await axios.get(`/api/tables/${tableId}?t=${Date.now()}`);
            setTableData(tableRes.data);
        } catch (tErr) {
            console.error("Error loading table:", tErr);
        }
    };

    // Initial Load & Context Trigger
    useEffect(() => {
        setIsAccountLoaded(false);
        if (tableId) loadTableData();
        fetchProducts();
        fetchAccount();
        fetchDailyMenu();
        fetchDrinkPromotions();
    }, [tableId, accountId, refreshTrigger]);

    // DIRECT SOCKET LISTENER (Redundancy for safety)
    const { socket } = useRestaurant(); // Ensure socket is exposed in Context
    useEffect(() => {
        if (!socket) return;

        const handleProductUpdate = () => {
            console.log("[TableControl] Direct Socket Event: product_updated");
            fetchProducts();
            fetchDailyMenu(); // Update menus too
            // Account might change if order deleted
            fetchAccount();
        };

        socket.on('product_updated', handleProductUpdate);

        return () => {
            socket.off('product_updated', handleProductUpdate);
        };
    }, [socket]); // Re-bind if socket changes

    useEffect(() => {
        if (!socket) return;
        if (showPaymentModal) {
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        } else {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        }

        return () => {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        };
    }, [socket, showPaymentModal]);

    // Set loading false after initial checks
    useEffect(() => {
        // Simple timeout to clear loading state if it gets stuck, 
        // or we can set it false after all fetches return. 
        // For now, let's just set it false after mount since we have optimistic UI.
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const lastSearchRef = useRef('');

    // --- NEW: Custom Staff Confirmation ---
    const [showStaffConfirm, setShowStaffConfirm] = useState(false);
    // --------------------------------------

    useModalBackHandler(true, onClose);
    useModalBackHandler(showPaymentModal, () => setShowPaymentModal(false));
    useModalBackHandler(showStaffConfirm, () => setShowStaffConfirm(false));

    // --- 2x1 & MENU LOGIC START ---
    const handleClose = async () => {
        // If an account was opened but has NO orders, cancel it to free the table.
        // Even if there are items in the local cart, they will be lost anyway.
        if (account && (!account.Orders || account.Orders.length === 0)) {
            try {
                await axios.post(`/api/accounts/${account.id}/cancel`, { userId: user?.id });
            } catch (err) {
                console.error("Error auto-cancelling empty account on close:", err);
            }
        } else if (isAccountLoaded && !account && tableData && tableData.status !== 'free') {
            // Self-healing: Table is marked occupied or reserved in UI but has no active account
            try {
                await axios.put(`/api/tables/${tableId}`, { status: 'free' });
                refreshData(); // Trigger UI rebuild
            } catch (err) {
                console.error("Error freeing orphan table:", err);
            }
        }
        onClose();
    };

    const handleAutoOpen = async () => {
        try {
            const res = await axios.post('/api/accounts/open', {
                tableId,
                customerName: clientForm.accountType === 'staff' ? 'Personal' : 'Cliente',
                clientDni: '',
                clientAddress: clientForm.direccion || '',
                userId: user?.id || null,
                accountType: clientForm.accountType
            });
            setAccount(res.data);
            setClientForm({
                name: res.data.customerName,
                dni: res.data.clientDni || '',
                direccion: res.data.clientAddress || '',
                accountType: res.data.accountType || 'standard'
            });
            return res.data;
        } catch (err) {
            console.error("Error auto-opening:", err);
            const errorMsg = err.response?.data?.error || err.message || "Error desconocido";

            if (errorMsg === 'Mesa ya ocupada') {
                console.log("Mesa ya ocupada, recargando datos...");
                await loadData();
                return null;
            }

            alert(`Error al abrir la cuenta automaticamente: ${errorMsg}`);
            return null;
        }
    };

    const updateClientInfo = async () => {
        try {
            const res = await axios.put(`/api/accounts/${account.id}`, {
                customerName: clientForm.name,
                clientDni: clientForm.dni,
                clientAddress: clientForm.direccion,
                accountType: clientForm.accountType
            });
            setAccount(res.data);
            setIsEditingClient(false);
        } catch (err) {
            alert('Error actualizando cliente');
        }
    };

    const handleProductClick = (product) => {
        // 1. Check for Variants (Prefer Relational Model over JSON)
        if (product.ProductVariants && product.ProductVariants.length > 0) {
            console.log("Using Relational ProductVariants:", product.ProductVariants);
            const allOptions = product.ProductVariants.map(v => ({
                name: v.name,
                price: v.price,
                stock: getEffectiveStock(product, v.name),
                id: v.id,
                happyHourPrice: v.happyHourPrice,
                happyHourStart: v.happyHourStart,
                happyHourEnd: v.happyHourEnd
            }));

            // Auto-add if there's exactly 1 option
            if (allOptions.length === 1) {
                const singleOption = allOptions[0];
                addToCart(product, '', [], singleOption.name);
                return;
            }

            setPendingVariantProduct({ ...product, parsedVariants: allOptions });
            setVariantQuantities({});
            return;
        }

        // Fallback to JSON (Legacy)
        if (product.presentations) {
            try {
                const variants = typeof product.presentations === 'string' ? JSON.parse(product.presentations) : product.presentations;
                if (Array.isArray(variants) && variants.length > 0) {
                    // Filter out 'Normal' if it's explicitly recreating it; Map actual specific variants
                    const allOptions = variants.map(v => ({
                        name: v.name,
                        price: v.price || product.price,
                        stock: getEffectiveStock(product, v.name)
                    }));
                    setPendingVariantProduct({ ...product, parsedVariants: allOptions });
                    setVariantQuantities({});
                    return;
                }
            } catch (e) { console.error("Error parsing variants", e); }
        }

        // 2. Default Add
        addToCart(product);
    };

    const addToCart = (product, specificNotes = '', subItems = [], presentationName = null, overridePrice = null, quantityToAdd = 1) => {
        // Intercept Menu Type -> Switch to Inline Builder
        if (product.type === 'menu' && !specificNotes) {
            setPendingMenuProduct(product);
            // Ensure menu data is fresh
            if (dailyMenu.entries.length === 0) fetchDailyMenu();
            setViewMode('menu_builder'); // Switch View
            setMenuSelection({ entry: '', main: '' });
            return;
        }

        const isStaffConsumption = (account?.accountType === 'staff') || (!account && clientForm?.accountType === 'staff');

        let basePrice = 0;
        let activePrice = 0;

        const variants = product.parsedVariants || product.ProductVariants;

        if (overridePrice !== null) {
            basePrice = parseFloat(overridePrice);
            activePrice = parseFloat(overridePrice);
        } else if (presentationName && variants) {
            const variantEntry = variants.find(v => v.name === presentationName);
            if (variantEntry) {
                basePrice = parseFloat(variantEntry.price || 0);
                const isHH = variantEntry.happyHourPrice && isHappyHourActive(variantEntry.happyHourStart, variantEntry.happyHourEnd);
                activePrice = isHH ? parseFloat(variantEntry.happyHourPrice) : basePrice;
            } else {
                basePrice = product.price !== undefined ? parseFloat(product.price) : 0;
                const isHH = product.happyHourPrice && isHappyHourActive(product.happyHourStart, product.happyHourEnd);
                activePrice = isHH ? parseFloat(product.happyHourPrice) : basePrice;
            }
        } else {
            basePrice = product.price !== undefined ? parseFloat(product.price) : 0;
            const isHH = product.happyHourPrice && isHappyHourActive(product.happyHourStart, product.happyHourEnd);
            activePrice = isHH ? parseFloat(product.happyHourPrice) : basePrice;
        }

        const finalPriceCalc = isStaffConsumption ? 0 : activePrice;
        const originalPriceCalc = isStaffConsumption ? activePrice : basePrice;

        setCart(prev => {
            // Use custom ticket name over original name if provided (helpful for decoupled combos)
            const finalName = product.customNameForTicket || product.name;
            const existingIndex = prev.findIndex(item =>
                item.productId === product.id &&
                item.notes === (specificNotes || '') &&
                item.name === finalName &&
                JSON.stringify(item.subItems) === JSON.stringify(subItems)
            );

            if (existingIndex !== -1) {
                const newCart = [...prev];
                newCart[existingIndex] = {
                    ...newCart[existingIndex],
                    quantity: newCart[existingIndex].quantity + quantityToAdd
                };
                return newCart;
            }
            return [...prev, {
                productId: product.id,
                name: finalName,
                price: finalPriceCalc,
                originalPrice: originalPriceCalc,
                quantity: quantityToAdd,
                notes: specificNotes || '',
                subItems: subItems,
                presentation: presentationName // Important: Send this to backend
            }];
        });
    };

    const handleConfirmVariants = () => {
        if (!pendingVariantProduct) return;
        Object.entries(variantQuantities).forEach(([presentationName, qty]) => {
            if (qty > 0) {
                addToCart(pendingVariantProduct, '', [], presentationName, null, qty);
            }
        });
        setPendingVariantProduct(null);
    };

    const confirmMenuSelection = () => {
        if (!menuSelection.entry && !menuSelection.main) {
            alert("Debes seleccionar al menos una Entrada o un Segundo");
            return;
        }

        // Find linked IDs and Menu Item IDs
        const entryObj = filteredEntries.find(e => e.name === menuSelection.entry && (e.groupName || 'Menú del Día') === pendingMenuProduct.name);
        const mainObj = filteredMains.find(m => m.name === menuSelection.main && (m.groupName || 'Menú del Día') === pendingMenuProduct.name);

        const subItems = [];
        let totalCustomPrice = 0;
        let isCombo = false;

        if (menuSelection.entry && menuSelection.main) {
            isCombo = true;
        }

        // Add Entry
        if (entryObj && menuSelection.entry) {
            subItems.push({
                productId: entryObj.linkId || null,
                menuItemId: entryObj.id || null, // BACKWARD COMPATIBILITY: Allow null if no ID
                quantity: 1,
                name: entryObj.name, // For display/logging
                price: entryObj.individualPrice || 0 // Individual price
            });
            if (!isCombo) totalCustomPrice += Number(entryObj.individualPrice || 0);
        }

        // Add Main
        if (mainObj && menuSelection.main) {
            subItems.push({
                productId: mainObj.linkId || null,
                menuItemId: mainObj.id || null,
                quantity: 1,
                name: mainObj.name,
                price: mainObj.individualPrice || 0
            });
            if (!isCombo) totalCustomPrice += Number(mainObj.individualPrice || 0);
        }

        let note = '';
        if (isCombo) {
            note = `Combo: ${menuSelection.entry || 'N/A'} + ${menuSelection.main || 'N/A'}`;
        } else if (menuSelection.entry) {
            note = `Solo: ${menuSelection.entry}`;
        } else if (menuSelection.main) {
            note = `Solo: ${menuSelection.main}`;
        }

        // If it's a dynamic menu (Virtual), use its name as Presentation to show on bill
        // e.g. Product: "Menú del Día", Presentation: "Menú Lunes"
        const presentation = pendingMenuProduct.isVirtualGroup ? pendingMenuProduct.name : null;

        // Clone the product to give it a custom name/price if it's an individual item
        const productToCart = { ...pendingMenuProduct };
        let overridePrice = null;
        if (!isCombo) {
            overridePrice = totalCustomPrice;
            productToCart.price = totalCustomPrice;
        }

        addToCart(productToCart, note, subItems, presentation, overridePrice);
        setViewMode('products'); // Return to List
        setPendingMenuProduct(null);
        setMenuSelection({ entry: null, main: null }); // Reset selection just in case
    };

    const cancelMenuSelection = () => {
        setViewMode('products');
        setPendingMenuProduct(null);
    };

    const [showPinPad, setShowPinPad] = useState(false);
    const [pinError, setPinError] = useState('');

    const sendOrder = async () => {
        if (cart.length === 0) return;

        if (user?.requirePinPrompt) {
            setPinError('');
            setShowPinPad(true);
            return;
        }

        await executeSendOrder();
    };

    const handlePinConfirm = async (enteredPin) => {
        setPinError('');
        const success = await executeSendOrder(enteredPin);
        if (success) {
            setShowPinPad(false);
        }
    };

    const executeSendOrder = async (authorPin = null) => {
        let targetAccountId = account?.id;

        try {
            if (!targetAccountId) {
                // Open account NOW because we are sending an order
                const newAccount = await handleAutoOpen();
                if (!newAccount) return false;
                targetAccountId = newAccount.id;
            }

            await axios.post('/api/orders', {
                accountId: targetAccountId,
                products: cart,
                userId: user?.id || null,
                authorPin: authorPin
            });
            setCart([]);

            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            // Also trigger global refresh to update other components
            refreshData();

            return true;
        } catch (err) {
            const errorMsg = err.response?.data?.details?.join('\n') || err.response?.data?.error || 'Error enviando pedido';
            if (user?.requirePinPrompt) {
                setPinError(errorMsg);
            } else {
                alert(errorMsg);
            }
            console.error(err);
            return false;
        }
    };

    const updateOrderStatus = async (orderId, status) => {
        try {
            await axios.put(`/api/orders/${orderId}/status`, { status });
            // Socket will trigger refresh via context
        } catch (err) {
            alert("Error actualizando estado");
        }
    };

    const handleDeleteOrder = async (orderId) => {
        setDeleteConfirmId(null); // Clear inline confirmation
        try {
            await axios.delete(`/api/orders/${orderId}?userId=${user?.id}`);
            // Force reload manually to see price update immediately
            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            refreshData();

        } catch (err) {
            alert("Error eliminando pedido");
            console.error(err);
        }
    };

    const handleDecrementOrder = async (orderId) => {
        try {
            await axios.put(`/api/orders/${orderId}/decrement`, { userId: user?.id });
            // Force reload manually to see price update immediately
            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            refreshData();

        } catch (err) {
            alert("Error reduciendo cantidad de pedido");
            console.error(err);
        }
    };

    const handleCloseClick = async () => {
        if (!account) {
            if (tableData && tableData.status !== 'free') {
                try {
                    await axios.put(`/api/tables/${tableId}`, { status: 'free' });
                    refreshData();
                } catch (e) { }
            }
            onClose();
            return;
        }

        // Case: Liberar Mesa (No orders or explicit release)
        if (!account.Orders || account.Orders.length === 0) {
            if (!confirm("¿Liberar mesa y cancelar cuenta vacía?")) return;
            try {
                await axios.post(`/api/accounts/${account.id}/cancel`, { userId: user?.id });
                // Refresh table status in background or just close
                onClose();
            } catch (e) {
                alert("Error liberando mesa");
            }
            return;
        }

        if (account.accountType === 'staff') {
            if (!confirm("¿Cerrar consumo de personal? (Total S/ 0)")) return;
            try {
                const formData = new FormData();
                formData.append('paymentMethod', 'consumo_interno');
                if (user?.id) {
                    formData.append('userId', user.id);
                }
                await axios.post(`/api/accounts/${account.id}/close`, formData);
                onClose();
                refreshData();
            } catch (e) {
                alert("Error al cerrar consumo de personal");
            }
            return;
        }

        const totalPaid = account.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
        const remaining = Math.max(0, parseFloat(account.total) - totalPaid);
        setPayAmount(remaining.toString());

        setShowPaymentModal(true);
        setIsConfirmingPayment(false); // Reset confirmation state
        setIssueInvoice(false); // ALWAYS start disabled
        setInvoiceType(clientForm.dni && clientForm.dni.length === 11 ? 'factura' : 'boleta');
    };

    const confirmPayment = async () => {
        // Instead of native confirm(), we use a UI-based confirmation step
        if (!isConfirmingPayment) {
            setIsConfirmingPayment(true);
            return;
        }

        if (isProcessingPayment) return;
        setIsProcessingPayment(true);

        const totalPaid = account.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
        const remaining = Math.max(0, parseFloat(account.total) - totalPaid);
        const enteredAmount = parseFloat(payAmount);

        if (isNaN(enteredAmount) || enteredAmount <= 0) {
            alert('Por favor ingrese un monto a pagar válido.');
            setIsConfirmingPayment(false);
            setIsProcessingPayment(false);
            return;
        }

        const isPartial = enteredAmount < (remaining - 0.01);
        setIsLastPaymentPartial(isPartial);

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
            // Save inline client edits if any
            if (account && (clientForm.dni !== account.clientDni || clientForm.name !== account.customerName || clientForm.direccion !== account.clientAddress)) {
                await axios.put(`/api/accounts/${account.id}`, {
                    customerName: clientForm.name,
                    clientDni: clientForm.dni,
                    clientAddress: clientForm.direccion,
                    accountType: clientForm.accountType
                });
            }

            // Pre-create invoice if requested
            let resInvoiceData = null;
            if (issueInvoice) {
                let itemsToBill = [];
                if (isPartial) {
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
                            pName = `2x1: ${o.notes}`;
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
                setEvidenceFiles([]); // Reset file
                if (isPartial) {
                    fetchAccount();
                } else {
                    onClose();
                }
            }
        } catch (err) {
            alert('Error al procesar el pago: ' + (err.response?.data?.error || err.message));
            setIsConfirmingPayment(false); // Reset on error
        } finally {
            setIsProcessingPayment(false);
        }
    };

    // === MENU DATA PARSING ===
    // The DB stores all items in 'entries' with a 'category' field ('entry' or 'main').
    // We need to split them for the UI logic.
    const { parsedEntries, parsedMains, menuGroups } = React.useMemo(() => {
        if (!dailyMenu || !dailyMenu.entries) return { parsedEntries: [], parsedMains: [], menuGroups: [] };

        const allItems = [...dailyMenu.entries, ...(dailyMenu.mains || [])];

        // 1. Split by Category (Robust: If 'main', it's main. Else, it's entry).
        const pEntries = [];
        const pMains = [];

        allItems.forEach(item => {
            if (item.category === 'main') {
                pMains.push(item);
            } else {
                pEntries.push(item); // Default to entry if category missing/mismatched
            }
        });

        // 2. Extract Groups
        const groupsMap = {};
        allItems.forEach(item => {
            const gName = item.groupName || 'Menú del Día';

            // 1. Try Exact/Normalized Match
            const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            let realProduct = products.find(p => p.name === gName || normalize(p.name) === normalize(gName));
            let isFallback = false;

            // 2. Fallback Strategy: Find ANY 'menu' type product
            if (!realProduct) {
                // Prefer "Menú del Día" or "Menu del Dia" as generic base
                realProduct = products.find(p => normalize(p.name).includes("menu del dia"));

                // If not found, take ANY menu
                if (!realProduct) {
                    realProduct = products.find(p => p.type === 'menu');
                }

                if (realProduct) {
                    isFallback = true;
                    // console.log(`[TableControl] Using Fallback Product "${realProduct.name}" (ID: ${realProduct.id}) for Dynamic Group "${gName}"`);
                }
            }

            if (!groupsMap[gName]) {
                groupsMap[gName] = {
                    id: realProduct ? realProduct.id : `menu-group-${gName}`, // Valid ID if fallback found
                    name: gName, // Keep the Dynamic Name (e.g., "Menú Lunes")
                    price: item.menuPrice || (realProduct ? realProduct.price : 0),
                    type: 'menu',
                    isStockManaged: false,
                    isVirtualGroup: !realProduct || isFallback,
                    fallbackOriginalName: realProduct ? realProduct.name : null // Store base name
                };
            }
        });

        return {
            parsedEntries: pEntries,
            parsedMains: pMains,
            menuGroups: Object.values(groupsMap)
        };
    }, [dailyMenu, products]);

    // Filter Products
    let displayProducts = products;
    if (selectedCategory === 'menu') {
        // STRICTLY show only the Daily Menu Groups configured
        displayProducts = menuGroups;
    }

    const filteredProducts = displayProducts.filter(p =>
        (selectedCategory === 'menu' ? true : p.type === selectedCategory) && // For menu, we already set displayProducts to menuGroups
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Dynamic Filter for Menu Options based on the pending Menu Product Name
    const getMenuOptions = (list) => {
        if (!pendingMenuProduct) return [];
        // Strict Match by groupName
        return list.filter(item => (item.groupName || 'Menú del Día') === pendingMenuProduct.name);
    };

    // Helper to calculate effective stock based on ingredients
    const getEffectiveStock = (product, presentation = null) => {
        if (!product) return 0;

        // 1. If it has Recipes, calculate limit based on Ingredients
        if (product.Recipes && product.Recipes.length > 0) {
            let targetRecipes = [];
            if (presentation) {
                targetRecipes = product.Recipes.filter(r => r.presentation === presentation);
                if (targetRecipes.length === 0) targetRecipes = product.Recipes.filter(r => r.presentation === null);
            } else {
                targetRecipes = product.Recipes.filter(r => r.presentation === null);
                // Fallback for variants if no base recipe
                if (targetRecipes.length === 0) {
                    const uniquePres = [...new Set(product.Recipes.map(r => r.presentation))].filter(p => p);
                    if (uniquePres.length > 0) {
                        // If all recipes are variant-specific, we check all of them or just return a combined limit? 
                        // For display, let's pick the "Standard" one or first found
                        targetRecipes = product.Recipes.filter(r => r.presentation === uniquePres[0]);
                    }
                }
            }

            if (targetRecipes.length > 0) {
                let minStock = Infinity;
                targetRecipes.forEach(recipe => {
                    if (recipe.Ingredient) {
                        const avail = Math.floor(parseFloat(recipe.Ingredient.stock) / parseFloat(recipe.quantity) || 0);
                        minStock = Math.min(minStock, avail);
                    }
                });
                return minStock === Infinity ? 0 : minStock;
            } else {
                return 0; // Has recipes, but none match the requested presentation
            }
        } else if (product.requiresPreparation && !product.isStockManaged && product.type !== 'menu') {
            // Prepared items without any recipe configured should show 0 stock to match backend validation
            return 0;
        }

        // 2. If it's a direct Stock Managed or has variants
        if (product.isStockManaged) {
            if (presentation && product.ProductVariants) {
                const variant = product.ProductVariants.find(v => v.name === presentation);
                return variant ? variant.stock : product.stock;
            }
            // If it has variants, we sum them for the main button
            if (product.ProductVariants && product.ProductVariants.length > 0) {
                return product.ProductVariants.reduce((sum, v) => sum + (v.stock || 0), product.stock || 0);
            }
            return product.stock || 0;
        }

        return 999; // Assume infinite if no stock management or recipes AND it's not a required preparation item
    };

    // Helper to sync Daily Menu items with Real Product Stock
    const syncMenuStock = (items) => {
        if (!items) return [];
        return items.map(item => {
            const realProduct = item.linkId != null ? products.find(p => p.id == item.linkId) : null;
            let finalStock = item.stock !== undefined ? item.stock : 20;

            if (realProduct) {
                const physicalLimit = getEffectiveStock(realProduct);
                if (realProduct.type === 'daily_entry' || realProduct.type === 'daily_main') {
                    // Logic: Manual limit but cannot exceed physical ingredients
                    finalStock = Math.min(item.stock, physicalLimit);
                } else {
                    finalStock = physicalLimit;
                }
            }
            return { ...item, stock: finalStock, individualPrice: realProduct ? parseFloat(realProduct.price || 0) : 0 };
        });
    };

    const filteredEntries = getMenuOptions(syncMenuStock(parsedEntries));
    const filteredMains = getMenuOptions(syncMenuStock(parsedMains));

    // Calculate Stock for Menu Products
    const getMenuStockStats = (menuGroup) => {
        // 1. Get all items belonging to this group
        const groupEntries = syncMenuStock(parsedEntries).filter(e => (e.groupName || 'Menú del Día') === menuGroup.name);
        const groupMains = syncMenuStock(parsedMains).filter(m => (m.groupName || 'Menú del Día') === menuGroup.name);

        const totalEntriesStock = groupEntries.reduce((sum, e) => sum + Number(e.stock || 0), 0);
        const totalMainsStock = groupMains.reduce((sum, m) => sum + Number(m.stock || 0), 0);

        const minStock = Math.min(totalEntriesStock, totalMainsStock);

        const hasUnlimitedEntry = groupEntries.some(e => Number(e.stock || 0) >= 999);
        const hasUnlimitedMain = groupMains.some(m => Number(m.stock || 0) >= 999);
        const isUnlimited = hasUnlimitedEntry && hasUnlimitedMain;

        return {
            stock: minStock,
            isUnlimited,
            details: `E:${totalEntriesStock}/S:${totalMainsStock}`
        };
    };

    const isProductOutOfStock = (prod) => {
        const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
        let displayStock = getEffectiveStock(prod);
        if (prod.type === 'menu') {
            const stats = getMenuStockStats(prod);
            displayStock = stats.stock;
        }
        const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
        return isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
    };

    const renderStockOrLibreBadge = (prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails) => {
        if (isMissingRecipe) {
            return (
                <span className="inline-block bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                    Receta
                </span>
            );
        }

        if (hasVariants && variantsList.length > 1) {
            const allOut = variantsList.every(v => v.stock !== undefined && v.stock <= 0);
            if (allOut) {
                return (
                    <span className="inline-block bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                        Agotado
                    </span>
                );
            }
            if (prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') {
                return (
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                        Con Stock
                    </span>
                );
            } else {
                return null;
            }
        }

        const isManaged = prod.isStockManaged || prod.requiresPreparation || (prod.type === 'menu' && !isMenuUnlimited);
        if (!isManaged) {
            return null;
        }

        if (isOutOfStock) {
            return (
                <span className="inline-block bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                    Agotado {stockDetails ? `(${stockDetails})` : ''}
                </span>
            );
        }

        const stockQty = (hasVariants && variantsList.length === 1 && variantsList[0].stock !== undefined) ? variantsList[0].stock : displayStock;
        return (
            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                Stock: {stockQty}
            </span>
        );
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const accountTotal = account ? parseFloat(account.total) : 0;
    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
    const remaining = account ? Math.max(0, accountTotal - totalPaid) : 0;

    if (loading) {
        return createPortal(
            <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Cargando...</div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4 z-50">
            <div className="bg-white w-full h-[100dvh] md:h-[90vh] md:max-w-6xl rounded-none md:rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

                {/* --- MOBILE: CART VIEW OVERLAY --- */}
                {showMobileCart && (
                    <div className="md:hidden absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart size={20} /> Carrito</h2>
                            <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-gray-200 rounded-full"><X /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Account Info in Cart View */}
                            {account && (
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                    {isEditingClient ? (
                                        <div className="bg-white p-3 rounded border shadow-sm space-y-2">
                                            <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                                                <input
                                                    type="checkbox"
                                                    id="staff_toggle_edit_mobile"
                                                    checked={clientForm.accountType === 'staff'}
                                                    onChange={async (e) => {
                                                        if (e.target.checked) {
                                                            setShowStaffConfirm(true); // Open custom modal
                                                        } else {
                                                            const newClientForm = { ...clientForm, accountType: 'standard', name: 'Cliente', dni: '' };
                                                            setClientForm(newClientForm);
                                                            if (account) {
                                                                try {
                                                                    const res = await axios.put(`/api/accounts/${account.id}`, {
                                                                        customerName: newClientForm.name,
                                                                        clientDni: newClientForm.dni,
                                                                        clientAddress: newClientForm.direccion,
                                                                        accountType: newClientForm.accountType
                                                                    });
                                                                    setAccount(res.data);
                                                                    setIsEditingClient(false);
                                                                } catch (err) {
                                                                    console.error("Error setting account to standard:", err);
                                                                    alert('Error al actualizar la cuenta a consumo estándar');
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                                <label htmlFor="staff_toggle_edit_mobile" className="text-xs font-bold text-gray-700 cursor-pointer">Consumo de Trabajador</label>
                                            </div>
                                            {clientForm.accountType === 'staff' ? (
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold text-gray-600">Comentario / Nota de Consumo</label>
                                                    <input 
                                                        className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                                        value={clientForm.direccion || ''} 
                                                        onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                                        placeholder="Escriba un comentario (ej: Juan Pérez)" 
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                                            value={clientForm.dni} 
                                                            onChange={e => setClientForm({ ...clientForm, dni: e.target.value })} 
                                                            placeholder="DNI / RUC" 
                                                            onKeyDown={(e) => { if(e.key === 'Enter') searchClientData() }}
                                                        />
                                                        <button 
                                                            onClick={searchClientData} 
                                                            disabled={isSearchingClient} 
                                                            className="bg-gray-100 p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center min-w-[36px]"
                                                            title="Buscar datos"
                                                        >
                                                            {isSearchingClient ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Search size={16} />}
                                                        </button>
                                                    </div>
                                                    <input 
                                                        className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                                        value={clientForm.name} 
                                                        onChange={e => setClientForm({ ...clientForm, name: e.target.value })} 
                                                        placeholder="Nombre / Razón Social" 
                                                    />
                                                    {clientForm.dni && clientForm.dni.trim().length === 11 && (
                                                        <input 
                                                            className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1 bg-white" 
                                                            value={clientForm.direccion || ''} 
                                                            onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                                            placeholder="Dirección Fiscal" 
                                                        />
                                                    )}
                                                </>
                                            )}
                                            <div className="flex gap-2">
                                                <button onClick={() => setIsEditingClient(false)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-sm font-medium">Cancelar</button>
                                                <button onClick={updateClientInfo} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm font-medium">Guardar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-600 text-sm">Cuenta #{account.id}</span>
                                                <div className="flex flex-col items-end">
                                                    {totalPaid > 0 ? (
                                                        <>
                                                            <span className="text-xs text-gray-500 line-through">Total: S/ {accountTotal.toFixed(2)}</span>
                                                            <span className="font-bold text-lg text-blue-800">Saldo: S/ {remaining.toFixed(2)}</span>
                                                        </>
                                                    ) : (
                                                        <span className="font-bold text-lg text-blue-800">Total: S/ {Number(accountTotal.toFixed(1))}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-start mt-2">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-800 font-bold">{account.customerName}</span>
                                                        {account.accountType === 'staff' && (
                                                            <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Staff</span>
                                                        )}
                                                    </div>
                                                    {account.clientDni && (
                                                        <span className="text-xs text-gray-500 font-semibold mt-0.5">DNI/RUC: {account.clientDni}</span>
                                                    )}
                                                    {account.accountType === 'staff' && account.clientAddress && (
                                                        <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded px-2 py-1 mt-1 font-medium italic">
                                                            Nota: {account.clientAddress}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => setIsEditingClient(true)} className="text-xs text-blue-600 font-bold px-2 py-1 rounded bg-white border border-blue-200 hover:bg-blue-50">Editar Cliente</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* New Account Info in Cart View (Checkbox Staff + Comment) */}
                            {!account && (
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="staff_toggle_new_mobile"
                                            checked={clientForm.accountType === 'staff'}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setShowStaffConfirm(true); // Open custom modal
                                                } else {
                                                    setClientForm({ ...clientForm, accountType: 'standard' });
                                                }
                                            }}
                                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="staff_toggle_new_mobile" className="text-xs font-bold text-orange-800 cursor-pointer">Consumo de Trabajador</label>
                                    </div>
                                    {clientForm.accountType === 'staff' && (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-bold text-gray-600">Comentario / Nota de Consumo</label>
                                            <input 
                                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                                value={clientForm.direccion || ''} 
                                                onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                                placeholder="Escriba un comentario..." 
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SENT ORDERS (Mobile View) */}
                            {groupedOrders.length > 0 && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 shadow-sm">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 border-b pb-1">Pedidos Enviados</h3>
                                    <div className="space-y-2">
                                        {groupedOrders.map(o => {
                                            let pName = "Producto desconocido";
                                            let displayNotes = o.notes;
                                            let originalP = null;

                                            if (!o.ProductId && o.notes) {
                                                pName = `2x1: ${o.notes}`;
                                                displayNotes = null;
                                            } else if (o.Product && o.Product.name) {
                                                pName = o.Product.name;
                                            } else if (products.length > 0) {
                                                const localP = products.find(p => p.id === o.ProductId);
                                                if (localP) pName = localP.name;
                                            }

                                            if (products.length > 0 && o.ProductId) {
                                                const localP = products.find(p => p.id === o.ProductId);
                                                if (localP) {
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

                                            const isStaff = account?.accountType === 'staff';
                                            return (
                                                <div key={o.key} className="flex justify-between items-center text-sm border-b border-dashed pb-2 last:border-b-0 last:pb-0">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700">
                                                            {o.quantity}x {pName}
                                                            <span className="text-blue-600 ml-1">
                                                                {isStaff ? (
                                                                    o.quantity > 1 ? (
                                                                        <span className="text-orange-600">({o.quantity}x <span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> = <span className="line-through text-gray-400">S/ {Number((o.quantity * parseFloat(originalP || 0)).toFixed(1))}</span> a costo S/ 0)</span>
                                                                    ) : (
                                                                        <span className="text-orange-600">(<span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> a costo S/ 0)</span>
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

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2">
                                                        {['admin', 'waiter', 'cashier'].includes(user.role) && (
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
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cart Items */}
                            {cart.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">Carrito vacío</div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <div>
                                            <div className="font-bold text-gray-800">{item.name}</div>
                                            <div className="text-blue-600 font-bold">S/ {Number((item.price * item.quantity).toFixed(1))}</div>
                                            {item.notes && <div className="text-xs text-gray-400 max-w-[200px] truncate">{item.notes}</div>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600"
                                            >-</button>
                                            <span className="font-bold w-4 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p))}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600"
                                            >+</button>
                                            <button
                                                onClick={() => setCart(c => c.filter((_, i) => i !== idx))}
                                                className="ml-2 text-red-400"
                                            ><X size={18} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50">
                            {account?.accountType !== 'staff' && totalPaid > 0 && (
                                <div className="space-y-1 text-xs border-b pb-2 mb-2 text-gray-500">
                                    <div className="flex justify-between">
                                        <span>Total consumido:</span>
                                        <span className="font-semibold">S/ {accountTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-green-600">
                                        <span>Abonado:</span>
                                        <span className="font-semibold">- S/ {totalPaid.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-gray-600">{totalPaid > 0 ? 'Saldo Pendiente' : 'Total a Pagar'}</span>
                                <span className="text-2xl font-bold text-blue-800">S/ {Number((account?.accountType === 'staff' ? 0 : (cartTotal + (totalPaid > 0 ? remaining : accountTotal))).toFixed(1))}</span>
                            </div>
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="w-full text-blue-600 font-bold text-sm mb-3 text-center block"
                            >
                                Seguir Comprando
                            </button>
                            {cart.length > 0 ? (
                                <button
                                    onClick={sendOrder}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                                >
                                    Enviar Pedido <Check size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleCloseClick}
                                    className={`w-full text-white py-3 rounded-xl font-bold text-lg shadow-lg ${(!account || (account.Orders && account.Orders.length === 0))
                                        ? "bg-gray-500 hover:bg-gray-600"
                                        : "bg-red-500 hover:bg-red-600"
                                        }`}
                                >
                                    {(!account || (account.Orders && account.Orders.length === 0)) ? "Liberar Mesa" : "Pagar"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* --- VARIANT SELECTION MODAL --- */}
                {
                    pendingVariantProduct && (
                        <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-4 animate-in fade-in">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-gray-800">{pendingVariantProduct.name}</h3>
                                    <button onClick={() => setPendingVariantProduct(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-gray-500 mb-4">Selecciona las cantidades para cada presentación:</p>
                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                        {pendingVariantProduct.parsedVariants.map((v, idx) => {
                                            const currentQty = variantQuantities[v.name] || 0;
                                            const qtyInCart = cart.reduce((acc, item) => 
                                                (item.productId === pendingVariantProduct.id && item.presentation === v.name) ? acc + item.quantity : acc
                                            , 0);
                                            const isAddDisabled = v.stock !== undefined && (qtyInCart + currentQty) >= v.stock;
                                            
                                            const handleIncrement = () => {
                                                if (isAddDisabled) return;
                                                setVariantQuantities(prev => ({
                                                    ...prev,
                                                    [v.name]: (prev[v.name] || 0) + 1
                                                }));
                                            };
                                            
                                            const handleDecrement = () => {
                                                if (currentQty <= 0) return;
                                                setVariantQuantities(prev => ({
                                                    ...prev,
                                                    [v.name]: Math.max(0, (prev[v.name] || 0) - 1)
                                                }));
                                            };

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl transition-all ${v.stock <= 0 ? 'opacity-50 grayscale' : ''}`}
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-bold text-base text-gray-800">
                                                            {v.name === 'Normal' ? `Base` : v.name}
                                                        </span>
                                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                            {v.happyHourPrice && isHappyHourActive(v.happyHourStart, v.happyHourEnd) ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-gray-400 line-through">S/ {Number(parseFloat(v.price).toFixed(1))}</span>
                                                                    <span className="font-bold text-yellow-600 text-sm">S/ {Number(parseFloat(v.happyHourPrice).toFixed(1))}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-bold text-gray-700 text-sm">S/ {Number(parseFloat(v.price).toFixed(1))}</span>
                                                            )}
                                                            {v.stock !== undefined && (pendingVariantProduct.isStockManaged || pendingVariantProduct.requiresPreparation || pendingVariantProduct.type === 'menu') && (
                                                                <span className={`text-[10px] ${v.stock <= 0 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                                    Stock: {v.stock} {qtyInCart > 0 ? `(${qtyInCart} en cart)` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Quantity Controls */}
                                                    {v.stock > 0 ? (
                                                        <div className="flex items-center gap-2.5">
                                                            {currentQty > 0 && (
                                                                <>
                                                                    <button
                                                                        onClick={handleDecrement}
                                                                        className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 rounded-full font-black text-lg hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="font-bold text-blue-700 w-4 text-center">
                                                                        {currentQty}
                                                                    </span>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={handleIncrement}
                                                                disabled={isAddDisabled}
                                                                className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-lg transition-all
                                                                    ${isAddDisabled
                                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Agotado</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Action Buttons at bottom of modal */}
                                    <div className="mt-5 pt-3 border-t flex gap-3">
                                        <button
                                            onClick={() => setPendingVariantProduct(null)}
                                            className="flex-1 py-3 text-gray-600 bg-gray-100 font-bold hover:bg-gray-200 rounded-xl transition-colors text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleConfirmVariants}
                                            disabled={Object.values(variantQuantities).reduce((a, b) => a + b, 0) === 0}
                                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-all text-sm
                                                ${Object.values(variantQuantities).reduce((a, b) => a + b, 0) === 0
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        >
                                            Confirmar ({Object.values(variantQuantities).reduce((a, b) => a + b, 0)})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* --- MAIN MENU VIEW (Visible on Desktop & Mobile when not in Cart Mode) --- */}

                {/* LEFT: Product Grid */}
                <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
                    {/* Header */}
                    <div className="px-2.5 py-3.5 sm:p-4 bg-white shadow-sm z-10">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" />
                                    {tableData ? formatTableName(tableData) : `Mesa #...`}
                                </h2>
                                {/* TRANSFER BUTTON - Only if account exists */}
                                {account && (
                                    <button
                                        onClick={() => setShowTransferModal(true)}
                                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1 transition-colors text-xs font-bold"
                                        title="Cambiar de Mesa"
                                    >
                                        <ArrowRightLeft size={14} />
                                        <span className="hidden sm:inline">Mover</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search Bar */}
                        {/* Search Bar — Unified for all categories, including 2x1 search across promos */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={selectedCategory === 'combo' ? "Buscar trago en todas las promos..." : "Buscar productos..."}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Categories */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {['dish', 'drink', 'menu', 'combo'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        // The useEffect handles the viewMode switch now
                                        if (cat === 'combo') {
                                            setPendingComboPromo(null);
                                            setComboSelection([]);
                                        }
                                    }}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${selectedCategory === cat ? (cat === 'combo' ? 'bg-purple-600 text-white ring-2 ring-purple-300 ring-offset-1' : 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1') : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {cat === 'dish' ? 'Platos' : cat === 'drink' ? 'Bebidas' : cat === 'menu' ? 'Menús' : <span className="flex items-center gap-1 justify-center"><Wine size={13} />2x1</span>}
                                </button>
                            ))}

                        </div>
                    </div>

                    {/* Transfer Modal */}
                    {showTransferModal && account && tableData && (
                        <TableTransferModal
                            account={account}
                            currentTable={tableData}
                            onClose={() => setShowTransferModal(false)}
                            onSuccess={() => {
                                setShowTransferModal(false);
                                onClose(); // Close TableControl after successful transfer
                            }}
                        />
                    )}

                    {/* Pin Pad Modal */}
                    <PinPadModal
                        isOpen={showPinPad}
                        onClose={() => setShowPinPad(false)}
                        onConfirm={handlePinConfirm}
                        errorMsg={pinError}
                    />

                    {/* Main Content Area — Flex column to support sticky footer */}
                    <div className="flex-1 flex flex-col min-h-0 px-1.5 py-3 sm:px-4 sm:py-4 pb-36 md:pb-4 overflow-hidden">

                        {/* Scrollable Content Wrapper */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">

                            {/* SEARCH RESULTS (Standard categories) */}
                            {searchTerm && selectedCategory !== 'combo' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No se encontraron productos para "{searchTerm}".
                                        </div>
                                    ) : (
                                        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            let isMenuUnlimited = false;
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStats(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                                isMenuUnlimited = stats.isUnlimited;
                                            }

                                            // Determine if out of stock specifically because of missing recipe setup
                                            const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
                                            const isOutOfStock = isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
                                            const hasVariants = (prod.ProductVariants && prod.ProductVariants.length > 0) || (prod.presentations && prod.presentations !== '[]' && prod.presentations.length > 0);
                                            let variantsList = [];
                                            if (prod.ProductVariants && prod.ProductVariants.length > 0) {
                                                variantsList = prod.ProductVariants.map(v => ({
                                                    name: v.name,
                                                    price: v.price,
                                                    stock: getEffectiveStock(prod, v.name),
                                                    happyHourPrice: v.happyHourPrice,
                                                    happyHourStart: v.happyHourStart,
                                                    happyHourEnd: v.happyHourEnd
                                                }));
                                            } else if (prod.presentations) {
                                                try {
                                                    const variants = typeof prod.presentations === 'string' ? JSON.parse(prod.presentations) : prod.presentations;
                                                    if (Array.isArray(variants) && variants.length > 0) variantsList = variants;
                                                } catch (e) { }
                                            }
                                            const needsExtraWidth = variantsList.length >= 4;

                                            return (
                                                <button
                                                    key={`${prod.id}-${displayStock}`}
                                                    disabled={isOutOfStock}
                                                    onClick={() => handleProductClick(prod)}
                                                    className={`bg-white p-2.5 sm:p-3 rounded-lg border shadow-sm text-center flex flex-col items-center justify-between min-h-[10.5rem] h-auto pb-3.5 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-[13px] sm:text-sm leading-tight line-clamp-3 px-1">{prod.name}</div>
                                                        {renderStockOrLibreBadge(prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails)}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-sm sm:text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? prod.happyHourPrice : prod.price).toFixed(1))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* VIEW: PRODUCTS (Standard grid) */}
                            {viewMode === 'products' && !searchTerm && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                                    {(products.filter(p => {
                                        if (selectedCategory === 'menu') {
                                            return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name) && !isProductOutOfStock(p);
                                        }
                                        return p.type === selectedCategory && !isProductOutOfStock(p);
                                    }).length === 0) ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No hay productos disponibles o no coinciden con la búsqueda.
                                        </div>
                                    ) : (
                                        products.filter(p => {
                                            if (selectedCategory === 'menu') {
                                                return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name) && !isProductOutOfStock(p);
                                            }
                                            return p.type === selectedCategory && !isProductOutOfStock(p);
                                        }).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            let isMenuUnlimited = false;
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStats(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                                isMenuUnlimited = stats.isUnlimited;
                                            }

                                            // Determine if out of stock specifically because of missing recipe setup
                                            const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
                                            const isOutOfStock = isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
                                            const hasVariants = (prod.ProductVariants && prod.ProductVariants.length > 0) || (prod.presentations && prod.presentations !== '[]' && prod.presentations.length > 0);
                                            let variantsList = [];
                                            if (prod.ProductVariants && prod.ProductVariants.length > 0) {
                                                variantsList = prod.ProductVariants.map(v => ({
                                                    name: v.name,
                                                    price: v.price,
                                                    stock: getEffectiveStock(prod, v.name),
                                                    happyHourPrice: v.happyHourPrice,
                                                    happyHourStart: v.happyHourStart,
                                                    happyHourEnd: v.happyHourEnd
                                                }));
                                            } else if (prod.presentations) {
                                                try {
                                                    const variants = typeof prod.presentations === 'string' ? JSON.parse(prod.presentations) : prod.presentations;
                                                    if (Array.isArray(variants) && variants.length > 0) variantsList = variants;
                                                } catch (e) { }
                                            }
                                            const needsExtraWidth = variantsList.length >= 4;

                                            return (
                                                <button
                                                    key={`${prod.id}-${displayStock}`}
                                                    disabled={isOutOfStock}
                                                    onClick={() => handleProductClick(prod)}
                                                    className={`bg-white p-2.5 sm:p-3 rounded-lg border shadow-sm text-center flex flex-col items-center justify-between min-h-[9.5rem] h-auto pb-3.5 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-[13px] sm:text-sm leading-tight line-clamp-3 px-1">{prod.name}</div>
                                                        {renderStockOrLibreBadge(prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails)}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-sm sm:text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? prod.happyHourPrice : prod.price).toFixed(1))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* VIEW: 2x1 PROMO CATEGORIES (Step 1) */}
                            {viewMode === 'combo_categories' && !searchTerm && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95">
                                    {drinkPromotions.length === 0 ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic font-medium bg-white rounded-2xl border border-dashed border-gray-200">
                                            No hay promociones 2x1 configuradas.
                                        </div>
                                    ) : (
                                        drinkPromotions.map(promo => (
                                            <button
                                                key={promo.id}
                                                onClick={() => {
                                                    setPendingComboPromo(promo);
                                                    setViewMode('combo_picker');
                                                }}
                                                className="bg-white p-6 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:shadow-lg transition-all text-left flex flex-col justify-between h-40 group relative overflow-hidden"
                                            >
                                                <div className="absolute -right-4 -top-4 text-purple-100 group-hover:text-purple-200 transition-colors transform rotate-12">
                                                    <Tag size={100} strokeWidth={0.5} />
                                                </div>
                                                <div className="relative z-10">
                                                    <div className="text-xs font-black text-purple-600 uppercase tracking-widest mb-1 bg-purple-50 w-fit px-2 py-0.5 rounded-full">2 x 1</div>
                                                    <h3 className="font-black text-gray-900 text-lg leading-tight uppercase line-clamp-2">{promo.name}</h3>
                                                </div>
                                                <div className="flex items-center text-purple-700 font-bold text-sm bg-purple-50 w-fit px-3 py-1 rounded-lg border border-purple-100 relative z-10">
                                                    Explorar tragos
                                                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* VIEW: 2x1 SEARCH RESULTS (Unified search across all promotions) */}
                            {selectedCategory === 'combo' && searchTerm && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    {(() => {
                                        const allItems = drinkPromotions.flatMap(promo =>
                                            (promo.DrinkPromotionItems || []).map(item => ({
                                                ...item,
                                                _promo: promo,
                                                _uid: `${promo.id}:${item.id}`
                                            }))
                                        ).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

                                        if (allItems.length === 0) return (
                                            <div className="text-center text-gray-400 py-20 italic">
                                                No se encontraron tragos que coincidan con "{searchTerm}".
                                            </div>
                                        );

                                        return allItems.map(item => {
                                            const count = getComboItemCount(item.id, item._promo.id);
                                            return (
                                                <div
                                                    key={item._uid}
                                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all border bg-white border-gray-150 shadow-sm"
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-bold text-gray-800">{item.name}</span>
                                                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full uppercase font-black tracking-tight shrink-0">{item._promo.name}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400 mt-0.5">S/ {Number(parseFloat(item.individualPrice || 0).toFixed(1))} individual</span>
                                                    </div>
                                                    
                                                    {/* Quantity Selector Counter */}
                                                    <div className="flex items-center gap-2.5">
                                                        {count > 0 && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleDecrementComboItem(item.id, item._promo.id)}
                                                                    className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-black text-sm hover:bg-purple-200 transition-colors"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="font-bold text-purple-700 w-4 text-center">
                                                                    {count}
                                                                </span>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => handleIncrementComboItem(item, item._promo)}
                                                            disabled={comboSelection.length >= 2}
                                                            className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm transition-all
                                                                ${comboSelection.length >= 2
                                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {/* VIEW: COMBO 2x1 — Selección de items (Step 2) */}
                            {viewMode === 'combo_picker' && pendingComboPromo && !searchTerm && (() => {
                                const items = pendingComboPromo.DrinkPromotionItems || [];
                                return (
                                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col h-full bg-purple-50/50 -m-3 p-3 rounded-b-2xl">
                                        {/* Header info */}
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <button
                                                onClick={() => setViewMode('combo_categories')}
                                                className="text-purple-600 font-bold flex items-center gap-1 text-sm hover:underline"
                                            >
                                                ← Volver a categorías
                                            </button>
                                            <span className="text-xs text-purple-600 font-semibold bg-white border border-purple-200 px-3 py-1 rounded-full shadow-sm">
                                                {comboSelection.length}/2 seleccionados
                                            </span>
                                        </div>
                                        <h4 className="font-black text-gray-800 mb-4 px-1">{pendingComboPromo.name}</h4>

                                        {/* Items of the selected promotion */}
                                        <div className="flex-1 overflow-y-auto space-y-2">
                                            {items.length === 0 ? (
                                                <div className="text-center text-gray-400 py-10 italic">
                                                    No hay tragos en esta categoría.
                                                </div>
                                            ) : (
                                                items.map(item => {
                                                    const count = getComboItemCount(item.id, pendingComboPromo.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all border bg-white border-gray-150 shadow-sm"
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-base font-bold text-gray-800">{item.name}</span>
                                                                <span className="text-xs text-gray-400 mt-0.5">S/ {Number(parseFloat(item.individualPrice ?? 0).toFixed(1))} individual</span>
                                                            </div>
                                                            
                                                            {/* Quantity Selector Counter */}
                                                            <div className="flex items-center gap-2.5">
                                                                {count > 0 && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleDecrementComboItem(item.id, pendingComboPromo.id)}
                                                                            className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-black text-sm hover:bg-purple-200 transition-colors"
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="font-bold text-purple-700 w-4 text-center">
                                                                            {count}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleIncrementComboItem(item, pendingComboPromo)}
                                                                    disabled={comboSelection.length >= 2}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm transition-all
                                                                        ${comboSelection.length >= 2
                                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                            : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* VIEW: MENU BUILDER (INLINE) */}
                            {viewMode === 'menu_builder' && (
                                <div className="animate-in slide-in-from-right h-full flex flex-col pb-8">
                                    <div className="flex items-center gap-2 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <button onClick={cancelMenuSelection} className="p-2 bg-white rounded-full shadow hover:bg-gray-100"><X size={16} /></button>
                                        <div>
                                            <h3 className="font-bold text-gray-800">Armar {pendingMenuProduct?.name}</h3>
                                            <p className="text-xs text-blue-600">Selecciona Entrada y Segundo</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4 overflow-y-auto">
                                        {/* ENTRADAS */}
                                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                                            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                                Entrada
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {filteredEntries.length === 0 && <div className="text-gray-400 italic text-sm p-2 col-span-2">No se encontraron opciones para este menú.</div>}
                                                {filteredEntries.map((entry, i) => (
                                                    <button
                                                        key={i}
                                                        disabled={entry.stock <= 0}
                                                        onClick={() => {
                                                            if (menuSelection.entry === entry.name) {
                                                                setMenuSelection({ ...menuSelection, entry: null }); // Toggle off
                                                            } else {
                                                                setMenuSelection({ ...menuSelection, entry: entry.name });
                                                            }
                                                        }}
                                                        className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center relative overflow-hidden
                                                    ${menuSelection.entry === entry.name ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}
                                                    ${entry.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-700">{entry.name}</div>
                                                            <div className="text-xs text-blue-600 font-medium">S/ {Number(entry.individualPrice || 0).toFixed(2)}</div>
                                                            {(entry.stock !== undefined && entry.stock < 999) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Stock: {entry.stock}</div>
                                                            )}
                                                        </div>
                                                        {menuSelection.entry === entry.name && <CheckCircle className="text-blue-600" size={18} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* SEGUNDOS */}
                                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                                            <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                                <span className="bg-orange-100 text-orange-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                                Segundo
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {filteredMains.length === 0 && <div className="text-gray-400 italic text-sm p-2 col-span-2">No se encontraron opciones para este menú.</div>}
                                                {filteredMains.map((main, i) => (
                                                    <button
                                                        key={i}
                                                        disabled={main.stock <= 0}
                                                        onClick={() => {
                                                            if (menuSelection.main === main.name) {
                                                                setMenuSelection({ ...menuSelection, main: null }); // Toggle off
                                                            } else {
                                                                setMenuSelection({ ...menuSelection, main: main.name });
                                                            }
                                                        }}
                                                        className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center relative overflow-hidden
                                                    ${menuSelection.main === main.name ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}
                                                    ${main.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-700">{main.name}</div>
                                                            <div className="text-xs text-orange-600 font-medium">S/ {Number(main.individualPrice || 0).toFixed(2)}</div>
                                                            {(main.stock !== undefined && main.stock < 999) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Stock: {main.stock}</div>
                                                            )}
                                                        </div>
                                                        {menuSelection.main === main.name && <CheckCircle className="text-orange-600" size={18} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={cancelMenuSelection}
                                            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={confirmMenuSelection}
                                            disabled={!menuSelection.entry && !menuSelection.main}
                                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex flex-col items-center justify-center leading-tight"
                                        >
                                            {menuSelection.entry && menuSelection.main ? (
                                                <>
                                                    <span>Añadir Combo</span>
                                                    <span className="text-xs opacity-90">S/ {Number(pendingMenuProduct?.price || 0).toFixed(1)}</span>
                                                </>
                                            ) : menuSelection.entry ? (
                                                <>
                                                    <span>Solo Entrada</span>
                                                    <span className="text-xs opacity-90">S/ {Number(filteredEntries.find(e => e.name === menuSelection.entry)?.individualPrice || 0).toFixed(1)}</span>
                                                </>
                                            ) : menuSelection.main ? (
                                                <>
                                                    <span>Solo Segundo</span>
                                                    <span className="text-xs opacity-90">S/ {Number(filteredMains.find(m => m.name === menuSelection.main)?.individualPrice || 0).toFixed(1)}</span>
                                                </>
                                            ) : (
                                                <span>Seleccionar</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* GLOBAL COMBO BAR — Persistent summary and action buttons for 2x1 section */}
                        {(viewMode === 'combo_categories' || viewMode === 'combo_picker' || (selectedCategory === 'combo' && searchTerm)) && comboSelection.length > 0 && (() => {
                            // Persistent logic for calculation
                            let displayPrice = 0;
                            let priceLabel = '';
                            if (comboSelection.length === 1) {
                                displayPrice = parseFloat(comboSelection[0].individualPrice) || 0;
                                priceLabel = 'Precio individual';
                            } else if (comboSelection.length === 2) {
                                displayPrice = Math.max(...comboSelection.map(s => s._promoPrice || 0));
                                priceLabel = 'Combo 2x1 (precio mayor)';
                            }

                            const handleAdd = () => {
                                if (comboSelection.length === 0) return;
                                const name = comboSelection.length === 2
                                    ? `${comboSelection[0].name} + ${comboSelection[1].name}`
                                    : comboSelection[0].name;
                                const subItems = comboSelection
                                    .filter(s => s.type !== 'free' && s.linkedProductId)
                                    .map(s => ({ productId: s.linkedProductId, quantity: 1, name: s.name }));
                                const isActualCombo = comboSelection.length === 2;
                                setCart(prev => [...prev, {
                                    productId: null,
                                    name: isActualCombo ? `2x1: ${name}` : comboSelection[0].name,
                                    price: displayPrice,
                                    quantity: 1,
                                    notes: isActualCombo ? name : '',
                                    isCombo: isActualCombo,
                                    subItems
                                }]);
                                setComboSelection([]);
                                setViewMode('combo_categories');
                                setPendingComboPromo(null);
                                setSearchTerm(''); // Clear search on success
                            };

                            return (
                                <div className="border-t border-purple-100 pt-3 mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white z-20">
                                    <div className="flex flex-row items-center justify-between sm:justify-start gap-3 sm:gap-6 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full ring-1 ring-purple-100 shrink-0">
                                                {comboSelection.length}/2
                                            </span>
                                            <span className="text-xs text-gray-700 truncate font-semibold max-w-[120px] sm:max-w-xs">
                                                {comboSelection.map(s => s.name).join(' + ')}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1.5 shrink-0">
                                            <span className="text-purple-700 font-black text-lg sm:text-2xl tracking-tight">
                                                S/ {Number(displayPrice.toFixed(1))}
                                            </span>
                                            <span className="text-[8px] text-gray-400 uppercase font-bold tracking-wider leading-none">{priceLabel}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setComboSelection([])}
                                            className="px-3 py-2 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors border text-center"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={handleAdd}
                                            className={`px-4 py-2 rounded-xl font-black text-xs transition-all shadow active:scale-95 flex items-center justify-center gap-1.5 
                                            ${comboSelection.length === 2
                                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                                                    : 'bg-white border-2 border-purple-600 text-purple-700 hover:bg-purple-50 shadow-sm'}`}
                                        >
                                            {comboSelection.length === 2 ? (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Agregar Combo
                                                </>
                                            ) : (
                                                'Llevar 1 Individual'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* MOBILE FLOATING FOOTER (Only if not showing cart) */}
                    {!showMobileCart && (
                        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50/95 via-gray-50/70 to-transparent pointer-events-none flex flex-col gap-2">
                            <button
                                onClick={handleClose}
                                className="w-full py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center justify-center gap-1.5 pointer-events-auto transition-transform active:scale-95 text-sm"
                            >
                                <X size={16} />
                                <span>Ir al salón</span>
                            </button>
                            <button
                                onClick={() => setShowMobileCart(true)}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex justify-between px-6 pointer-events-auto transition-transform active:scale-95 ${cart.length > 0 ? 'bg-blue-600' : 'bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={20} />
                                    <span>{cart.length > 0 ? 'Ver Carrito' : 'Ver Cuenta'}</span>
                                </div>
                                <span>S/ {Number((account?.accountType === 'staff' ? 0 : (cartTotal + (totalPaid > 0 ? remaining : accountTotal))).toFixed(1))}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: Desktop Cart Panel (Always visible on desktop, hidden on mobile) */}
                <div className="hidden md:flex w-[380px] bg-white border-l flex-col shadow-xl z-20">
                    <div className="p-5 border-b bg-gray-50">
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
                        {/* Show Client Edit only if Account Exists OR allow pre-fill? 
                        Acc doesn't exist yet, so we can't update it via API.
                        For simplicity: Only allow editing client AFTER account creation (first order).
                        OR: We could store clientForm in state and send it with open.
                        For now: Only show if account exists. */}
                        {account ? (
                            isEditingClient ? (
                                <div className="mt-3 bg-white p-3 rounded border shadow-sm space-y-2">
                                    <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            id="staff_toggle_edit"
                                            checked={clientForm.accountType === 'staff'}
                                            onChange={async (e) => {
                                                if (e.target.checked) {
                                                    setShowStaffConfirm(true); // Open custom modal
                                                } else {
                                                    const newClientForm = { ...clientForm, accountType: 'standard', name: 'Cliente', dni: '' };
                                                    setClientForm(newClientForm);
                                                    if (account) {
                                                        try {
                                                            const res = await axios.put(`/api/accounts/${account.id}`, {
                                                                customerName: newClientForm.name,
                                                                clientDni: newClientForm.dni,
                                                                clientAddress: newClientForm.direccion,
                                                                accountType: newClientForm.accountType
                                                            });
                                                            setAccount(res.data);
                                                            setIsEditingClient(false);
                                                        } catch (err) {
                                                            console.error("Error setting account to standard:", err);
                                                            alert('Error al actualizar la cuenta a consumo estándar');
                                                        }
                                                    }
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="staff_toggle_edit" className="text-xs font-bold text-gray-700 cursor-pointer">Consumo de Trabajador</label>
                                    </div>
                                    {clientForm.accountType === 'staff' ? (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-bold text-gray-600">Comentario / Nota de Consumo</label>
                                            <input 
                                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                                value={clientForm.direccion || ''} 
                                                onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                                placeholder="Escriba un comentario (ej: Juan Pérez)" 
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-2">
                                                <input 
                                                    className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                                    value={clientForm.dni} 
                                                    onChange={e => setClientForm({ ...clientForm, dni: e.target.value })} 
                                                    placeholder="DNI / RUC" 
                                                    onKeyDown={(e) => { if(e.key === 'Enter') searchClientData() }}
                                                />
                                                <button 
                                                    onClick={searchClientData} 
                                                    disabled={isSearchingClient} 
                                                    className="bg-gray-100 p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center min-w-[36px]"
                                                    title="Buscar datos"
                                                >
                                                    {isSearchingClient ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Search size={16} />}
                                                </button>
                                            </div>
                                            <input 
                                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                                value={clientForm.name} 
                                                onChange={e => setClientForm({ ...clientForm, name: e.target.value })} 
                                                placeholder="Nombre / Razón Social" 
                                            />
                                            {clientForm.dni && clientForm.dni.trim().length === 11 && (
                                                <input 
                                                    className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 mt-1" 
                                                    value={clientForm.direccion || ''} 
                                                    onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                                    placeholder="Dirección Fiscal" 
                                                />
                                            )}
                                        </>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditingClient(false)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-sm">Cancelar</button>
                                        <button onClick={updateClientInfo} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm">Guardar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col mt-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-800 font-medium">{account.customerName}</span>
                                                {account.accountType === 'staff' && (
                                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Staff</span>
                                                )}
                                            </div>
                                            {account.clientDni && (
                                                <span className="text-xs text-gray-500 font-semibold mt-0.5">DNI/RUC: {account.clientDni}</span>
                                            )}
                                            {account.accountType === 'staff' && account.clientAddress && (
                                                <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded px-2 py-1 mt-1 font-medium italic">
                                                    Nota: {account.clientAddress}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => setIsEditingClient(true)} className="text-xs text-blue-600 font-semibold px-2 py-1 rounded hover:bg-blue-50">Editar Cliente</button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="mt-3 space-y-3">
                                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-100">
                                    <input
                                        type="checkbox"
                                        id="staff_toggle_new"
                                        checked={clientForm.accountType === 'staff'}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setShowStaffConfirm(true); // Open custom modal
                                            } else {
                                                setClientForm({ ...clientForm, accountType: 'standard' });
                                            }
                                        }}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="staff_toggle_new" className="text-xs font-bold text-orange-800 cursor-pointer">Consumo de Trabajador</label>
                                </div>
                                {clientForm.accountType === 'staff' && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-gray-600">Comentario / Nota de Consumo</label>
                                        <input 
                                            className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                            value={clientForm.direccion || ''} 
                                            onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })} 
                                            placeholder="Escriba un comentario..." 
                                        />
                                    </div>
                                )}
                                <div className="text-sm text-gray-500 italic">
                                    Agrega productos para abrir la mesa.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {groupedOrders.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase">Pedidos Enviados</h3>
                                {groupedOrders.map(o => {
                                    // Robust Product Name Lookup
                                    let pName = "Producto desconocido";
                                    let displayNotes = o.notes;

                                    let originalP = null;

                                    // Combo orders have no ProductId — use notes as name
                                    if (!o.ProductId && o.notes) {
                                        pName = `2x1: ${o.notes}`;
                                        displayNotes = null; // avoid repeating under name
                                    } else if (o.Product && o.Product.name) {
                                        pName = o.Product.name;
                                    }

                                    if (products.length > 0 && o.ProductId) {
                                        // Fallback: Find in local products list
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

                                    const isStaff = account?.accountType === 'staff';

                                    return (
                                        <div key={o.key} className="flex justify-between items-center text-sm py-2 border-b border-dashed">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-700">
                                                    {o.quantity}x {pName}
                                                    <span className="text-blue-600 ml-1">
                                                        {isStaff ? (
                                                            o.quantity > 1 ? (
                                                                <span className="text-orange-600">({o.quantity}x <span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> = <span className="line-through text-gray-400">S/ {Number((o.quantity * parseFloat(originalP || 0)).toFixed(1))}</span> a costo S/ 0)</span>
                                                            ) : (
                                                                <span className="text-orange-600">(<span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> a costo S/ 0)</span>
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
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {/* Status Badges Removed for Simplicity */}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {['admin', 'waiter', 'cashier'].includes(user.role) && (
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
                                })}
                            </div>
                        )}

                        {cart.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-blue-600 uppercase">Nuevo Pedido</h3>
                                {cart.map((item, idx) => (
                                    <div key={idx} className="bg-blue-50 p-3 rounded-lg flex justify-between items-center relative group">
                                        <div>
                                            <div className="font-bold text-sm">{item.name}</div>
                                            <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                                {item.originalPrice !== undefined && item.originalPrice !== item.price && (
                                                    <span className="line-through text-gray-400">S/ {Number((item.originalPrice * item.quantity).toFixed(1))}</span>
                                                )}
                                                <span className={item.price === 0 ? "text-orange-600 font-bold" : ""}>
                                                    S/ {Number((item.price * item.quantity).toFixed(1))}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white rounded px-1 border">
                                            <button onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))} className="px-2 font-bold">-</button>
                                            <span className="text-sm font-bold">{item.quantity}</span>
                                            <button onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p))} className="px-2 font-bold">+</button>
                                        </div>
                                        <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-gray-50">
                        {account?.accountType !== 'staff' && totalPaid > 0 && (
                            <div className="space-y-1 text-sm border-b pb-2 mb-2 text-gray-500">
                                <div className="flex justify-between">
                                    <span>Total consumido:</span>
                                    <span className="font-semibold">S/ {accountTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                    <span>Abonado:</span>
                                    <span className="font-semibold">- S/ {totalPaid.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold text-gray-800 mb-4 items-center">
                            <span>{totalPaid > 0 ? 'Saldo Pendiente' : 'Total'}</span>
                            <div className="flex flex-col items-end">
                                {account?.accountType === 'staff' && (
                                    <span className="text-[10px] text-orange-600 uppercase font-bold bg-orange-50 px-2 py-0.5 rounded -mb-1">Consumo Personal</span>
                                )}
                                <span>S/ {Number((account?.accountType === 'staff' ? 0 : (cartTotal + (totalPaid > 0 ? remaining : accountTotal))).toFixed(1))}</span>
                            </div>
                        </div>
                        {cart.length > 0 ? (
                            <button onClick={sendOrder} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700">Enviar Pedido</button>
                        ) : (
                            (!account || (account.Orders && account.Orders.length === 0)) ? (
                                <button onClick={handleCloseClick} className="w-full border-2 border-gray-400 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100">Liberar Mesa</button>
                            ) : (
                                <button onClick={handleCloseClick} className="w-full border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50">Pagar</button>
                            )
                        )}
                    </div>
                </div>
            </div >

            {/* Custom Confirmation Modal for Staff Consumption */}
            {showStaffConfirm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-orange-50 p-6 flex flex-col items-center border-b border-orange-100">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-orange-500 shadow-sm mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-800 text-center">Consumo de Personal</h3>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-gray-600 mb-6 font-medium">
                                ¿Estás seguro que deseas marcar esta mesa como Consumo Interno?
                                <br /><br />
                                <span className="bg-orange-100 px-2 py-1 rounded text-orange-800 text-sm font-bold">Todos los precios cambiarán a S/ 0.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowStaffConfirm(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        const newClientForm = { ...clientForm, accountType: 'staff', name: 'Personal', dni: '' };
                                        setClientForm(newClientForm);
                                        if (account) {
                                            try {
                                                const res = await axios.put(`/api/accounts/${account.id}`, {
                                                    customerName: newClientForm.name,
                                                    clientDni: newClientForm.dni,
                                                    clientAddress: newClientForm.direccion,
                                                    accountType: newClientForm.accountType
                                                });
                                                setAccount(res.data);
                                                setIsEditingClient(false);
                                            } catch (err) {
                                                console.error("Error setting account to staff:", err);
                                                alert('Error al actualizar la cuenta a consumo de trabajador');
                                            }
                                        }
                                        setShowStaffConfirm(false);
                                    }}
                                    className="flex-1 px-4 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {
                showPaymentModal && (
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
                                                            } else {
                                                                handlePrintLocalInvoice(successInvoice.invoice);
                                                            }
                                                        }}
                                                        className="flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200"
                                                    >
                                                        <Printer size={16} />
                                                        Ver PDF
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintLocalInvoice(successInvoice.invoice)}
                                                        className="flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm bg-slate-800 border-slate-800 text-white hover:bg-slate-900 hover:shadow-slate-200"
                                                    >
                                                        <Printer size={16} />
                                                        Imprimir
                                                    </button>
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
                                                    onChange={(e) => setPayAmount(e.target.value)}
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
                                                    onChange={handleFileChange}
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
                                                    onChange={handleFileChange}
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
                                                    onChange={handleFileChange}
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
                                {billingConfig?.facturacionElectronica && (
                                    <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
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
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(() => {
                                    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
                                    const remaining = account ? Math.max(0, parseFloat(account.total) - totalPaid) : 0;
                                    const enteredVal = parseFloat(payAmount) || 0;
                                    const isAmountInvalid = isNaN(enteredVal) || enteredVal <= 0 || (account && enteredVal > (remaining + 0.01));
                                    const isEvidenceMandatory = ['tarjeta', 'yape', 'transferencia'].includes(paymentMethod);
                                    const isPayDisabled = isProcessingPayment || (isEvidenceMandatory && evidenceFiles.length === 0) || isAmountInvalid;
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
            }
        </div >,
        document.body
    );
}

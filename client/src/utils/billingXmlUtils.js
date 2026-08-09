/**
 * billingXmlUtils.js
 * Utilidades para generación de XML UBL 2.1 compatible con SUNAT (Perú).
 * Extraído de TableControl.jsx para reducir su tamaño sin alterar la lógica.
 */

/**
 * Genera el string XML UBL 2.1 para un comprobante electrónico.
 * @param {object} invoice - El objeto invoice del backend.
 * @param {object|null} billingConfig - Configuración de facturación (RUC, razón social, etc).
 * @returns {string} XML string completo.
 */
export function generateUblXml(invoice, billingConfig) {
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

    return `<?xml version="1.0" encoding="UTF-8"?>
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
}

/**
 * Descarga el XML UBL como archivo .xml en el navegador del usuario.
 * @param {object} invoice - El objeto invoice del backend.
 * @param {object|null} billingConfig - Configuración de facturación.
 */
export function downloadUblXml(invoice, billingConfig) {
    if (!invoice) return;
    const rucEmpresa = billingConfig?.ruc || '20614409593';
    const docType = invoice.tipo === 'factura' ? '01' : '03';
    const xmlContent = generateUblXml(invoice, billingConfig);

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rucEmpresa}-${docType}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

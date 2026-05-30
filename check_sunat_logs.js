const { Invoice, BillingConfig } = require('./server/models');

async function run() {
    const args = process.argv.slice(2);
    const invoiceQuery = args[0]; // e.g. "F001-000002" or just "2"

    console.log('=== CONFIGURACIÓN DE FACTURACIÓN ===');
    const config = await BillingConfig.findOne();
    if (config) {
        console.log(`RUC Emisor: ${config.ruc}`);
        console.log(`Razón Social: ${config.razonSocial}`);
        console.log(`Dirección: ${config.direccion}`);
        console.log(`Facturación Electrónica: ${config.facturacionElectronica ? 'SÍ (Producción/Pruebas)' : 'NO (Solo Local)'}`);
        console.log(`API Token: ${config.apiToken ? 'Configurado' : 'No configurado'}`);
    } else {
        console.log('No se encontró configuración de facturación.');
    }
    console.log('\n====================================\n');

    if (invoiceQuery) {
        let where = {};
        if (invoiceQuery.includes('-')) {
            const [serie, corrStr] = invoiceQuery.split('-');
            where = { 
                serie: serie.toUpperCase(), 
                correlativo: parseInt(corrStr, 10) 
            };
        } else if (!isNaN(invoiceQuery)) {
            where = { correlativo: parseInt(invoiceQuery, 10) };
        } else {
            console.error('Formato de comprobante no válido. Use: F001-000002 o F001-2');
            process.exit(1);
        }

        const invoice = await Invoice.findOne({ where });
        if (!invoice) {
            console.log(`No se encontró el comprobante: ${invoiceQuery}`);
            return;
        }

        printInvoiceDetails(invoice);
    } else {
        // List last 10 invoices
        console.log('Últimos 10 comprobantes emitidos:');
        const invoices = await Invoice.findAll({
            order: [['emitidoAt', 'DESC']],
            limit: 10
        });

        if (invoices.length === 0) {
            console.log('No se encontraron comprobantes.');
            return;
        }

        invoices.forEach(inv => {
            const sunatStatus = inv.sunatResponse ? '✓ ENVIADO' : '✗ SOLO LOCAL';
            console.log(`[${inv.id}] ${inv.tipo.toUpperCase()} ${inv.serie}-${String(inv.correlativo).padStart(6, '0')} - Total: S/ ${inv.total} | Cliente: ${inv.clienteDocumento} | Estado: ${sunatStatus}`);
        });

        console.log('\nPara ver los detalles de un comprobante específico y la respuesta del Hub, ejecute:');
        console.log('node check_sunat_logs.js [SERIE]-[CORRELATIVO]   (Ejemplo: node check_sunat_logs.js F001-2)');
    }
}

function printInvoiceDetails(invoice) {
    console.log(`DETALLES DEL COMPROBANTE ${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}:`);
    console.log(`ID: ${invoice.id}`);
    console.log(`Tipo: ${invoice.tipo}`);
    console.log(`Cliente Doc: ${invoice.clienteDocumento}`);
    console.log(`Cliente Nombre: ${invoice.clienteNombre}`);
    console.log(`Total: S/ ${invoice.total}`);
    console.log(`Fecha Emisión: ${invoice.emitidoAt}`);
    
    console.log('\n--- RESPUESTA DE SUNAT HUB ---');
    if (!invoice.sunatResponse) {
        console.log('NINGUNA (No se envió a SUNAT Hub porque la facturación electrónica estaba desactivada en ese momento o no se configuró el token).');
    } else {
        try {
            const response = JSON.parse(invoice.sunatResponse);
            console.log(JSON.stringify(response, null, 2));
        } catch (e) {
            console.log('Respuesta cruda (No JSON):', invoice.sunatResponse);
        }
    }
}

run().catch(console.error);

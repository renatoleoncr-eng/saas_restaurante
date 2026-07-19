import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';

export default function PublicReceipt() {
    const { hash } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [config, setConfig] = useState(null);
    const [qrUrl, setQrUrl] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReceipt = async () => {
            try {
                const res = await axios.get(`/api/public/comprobante/${hash}`);
                if (res.data && res.data.invoice) {
                    setInvoice(res.data.invoice);
                    setConfig(res.data.config);

                    const rucEmpresa = res.data.config?.ruc || '';
                    const inv = res.data.invoice;

                    let finalQrUrl = '';
                    const sunatRes = inv.sunatResponse
                        ? (typeof inv.sunatResponse === 'string' ? JSON.parse(inv.sunatResponse) : inv.sunatResponse)
                        : null;

                    if (sunatRes && (sunatRes.qr || sunatRes.url_qr)) {
                        finalQrUrl = sunatRes.qr || sunatRes.url_qr;
                    } else {
                        const igvText = parseFloat(inv.igv).toFixed(2);
                        const totalText = parseFloat(inv.total).toFixed(2);
                        const docCliente = inv.clienteDocumento || '-';
                        const docType = inv.tipo === 'factura' ? '01' : '03';
                        const clientType = inv.tipo === 'factura' ? '6' : (docCliente.length === 8 ? '1' : '-');
                        const emitDate = new Date(inv.emitidoAt).toISOString().split('T')[0];
                        const qrContent = `${rucEmpresa}|${docType}|${inv.serie}|${String(inv.correlativo).padStart(6, '0')}|${igvText}|${totalText}|${emitDate}|${clientType}|${docCliente}|`;
                        finalQrUrl = await QRCode.toDataURL(qrContent);
                    }
                    setQrUrl(finalQrUrl);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Error al cargar el comprobante');
            } finally {
                setLoading(false);
            }
        };
        fetchReceipt();
    }, [hash]);

    if (loading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e2e8f0' }}>Cargando comprobante...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e2e8f0', color: '#dc2626', fontWeight: 'bold' }}>{error}</div>;
    }

    if (!invoice) return null;

    const rucEmpresa = config?.ruc || 'RUC NO CONFIGURADO';
    const nameEmpresa = config?.razonSocial || 'EMPRESA NO CONFIGURADA';
    const addressEmpresa = config?.direccion || '';

    let itemsParsed = [];
    try {
        itemsParsed = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
    } catch (e) {
        itemsParsed = [];
    }

    const isAnulado = invoice.status === 'anulado';

    // Only show DIRECCIÓN if it looks like a real address (not '-', empty, or an internal note)
    const direccion = (invoice.clienteDireccion || '').trim();
    const showDireccion = direccion !== '' && direccion !== '-';

    // Get SUNAT PDF URL if available
    let sunatPdfUrl = null;
    try {
        if (invoice.sunatResponse) {
            const parsed = typeof invoice.sunatResponse === 'string' ? JSON.parse(invoice.sunatResponse) : invoice.sunatResponse;
            sunatPdfUrl = parsed.url_ticket || parsed.url || parsed.pdf_url || parsed.links?.pdf || parsed.pdf || null;
            if (sunatPdfUrl && typeof sunatPdfUrl === 'string') {
                if (sunatPdfUrl.includes('72.61.57.199') || sunatPdfUrl.includes('maksuites') || sunatPdfUrl.includes('bluzcx')) {
                    sunatPdfUrl = sunatPdfUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                }
            }
        }
    } catch (e) { /* ignore */ }

    const downloadLocalPdf = async () => {
        const element = document.getElementById('ticket-container');
        if (!element) return;
        const filename = `${invoice.tipo === 'factura' ? 'Factura' : 'Boleta'}_${invoice.serie}-${invoice.correlativo}.pdf`;
        const opt = {
            margin: 1,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: [76, 200], orientation: 'portrait' }
        };
        try {
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Comprobante de Pago', text: 'Le adjuntamos su comprobante de pago.' });
            } else {
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Error al generar PDF:', err);
        }
    };

    // Single action: if SUNAT PDF exists, open it; otherwise generate local
    const handlePdf = sunatPdfUrl
        ? () => window.open(sunatPdfUrl, '_blank')
        : downloadLocalPdf;

    const mono = "'Courier New', Courier, monospace";

    return (
        <div style={{
            height: '100vh',
            backgroundColor: '#e2e8f0',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingTop: '24px',
            paddingBottom: '48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            {/* Single PDF button */}
            <div style={{ width: '100%', maxWidth: '320px', padding: '0 16px', marginBottom: '16px' }}>
                <button
                    onClick={handlePdf}
                    style={{
                        width: '100%',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        fontWeight: 'bold',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '15px',
                        letterSpacing: '0.02em'
                    }}
                >
                    📄 Descargar PDF
                </button>
            </div>

            {/* Ticket */}
            <div
                id="ticket-container"
                style={{
                    width: '72mm',
                    maxWidth: '92vw',
                    backgroundColor: 'white',
                    color: 'black',
                    padding: '5mm 3mm',
                    fontFamily: mono,
                    fontSize: '11px',
                    lineHeight: '1.4',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.12)'
                }}
            >
                {/* Header empresa */}
                <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{nameEmpresa}</div>
                    <div>RUC: {rucEmpresa}</div>
                    <div style={{ textTransform: 'uppercase' }}>{addressEmpresa}</div>
                </div>

                {/* Tipo documento */}
                <div style={{ textAlign: 'center', borderTop: '1px dashed #9ca3af', borderBottom: '1px dashed #9ca3af', padding: '2mm 0', marginBottom: '4mm' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA'}
                    </div>
                    <div>{invoice.serie}-{String(invoice.correlativo).padStart(6, '0')}</div>
                </div>

                {/* Datos cliente */}
                <div style={{ marginBottom: '4mm' }}>
                    <div><b>FECHA EMISIÓN:</b> {new Date(invoice.emitidoAt).toLocaleString('es-PE')}</div>
                    <div><b>SEÑOR(ES):</b> {invoice.clienteNombre?.toUpperCase() || '-'}</div>
                    <div><b>DNI/RUC:</b> {invoice.clienteDocumento || '-'}</div>
                    {showDireccion && invoice.tipo === 'factura' && <div><b>DIRECCIÓN:</b> {direccion.toUpperCase()}</div>}
                    <div><b>MÉTODO PAGO:</b> EFECTIVO</div>
                    {invoice.observaciones && (
                        <div style={{ marginTop: '2mm', fontStyle: 'italic' }}><b>OBS:</b> {invoice.observaciones}</div>
                    )}
                </div>

                {/* Items */}
                <div style={{ borderTop: '1px dashed #9ca3af', paddingTop: '2mm', marginBottom: '2mm' }}>
                    <table style={{ width: '100%', textAlign: 'left', fontSize: '11px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ fontWeight: 'normal', width: '28px' }}>CANT</th>
                                <th style={{ fontWeight: 'normal' }}>DESCRIPCIÓN</th>
                                <th style={{ fontWeight: 'normal', textAlign: 'right' }}>P.UNIT</th>
                                <th style={{ fontWeight: 'normal', textAlign: 'right' }}>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsParsed.map((it, idx) => {
                                const q = parseFloat(it.qty || it.cantidad || it.quantity || 1);
                                const t = parseFloat(it.amount || it.subtotal || it.total || 0);
                                const desc = it.description || it.descripcion || it.name || '-';

                                // Discount item: red italic row, no qty/unit columns
                                if (t < 0) {
                                    return (
                                        <tr key={idx}>
                                            <td colSpan={2} style={{ color: '#b91c1c', fontStyle: 'italic', paddingTop: '3px' }}>{desc}</td>
                                            <td colSpan={2} style={{ color: '#b91c1c', fontWeight: 'bold', textAlign: 'right', paddingTop: '3px', whiteSpace: 'nowrap' }}>
                                                -S/ {Math.abs(t).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                }

                                const pu = it.precioUnitario
                                    ? parseFloat(it.precioUnitario)
                                    : (it.price ? parseFloat(it.price) : (q > 0 ? t / q : t));
                                return (
                                    <tr key={idx}>
                                        <td style={{ verticalAlign: 'top' }}>{q}</td>
                                        <td style={{ verticalAlign: 'top', paddingRight: '2px' }}>{desc}</td>
                                        <td style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>S/ {pu.toFixed(2)}</td>
                                        <td style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>S/ {t.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totales */}
                <div style={{ borderTop: '1px dashed #9ca3af', paddingTop: '2mm', marginBottom: '4mm', textAlign: 'right' }}>
                    {invoice.tipo === 'factura' && (
                        <>
                            <div>OP. GRAVADA: S/ {parseFloat(invoice.subtotal).toFixed(2)}</div>
                            <div>OP. INAFECTA: S/ 0.00</div>
                            <div>I.G.V. ({config?.igvTasa || 18}%): S/ {parseFloat(invoice.igv).toFixed(2)}</div>
                        </>
                    )}
                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '2px' }}>
                        TOTAL A PAGAR: S/ {parseFloat(invoice.total).toFixed(2)}
                    </div>
                </div>

                {/* Estado */}
                {isAnulado ? (
                    <div style={{ textAlign: 'center', margin: '4mm 0' }}>
                        <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 'bold', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', textTransform: 'uppercase' }}>
                            [X] COMPROBANTE ANULADO
                        </span>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', margin: '4mm 0' }}>
                        <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 'bold', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', textTransform: 'uppercase' }}>
                            [✓] ACEPTADA POR SUNAT
                        </span>
                    </div>
                )}

                {/* QR */}
                {qrUrl && (
                    <div style={{ textAlign: 'center', margin: '4mm 0', display: 'flex', justifyContent: 'center' }}>
                        <img src={qrUrl} style={{ width: '120px', height: '120px' }} alt="Código QR SUNAT" />
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '10px' }}>
                    <b>REPRESENTACIÓN IMPRESA DE COMPROBANTE DE PAGO</b><br />
                    <span>Autorizado mediante Resolución de SUNAT</span><br /><br />
                    <b>¡Gracias por su preferencia!</b>
                </div>
            </div>
        </div>
    );
}

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

                    // Generate QR
                    const rucEmpresa = res.data.config?.ruc || '';
                    const inv = res.data.invoice;
                    
                    let finalQrUrl = '';
                    const sunatRes = inv.sunatResponse ? (typeof inv.sunatResponse === 'string' ? JSON.parse(inv.sunatResponse) : inv.sunatResponse) : null;
                    
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
        return <div className="flex items-center justify-center min-h-screen bg-slate-200">Cargando comprobante...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-200 text-red-600 font-bold">{error}</div>;
    }

    if (!invoice) return null;

    const rucEmpresa = config?.ruc || 'RUC NO CONFIGURADO';
    const nameEmpresa = config?.razonSocial || 'EMPRESA NO CONFIGURADA';
    const addressEmpresa = config?.direccion || '';

    // Handle JSON items safely
    let itemsParsed = [];
    try {
        if (typeof invoice.items === 'string') {
            itemsParsed = JSON.parse(invoice.items);
        } else if (Array.isArray(invoice.items)) {
            itemsParsed = invoice.items;
        }
    } catch (e) {
        itemsParsed = [];
    }

    const isAnulado = invoice.status === 'anulado';
    
    // Attempt to get PDF URL from SUNAT response
    let pdfUrl = null;
    try {
        if (invoice.sunatResponse) {
            const parsed = typeof invoice.sunatResponse === 'string' ? JSON.parse(invoice.sunatResponse) : invoice.sunatResponse;
            pdfUrl = parsed.url_ticket || parsed.url || parsed.pdf_url || parsed.links?.pdf || parsed.pdf || null;
        }
    } catch (e) {
        // ignore
    }

    const downloadLocalPdf = async () => {
        const element = document.getElementById('ticket-container');
        if (!element) return;
        
        const filename = `${invoice.tipo === 'factura' ? 'Factura' : 'Boleta'}_${invoice.serie}-${invoice.correlativo}.pdf`;
        const opt = {
            margin:       1,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: [76, 200], orientation: 'portrait' }
        };
        
        try {
            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Comprobante de Pago',
                    text: 'Le adjuntamos su comprobante de pago.'
                });
            } else {
                // Fallback a descarga normal si no soporta compartir archivos
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

    return (
        <div className="min-h-screen bg-slate-200 py-10 flex flex-col items-center">
            
            <div className="mb-4 flex flex-col gap-2 w-full max-w-xs px-4">
                <button 
                    onClick={downloadLocalPdf}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow text-center w-full"
                >
                    Descargar Ticket (PDF)
                </button>
                {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow text-center w-full">
                        Descargar PDF SUNAT
                    </a>
                )}
            </div>

            <div 
                id="ticket-container"
                className="bg-white text-black"
                style={{
                    width: '72mm',
                    padding: '5mm 2mm',
                    fontFamily: "'Courier New', Courier, monospace, sans-serif",
                    fontSize: '11px',
                    lineHeight: '1.3',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
                }}
            >
                <div className="text-center mb-4">
                    <div className="font-bold text-[13px]">{nameEmpresa}</div>
                    <div>RUC: {rucEmpresa}</div>
                    <div className="uppercase">{addressEmpresa}</div>
                </div>

                <div className="text-center border-y border-dashed border-gray-400 py-1 mb-4">
                    <div className="font-bold uppercase">
                        {invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA'}
                    </div>
                    <div>{invoice.serie}-{String(invoice.correlativo).padStart(6, '0')}</div>
                </div>

                <div className="mb-4">
                    <div><b>FECHA EMISIÓN:</b> {new Date(invoice.emitidoAt).toLocaleString('es-PE')}</div>
                    <div><b>SEÑOR(ES):</b> {invoice.clienteNombre?.toUpperCase() || '-'}</div>
                    <div><b>DNI/RUC:</b> {invoice.clienteDocumento || '-'}</div>
                    {invoice.clienteDireccion && (
                        <div><b>DIRECCIÓN:</b> {invoice.clienteDireccion.toUpperCase()}</div>
                    )}
                    <div><b>MÉTODO PAGO:</b> EFECTIVO</div>
                </div>

                <div className="border-t border-dashed border-gray-400 pt-1 mb-2">
                    <table className="w-full text-left" style={{ fontSize: '11px' }}>
                        <thead>
                            <tr>
                                <th className="font-normal w-8">CANT</th>
                                <th className="font-normal">DESCRIPCIÓN</th>
                                <th className="font-normal text-right">P.UNIT</th>
                                <th className="font-normal text-right">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsParsed.map((it, idx) => {
                                const q = parseFloat(it.qty || it.cantidad || it.quantity || 1);
                                const t = parseFloat(it.amount || it.subtotal || it.total || 0);
                                const pu = it.precioUnitario ? parseFloat(it.precioUnitario) : (it.price ? parseFloat(it.price) : t / q);
                                const desc = it.description || it.descripcion || it.name || '-';
                                return (
                                    <tr key={idx}>
                                        <td className="align-top">{q}</td>
                                        <td className="align-top pr-1">{desc}</td>
                                        <td className="align-top text-right w-12">S/ {pu.toFixed(2)}</td>
                                        <td className="align-top text-right w-12">S/ {t.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 mb-4 text-right">
                    {invoice.tipo === 'factura' && (
                        <>
                            <div>OP. GRAVADA: S/ {parseFloat(invoice.subtotal).toFixed(2)}</div>
                            <div>OP. INAFECTA: S/ 0.00</div>
                            <div>I.G.V. (18%): S/ {parseFloat(invoice.igv).toFixed(2)}</div>
                        </>
                    )}
                    <div className="font-bold text-[12px] mt-1">TOTAL A PAGAR: S/ {parseFloat(invoice.total).toFixed(2)}</div>
                </div>

                {isAnulado ? (
                    <div className="text-center my-4">
                        <span className="bg-red-100 text-red-700 font-bold border border-red-300 px-2 py-1 rounded text-[10px] uppercase">
                            [X] COMPROBANTE ANULADO
                        </span>
                    </div>
                ) : (
                    <div className="text-center my-4">
                        <span className="bg-green-50 text-green-700 font-bold border border-green-200 px-2 py-1 rounded text-[10px] uppercase">
                            [✓] ACEPTADA POR SUNAT
                        </span>
                    </div>
                )}

                {qrUrl && (
                    <div className="text-center my-4 flex justify-center">
                        <img src={qrUrl} style={{ width: '120px', height: '120px' }} alt="Código QR SUNAT" />
                    </div>
                )}

                <div className="text-center mt-4">
                    <b>REPRESENTACIÓN IMPRESA DE COMPROBANTE DE PAGO</b><br />
                    <span>Autorizado mediante Resolución de SUNAT</span><br /><br />
                    <b>¡Gracias por su preferencia!</b>
                </div>

            </div>
        </div>
    );
}

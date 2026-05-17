import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, Settings, FileText, Plus, Search, Trash2, 
    CheckCircle, AlertCircle, Printer, Download,
    CreditCard, Building2, ShieldCheck, Zap, Loader
} from 'lucide-react';
import axios from 'axios';

const BillingConfigModal = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('history');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        ruc: '',
        razonSocial: '',
        facturacionElectronica: false,
        igvTasa: 10.5,
        operacionesExoneradas: false,
        serieFactura: 'F001',
        serieBoleta: 'B001',
        apiToken: ''
    });

    // New Invoice State
    const [newInvoice, setNewInvoice] = useState({
        tipo: 'boleta',      // 'boleta' = doc '03', 'factura' = doc '01'
        clienteDocumento: '',
        clienteNombre: '',
        clienteDireccion: '',
        items: [{ description: '', amount: '', quantity: 1 }]
    });

    const [invoices, setInvoices] = useState([]);
    const [filters, setFilters] = useState({ documento: '', desde: '', hasta: '' });

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
        const pdf = parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || null;
        const xml = parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null;
        return { pdf, xml };
    };

    useEffect(() => {
        fetchConfig();
        fetchInvoices();
    }, []);

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
                    items: [{ description: '', amount: '', quantity: 1 }]
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Facturación Electrónica</h2>
                            <p className="text-sm text-gray-500">Gestión de comprobantes y configuración SUNAT</p>
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
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'config' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Settings size={18} /> Configuración
                    </button>
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

                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold border-b uppercase text-[11px]">
                                        <tr>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Documento</th>
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-4 py-3">Total</th>
                                            <th className="px-4 py-3">Estado</th>
                                            <th className="px-4 py-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {invoices.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-4 py-8 text-center text-gray-400">No hay comprobantes emitidos</td>
                                            </tr>
                                        ) : invoices.map(inv => {
                                            const { pdf, xml } = getSunatUrls(inv.sunatResponse);
                                            return (
                                                <tr key={inv.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(inv.emitidoAt).toLocaleString()}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-blue-600 uppercase">{inv.serie}-{String(inv.correlativo).padStart(6, '0')}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate">
                                                        <div className="font-bold">{inv.clienteNombre}</div>
                                                        <div className="text-xs text-gray-500">{inv.clienteDocumento}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-gray-800">S/ {parseFloat(inv.total).toFixed(2)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${inv.sunatResponse ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {inv.sunatResponse ? 'Aceptado' : 'Local'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button
                                                                onClick={() => pdf ? window.open(pdf, '_blank') : alert('Este comprobante fue emitido localmente y no cuenta con PDF de SUNAT.')}
                                                                title={pdf ? "Ver PDF" : "PDF no disponible"}
                                                                className={`p-1.5 rounded border transition ${pdf ? 'text-blue-600 hover:bg-blue-50 border-blue-200' : 'text-gray-300 border-gray-150 cursor-not-allowed bg-gray-50'}`}
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => xml ? window.open(xml, '_blank') : alert('Este comprobante fue emitido localmente y no cuenta con XML de SUNAT.')}
                                                                title={xml ? "Descargar XML" : "XML no disponible"}
                                                                className={`p-1.5 rounded border transition ${xml ? 'text-gray-600 hover:bg-gray-50 border-gray-200' : 'text-gray-300 border-gray-150 cursor-not-allowed bg-gray-50'}`}
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'new' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-6">
                                <section className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <Building2 size={16} /> Datos del Cliente
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Tipo Documento</label>
                                            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200">
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'boleta'}))}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newInvoice.tipo === 'boleta' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    🏷️ BOLETA
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewInvoice(prev => ({...prev, tipo: 'factura'}))}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newInvoice.tipo === 'factura' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    🏢 FACTURA
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">{docLabel}</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    maxLength={maxDocLength}
                                                    className="flex-1 px-4 py-2 border rounded-lg text-sm font-mono"
                                                    placeholder={docPlaceholder}
                                                    value={newInvoice.clienteDocumento}
                                                    onChange={(e) => handleDocumentoChange(e.target.value)}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handleSearchClient}
                                                    disabled={loading}
                                                    className="px-4 bg-gray-800 text-white rounded-lg hover:bg-black transition flex items-center gap-2 disabled:bg-gray-400"
                                                    title="Buscar en SUNAT"
                                                >
                                                    {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">{nameLabel}</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-2 border rounded-lg text-sm"
                                                placeholder="Se autocompleta al buscar"
                                                value={newInvoice.clienteNombre}
                                                onChange={(e) => setNewInvoice(prev => ({...prev, clienteNombre: e.target.value}))}
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Dirección</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-2 border rounded-lg text-sm"
                                                value={newInvoice.clienteDireccion}
                                                onChange={(e) => setNewInvoice({...newInvoice, clienteDireccion: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <FileText size={16} /> Conceptos / Productos
                                        </h3>
                                        <button 
                                            onClick={addItem}
                                            className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Añadir Fila
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {newInvoice.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-3 items-start animate-in fade-in duration-200">
                                                <div className="flex-1 space-y-1">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Descripción del servicio o producto"
                                                        className="w-full px-4 py-2 border rounded-lg text-sm"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-20 space-y-1">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Cant"
                                                        className="w-full px-4 py-2 border rounded-lg text-sm text-center"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-32 space-y-1">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2 text-gray-400 text-sm">S/</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="Precio"
                                                            className="w-full pl-8 pr-4 py-2 border rounded-lg text-sm text-right"
                                                            value={item.amount}
                                                            onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => removeItem(idx)}
                                                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Resumen de Venta</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-gray-600">
                                            <span>Subtotal</span>
                                            <span>S/ {config.operacionesExoneradas ? calculateTotal() : (parseFloat(calculateTotal()) / (1 + config.igvTasa/100)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600">
                                            <span>IGV ({config.operacionesExoneradas ? '0' : config.igvTasa}%)</span>
                                            <span>S/ {config.operacionesExoneradas ? '0.00' : (parseFloat(calculateTotal()) - (parseFloat(calculateTotal()) / (1 + config.igvTasa/100))).toFixed(2)}</span>
                                        </div>
                                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg text-gray-900">
                                            <span>Total</span>
                                            <span>S/ {calculateTotal()}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleEmit}
                                        disabled={loading}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:shadow-none"
                                    >
                                        <Zap size={20} fill="currentColor" /> {loading ? 'Emitiendo...' : 'Emitir Comprobante'}
                                    </button>
                                    <div className="text-[10px] text-gray-400 text-center uppercase flex items-center justify-center gap-1">
                                        <ShieldCheck size={10} /> Conexión segura con Sunat Hub
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase">
                                        <AlertCircle size={14} /> Información
                                    </div>
                                    <p className="text-xs text-blue-600 leading-relaxed">
                                        El comprobante se enviará automáticamente a SUNAT si la facturación electrónica está activada en la pestaña de configuración.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
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
                                                    if (res.data) setConfig(prev => ({...prev, ruc: val, razonSocial: res.data.razon_social || res.data.nombre}));
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
                </div>
            </div>
        </div>
    );
};

export default BillingConfigModal;

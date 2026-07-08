import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    ClipboardList, Search, User, Calendar, Filter,
    ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    RefreshCw, X, AlertCircle
} from 'lucide-react';

const ACTION_COLORS = {
    // Cancellations / deletions → red
    CANCEL_ACCOUNT:       'bg-red-100 text-red-700 border-red-200',
    CANCEL_ORDER:         'bg-red-100 text-red-700 border-red-200',
    DELETE_PRODUCT:       'bg-red-100 text-red-700 border-red-200',
    DELETE_USER:          'bg-red-100 text-red-700 border-red-200',
    CLOSE_ACCOUNT:        'bg-red-100 text-red-700 border-red-200',
    DELETE_AREA:          'bg-red-100 text-red-700 border-red-200',
    DELETE_TABLE:         'bg-red-100 text-red-700 border-red-200',
    DELETE_PROMO_CATEGORY:'bg-red-100 text-red-700 border-red-200',
    DELETE_PROMO_ITEM:    'bg-red-100 text-red-700 border-red-200',
    // Opens / creates → green
    OPEN_ACCOUNT:         'bg-green-100 text-green-700 border-green-200',
    OPEN_SHIFT:           'bg-green-100 text-green-700 border-green-200',
    CREATE_ACCOUNT:       'bg-green-100 text-green-700 border-green-200',
    CREATE_ORDER:         'bg-green-100 text-green-700 border-green-200',
    CREATE_PRODUCT:       'bg-green-100 text-green-700 border-green-200',
    CREATE_USER:          'bg-green-100 text-green-700 border-green-200',
    CREATE_AREA:          'bg-green-100 text-green-700 border-green-200',
    CREATE_TABLE:         'bg-green-100 text-green-700 border-green-200',
    CREATE_PROMO_CATEGORY:'bg-green-100 text-green-700 border-green-200',
    CREATE_PROMO_ITEM:    'bg-green-100 text-green-700 border-green-200',
    // Login → blue
    LOGIN:                'bg-blue-100 text-blue-700 border-blue-200',
    // Payments → purple
    ADD_PAYMENT:          'bg-purple-100 text-purple-700 border-purple-200',
    // Updates / adjustments → orange
    UPDATE_PRODUCT:       'bg-orange-100 text-orange-700 border-orange-200',
    UPDATE_USER:          'bg-orange-100 text-orange-700 border-orange-200',
    ADJUST_STOCK:         'bg-orange-100 text-orange-700 border-orange-200',
    // Close shift → gray
    CLOSE_SHIFT:          'bg-gray-100 text-gray-700 border-gray-200',
};

const ACTION_LABELS = {
    OPEN_ACCOUNT:          'Apertura Mesa',
    CLOSE_ACCOUNT:         'Cierre Cuenta',
    CANCEL_ACCOUNT:        'Cancelar Cuenta',
    CREATE_ORDER:          'Pedido',
    CANCEL_ORDER:          'Cancelar Pedido',
    ADD_PAYMENT:           'Abono',
    OPEN_SHIFT:            'Abrir Turno',
    CLOSE_SHIFT:           'Cerrar Turno',
    CREATE_PRODUCT:        'Crear Producto',
    DELETE_PRODUCT:        'Eliminar Producto',
    UPDATE_PRODUCT:        'Editar Producto',
    CREATE_USER:           'Crear Usuario',
    UPDATE_USER:           'Editar Usuario',
    DELETE_USER:           'Eliminar Usuario',
    LOGIN:                 'Login',
    ADJUST_STOCK:          'Ajuste Stock',
    CREATE_AREA:           'Crear Área',
    DELETE_AREA:           'Eliminar Área',
    CREATE_TABLE:          'Crear Mesa',
    DELETE_TABLE:          'Eliminar Mesa',
    CREATE_PROMO_CATEGORY: 'Nueva Cat. 2x1',
    DELETE_PROMO_CATEGORY: 'Eliminar Cat. 2x1',
    CREATE_PROMO_ITEM:     'Nuevo Trago 2x1',
    DELETE_PROMO_ITEM:     'Eliminar Trago 2x1',
};

const ENTITY_LABELS = {
    Account: 'Mesa / Cuenta',
    Order: 'Pedido',
    Payment: 'Pago',
    CashSession: 'Turno / Caja',
    Product: 'Producto',
    User: 'Usuario',
    Area: 'Área',
    Table: 'Mesa',
    DrinkPromotion: 'Promo 2x1',
    DrinkPromotionItem: 'Bebida 2x1'
};

const DETAIL_KEY_LABELS = {
    userId: 'ID Usuario',
    tableId: 'Número de Mesa',
    accountId: 'ID Cuenta',
    productId: 'ID Producto',
    openingCash: 'Efectivo Inicial',
    closingNotes: 'Notas de Cierre',
    amount: 'Monto',
    quantity: 'Cantidad',
    notes: 'Notas / Observaciones',
    reason: 'Motivo',
    paymentMethod: 'Método de Pago',
    username: 'Usuario',
    displayName: 'Nombre Completo',
    role: 'Rol / Permisos',
    ip: 'Dirección IP',
    status: 'Estado',
    total: 'Total',
    requirePinPrompt: 'Requiere PIN',
    active: 'Activo',
    name: 'Nombre',
    price: 'Precio',
    customerName: 'Cliente',
    clientDni: 'DNI / RUC',
    clientAddress: 'Dirección',
    accountType: 'Tipo de Cuenta',
    category: 'Categoría'
};

const ENTITIES = [
    { value: '', label: 'Todas las entidades' },
    { value: 'Account', label: 'Cuentas (Mesas)' },
    { value: 'Order', label: 'Pedidos' },
    { value: 'Payment', label: 'Pagos' },
    { value: 'CashSession', label: 'Turnos (Caja)' },
    { value: 'Product', label: 'Productos' },
    { value: 'User', label: 'Usuarios' },
];

const PAGE_SIZE = 50;

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function parseDetails(details) {
    if (!details) return null;
    try { return typeof details === 'string' ? JSON.parse(details) : details; }
    catch { return { raw: details }; }
}

function getActionColor(action) {
    return ACTION_COLORS[action] || 'bg-gray-100 text-gray-600 border-gray-200';
}

function getActionLabel(action) {
    return ACTION_LABELS[action] || action;
}

function formatReference(log) {
    const details = parseDetails(log.details);
    if (!details) return '-';

    // Format specific actions first
    switch (log.action) {
        case 'LOGIN':
            return details.ip ? `IP: ${details.ip}` : 'Sesión iniciada';
        case 'OPEN_SHIFT':
            return `Apertura de Caja con S/ ${parseFloat(details.openingCash || 0).toFixed(2)}`;
        case 'CLOSE_SHIFT': {
            const parts = [`Cierre Turno #${details.sessionId || log.entityId || ''}`];
            if (details.closingNotes) {
                parts.push(`Notas: "${details.closingNotes}"`);
            }
            return parts.join(' · ');
        }
        case 'CREATE_ORDER':
        case 'CANCEL_ORDER': {
            const parts = [];
            if (details.tableId) parts.push(`Mesa ${details.tableId}`);
            if (details.items) parts.push(String(details.items));
            return parts.join(' · ') || 'Detalles de pedido';
        }
        case 'ADD_PAYMENT':
            return `Abono de S/ ${parseFloat(details.amount || 0).toFixed(2)} (${details.paymentMethod || 'Efectivo'})`;
        case 'CREATE_USER':
            return `Rol: ${details.role || '-'}`;
        case 'DELETE_USER':
            return `Usuario desactivado`;
        case 'UPDATE_USER': {
            if (details.changes) {
                const parts = [];
                Object.entries(details.changes).forEach(([k, v]) => {
                    const label = DETAIL_KEY_LABELS[k] || k;
                    let displayVal = String(v);
                    if (typeof v === 'boolean') displayVal = v ? 'Sí' : 'No';
                    parts.push(`${label}: ${displayVal}`);
                });
                return parts.length > 0 ? parts.join(', ') : 'Actualización sin cambios detallados';
            }
            return 'Usuario editado';
        }
        default:
            break;
    }

    // Fallback for other actions: list relevant keys in a single readable line
    const excludedKeys = ['userId', 'username', 'id', 'createdAt', 'updatedAt', 'entityId', 'sessionId', 'changes'];
    const parts = [];
    
    if (details.tableId) {
        parts.push(`Mesa ${details.tableId}`);
    }

    Object.entries(details).forEach(([k, v]) => {
        if (excludedKeys.includes(k) || k === 'tableId') return;
        
        // Handle nested objects safely instead of skipping them completely
        if (typeof v === 'object' && v !== null) {
            Object.entries(v).forEach(([subK, subV]) => {
                const label = DETAIL_KEY_LABELS[subK] || subK;
                let displayVal = String(subV);
                if (typeof subV === 'boolean') displayVal = subV ? 'Sí' : 'No';
                if (!displayVal.startsWith('{') && !displayVal.startsWith('[')) {
                    parts.push(`${label}: ${displayVal}`);
                }
            });
            return;
        }

        const label = DETAIL_KEY_LABELS[k] || k;
        let displayVal = String(v);
        if (typeof v === 'boolean') {
            displayVal = v ? 'Sí' : 'No';
        }
        parts.push(`${label}: ${displayVal}`);
    });

    return parts.join(' · ') || (typeof log.details === 'string' && log.details.startsWith('{') ? 'Detalles de operación' : String(log.details || '-'));
}

function TableRow({ log }) {
    return (
        <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100">
            <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                {formatDate(log.createdAt)}
            </td>
            <td className="p-3 text-sm font-medium text-gray-800">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-indigo-700">
                            {log.User ? (log.User.displayName || log.User.username || '?')[0].toUpperCase() : '-'}
                        </span>
                    </div>
                    <span className="truncate max-w-[120px]">
                        {log.User ? (log.User.displayName || log.User.username) : <span className="text-gray-400 font-semibold">N/A</span>}
                    </span>
                </div>
            </td>
            <td className="p-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getActionColor(log.action)}`}>
                    {getActionLabel(log.action)}
                </span>
            </td>
            <td className="p-3 text-sm text-gray-600 hidden md:table-cell">
                {ENTITY_LABELS[log.entity] || log.entity}
                {log.entityId && <span className="text-xs text-gray-400 ml-1">#{log.entityId}</span>}
            </td>
            <td className="p-3 text-xs text-gray-600 font-medium max-w-[300px] sm:max-w-none truncate sm:whitespace-normal" title={formatReference(log)}>
                {formatReference(log)}
            </td>
        </tr>
    );
}

export default function AuditLogView() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);

    // Filter state
    const [users, setUsers] = useState([]);
    const [knownActions, setKnownActions] = useState([]);
    const [filters, setFilters] = useState({
        userId: '',
        action: '',
        entity: '',
        dateFrom: '',
        dateTo: '',
        search: '',
    });
    const [pendingFilters, setPendingFilters] = useState({ ...filters });
    const [showFilters, setShowFilters] = useState(false);

    // Load metadata (users + distinct actions)
    useEffect(() => {
        axios.get('/api/audit-logs/meta').then(res => {
            setUsers(res.data.users || []);
            setKnownActions(res.data.actions || []);
        }).catch(() => {});
    }, []);

    const loadLogs = useCallback(async (appliedFilters, currentPage) => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                limit: PAGE_SIZE,
                offset: currentPage * PAGE_SIZE,
            };
            if (appliedFilters.userId) params.userId = appliedFilters.userId;
            if (appliedFilters.action) params.action = appliedFilters.action;
            if (appliedFilters.entity) params.entity = appliedFilters.entity;
            if (appliedFilters.dateFrom) params.dateFrom = appliedFilters.dateFrom;
            if (appliedFilters.dateTo) params.dateTo = appliedFilters.dateTo;
            if (appliedFilters.search) params.search = appliedFilters.search;

            const res = await axios.get('/api/audit-logs', { params });
            // Support both old (array) and new (object with logs/total) response formats
            if (Array.isArray(res.data)) {
                setLogs(res.data);
                setTotal(res.data.length);
            } else {
                setLogs(res.data.logs || []);
                setTotal(res.data.total || 0);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs(filters, page);
    }, [loadLogs, filters, page]);

    const applyFilters = () => {
        setFilters({ ...pendingFilters });
        setPage(0);
        setShowFilters(false);
    };

    const clearFilters = () => {
        const empty = { userId: '', action: '', entity: '', dateFrom: '', dateTo: '', search: '' };
        setPendingFilters(empty);
        setFilters(empty);
        setPage(0);
    };

    const hasActiveFilters = Object.values(filters).some(v => v !== '');
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="text-purple-600" size={22} />
                    Registro de Auditoría
                    {total > 0 && (
                        <span className="ml-1 text-sm font-normal text-gray-400">
                            ({total.toLocaleString()} registros)
                        </span>
                    )}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadLogs(filters, page)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition"
                        title="Recargar"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowFilters(prev => !prev)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${hasActiveFilters ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Filter size={15} />
                        Filtros
                        {hasActiveFilters && <span className="bg-white text-purple-700 text-xs rounded-full px-1.5 py-0.5 font-bold">ON</span>}
                    </button>
                </div>
            </div>

            {/* Quick search bar */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="Buscar en detalles (mesa, producto, usuario...)"
                    value={pendingFilters.search}
                    onChange={e => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                />
                {pendingFilters.search && (
                    <button onClick={() => { setPendingFilters(p => ({ ...p, search: '' })); applyFilters(); }} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Expanded Filter Panel */}
            {showFilters && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Usuario */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><User size={11} /> Usuario</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={pendingFilters.userId}
                                onChange={e => setPendingFilters(prev => ({ ...prev, userId: e.target.value }))}
                            >
                                <option value="">Todos los usuarios</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                                ))}
                            </select>
                        </div>

                        {/* Acción */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de Acción</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={pendingFilters.action}
                                onChange={e => setPendingFilters(prev => ({ ...prev, action: e.target.value }))}
                            >
                                <option value="">Todas las acciones</option>
                                {(knownActions.length > 0 ? knownActions : Object.keys(ACTION_LABELS)).map(a => (
                                    <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                                ))}
                            </select>
                        </div>

                        {/* Entidad */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Entidad</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={pendingFilters.entity}
                                onChange={e => setPendingFilters(prev => ({ ...prev, entity: e.target.value }))}
                            >
                                {ENTITIES.map(e => (
                                    <option key={e.value} value={e.value}>{e.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Fecha desde */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={11} /> Desde</label>
                            <input
                                type="date"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={pendingFilters.dateFrom}
                                onChange={e => setPendingFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                            />
                        </div>

                        {/* Fecha hasta */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={11} /> Hasta</label>
                            <input
                                type="date"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                value={pendingFilters.dateTo}
                                onChange={e => setPendingFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button
                            onClick={applyFilters}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 rounded-lg transition"
                        >
                            Aplicar Filtros
                        </button>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                    <AlertCircle size={16} /> Error cargando registros: {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 text-xs font-semibold text-gray-500">Fecha</th>
                                <th className="text-left p-3 text-xs font-semibold text-gray-500">Usuario</th>
                                <th className="text-left p-3 text-xs font-semibold text-gray-500">Acción</th>
                                <th className="text-left p-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Entidad</th>
                                <th className="text-left p-3 text-xs font-semibold text-gray-500">Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="p-10 text-center text-gray-400 text-sm">Cargando registros...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-gray-400 text-sm">No se encontraron registros con los filtros aplicados.</td></tr>
                            ) : (
                                logs.map(log => <TableRow key={log.id} log={log} />)
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Pág. {page + 1} de {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} registros
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(prev => Math.max(0, prev - 1))}
                                disabled={page === 0}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <button
                                onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

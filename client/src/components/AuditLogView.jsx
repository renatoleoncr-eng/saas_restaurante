import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardList, Search, User, Calendar } from 'lucide-react';

export default function AuditLogView() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const res = await axios.get('/api/audit-logs');
            setLogs(res.data);
            setFilteredLogs(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Error loading logs", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!filter) {
            setFilteredLogs(logs);
        } else {
            const lowerFilter = filter.toLowerCase();
            const result = logs.filter(log =>
                log.action.toLowerCase().includes(lowerFilter) ||
                (log.User && log.User.username.toLowerCase().includes(lowerFilter)) ||
                log.entity.toLowerCase().includes(lowerFilter) ||
                (log.details && log.details.toLowerCase().includes(lowerFilter))
            );
            setFilteredLogs(result);
        }
    }, [filter, logs]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <ClipboardList className="text-purple-600" /> Registro de Auditoría
            </h2>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Buscar por usuario, acción o detalles..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <div className="text-sm text-gray-500">
                    Mostrando ultimos 100 registros
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 text-sm font-semibold text-gray-600">Fecha</th>
                            <th className="text-left p-4 text-sm font-semibold text-gray-600">Usuario</th>
                            <th className="text-left p-4 text-sm font-semibold text-gray-600">Acción</th>
                            <th className="text-left p-4 text-sm font-semibold text-gray-600">Entidad</th>
                            <th className="text-left p-4 text-sm font-semibold text-gray-600">Detalles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">Cargando registros...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No se encontraron registros.</td></tr>
                        ) : (
                            filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                                        {formatDate(log.createdAt)}
                                    </td>
                                    <td className="p-4 text-sm font-medium text-gray-800">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            {log.User ? log.User.displayName || log.User.username : <span className="text-red-400 italic">Desconocido</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold 
                                            ${log.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                                                log.action.includes('CREATE') ? 'bg-green-100 text-green-700' :
                                                    log.action.includes('LOGIN') ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-700'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600">
                                        {log.entity} <span className="text-xs text-gray-400">#{log.entityId}</span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-500 font-mono max-w-md truncate" title={log.details}>
                                        {log.details || '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

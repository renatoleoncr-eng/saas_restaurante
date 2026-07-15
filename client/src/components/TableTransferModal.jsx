import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { X, ArrowRightLeft, CheckCircle } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export default function TableTransferModal({ account, currentTable, onClose, onSuccess }) {
    const { refreshData } = useRestaurant();
    useModalBackHandler(true, onClose);
    const [availableTables, setAvailableTables] = useState([]);
    const [selectedTableId, setSelectedTableId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Group and sort available tables by area/section
    const sortedAreas = useMemo(() => {
        const grouped = {};
        availableTables.forEach(table => {
            const areaId = table.AreaId || 'other';
            const areaName = table.Area?.name || 'Otras';
            const sortOrder = table.Area?.sortOrder ?? 999;
            if (!grouped[areaId]) {
                grouped[areaId] = {
                    id: areaId,
                    name: areaName,
                    sortOrder,
                    tables: []
                };
            }
            grouped[areaId].tables.push(table);
        });

        const sorted = Object.values(grouped).sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.name.localeCompare(b.name);
        });

        sorted.forEach(area => {
            area.tables.sort((a, b) => {
                const numA = parseInt(a.number) || 0;
                const numB = parseInt(b.number) || 0;
                if (numA !== numB) return numA - numB;
                return a.number.localeCompare(b.number);
            });
        });

        return sorted;
    }, [availableTables]);

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const res = await axios.get(`/api/tables?t=${Date.now()}`); // Fetch all tables to see all areas
                // Filter only free tables
                const freeTables = res.data.filter(t => t.status === 'free');
                setAvailableTables(freeTables);
            } catch (err) {
                console.error("Error fetching tables:", err);
                setError("Error cargando mesas disponibles");
            }
        };
        fetchTables();
    }, [currentTable]);

    const handleTransfer = async () => {
        if (!selectedTableId || loading) return;
        setLoading(true);
        setError('');

        try {
            await axios.post('/api/accounts/transfer', {
                currentTableId: currentTable.id,
                newTableId: selectedTableId
            });

            refreshData(); // Refresh context
            onSuccess(); // Callback to parent
            onClose();
        } catch (err) {
            console.error("Error transferring table:", err);
            setError(err.response?.data?.error || "Error al cambiar de mesa");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ArrowRightLeft size={24} /> Cambiar de Mesa
                    </h2>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }} 
                        className="p-2 hover:bg-blue-700 rounded transition relative z-50 cursor-pointer pointer-events-auto shrink-0 flex items-center justify-center -mr-1"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-gray-500 text-sm mb-1">Mesa Actual</p>
                        <p className="text-2xl font-bold text-blue-800">{formatTableName(currentTable)}</p>
                        <p className="text-sm text-gray-600 mt-2">
                            Cuenta: <span className="font-semibold">{account?.customerName || 'Cliente'}</span>
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <ArrowRightLeft className="text-gray-400 rotate-90" size={32} />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-bold mb-2">Seleccionar Nueva Mesa</label>
                        {sortedAreas.length > 0 ? (
                            <div className="max-h-60 overflow-y-auto space-y-4 pr-1">
                                {sortedAreas.map(area => (
                                    <div key={area.id} className="space-y-1.5">
                                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-150 pb-1">
                                            {area.name}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {area.tables.map(table => (
                                                <button
                                                    key={table.id}
                                                    onClick={() => setSelectedTableId(table.id)}
                                                    className={`
                                                        py-2 px-1 rounded-lg border-2 font-bold text-sm transition-all
                                                        ${selectedTableId === table.id
                                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                                            : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-gray-50'}
                                                    `}
                                                >
                                                    {formatTableName(table)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 italic py-4 bg-gray-50 rounded-lg border border-dashed">
                                No hay mesas libres en esta área
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleTransfer}
                            disabled={!selectedTableId || loading}
                            className={`
                                flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all
                                ${!selectedTableId || loading
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl'}
                            `}
                        >
                            {loading ? 'Procesando...' : 'Confirmar Cambio'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

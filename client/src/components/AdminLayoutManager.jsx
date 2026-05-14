import React, { useState } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Plus, Trash, Edit, Calendar } from 'lucide-react';
import TableControl from './TableControl';
import ReservationModal from './ReservationModal';
import SessionManagerModal from './SessionManagerModal';

export default function AdminLayoutManager() {
    const { areas, refreshData, reservations } = useRestaurant();
    const [newAreaName, setNewAreaName] = useState('');
    const [selectedTable, setSelectedTable] = useState(null);
    const [reservationTable, setReservationTable] = useState(null);
    const [creatingTable, setCreatingTable] = useState({}); // { areaId: boolean }
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [activeSession, setActiveSession] = useState(null);

    // Mobile Tabs State
    const [activeAreaId, setActiveAreaId] = useState(null);

    // Set default active area on load
    React.useEffect(() => {
        if (areas.length > 0 && !activeAreaId) {
            setActiveAreaId(areas[0].id);
        }
        checkActiveSession();
    }, [areas, activeAreaId]);

    const checkActiveSession = async () => {
        try {
            const res = await axios.get('/api/sessions/current');
            setActiveSession(res.data.session);
        } catch (err) {
            setActiveSession(null);
        }
    };


    const handleCreateArea = async () => {
        if (!newAreaName) return;
        await axios.post('/api/areas', { name: newAreaName, sortOrder: areas.length });
        setNewAreaName('');
        refreshData();
    };

    const handleDeleteArea = async (id) => {
        if (!confirm('Delete area?')) return;
        await axios.delete(`/api/areas/${id}`);
        refreshData();
    };

    const handleCreateTable = async (areaId) => {
        if (creatingTable[areaId]) return;

        setCreatingTable(prev => ({ ...prev, [areaId]: true }));
        try {
            // Find the smallest available table number
            const area = areas.find(a => a.id === areaId);
            let nextNum = 1;

            if (area && area.Tables && area.Tables.length > 0) {
                // Get all existing table numbers as integers
                const existingNums = area.Tables
                    .map(t => parseInt(t.number))
                    .filter(n => !isNaN(n))
                    .sort((a, b) => a - b);

                if (existingNums.length > 0) {
                    const maxNum = Math.max(...existingNums);

                    // Find the first missing number between 1 and maxNum
                    let foundGap = false;
                    for (let i = 1; i <= maxNum; i++) {
                        if (!existingNums.includes(i)) {
                            nextNum = i;
                            foundGap = true;
                            break;
                        }
                    }

                    // If no gap found, use maxNum + 1
                    if (!foundGap) {
                        nextNum = maxNum + 1;
                    }
                }
            }

            await axios.post('/api/tables', { number: String(nextNum), AreaId: areaId });
            refreshData();
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || 'Error creando mesa';
            alert(errorMsg);
        } finally {
            setCreatingTable(prev => ({ ...prev, [areaId]: false }));
        }
    };

    const handleDeleteTable = async (id) => {
        if (!confirm('¿Eliminar mesa?')) return;
        try {
            await axios.delete(`/api/tables/${id}`);
            refreshData();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Error eliminando mesa';
            alert(errorMsg);
            console.error(error);
        }
    };

    const handleRenameTable = async (table) => {
        const newName = window.prompt('Ingrese el nuevo nombre/número para esta mesa:', table.number);
        if (newName === null || newName.trim() === '') return;

        try {
            await axios.put(`/api/tables/${table.id}`, { number: newName.trim() });
            refreshData();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Error renombrando mesa';
            alert(errorMsg);
            console.error(error);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Gestionar Salon</h2>
                <button
                    onClick={() => setShowSessionModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-sm transition-all transform active:scale-95 ${activeSession
                        ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                        }`}
                >
                    <Calculator size={18} />
                    {activeSession ? 'Turno Abierto' : 'Abrir Turno'}
                </button>
            </div>

            {/* Area Creation */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newAreaName}
                    onChange={e => setNewAreaName(e.target.value)}
                    placeholder="Nombre Nueva Fila (ej. Terraza)"
                    className="border p-2 rounded"
                />
                <button
                    onClick={handleCreateArea}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                    <Plus size={16} /> Crear Area
                </button>
            </div>

            {/* Areas List */}

            {/* MOBILE TABS */}
            <div className="flex md:hidden overflow-x-auto gap-2 mb-4 pb-2 no-scrollbar">
                {areas.map(area => (
                    <button
                        key={area.id}
                        onClick={() => setActiveAreaId(area.id)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm shadow-sm transition-colors
                            ${activeAreaId === area.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                    >
                        {area.name}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-6">
                {areas.map(area => {
                    // Mobile: Show only active (hidden via CSS if not active? Or just null?)
                    // Better to control visibility to avoid unmounting if expensive? 
                    // But here it's cheap. Let's return null if mobile & not active.
                    // However, we need a way to detect mobile in JS or use hidden class.
                    // Using hidden class is safer for SSR/hydration matching usually, but here it's client-only logic mostly.
                    // Let's use `hidden md:flex` logic.
                    const isMobileActive = activeAreaId === area.id;

                    return (
                        <div
                            key={area.id}
                            className={`${isMobileActive ? 'flex' : 'hidden'} md:flex flex-col border rounded-lg p-4 bg-gray-50 shadow-sm w-full`}
                        >
                            <div className="flex justify-between items-center mb-4 pb-2 border-b bg-white p-2 rounded">
                                <h3 className="font-bold text-lg text-gray-800">{area.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleCreateTable(area.id)}
                                        disabled={creatingTable[area.id]}
                                        className={`p-2 rounded transition-colors ${creatingTable[area.id] ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-800'}`}
                                        title="Agregar Mesa Automática"
                                    >
                                        {creatingTable[area.id] ? <span className="animate-spin text-xs">⏳</span> : <Plus size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteArea(area.id)}
                                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded transition-colors"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* MOBILE: Tables as Rows (Vertical List) - Removed max-h to use page scroll */}
                            <div className="flex md:hidden flex-col gap-2 mb-4">
                                {area.Tables && [...area.Tables].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(table => {
                                    const isReserved = reservations.some(r => r.TableId === table.id);
                                    const status = isReserved ? 'reserved' : table.status;
                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => setSelectedTable(table.id)}
                                            className={`border p-3 rounded shadow-sm flex justify-between items-center transition-colors cursor-pointer
                                            ${status === 'free' ? 'bg-white hover:border-blue-300' :
                                                    status === 'occupied' ? 'bg-red-50 border-red-200' :
                                                        'bg-purple-50 border-purple-200'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center font-bold
                                                ${status === 'free' ? 'bg-blue-600' : status === 'occupied' ? 'bg-red-500' : 'bg-purple-500'}`}>
                                                    {table.number}
                                                </div>
                                                <div className="text-sm">
                                                    <div className="text-gray-900 font-medium">Mesa {table.number}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {status === 'free' ? 'Libre' : status === 'occupied' ? 'Ocupada' : 'Reservada'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {status === 'free' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReservationTable(table.id); }}
                                                        className="text-blue-500 hover:bg-blue-50 p-2 rounded"
                                                        title="Reservar"
                                                    >
                                                        <Calendar size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRenameTable(table); }}
                                                    className="text-purple-500 hover:text-purple-700 p-2 rounded hover:bg-purple-50"
                                                    title="Renombrar Mesa"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                                                    className="text-gray-400 hover:text-red-500 p-2 rounded hover:bg-red-50"
                                                    title="Eliminar Mesa"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!area.Tables || area.Tables.length === 0) && (
                                    <div className="text-center text-gray-400 py-4 italic text-sm">Sin mesas</div>
                                )}
                            </div>

                            {/* DESKTOP: Tables as Chips (Grid/Flex) */}
                            <div className="hidden md:flex flex-wrap gap-3 mb-4">
                                {area.Tables && [...area.Tables].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(table => {
                                    const isReserved = reservations.some(r => r.TableId === table.id);
                                    const status = isReserved ? 'reserved' : table.status;
                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => setSelectedTable(table.id)}
                                            className={`border p-3 rounded shadow-sm text-center min-w-[80px] relative group hover:shadow-md transition cursor-pointer
                                            ${status === 'free' ? 'bg-white' : status === 'occupied' ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'}`}
                                        >
                                            <span className="font-bold text-lg block">{table.number}</span>
                                            <span className={`text-xs ${status === 'free' ? 'text-green-600' : status === 'occupied' ? 'text-red-600' : 'text-purple-600'}`}>
                                                {status === 'free' ? 'Libre' : status === 'occupied' ? 'Ocu' : 'Res'}
                                            </span>

                                            {/* Action Buttons (Hover) */}
                                            <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 justify-end z-10">
                                                {status === 'free' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReservationTable(table.id); }}
                                                        className="bg-blue-500 text-white rounded-full p-1 shadow-sm hover:bg-blue-600"
                                                        title="Reservar"
                                                    >
                                                        <Calendar size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRenameTable(table); }}
                                                    className="bg-purple-500 text-white rounded-full p-1 shadow-sm hover:bg-purple-600"
                                                    title="Renombrar Mesa"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                                                    className="bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                                                    title="Eliminar Mesa"
                                                >
                                                    <Trash size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!area.Tables || area.Tables.length === 0) && (
                                    <div className="text-center text-gray-400 py-4 italic text-sm w-full">Sin mesas</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* OPERATIONAL MODALS */}
            {
                selectedTable && (
                    <TableControl
                        tableId={selectedTable}
                        onClose={() => { setSelectedTable(null); refreshData(); }}
                    />
                )
            }
            {
                reservationTable && (
                    <ReservationModal
                        tableId={reservationTable}
                        onClose={() => { setReservationTable(null); refreshData(); }}
                    />
                )
            }
            {showSessionModal && (
                <SessionManagerModal
                    onClose={() => {
                        setShowSessionModal(false);
                        checkActiveSession();
                        refreshData();
                    }}
                />
            )}
        </div >
    );
}

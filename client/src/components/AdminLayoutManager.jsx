import React, { useState } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Plus, Trash, Edit, Calendar, Calculator, Lock } from 'lucide-react';
import TableControl from './TableControl';
import ReservationModal from './ReservationModal';
import SessionManagerModal from './SessionManagerModal';
import OnboardingWelcome from './OnboardingWelcome';

export default function AdminLayoutManager({ onGoToSection }) {
    const { areas, refreshData, reservations, tenantInfo, products } = useRestaurant();
    const [newAreaName, setNewAreaName] = useState('');
    const [selectedTable, setSelectedTable] = useState(null);
    const [reservationTable, setReservationTable] = useState(null);
    const [creatingTable, setCreatingTable] = useState({}); // { areaId: boolean }
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [isCreatingArea, setIsCreatingArea] = useState(false);

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
                        ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                        }`}
                >
                    <Calculator size={18} />
                    {activeSession ? 'Cerrar Turno' : 'Abrir Turno'}
                </button>
            </div>

            {/* Main Content Area */}
            {!activeSession && tenantInfo && !tenantInfo.onboardingCompleted ? (
                // NEW RESTAURANT — show onboarding guide
                <>
                    <OnboardingWelcome
                        tenantInfo={tenantInfo}
                        areas={areas}
                        products={products || []}
                        onGoToSection={onGoToSection}
                        onOpenSession={() => setShowSessionModal(true)}
                    />
                    {showSessionModal && (
                        <SessionManagerModal
                            activeSession={activeSession}
                            onClose={() => { setShowSessionModal(false); checkActiveSession(); }}
                        />
                    )}
                </>
            ) : !activeSession ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 mt-6 mx-4">
                    <Lock size={48} className="text-gray-400 mb-4" />
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Turno Cerrado</h3>
                    <p className="text-gray-500 mb-6 text-center max-w-md">
                        Debe abrir el turno de salón para poder visualizar las mesas, tomar pedidos o editar la configuración.
                    </p>
                    <button
                        onClick={() => setShowSessionModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform active:scale-95"
                    >
                        Abrir Turno Ahora
                    </button>
                </div>
            ) : (
                <>
                    {/* Area Creation */}
                    <div className="mb-6">
                        {!isCreatingArea ? (
                            <button
                                onClick={() => setIsCreatingArea(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all transform active:scale-95 text-sm"
                            >
                                <Plus size={16} /> Crear Área
                            </button>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-2 bg-gray-50 border p-3 rounded-xl max-w-md animate-in fade-in duration-200">
                                <input
                                    type="text"
                                    value={newAreaName}
                                    onChange={e => setNewAreaName(e.target.value)}
                                    placeholder="Nombre Nueva Fila (ej. Terraza)"
                                    className="border px-3 py-2 rounded-lg text-sm flex-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={async () => {
                                            if (!newAreaName.trim()) return;
                                            await handleCreateArea();
                                            setIsCreatingArea(false);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
                                    >
                                        Crear
                                    </button>
                                    <button
                                        onClick={() => {
                                            setNewAreaName('');
                                            setIsCreatingArea(false);
                                        }}
                                        className="bg-white hover:bg-gray-100 text-gray-600 font-bold px-4 py-2 rounded-lg border text-xs"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
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

                            {/* UNIFIED GRID VIEW: Tables as Chips (Mobile and Desktop) */}
                            <div className="flex flex-wrap gap-4 mb-4 justify-start">
                                {area.Tables && [...area.Tables].sort((a, b) => (parseInt(a.number) || 0) - (parseInt(b.number) || 0)).map(table => {
                                    const isReserved = false;
                                    const status = table.status;
                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => setSelectedTable(table.id)}
                                            className={`w-24 h-24 rounded-xl flex flex-col items-center justify-center border-2 transition-all shadow-sm active:scale-95 relative cursor-pointer
                                            ${status === 'free' ? "border-green-400 bg-green-50 text-green-800 hover:bg-green-100" :
                                                status === 'occupied' ? "border-red-400 bg-red-50 text-red-800 hover:bg-red-100" :
                                                status === 'reserved' ? "border-purple-400 bg-purple-50 text-purple-800 hover:bg-purple-100" :
                                                "border-gray-300 bg-gray-100 text-gray-500"}`}
                                        >
                                            {/* Action Buttons overlay (Always visible for easy tapping on mobile, styled cleanly) */}
                                            <div className="absolute top-1.5 right-1.5 flex justify-end items-center z-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                                                    className="p-1 bg-white/95 hover:bg-white text-red-500 rounded-lg shadow-sm border border-red-100 transition-colors"
                                                    title="Eliminar Mesa"
                                                >
                                                    <Trash size={12} />
                                                </button>
                                            </div>

                                            <span className="text-2xl font-black mt-3">
                                                {table.number}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold tracking-wider mt-0.5 opacity-90">
                                                {status === 'free' ? 'Libre' : status === 'occupied' ? 'Ocupada' : 'Reservada'}
                                            </span>
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
            </>
            )}
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
                    initialIsClosingMode={!!activeSession}
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

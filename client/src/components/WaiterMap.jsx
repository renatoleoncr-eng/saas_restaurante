import React, { useState } from 'react';
import { useRestaurant } from '../contexts/RestaurantContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import TableControl from './TableControl';
import ReservationModal from './ReservationModal';
import { formatTableName } from '../utils/tableUtils';
import axios from 'axios';
import { Calendar, Lock, Calculator } from 'lucide-react';
import SessionManagerModal from './SessionManagerModal';

export default function WaiterMap() {
    const { areas, refreshData, reservations, refreshTrigger } = useRestaurant();
    const [selectedTable, setSelectedTable] = useState(null);
    const [reservationTable, setReservationTable] = useState(null);
    const [readyOrders, setReadyOrders] = useState([]); // Kept as empty to avoid undefined errors if referenced elsewhere (though logic removed) or just remove entirely if safe.
    // Actually, I should just restore the needed parts.
    const [activeAreaId, setActiveAreaId] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [showSessionModal, setShowSessionModal] = useState(false);
    const navigate = useNavigate();

    const checkActiveSession = async () => {
        try {
            setLoadingSession(true);
            const res = await axios.get('/api/sessions/current');
            setActiveSession(res.data.session);
        } catch (err) {
            setActiveSession(null);
        } finally {
            setLoadingSession(false);
        }
    };

    React.useEffect(() => {
        checkActiveSession();
    }, [refreshTrigger]);

    // Init active area
    React.useEffect(() => {
        if (areas.length > 0 && !activeAreaId) {
            setActiveAreaId(areas[0].id);
        }
    }, [areas, activeAreaId]);

    const handleTableClick = (tableId) => {
        setSelectedTable(tableId);
    };

    const handleCloseModal = () => {
        setSelectedTable(null);
        refreshData();
    };

    return (
        <div className="p-6">

            {/* Ready Orders Logic Removed as per user request */}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Seleccione una Mesa</h2>
                <button
                    onClick={() => setShowSessionModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-sm transition-all transform active:scale-95 text-sm ${activeSession
                        ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                        }`}
                >
                    <Calculator size={16} />
                    {activeSession ? 'Cerrar Turno' : 'Abrir Turno'}
                </button>
            </div>
            
            {loadingSession ? (
                <div className="text-center py-10 text-gray-500 animate-pulse">Cargando estado del turno...</div>
            ) : !activeSession ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 mt-6 mx-4">
                    <Lock size={48} className="text-gray-400 mb-4" />
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Turno Cerrado</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                        El turno está cerrado. Debe abrir el turno de salón para poder visualizar las mesas y tomar pedidos.
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
            {/* MOBILE TABS */}
            {/* MOBILE TABS (BUBBLES) */}
            <div className="flex md:hidden overflow-x-auto gap-2 mb-4 pb-2 no-scrollbar">
                {areas.map(area => (
                    <button
                        key={area.id}
                        onClick={() => setActiveAreaId(area.id)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm shadow-sm transition-colors border
                            ${activeAreaId === area.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {area.name}
                    </button>
                ))}
            </div>

            <div className="grid gap-8">
                {areas.map(area => (
                    <div
                        key={area.id}
                        className={clsx(
                            "bg-white rounded-lg shadow-sm p-4",
                            activeAreaId === area.id ? "block" : "hidden md:block" // Show only active on mobile, all on desktop
                        )}
                    >
                        <h3 className="font-semibold text-gray-700 mb-3 border-l-4 border-blue-500 pl-2">
                            {area.name}
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            {area.Tables.map(table => {
                                const isReserved = false;
                                const status = table.status;

                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => handleTableClick(table.id)}
                                        className={clsx(
                                            "w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-all shadow-sm active:scale-95 relative group",
                                            status === 'free' ? "border-green-400 bg-green-50 text-green-800 hover:bg-green-100" :
                                                status === 'occupied' ? "border-red-400 bg-red-50 text-red-800 hover:bg-red-100" :
                                                    status === 'reserved' ? "border-purple-400 bg-purple-50 text-purple-800 hover:bg-purple-100" :
                                                        "border-gray-300 bg-gray-100 text-gray-500"
                                        )}
                                    >
                                        <span className="text-2xl font-bold">
                                            {formatTableName(table, area)}
                                        </span>
                                        <span className="text-xs uppercase font-semibold mt-1">
                                            {status === 'free' ? 'Libre' : status === 'occupied' ? 'Ocupada' : 'Reservada'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            </>
            )}

            {selectedTable && (
                <TableControl
                    tableId={selectedTable}
                    onClose={handleCloseModal}
                />
            )}

            {reservationTable && (
                <ReservationModal
                    tableId={reservationTable}
                    onClose={() => { setReservationTable(null); refreshData(); }}
                />
            )}

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
        </div>
    );
}

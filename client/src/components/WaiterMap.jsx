import React, { useState } from 'react';
import { useRestaurant } from '../contexts/RestaurantContext';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import TableControl from './TableControl';
import ReservationModal from './ReservationModal';
import { formatTableName } from '../utils/tableUtils';
import axios from 'axios';
import { Calendar } from 'lucide-react';

export default function WaiterMap() {
    const { areas, refreshData, reservations, refreshTrigger } = useRestaurant();
    const [selectedTable, setSelectedTable] = useState(null);
    const [reservationTable, setReservationTable] = useState(null);
    const [readyOrders, setReadyOrders] = useState([]); // Kept as empty to avoid undefined errors if referenced elsewhere (though logic removed) or just remove entirely if safe.
    // Actually, I should just restore the needed parts.
    const [activeAreaId, setActiveAreaId] = useState(null);
    const navigate = useNavigate();

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

            <h2 className="text-xl font-bold mb-4 text-center">Seleccione una Mesa</h2>
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
                                const isReserved = reservations.some(r => r.TableId === table.id);
                                const status = isReserved ? 'reserved' : table.status;

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

                                        {/* Reserve Button (Only if free) */}
                                        {status === 'free' && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setReservationTable(table.id); }}
                                                className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow border flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50"
                                                title="Reservar"
                                            >
                                                <Calendar size={14} />
                                            </div>
                                        )}

                                        {/* Show Reservation Time if Reserved */}
                                        {isReserved && status === 'reserved' && (
                                            <div className="absolute top-1 right-1">
                                                <Calendar size={14} className="text-purple-600" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

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
        </div>
    );
}

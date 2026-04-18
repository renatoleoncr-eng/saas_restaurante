import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';

export default function AttendanceView() {
    const { user } = useRestaurant();
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastEntry, setLastEntry] = useState(null);

    useEffect(() => {
        if (user) {
            checkStatus();
            loadHistory();
        }
    }, [user]);

    const checkStatus = async () => {
        try {
            const res = await axios.get(`/api/attendance/status/${user.id}`);
            setIsCheckedIn(res.data.isCheckedIn);
            setLastEntry(res.data.activeSession);
        } catch (err) {
            console.error(err);
        }
    };

    const loadHistory = async () => {
        try {
            // If admin, show all. If normal user, show own.
            // API handles filter based on query params or role logic.
            // Here passing userId explicitly for non-admins. 
            const query = user.role === 'admin' ? '?role=admin' : `?userId=${user.id}`;
            const res = await axios.get(`/api/attendance/list${query}`);
            setHistory(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        try {
            await axios.post('/api/attendance/check-in', { userId: user.id });
            alert('Has marcado entrada exitosamente.');
            checkStatus();
            loadHistory();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al marcar entrada');
        }
    };

    const handleCheckOut = async () => {
        try {
            await axios.post('/api/attendance/check-out', { userId: user.id });
            alert('Has marcado salida exitosamente.');
            checkStatus();
            loadHistory();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al marcar salida');
        }
    };

    if (loading) return <div className="p-8">Cargando asistencia...</div>;

    return (
        <div className="p-2 md:p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800 flex items-center gap-2">
                <Clock className="text-blue-600" /> Control de Asistencia
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* CONTROL PANEL */}
                <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center">
                    <h2 className="text-xl font-semibold mb-6 text-gray-600">
                        {isCheckedIn ? 'Sesión Activa' : 'No has marcado entrada'}
                    </h2>

                    {isCheckedIn ? (
                        <div className="w-full">
                            <div className="mb-6 text-green-600 bg-green-50 px-4 py-2 rounded-lg inline-block font-bold">
                                Entrada: {new Date(lastEntry?.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                            <button
                                onClick={handleCheckOut}
                                className="w-full py-6 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center gap-2"
                            >
                                <XCircle size={48} />
                                <span className="text-2xl font-bold">MARCAR SALIDA</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleCheckIn}
                            className="w-full py-6 bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-lg transform transition active:scale-95 flex flex-col items-center gap-2"
                        >
                            <CheckCircle size={48} />
                            <span className="text-2xl font-bold">MARCAR ENTRADA</span>
                        </button>
                    )}
                </div>

                {/* HISTORY TABLE */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg overflow-hidden">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2">
                        <Calendar size={20} /> Historial Reciente
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    {user.role === 'admin' && <th className="px-4 py-3">Empleado</th>}
                                    <th className="px-4 py-3">Entrada</th>
                                    <th className="px-4 py-3">Salida</th>
                                    <th className="px-4 py-3">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                                            No hay registros encontrados.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map(record => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {record.date}
                                            </td>
                                            {user.role === 'admin' && (
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {record.User?.displayName || record.User?.username}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-sm text-green-600 font-medium">
                                                {new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-red-600 font-medium">
                                                {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {record.checkOut ? (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">Completado</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold animate-pulse">En Turno</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

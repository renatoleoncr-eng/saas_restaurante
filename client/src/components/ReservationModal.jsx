import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { X, Calendar, User, Phone, Clock } from 'lucide-react';

export default function ReservationModal({ tableId, onClose }) {
    const { refreshData, socket } = useRestaurant();

    useEffect(() => {
        if (socket) {
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        }
        return () => {
            if (socket) {
                socket.emit('set_client_screen_mode', { mode: 'ads' });
            }
        };
    }, [socket]);
    const [form, setForm] = useState({
        customerName: '',
        contactInfo: '',
        reservationTime: '',
        notes: ''
    });

    const [history, setHistory] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const checkHistory = async () => {
        if (!form.customerName) return;
        try {
            const res = await axios.get(`/api/reservations/customer-history?name=${form.customerName}`);
            setHistory(res.data);
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            await axios.post('/api/reservations', {
                ...form,
                tableId
            });
            alert('Reserva creada con éxito');
            refreshData();
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al crear reserva');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calendar className="text-blue-600" /> Nueva Reserva - Mesa {tableId}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Cliente</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                required
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Nombre del cliente"
                                value={form.customerName}
                                onChange={e => setForm({ ...form, customerName: e.target.value })}
                                onBlur={checkHistory}
                            />
                        </div>
                        {history && history.totalInteractions > 0 && (
                            <div className="mt-1 text-xs px-2 py-1 bg-yellow-50 text-yellow-800 rounded flex items-center gap-2 animate-in fade-in">
                                <span className="font-bold">{history.visitCount} visitas previas</span>
                                {history.isFrequent && <span className="bg-yellow-200 px-1 rounded text-[10px] font-bold uppercase">Usuario Frecuente</span>}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Contacto / Teléfono</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Celular o email"
                                value={form.contactInfo}
                                onChange={e => setForm({ ...form, contactInfo: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Hora de Reserva</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                required
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={form.reservationTime}
                                onChange={e => setForm({ ...form, reservationTime: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Se liberará automáticamente tras 30 mins de retraso.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Notas</label>
                        <textarea
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Detalles especiales..."
                            rows="2"
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full text-white font-bold py-3 rounded-xl shadow-md transition-transform active:scale-95 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isLoading ? 'Creando...' : 'Confirmar Reserva'}
                    </button>
                </form>
            </div>
        </div>
    );
}

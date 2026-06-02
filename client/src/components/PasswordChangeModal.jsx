import React, { useState } from 'react';
import axios from 'axios';
import { X, Lock, Save } from 'lucide-react';
import { useRestaurant } from '../contexts/RestaurantContext';

export default function PasswordChangeModal({ targetUser, onClose }) {
    const { user } = useRestaurant();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newPin, setNewPin] = useState(targetUser.pin || '');
    const [error, setError] = useState('');

    const isSelf = user.id === targetUser.id;
    const isAdmin = user.role === 'admin';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword || confirmPassword) {
            if (newPassword !== confirmPassword) {
                setError('Las nuevas contraseñas no coinciden');
                return;
            }
        }

        if (!newPassword && newPin === (targetUser.pin || '')) {
            setError('Debe ingresar una nueva contraseña o un nuevo PIN para guardar cambios');
            return;
        }

        try {
            await axios.put(`/api/users/${targetUser.id}/password`, {
                currentPassword, // Backend will ignore if admin
                newPassword: newPassword || undefined,
                newPin: newPin || null,
                requesterRole: user.role,
                requesterId: user.id
            });
            alert('Credenciales actualizadas correctamente');
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar cambios');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <Lock size={18} /> Cambiar Contraseña: {targetUser.username}
                    </h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    {/* Only ask current password if it's the user changing their own, AND they are not admin overriding themselves (optional logic, but safer to ask) */}
                    {isSelf && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                            <input
                                type="password"
                                className="w-full border rounded p-2"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                required={!isAdmin} // Admin can bypass
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña (Dejar en blanco si no desea cambiarla)</label>
                        <input
                            type="password"
                            className="w-full border rounded p-2"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                        <input
                            type="password"
                            className="w-full border rounded p-2"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PIN de Mozo (4 dígitos, opcional)</label>
                        <input
                            type="text"
                            maxLength={4}
                            pattern="\d*"
                            placeholder="Ej: 1234"
                            className="w-full border rounded p-2"
                            value={newPin}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, ''); // only digits
                                setNewPin(val);
                            }}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2 text-sm font-medium">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                            <Save size={16} /> Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

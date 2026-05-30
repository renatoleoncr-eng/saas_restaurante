import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Edit, Trash2, Key, UserPlus, X } from 'lucide-react';
import PasswordChangeModal from './PasswordChangeModal';

export default function UserManagementModal({ onClose }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [passwordModalTarget, setPasswordModalTarget] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ username: '', password: '', displayName: '', role: 'waiter' });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar usuario permanentemente?')) return;
        try {
            await axios.delete(`/api/users/${id}`);
            loadUsers();
        } catch (err) {
            alert('Error eliminando usuario');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Update
                await axios.put(`/api/users/${editingUser.id}`, {
                    displayName: formData.displayName,
                    role: formData.role
                });
            } else {
                // Create
                await axios.post('/api/users', formData);
            }
            setShowForm(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', displayName: '', role: 'waiter' });
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Error guardando usuario');
        }
    };

    const startEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '', // Password not editable directly here
            displayName: user.displayName,
            role: user.role
        });
        setShowForm(true);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col relative">
                {/* Modal Header */}
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white rounded-t-lg">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Users size={24} /> Gestión de Usuarios
                    </h1>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-auto">
                    {loading ? (
                        <div className="text-center p-8">Cargando usuarios...</div>
                    ) : (
                        <>
                            <div className="flex justify-end mb-6">
                                <button
                                    onClick={() => { setShowForm(true); setEditingUser(null); setFormData({ username: '', password: '', displayName: '', role: 'waiter' }) }}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow"
                                >
                                    <Plus size={20} /> Nuevo Usuario
                                </button>
                            </div>

                            {/* USER FORM MODAL/INLINE */}
                            {showForm && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                            {editingUser ? <Edit size={20} /> : <UserPlus size={20} />}
                                            {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
                                        </h2>
                                        <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Usuario (Login)</label>
                                                <input
                                                    type="text"
                                                    name="username"
                                                    autoComplete="new-username"
                                                    className="w-full border p-2 rounded bg-gray-50"
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                    disabled={!!editingUser}
                                                    required
                                                />
                                            </div>

                                            {!editingUser && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Contraseña Inicial</label>
                                                    <input
                                                        type="password"
                                                        name="password"
                                                        autoComplete="new-password"
                                                        className="w-full border p-2 rounded"
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Nombre Visible</label>
                                                <input
                                                    className="w-full border p-2 rounded"
                                                    value={formData.displayName}
                                                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Rol</label>
                                                <select
                                                    className="w-full border p-2 rounded"
                                                    value={formData.role}
                                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                                >
                                                    <option value="waiter">Mesero</option>
                                                    <option value="kitchen">Cocina</option>
                                                    <option value="cashier">Cajero</option>
                                                    <option value="admin">Administrador</option>
                                                </select>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowForm(false);
                                                        setEditingUser(null);
                                                        setFormData({ username: '', password: '', displayName: '', role: 'waiter' });
                                                    }}
                                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                                >
                                                    Cancelar
                                                </button>
                                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Guardar</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* CHANGE PASSWORD COMPONENT */}
                            {passwordModalTarget && (
                                <PasswordChangeModal
                                    targetUser={passwordModalTarget}
                                    onClose={() => setPasswordModalTarget(null)}
                                />
                            )}

                            {/* USER TABLE */}
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Usuario</th>
                                            <th className="px-6 py-4">Nombre</th>
                                            <th className="px-6 py-4">Rol</th>
                                            <th className="px-6 py-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{u.username}</td>
                                                <td className="px-6 py-4 text-gray-600">{u.displayName}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'kitchen' ? 'bg-orange-100 text-orange-700' : u.role === 'cashier' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setPasswordModalTarget(u)}
                                                        title="Cambiar Contraseña"
                                                        className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                                    >
                                                        <Key size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => startEdit(u)}
                                                        title="Editar"
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(u.id)}
                                                        title="Eliminar"
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

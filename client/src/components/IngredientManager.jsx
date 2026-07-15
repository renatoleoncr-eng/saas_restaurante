import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Trash2, Edit2, Save, X, Minus, History, TrendingUp, TrendingDown } from 'lucide-react';
import AccountDetailsModal from './AccountDetailsModal'; // Import Account Modal

export default function IngredientManager({ readOnly = false, user, searchQuery = '' }) {
    const isWaiter = user?.role === 'waiter';
    const [activeTab, setActiveTab] = useState(isWaiter ? 'movements' : 'stock'); // 'stock' or 'movements'
    const [ingredients, setIngredients] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState(null); // Account selected from movements

    // Edit State
    const [isEditing, setIsEditing] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Adjustment State
    const [adjustmentItem, setAdjustmentItem] = useState(null); // { id, name, type: 'add'|'remove' }
    const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch data
    useEffect(() => {
        loadIngredients();
    }, []);

    useEffect(() => {
        if (activeTab === 'movements') {
            loadMovements();
        }
    }, [activeTab]);

    const loadIngredients = async () => {
        try {
            const res = await axios.get('/api/stock/ingredients');
            setIngredients(res.data);
        } catch (error) {
            console.error("Error loading ingredients", error);
        }
    };

    const loadMovements = async () => {
        setLoadingMovements(true);
        try {
            const res = await axios.get('/api/stock/ingredients/movements/all');
            setMovements(res.data);
        } catch (error) {
            console.error("Error loading movements", error);
        } finally {
            setLoadingMovements(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.name) return alert("Nombre requerido");
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const isEditing = !!editForm.id;
            const res = await axios.post('/api/stock/ingredients', { ...editForm, unit: 'Unidades' });

            // Optimistic update
            if (isEditing) {
                setIngredients(prev => prev.map(inv => inv.id === editForm.id ? { ...inv, ...editForm } : inv));
            } else {
                setIngredients(prev => [...prev, res.data]);
            }

            setIsEditing(null);
            setEditForm({});
            setShowCreateForm(false);
            // loadIngredients(); // Removed for instant UI performance
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || "Error al guardar ingrediente";
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Eliminar ingrediente?")) return;
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`/api/stock/ingredients/${id}`);
            loadIngredients();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Stock Adjustment Logic
    const openAdjustment = (item, type) => {
        setAdjustmentItem({ ...item, type });
        setAdjustmentForm({ amount: '', reason: '' });
    };

    const handleAdjustmentSubmit = async () => {
        if (!adjustmentForm.amount || parseFloat(adjustmentForm.amount) <= 0) return alert("Cantidad inválida");
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await axios.post(`/api/stock/ingredients/${adjustmentItem.id}/movement`, {
                type: adjustmentItem.type,
                amount: adjustmentForm.amount,
                reason: adjustmentForm.reason || (adjustmentItem.type === 'add' ? 'Compra Manual' : 'Ajuste Manual'),
                userId: user?.id
            });

            setAdjustmentItem(null);
            loadIngredients(); // Refresh stock
            if (activeTab === 'movements') loadMovements(); // Refresh logs if visible (though tab change triggers it)
        } catch (err) {
            console.error(err);
            alert("Error ajustando stock");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle Form State
    const [showCreateForm, setShowCreateForm] = useState(false);

    return (
        <div className="bg-white rounded-lg shadow p-2 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 md:mb-6 gap-4">
                {/* Tabs - Full width on mobile */}
                <div className="flex w-full md:w-auto bg-gray-100 p-1 rounded-lg">
                    {!isWaiter && (
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all text-center ${activeTab === 'stock' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Stock Actual
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all text-center ${activeTab === 'movements' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Movimientos
                    </button>
                </div>
            </div>

            {/* TAB: STOCK */}
            {activeTab === 'stock' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Add New Row Toggle */}
                    {!readOnly && (
                        <div className="mb-6">
                            {!showCreateForm ? (
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                                >
                                    <Plus size={18} /> Crear Insumo
                                </button>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-2 p-4 bg-orange-50 rounded-lg border border-orange-100 animate-in fade-in">
                                    <input
                                        placeholder="Nombre Insumo (ej. Limón)"
                                        className="border p-2 rounded flex-1 focus:ring-2 focus:ring-orange-200 outline-none"
                                        value={editForm.id ? '' : editForm.name || ''}
                                        onChange={e => !editForm.id && setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Stock Initial"
                                            className="border p-2 rounded w-full focus:ring-2 focus:ring-orange-200 outline-none"
                                            value={editForm.id ? '' : editForm.stock || ''}
                                            onChange={e => !editForm.id && setEditForm({ ...editForm, stock: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSave} disabled={isSubmitting} className="bg-orange-600 text-white px-4 py-2 md:py-0 rounded hover:bg-orange-700 font-bold flex items-center justify-center gap-2 flex-1 md:flex-none">
                                            <Save size={18} /> {isSubmitting ? 'Guardando...' : 'Guardar'}
                                        </button>
                                        <button onClick={() => setShowCreateForm(false)} className="bg-gray-200 text-gray-600 px-4 py-2 md:py-0 rounded hover:bg-gray-300 font-bold flex items-center justify-center gap-2">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-3 text-gray-600 font-bold">Nombre</th>
                                    <th className="text-left p-3 text-gray-600 font-bold">Stock Actual</th>
                                    {!readOnly && <th className="text-right p-3 text-gray-600 font-bold">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {ingredients.filter(item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                                        {isEditing === item.id ? (
                                            <>
                                                <td className="p-3"><input className="border p-1 w-full rounded" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                                                <td className="p-3"><span className="text-gray-400 text-sm">Use +/- para ajustar</span></td>
                                                <td className="p-3 text-right">
                                                    <button onClick={handleSave} disabled={isSubmitting} className="text-green-600 mr-2 hover:bg-green-50 p-1 rounded"><Save size={18} /></button>
                                                    <button onClick={() => { setIsEditing(null); setEditForm({}); }} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={18} /></button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                                <td className="p-3">
                                                    <span className={`font-bold px-2 py-1 rounded ${parseFloat(item.stock) <= 5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
                                                        {Number(parseFloat(item.stock).toFixed(1))}
                                                    </span>
                                                </td>
                                                {!readOnly && !isWaiter && (
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end items-center gap-1">
                                                            {/* Stock Actions */}
                                                            <button
                                                                onClick={() => openAdjustment(item, 'add')}
                                                                className="bg-green-100 text-green-700 hover:bg-green-200 p-1.5 rounded flex items-center gap-1 text-xs font-bold mr-2 border border-green-200"
                                                                title="Agregar Stock (Compra)"
                                                            >
                                                                <Plus size={14} /> Agregar
                                                            </button>
                                                            <button
                                                                onClick={() => openAdjustment(item, 'remove')}
                                                                className="bg-red-100 text-red-700 hover:bg-red-200 p-1.5 rounded flex items-center gap-1 text-xs font-bold mr-4 border border-red-200"
                                                                title="Eliminar Stock (Merma/Consumo)"
                                                            >
                                                                <Minus size={14} /> Eliminar
                                                            </button>
                                                            {/* Edit/Delete */}
                                                            <button onClick={() => { setIsEditing(item.id); setEditForm(item); }} disabled={isSubmitting} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDelete(item.id)} disabled={isSubmitting} className="text-red-400 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: MOVEMENTS */}
            {activeTab === 'movements' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[800px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-3 text-gray-600 font-bold">Fecha</th>
                                    <th className="text-left p-3 text-gray-600 font-bold">Insumo</th>
                                    <th className="text-left p-3 text-gray-600 font-bold">Acción</th>
                                    <th className="text-right p-3 text-gray-600 font-bold">Cantidad</th>
                                    <th className="text-center p-3 text-gray-600 font-bold">Cuenta</th>
                                    <th className="text-left p-3 text-gray-600 font-bold pl-8">Razón</th>
                                    <th className="text-left p-3 text-gray-600 font-bold">Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingMovements ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500">Cargando movimientos...</td></tr>
                                ) : movements.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500 italic">No hay movimientos registrados.</td></tr>
                                ) : (
                                    movements.map(mov => {
                                        const isAdd = mov.type === 'add' || mov.type === 'correction' && parseFloat(mov.newStock) > parseFloat(mov.previousStock);
                                        const isSale = mov.type === 'sale';

                                        return (
                                            <tr key={mov.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 text-gray-500 whitespace-nowrap text-xs">
                                                    {new Date(mov.createdAt).toLocaleString()}
                                                </td>
                                                <td className="p-3 font-medium text-gray-800 text-sm">{mov.Ingredient?.name || 'Unknown'}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit
                                                        ${mov.type === 'add' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                        ${mov.type === 'remove' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                                        ${mov.type === 'sale' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                        ${!['add', 'remove', 'sale'].includes(mov.type) ? 'bg-gray-100 text-gray-800 border-gray-200' : ''}
                                                    `}>
                                                        {mov.type === 'add' && <TrendingUp size={12} />}
                                                        {mov.type === 'remove' && <TrendingDown size={12} />}
                                                        {mov.type === 'sale' && <Package size={12} />}
                                                        {mov.type === 'add' ? 'Ingreso' : mov.type === 'remove' ? 'Salida' : mov.type === 'sale' ? 'Venta' : mov.type === 'correction' ? 'Corrección' : mov.type}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono text-sm">
                                                    {isAdd ? '+' : '-'}{Number(parseFloat(mov.amount).toFixed(1))} {mov.Ingredient?.unit}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {mov.AccountId || mov.Account ? (
                                                        <button
                                                            onClick={() => setSelectedAccountId(mov.AccountId || mov.Account?.id)}
                                                            title={mov.Account?.accountType === 'staff' ? 'Cuenta de Staff' : 'Ver Cuenta'}
                                                            className={`px-2 py-0.5 rounded text-xs font-bold ${mov.Account?.accountType === 'staff'
                                                                ? 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                                                                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'} transition-colors`}
                                                        >
                                                            #{mov.AccountId || mov.Account?.id}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs text-center block">---</span>
                                                    )}
                                                </td>
                                                <td className="p-3 pl-8 text-gray-600 text-xs">{mov.reason || '-'}</td>
                                                <td className="p-3 text-gray-500 text-xs">{mov.User?.displayName || 'Sistema'}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ADJUSTMENT MODAL */}
            {adjustmentItem && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className={`p-4 border-b flex justify-between items-center ${adjustmentItem.type === 'add' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <h3 className={`font-bold text-lg flex items-center gap-2 ${adjustmentItem.type === 'add' ? 'text-green-800' : 'text-red-800'}`}>
                                {adjustmentItem.type === 'add' ? <Plus size={20} /> : <Minus size={20} />}
                                {adjustmentItem.type === 'add' ? 'Agregar Stock' : 'Eliminar Stock'}
                            </h3>
                            <button onClick={() => setAdjustmentItem(null)} className="p-2 hover:bg-white/50 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Insumo</label>
                                <div className="text-gray-900 font-medium text-lg">{adjustmentItem.name}</div>
                                <div className="text-sm text-gray-500">Stock Actual: {adjustmentItem.stock} {adjustmentItem.unit}</div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Cantidad a {adjustmentItem.type === 'add' ? 'Agregar' : 'Eliminar'}
                                </label>
                                <input
                                    type="number"
                                    autoFocus
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 text-lg focus:border-blue-500 outline-none"
                                    placeholder="0.00"
                                    value={adjustmentForm.amount}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Razón / Motivo</label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                                    placeholder={adjustmentItem.type === 'add' ? "Ej. Compra semanal" : "Ej. Vencimiento, Merma"}
                                    value={adjustmentForm.reason}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleAdjustmentSubmit}
                                disabled={isSubmitting}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg mt-2 transition-opacity
                                    ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${adjustmentItem.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {isSubmitting ? 'Procesando...' : `Confirmar ${adjustmentItem.type === 'add' ? 'Ingreso' : 'Salida'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ACCOUNT DETAIL MODAL */}
            {selectedAccountId && (
                <AccountDetailsModal
                    accountId={selectedAccountId}
                    onClose={() => setSelectedAccountId(null)}
                />
            )}
        </div>
    );
}

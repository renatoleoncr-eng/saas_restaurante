import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Save, X, Wine, ChefHat } from 'lucide-react';
import RecipeModal from './RecipeModal';

const TYPE_LABEL = { free: 'Libre', finished: 'Terminado', prepared: 'Preparado (Carta)' };
const TYPE_COLOR = {
    free: 'bg-gray-100 text-gray-500',
    finished: 'bg-blue-100 text-blue-700',
    prepared: 'bg-amber-100 text-amber-700'
};

/* ────────────────────────────────────────────────────────────── */
/* Inline row for adding a new item inside a promo section        */
function NewItemRow({ promoId, allProducts, onSave, onCancel }) {
    const [form, setForm] = useState({ name: '', individualPrice: '', type: 'free', linkedProductId: '' });
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.name.trim()) return;
        await onSave(promoId, {
            name: form.name.trim(),
            individualPrice: parseFloat(form.individualPrice) || 0,
            type: form.type,
            linkedProductId: form.linkedProductId ? parseInt(form.linkedProductId) : null
        });
    };

    return (
        <tr className="bg-purple-50 border-y border-purple-100">
            <td colSpan={5} className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="flex-1">
                        <label className="block md:hidden text-[10px] font-bold text-purple-700 uppercase mb-1">Nombre</label>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nombre del trago"
                            className="border border-purple-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-purple-400 outline-none bg-white font-semibold"
                            value={form.name}
                            onChange={e => upd('name', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block md:hidden text-[10px] font-bold text-purple-700 uppercase mb-1">Precio Individual</label>
                        <div className="flex items-center gap-1 border border-purple-200 rounded-lg px-3 py-2 bg-white text-sm">
                            <span className="text-gray-400">S/</span>
                            <input
                                type="number" step="0.01" placeholder="0.00"
                                className="w-full outline-none font-bold"
                                value={form.individualPrice}
                                onChange={e => upd('individualPrice', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block md:hidden text-[10px] font-bold text-purple-700 uppercase mb-1">Tipo</label>
                        <select
                            className="border border-purple-200 rounded-lg px-3 py-2 text-sm w-full bg-white outline-none focus:ring-2 focus:ring-purple-400"
                            value={form.type}
                            onChange={e => upd('type', e.target.value)}
                        >
                            <option value="free">Libre (sin stock)</option>
                            <option value="finished">Terminado</option>
                            <option value="prepared">Preparado (Carta)</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        {form.type !== 'free' && (
                            <label className="block md:hidden text-[10px] font-bold text-purple-700 uppercase mb-1">
                                {form.type === 'finished' ? 'Producto Vinculado' : 'Receta Vinculada'}
                            </label>
                        )}
                        {form.type === 'finished' ? (
                            <select
                                className="border border-purple-200 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                value={form.linkedProductId}
                                onChange={e => upd('linkedProductId', e.target.value)}
                            >
                                <option value="">— Seleccionar Producto —</option>
                                {allProducts
                                    .filter(p => !p.requiresPreparation)
                                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : form.type === 'prepared' ? (
                            <select
                                className="border border-purple-200 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                value={form.linkedProductId}
                                onChange={e => upd('linkedProductId', e.target.value)}
                            >
                                <option value="">— Seleccionar Receta —</option>
                                {allProducts
                                    .filter(p => p.requiresPreparation)
                                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : (
                            <span className="hidden md:inline text-xs text-gray-400 italic">No aplica</span>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end pt-2 md:pt-0">
                        <button onClick={handleSave}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 shadow-sm transition-colors">
                            Guardar
                        </button>
                        <button onClick={onCancel}
                            className="bg-white hover:bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold border transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    );
}

/* ────────────────────────────────────────────────────────────── */
/* Inline edit row for an existing item                           */
function EditItemRow({ item, allProducts, onSave, onCancel }) {
    const [form, setForm] = useState({
        name: item.name,
        individualPrice: item.individualPrice ?? '',
        type: item.type ?? 'free',
        linkedProductId: item.linkedProductId ?? ''
    });
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = () => onSave(item.id, {
        name: form.name.trim(),
        individualPrice: parseFloat(form.individualPrice) || 0,
        type: form.type,
        linkedProductId: form.linkedProductId ? parseInt(form.linkedProductId) : null
    });

    return (
        <tr className="bg-blue-50 border-y border-blue-100">
            <td colSpan={5} className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="flex-1">
                        <label className="block md:hidden text-[10px] font-bold text-blue-700 uppercase mb-1">Nombre</label>
                        <input autoFocus type="text"
                            className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-400 outline-none bg-white font-semibold"
                            value={form.name}
                            onChange={e => upd('name', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block md:hidden text-[10px] font-bold text-blue-700 uppercase mb-1">Precio Individual</label>
                        <div className="flex items-center gap-1 border border-blue-200 rounded-lg px-3 py-2 bg-white text-sm">
                            <span className="text-gray-400">S/</span>
                            <input type="number" step="0.01"
                                className="w-full outline-none font-bold"
                                value={form.individualPrice}
                                onChange={e => upd('individualPrice', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block md:hidden text-[10px] font-bold text-blue-700 uppercase mb-1">Tipo</label>
                        <select className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-full bg-white outline-none focus:ring-2 focus:ring-blue-400" value={form.type}
                            onChange={e => upd('type', e.target.value)}>
                            <option value="free">Libre (sin stock)</option>
                            <option value="finished">Terminado</option>
                            <option value="prepared">Preparado (Carta)</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        {form.type !== 'free' && (
                            <label className="block md:hidden text-[10px] font-bold text-blue-700 uppercase mb-1">
                                {form.type === 'finished' ? 'Producto Vinculado' : 'Receta Vinculada'}
                            </label>
                        )}
                        {form.type === 'finished' ? (
                            <select className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-400 bg-white" value={form.linkedProductId || ''}
                                onChange={e => upd('linkedProductId', e.target.value)}>
                                <option value="">— Seleccionar Producto —</option>
                                {allProducts
                                    .filter(p => !p.requiresPreparation)
                                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : form.type === 'prepared' ? (
                            <select className="border border-blue-200 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-amber-400 bg-white" value={form.linkedProductId || ''}
                                onChange={e => upd('linkedProductId', e.target.value)}>
                                <option value="">— Seleccionar Receta —</option>
                                {allProducts
                                    .filter(p => p.requiresPreparation)
                                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        ) : (
                            <span className="hidden md:inline text-xs text-gray-400 italic">No aplica</span>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end pt-2 md:pt-0">
                        <button onClick={handleSave}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 shadow-sm transition-colors">
                            Guardar
                        </button>
                        <button onClick={onCancel}
                            className="bg-white hover:bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold border transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    );
}

/* ────────────────────────────────────────────────────────────── */
/* Main Component                                                  */
export default function DrinkPromotionsConfig() {
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allProducts, setAllProducts] = useState([]);

    // Promo being edited (id, name, price)
    const [editingPromo, setEditingPromo] = useState(null);
    // New promo inline form
    const [showNewPromoForm, setShowNewPromoForm] = useState(false);
    const [newPromoForm, setNewPromoForm] = useState({ name: '', price: '' });

    // Which promo section has the add-item row open
    const [addingItemTo, setAddingItemTo] = useState(null);
    // Item being edited (full item object)
    const [editingItem, setEditingItem] = useState(null);

    // Recipe modal state
    const [recipeProduct, setRecipeProduct] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [promoRes, prodRes] = await Promise.all([
                axios.get('/api/drink-promotions'),
                axios.get('/api/products')
            ]);
            setPromotions(promoRes.data);
            // Only stock-managed products make sense to link
            setAllProducts(prodRes.data);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── PROMO CRUD ──────────────────────────────────────────────
    const createPromo = async () => {
        if (!newPromoForm.name.trim() || !newPromoForm.price) return;
        await axios.post('/api/drink-promotions', {
            name: newPromoForm.name.trim(),
            price: parseFloat(newPromoForm.price)
        });
        setNewPromoForm({ name: '', price: '' });
        setShowNewPromoForm(false);
        loadData();
    };

    const saveEditPromo = async () => {
        if (!editingPromo) return;
        await axios.put(`/api/drink-promotions/${editingPromo.id}`, {
            name: editingPromo.name,
            price: parseFloat(editingPromo.price)
        });
        setEditingPromo(null);
        loadData();
    };

    const deletePromo = async (promo) => {
        if (promo.DrinkPromotionItems && promo.DrinkPromotionItems.length > 0) {
            alert("No se puede eliminar la categoría porque contiene tragos asociados. Debe eliminar todos los tragos de esta categoría primero.");
            return;
        }
        if (!window.confirm(`¿Seguro que desea eliminar la categoría "${promo.name}"?`)) return;
        try {
            await axios.delete(`/api/drink-promotions/${promo.id}`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || "Error al eliminar categoría");
        }
    };

    // ── ITEM CRUD ───────────────────────────────────────────────
    const createItem = async (promoId, data) => {
        await axios.post(`/api/drink-promotions/${promoId}/items`, data);
        setAddingItemTo(null);
        loadData();
    };

    const saveEditItem = async (itemId, data) => {
        await axios.put(`/api/drink-promotions/items/${itemId}`, data);
        setEditingItem(null);
        loadData();
    };

    const deleteItem = async (itemId) => {
        await axios.delete(`/api/drink-promotions/items/${itemId}`);
        loadData();
    };

    // ────────────────────────────────────────────────────────────
    if (loading) return <div className="p-8 text-center text-gray-400">Cargando...</div>;

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6">

            {/* Page header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-xl"><Wine className="text-purple-600" size={22} /></div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Promociones 2x1</h1>
                    </div>
                </div>
                <button
                    onClick={() => { setShowNewPromoForm(true); setAddingItemTo(null); setEditingPromo(null); }}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-sm text-sm"
                >
                    <Plus size={16} /> Categoría
                </button>
            </div>

            {/* ── Inline new-promo form ── */}
            {showNewPromoForm && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Nombre de la categoría  (ej: 2x S/ 34.90)"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none min-w-[200px]"
                        value={newPromoForm.name}
                        onChange={e => setNewPromoForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && createPromo()}
                    />
                    <div className="flex items-center gap-1 border rounded-lg px-3 py-2 bg-white">
                        <span className="text-gray-400 text-sm">Precio combo S/</span>
                        <input
                            type="number" step="0.01" placeholder="0.00"
                            className="w-24 text-sm outline-none font-bold"
                            value={newPromoForm.price}
                            onChange={e => setNewPromoForm(f => ({ ...f, price: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && createPromo()}
                        />
                    </div>
                    <button onClick={createPromo}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700">
                        Crear
                    </button>
                    <button onClick={() => setShowNewPromoForm(false)}
                        className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-300">
                        Cancelar
                    </button>
                </div>
            )}

            {/* ── Empty state ── */}
            {promotions.length === 0 && !showNewPromoForm && (
                <div className="text-center py-16 text-gray-400">
                    <Wine size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Aún no hay categorías. Crea la primera con el botón de arriba.</p>
                </div>
            )}

            {/* ── Promotion sections (always expanded, like Opciones Menú) ── */}
            {promotions.map(promo => (
                <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Section header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
                        {editingPromo?.id === promo.id ? (
                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                                <input
                                    autoFocus
                                    type="text"
                                    className="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[150px] focus:ring-2 focus:ring-purple-400 outline-none font-bold"
                                    value={editingPromo.name}
                                    onChange={e => setEditingPromo(p => ({ ...p, name: e.target.value }))}
                                />
                                <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-white">
                                    <span className="text-gray-400 text-sm">S/</span>
                                    <input type="number" step="0.01"
                                        className="w-20 text-sm outline-none font-bold"
                                        value={editingPromo.price}
                                        onChange={e => setEditingPromo(p => ({ ...p, price: e.target.value }))}
                                    />
                                </div>
                                <button onClick={saveEditPromo}
                                    className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600"><Save size={14} /></button>
                                <button onClick={() => setEditingPromo(null)}
                                    className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300"><X size={14} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Wine size={18} className="text-purple-500" />
                                <span className="bg-purple-100 text-purple-700 text-sm font-black px-4 py-1.5 rounded-full shadow-sm">
                                    {promo.name}
                                </span>
                            </div>
                        )}

                        {/* Right-side actions */}
                        {editingPromo?.id !== promo.id && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setEditingPromo({ id: promo.id, name: promo.name, price: promo.price })}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar categoría">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => deletePromo(promo)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar categoría">
                                    <Trash2 size={18} />
                                </button>
                                {/* The "+" button — matches Opciones Menú UX */}
                                <button
                                    onClick={() => { setAddingItemTo(promo.id); setEditingItem(null); }}
                                    className="ml-1 bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 shadow-sm" title="Agregar trago">
                                    <Plus size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Items table */}
                    <table className="w-full text-base md:text-sm table-fixed">
                        <thead>
                            <tr className="text-xs md:text-xs text-gray-500 font-black uppercase tracking-wider border-b bg-gray-50/80">
                                <th className="px-3 py-3 md:px-4 md:py-2.5 text-left">Nombre</th>
                                <th className="px-3 py-3 md:px-4 md:py-2.5 text-left w-28 md:w-auto">Precio</th>
                                <th className="hidden md:table-cell px-4 py-2.5 text-left">Tipo</th>
                                <th className="hidden md:table-cell px-4 py-2.5 text-left">Vinculado a</th>
                                <th className="px-3 py-3 md:px-4 md:py-2.5 text-right w-24 md:w-auto"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(promo.DrinkPromotionItems || []).length === 0 && addingItemTo !== promo.id && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-gray-400 italic text-sm">
                                        Sin tragos aún — presiona <strong>+</strong> para agregar
                                    </td>
                                </tr>
                            )}

                            {(promo.DrinkPromotionItems || []).map(item => (
                                editingItem?.id === item.id ? (
                                    <EditItemRow
                                        key={item.id}
                                        item={editingItem}
                                        allProducts={allProducts}
                                        onSave={saveEditItem}
                                        onCancel={() => setEditingItem(null)}
                                    />
                                ) : (
                                    <tr key={item.id} className="border-b border-dashed hover:bg-gray-50/50 group transition-colors">
                                        <td className="px-3 py-4 md:px-4 md:py-3 font-semibold text-gray-800">
                                            <div className="text-base md:text-sm font-bold text-gray-900 leading-snug">{item.name}</div>
                                            <div className="md:hidden mt-2 flex flex-wrap gap-1.5 items-center">
                                                <span className={`text-[10px] md:text-[9px] px-2 py-0.5 rounded-full font-bold ${TYPE_COLOR[item.type] || TYPE_COLOR.free}`}>
                                                    {TYPE_LABEL[item.type] || item.type}
                                                </span>
                                                {item.type === 'finished' && (
                                                    <span className="text-blue-600 text-[10px] md:text-[9px] font-bold">
                                                        {allProducts.find(p => p.id === item.linkedProductId)?.name || '— Sin vincular —'}
                                                    </span>
                                                )}
                                                {item.type === 'prepared' && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-amber-600 text-[10px] md:text-[9px] font-bold">
                                                            {allProducts.find(p => p.id === item.linkedProductId)?.name || '— Sin receta —'}
                                                        </span>
                                                        {item.linkedProductId && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const p = allProducts.find(prod => prod.id === item.linkedProductId);
                                                                    if (p) setRecipeProduct(p);
                                                                }}
                                                                className="p-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition-colors"
                                                                title="Ver Receta"
                                                            >
                                                                <ChefHat size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 md:px-4 md:py-3 text-gray-950 font-mono font-black text-base md:text-sm">
                                            S/ {Number(parseFloat(item.individualPrice ?? 0).toFixed(2))}
                                        </td>
                                        <td className="hidden md:table-cell px-4 py-2.5">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLOR[item.type] || TYPE_COLOR.free}`}>
                                                {TYPE_LABEL[item.type] || item.type}
                                            </span>
                                        </td>
                                        <td className="hidden md:table-cell px-4 py-2.5">
                                            {item.type === 'finished' ? (
                                                <span className="text-blue-600 text-xs font-medium">
                                                    {allProducts.find(p => p.id === item.linkedProductId)?.name || '— Sin vincular —'}
                                                </span>
                                            ) : item.type === 'prepared' ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-600 text-xs font-medium">
                                                        {allProducts.find(p => p.id === item.linkedProductId)?.name || '— Sin receta —'}
                                                    </span>
                                                    {item.linkedProductId && (
                                                        <button
                                                            onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const p = allProducts.find(prod => prod.id === item.linkedProductId);
                                                                    if (p) setRecipeProduct(p);
                                                            }}
                                                            className="p-1 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition-colors"
                                                            title="Gestionar Receta"
                                                        >
                                                            <ChefHat size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-4 md:px-4 md:py-3">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button onClick={() => { setEditingItem({ ...item }); setAddingItemTo(null); }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => deleteItem(item.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            ))}

                            {/* Inline add-item row */}
                            {addingItemTo === promo.id && (
                                <NewItemRow
                                    promoId={promo.id}
                                    allProducts={allProducts}
                                    onSave={createItem}
                                    onCancel={() => setAddingItemTo(null)}
                                />
                            )}
                        </tbody>
                    </table>

                    {/* Footer quick-add link (secondary affordance) */}
                    {addingItemTo !== promo.id && (
                        <button
                            onClick={() => { setAddingItemTo(promo.id); setEditingItem(null); }}
                            className="w-full py-3.5 text-sm font-extrabold text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-1 transition-colors border-t border-dashed border-purple-100"
                        >
                            <Plus size={16} /> Agregar trago a esta categoría
                        </button>
                    )}
                </div>
            ))}

            {/* Recipe Modal Overlay */}
            {recipeProduct && (
                <RecipeModal
                    product={recipeProduct}
                    onClose={() => setRecipeProduct(null)}
                />
            )}
        </div>
    );
}

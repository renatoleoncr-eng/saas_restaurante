import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext'; // Import context
import { Calendar, Save, List, Info, Plus, Trash2, Utensils, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import AccountDetailsModal from './AccountDetailsModal'; // Import Account Modal

// Helper to generate unique IDs
const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function MenuConfig({ forcedTab = null, showTabs = true }) {
    const { refreshData } = useRestaurant(); // Get refresh trigger
    const getLocalDate = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        return new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
    };
    const [date, setDate] = useState(getLocalDate());
    // menuGroups: Array of { id, name: "Menu del Día", entries: [], mains: [] }
    const [menuGroups, setMenuGroups] = useState([
        { id: 1, name: 'Menú del Día', price: 0, entries: [], mains: [] }
    ]);
    const [activeGroupId, setActiveGroupId] = useState(1);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]); // Real products for linking

    const [activeTab, setActiveTab] = useState(() => {
        if (forcedTab) return forcedTab;
        return localStorage.getItem('menu_activeTab') || 'config';
    }); // 'config' | 'movements'
    const [movements, setMovements] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState(null); // Account selected from movements
    const [searchingCategory, setSearchingCategory] = useState(null); // 'entries' | 'mains' | null
    const [editItemIndex, setEditItemIndex] = useState(null); // number | null
    const [menuSearchQuery, setMenuSearchQuery] = useState('');

    useEffect(() => {
        if (activeTab && !forcedTab) {
            localStorage.setItem('menu_activeTab', activeTab);
        }
    }, [activeTab, forcedTab]);

    useEffect(() => {
        if (forcedTab) setActiveTab(forcedTab);
    }, [forcedTab]);

    useEffect(() => {
        if (activeTab === 'config') loadData();
        else loadMovements();
    }, [date, activeTab]);

    const loadMovements = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/menu/sales'); // Fetch structured sales instead of raw movements
            setMovements(res.data);
        } catch (error) {
            console.error("Error loading menu movements:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [date]);


    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Products for linking (Include ALL inventory products)
            const prodRes = await axios.get('/api/products');
            const dishes = prodRes.data.filter(p =>
                p.type === 'daily_entry' ||
                p.type === 'daily_main' ||
                p.type === 'product' ||
                p.type === 'finished'
            );
            setProducts(dishes);

            // 2. Fetch Daily Menu
            const res = await axios.get(`/api/menu/daily?date=${date}`);
            const data = res.data;

            if (data && data.entries && data.entries.length > 0) {
                // Heuristic: If entries[0] has 'groupName' or check if it's the new structure
                // Logic: We stored EVERYTHING in 'entries' as a flat list with 'groupName'.
                // So now we reconstruct the Groups.

                const allItems = [...data.entries, ...(data.mains || [])]; // Fix: Read both arrays

                // If legacy (no groupName), assume "Menú del Día"
                let groups = [];

                // Group by 'groupName'
                const grouped = {};
                allItems.forEach(item => {
                    // ENSURE ID EXISTS (Backward Compatibility)
                    if (!item.id) {
                        item.id = generateId();
                    }
                    const gName = item.groupName || 'Menú del Día';
                    if (!grouped[gName]) grouped[gName] = { entries: [], mains: [] };

                    if (item.category === 'main') {
                        grouped[gName].mains.push(item);
                    } else {
                        grouped[gName].entries.push(item);
                    }
                });

                groups = Object.keys(grouped).map((name, idx) => {
                    const firstItem = grouped[name].entries[0] || grouped[name].mains[0];
                    const price = firstItem ? (firstItem.menuPrice || 0) : 0;
                    return {
                        id: idx + 1,
                        name,
                        price,
                        entries: grouped[name].entries,
                        mains: grouped[name].mains
                    };
                });

                if (groups.length === 0) {
                    groups = [{ id: 1, name: 'Menú del Día', price: 0, entries: [], mains: [] }];
                }
                setMenuGroups(groups);
                setActiveGroupId(groups[0].id);

            } else {
                // Reset
                setMenuGroups([{ id: 1, name: 'Menú del Día', price: 0, entries: [], mains: [] }]);
            }

        } catch (error) {
            console.error("Error loading daily menu:", error);
        } finally {
            setLoading(false);
        }
    };

    const getTheoreticalMaxStock = (productId) => {
        if (!productId) return null;
        const prod = products.find(p => p.id === parseInt(productId));
        if (!prod) return null;

        // NEW: Check if it's a menu option linked to a finished product
        if ((prod.type === 'daily_entry' || prod.type === 'daily_main') && prod.linkedProductId) {
            return getTheoreticalMaxStock(prod.linkedProductId);
        }

        if (prod.Recipes && prod.Recipes.length > 0) {
            let minStock = Infinity;
            prod.Recipes.forEach(recipe => {
                if (recipe.Ingredient) {
                    const avail = Math.floor(parseFloat(recipe.Ingredient.stock) / parseFloat(recipe.quantity) || 0);
                    minStock = Math.min(minStock, avail);
                }
            });
            return minStock === Infinity ? null : minStock;
        } else if (prod.isStockManaged) {
            // Check if product has variants - sum their stock
            if (prod.ProductVariants && prod.ProductVariants.length > 0) {
                const totalVariantStock = prod.ProductVariants.reduce((sum, v) => sum + parseInt(v.stock || 0), 0);
                return totalVariantStock;
            }
            return parseInt(prod.stock) || 0;
        }
        return null;
    };

    const handleSave = async () => {
        try {
            // Flatten groups into a single list for storage
            // Schema: { name, stock, groupName, category, linkId }
            let flatList = [];
            const allItems = [];
            menuGroups.forEach(g => {
                if (g.entries) allItems.push(...g.entries);
                if (g.mains) allItems.push(...g.mains);
            });

            // VALIDATION: Price > 0
            if (activeGroup.price <= 0) {
                return alert("El precio del menú debe ser mayor a 0.");
            }

            for (const item of allItems) {
                if (!item.linkId) {
                    return alert(`Debe seleccionar una opción para todos los platos del menú.`);
                }
            }

            menuGroups.forEach(group => {
                const cleanEntries = group.entries
                    .filter(e => e.name.trim() !== '')
                    .map(e => ({ ...e, stock: 9999, groupName: group.name, menuPrice: group.price, category: 'entry' }));

                const cleanMains = group.mains
                    .filter(m => m.name.trim() !== '')
                    .map(m => ({ ...m, stock: 9999, groupName: group.name, menuPrice: group.price, category: 'main' }));

                flatList = [...flatList, ...cleanEntries, ...cleanMains];
            });

            // We save EVERYTHING into 'entries' column. 'mains' will be empty array.
            await axios.post('/api/menu/daily', {
                date,
                entries: flatList,
                mains: []
            });

            // Trigger Global Refresh to update POS Products
            if (refreshData) refreshData();

            alert('Configuración guardada correctamente');
        } catch (error) {
            console.error("Error saving menu:", error);
            alert('Error guardando configuración');
        }
    };

    // ITEM OPERATIONS
    const addItem = (category) => {
        setMenuGroups(prev => prev.map(g => {
            if (g.id === activeGroupId) {
                return {
                    ...g,
                    [category]: [...g[category], { id: generateId(), name: '', stock: 9999, linkId: null }]
                };
            }
            return g;
        }));
    };

    const updateItem = (category, index, field, value) => {
        setMenuGroups(prev => prev.map(g => {
            if (g.id === activeGroupId) {
                const newList = [...g[category]];

                // Special logic for Linking Product
                if (field === 'linkId') {
                    if (value) {
                        const prod = products.find(p => p.id === parseInt(value));
                        if (prod) {
                            newList[index] = {
                                ...newList[index],
                                linkId: prod.id,
                                name: prod.name,
                                stock: 9999 // Let physical limit govern
                            };
                        }
                    } else {
                        // Unlink
                        newList[index] = { ...newList[index], linkId: null, stock: 9999 };
                    }
                } else if (field === 'name') {
                    // If changing name manually, unlink? Optional. Let's keep it simple.
                    newList[index] = { ...newList[index], [field]: value };
                } else {
                    newList[index] = { ...newList[index], [field]: value };
                }

                return { ...g, [category]: newList };
            }
            return g;
        }));
    };

    const deleteItem = (category, index) => {
        setMenuGroups(prev => prev.map(g => {
            if (g.id === activeGroupId) {
                const newList = g[category].filter((_, i) => i !== index);
                return { ...g, [category]: newList };
            }
            return g;
        }));
    };

    // GROUP OPERATIONS
    const addGroup = () => {
        const newId = Math.max(...menuGroups.map(g => g.id), 0) + 1;
        setMenuGroups([...menuGroups, { id: newId, name: 'Nuevo Menú', price: 0, entries: [], mains: [] }]);
        setActiveGroupId(newId);
    };

    const updateGroupName = (name) => {
        setMenuGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, name } : g));
    };

    const removeGroup = (id) => {
        if (menuGroups.length === 1) return alert("Debe haber al menos un menú.");
        if (confirm("¿Eliminar este grupo de menú?")) {
            const newGroups = menuGroups.filter(g => g.id !== id);
            setMenuGroups(newGroups);
            if (activeGroupId === id) setActiveGroupId(newGroups[0].id);
        }
    };

    const activeGroup = menuGroups.find(g => g.id === activeGroupId);

    // Extracted ItemList to helper component (defined below) or keep here but MEMOIZED?
    // Better: define outside.
    // We need to pass: title, list, category, icon, colorClass, products, updateItem, deleteItem

    return (
        <div className="p-2 md:p-6 w-full max-w-full mx-auto">


            {activeTab === 'config' ? (
                <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border mb-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <label className="font-bold text-gray-700">Fecha:</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="border p-2 rounded font-medium flex-1 md:flex-none"
                            />
                        </div>
                    </div>

                    {/* TABS FOR MENU GROUPS */}
                    <div className="flex gap-2 border-b mb-6 overflow-x-auto pb-1">
                        {menuGroups.map(group => (
                            <div key={group.id} className="flex items-center shrink-0">
                                <button
                                    onClick={() => setActiveGroupId(group.id)}
                                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors border-t border-l border-r ${activeGroupId === group.id ? 'bg-blue-50 border-b-white text-blue-700' : 'bg-gray-50 border-b text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {group.name}
                                </button>
                            </div>
                        ))}
                        <button onClick={addGroup} className="px-3 py-2 text-gray-400 hover:text-blue-600 border-b border-transparent">
                            <Plus size={20} />
                        </button>
                    </div>

                    {/* ACTIVE GROUP EDITOR */}
                    {activeGroup && (
                        <div className="animate-in fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 w-full">
                                    <div className="flex flex-col gap-1 w-full md:w-auto">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Nombre:</span>
                                        <input
                                            className="border p-2 rounded font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                                            value={activeGroup.name}
                                            onChange={e => setMenuGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, name: e.target.value } : g))}
                                            placeholder="Ej: Menú del Día"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 w-full md:w-auto">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Precio:</span>
                                        <input
                                            type="number"
                                            step="0.10"
                                            className="border p-2 rounded font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-24"
                                            value={activeGroup.price || ''}
                                            onChange={e => setMenuGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, price: parseFloat(e.target.value) || 0 } : g))}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                {menuGroups.length > 1 && (
                                    <button onClick={() => removeGroup(activeGroup.id)} className="text-red-500 hover:bg-red-50 p-2 rounded text-xs font-bold flex items-center gap-1 shrink-0 w-full md:w-auto justify-center">
                                        <Trash2 size={14} /> Eliminar Grupo
                                    </button>
                                )}
                            </div>


                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                                <ItemList
                                    title="Entradas"
                                    list={activeGroup.entries}
                                    category="entries"
                                    icon={List}
                                    colorClass="bg-blue-50 border-blue-100"
                                    updateItem={updateItem}
                                    deleteItem={deleteItem}
                                    getTheoreticalMaxStock={getTheoreticalMaxStock}
                                    openSearchModal={(cat, idx) => {
                                        setSearchingCategory(cat);
                                        setEditItemIndex(idx);
                                    }}
                                />
                                <ItemList
                                    title="Segundos"
                                    list={activeGroup.mains}
                                    category="mains"
                                    icon={Utensils}
                                    colorClass="bg-orange-50 border-orange-100"
                                    updateItem={updateItem}
                                    deleteItem={deleteItem}
                                    getTheoreticalMaxStock={getTheoreticalMaxStock}
                                    openSearchModal={(cat, idx) => {
                                        setSearchingCategory(cat);
                                        setEditItemIndex(idx);
                                    }}
                                />
                            </div>

                            <div className="mt-8 flex justify-end pt-4 border-t">
                                <button
                                    onClick={handleSave}
                                    className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                >
                                    <Save size={20} /> Guardar Cambios
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden animate-in fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Tipo de Menú</th>
                                    <th className="p-4">Entrada</th>
                                    <th className="p-4">Segundo</th>
                                    <th className="p-4 text-center">Cuenta</th>
                                    <th className="p-4 text-right">Precio</th>
                                    <th className="p-4">Usuario</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan="7" className="p-8 text-center text-gray-500">Cargando historial de menús...</td></tr>
                                ) : movements.length === 0 ? (
                                    <tr><td colSpan="7" className="p-8 text-center text-gray-400 italic">No hay ventas de menú registradas</td></tr>
                                ) : (
                                    movements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-gray-500 whitespace-nowrap text-xs">
                                                {new Date(mov.date).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-bold text-gray-900 text-sm">
                                                {mov.menuName}
                                            </td>
                                            <td className="p-4 text-gray-700">
                                                {mov.entry !== '---' ? (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 text-xs font-semibold">
                                                        {mov.entry}
                                                    </span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-4 text-gray-700">
                                                {mov.main !== '---' ? (
                                                    <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 text-xs font-semibold">
                                                        {mov.main}
                                                    </span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                {mov.accountId ? (
                                                    <button
                                                        onClick={() => setSelectedAccountId(mov.accountId)}
                                                        title="Ver Cuenta"
                                                        className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                    >
                                                        #{mov.accountId}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400">---</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-900 text-sm">
                                                S/ {Number(parseFloat(mov.price).toFixed(1))}
                                            </td>
                                            <td className="p-4 text-gray-500 text-xs">
                                                {mov.user}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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

            {/* PLATOS SELECTION MODAL */}
            {searchingCategory && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">
                                Seleccionar {searchingCategory === 'entries' ? 'Entrada' : 'Segundo'}
                            </h3>
                            <button 
                                onClick={() => {
                                    setSearchingCategory(null);
                                    setEditItemIndex(null);
                                    setMenuSearchQuery('');
                                }} 
                                className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 border-b bg-white">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                                    <Search size={18} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar plato o producto..."
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                    value={menuSearchQuery}
                                    onChange={e => setMenuSearchQuery(e.target.value)}
                                    autoFocus
                                />
                                {menuSearchQuery && (
                                    <button
                                        onClick={() => setMenuSearchQuery('')}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-650"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto p-2 bg-gray-50 space-y-1">
                            {(() => {
                                const validOptions = products.filter(p => {
                                    if (searchingCategory === 'entries') {
                                        return p.type === 'daily_entry' || p.type === 'product' || p.type === 'finished';
                                    } else {
                                        return p.type === 'daily_main' || p.type === 'product' || p.type === 'finished';
                                    }
                                });
                                const searchResults = validOptions.filter(p =>
                                    p.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
                                );

                                if (searchResults.length === 0) {
                                    return (
                                        <div className="text-gray-400 text-sm italic py-8 text-center bg-white rounded-lg border">
                                            No se encontraron platos o productos.
                                        </div>
                                    );
                                }

                                return searchResults.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            if (editItemIndex !== null) {
                                                // Replace existing
                                                updateItem(searchingCategory, editItemIndex, 'linkId', p.id);
                                            } else {
                                                // Add new item
                                                setMenuGroups(prev => prev.map(g => {
                                                    if (g.id === activeGroupId) {
                                                        return {
                                                            ...g,
                                                            [searchingCategory]: [...g[searchingCategory], { id: generateId(), name: p.name, stock: 9999, linkId: p.id }]
                                                        };
                                                    }
                                                    return g;
                                                }));
                                            }
                                            // Close modal
                                            setSearchingCategory(null);
                                            setEditItemIndex(null);
                                            setMenuSearchQuery('');
                                        }}
                                        className="w-full text-left p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all flex justify-between items-center group"
                                    >
                                        <div>
                                            <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                                                {p.name}
                                            </span>
                                            <div className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">
                                                {p.type === 'finished' || p.type === 'product' ? 'Producto Terminado' : 'Plato del Día'}
                                            </div>
                                        </div>
                                        {p.price !== undefined && (
                                            <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded font-bold group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                                                S/ {Number(p.price).toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Extracted Component
const ItemList = ({
    title,
    list,
    category,
    icon: Icon,
    colorClass,
    updateItem,
    deleteItem,
    getTheoreticalMaxStock,
    openSearchModal,
}) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={`p-3 md:p-4 rounded-xl border ${colorClass} h-full transition-all duration-200`}>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Icon size={18} />
                    <span>{title}</span>
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-extrabold border ${
                        category === 'entries'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-orange-100 text-orange-700 border-orange-200'
                    }`}>
                        {list.length}
                    </span>
                </span>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={collapsed ? 'Expandir lista' : 'Contraer lista'}
                >
                    {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </button>
            </h3>

            {/* Comma-separated preview of items when collapsed */}
            {collapsed && list.length > 0 && (
                <div className="text-xs text-gray-500 font-semibold truncate bg-white/50 p-2 rounded-lg border border-gray-200/50 mt-1 select-none">
                    {list.map(item => item.name || '---').join(', ')}
                </div>
            )}

            {/* List items and Add Option button, show only when expanded */}
            {!collapsed && (
                <>
                    <div className="space-y-3 mb-3">
                        {list.map((item, idx) => (
                            <div
                                key={idx}
                                className="bg-white p-2 md:p-3 rounded-lg border shadow-sm group hover:border-blue-300 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openSearchModal(category, idx)}
                                        className="w-full sm:flex-1 min-w-0 border p-2 rounded text-sm font-bold text-left text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors truncate flex items-center justify-between"
                                    >
                                        <span>{item.name || '-- Seleccionar Plato --'}</span>
                                        <Search size={14} className="text-gray-400 shrink-0 ml-2" />
                                    </button>
                                    <div className="flex items-center justify-between sm:justify-center gap-2 sm:shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                                        <div className="flex justify-center items-center w-24 h-[38px] border border-dashed border-gray-100 rounded-lg sm:border-0 bg-gray-50/50 sm:bg-transparent px-2">
                                            {item.linkId ? (
                                                (() => {
                                                    const max = getTheoreticalMaxStock(item.linkId);
                                                    if (max !== null) {
                                                        return (
                                                            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                                                Stock: {max}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                                            Libre
                                                        </span>
                                                    );
                                                })()
                                            ) : (
                                                <span className="text-gray-400 text-xs font-bold">-</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => deleteItem(category, idx)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded h-[38px] flex items-center justify-center border sm:border-0 border-gray-100 px-3 sm:px-2"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {list.length === 0 && (
                            <div className="text-gray-400 text-sm italic py-4 text-center border border-dashed border-gray-300 rounded-lg bg-white/40 select-none">
                                Sin opciones registradas
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => openSearchModal(category, null)}
                        className="w-full py-2 bg-white border border-dashed border-gray-400 text-gray-500 rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-95"
                    >
                        <Plus size={16} /> Agregar Opción
                    </button>
                </>
            )}
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Package, Plus, Trash2, Edit2, Save, X, ChefHat, Layers, Minus, TrendingUp, TrendingDown, History, Zap, Search } from 'lucide-react';
import IngredientManager from './IngredientManager';
import RecipeModal from './RecipeModal';
import MobileTabMenu from './MobileTabMenu';
import AccountDetailsModal from './AccountDetailsModal'; // Import Account Modal

export default function StockDashboard({ readOnly = false, mode = 'full' }) {
    const { user, refreshTrigger, socket } = useRestaurant(); // Get socket
    const isWaiter = user?.role === 'waiter';
    const [activeTab, setActiveTab] = useState(() => {
        if (mode === 'menu_only') return 'menu_options';
        return localStorage.getItem('stock_activeTab') || 'finished';
    });
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(null); // ID of product being edited
    const [creatingSection, setCreatingSection] = useState(null); // 'entries', 'mains', 'general', null
    // REMOVED isCreating
    const [editForm, setEditForm] = useState({});

    const [recipeProduct, setRecipeProduct] = useState(null); // Product selected for recipe editing
    const [selectedAccountId, setSelectedAccountId] = useState(null); // Account selected from movements

    // Finished Products Sub-tabs
    const [finishedTab, setFinishedTab] = useState(() => {
        if (isWaiter) return 'movements';
        return localStorage.getItem('stock_finishedTab') || 'stock';
    }); // 'stock' or 'movements'
    const [preparedTab, setPreparedTab] = useState(() => {
        if (isWaiter) return 'movements';
        return localStorage.getItem('stock_preparedTab') || 'stock';
    }); // 'stock' or 'movements'
    const [freeTab, setFreeTab] = useState(() => {
        if (isWaiter) return 'movements';
        return localStorage.getItem('stock_freeTab') || 'stock';
    }); // 'stock' or 'movements'
    const [movements, setMovements] = useState([]);
    const [sales, setSales] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [loadingMovements, setLoadingMovements] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);

    // Adjustment State (Reuse pattern from IngredientManager)
    const [adjustmentItem, setAdjustmentItem] = useState(null); // { id, name, type: 'add'|'remove' }
    const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', reason: '' });

    // Fetch data
    useEffect(() => {
        loadProducts();
        loadIngredients();
    }, [refreshTrigger]);

    // Save active tabs to localStorage
    useEffect(() => {
        if (mode !== 'menu_only') {
            localStorage.setItem('stock_activeTab', activeTab);
        }
    }, [activeTab, mode]);

    useEffect(() => {
        localStorage.setItem('stock_finishedTab', finishedTab);
    }, [finishedTab]);

    useEffect(() => {
        localStorage.setItem('stock_preparedTab', preparedTab);
    }, [preparedTab]);

    useEffect(() => {
        localStorage.setItem('stock_freeTab', freeTab);
    }, [freeTab]);

    // Real-time listener
    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => {
            console.log("[StockDashboard] Real-time update received");
            loadProducts();
            loadIngredients();
            if (activeTab === 'finished' && finishedTab === 'movements') loadMovements('isStockManaged=true&excludeMenu=true');
            if (activeTab === 'prepared' && preparedTab === 'movements') loadMovements('isStockManaged=false&requiresPreparation=true&excludeMenu=true');
            if (activeTab === 'free' && freeTab === 'movements') loadMovements('isStockManaged=false&requiresPreparation=false&excludeMenu=true');
        };

        socket.on('product_updated', handleUpdate);
        return () => socket.off('product_updated', handleUpdate);
    }, [socket, activeTab, finishedTab, preparedTab, freeTab]);

    useEffect(() => {
        if (activeTab === 'finished' && finishedTab === 'movements') {
            loadMovements('isStockManaged=true&excludeMenu=true');
        } else if (activeTab === 'prepared' && preparedTab === 'movements') {
            loadMovements('isStockManaged=false&requiresPreparation=true&excludeMenu=true');
        } else if (activeTab === 'free' && freeTab === 'movements') {
            loadMovements('isStockManaged=false&requiresPreparation=false&excludeMenu=true');
        }
    }, [activeTab, finishedTab, preparedTab, freeTab]);

    // Close modal when switching tabs
    useEffect(() => {
        setCreatingSection(null);
        setEditForm({});
    }, [activeTab]);

    const prevSearchQueryRef = useRef('');

    // Transversal search across the 4 tabs
    useEffect(() => {
        const prevSearchQuery = prevSearchQueryRef.current;
        prevSearchQueryRef.current = searchQuery;

        // Only switch tabs if the search query has changed (user is typing)
        if (searchQuery === prevSearchQuery) return;
        if (!searchQuery) return;

        const query = searchQuery.toLowerCase();
        const excludedTypes = ['daily_entry', 'daily_main', 'daily_option', 'menu'];

        const productMatches = (p) => p.name.toLowerCase().includes(query);
        const ingredientMatches = (i) => i.name.toLowerCase().includes(query);

        const hasFinishedMatches = products.some(p => p.isStockManaged && !excludedTypes.includes(p.type) && productMatches(p));
        const hasPreparedMatches = products.some(p => !p.isStockManaged && p.requiresPreparation && !excludedTypes.includes(p.type) && productMatches(p));
        const hasFreeMatches = products.some(p => !p.isStockManaged && !p.requiresPreparation && !excludedTypes.includes(p.type) && productMatches(p));
        const hasIngredientMatches = ingredients.some(i => ingredientMatches(i));

        // Check if the current tab has any match
        let currentTabHasMatches = false;
        if (activeTab === 'finished') currentTabHasMatches = hasFinishedMatches;
        else if (activeTab === 'prepared') currentTabHasMatches = hasPreparedMatches;
        else if (activeTab === 'free') currentTabHasMatches = hasFreeMatches;
        else if (activeTab === 'ingredients') currentTabHasMatches = hasIngredientMatches;

        if (currentTabHasMatches) return;

        // Switch to the first tab that has matches
        if (hasFinishedMatches) {
            setActiveTab('finished');
        } else if (hasPreparedMatches) {
            setActiveTab('prepared');
        } else if (hasFreeMatches) {
            setActiveTab('free');
        } else if (hasIngredientMatches) {
            setActiveTab('ingredients');
        }
    }, [searchQuery, products, ingredients, activeTab]);

    const loadProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Error loading products", error);
        }
    };

    const loadIngredients = async () => {
        try {
            const res = await axios.get('/api/stock/ingredients');
            setIngredients(res.data);
        } catch (error) {
            console.error("Error loading ingredients", error);
        }
    };

    const loadMovements = async (typeFilter) => {
        setLoadingMovements(true);
        try {
            const url = typeFilter ? `/api/products/movements/all?${typeFilter}` : '/api/products/movements/all';
            const res = await axios.get(url);
            setMovements(res.data);
        } catch (error) {
            console.error("Error loading movements", error);
        } finally {
            setLoadingMovements(false);
        }
    };

    const loadSales = async (typeFilter) => {
        setLoadingSales(true);
        try {
            const url = typeFilter ? `/api/products/sales?type=${typeFilter}` : '/api/products/sales';
            const res = await axios.get(url);
            setSales(res.data);
        } catch (error) {
            console.error("Error loading sales", error);
        } finally {
            setLoadingSales(false);
        }
    };

    // Stock Adjustment Logic
    const openAdjustment = (item, type) => {
        setAdjustmentItem({ ...item, type });
        setAdjustmentForm({ amount: '', reason: '' });
    };

    const handleAdjustmentSubmit = async () => {
        if (!adjustmentForm.amount || parseFloat(adjustmentForm.amount) <= 0) return alert("Cantidad inválida");

        try {
            // Determine API endpoint based on context? 
            // Actually this is only for Products (Terminados).
            await axios.post(`/api/products/${adjustmentItem.id}/movement`, {
                type: adjustmentItem.type,
                amount: adjustmentForm.amount,
                reason: adjustmentForm.reason || (adjustmentItem.type === 'add' ? 'Compra Manual' : 'Ajuste Manual'),
                userId: user?.id || null,
                variantId: adjustmentForm.variantId || adjustmentItem.variantId || null // Pass selected variant
            });

            setAdjustmentItem(null);
            loadProducts(); // Refresh stock
            if (activeTab === 'finished' && finishedTab === 'movements') loadMovements('drink,other');
            if (activeTab === 'prepared' && preparedTab === 'movements') loadMovements('dish');
        } catch (err) {
            console.error(err);
            alert("Error ajustando stock");
        }
    };

    // Create
    // Create / Pre-fill Form
    const handleCreate = (prefillTypeOrEvent = null) => {
        if (readOnly) return;
        setIsEditing(null);

        let prefillType = null;
        if (typeof prefillTypeOrEvent === 'string') {
            prefillType = prefillTypeOrEvent;
        }

        let defaults = {
            name: '',
            price: '0.00',
            type: 'dish',
            stock: 0,
            isStockManaged: false,
            requiresPreparation: true, // Default to Prepared
            presentationsList: []
        };

        if (prefillType) {
            defaults.type = prefillType;
            defaults.isStockManaged = false;
        } else if (activeTab === 'finished') {
            defaults.isStockManaged = true;
            defaults.type = 'dish';
            // Initialize with one "Base" variant for Terminado to allow editing name/stock immediately
            defaults.presentationsList = [{ name: 'Estándar', price: '0.00', stock: 0 }];
        } else if (activeTab === 'prepared') {
            defaults.isStockManaged = false;
            defaults.requiresPreparation = true; // Prepared = has recipe/preparation
            defaults.type = 'dish';
            defaults.presentationsList = [{ name: 'Estándar', price: '0.00' }];
        } else if (activeTab === 'free') {
            defaults.isStockManaged = false;
            defaults.requiresPreparation = false; // Free = no stock, no preparation
            defaults.type = 'dish';
            defaults.presentationsList = [{ name: 'Estándar', price: '0.00' }];
        } else if (activeTab === 'menu_options') {
            // Should not happen via generic button, but fallback
            defaults.isStockManaged = false;
            defaults.requiresPreparation = true; // Default to Prepared
            defaults.type = 'daily_entry';
        }


        setEditForm(defaults);

        // Determine section based on type
        if (defaults.type === 'daily_entry') setCreatingSection('entries');
        else if (defaults.type === 'daily_main') setCreatingSection('mains');
        else setCreatingSection('general');
    };

    const handleSaveProduct = async (keepOpen = false) => {
        try {
            // Validation: Ensure entries and mains have a price strictly greater than 0
            if (editForm.type === 'daily_entry' || editForm.type === 'daily_main') {
                const parsedPrice = parseFloat(editForm.price);
                if (editForm.price === undefined || editForm.price === '' || isNaN(parsedPrice) || parsedPrice <= 0) {
                    alert("Debe ingresar un Precio Unitario válido (mayor a 0) para la opción de menú.");
                    return;
                }
            }

            const payload = { ...editForm, userId: user?.id };
            if (payload.presentationsList) {
                // payload.presentations = JSON.stringify(payload.presentationsList); 
            }

            // DEBUG: Log exactly what we are sending
            console.log('[handleSaveProduct] Payload being sent:', {
                id: payload.id,
                name: payload.name,
                requiresPreparation: payload.requiresPreparation,
                isStockManaged: payload.isStockManaged,
                type: payload.type,
                price: payload.price
            });

            let savedProduct;
            if (editForm.id) {
                // UPDATE
                console.time('API_PUT');
                const res = await axios.put(`/api/products/${editForm.id}`, payload);
                console.timeEnd('API_PUT');
                savedProduct = res.data;

                console.time('REACT_RENDER_UPDATE');
                setProducts(prev => prev.map(p => p.id === savedProduct.id ? savedProduct : p));
                console.timeEnd('REACT_RENDER_UPDATE');
            } else {
                // CREATE
                console.time('API_POST');
                const res = await axios.post('/api/products', payload);
                console.timeEnd('API_POST');
                savedProduct = res.data;

                console.time('REACT_RENDER_CREATE');
                setProducts(prev => [...prev, savedProduct]);
                console.timeEnd('REACT_RENDER_CREATE');
            }

            if (keepOpen === true) {
                // reset only name/stock/price, keep type/section
                setEditForm(prev => ({
                    ...prev,
                    name: '',
                    stock: 0,
                    price: '0.00'
                }));
            } else {
                setCreatingSection(null);
                setEditForm({});
            }

            // loadProducts(); // Force refetch removed to dramatically improve performance
        } catch (error) {
            console.error("Error saving product", error);
            const msg = error.response?.data?.error || "Error al guardar producto";
            alert(msg);
        }
    };

    // Open Edit Form
    const handleEdit = (product) => {
        if (readOnly) return;

        let parsedPresentations = [];
        try {
            // Priority: Use actual ProductVariants if available (contains IDs and real stock)
            if (product.ProductVariants && product.ProductVariants.length > 0) {
                parsedPresentations = product.ProductVariants.map(v => ({
                    id: v.id,
                    name: v.name,
                    price: v.price,
                    stock: v.stock,
                    happyHourPrice: v.happyHourPrice,
                    happyHourStart: v.happyHourStart,
                    happyHourEnd: v.happyHourEnd
                }));
            } else if (product.presentations) {
                // Fallback to legacy JSON
                parsedPresentations = typeof product.presentations === 'string'
                    ? JSON.parse(product.presentations)
                    : product.presentations;
            }

            // Ensure at least one variant exists for the list (Base)
            // If legacy product (no variants), create a virtual one from the main product data
            if (!parsedPresentations || parsedPresentations.length === 0) {
                parsedPresentations = [{
                    id: null, // Will create new variant on save
                    name: 'Estándar',
                    price: product.price,
                    stock: product.stock
                }];
            }

        } catch (e) { console.error("Parse error", e); }

        setEditForm({
            ...product,
            presentationsList: parsedPresentations
        });

        // Determine section for edit
        if (product.type === 'daily_entry') setCreatingSection('entries');
        else if (product.type === 'daily_main') setCreatingSection('mains');
        else setCreatingSection('general');
    };


    // Delete
    const handleDelete = async (id) => {
        if (readOnly) return;
        if (confirm('¿Eliminar producto?')) {
            try {
                await axios.delete(`/api/products/${id}?userId=${user?.id}`);
                loadProducts();
            } catch (error) {
                console.error("Error deleting product", error);
                alert(error.response?.data?.error || 'Error al eliminar producto');
            }
        }
    };

    // Counts
    const countFinished = products.filter(p => p.isStockManaged && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length;
    const countPrepared = products.filter(p => !p.isStockManaged && p.requiresPreparation && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length;
    const countFree = products.filter(p => !p.isStockManaged && !p.requiresPreparation && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length;
    const countIngredients = ingredients.length;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in active">
            {/* RECIPE MODAL */}
            {recipeProduct && (
                <RecipeModal
                    product={recipeProduct}
                    onClose={() => setRecipeProduct(null)}
                    products={products} // Pass all products to find ingredients
                />
            )}
            <div className={`flex flex-col md:flex-row md:justify-between md:items-center ${activeTab === 'ingredients' ? 'mb-0 md:mb-6' : 'mb-6'} gap-4`}>

                {/* TABS CONTROLLERS */}
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    {/* MOBILE TABS (TOP) */}
                    {mode !== 'menu_only' && (
                        <div className="md:hidden w-full">
                            <MobileTabMenu
                                tabs={[
                                    { id: 'finished', label: `Terminados (${countFinished})`, icon: Package },
                                    { id: 'prepared', label: `Preparados (${countPrepared})`, icon: ChefHat },
                                    { id: 'free', label: `Libres (${countFree})`, icon: Zap },
                                    { id: 'ingredients', label: `Insumos (${countIngredients})`, icon: Layers },
                                ]}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>
                    )}

                    {/* DESKTOP TABS */}
                    {mode !== 'menu_only' && (
                        <div className="hidden md:flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('finished')}
                                className={`px-3 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'finished' ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Terminados ({countFinished})
                            </button>
                            <button
                                onClick={() => setActiveTab('prepared')}
                                className={`px-3 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'prepared' ? 'bg-white text-orange-700 shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Preparados ({countPrepared})
                            </button>
                            <button
                                onClick={() => setActiveTab('free')}
                                className={`px-3 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'free' ? 'bg-white text-emerald-700 shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Libres ({countFree})
                            </button>
                            <button
                                onClick={() => setActiveTab('ingredients')}
                                className={`px-3 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ingredients' ? 'bg-white text-amber-800 shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Insumos ({countIngredients})
                            </button>
                        </div>
                    )}
                </div>

                {/* SEARCH AND ACTION BAR */}
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
                    {/* Search Bar */}
                    {activeTab !== 'menu_options' && (
                        <div className="relative w-full sm:w-64">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                placeholder={activeTab === 'ingredients' ? "Buscar insumo..." : "Buscar producto..."}
                                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-650"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Action Button */}
                    {activeTab !== 'ingredients' && activeTab !== 'menu_options' && !readOnly && (
                        <button
                            onClick={() => handleCreate()}
                            className={`w-full sm:w-auto px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-bold shadow-sm text-white transition-colors whitespace-nowrap
                                ${activeTab === 'prepared' ? 'bg-orange-600 hover:bg-orange-700' :
                                    activeTab === 'free' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                        'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Plus size={18} />
                            {activeTab === 'prepared' ? 'Nuevo Plato' : activeTab === 'free' ? 'Nuevo Libre' : 'Nuevo Producto'}
                        </button>
                    )}
                </div>
            </div>

            {/* ADJUSTMENT MODAL */}
            {adjustmentItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            {adjustmentItem.type === 'add' ? <Plus className="text-green-600" /> : <Minus className="text-red-600" />}
                            {adjustmentItem.type === 'add' ? 'Agregar Stock' : 'Disminuir Stock'}
                        </h3>
                        <div className="mb-4 p-3 bg-gray-50 rounded border">
                            <div className="font-bold text-gray-800">{adjustmentItem.name}</div>
                            {adjustmentItem.ProductVariants && adjustmentItem.ProductVariants.length > 1 && !adjustmentItem.variantId ? (
                                <div className="mt-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Seleccionar Presentación</label>
                                    <select
                                        className="w-full p-2 border rounded bg-white"
                                        onChange={e => {
                                            const vId = e.target.value;
                                            const v = adjustmentItem.ProductVariants.find(pv => pv.id === parseInt(vId));
                                            setAdjustmentForm({ ...adjustmentForm, variantId: vId, currentStock: v ? v.stock : 0 });
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Seleccionar --</option>
                                        {adjustmentItem.ProductVariants.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name} (Stock: {v.stock})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">Stock Actual: {adjustmentItem.stock}</div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                                <input
                                    type="number"
                                    step="1"
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={adjustmentForm.amount}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleAdjustmentSubmit()}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                                <input
                                    type="text"
                                    placeholder={adjustmentItem.type === 'add' ? "Ej. Compra, Inventario Inicial" : "Ej. Merma, Vencimiento, Consumo Personal"}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={adjustmentForm.reason}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleAdjustmentSubmit()}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                onClick={() => setAdjustmentItem(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAdjustmentSubmit}
                                className={`px-4 py-2 text-white rounded font-bold shadow-sm ${adjustmentItem.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                Confirmar {adjustmentItem.type === 'add' ? 'Ingreso' : 'Salida'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT */}
            {activeTab === 'ingredients' ? (
                <IngredientManager readOnly={readOnly} user={user} searchQuery={searchQuery} />
            ) : (
                <>
                    {/* General Create Form Modal (For standard products) */}
                    {creatingSection === 'general' && !readOnly && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in">
                            {/* Backdrop click to close */}
                            <div className="fixed inset-0" onClick={() => setCreatingSection(null)}></div>
                            
                            <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl rounded-none sm:rounded-xl shadow-2xl flex flex-col overflow-hidden z-10 relative animate-in zoom-in-95">
                                {/* Modal Header */}
                                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                        <Package className="text-blue-600" />
                                        {editForm.id ? 'Editar Producto' : 'Nuevo Producto'}
                                    </h3>
                                    <button onClick={() => setCreatingSection(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Body (Scrollable) */}
                                <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-gray-50/30">
                                    {/* ---------------- GROUPED FIELDS (PRODUCT LEVEL) ---------------- */}
                                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Definiciones Agrupadas (Tipo inmutable tras creación)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Producto</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej. Coca Cola"
                                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                                                <select
                                                    className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${editForm.id ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'}`}
                                                    value={editForm.type}
                                                    onChange={e => !editForm.id && setEditForm({ ...editForm, type: e.target.value })}
                                                    disabled={!!editForm.id}
                                                >
                                                    <option value="dish">Plato</option>
                                                    <option value="drink">Bebida</option>
                                                    {activeTab === 'menu_options' && <option value="menu">Menú</option>}
                                                    <option value="other">Otro</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ---------------- INDEPENDENT FIELDS (VARIANTS) ---------------- */}
                                    {activeTab !== 'menu_options' && (() => {
                                        const variants = editForm.presentationsList || [];
                                        const hasMultipleVariants = variants.length > 1;

                                        if (!hasMultipleVariants) {
                                            const p = variants[0] || { name: 'Estándar', price: '0.00', stock: 0 };
                                            return (
                                                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4">
                                                    <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Precio y Stock (Sin Variantes)</h4>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const currentPrice = p.price || '0.00';
                                                                setEditForm({
                                                                    ...editForm,
                                                                    presentationsList: [
                                                                        { ...p, name: p.name === 'Estándar' ? 'Estándar' : p.name || 'Estándar' },
                                                                        { name: '', price: currentPrice, stock: 0 }
                                                                    ]
                                                                });
                                                            }}
                                                            className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-md hover:bg-blue-100 font-bold flex items-center gap-1 border border-blue-100 transition-colors"
                                                        >
                                                            <Plus size={12} /> Configurar Variantes
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-1">Precio (S/)</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                                className="w-full p-2 border rounded font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                                value={p.price}
                                                                onChange={e => {
                                                                    const newList = [...variants];
                                                                    if (newList.length === 0) newList.push({ name: 'Estándar', price: '0.00', stock: 0 });
                                                                    newList[0].price = e.target.value;
                                                                    setEditForm({ ...editForm, price: e.target.value, presentationsList: newList });
                                                                }}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-bold text-gray-700 mb-1">Stock</label>
                                                            {editForm.isStockManaged ? (
                                                                <div className="flex items-center gap-1.5 w-full">
                                                                    <div className="relative flex-1">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="0"
                                                                            disabled={!!p.id}
                                                                            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${!!p.id ? 'bg-gray-100 text-gray-500 cursor-not-allowed font-medium' : 'bg-white font-medium'}`}
                                                                            value={p.stock || ''}
                                                                            onChange={e => {
                                                                                if (!p.id) {
                                                                                    const newList = [...variants];
                                                                                    if (newList.length === 0) newList.push({ name: 'Estándar', price: '0.00', stock: 0 });
                                                                                    newList[0].stock = e.target.value;
                                                                                    setEditForm({ ...editForm, stock: e.target.value, presentationsList: newList });
                                                                                }
                                                                            }}
                                                                        />
                                                                        {!!p.id && (
                                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                                                                <span className="text-gray-400 text-xs">🔒</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!!p.id && !readOnly && user?.role === 'admin' && (
                                                                        <div className="flex gap-1 animate-in fade-in duration-200">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openAdjustment({
                                                                                    id: editForm.id,
                                                                                    name: editForm.name,
                                                                                    variantId: p.id,
                                                                                    stock: p.stock
                                                                                }, 'add')}
                                                                                className="bg-green-100 text-green-700 hover:bg-green-200 p-2 rounded flex items-center justify-center border border-green-200 transition-colors"
                                                                                title="Agregar Stock"
                                                                            >
                                                                                <Plus size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openAdjustment({
                                                                                    id: editForm.id,
                                                                                    name: editForm.name,
                                                                                    variantId: p.id,
                                                                                    stock: p.stock
                                                                                }, 'remove')}
                                                                                className="bg-red-100 text-red-700 hover:bg-red-200 p-2 rounded flex items-center justify-center border border-red-200 transition-colors"
                                                                                title="Disminuir Stock"
                                                                            >
                                                                                <Minus size={14} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic flex items-center h-full pl-2">N/A (Stock no gestionado)</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Happy Hour Row */}
                                                    <div className="border-t border-dashed border-gray-200 pt-3">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <label htmlFor="hh_simple" className="flex items-center gap-1.5 text-xs text-yellow-800 font-bold cursor-pointer bg-yellow-50 px-2 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    id="hh_simple"
                                                                    checked={p.happyHourPrice !== null && p.happyHourPrice !== undefined}
                                                                    onChange={e => {
                                                                        const newList = [...variants];
                                                                        if (newList.length === 0) newList.push({ name: 'Estándar', price: '0.00', stock: 0 });
                                                                        if (e.target.checked) {
                                                                            newList[0].happyHourPrice = p.price || '';
                                                                            newList[0].happyHourStart = '10:00';
                                                                            newList[0].happyHourEnd = '17:00';
                                                                        } else {
                                                                            newList[0].happyHourPrice = null;
                                                                            newList[0].happyHourStart = null;
                                                                            newList[0].happyHourEnd = null;
                                                                        }
                                                                        setEditForm({ ...editForm, presentationsList: newList });
                                                                    }}
                                                                    className="accent-yellow-600 w-3.5 h-3.5"
                                                                />
                                                                Happy Hour
                                                            </label>
                                                            {(p.happyHourPrice !== null && p.happyHourPrice !== undefined) && (
                                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                    <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                        <span className="text-gray-500 font-bold">Precio S/</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            placeholder="0.00"
                                                                            className="w-16 p-0 border-none outline-none font-bold text-right text-yellow-700 font-medium bg-transparent"
                                                                            value={p.happyHourPrice || ''}
                                                                            onChange={e => {
                                                                                const newList = [...variants];
                                                                                newList[0].happyHourPrice = e.target.value;
                                                                                setEditForm({ ...editForm, presentationsList: newList });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                        <span className="text-gray-500 font-bold">Inicio</span>
                                                                        <input
                                                                            type="time"
                                                                            className="w-20 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent"
                                                                            value={p.happyHourStart || ''}
                                                                            onChange={e => {
                                                                                const newList = [...variants];
                                                                                newList[0].happyHourStart = e.target.value;
                                                                                setEditForm({ ...editForm, presentationsList: newList });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                        <span className="text-gray-500 font-bold">Fin</span>
                                                                        <input
                                                                            type="time"
                                                                            className="w-20 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent"
                                                                            value={p.happyHourEnd || ''}
                                                                            onChange={e => {
                                                                                const newList = [...variants];
                                                                                newList[0].happyHourEnd = e.target.value;
                                                                                setEditForm({ ...editForm, presentationsList: newList });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Render Multi-Variants View (variants.length > 1)
                                        return (
                                            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Presentaciones / Variantes (Múltiples)</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditForm({
                                                            ...editForm,
                                                            presentationsList: [...variants, { name: '', price: '0.00', stock: 0 }]
                                                        })}
                                                        className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-md hover:bg-blue-100 font-bold flex items-center gap-1 border border-blue-100 transition-colors"
                                                    >
                                                        <Plus size={12} /> Agregar Variante
                                                    </button>
                                                </div>

                                                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 mb-2 px-1">
                                                    <div className="col-span-4">Nombre Presentación</div>
                                                    <div className="col-span-3">Precio (S/)</div>
                                                    <div className="col-span-4">Stock {editForm.id ? '(Solo Nuevos)' : '(Inicial)'}</div>
                                                    <div className="col-span-1"></div>
                                                </div>

                                                <div className="space-y-4">
                                                    {variants.map((p, idx) => (
                                                        <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm space-y-2.5">
                                                            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-2 items-stretch sm:items-center">
                                                                <div className="sm:col-span-4">
                                                                    <label className="block sm:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Nombre Presentación</label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder={idx === 0 ? "Ej. Estándar / Base" : "Ej. Mediano"}
                                                                        className="w-full p-2 border rounded font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white animate-in"
                                                                        value={p.name}
                                                                        onChange={e => {
                                                                            const newList = [...editForm.presentationsList];
                                                                            newList[idx].name = e.target.value;
                                                                            setEditForm({ ...editForm, presentationsList: newList });
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="sm:col-span-3">
                                                                    <label className="block sm:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Precio (S/)</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
                                                                        value={p.price}
                                                                        onChange={e => {
                                                                            const newList = [...editForm.presentationsList];
                                                                            newList[idx].price = e.target.value;
                                                                            setEditForm({ ...editForm, presentationsList: newList });
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="sm:col-span-4">
                                                                    <label className="block sm:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Stock</label>
                                                                    {editForm.isStockManaged ? (
                                                                        <div className="flex items-center gap-1.5 w-full">
                                                                            <div className="relative flex-1 font-medium">
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="0"
                                                                                    disabled={!!p.id}
                                                                                    className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${!!p.id ? 'bg-gray-100 text-gray-500 cursor-not-allowed font-medium' : 'bg-white font-medium'}`}
                                                                                    value={p.stock || ''}
                                                                                    onChange={e => {
                                                                                        if (!p.id) {
                                                                                            const newList = [...editForm.presentationsList];
                                                                                            newList[idx].stock = e.target.value;
                                                                                            setEditForm({ ...editForm, presentationsList: newList });
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                {!!p.id && (
                                                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                                                                        <span className="text-gray-400 text-xs">🔒</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {!!p.id && !readOnly && user?.role === 'admin' && (
                                                                                <div className="flex gap-1 animate-in fade-in duration-200">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openAdjustment({
                                                                                            id: editForm.id,
                                                                                            name: `${editForm.name} (${p.name})`,
                                                                                            variantId: p.id,
                                                                                            stock: p.stock
                                                                                        }, 'add')}
                                                                                        className="bg-green-100 text-green-700 hover:bg-green-200 p-2 rounded flex items-center justify-center border border-green-200 transition-colors"
                                                                                        title="Agregar Stock"
                                                                                    >
                                                                                        <Plus size={14} />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openAdjustment({
                                                                                            id: editForm.id,
                                                                                            name: `${editForm.name} (${p.name})`,
                                                                                            variantId: p.id,
                                                                                            stock: p.stock
                                                                                        }, 'remove')}
                                                                                        className="bg-red-100 text-red-700 hover:bg-red-200 p-2 rounded flex items-center justify-center border border-red-200 transition-colors"
                                                                                        title="Disminuir Stock"
                                                                                    >
                                                                                        <Minus size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400 italic flex items-center h-full pl-2 bg-gray-50 p-2 rounded">N/A</span>
                                                                    )}
                                                                </div>

                                                                <div className="sm:col-span-1 flex justify-end sm:justify-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newList = editForm.presentationsList.filter((_, i) => i !== idx);
                                                                            setEditForm({ ...editForm, presentationsList: newList });
                                                                        }}
                                                                        className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                                                                        title="Eliminar Variante"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Happy Hour Row */}
                                                            <div className="border-t border-dashed border-gray-100 pt-2">
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <label htmlFor={`hh_${idx}`} className="flex items-center gap-1.5 text-xs text-yellow-800 font-bold cursor-pointer bg-yellow-50 px-2 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors animate-in">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`hh_${idx}`}
                                                                            checked={p.happyHourPrice !== null && p.happyHourPrice !== undefined}
                                                                            onChange={e => {
                                                                                const newList = [...editForm.presentationsList];
                                                                                if (e.target.checked) {
                                                                                    newList[idx].happyHourPrice = p.price || '';
                                                                                    newList[idx].happyHourStart = '10:00';
                                                                                    newList[idx].happyHourEnd = '17:00';
                                                                                } else {
                                                                                    newList[idx].happyHourPrice = null;
                                                                                    newList[idx].happyHourStart = null;
                                                                                    newList[idx].happyHourEnd = null;
                                                                                }
                                                                                setEditForm({ ...editForm, presentationsList: newList });
                                                                            }}
                                                                            className="accent-yellow-600 w-3.5 h-3.5"
                                                                        />
                                                                        Happy Hour
                                                                    </label>
                                                                    {(p.happyHourPrice !== null && p.happyHourPrice !== undefined) && (
                                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                            <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                                <span className="text-gray-500 font-bold">Precio S/</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    placeholder="0.00"
                                                                                    className="w-16 p-0 border-none outline-none font-bold text-right text-yellow-700 font-medium bg-transparent"
                                                                                    value={p.happyHourPrice || ''}
                                                                                    onChange={e => {
                                                                                        const newList = [...editForm.presentationsList];
                                                                                        newList[idx].happyHourPrice = e.target.value;
                                                                                        setEditForm({ ...editForm, presentationsList: newList });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                                <span className="text-gray-500 font-bold">Inicio</span>
                                                                                <input
                                                                                    type="time"
                                                                                    className="w-20 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent"
                                                                                    value={p.happyHourStart || ''}
                                                                                    onChange={e => {
                                                                                        const newList = [...editForm.presentationsList];
                                                                                        newList[idx].happyHourStart = e.target.value;
                                                                                        setEditForm({ ...editForm, presentationsList: newList });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200 animate-in fade-in">
                                                                                <span className="text-gray-500 font-bold">Fin</span>
                                                                                <input
                                                                                    type="time"
                                                                                    className="w-20 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent"
                                                                                    value={p.happyHourEnd || ''}
                                                                                    onChange={e => {
                                                                                        const newList = [...editForm.presentationsList];
                                                                                        newList[idx].happyHourEnd = e.target.value;
                                                                                        setEditForm({ ...editForm, presentationsList: newList });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 z-10">
                                    <button onClick={() => setCreatingSection(null)} className="text-gray-600 px-4 py-2 hover:bg-gray-200 rounded-md font-medium transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md shadow font-bold transition-colors">
                                        {editForm.id ? 'Actualizar Producto' : 'Crear Producto'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTENT VIEW */}
                    {activeTab === 'menu_options' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* ENTRADAS COLUMN */}
                            <div className="bg-white rounded-lg shadow border p-4">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                    <h3 className="font-bold text-lg text-purple-800">Entradas</h3>
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleCreate('daily_entry')}
                                            className="bg-purple-100 hover:bg-purple-200 text-purple-800 p-2 rounded-full"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {/* INLINE FORM FOR ENTRIES */}
                                    {creatingSection === 'entries' && (
                                        <div className="bg-purple-50 p-3 rounded border border-purple-200 flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="font-bold text-sm text-purple-900 mb-1">{editForm.id ? 'Editar Entrada' : 'Nueva Entrada'}</div>
                                            <div className="flex gap-2 items-center">
                                                {editForm.isStockManaged ? (
                                                    <select
                                                        className="p-2 border rounded flex-1 focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                                                        value={editForm.linkedProductId || ''}
                                                        onChange={e => {
                                                            const prodId = e.target.value;
                                                            const prod = products.find(p => p.id === parseInt(prodId));
                                                            if (prod) {
                                                                setEditForm({ ...editForm, name: prod.name, linkedProductId: prodId, stock: 0 });
                                                            } else {
                                                                setEditForm({ ...editForm, name: '', linkedProductId: null, stock: 0 });
                                                            }
                                                        }}
                                                        autoFocus
                                                    >
                                                        <option value="">{editForm.requiresPreparation ? '-- Seleccionar Receta --' : '-- Seleccionar Producto Terminado --'}</option>
                                                        {products.filter(p => {
                                                            if (editForm.requiresPreparation) return p.Recipes && p.Recipes.length > 0;
                                                            return p.isStockManaged && (!p.Recipes || p.Recipes.length === 0);
                                                        }).map(p => {
                                                            let stockText = '';
                                                            if (editForm.requiresPreparation) {
                                                                // Calculate recipe max
                                                                let min = 999999;
                                                                let hasIng = false;
                                                                if (p.Recipes) {
                                                                    p.Recipes.forEach(r => {
                                                                        if (r.Ingredient) {
                                                                            hasIng = true;
                                                                            const avail = Math.floor(parseFloat(r.Ingredient.stock) / parseFloat(r.quantity));
                                                                            if (avail < min) min = avail;
                                                                        }
                                                                    });
                                                                }
                                                                stockText = hasIng ? `Receta: ${min}` : 'Sin Insumos';
                                                            } else {
                                                                let s = parseInt(p.stock || 0);
                                                                if (p.ProductVariants && p.ProductVariants.length > 0) {
                                                                    s = p.ProductVariants.reduce((sum, v) => sum + parseInt(v.stock || 0), 0);
                                                                }
                                                                stockText = `Stock: ${s}`;
                                                            }
                                                            return (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name} ({stockText})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                ) : (
                                                    <div className="flex flex-col sm:flex-row flex-1 gap-3 w-full">
                                                        <input
                                                            placeholder="Nombre de la Entrada"
                                                            className="p-2 border rounded flex-1 focus:ring-2 focus:ring-purple-500 outline-none w-full"
                                                            value={editForm.name || ''}
                                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                            autoFocus
                                                            onKeyDown={e => e.key === 'Enter' && handleSaveProduct(true)}
                                                        />
                                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="flex items-center gap-1 border rounded bg-white px-2 focus-within:ring-2 focus-within:ring-purple-500 w-32 shrink-0">
                                                                    <span className="text-gray-500 text-sm">S/</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.10"
                                                                        min="0"
                                                                        placeholder="Precio"
                                                                        className="w-full p-2 outline-none"
                                                                        value={editForm.price || ''}
                                                                        onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                                                        onFocus={e => {
                                                                            if (e.target.value === '0.00' || e.target.value === '0') {
                                                                                setEditForm({ ...editForm, price: '' });
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>

                                                                <label className="flex items-center gap-1.5 text-xs text-yellow-800 font-bold cursor-pointer bg-yellow-50 px-2 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors shrink-0">
                                                                    <input type="checkbox" checked={editForm.happyHourPrice !== null && editForm.happyHourPrice !== undefined} onChange={e => {
                                                                        if (e.target.checked) setEditForm({ ...editForm, happyHourPrice: editForm.price || '', happyHourStart: '10:00', happyHourEnd: '17:00' });
                                                                        else setEditForm({ ...editForm, happyHourPrice: null, happyHourStart: null, happyHourEnd: null });
                                                                    }} className="accent-yellow-600 w-3.5 h-3.5" /> Happy Hour
                                                                </label>

                                                                {(editForm.happyHourPrice !== null && editForm.happyHourPrice !== undefined) && (
                                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Precio S/</span>
                                                                            <input type="number" step="0.01" className="w-12 p-0 border-none outline-none font-bold text-right text-yellow-700" value={editForm.happyHourPrice || ''} onChange={e => setEditForm({ ...editForm, happyHourPrice: e.target.value })} />
                                                                        </div>
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Inicio</span>
                                                                            <input type="time" className="w-16 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent" value={editForm.happyHourStart || ''} onChange={e => setEditForm({ ...editForm, happyHourStart: e.target.value })} />
                                                                        </div>
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Fin</span>
                                                                            <input type="time" className="w-16 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent" value={editForm.happyHourEnd || ''} onChange={e => setEditForm({ ...editForm, happyHourEnd: e.target.value })} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-dashed border-purple-200/50 pt-2">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${editForm.isStockManaged ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={editForm.isStockManaged}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: true, requiresPreparation: false, stock: editForm.stock || 0 })}
                                                            className="accent-blue-600"
                                                        /> Terminado
                                                    </label>
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${!editForm.isStockManaged && editForm.requiresPreparation ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={!editForm.isStockManaged && editForm.requiresPreparation}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: false, requiresPreparation: true, stock: 0 })}
                                                            className="accent-green-600"
                                                        /> Preparado
                                                    </label>
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${!editForm.isStockManaged && !editForm.requiresPreparation ? 'bg-orange-100 border-orange-350 text-orange-850' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={!editForm.isStockManaged && !editForm.requiresPreparation}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: false, requiresPreparation: false, stock: 0 })}
                                                            className="accent-orange-600"
                                                        /> Libre
                                                    </label>
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setCreatingSection(null)} className="text-gray-500 hover:bg-gray-200 px-3 py-1.5 rounded text-sm font-medium">Cancelar</button>
                                                    <button onClick={() => handleSaveProduct(false)} className="bg-purple-600 text-white px-5 py-1.5 rounded-lg font-bold text-sm hover:bg-purple-700 shadow-md transition-all active:scale-95">Guardar</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {products.filter(p => p.type === 'daily_entry').map(product => (
                                        <div key={product.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b last:border-0">
                                            <div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="font-medium text-gray-800">{product.name}</span>
                                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                                        S/ {Number(product.price || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                {!product.isStockManaged && product.requiresPreparation && (
                                                    <button
                                                        onClick={() => setRecipeProduct(product)}
                                                        className="text-orange-600 text-xs font-bold flex items-center gap-1 mt-1 hover:underline"
                                                    >
                                                        <ChefHat size={12} /> Receta
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(product)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {products.filter(p => p.type === 'daily_entry').length === 0 && (
                                        <p className="text-gray-400 text-sm italic text-center py-4">No hay entradas registradas</p>
                                    )}
                                </div>
                            </div>

                            {/* SEGUNDOS COLUMN */}
                            <div className="bg-white rounded-lg shadow border p-4">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                    <h3 className="font-bold text-lg text-pink-800">Segundos</h3>
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleCreate('daily_main')}
                                            className="bg-pink-100 hover:bg-pink-200 text-pink-800 p-2 rounded-full"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {/* INLINE FORM FOR MAINS */}
                                    {creatingSection === 'mains' && (
                                        <div className="bg-pink-50 p-3 rounded border border-pink-200 flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="font-bold text-sm text-pink-900 mb-1">{editForm.id ? 'Editar Segundo' : 'Nuevo Segundo'}</div>
                                            <div className="flex gap-2 items-center">
                                                {editForm.isStockManaged ? (
                                                    <select
                                                        className="p-2 border rounded flex-1 focus:ring-2 focus:ring-pink-500 outline-none font-medium"
                                                        value={editForm.linkedProductId || ''}
                                                        onChange={e => {
                                                            const prodId = e.target.value;
                                                            const prod = products.find(p => p.id === parseInt(prodId));
                                                            if (prod) {
                                                                setEditForm({ ...editForm, name: prod.name, linkedProductId: prodId, stock: 0 });
                                                            } else {
                                                                setEditForm({ ...editForm, name: '', linkedProductId: null, stock: 0 });
                                                            }
                                                        }}
                                                        autoFocus
                                                    >
                                                        <option value="">{editForm.requiresPreparation ? '-- Seleccionar Receta --' : '-- Seleccionar Producto Terminado --'}</option>
                                                        {products.filter(p => {
                                                            if (editForm.requiresPreparation) return p.Recipes && p.Recipes.length > 0;
                                                            return p.isStockManaged && (!p.Recipes || p.Recipes.length === 0);
                                                        }).map(p => {
                                                            let stockText = '';
                                                            if (editForm.requiresPreparation) {
                                                                // Calculate recipe max
                                                                let min = 999999;
                                                                let hasIng = false;
                                                                if (p.Recipes) {
                                                                    p.Recipes.forEach(r => {
                                                                        if (r.Ingredient) {
                                                                            hasIng = true;
                                                                            const avail = Math.floor(parseFloat(r.Ingredient.stock) / parseFloat(r.quantity));
                                                                            if (avail < min) min = avail;
                                                                        }
                                                                    });
                                                                }
                                                                stockText = hasIng ? `Receta: ${min}` : 'Sin Insumos';
                                                            } else {
                                                                let s = parseInt(p.stock || 0);
                                                                if (p.ProductVariants && p.ProductVariants.length > 0) {
                                                                    s = p.ProductVariants.reduce((sum, v) => sum + parseInt(v.stock || 0), 0);
                                                                }
                                                                stockText = `Stock: ${s}`;
                                                            }
                                                            return (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name} ({stockText})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                ) : (
                                                    <div className="flex flex-col sm:flex-row flex-1 gap-3 w-full">
                                                        <input
                                                            placeholder="Nombre del Segundo"
                                                            className="p-2 border rounded flex-1 focus:ring-2 focus:ring-pink-500 outline-none w-full"
                                                            value={editForm.name || ''}
                                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                            autoFocus
                                                            onKeyDown={e => e.key === 'Enter' && handleSaveProduct(true)}
                                                        />
                                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="flex items-center gap-1 border rounded bg-white px-2 focus-within:ring-2 focus-within:ring-pink-500 w-32 shrink-0">
                                                                    <span className="text-gray-500 text-sm">S/</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.10"
                                                                        min="0"
                                                                        placeholder="Precio"
                                                                        className="w-full p-2 outline-none"
                                                                        value={editForm.price || ''}
                                                                        onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                                                        onFocus={e => {
                                                                            if (e.target.value === '0.00' || e.target.value === '0') {
                                                                                setEditForm({ ...editForm, price: '' });
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>

                                                                <label className="flex items-center gap-1.5 text-xs text-yellow-800 font-bold cursor-pointer bg-yellow-50 px-2 py-1.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors shrink-0">
                                                                    <input type="checkbox" checked={editForm.happyHourPrice !== null && editForm.happyHourPrice !== undefined} onChange={e => {
                                                                        if (e.target.checked) setEditForm({ ...editForm, happyHourPrice: editForm.price || '', happyHourStart: '10:00', happyHourEnd: '17:00' });
                                                                        else setEditForm({ ...editForm, happyHourPrice: null, happyHourStart: null, happyHourEnd: null });
                                                                    }} className="accent-yellow-600 w-3.5 h-3.5" /> Happy Hour
                                                                </label>

                                                                {(editForm.happyHourPrice !== null && editForm.happyHourPrice !== undefined) && (
                                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Precio S/</span>
                                                                            <input type="number" step="0.01" className="w-12 p-0 border-none outline-none font-bold text-right text-yellow-700" value={editForm.happyHourPrice || ''} onChange={e => setEditForm({ ...editForm, happyHourPrice: e.target.value })} />
                                                                        </div>
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Inicio</span>
                                                                            <input type="time" className="w-16 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent" value={editForm.happyHourStart || ''} onChange={e => setEditForm({ ...editForm, happyHourStart: e.target.value })} />
                                                                        </div>
                                                                        <div className="flex items-center gap-1 bg-white px-1.5 py-1 rounded border border-yellow-200">
                                                                            <span className="text-gray-400 font-bold">Fin</span>
                                                                            <input type="time" className="w-16 p-0 border-none outline-none font-bold text-yellow-700 bg-transparent" value={editForm.happyHourEnd || ''} onChange={e => setEditForm({ ...editForm, happyHourEnd: e.target.value })} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-dashed border-pink-200/50 pt-2">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${editForm.isStockManaged ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={editForm.isStockManaged}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: true, requiresPreparation: false, stock: editForm.stock || 0 })}
                                                            className="accent-blue-600"
                                                        /> Terminado
                                                    </label>
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${!editForm.isStockManaged && editForm.requiresPreparation ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={!editForm.isStockManaged && editForm.requiresPreparation}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: false, requiresPreparation: true, stock: 0 })}
                                                            className="accent-green-600"
                                                        /> Preparado
                                                    </label>
                                                    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[11px] font-semibold transition-all ${!editForm.isStockManaged && !editForm.requiresPreparation ? 'bg-orange-100 border-orange-355 text-orange-850' : 'bg-white border-gray-250 text-gray-600'}`}>
                                                        <input type="radio"
                                                            checked={!editForm.isStockManaged && !editForm.requiresPreparation}
                                                            onChange={() => setEditForm({ ...editForm, isStockManaged: false, requiresPreparation: false, stock: 0 })}
                                                            className="accent-orange-600"
                                                        /> Libre
                                                    </label>
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setCreatingSection(null)} className="text-gray-500 hover:bg-gray-200 px-3 py-1.5 rounded text-sm font-medium">Cancelar</button>
                                                    <button onClick={() => handleSaveProduct(false)} className="bg-pink-600 text-white px-5 py-1.5 rounded-lg font-bold text-sm hover:bg-pink-700 shadow-md transition-all active:scale-95">Guardar</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {products.filter(p => p.type === 'daily_main').map(product => (
                                        <div key={product.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border-b last:border-0">
                                            <div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="font-medium text-gray-800">{product.name}</span>
                                                    <span className="bg-pink-100 text-pink-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                                        S/ {Number(product.price || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                {!product.isStockManaged && product.requiresPreparation && (
                                                    <button
                                                        onClick={() => setRecipeProduct(product)}
                                                        className="text-orange-600 text-xs font-bold flex items-center gap-1 mt-1 hover:underline"
                                                    >
                                                        <ChefHat size={12} /> Receta
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(product)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {products.filter(p => p.type === 'daily_main').length === 0 && (
                                        <p className="text-gray-400 text-sm italic text-center py-4">No hay segundos registrados</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* STANDARD TABLE FOR OTHER ABS */
                        <>
                            {activeTab === 'finished' && (
                                <div className="grid grid-cols-2 md:flex gap-2 mb-4 w-full md:w-auto">
                                    <button
                                        onClick={() => setFinishedTab('stock')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${finishedTab === 'stock' ? 'bg-white text-blue-700 shadow ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <Package size={16} /> <span className="truncate">Stock Actual ({products.filter(p => p.isStockManaged && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length})</span>
                                    </button>
                                    <button
                                        onClick={() => setFinishedTab('movements')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${finishedTab === 'movements' ? 'bg-white text-blue-700 shadow ring-1 ring-blue-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <History size={16} /> <span className="truncate">Movimientos</span>
                                    </button>
                                </div>
                            )}

                            {activeTab === 'prepared' && (
                                <div className="grid grid-cols-2 md:flex gap-2 mb-4 w-full md:w-auto">
                                    <button
                                        onClick={() => setPreparedTab('stock')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${preparedTab === 'stock' ? 'bg-white text-orange-700 shadow ring-1 ring-orange-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <ChefHat size={16} /> <span className="truncate">Platos ({products.filter(p => !p.isStockManaged && p.requiresPreparation && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length})</span>
                                    </button>
                                    <button
                                        onClick={() => setPreparedTab('movements')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${preparedTab === 'movements' ? 'bg-white text-orange-700 shadow ring-1 ring-orange-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <History size={16} /> <span className="truncate">Movimientos</span>
                                    </button>
                                </div>
                            )}

                            {activeTab === 'free' && (
                                <div className="grid grid-cols-2 md:flex gap-2 mb-4 w-full md:w-auto">
                                    <button
                                        onClick={() => setFreeTab('stock')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${freeTab === 'stock' ? 'bg-white text-emerald-700 shadow ring-1 ring-emerald-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <Zap size={16} /> <span className="truncate">Libres ({products.filter(p => !p.isStockManaged && !p.requiresPreparation && !['daily_entry', 'daily_main', 'daily_option', 'menu'].includes(p.type)).length})</span>
                                    </button>
                                    <button
                                        onClick={() => setFreeTab('movements')}
                                        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${freeTab === 'movements' ? 'bg-white text-emerald-700 shadow ring-1 ring-emerald-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <History size={16} /> <span className="truncate">Movimientos</span>
                                    </button>
                                </div>
                            )}

                            {(activeTab === 'finished' && finishedTab === 'movements') || (activeTab === 'prepared' && preparedTab === 'movements') || (activeTab === 'free' && freeTab === 'movements') ? (
                                <div className="bg-white rounded-lg shadow overflow-x-auto animate-in fade-in">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                                            <tr>
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Producto</th>
                                                <th className="p-4">Acción</th>
                                                <th className="p-4 text-right">Cantidad</th>
                                                <th className="p-4 text-center">Cuenta</th>
                                                <th className="p-4">Razón</th>
                                                <th className="p-4">Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {loadingMovements ? (
                                                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Cargando movimientos...</td></tr>
                                            ) : movements.length === 0 ? (
                                                <tr><td colSpan="7" className="p-8 text-center text-gray-400 italic">No hay historial de movimientos</td></tr>
                                            ) : (
                                                movements.map(mov => (
                                                    <tr key={mov.id} className="hover:bg-gray-50">
                                                        <td className="p-4 text-gray-500 whitespace-nowrap text-xs">
                                                            {new Date(mov.createdAt).toLocaleString()}
                                                        </td>
                                                        <td className="p-4 font-medium text-gray-900 text-sm">
                                                            {mov.Product?.name || '---'}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit
                                                                ${mov.type === 'add' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                                ${mov.type === 'remove' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                                                ${mov.type === 'sale' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                                ${!['add', 'remove', 'sale'].includes(mov.type) ? 'bg-gray-100 text-gray-800' : ''}
                                                            `}>
                                                                {mov.type === 'add' && <TrendingUp size={12} />}
                                                                {mov.type === 'remove' && <TrendingDown size={12} />}
                                                                {mov.type === 'sale' && <Package size={12} />}
                                                                {mov.type === 'add' ? 'Ingreso' : mov.type === 'remove' ? 'Salida' : mov.type === 'sale' ? 'Venta' : mov.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-medium">
                                                            {mov.amount}
                                                        </td>
                                                        <td className="p-4 text-center">
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
                                                                <span className="text-gray-400 text-xs">---</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-gray-600 text-xs">
                                                            {mov.reason || '---'}
                                                        </td>
                                                        <td className="p-4 text-gray-500 text-xs">
                                                            {mov.User?.displayName || mov.User?.username || 'Sistema'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* DESKTOP TABLE VIEW */
                                <div className="hidden md:block bg-white rounded-lg shadow overflow-visible">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="text-left p-4">Nombre</th>
                                                <th className="text-left p-4">Stock / Detalle</th>
                                                <th className="text-left p-4">Precio</th>
                                                <th className="text-left p-4">Tipo</th>
                                                {!readOnly && <th className="text-right p-4">Acciones</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.filter(product => {
                                                // Menu products are managed via Configurar Menú, not inventory tabs
                                                const excludedTypes = ['daily_entry', 'daily_main', 'daily_option', 'menu'];
                                                if (activeTab === 'finished') {
                                                    // Ensure we are in stock mode
                                                    if (finishedTab === 'movements') return false;
                                                    return product.isStockManaged && !excludedTypes.includes(product.type);
                                                }
                                                if (activeTab === 'prepared') {
                                                    if (preparedTab === 'movements') return false;
                                                    return !product.isStockManaged && product.requiresPreparation && !excludedTypes.includes(product.type);
                                                }
                                                if (activeTab === 'free') {
                                                    if (freeTab === 'movements') return false;
                                                    return !product.isStockManaged && !product.requiresPreparation && !excludedTypes.includes(product.type);
                                                }
                                                return true;
                                            }).filter(product => {
                                                if (!searchQuery) return true;
                                                return product.name.toLowerCase().includes(searchQuery.toLowerCase());
                                            }).map(product => {
                                                const variants = product.ProductVariants || [];
                                                const hasMultipleVariants = variants.length > 1;
                                                const hasVariants = variants.length > 0;
                                                // If only 1 variant, we treat the main row as the variant itself (flat view)
                                                // If >1 variants, we allow expansion (or auto-expand logic if desired, but user asked for "no desplegar" if only 1)
                                                const isExpanded = creatingSection === `expand-${product.id}`;

                                                // Calculations
                                                const totalStock = variants.reduce((sum, v) => sum + parseInt(v.stock || 0), 0);
                                                const singleVariant = variants[0] || {};

                                                return (
                                                    <React.Fragment key={product.id}>
                                                        {/* MAIN ROW */}
                                                        <tr className={`border-b hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                                                            <td className="p-4 font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {/* Only show Expand button if multiple variants exist */}
                                                                    {(activeTab === 'finished' || activeTab === 'prepared' || activeTab === 'free') && hasMultipleVariants && (
                                                                        <button
                                                                            onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                                                        >
                                                                            {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                                                                        </button>
                                                                    )}
                                                                    {/* For single variant, show specific name if different from product? user said "11 un (1lt)" */}
                                                                    {product.name}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                {product.isStockManaged ? (
                                                                    <div className="flex items-center gap-3">
                                                                        {hasMultipleVariants ? (
                                                                            // MULTIPLE VARIANTS: Show Total Stock + Count
                                                                            <div className="flex flex-col">
                                                                                <span className={`font-bold text-lg ${totalStock < 10 ? 'text-red-500' : 'text-green-600'}`}>
                                                                                    {totalStock} <span className="text-xs text-gray-400 font-normal">un.</span>
                                                                                </span>
                                                                                <div className="text-sm text-blue-600 font-bold">
                                                                                    {hasMultipleVariants && variants.length > 1
                                                                                        ? `${variants.length} Presentaciones`
                                                                                        : product.isStockManaged ? `Stock: ${product.stock}` : ''}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            // SINGLE VARIANT: Show its stock + specific presentation name
                                                                            <span className={`font-bold text-lg ${singleVariant.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>
                                                                                {singleVariant.stock} <span className="text-xs text-gray-400 font-normal">un. ({singleVariant.name})</span>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : !product.requiresPreparation ? (
                                                                    // LIBRE/ILIMITADO PRODUCTS
                                                                    <div className="flex items-center justify-between">
                                                                        {hasMultipleVariants ? (
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-bold text-gray-700">{variants.length} Variantes</span>
                                                                                <button
                                                                                    onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                                    className="text-emerald-600 hover:text-emerald-800 text-xs text-left font-semibold"
                                                                                >
                                                                                    {isExpanded ? 'Ocultar' : 'Ver Variantes'}
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-200">
                                                                                Libre
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    // PREPARED PRODUCTS
                                                                    <div className="flex items-center justify-between">
                                                                        {hasMultipleVariants ? (
                                                                            // Multiple: Show Count
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-bold text-gray-700">{variants.length} Variantes</span>
                                                                                {!readOnly && (
                                                                                    <button
                                                                                        onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                                        className="text-orange-600 hover:text-orange-800 text-xs text-left"
                                                                                    >
                                                                                        {isExpanded ? 'Ocultar' : 'Ver Recetas'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            // Single: Show Button
                                                                            !readOnly && (
                                                                                <button
                                                                                    onClick={() => setRecipeProduct(product)}
                                                                                    className="text-orange-600 hover:bg-orange-50 p-1 rounded flex items-center gap-1 text-xs font-bold border border-orange-100"
                                                                                    title="Editar Receta"
                                                                                >
                                                                                    <ChefHat size={14} /> Receta
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="p-4">
                                                                {(() => {
                                                                    if (hasMultipleVariants) {
                                                                        return <div className="font-bold text-gray-500 italic">Variable</div>;
                                                                    }
                                                                    // Single variant price
                                                                    const price = singleVariant.price || product.price || 0;
                                                                    return <div className="font-bold text-gray-900">S/ {Number(parseFloat(price).toFixed(1))}</div>;
                                                                })()}
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs 
                                                                        ${product.type === 'drink' ? 'bg-blue-100 text-blue-800' :
                                                                        product.type === 'daily_entry' ? 'bg-purple-100 text-purple-800' :
                                                                            product.type === 'daily_main' ? 'bg-pink-100 text-pink-800' :
                                                                                product.type === 'daily_option' ? 'bg-gray-100 text-gray-800' :
                                                                                    product.type === 'menu' ? 'bg-indigo-100 text-indigo-800' : 'bg-orange-100 text-orange-800'}`}>
                                                                    {product.type === 'drink' ? 'Bebida' :
                                                                        product.type === 'dish' ? 'Plato' :
                                                                            product.type === 'daily_entry' ? 'Entrada Menú' :
                                                                                product.type === 'daily_main' ? 'Segundo Menú' :
                                                                                    product.type === 'daily_option' ? 'Opción' :
                                                                                        product.type === 'menu' ? 'Menú' : 'Otro'}
                                                                </span>
                                                            </td>
                                                            {!readOnly && (
                                                                <td className="p-4 text-right">
                                                                    <div className="flex justify-end items-center gap-1">
                                                                        {/* STOCK ADJUSTMENT (Only if single variant, otherwise expand to adjust specific) */}
                                                                        {product.isStockManaged && !hasMultipleVariants && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => openAdjustment({
                                                                                        ...product,
                                                                                        variantId: singleVariant.id,
                                                                                        stock: singleVariant.stock
                                                                                    }, 'add')}
                                                                                    className="bg-green-100 text-green-700 hover:bg-green-200 p-1.5 rounded flex items-center gap-1 text-xs font-bold mr-2 border border-green-200"
                                                                                    title="Agregar Stock"
                                                                                >
                                                                                    <Plus size={14} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => openAdjustment({
                                                                                        ...product,
                                                                                        variantId: singleVariant.id,
                                                                                        stock: singleVariant.stock
                                                                                    }, 'remove')}
                                                                                    className="bg-red-100 text-red-700 hover:bg-red-200 p-1.5 rounded flex items-center gap-1 text-xs font-bold mr-4 border border-red-200"
                                                                                    title="Eliminar Stock"
                                                                                >
                                                                                    <Minus size={14} />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {product.isStockManaged && hasMultipleVariants && (
                                                                            <button
                                                                                onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                                className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200 mr-2 border border-gray-200 text-xs"
                                                                            >
                                                                                Ver Stock
                                                                            </button>
                                                                        )}
                                                                        <button onClick={() => handleEdit(product)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded">
                                                                            <Edit2 size={18} />
                                                                        </button>
                                                                        <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                        {/* EXPANDED ROW FOR VARIANTS - Only if Multiple Variants Exist */}
                                                        {isExpanded && hasMultipleVariants && (
                                                            <tr className="bg-gray-50 animate-in slide-in-from-top-2">
                                                                <td colSpan="5" className="p-4 pl-12">
                                                                    <div className="bg-white rounded border shadow-sm overflow-hidden">
                                                                        <table className="w-full text-sm">
                                                                            <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                                                                                <tr>
                                                                                    <th className="p-3 text-left pl-4">Presentación</th>
                                                                                    <th className="p-3 text-left">
                                                                                        {product.isStockManaged ? 'Stock' : product.requiresPreparation ? 'Receta' : 'Detalle'}
                                                                                    </th>
                                                                                    <th className="p-3 text-left">Precio</th>
                                                                                    {!readOnly && <th className="p-3 text-right pr-4">Acciones</th>}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y">
                                                                                {variants.map(v => (
                                                                                    <tr key={v.id} className="hover:bg-gray-50">
                                                                                        <td className="p-3 pl-4 font-bold text-gray-700">{v.name}</td>
                                                                                        <td className="p-3">
                                                                                            {product.isStockManaged ? (
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className={`font-bold text-base ${v.stock < 5 ? 'text-red-600' : 'text-green-700'}`}>
                                                                                                        {v.stock}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : product.requiresPreparation ? (
                                                                                                <button
                                                                                                    onClick={() => setRecipeProduct(product)}
                                                                                                    className="text-orange-600 hover:bg-orange-50 p-1 rounded flex items-center gap-1 text-xs font-bold border border-orange-100"
                                                                                                    title="Ver/Editar Receta"
                                                                                                >
                                                                                                    <ChefHat size={14} /> Configurar
                                                                                                </button>
                                                                                            ) : (
                                                                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-200">
                                                                                                    Libre
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="p-3 font-mono text-gray-600">S/ {Number(parseFloat(v.price).toFixed(1))}</td>
                                                                                        {!readOnly && (
                                                                                            <td className="p-3 text-right pr-4">
                                                                                                <div className="flex gap-2 justify-end">
                                                                                                    {product.isStockManaged && (
                                                                                                        <>
                                                                                                            <button
                                                                                                                onClick={() => openAdjustment({ ...product, name: `${product.name} (${v.name})`, variantId: v.id, stock: v.stock }, 'add')}
                                                                                                                className="bg-green-100 text-green-600 p-1.5 rounded hover:bg-green-200"
                                                                                                                title="Agregar Stock"
                                                                                                            >
                                                                                                                <Plus size={14} />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={() => openAdjustment({ ...product, name: `${product.name} (${v.name})`, variantId: v.id, stock: v.stock }, 'remove')}
                                                                                                                className="bg-red-100 text-red-600 p-1.5 rounded hover:bg-red-200"
                                                                                                                title="Quitar Stock"
                                                                                                            >
                                                                                                                <Minus size={14} />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                        )}
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}

                                        </tbody>
                                    </table>
                                </div >
                            )
                            }

                            {/* MOBILE CARD VIEW (Keep simple for now, maybe hide adjustments in mobile or add later to avoid complexity) 
                                 Actually let's just show stock number in Mobile and rely on Desktop for extensive management for now unless requested.
                                 Or simply render standard cards.
                            */}
                            {
                                ((activeTab === 'finished' && finishedTab === 'stock') || (activeTab === 'prepared' && preparedTab === 'stock') || (activeTab === 'free' && freeTab === 'stock')) && (
                                    <div className="md:hidden grid grid-cols-1 gap-4">
                                        {products.filter(p => {
                                            const excludedTypes = ['daily_entry', 'daily_main', 'daily_option', 'menu'];
                                            if (activeTab === 'finished') return p.isStockManaged && !excludedTypes.includes(p.type);
                                            if (activeTab === 'prepared') return !p.isStockManaged && p.requiresPreparation && !excludedTypes.includes(p.type);
                                            if (activeTab === 'free') return !p.isStockManaged && !p.requiresPreparation && !excludedTypes.includes(p.type);
                                            if (activeTab === 'menu_options') return ['daily_entry', 'daily_main', 'daily_option'].includes(p.type);
                                            return true;
                                        }).filter(p => {
                                            if (!searchQuery) return true;
                                            return p.name.toLowerCase().includes(searchQuery.toLowerCase());
                                        }).map(product => {
                                            const variants = product.ProductVariants || [];
                                            const hasMultipleVariants = variants.length > 1;
                                            const totalStock = variants.reduce((sum, v) => sum + parseInt(v.stock || 0), 0);
                                            const singleVariant = variants[0] || {};
                                            const displayStock = variants.length > 0
                                                ? (hasMultipleVariants ? totalStock : (singleVariant.stock !== undefined ? singleVariant.stock : 0))
                                                : (product.stock || 0);
                                            const isExpanded = creatingSection === `expand-${product.id}`;

                                            return (
                                                <div key={product.id} className="bg-white p-4 rounded-lg shadow border flex flex-col gap-3">
                                                    <div className="flex justify-between items-start w-full">
                                                        <div className="flex-1">
                                                            <div className="font-bold text-lg text-gray-800">{product.name}</div>
                                                            <div className="text-sm text-gray-500 mb-1">
                                                                <span className={`px-2 py-0.5 rounded text-xs mr-2 ${product.type === 'daily_option' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                    {product.type === 'daily_option' ? 'Opción Menú' : product.type}
                                                                </span>
                                                                <span>
                                                                    {hasMultipleVariants 
                                                                        ? 'Precio Variable' 
                                                                        : `S/ ${Number(parseFloat(singleVariant.price || product.price || 0).toFixed(1))}`
                                                                    }
                                                                </span>
                                                            </div>
                                                            {!readOnly && !product.isStockManaged && product.requiresPreparation && (
                                                                <button onClick={() => setRecipeProduct(product)} className="text-orange-600 font-bold flex items-center gap-1 mt-1.5 text-xs"><ChefHat size={12} /> Receta</button>
                                                            )}
                                                            {product.isStockManaged ? (
                                                                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                                                    {hasMultipleVariants ? (
                                                                        <button
                                                                            onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm hover:bg-blue-100 transition-colors active:scale-95"
                                                                        >
                                                                            Stock: {totalStock} ({variants.length} Pres.) {isExpanded ? '▲' : '▼'}
                                                                        </button>
                                                                    ) : (
                                                                        <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                                                            Stock: {displayStock} {singleVariant.name && singleVariant.name !== 'Estándar' ? `(${singleVariant.name})` : ''}
                                                                        </span>
                                                                    )}

                                                                    {!readOnly && (
                                                                        <div className="flex gap-1 items-center">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (hasMultipleVariants) {
                                                                                        openAdjustment(product, 'add');
                                                                                    } else {
                                                                                        openAdjustment({
                                                                                            ...product,
                                                                                            variantId: singleVariant.id,
                                                                                            stock: singleVariant.stock
                                                                                        }, 'add');
                                                                                    }
                                                                                }}
                                                                                className="bg-green-50 text-green-700 hover:bg-green-100 p-1 rounded-md border border-green-200 w-7 h-7 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                                                                                title="Agregar Stock"
                                                                            >
                                                                                <Plus size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (hasMultipleVariants) {
                                                                                        openAdjustment(product, 'remove');
                                                                                    } else {
                                                                                        openAdjustment({
                                                                                            ...product,
                                                                                            variantId: singleVariant.id,
                                                                                            stock: singleVariant.stock
                                                                                        }, 'remove');
                                                                                    }
                                                                                }}
                                                                                className="bg-red-50 text-red-700 hover:bg-red-100 p-1 rounded-md border border-red-200 w-7 h-7 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                                                                                title="Quitar Stock"
                                                                            >
                                                                                <Minus size={14} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`inline-block border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm
                                                                        ${product.requiresPreparation 
                                                                            ? 'bg-orange-50 text-orange-700 border-orange-200' 
                                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                                        {product.requiresPreparation ? 'Preparado' : 'Libre'}
                                                                    </span>
                                                                    {hasMultipleVariants && (
                                                                        <button
                                                                            onClick={() => setCreatingSection(isExpanded ? null : `expand-${product.id}`)}
                                                                            className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm hover:bg-gray-100 transition-colors active:scale-95"
                                                                        >
                                                                            {variants.length} Variantes {isExpanded ? '▲' : '▼'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {!readOnly && (
                                                            <div className="flex gap-2 shrink-0">
                                                                <button onClick={() => handleEdit(product)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 active:scale-95 transition-all"><Edit2 size={18} /></button>
                                                                <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100 active:scale-95 transition-all"><Trash2 size={18} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isExpanded && hasMultipleVariants && (
                                                        <div className="mt-1 pt-3 border-t border-gray-100 w-full space-y-2.5 animate-in slide-in-from-top-1">
                                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                                Presentaciones / Stock:
                                                            </div>
                                                            {variants.map(v => (
                                                                <div key={v.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-sm text-gray-700">{v.name}</span>
                                                                        <span className="text-xs text-gray-500 font-mono">S/ {Number(parseFloat(v.price || 0).toFixed(1))}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {product.isStockManaged ? (
                                                                            <>
                                                                                <span className={`font-bold text-xs px-2.5 py-1 rounded-full border shadow-sm ${v.stock < 5 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                                                    Stock: {v.stock}
                                                                                </span>
                                                                                {!readOnly && (
                                                                                    <div className="flex gap-1">
                                                                                        <button
                                                                                            onClick={() => openAdjustment({ ...product, name: `${product.name} (${v.name})`, variantId: v.id, stock: v.stock }, 'add')}
                                                                                            className="bg-green-50 text-green-700 hover:bg-green-100 p-1 rounded-md border border-green-200 w-7 h-7 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                                                                                            title="Agregar Stock"
                                                                                        >
                                                                                            <Plus size={14} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => openAdjustment({ ...product, name: `${product.name} (${v.name})`, variantId: v.id, stock: v.stock }, 'remove')}
                                                                                            className="bg-red-50 text-red-700 hover:bg-red-100 p-1 rounded-md border border-red-200 w-7 h-7 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                                                                                            title="Quitar Stock"
                                                                                        >
                                                                                            <Minus size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : product.requiresPreparation ? (
                                                                            <button
                                                                                onClick={() => setRecipeProduct(product)}
                                                                                className="text-orange-600 hover:bg-orange-50 p-1 rounded flex items-center gap-1 text-xs font-bold border border-orange-100"
                                                                                title="Ver/Editar Receta"
                                                                            >
                                                                                <ChefHat size={14} /> Configurar
                                                                            </button>
                                                                        ) : (
                                                                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-200">
                                                                                Libre
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            }
                        </>
                    )}
                    {/* ACCOUNT DETAIL MODAL */}
                    {selectedAccountId && (
                        <AccountDetailsModal
                            accountId={selectedAccountId}
                            onClose={() => setSelectedAccountId(null)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

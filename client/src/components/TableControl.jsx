import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ShoppingCart, Utensils, Beer, X, Check, FileText, Search, Plus, Minus, Trash2, Clock, CheckCircle, ArrowRightLeft, Wine, Tag, ChevronRight, AlertCircle, Loader2, Printer, Download } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import TableTransferModal from './TableTransferModal';

export default function TableControl({ tableId, accountId, onClose }) {
    const { user, refreshTrigger, refreshData } = useRestaurant();
    const [account, setAccount] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('dish'); // Default to 'dish'
    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false); // New State for Transfer

    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [issueInvoice, setIssueInvoice] = useState(false);
    const [invoiceType, setInvoiceType] = useState('boleta');

    // Client Editing State
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [clientForm, setClientForm] = useState({ name: '', dni: '', accountType: 'standard' });
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [successInvoice, setSuccessInvoice] = useState(null);

    const searchClientData = async () => {
        const doc = clientForm.dni.trim();
        if (doc.length !== 8 && doc.length !== 11) {
            alert('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');
            return;
        }
        setIsSearchingClient(true);
        try {
            const res = await axios.get(`/api/billing/consulta?doc=${doc}`);
            if (res.data) {
                let fullName = '';
                if (doc.length === 11) {
                    fullName = res.data.razon_social || res.data.razonSocial || '';
                } else {
                    fullName = `${res.data.nombres || ''} ${res.data.apellidoPaterno || ''} ${res.data.apellidoMaterno || ''}`.trim();
                    if (!fullName) fullName = res.data.nombre || res.data.nombreCompleto || '';
                }
                if (fullName) {
                    setClientForm(prev => ({ ...prev, name: fullName }));
                } else {
                    alert('No se encontró el nombre para este documento.');
                }
            }
        } catch (err) {
            alert(err.response?.data?.error || 'No se encontró información para este documento.');
        } finally {
            setIsSearchingClient(false);
        }
    };

    // Menu Daily State
    const [viewMode, setViewMode] = useState('products'); // 'products' | 'menu_builder'
    const [dailyMenu, setDailyMenu] = useState({ entries: [], mains: [], activeGroups: [] });
    const [menuSelection, setMenuSelection] = useState({ entry: '', main: '' });
    const [pendingMenuProduct, setPendingMenuProduct] = useState(null);
    const [pendingVariantProduct, setPendingVariantProduct] = useState(null); // For aggregating variant selection
    const [deleteConfirmId, setDeleteConfirmId] = useState(null); // For inline delete confirmation

    // 2x1 Drink Promotions State
    const [drinkPromotions, setDrinkPromotions] = useState([]);
    const [pendingComboPromo, setPendingComboPromo] = useState(null); // promo being built
    const [comboSelection, setComboSelection] = useState([]); // array of up to 2 selected items

    // Helper to group identical orders (Optimized O(N))
    const groupOrders = (orders) => {
        if (!orders) return [];
        const groups = new Map();

        for (const o of orders) {
            const key = `${o.ProductId}|${o.subItemsData || ''}|${o.presentation || ''}|${o.notes || ''}|${o.priceAtOrder}`;
            if (groups.has(key)) {
                groups.get(key).quantity += o.quantity;
            } else {
                // Determine Name for sorting/display efficiency
                let pName = "Producto desconocido";
                if (o.Product && o.Product.name) {
                    pName = o.Product.name;
                }
                // Store a shallow copy to aggregate quantity without mutating original
                groups.set(key, { ...o, key, _pName: pName });
            }
        }
        return Array.from(groups.values());
    };

    // Memoize heavily to avoid re-calc on every render
    const groupedOrders = React.useMemo(() => groupOrders(account?.Orders), [account?.Orders]);

    // Happy Hour Check Utility
    const isHappyHourActive = (startStr, endStr) => {
        if (!startStr || !endStr) return false;
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        if (startStr <= endStr) {
            // Normal range (e.g., 10:00 to 17:00)
            return currentTimeStr >= startStr && currentTimeStr <= endStr;
        } else {
            // Cross-midnight range (e.g., 20:00 to 07:00)
            return currentTimeStr >= startStr || currentTimeStr <= endStr;
        }
    };

    // Reset viewMode when category changes
    useEffect(() => {
        if (selectedCategory !== 'combo') {
            setViewMode('products');
        } else {
            setViewMode('combo_categories');
        }
        setPendingMenuProduct(null);
        setPendingVariantProduct(null);
    }, [selectedCategory]);

    const parseMenuData = (items) => {
        if (!items) return [];
        // Support legacy string arrays or new objects
        return items.map(item => {
            if (typeof item === 'string') return { name: item, stock: 99, groupName: 'Menú del Día' };
            // Ensure groupName exists for compatibility
            return { ...item, groupName: item.groupName || 'Menú del Día' };
        });
    };

    const fetchDailyMenu = async () => {
        try {
            // Send client local date to avoid UTC mismatches
            const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            const res = await axios.get(`/api/menu/daily?date=${localDate}`);
            if (res.data) {
                const allItems = [...(res.data.entries || []), ...(res.data.mains || [])];
                const activeGroups = [...new Set(allItems.map(i => i.groupName).filter(n => n))];

                setDailyMenu({
                    entries: parseMenuData(res.data.entries),
                    mains: parseMenuData(res.data.mains),
                    activeGroups
                });
            }
        } catch (err) {
            console.error("Error fetching daily menu", err);
        }
    };

    const fetchDrinkPromotions = async () => {
        try {
            const res = await axios.get('/api/drink-promotions');
            setDrinkPromotions(res.data || []);
        } catch (err) {
            console.error('Error fetching drink promotions', err);
        }
    };

    useEffect(() => {
        loadTableData();
        fetchProducts();
        fetchAccount();
        fetchDailyMenu();
        fetchDrinkPromotions(); // Loading 2x1 promos

        // Escape Key Listener
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // If payment modal is open, close it first
                if (showPaymentModal) {
                    setShowPaymentModal(false);
                } else if (showTransferModal) {
                    setShowTransferModal(false);
                } else if (pendingVariantProduct) {
                    setPendingVariantProduct(null);
                } else if (isEditingClient) {
                    setIsEditingClient(false);
                } else {
                    handleClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tableId, refreshTrigger, showPaymentModal, pendingVariantProduct]);

    // Explicitly fetching products to ensure real-time sync
    const fetchProducts = async () => {
        try {
            console.log("[TableControl] Fetching Products...");
            const prodRes = await axios.get(`/api/products?t=${Date.now()}`);
            setProducts(prodRes.data);
            console.log("[TableControl] Products Loaded:", prodRes.data.length);
        } catch (pErr) {
            console.error("Error loading products:", pErr);
        }
    };

    // Explicitly fetching account
    const fetchAccount = async () => {
        try {
            let url = `/api/accounts/table/${tableId}?t=${Date.now()}`;
            if (accountId) {
                url = `/api/accounts/specific/${accountId}?t=${Date.now()}`;
            }

            const accRes = await axios.get(url);
            if (accRes.data) {
                setAccount(accRes.data);
                setClientForm({
                    name: accRes.data.customerName,
                    dni: accRes.data.clientDni || '',
                    accountType: accRes.data.accountType || 'standard'
                });

                // If viewing a history account and we didn't pass tableId, try to load its historical table
                if (accountId && !tableId && accRes.data.TableId) {
                    loadTableDataFromAcc(accRes.data.TableId);
                }
            } else {
                setAccount(null);
                setClientForm(prev => ({ name: 'Cliente', dni: '', accountType: prev.accountType || 'standard' }));
            }
        } catch (aErr) {
            console.error("Error loading account:", aErr);
        }
    };

    const loadTableDataFromAcc = async (resolvedTableId) => {
        try {
            const tableRes = await axios.get(`/api/tables/${resolvedTableId}?t=${Date.now()}`);
            setTableData(tableRes.data);
        } catch (tErr) {
            console.error("Error loading table from account:", tErr);
        }
    };

    const loadTableData = async () => {
        if (!tableId) return;
        try {
            const tableRes = await axios.get(`/api/tables/${tableId}?t=${Date.now()}`);
            setTableData(tableRes.data);
        } catch (tErr) {
            console.error("Error loading table:", tErr);
        }
    };

    // Initial Load & Context Trigger
    useEffect(() => {
        if (tableId) loadTableData();
        fetchProducts();
        fetchAccount();
        fetchDailyMenu();
        fetchDrinkPromotions();
    }, [tableId, accountId, refreshTrigger]);

    // DIRECT SOCKET LISTENER (Redundancy for safety)
    const { socket } = useRestaurant(); // Ensure socket is exposed in Context
    useEffect(() => {
        if (!socket) return;

        const handleProductUpdate = () => {
            console.log("[TableControl] Direct Socket Event: product_updated");
            fetchProducts();
            fetchDailyMenu(); // Update menus too
            // Account might change if order deleted
            fetchAccount();
        };

        socket.on('product_updated', handleProductUpdate);

        return () => {
            socket.off('product_updated', handleProductUpdate);
        };
    }, [socket]); // Re-bind if socket changes

    // Set loading false after initial checks
    useEffect(() => {
        // Simple timeout to clear loading state if it gets stuck, 
        // or we can set it false after all fetches return. 
        // For now, let's just set it false after mount since we have optimistic UI.
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const lastSearchRef = useRef('');

    // --- NEW: Custom Staff Confirmation ---
    const [showStaffConfirm, setShowStaffConfirm] = useState(false);
    // --------------------------------------

    // --- 2x1 & MENU LOGIC START ---
    const handleClose = async () => {
        // If an account was opened but has NO orders, cancel it to free the table.
        // Even if there are items in the local cart, they will be lost anyway.
        if (account && (!account.Orders || account.Orders.length === 0)) {
            try {
                await axios.post(`/api/accounts/${account.id}/cancel`);
            } catch (err) {
                console.error("Error auto-cancelling empty account on close:", err);
            }
        } else if (!account && tableData && tableData.status !== 'free') {
            // Self-healing: Table is marked occupied or reserved in UI but has no active account
            try {
                await axios.put(`/api/tables/${tableId}`, { status: 'free' });
                refreshData(); // Trigger UI rebuild
            } catch (err) {
                console.error("Error freeing orphan table:", err);
            }
        }
        onClose();
    };

    const handleAutoOpen = async () => {
        try {
            const res = await axios.post('/api/accounts/open', {
                tableId,
                customerName: clientForm.accountType === 'staff' ? 'Personal' : 'Cliente',
                clientDni: '',
                userId: user?.id || null,

                accountType: clientForm.accountType
            });
            setAccount(res.data);
            setClientForm({
                name: res.data.customerName,
                dni: res.data.clientDni || '',
                accountType: res.data.accountType || 'standard'
            });
            return res.data;
        } catch (err) {
            console.error("Error auto-opening:", err);
            const errorMsg = err.response?.data?.error || err.message || "Error desconocido";

            if (errorMsg === 'Mesa ya ocupada') {
                console.log("Mesa ya ocupada, recargando datos...");
                await loadData();
                return null;
            }

            alert(`Error al abrir la cuenta automaticamente: ${errorMsg}`);
            return null;
        }
    };

    const updateClientInfo = async () => {
        try {
            const res = await axios.put(`/api/accounts/${account.id}`, {
                customerName: clientForm.name,
                clientDni: clientForm.dni,
                accountType: clientForm.accountType
            });
            setAccount(res.data);
            setIsEditingClient(false);
        } catch (err) {
            alert('Error actualizando cliente');
        }
    };

    const handleProductClick = (product) => {
        // 1. Check for Variants (Prefer Relational Model over JSON)
        if (product.ProductVariants && product.ProductVariants.length > 0) {
            console.log("Using Relational ProductVariants:", product.ProductVariants);
            const allOptions = product.ProductVariants.map(v => ({
                name: v.name,
                price: v.price,
                stock: getEffectiveStock(product, v.name),
                id: v.id,
                happyHourPrice: v.happyHourPrice,
                happyHourStart: v.happyHourStart,
                happyHourEnd: v.happyHourEnd
            }));

            // Auto-add if there's exactly 1 option
            if (allOptions.length === 1) {
                const singleOption = allOptions[0];
                const isHH = singleOption.happyHourPrice && isHappyHourActive(singleOption.happyHourStart, singleOption.happyHourEnd);
                const finalPrice = isHH ? singleOption.happyHourPrice : singleOption.price;
                addToCart(product, '', [], singleOption.name, finalPrice);
                return;
            }

            setPendingVariantProduct({ ...product, parsedVariants: allOptions });
            return;
        }

        // Fallback to JSON (Legacy)
        if (product.presentations) {
            try {
                const variants = typeof product.presentations === 'string' ? JSON.parse(product.presentations) : product.presentations;
                if (Array.isArray(variants) && variants.length > 0) {
                    // Filter out 'Normal' if it's explicitly recreating it; Map actual specific variants
                    const allOptions = variants.map(v => ({
                        name: v.name,
                        price: v.price || product.price,
                        stock: getEffectiveStock(product, v.name)
                    }));
                    setPendingVariantProduct({ ...product, parsedVariants: allOptions });
                    return;
                }
            } catch (e) { console.error("Error parsing variants", e); }
        }

        // 2. Default Add
        addToCart(product);
    };

    const addToCart = (product, specificNotes = '', subItems = [], presentationName = null, overridePrice = null) => {
        // Intercept Menu Type -> Switch to Inline Builder
        if (product.type === 'menu' && !specificNotes) {
            setPendingMenuProduct(product);
            // Ensure menu data is fresh
            if (dailyMenu.entries.length === 0) fetchDailyMenu();
            setViewMode('menu_builder'); // Switch View
            setMenuSelection({ entry: '', main: '' });
            return;
        }

        const isStaffConsumption = (account?.accountType === 'staff') || (!account && clientForm?.accountType === 'staff');

        let originalPriceCalc = overridePrice !== null ? parseFloat(overridePrice) : (product.price !== undefined ? parseFloat(product.price) : 0);

        // Ensure originalPriceCalc captures the variant price if provided and not overwritten by a staff 0
        if (presentationName && product.parsedVariants) {
            const variantEntry = product.parsedVariants.find(v => v.name === presentationName);
            if (variantEntry) {
                const isHH = variantEntry.happyHourPrice && isHappyHourActive(variantEntry.happyHourStart, variantEntry.happyHourEnd);
                originalPriceCalc = isHH ? parseFloat(variantEntry.happyHourPrice) : parseFloat(variantEntry.price);
            }
        }

        const finalPriceCalc = isStaffConsumption ? 0 : (overridePrice !== null ? parseFloat(overridePrice) : originalPriceCalc);

        setCart(prev => {
            // Use custom ticket name over original name if provided (helpful for decoupled combos)
            const finalName = product.customNameForTicket || product.name;
            const existingIndex = prev.findIndex(item =>
                item.productId === product.id &&
                item.notes === (specificNotes || '') &&
                item.name === finalName &&
                JSON.stringify(item.subItems) === JSON.stringify(subItems)
            );

            if (existingIndex !== -1) {
                const newCart = [...prev];
                newCart[existingIndex] = {
                    ...newCart[existingIndex],
                    quantity: newCart[existingIndex].quantity + 1
                };
                return newCart;
            }
            return [...prev, {
                productId: product.id,
                name: finalName,
                price: finalPriceCalc,
                originalPrice: originalPriceCalc,
                quantity: 1,
                notes: specificNotes || '',
                subItems: subItems,
                presentation: presentationName // Important: Send this to backend
            }];
        });
    };

    const confirmMenuSelection = () => {
        if (!menuSelection.entry && !menuSelection.main) {
            alert("Debes seleccionar al menos una Entrada o un Segundo");
            return;
        }

        // Find linked IDs and Menu Item IDs
        const entryObj = filteredEntries.find(e => e.name === menuSelection.entry && (e.groupName || 'Menú del Día') === pendingMenuProduct.name);
        const mainObj = filteredMains.find(m => m.name === menuSelection.main && (m.groupName || 'Menú del Día') === pendingMenuProduct.name);

        const subItems = [];
        let totalCustomPrice = 0;
        let isCombo = false;

        if (menuSelection.entry && menuSelection.main) {
            isCombo = true;
        }

        // Add Entry
        if (entryObj && menuSelection.entry) {
            subItems.push({
                productId: entryObj.linkId || null,
                menuItemId: entryObj.id || null, // BACKWARD COMPATIBILITY: Allow null if no ID
                quantity: 1,
                name: entryObj.name, // For display/logging
                price: entryObj.individualPrice || 0 // Individual price
            });
            if (!isCombo) totalCustomPrice += Number(entryObj.individualPrice || 0);
        }

        // Add Main
        if (mainObj && menuSelection.main) {
            subItems.push({
                productId: mainObj.linkId || null,
                menuItemId: mainObj.id || null,
                quantity: 1,
                name: mainObj.name,
                price: mainObj.individualPrice || 0
            });
            if (!isCombo) totalCustomPrice += Number(mainObj.individualPrice || 0);
        }

        let note = '';
        if (isCombo) {
            note = `Combo: ${menuSelection.entry || 'N/A'} + ${menuSelection.main || 'N/A'}`;
        } else if (menuSelection.entry) {
            note = `Solo: ${menuSelection.entry}`;
        } else if (menuSelection.main) {
            note = `Solo: ${menuSelection.main}`;
        }

        // If it's a dynamic menu (Virtual), use its name as Presentation to show on bill
        // e.g. Product: "Menú del Día", Presentation: "Menú Lunes"
        const presentation = pendingMenuProduct.isVirtualGroup ? pendingMenuProduct.name : null;

        // Clone the product to give it a custom name/price if it's an individual item
        const productToCart = { ...pendingMenuProduct };
        let overridePrice = null;
        if (!isCombo) {
            overridePrice = totalCustomPrice;
            productToCart.price = totalCustomPrice;
        }

        addToCart(productToCart, note, subItems, presentation, overridePrice);
        setViewMode('products'); // Return to List
        setPendingMenuProduct(null);
        setMenuSelection({ entry: null, main: null }); // Reset selection just in case
    };

    const cancelMenuSelection = () => {
        setViewMode('products');
        setPendingMenuProduct(null);
    };

    const sendOrder = async () => {
        if (cart.length === 0) return;

        let targetAccountId = account?.id;

        try {
            if (!targetAccountId) {
                // Open account NOW because we are sending an order
                const newAccount = await handleAutoOpen();
                if (!newAccount) return;
                targetAccountId = newAccount.id;
            }

            await axios.post('/api/orders', {
                accountId: targetAccountId,
                products: cart,
                userId: user?.id || null

            });
            setCart([]);

            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            // Also trigger global refresh to update other components
            refreshData();

            setShowMobileCart(false);
        } catch (err) {
            const errorMsg = err.response?.data?.details?.join('\n') || err.response?.data?.error || 'Error enviando pedido';
            alert(errorMsg);
            console.error(err);
        }
    };

    const updateOrderStatus = async (orderId, status) => {
        try {
            await axios.put(`/api/orders/${orderId}/status`, { status });
            // Socket will trigger refresh via context
        } catch (err) {
            alert("Error actualizando estado");
        }
    };

    const handleDeleteOrder = async (orderId) => {
        setDeleteConfirmId(null); // Clear inline confirmation
        try {
            await axios.delete(`/api/orders/${orderId}`);
            // Force reload manually to see price update immediately
            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            refreshData();

        } catch (err) {
            alert("Error eliminando pedido");
            console.error(err);
        }
    };

    const handleCloseClick = async () => {
        if (!account) {
            if (tableData && tableData.status !== 'free') {
                try {
                    await axios.put(`/api/tables/${tableId}`, { status: 'free' });
                    refreshData();
                } catch (e) { }
            }
            onClose();
            return;
        }

        // Case: Liberar Mesa (No orders or explicit release)
        if (!account.Orders || account.Orders.length === 0) {
            if (!confirm("¿Liberar mesa y cancelar cuenta vacía?")) return;
            try {
                await axios.post(`/api/accounts/${account.id}/cancel`);
                // Refresh table status in background or just close
                onClose();
            } catch (e) {
                alert("Error liberando mesa");
            }
            return;
        }

        if (account.accountType === 'staff') {
            if (!confirm("¿Cerrar consumo de personal? (Total S/ 0)")) return;
            try {
                const formData = new FormData();
                formData.append('paymentMethod', 'consumo_interno');
                await axios.post(`/api/accounts/${account.id}/close`, formData);
                onClose();
                refreshData();
            } catch (e) {
                alert("Error al cerrar consumo de personal");
            }
            return;
        }

        setShowPaymentModal(true);
        setIsConfirmingPayment(false); // Reset confirmation state
        
        // Auto-detect invoice type based on client form
        if (clientForm.dni) {
            setIssueInvoice(true);
            setInvoiceType(clientForm.dni.length === 11 ? 'factura' : 'boleta');
        } else {
            setIssueInvoice(false);
            setInvoiceType('boleta');
        }
    };

    const confirmPayment = async () => {
        // Instead of native confirm(), we use a UI-based confirmation step
        if (!isConfirmingPayment) {
            setIsConfirmingPayment(true);
            return;
        }

        if (issueInvoice) {
            if (invoiceType === 'factura') {
                if (!clientForm.dni || clientForm.dni.length !== 11) {
                    alert('Para emitir una Factura es obligatorio ingresar un RUC válido de 11 dígitos. Por favor, ingréselo en el formulario.');
                    setIsConfirmingPayment(false);
                    return;
                }
            } else if (invoiceType === 'boleta') {
                if (!clientForm.dni) {
                    const proceed = window.confirm('No ha ingresado un documento. La boleta se emitirá a "CLIENTES VARIOS". ¿Desea continuar o prefiere cancelar para ingresar los datos del cliente?');
                    if (!proceed) {
                        setIsConfirmingPayment(false);
                        return;
                    }
                }
            }
        }

        try {
            // Save inline client edits if any
            if (account && (clientForm.dni !== account.clientDni || clientForm.name !== account.customerName)) {
                await axios.put(`/api/accounts/${account.id}`, {
                    customerName: clientForm.name,
                    clientDni: clientForm.dni,
                    accountType: clientForm.accountType
                });
            }

            // Pre-create invoice if requested
            let resInvoiceData = null;
            if (issueInvoice) {
                const itemsToBill = groupedOrders.map(o => {
                    let pName = "Producto";
                    let displayNotes = o.notes;
                    if (!o.ProductId && o.notes) {
                        pName = `2x1: ${o.notes}`;
                        displayNotes = null;
                    } else if (o.Product && o.Product.name) {
                        pName = o.Product.name;
                    }
                    const fullDesc = `${pName} ${o.presentation ? `(${o.presentation})` : ''} ${displayNotes ? `- ${displayNotes}` : ''}`.trim();
                    
                    return {
                        description: fullDesc,
                        qty: o.quantity,
                        amount: o.quantity * parseFloat(o.priceAtOrder)
                    };
                });
                
                const resInvoice = await axios.post('/api/billing/invoices', {
                    tipo: invoiceType,
                    clienteDocumento: clientForm.dni || '00000000',
                    clienteNombre: clientForm.name || 'CLIENTES VARIOS',
                    items: itemsToBill,
                    userId: user.id
                });
                resInvoiceData = resInvoice.data;
            }

            const formData = new FormData();
            formData.append('paymentMethod', paymentMethod);
            if (evidenceFiles && evidenceFiles.length > 0) {
                for (let i = 0; i < evidenceFiles.length; i++) {
                    formData.append('evidence', evidenceFiles[i]);
                }
            }

            await axios.post(`/api/accounts/${account.id}/close`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (issueInvoice && resInvoiceData && resInvoiceData.success) {
                setSuccessInvoice({
                    invoice: resInvoiceData.invoice,
                    sunatResponse: resInvoiceData.sunatResponse
                });
                setIsConfirmingPayment(false);
                setEvidenceFiles([]);
            } else {
                setIsConfirmingPayment(false);
                setShowPaymentModal(false);
                setEvidenceFiles([]); // Reset file
                onClose();
            }
        } catch (err) {
            alert('Error cerrando cuenta: ' + (err.response?.data?.error || err.message));
            setIsConfirmingPayment(false); // Reset on error
        }
    };

    // === MENU DATA PARSING ===
    // The DB stores all items in 'entries' with a 'category' field ('entry' or 'main').
    // We need to split them for the UI logic.
    const { parsedEntries, parsedMains, menuGroups } = React.useMemo(() => {
        if (!dailyMenu || !dailyMenu.entries) return { parsedEntries: [], parsedMains: [], menuGroups: [] };

        const allItems = [...dailyMenu.entries, ...(dailyMenu.mains || [])];

        // 1. Split by Category (Robust: If 'main', it's main. Else, it's entry).
        const pEntries = [];
        const pMains = [];

        allItems.forEach(item => {
            if (item.category === 'main') {
                pMains.push(item);
            } else {
                pEntries.push(item); // Default to entry if category missing/mismatched
            }
        });

        // 2. Extract Groups
        const groupsMap = {};
        allItems.forEach(item => {
            const gName = item.groupName || 'Menú del Día';

            // 1. Try Exact/Normalized Match
            const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            let realProduct = products.find(p => p.name === gName || normalize(p.name) === normalize(gName));
            let isFallback = false;

            // 2. Fallback Strategy: Find ANY 'menu' type product
            if (!realProduct) {
                // Prefer "Menú del Día" or "Menu del Dia" as generic base
                realProduct = products.find(p => normalize(p.name).includes("menu del dia"));

                // If not found, take ANY menu
                if (!realProduct) {
                    realProduct = products.find(p => p.type === 'menu');
                }

                if (realProduct) {
                    isFallback = true;
                    // console.log(`[TableControl] Using Fallback Product "${realProduct.name}" (ID: ${realProduct.id}) for Dynamic Group "${gName}"`);
                }
            }

            if (!groupsMap[gName]) {
                groupsMap[gName] = {
                    id: realProduct ? realProduct.id : `menu-group-${gName}`, // Valid ID if fallback found
                    name: gName, // Keep the Dynamic Name (e.g., "Menú Lunes")
                    price: item.menuPrice || (realProduct ? realProduct.price : 0),
                    type: 'menu',
                    isStockManaged: false,
                    isVirtualGroup: !realProduct || isFallback,
                    fallbackOriginalName: realProduct ? realProduct.name : null // Store base name
                };
            }
        });

        return {
            parsedEntries: pEntries,
            parsedMains: pMains,
            menuGroups: Object.values(groupsMap)
        };
    }, [dailyMenu, products]);

    // Filter Products
    let displayProducts = products;
    if (selectedCategory === 'menu') {
        // STRICTLY show only the Daily Menu Groups configured
        displayProducts = menuGroups;
    }

    const filteredProducts = displayProducts.filter(p =>
        (selectedCategory === 'menu' ? true : p.type === selectedCategory) && // For menu, we already set displayProducts to menuGroups
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Dynamic Filter for Menu Options based on the pending Menu Product Name
    const getMenuOptions = (list) => {
        if (!pendingMenuProduct) return [];
        // Strict Match by groupName
        return list.filter(item => (item.groupName || 'Menú del Día') === pendingMenuProduct.name);
    };

    // Helper to calculate effective stock based on ingredients
    const getEffectiveStock = (product, presentation = null) => {
        if (!product) return 0;

        // 1. If it has Recipes, calculate limit based on Ingredients
        if (product.Recipes && product.Recipes.length > 0) {
            let targetRecipes = [];
            if (presentation) {
                targetRecipes = product.Recipes.filter(r => r.presentation === presentation);
                if (targetRecipes.length === 0) targetRecipes = product.Recipes.filter(r => r.presentation === null);
            } else {
                targetRecipes = product.Recipes.filter(r => r.presentation === null);
                // Fallback for variants if no base recipe
                if (targetRecipes.length === 0) {
                    const uniquePres = [...new Set(product.Recipes.map(r => r.presentation))].filter(p => p);
                    if (uniquePres.length > 0) {
                        // If all recipes are variant-specific, we check all of them or just return a combined limit? 
                        // For display, let's pick the "Standard" one or first found
                        targetRecipes = product.Recipes.filter(r => r.presentation === uniquePres[0]);
                    }
                }
            }

            if (targetRecipes.length > 0) {
                let minStock = Infinity;
                targetRecipes.forEach(recipe => {
                    if (recipe.Ingredient) {
                        const avail = Math.floor(parseFloat(recipe.Ingredient.stock) / parseFloat(recipe.quantity) || 0);
                        minStock = Math.min(minStock, avail);
                    }
                });
                return minStock === Infinity ? 0 : minStock;
            } else {
                return 0; // Has recipes, but none match the requested presentation
            }
        } else if (product.requiresPreparation && !product.isStockManaged && product.type !== 'menu') {
            // Prepared items without any recipe configured should show 0 stock to match backend validation
            return 0;
        }

        // 2. If it's a direct Stock Managed or has variants
        if (product.isStockManaged) {
            if (presentation && product.ProductVariants) {
                const variant = product.ProductVariants.find(v => v.name === presentation);
                return variant ? variant.stock : product.stock;
            }
            // If it has variants, we sum them for the main button
            if (product.ProductVariants && product.ProductVariants.length > 0) {
                return product.ProductVariants.reduce((sum, v) => sum + (v.stock || 0), product.stock || 0);
            }
            return product.stock || 0;
        }

        return 999; // Assume infinite if no stock management or recipes AND it's not a required preparation item
    };

    // Helper to sync Daily Menu items with Real Product Stock
    const syncMenuStock = (items) => {
        if (!items) return [];
        return items.map(item => {
            const realProduct = item.linkId != null ? products.find(p => p.id == item.linkId) : null;
            let finalStock = item.stock !== undefined ? item.stock : 20;

            if (realProduct) {
                const physicalLimit = getEffectiveStock(realProduct);
                if (realProduct.type === 'daily_entry' || realProduct.type === 'daily_main') {
                    // Logic: Manual limit but cannot exceed physical ingredients
                    finalStock = Math.min(item.stock, physicalLimit);
                } else {
                    finalStock = physicalLimit;
                }
            }
            return { ...item, stock: finalStock, individualPrice: realProduct ? parseFloat(realProduct.price || 0) : 0 };
        });
    };

    const filteredEntries = getMenuOptions(syncMenuStock(parsedEntries));
    const filteredMains = getMenuOptions(syncMenuStock(parsedMains));

    // Calculate Stock for Menu Products
    const getMenuStockStats = (menuGroup) => {
        // 1. Get all items belonging to this group
        const groupEntries = syncMenuStock(parsedEntries).filter(e => (e.groupName || 'Menú del Día') === menuGroup.name);
        const groupMains = syncMenuStock(parsedMains).filter(m => (m.groupName || 'Menú del Día') === menuGroup.name);

        const totalEntriesStock = groupEntries.reduce((sum, e) => sum + Number(e.stock || 0), 0);
        const totalMainsStock = groupMains.reduce((sum, m) => sum + Number(m.stock || 0), 0);

        const minStock = Math.min(totalEntriesStock, totalMainsStock);

        return {
            stock: minStock,
            details: `E:${totalEntriesStock}/S:${totalMainsStock}`
        };
    }; const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const accountTotal = account ? parseFloat(account.total) : 0;

    if (loading) return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Cargando...</div>;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 md:p-4 z-50">
            <div className="bg-white w-full h-full md:h-[90vh] md:max-w-6xl rounded-none md:rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

                {/* --- MOBILE: CART VIEW OVERLAY --- */}
                {showMobileCart && (
                    <div className="md:hidden absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart size={20} /> Carrito</h2>
                            <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-gray-200 rounded-full"><X /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Account Info in Cart View */}
                            {account && (
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 text-sm">Cuenta #{account.id}</span>
                                        <span className="font-bold text-lg text-blue-800">Total: S/ {Number(accountTotal.toFixed(1))}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{account.customerName}</div>
                                </div>
                            )}

                            {/* SENT ORDERS (Mobile View) */}
                            {groupedOrders.length > 0 && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 shadow-sm">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 border-b pb-1">Pedidos Enviados</h3>
                                    <div className="space-y-2">
                                        {groupedOrders.map(o => {
                                            let pName = "Producto desconocido";
                                            let displayNotes = o.notes;

                                            if (o.Product && o.Product.name) {
                                                pName = o.Product.name;
                                            } else if (products.length > 0) {
                                                const localP = products.find(p => p.id === o.ProductId);
                                                if (localP) pName = localP.name;
                                            }
                                            return (
                                                <div key={o.key} className="flex justify-between items-start text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700">
                                                            {o.quantity}x {pName}
                                                            <span className="text-blue-600 ml-1">
                                                                (S/ {Number(parseFloat(o.priceAtOrder).toFixed(1))})
                                                            </span>
                                                        </span>
                                                        {o.presentation && <span className="text-xs text-blue-500">({o.presentation})</span>}
                                                        {displayNotes && <span className="text-xs text-red-400 italic">"{displayNotes}"</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cart Items */}
                            {cart.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">Carrito vacío</div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <div>
                                            <div className="font-bold text-gray-800">{item.name}</div>
                                            <div className="text-blue-600 font-bold">S/ {Number((item.price * item.quantity).toFixed(1))}</div>
                                            {item.notes && <div className="text-xs text-gray-400 max-w-[200px] truncate">{item.notes}</div>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600"
                                            >-</button>
                                            <span className="font-bold w-4 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p))}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full font-bold text-gray-600"
                                            >+</button>
                                            <button
                                                onClick={() => setCart(c => c.filter((_, i) => i !== idx))}
                                                className="ml-2 text-red-400"
                                            ><X size={18} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-gray-600">Total a Pagar</span>
                                <span className="text-2xl font-bold text-blue-800">S/ {Number((cartTotal + (accountTotal || 0)).toFixed(1))}</span>
                            </div>
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="w-full text-blue-600 font-bold text-sm mb-3 text-center block"
                            >
                                Seguir Comprando
                            </button>
                            {cart.length > 0 ? (
                                <button
                                    onClick={sendOrder}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                                >
                                    Enviar Pedido <Check size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleCloseClick}
                                    className={`w-full text-white py-3 rounded-xl font-bold text-lg shadow-lg ${(!account || (account.Orders && account.Orders.length === 0))
                                        ? "bg-gray-500 hover:bg-gray-600"
                                        : "bg-red-500 hover:bg-red-600"
                                        }`}
                                >
                                    {(!account || (account.Orders && account.Orders.length === 0)) ? "Liberar Mesa" : "Cerrar Cuenta"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* --- VARIANT SELECTION MODAL --- */}
                {
                    pendingVariantProduct && (
                        <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-4 animate-in fade-in">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-gray-800">{pendingVariantProduct.name}</h3>
                                    <button onClick={() => setPendingVariantProduct(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-gray-500 mb-4">Selecciona la presentación:</p>
                                    <div className="space-y-3">
                                        {/* Base Product Option? Usually integrated into variants list if configured properly. 
                                        If user wants Base + Variants, he should probably add "Standard" as a variant or just allow base click. 
                                        For now, assume Variants replace Base if they exist. */}
                                        {pendingVariantProduct.parsedVariants.map((v, idx) => (
                                            <button
                                                key={idx}
                                                // Disable if stock is 0
                                                disabled={v.stock <= 0}
                                                onClick={() => {
                                                    addToCart(pendingVariantProduct, '', [], v.name, v.price);
                                                    setPendingVariantProduct(null);
                                                }}
                                                className={`w-full text-center p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group flex justify-between items-center ${v.stock <= 0 ? 'opacity-60 grayscale' : ''}`}
                                            >
                                                <span className="font-bold text-xl text-blue-700 group-hover:text-blue-800">
                                                    {v.name === 'Normal'
                                                        ? `Base`
                                                        : v.name}
                                                </span>
                                                <div className="text-right">
                                                    {v.happyHourPrice && isHappyHourActive(v.happyHourStart, v.happyHourEnd) ? (
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-xs text-gray-400 line-through">S/ {Number(parseFloat(v.price).toFixed(1))}</div>
                                                            <div className="font-bold text-yellow-600">S/ {Number(parseFloat(v.happyHourPrice).toFixed(1))}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="font-bold text-gray-800">S/ {Number(parseFloat(v.price).toFixed(1))}</div>
                                                    )}
                                                    {v.stock !== undefined && (pendingVariantProduct.isStockManaged || pendingVariantProduct.requiresPreparation || pendingVariantProduct.type === 'menu') && (
                                                        <div className={`text-xs ${v.stock <= 0 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                            Stock: {v.stock}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* --- MAIN MENU VIEW (Visible on Desktop & Mobile when not in Cart Mode) --- */}

                {/* LEFT: Product Grid */}
                <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
                    {/* Header */}
                    <div className="p-4 bg-white shadow-sm z-10">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" />
                                    {tableData ? formatTableName(tableData) : `Mesa #...`}
                                </h2>
                                {/* TRANSFER BUTTON - Only if account exists */}
                                {account && (
                                    <button
                                        onClick={() => setShowTransferModal(true)}
                                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1 transition-colors text-xs font-bold"
                                        title="Cambiar de Mesa"
                                    >
                                        <ArrowRightLeft size={14} />
                                        <span className="hidden sm:inline">Mover</span>
                                    </button>
                                )}
                            </div>
                            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full md:hidden"><X /></button>
                        </div>

                        {/* Search Bar */}
                        {/* Search Bar — Unified for all categories, including 2x1 search across promos */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={selectedCategory === 'combo' ? "Buscar trago en todas las promos..." : "Buscar productos..."}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Categories */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {['dish', 'drink', 'menu', 'combo'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        // The useEffect handles the viewMode switch now
                                        if (cat === 'combo') {
                                            setPendingComboPromo(null);
                                            setComboSelection([]);
                                        }
                                    }}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${selectedCategory === cat ? (cat === 'combo' ? 'bg-purple-600 text-white ring-2 ring-purple-300 ring-offset-1' : 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1') : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {cat === 'dish' ? 'Platos' : cat === 'drink' ? 'Bebidas' : cat === 'menu' ? 'Menús' : <span className="flex items-center gap-1 justify-center"><Wine size={13} />2x1</span>}
                                </button>
                            ))}

                        </div>
                    </div>

                    {/* Transfer Modal */}
                    {showTransferModal && account && tableData && (
                        <TableTransferModal
                            account={account}
                            currentTable={tableData}
                            onClose={() => setShowTransferModal(false)}
                            onSuccess={() => {
                                setShowTransferModal(false);
                                onClose(); // Close TableControl after successful transfer
                            }}
                        />
                    )}

                    {/* Main Content Area — Flex column to support sticky footer */}
                    <div className="flex-1 flex flex-col min-h-0 p-3 pb-24 md:pb-4 overflow-hidden">

                        {/* Scrollable Content Wrapper */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">

                            {/* SEARCH RESULTS (Standard categories) */}
                            {searchTerm && selectedCategory !== 'combo' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
                                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No se encontraron productos para "{searchTerm}".
                                        </div>
                                    ) : (
                                        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStats(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                            }

                                            // Determine if out of stock specifically because of missing recipe setup
                                            const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
                                            const isOutOfStock = isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
                                            const hasVariants = (prod.ProductVariants && prod.ProductVariants.length > 0) || (prod.presentations && prod.presentations !== '[]' && prod.presentations.length > 0);
                                            let variantsList = [];
                                            if (prod.ProductVariants && prod.ProductVariants.length > 0) {
                                                variantsList = prod.ProductVariants.map(v => ({
                                                    name: v.name,
                                                    price: v.price,
                                                    stock: getEffectiveStock(prod, v.name),
                                                    happyHourPrice: v.happyHourPrice,
                                                    happyHourStart: v.happyHourStart,
                                                    happyHourEnd: v.happyHourEnd
                                                }));
                                            } else if (prod.presentations) {
                                                try {
                                                    const variants = typeof prod.presentations === 'string' ? JSON.parse(prod.presentations) : prod.presentations;
                                                    if (Array.isArray(variants) && variants.length > 0) variantsList = variants;
                                                } catch (e) { }
                                            }
                                            const needsExtraWidth = variantsList.length >= 4;

                                            return (
                                                <button
                                                    key={`${prod.id}-${displayStock}`}
                                                    disabled={isOutOfStock}
                                                    onClick={() => handleProductClick(prod)}
                                                    className={`bg-white p-3 rounded-xl border shadow-sm text-center flex flex-col items-center justify-between h-44 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{prod.name}</div>
                                                        {((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (!hasVariants || variantsList.length <= 1)) && (
                                                            <div className={`text-xs mt-1 ${isMissingRecipe ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
                                                                {isMissingRecipe ? 'Conf. Receta' : (isOutOfStock ? `Agotado ${stockDetails ? `(${stockDetails})` : ''}` : `Stock: ${(hasVariants && variantsList.length === 1 && variantsList[0].stock !== undefined) ? variantsList[0].stock : displayStock}`)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-4 py-1.5 rounded-full text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-base px-4 py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-base px-4 py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? prod.happyHourPrice : prod.price).toFixed(1))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* VIEW: PRODUCTS (Standard grid) */}
                            {viewMode === 'products' && !searchTerm && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(products.filter(p => {
                                        if (selectedCategory === 'menu') {
                                            return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name);
                                        }
                                        return p.type === selectedCategory;
                                    }).length === 0) ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No hay productos disponibles o no coinciden con la búsqueda.
                                        </div>
                                    ) : (
                                        products.filter(p => {
                                            if (selectedCategory === 'menu') {
                                                return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name);
                                            }
                                            return p.type === selectedCategory;
                                        }).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStats(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                            }

                                            // Determine if out of stock specifically because of missing recipe setup
                                            const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
                                            const isOutOfStock = isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
                                            const hasVariants = (prod.ProductVariants && prod.ProductVariants.length > 0) || (prod.presentations && prod.presentations !== '[]' && prod.presentations.length > 0);
                                            let variantsList = [];
                                            if (prod.ProductVariants && prod.ProductVariants.length > 0) {
                                                variantsList = prod.ProductVariants.map(v => ({
                                                    name: v.name,
                                                    price: v.price,
                                                    stock: getEffectiveStock(prod, v.name),
                                                    happyHourPrice: v.happyHourPrice,
                                                    happyHourStart: v.happyHourStart,
                                                    happyHourEnd: v.happyHourEnd
                                                }));
                                            } else if (prod.presentations) {
                                                try {
                                                    const variants = typeof prod.presentations === 'string' ? JSON.parse(prod.presentations) : prod.presentations;
                                                    if (Array.isArray(variants) && variants.length > 0) variantsList = variants;
                                                } catch (e) { }
                                            }
                                            const needsExtraWidth = variantsList.length >= 4;

                                            return (
                                                <button
                                                    key={`${prod.id}-${displayStock}`}
                                                    disabled={isOutOfStock}
                                                    onClick={() => handleProductClick(prod)}
                                                    className={`bg-white p-3 rounded-xl border shadow-sm text-center flex flex-col items-center justify-between h-40 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{prod.name}</div>
                                                        {((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (!hasVariants || variantsList.length <= 1)) && (
                                                            <div className={`text-xs mt-1 ${isMissingRecipe ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
                                                                {isMissingRecipe ? 'Conf. Receta' : (isOutOfStock ? `Agotado ${stockDetails ? `(${stockDetails})` : ''}` : `Stock: ${(hasVariants && variantsList.length === 1 && variantsList[0].stock !== undefined) ? variantsList[0].stock : displayStock}`)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-4 py-1.5 rounded-full text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-base px-4 py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-base px-4 py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? prod.happyHourPrice : prod.price).toFixed(1))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* VIEW: 2x1 PROMO CATEGORIES (Step 1) */}
                            {viewMode === 'combo_categories' && !searchTerm && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95">
                                    {drinkPromotions.length === 0 ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic font-medium bg-white rounded-2xl border border-dashed border-gray-200">
                                            No hay promociones 2x1 configuradas.
                                        </div>
                                    ) : (
                                        drinkPromotions.map(promo => (
                                            <button
                                                key={promo.id}
                                                onClick={() => {
                                                    setPendingComboPromo(promo);
                                                    setViewMode('combo_picker');
                                                }}
                                                className="bg-white p-6 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:shadow-lg transition-all text-left flex flex-col justify-between h-40 group relative overflow-hidden"
                                            >
                                                <div className="absolute -right-4 -top-4 text-purple-100 group-hover:text-purple-200 transition-colors transform rotate-12">
                                                    <Tag size={100} strokeWidth={0.5} />
                                                </div>
                                                <div className="relative z-10">
                                                    <div className="text-xs font-black text-purple-600 uppercase tracking-widest mb-1 bg-purple-50 w-fit px-2 py-0.5 rounded-full">2 x 1</div>
                                                    <h3 className="font-black text-gray-900 text-lg leading-tight uppercase line-clamp-2">{promo.name}</h3>
                                                </div>
                                                <div className="flex items-center text-purple-700 font-bold text-sm bg-purple-50 w-fit px-3 py-1 rounded-lg border border-purple-100 relative z-10">
                                                    Explorar tragos
                                                    <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* VIEW: 2x1 SEARCH RESULTS (Unified search across all promotions) */}
                            {selectedCategory === 'combo' && searchTerm && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    {(() => {
                                        const allItems = drinkPromotions.flatMap(promo =>
                                            (promo.DrinkPromotionItems || []).map(item => ({
                                                ...item,
                                                _promo: promo,
                                                _uid: `${promo.id}:${item.id}`
                                            }))
                                        ).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

                                        if (allItems.length === 0) return (
                                            <div className="text-center text-gray-400 py-20 italic">
                                                No se encontraron tragos que coincidan con "{searchTerm}".
                                            </div>
                                        );

                                        return allItems.map(item => {
                                            const isSelected = comboSelection.some(s => s._uid === item._uid);
                                            const isDisabled = !isSelected && comboSelection.length >= 2;
                                            return (
                                                <button
                                                    key={item._uid}
                                                    disabled={isDisabled}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setComboSelection(s => s.filter(x => x._uid !== item._uid));
                                                        } else if (comboSelection.length < 2) {
                                                            setComboSelection(s => [...s, {
                                                                ...item,
                                                                _uid: item._uid,
                                                                _promoPrice: parseFloat(item._promo.price),
                                                                _originalPrice: parseFloat(item.individualPrice || 0)
                                                            }]);
                                                        }
                                                    }}
                                                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-sm transition-all border-2 shadow-sm
                                                    ${isSelected
                                                            ? 'bg-purple-600 border-purple-600 text-white font-bold scale-[1.02]'
                                                            : isDisabled
                                                                ? 'opacity-30 bg-gray-50 border-gray-100 cursor-not-allowed shadow-none'
                                                                : 'bg-white border-white hover:border-purple-200 text-gray-700'}`}
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-bold">{item.name}</span>
                                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase font-black tracking-tight">{item._promo.name}</span>
                                                        </div>
                                                        <span className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-400'}`}>S/ {Number(parseFloat(item.individualPrice || 0).toFixed(2))} • Combo 2x S/ {Number(parseFloat(item._promo.price).toFixed(2))}</span>
                                                    </div>
                                                    {isSelected && <CheckCircle size={24} className="text-white" />}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {/* VIEW: COMBO 2x1 — Selección de items (Step 2) */}
                            {viewMode === 'combo_picker' && pendingComboPromo && !searchTerm && (() => {
                                const items = pendingComboPromo.DrinkPromotionItems || [];
                                return (
                                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col h-full bg-purple-50/50 -m-3 p-3 rounded-b-2xl">
                                        {/* Header info */}
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <button
                                                onClick={() => setViewMode('combo_categories')}
                                                className="text-purple-600 font-bold flex items-center gap-1 text-sm hover:underline"
                                            >
                                                ← Volver a categorías
                                            </button>
                                            <span className="text-xs text-purple-600 font-semibold bg-white border border-purple-200 px-3 py-1 rounded-full shadow-sm">
                                                {comboSelection.length}/2 seleccionados
                                            </span>
                                        </div>
                                        <h4 className="font-black text-gray-800 mb-4 px-1">{pendingComboPromo.name}</h4>

                                        {/* Items of the selected promotion */}
                                        <div className="flex-1 overflow-y-auto space-y-2">
                                            {items.length === 0 ? (
                                                <div className="text-center text-gray-400 py-10 italic">
                                                    No hay tragos en esta categoría.
                                                </div>
                                            ) : (
                                                items.map(item => {
                                                    const uid = `${pendingComboPromo.id}:${item.id}`;
                                                    const isSelected = comboSelection.some(s => s._uid === uid);
                                                    const isDisabled = !isSelected && comboSelection.length >= 2;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            disabled={isDisabled}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setComboSelection(s => s.filter(x => x._uid !== uid));
                                                                } else if (comboSelection.length < 2) {
                                                                    setComboSelection(s => [...s, {
                                                                        ...item,
                                                                        _uid: uid,
                                                                        _promoPrice: parseFloat(pendingComboPromo.price)
                                                                    }]);
                                                                }
                                                            }}
                                                            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-sm transition-all border-2 shadow-sm
                                                            ${isSelected
                                                                    ? 'bg-purple-600 border-purple-600 text-white font-bold scale-[1.02]'
                                                                    : isDisabled
                                                                        ? 'opacity-30 bg-gray-50 border-gray-100 cursor-not-allowed shadow-none'
                                                                        : 'bg-white border-white hover:border-purple-200 text-gray-700'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {isSelected ? <CheckCircle size={18} /> : (
                                                                    <div className="w-5 h-5 rounded-full border-2 border-purple-200"></div>
                                                                )}
                                                                <span className="text-base">{item.name}</span>
                                                            </div>
                                                            <span className={`text-sm ${isSelected ? 'text-purple-100' : 'text-gray-400'} font-bold`}>
                                                                S/ {Number(parseFloat(item.individualPrice ?? 0).toFixed(2))}
                                                            </span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* VIEW: MENU BUILDER (INLINE) */}
                            {viewMode === 'menu_builder' && (
                                <div className="animate-in slide-in-from-right h-full flex flex-col pb-8">
                                    <div className="flex items-center gap-2 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <button onClick={cancelMenuSelection} className="p-2 bg-white rounded-full shadow hover:bg-gray-100"><X size={16} /></button>
                                        <div>
                                            <h3 className="font-bold text-gray-800">Armar {pendingMenuProduct?.name}</h3>
                                            <p className="text-xs text-blue-600">Selecciona Entrada y Segundo</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4 overflow-y-auto">
                                        {/* ENTRADAS */}
                                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                                            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                                Entrada
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {filteredEntries.length === 0 && <div className="text-gray-400 italic text-sm p-2 col-span-2">No se encontraron opciones para este menú.</div>}
                                                {filteredEntries.map((entry, i) => (
                                                    <button
                                                        key={i}
                                                        disabled={entry.stock <= 0}
                                                        onClick={() => {
                                                            if (menuSelection.entry === entry.name) {
                                                                setMenuSelection({ ...menuSelection, entry: null }); // Toggle off
                                                            } else {
                                                                setMenuSelection({ ...menuSelection, entry: entry.name });
                                                            }
                                                        }}
                                                        className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center relative overflow-hidden
                                                    ${menuSelection.entry === entry.name ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}
                                                    ${entry.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-700">{entry.name}</div>
                                                            <div className="text-xs text-blue-600 font-medium">S/ {Number(entry.individualPrice || 0).toFixed(2)}</div>
                                                            {(entry.stock !== undefined && entry.stock < 999) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Stock: {entry.stock}</div>
                                                            )}
                                                        </div>
                                                        {menuSelection.entry === entry.name && <CheckCircle className="text-blue-600" size={18} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* SEGUNDOS */}
                                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                                            <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                                <span className="bg-orange-100 text-orange-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                                Segundo
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {filteredMains.length === 0 && <div className="text-gray-400 italic text-sm p-2 col-span-2">No se encontraron opciones para este menú.</div>}
                                                {filteredMains.map((main, i) => (
                                                    <button
                                                        key={i}
                                                        disabled={main.stock <= 0}
                                                        onClick={() => {
                                                            if (menuSelection.main === main.name) {
                                                                setMenuSelection({ ...menuSelection, main: null }); // Toggle off
                                                            } else {
                                                                setMenuSelection({ ...menuSelection, main: main.name });
                                                            }
                                                        }}
                                                        className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center relative overflow-hidden
                                                    ${menuSelection.main === main.name ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}
                                                    ${main.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-700">{main.name}</div>
                                                            <div className="text-xs text-orange-600 font-medium">S/ {Number(main.individualPrice || 0).toFixed(2)}</div>
                                                            {(main.stock !== undefined && main.stock < 999) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Stock: {main.stock}</div>
                                                            )}
                                                        </div>
                                                        {menuSelection.main === main.name && <CheckCircle className="text-orange-600" size={18} />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={cancelMenuSelection}
                                            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={confirmMenuSelection}
                                            disabled={!menuSelection.entry && !menuSelection.main}
                                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex flex-col items-center justify-center leading-tight"
                                        >
                                            {menuSelection.entry && menuSelection.main ? (
                                                <>
                                                    <span>Añadir Combo</span>
                                                    <span className="text-xs opacity-90">S/ {Number(pendingMenuProduct?.price || 0).toFixed(1)}</span>
                                                </>
                                            ) : menuSelection.entry ? (
                                                <>
                                                    <span>Solo Entrada</span>
                                                    <span className="text-xs opacity-90">S/ {Number(filteredEntries.find(e => e.name === menuSelection.entry)?.individualPrice || 0).toFixed(1)}</span>
                                                </>
                                            ) : menuSelection.main ? (
                                                <>
                                                    <span>Solo Segundo</span>
                                                    <span className="text-xs opacity-90">S/ {Number(filteredMains.find(m => m.name === menuSelection.main)?.individualPrice || 0).toFixed(1)}</span>
                                                </>
                                            ) : (
                                                <span>Seleccionar</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* GLOBAL COMBO BAR — Persistent summary and action buttons for 2x1 section */}
                        {(viewMode === 'combo_categories' || viewMode === 'combo_picker' || (selectedCategory === 'combo' && searchTerm)) && comboSelection.length > 0 && (() => {
                            // Persistent logic for calculation
                            let displayPrice = 0;
                            let priceLabel = '';
                            if (comboSelection.length === 1) {
                                displayPrice = parseFloat(comboSelection[0].individualPrice) || 0;
                                priceLabel = 'Precio individual';
                            } else if (comboSelection.length === 2) {
                                displayPrice = Math.max(...comboSelection.map(s => s._promoPrice || 0));
                                priceLabel = 'Combo 2x1 (precio mayor)';
                            }

                            const handleAdd = () => {
                                if (comboSelection.length === 0) return;
                                const name = comboSelection.length === 2
                                    ? `${comboSelection[0].name} + ${comboSelection[1].name}`
                                    : comboSelection[0].name;
                                const subItems = comboSelection
                                    .filter(s => s.type !== 'free' && s.linkedProductId)
                                    .map(s => ({ productId: s.linkedProductId, quantity: 1, name: s.name }));
                                const isActualCombo = comboSelection.length === 2;
                                setCart(prev => [...prev, {
                                    productId: null,
                                    name: isActualCombo ? `2x1: ${name}` : comboSelection[0].name,
                                    price: displayPrice,
                                    quantity: 1,
                                    notes: isActualCombo ? name : '',
                                    isCombo: isActualCombo,
                                    subItems
                                }]);
                                setComboSelection([]);
                                setViewMode('combo_categories');
                                setPendingComboPromo(null);
                                setSearchTerm(''); // Clear search on success
                            };

                            return (
                                <div className="border-t border-purple-100 pt-4 mt-2 flex items-center justify-between gap-3 bg-white z-20">
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full ring-1 ring-purple-100">
                                                {comboSelection.length}/2
                                            </span>
                                            <span className="text-xs text-gray-500 truncate font-medium">
                                                {comboSelection.map(s => s.name).join(' + ')}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-purple-700 font-black text-2xl tracking-tight">
                                                S/ {Number(displayPrice.toFixed(2))}
                                            </span>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{priceLabel}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setComboSelection([])}
                                            className="px-4 py-2.5 rounded-xl bg-gray-50 text-gray-500 text-sm font-bold hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={handleAdd}
                                            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 
                                            ${comboSelection.length === 2
                                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-purple-200'
                                                    : 'bg-white border-2 border-purple-600 text-purple-700 hover:bg-purple-50 shadow-sm'}`}
                                        >
                                            {comboSelection.length === 2 ? (
                                                <>
                                                    <CheckCircle size={18} />
                                                    ¡Listo, agregar!
                                                </>
                                            ) : (
                                                'Falta 1 trago...'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* MOBILE FLOATING FOOTER (Only if not showing cart) */}
                    {!showMobileCart && (
                        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 bg-transparent pointer-events-none">
                            <button
                                onClick={() => setShowMobileCart(true)}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex justify-between px-6 pointer-events-auto transition-transform active:scale-95 ${cart.length > 0 ? 'bg-blue-600' : 'bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={20} />
                                    <span>{cart.length > 0 ? 'Ver Carrito' : 'Ver Cuenta'}</span>
                                </div>
                                <span>S/ {Number((account?.accountType === 'staff' ? 0 : (cartTotal + (accountTotal || 0))).toFixed(1))}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: Desktop Cart Panel (Always visible on desktop, hidden on mobile) */}
                <div className="hidden md:flex w-[380px] bg-white border-l flex-col shadow-xl z-20">
                    <div className="p-5 border-b bg-gray-50">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">
                                {account ? `Cuenta #${account.id}` : <span className="text-green-600">Nueva Cuenta</span>}
                            </h2>
                            <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded-full"><X /></button>
                        </div>
                        {/* Show Client Edit only if Account Exists OR allow pre-fill? 
                        Acc doesn't exist yet, so we can't update it via API.
                        For simplicity: Only allow editing client AFTER account creation (first order).
                        OR: We could store clientForm in state and send it with open.
                        For now: Only show if account exists. */}
                        {account ? (
                            isEditingClient ? (
                                <div className="mt-3 bg-white p-3 rounded border shadow-sm space-y-2">
                                    <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            id="staff_toggle_edit"
                                            checked={clientForm.accountType === 'staff'}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setShowStaffConfirm(true); // Open custom modal
                                                } else {
                                                    setClientForm({ ...clientForm, accountType: 'standard' });
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="staff_toggle_edit" className="text-xs font-bold text-gray-700 cursor-pointer">Consumo de Trabajador</label>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                            value={clientForm.dni} 
                                            onChange={e => setClientForm({ ...clientForm, dni: e.target.value })} 
                                            placeholder="DNI / RUC" 
                                            onKeyDown={(e) => { if(e.key === 'Enter') searchClientData() }}
                                        />
                                        <button 
                                            onClick={searchClientData} 
                                            disabled={isSearchingClient} 
                                            className="bg-gray-100 p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center min-w-[36px]"
                                            title="Buscar datos"
                                        >
                                            {isSearchingClient ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Search size={16} />}
                                        </button>
                                    </div>
                                    <input 
                                        className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                        value={clientForm.name} 
                                        onChange={e => setClientForm({ ...clientForm, name: e.target.value })} 
                                        placeholder="Nombre / Razón Social" 
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditingClient(false)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-sm">Cancelar</button>
                                        <button onClick={updateClientInfo} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm">Guardar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col mt-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-800 font-medium">{account.customerName}</span>
                                            {account.accountType === 'staff' && (
                                                <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Staff</span>
                                            )}
                                        </div>
                                        <button onClick={() => setIsEditingClient(true)} className="text-xs text-blue-600 font-semibold px-2 py-1 rounded hover:bg-blue-50">Editar Cliente</button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="mt-3 space-y-3">
                                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-100">
                                    <input
                                        type="checkbox"
                                        id="staff_toggle_new"
                                        checked={clientForm.accountType === 'staff'}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setShowStaffConfirm(true); // Open custom modal
                                            } else {
                                                setClientForm({ ...clientForm, accountType: 'standard' });
                                            }
                                        }}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="staff_toggle_new" className="text-xs font-bold text-orange-800 cursor-pointer">Consumo de Trabajador</label>
                                </div>
                                <div className="text-sm text-gray-500 italic">
                                    Agrega productos para abrir la mesa.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {groupedOrders.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase">Pedidos Enviados</h3>
                                {groupedOrders.map(o => {
                                    // Robust Product Name Lookup
                                    let pName = "Producto desconocido";
                                    let displayNotes = o.notes;

                                    let originalP = null;

                                    // Combo orders have no ProductId — use notes as name
                                    if (!o.ProductId && o.notes) {
                                        pName = `2x1: ${o.notes}`;
                                        displayNotes = null; // avoid repeating under name
                                    } else if (o.Product && o.Product.name) {
                                        pName = o.Product.name;
                                    }

                                    if (products.length > 0 && o.ProductId) {
                                        // Fallback: Find in local products list
                                        const localP = products.find(p => p.id === o.ProductId);
                                        if (localP) {
                                            pName = localP.name;
                                            if (o.presentation) {
                                                if (localP.ProductVariants && localP.ProductVariants.length > 0) {
                                                    const v = localP.ProductVariants.find(v => v.name === o.presentation);
                                                    if (v) originalP = v.price;
                                                } else if (localP.presentations) {
                                                    try {
                                                        const vars = typeof localP.presentations === 'string' ? JSON.parse(localP.presentations) : localP.presentations;
                                                        const v = vars.find(v => v.name === o.presentation);
                                                        if (v) originalP = v.price;
                                                    } catch (e) { }
                                                }
                                            }
                                            if (originalP === null) originalP = localP.price;
                                        }
                                    }

                                    const isStaff = account?.accountType === 'staff';

                                    return (
                                        <div key={o.key} className="flex justify-between items-center text-sm py-2 border-b border-dashed">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-700">
                                                    {o.quantity}x {pName}
                                                    <span className="text-blue-600 ml-1">
                                                        {isStaff ? (
                                                            o.quantity > 1 ? (
                                                                <span className="text-orange-600">({o.quantity}x <span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> = <span className="line-through text-gray-400">S/ {Number((o.quantity * parseFloat(originalP || 0)).toFixed(1))}</span> a costo S/ 0)</span>
                                                            ) : (
                                                                <span className="text-orange-600">(<span className="line-through text-gray-400">S/ {Number(parseFloat(originalP || 0).toFixed(1))}</span> a costo S/ 0)</span>
                                                            )
                                                        ) : (
                                                            o.quantity > 1 ? (
                                                                `(${o.quantity}x${Number(parseFloat(o.priceAtOrder).toFixed(1))} = S/ ${Number((o.quantity * parseFloat(o.priceAtOrder)).toFixed(1))})`
                                                            ) : (
                                                                `(S/ ${Number(parseFloat(o.priceAtOrder).toFixed(1))})`
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                                {o.presentation && <span className="text-xs text-blue-500">({o.presentation})</span>}
                                                {displayNotes && <span className="text-xs text-red-400 italic">"{displayNotes}"</span>}
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {/* Status Badges Removed for Simplicity */}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {user.role === 'admin' && (
                                                    deleteConfirmId === o.id ? (
                                                        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                                            <span className="text-xs text-red-700 font-bold mr-1">¿Eliminar?</span>
                                                            <button
                                                                onClick={() => handleDeleteOrder(o.id)}
                                                                className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                                            >Sí</button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                                                            >No</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirmId(o.id)}
                                                            className="bg-red-100 hover:bg-red-200 text-red-600 p-1.5 rounded-lg transition-colors"
                                                            title="Eliminar Pedido (Admin)"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {cart.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-blue-600 uppercase">Nuevo Pedido</h3>
                                {cart.map((item, idx) => (
                                    <div key={idx} className="bg-blue-50 p-3 rounded-lg flex justify-between items-center relative group">
                                        <div>
                                            <div className="font-bold text-sm">{item.name}</div>
                                            <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                                {item.originalPrice !== undefined && item.originalPrice !== item.price && (
                                                    <span className="line-through text-gray-400">S/ {Number((item.originalPrice * item.quantity).toFixed(1))}</span>
                                                )}
                                                <span className={item.price === 0 ? "text-orange-600 font-bold" : ""}>
                                                    S/ {Number((item.price * item.quantity).toFixed(1))}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white rounded px-1 border">
                                            <button onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))} className="px-2 font-bold">-</button>
                                            <span className="text-sm font-bold">{item.quantity}</span>
                                            <button onClick={() => setCart(c => c.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p))} className="px-2 font-bold">+</button>
                                        </div>
                                        <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-gray-50">
                        <div className="flex justify-between text-xl font-bold text-gray-800 mb-4 items-center">
                            <span>Total</span>
                            <div className="flex flex-col items-end">
                                {account?.accountType === 'staff' && (
                                    <span className="text-[10px] text-orange-600 uppercase font-bold bg-orange-50 px-2 py-0.5 rounded -mb-1">Consumo Personal</span>
                                )}
                                <span>S/ {Number((account?.accountType === 'staff' ? 0 : (cartTotal + (accountTotal || 0))).toFixed(1))}</span>
                            </div>
                        </div>
                        {cart.length > 0 ? (
                            <button onClick={sendOrder} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700">Enviar Pedido</button>
                        ) : (
                            (!account || (account.Orders && account.Orders.length === 0)) ? (
                                <button onClick={handleCloseClick} className="w-full border-2 border-gray-400 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100">Liberar Mesa</button>
                            ) : (
                                <button onClick={handleCloseClick} className="w-full border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50">Cerrar Cuenta</button>
                            )
                        )}
                    </div>
                </div>
            </div >

            {/* Custom Confirmation Modal for Staff Consumption */}
            {showStaffConfirm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-orange-50 p-6 flex flex-col items-center border-b border-orange-100">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-orange-500 shadow-sm mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-800 text-center">Consumo de Personal</h3>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-gray-600 mb-6 font-medium">
                                ¿Estás seguro que deseas marcar esta mesa como Consumo Interno?
                                <br /><br />
                                <span className="bg-orange-100 px-2 py-1 rounded text-orange-800 text-sm font-bold">Todos los precios cambiarán a S/ 0.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowStaffConfirm(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setClientForm({ ...clientForm, accountType: 'staff', name: '', dni: '' });
                                        setShowStaffConfirm(false);
                                    }}
                                    className="flex-1 px-4 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {
                showPaymentModal && (
                    <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                        {successInvoice ? (
                            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm border border-gray-100 animate-in zoom-in-95 duration-200">
                                {/* Premium Green/Mint Gradient Header */}
                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-center text-white relative">
                                    <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-3 shadow-inner">
                                        <CheckCircle size={36} className="text-white" />
                                    </div>
                                    <h2 className="text-xl font-extrabold tracking-tight">¡Comprobante Emitido!</h2>
                                    <p className="text-emerald-100 text-xs mt-1">El comprobante se generó y registró correctamente</p>
                                </div>

                                {/* Voucher Body */}
                                <div className="p-6 space-y-4">
                                    {/* Monospace Serial code */}
                                    <div className="text-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            {successInvoice.invoice.tipo === 'factura' ? 'Factura Electrónica' : 'Boleta Electrónica'}
                                        </div>
                                        <div className="text-2xl font-mono font-bold text-slate-800 tracking-normal mt-1">
                                            {successInvoice.invoice.serie}-{String(successInvoice.invoice.correlativo).padStart(6, '0')}
                                        </div>
                                    </div>

                                    {/* SUNAT Status pill badge */}
                                    {(() => {
                                        const { pdf } = (() => {
                                            const sunatResp = successInvoice.sunatResponse;
                                            if (!sunatResp) return { pdf: null, xml: null };
                                            let parsed = sunatResp;
                                            if (typeof sunatResp === 'string') {
                                                try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
                                            }
                                            if (!parsed) return { pdf: null, xml: null };
                                            return {
                                                pdf: parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || null,
                                                xml: parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null
                                            };
                                        })();

                                        return (
                                            <div className="flex justify-center">
                                                {pdf ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-200 font-bold uppercase shadow-sm">
                                                        <Check size={12} className="stroke-[3]" /> Aceptado por SUNAT
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full border border-amber-200 font-bold uppercase shadow-sm">
                                                        <AlertCircle size={12} /> Guardado Localmente
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Details Grid */}
                                    <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm text-gray-600">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Cliente:</span>
                                            <span className="font-semibold text-gray-800 truncate max-w-[200px]" title={successInvoice.invoice.clienteNombre}>
                                                {successInvoice.invoice.clienteNombre}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Documento:</span>
                                            <span className="font-semibold text-gray-800 font-mono">
                                                {successInvoice.invoice.clienteDocumento || '00000000'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">Método de Pago:</span>
                                            <span className="font-semibold text-gray-800 capitalize bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                {paymentMethod}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline border-t border-gray-100 pt-3 mt-1">
                                            <span className="text-gray-500 font-bold">Total Pagado:</span>
                                            <span className="text-xl font-black text-slate-800 font-mono">
                                                S/ {parseFloat(successInvoice.invoice.total).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: PDF & XML */}
                                    {(() => {
                                        const { pdf, xml } = (() => {
                                            const sunatResp = successInvoice.sunatResponse;
                                            if (!sunatResp) return { pdf: null, xml: null };
                                            let parsed = sunatResp;
                                            if (typeof sunatResp === 'string') {
                                                try { parsed = JSON.parse(sunatResp); } catch (e) { parsed = null; }
                                            }
                                            if (!parsed) return { pdf: null, xml: null };
                                            return {
                                                pdf: parsed.links?.pdf || parsed.pdf || parsed.pdf_url || parsed.url_pdf || null,
                                                xml: parsed.links?.xml || parsed.xml || parsed.xml_url || parsed.url_xml || null
                                            };
                                        })();

                                        return (
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => pdf && window.open(pdf, '_blank')}
                                                    disabled={!pdf}
                                                    className={`flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm
                                                    ${pdf ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200' : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    <Printer size={16} />
                                                    Ver PDF
                                                </button>
                                                <button
                                                    onClick={() => xml && window.open(xml, '_blank')}
                                                    disabled={!xml}
                                                    className={`flex-1 py-3 px-4 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm
                                                    ${xml ? 'bg-slate-800 border-slate-800 text-white hover:bg-slate-900 hover:shadow-slate-200' : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    <Download size={16} />
                                                    XML
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* Finalize Button */}
                                    <button
                                        onClick={() => {
                                            setSuccessInvoice(null);
                                            setShowPaymentModal(false);
                                            onClose();
                                        }}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm mt-2"
                                    >
                                        <Check size={18} className="stroke-[3]" />
                                        Finalizar y Liberar Mesa
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirmar Pago</h2>

                                <div className="bg-blue-50 p-4 rounded-lg mb-6 text-center border border-blue-100">
                                    <div className="text-sm text-gray-500">Total a Pagar</div>
                                    <div className="text-3xl font-bold text-blue-600">S/ {Number((cartTotal + (accountTotal || 0)).toFixed(1))}</div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Método de Pago:</label>
                                    {['efectivo', 'yape', 'tarjeta', 'transferencia'].map(method => (
                                        <button
                                            key={method}
                                            disabled={isConfirmingPayment}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all
                                        ${paymentMethod === method ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-1' : 'border-gray-200 hover:bg-gray-50'}
                                        ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="capitalize font-medium text-gray-700">{method}</span>
                                            {paymentMethod === method && <CheckCircle size={18} className="text-blue-500" />}
                                        </button>
                                    ))}
                                </div>

                                {/* EVIDENCE UPLOAD */}
                                {paymentMethod !== 'efectivo' && (
                                    <div className="mb-6 animate-in slide-in-from-top-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Subir Comprobante (Opcional):
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            disabled={isConfirmingPayment}
                                            onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
                                            className={`w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100 ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                        {evidenceFiles.length > 0 && (
                                            <div className="text-xs text-green-600 mt-2 flex flex-col gap-1">
                                                <span className="font-bold text-gray-700 mb-1">{evidenceFiles.length} archivo(s) seleccionado(s):</span>
                                                {evidenceFiles.map((file, idx) => (
                                                    <div key={idx} className="flex items-center gap-1">
                                                        <CheckCircle size={12} /> {file.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* INVOICE OPTIONS */}
                                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <input 
                                            type="checkbox" 
                                            id="issue_invoice"
                                            checked={issueInvoice}
                                            onChange={(e) => setIssueInvoice(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            disabled={isConfirmingPayment}
                                        />
                                        <label htmlFor="issue_invoice" className="text-sm font-bold text-gray-700 cursor-pointer">
                                            Emitir Comprobante Electrónico
                                        </label>
                                    </div>
                                    
                                    {issueInvoice && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <div className="flex gap-2 mb-3">
                                                <button
                                                    onClick={() => setInvoiceType('boleta')}
                                                    disabled={isConfirmingPayment}
                                                    className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'boleta' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    Boleta
                                                </button>
                                                <button
                                                    onClick={() => setInvoiceType('factura')}
                                                    disabled={isConfirmingPayment}
                                                    className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${invoiceType === 'factura' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'} ${isConfirmingPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    Factura
                                                </button>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Documento (DNI/RUC)</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder={invoiceType === 'factura' ? "RUC (11 dígitos)" : "DNI (8 dígitos) u Opcional"}
                                                            value={clientForm.dni}
                                                            onChange={e => {
                                                                setClientForm({...clientForm, dni: e.target.value});
                                                                if (e.target.value.length === 11) setInvoiceType('factura');
                                                                else if (e.target.value.length === 8) setInvoiceType('boleta');
                                                            }}
                                                            disabled={isConfirmingPayment}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                            onKeyDown={e => e.key === 'Enter' && searchClientData()}
                                                        />
                                                        <button 
                                                            onClick={searchClientData} 
                                                            disabled={isSearchingClient || isConfirmingPayment || !clientForm.dni}
                                                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center"
                                                        >
                                                            {isSearchingClient ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-600 mb-1">Nombre / Razón Social</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder={invoiceType === 'factura' ? "Razón Social" : "Nombre del Cliente"}
                                                        value={clientForm.name}
                                                        onChange={e => setClientForm({...clientForm, name: e.target.value})}
                                                        disabled={isConfirmingPayment}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            if (isConfirmingPayment) {
                                                setIsConfirmingPayment(false);
                                            } else {
                                                setShowPaymentModal(false);
                                            }
                                        }}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        {isConfirmingPayment ? 'Mudar Método' : 'Cancelar'}
                                    </button>
                                    <button
                                        onClick={confirmPayment}
                                        className={`flex-1 py-3 text-white rounded-lg font-black shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center leading-tight
                                        ${isConfirmingPayment ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {isConfirmingPayment ? (
                                            <>
                                                <span className="text-xs opacity-90 uppercase">Confirmar</span>
                                                <span>SI, COBRAR</span>
                                            </>
                                        ) : (
                                            'Cobrar'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}

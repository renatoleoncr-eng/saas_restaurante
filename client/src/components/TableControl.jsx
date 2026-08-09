import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useRestaurant } from '../contexts/RestaurantContext';
import { ShoppingCart, Utensils, Beer, X, Check, FileText, Search, Plus, Minus, Trash2, Clock, CheckCircle, ArrowRightLeft, Wine, Tag, ChevronRight, AlertCircle, Info, Loader2, Printer, Download, Camera, Image } from 'lucide-react';
import { formatTableName } from '../utils/tableUtils';
import TableTransferModal from './TableTransferModal';
import PinPadModal from './PinPadModal';
import PrintConfirmModal from './PrintConfirmModal';
import PaymentModal from './PaymentModal';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { getEffectiveStock, syncMenuStock, getMenuStockStats, isProductOutOfStock } from '../utils/menuStockUtils';
import { useMenuFlow } from '../hooks/useMenuFlow';
import { useCart } from '../hooks/useCart';
import CartSidebar from './CartSidebar';
// NOTE: billingPrintUtils and billingXmlUtils are ready but NOT connected yet.
// Connect them when ready to test the print service (Phase 1 of refactoring plan).
// import { generatePrintableHtml, triggerIframePrint } from '../utils/billingPrintUtils';
// import { downloadUblXml } from '../utils/billingXmlUtils';


export default function TableControl({ tableId, accountId, onClose, initialShowCart = false }) {
    const { user, refreshTrigger, refreshData, printingEnabled } = useRestaurant();
    const [account, setAccount] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [isAccountLoaded, setIsAccountLoaded] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('dish'); // Default to 'dish'
    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileCart, setShowMobileCart] = useState(initialShowCart);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isSendingOrder, setIsSendingOrder] = useState(false);
    const [isActionInProgress, setIsActionInProgress] = useState(false);
    const isSendingRef = useRef(false);
    const idempotencyKeyRef = useRef(null);

    // Client Editing State
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [clientForm, setClientForm] = useState({ name: '', dni: '', direccion: '', accountType: 'standard' });
    const [isSearchingClient, setIsSearchingClient] = useState(false);
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
                const address = res.data.direccion || '';
                if (fullName) {
                    setClientForm(prev => ({ ...prev, name: fullName, direccion: address }));
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

    // Autocomplete client data
    useEffect(() => {
        const doc = (clientForm.dni || '').trim();
        if (doc.length === 8 || doc.length === 11) {
            const timer = setTimeout(() => {
                searchClientData();
            }, 500);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientForm.dni]);

    const [dailyMenu, setDailyMenu] = useState({ entries: [], mains: [], activeGroups: [] });
    const [deleteConfirmId, setDeleteConfirmId] = useState(null); // For inline delete confirmation
    const [drinkPromotions, setDrinkPromotions] = useState([]);
    
    // --- Custom Hooks ---
    const cartFlow = useCart({
        onOpenMenuBuilder: (product) => menuFlow.openMenuBuilder(product)
    });
    const { cart, setCart, addToCart, updateQuantity, removeItem, clearCart, cartTotal } = cartFlow;

    const menuFlow = useMenuFlow({
        addToCart: (...args) => addToCart(...args),
        setCart,
        setSearchTerm,
        dailyMenu,
        fetchDailyMenu: () => fetchDailyMenu()
    });

    // Destructure for easy access in the template
    const {
        viewMode, setViewMode,
        menuSelection, setMenuSelection,
        pendingMenuProduct, setPendingMenuProduct,
        pendingVariantProduct, setPendingVariantProduct,
        variantQuantities, setVariantQuantities,
        pendingComboPromo, setPendingComboPromo,
        comboSelection, setComboSelection,

        handleConfirmVariants,
        openMenuBuilder,
        confirmMenuSelection,
        cancelMenuSelection,

        getComboItemCount,
        handleIncrementComboItem,
        handleDecrementComboItem,
        confirmComboSelection
    } = menuFlow;

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

    const paymentFlow = usePaymentFlow({
        account,
        clientForm,
        user,
        tableData,
        groupedOrders,
        fetchAccount,
        onClose
    });
    const { showPaymentModal, setShowPaymentModal, isConfirmingPayment } = paymentFlow;

    // isHappyHourActive moved to useCart / timeUtils



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
    }, [showPaymentModal, showTransferModal, pendingVariantProduct, isEditingClient]);

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
                setClientForm(prev => {
                    const newName = accRes.data.customerName;
                    const newDni = accRes.data.clientDni || '';
                    const newDireccion = accRes.data.clientAddress || '';
                    const newAccountType = accRes.data.accountType || 'standard';
                    const newStaffTotal = accRes.data.accountType === 'staff' ? parseFloat(accRes.data.total) : 0;
                    if (prev.name === newName && prev.dni === newDni && prev.direccion === newDireccion && prev.accountType === newAccountType && prev.staffTotal === newStaffTotal) {
                        return prev;
                    }
                    return {
                        name: newName,
                        dni: newDni,
                        direccion: newDireccion,
                        accountType: newAccountType,
                        staffTotal: newStaffTotal
                    };
                });

                // If viewing a history account and we didn't pass tableId, try to load its historical table
                if (accountId && !tableId && accRes.data.TableId) {
                    loadTableDataFromAcc(accRes.data.TableId);
                }
            } else {
                setAccount(null);
                setClientForm(prev => {
                    const targetType = prev.accountType || 'standard';
                    if (prev.name === 'Cliente' && prev.dni === '' && prev.direccion === '' && prev.accountType === targetType) {
                        return prev;
                    }
                    return { name: 'Cliente', dni: '', direccion: '', accountType: targetType };
                });
            }
        } catch (aErr) {
            console.error("Error loading account:", aErr);
        } finally {
            setIsAccountLoaded(true);
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
        setIsAccountLoaded(false);
        if (tableId) loadTableData();
        fetchProducts();
        fetchAccount();
        fetchDailyMenu();
        fetchDrinkPromotions();
        fetchBillingConfig();
        fetchQrs();
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

    useEffect(() => {
        if (!socket) return;
        if (showPaymentModal) {
            socket.emit('set_client_screen_mode', { mode: 'qr_fixed' });
        } else {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        }

        return () => {
            socket.emit('set_client_screen_mode', { mode: 'ads' });
        };
    }, [socket, showPaymentModal]);

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
    const [staffTotalInput, setStaffTotalInput] = useState('');
    const [staffCommentInput, setStaffCommentInput] = useState('');
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);
    const [orderError, setOrderError] = useState(null);
    // --------------------------------------

    useModalBackHandler(true, onClose);
    useModalBackHandler(showPaymentModal, () => setShowPaymentModal(false));
    useModalBackHandler(showStaffConfirm, () => setShowStaffConfirm(false));

    // --- 2x1 & MENU LOGIC START ---
    const handleClose = async () => {
        // If an account was opened but has NO orders, cancel it to free the table.
        // Even if there are items in the local cart, they will be lost anyway.
        if (account && (!account.Orders || account.Orders.length === 0)) {
            try {
                await axios.post(`/api/accounts/${account.id}/cancel`, { userId: user?.id, checkEmpty: true });
            } catch (err) {
                console.error("Error auto-cancelling empty account on close:", err);
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
                clientAddress: clientForm.direccion || '',
                userId: user?.id || null,
                accountType: clientForm.accountType,
                staffTotal: clientForm.accountType === 'staff' ? parseFloat(clientForm.staffTotal || 0) : undefined
            });
            setAccount(res.data);
            setClientForm({
                name: res.data.customerName,
                dni: res.data.clientDni || '',
                direccion: res.data.clientAddress || '',
                accountType: res.data.accountType || 'standard',
                staffTotal: res.data.accountType === 'staff' ? parseFloat(res.data.total) : 0
            });
            return res.data;
        } catch (err) {
            console.error("Error auto-opening:", err);
            const errorMsg = err.response?.data?.error || err.message || "Error desconocido";

            if (errorMsg === 'Mesa ya ocupada') {
                console.log("Mesa ya ocupada, recargando datos...");
                refreshData();
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
                clientAddress: clientForm.direccion,
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
                addToCart(product, '', [], singleOption.name);
                return;
            }

            setPendingVariantProduct({ ...product, parsedVariants: allOptions });
            setVariantQuantities({});
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
                    setVariantQuantities({});
                    return;
                }
            } catch (e) { console.error("Error parsing variants", e); }
        }

        // 2. Default Add
        addToCart(product);
    };

    // addToCart moved to useCart


    // Function bodies moved to useMenuFlow
    const [showPinPad, setShowPinPad] = useState(false);
    const [pinError, setPinError] = useState('');
    const [validatedPinForOrder, setValidatedPinForOrder] = useState(null);

    // Single unified function called after PIN is validated (or skipped).
    // Decides whether to show the print modal or go directly to execute.
    const proceedToSendOrder = (pin) => {
        setValidatedPinForOrder(pin);
        if (cartNeedsPrinting()) {
            // Delay slightly to allow PinPadModal's history.back() to complete before pushing new state
            setTimeout(() => setShowPrintConfirm(true), 100);
        } else {
            executeSendOrder(pin, false);
        }
    };

    const sendOrder = async () => {
        if (cart.length === 0) return;
        setOrderError(null);

        if (user?.requirePinPrompt) {
            // Step 1: Show PIN pad. Flow continues in handlePinConfirm -> proceedToSendOrder
            setPinError('');
            setShowPinPad(true);
            return;
        }

        // No PIN required: go directly to step 2
        proceedToSendOrder(null);
    };

    const cartNeedsPrinting = () => {
        if (!printingEnabled) return false;
        for (const item of cart) {
            if (!item.productId) return true; // Combos/Promos usually print
            const p = products.find(prod => prod.id === item.productId);
            if (p) {
                // 'otro' type (Cover, cargos varios) never goes to kitchen/bar — skip comanda
                if (p.type === 'otro') continue;
                // Terminado = isStockManaged=true → no comanda needed
                if (!p.isStockManaged) {
                    return true;
                }
            } else {
                return true; // Unknown product, assume it prints
            }
        }
        return false;
    };

    const handlePinConfirm = async (enteredPin) => {
        setPinError('');
        try {
            // Step 1b: Validate PIN
            const res = await axios.post('/api/validate-pin', { pin: enteredPin });
            if (res.data.success) {
                setShowPinPad(false);
                // Step 2: Same path as non-PIN flow
                proceedToSendOrder(enteredPin);
            }
        } catch (err) {
            console.error('Validate PIN Error:', err);
            let msg = `Error interno: ${err.message || err.toString()}`;
            if (err.response?.data?.error) {
                msg = err.response.data.error;
            } else if (err.response?.status === 400 || err.response?.status === 401) {
                msg = 'PIN incorrecto o usuario inactivo';
            } else if (err.response?.status) {
                msg = `Error del servidor HTTP ${err.response.status}`;
            }
            setPinError(msg);
            alert(msg);
        }
    };

    const handlePrintConfirmDialog = async (wantsPrint) => {
        // Step 3: User responded to print modal
        setShowPrintConfirm(false);
        await executeSendOrder(validatedPinForOrder, wantsPrint);
        setValidatedPinForOrder(null);
    };


    const executeSendOrder = async (authorPin = null, printComanda = false) => {
        if (isSendingOrder || isSendingRef.current) return false;
        setOrderError(null);
        setIsSendingOrder(true);
        isSendingRef.current = true;
        let targetAccountId = account?.id;

        try {

            if (!targetAccountId) {
                // Open account NOW because we are sending an order
                const newAccount = await handleAutoOpen();
                if (!newAccount) {
                    setIsSendingOrder(false);
                    isSendingRef.current = false;
                    return false;
                }
                targetAccountId = newAccount.id;
            }

            if (!idempotencyKeyRef.current) {
                // Generate a unique batch ID for this cart attempt
                idempotencyKeyRef.current = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
            }
            const currentBatchId = idempotencyKeyRef.current;

            await axios.post('/api/orders', {
                accountId: targetAccountId,
                products: cart,
                userId: user?.id || null,
                authorPin: authorPin,
                printComanda: printComanda,
                batchId: currentBatchId
            });
            clearCart();

            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            // Also trigger global refresh to update other components
            refreshData();
            
            setIsSendingOrder(false);
            isSendingRef.current = false;
            return true;
        } catch (err) {
            const errorMsg = err.response?.data?.details?.join('\n') || err.response?.data?.error || err.message || 'Error enviando pedido';
            setOrderError(errorMsg);
            setIsSendingOrder(false);
            isSendingRef.current = false;
            return false;
        }
    };

    const handlePrintPreCuenta = async (accountId) => {
        if (!accountId || isActionInProgress) return;
        setIsActionInProgress(true);
        try {
            const res = await axios.post(`/api/accounts/${accountId}/print-pre-cuenta`);
            if (res.data.success) {
                alert("Pre-cuenta enviada a la impresora.");
            } else {
                alert("Error al enviar pre-cuenta a la impresora.");
            }
        } catch (err) {
            alert(err.response?.data?.error || "Error al imprimir la pre-cuenta");
            console.error(err);
        } finally {
            setIsActionInProgress(false);
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
        if (isActionInProgress) return;
        setDeleteConfirmId(null); // Clear inline confirmation
        const order = account?.Orders?.find(o => o.id === orderId);
        if (order) {
            const orderPrice = parseFloat(order.priceAtOrder || 0);
            const orderQty = parseFloat(order.quantity || 1);
            const newTotal = Math.max(0, parseFloat(account.total) - (orderPrice * orderQty));
            const totalPaid = account.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
            if (newTotal < totalPaid) {
                if (!window.confirm(`⚠️ Advertencia: Esta cuenta tiene abonos registrados (S/ ${totalPaid.toFixed(2)}) que superan el nuevo total de la cuenta (S/ ${newTotal.toFixed(2)}).\n\n¿Estás seguro de que deseas eliminar este pedido de todas formas?`)) {
                    return;
                }
            }
        }
        setIsActionInProgress(true);
        try {
            await axios.delete(`/api/orders/${orderId}?userId=${user?.id}`);
            // Force reload manually to see price update immediately
            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            refreshData();

        } catch (err) {
            alert("Error eliminando pedido");
            console.error(err);
        } finally {
            setIsActionInProgress(false);
        }
    };

    const handleDecrementOrder = async (orderId) => {
        if (isActionInProgress) return;
        const order = account?.Orders?.find(o => o.id === orderId);
        if (order) {
            const orderPrice = parseFloat(order.priceAtOrder || 0);
            const newTotal = Math.max(0, parseFloat(account.total) - orderPrice);
            const totalPaid = account.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
            if (newTotal < totalPaid) {
                if (!window.confirm(`⚠️ Advertencia: Esta cuenta tiene abonos registrados (S/ ${totalPaid.toFixed(2)}) que superan el nuevo total de la cuenta (S/ ${newTotal.toFixed(2)}).\n\n¿Estás seguro de que deseas reducir este pedido de todas formas?`)) {
                    return;
                }
            }
        }
        setIsActionInProgress(true);
        try {
            await axios.put(`/api/orders/${orderId}/decrement`, { userId: user?.id });
            // Force reload manually to see price update immediately
            const accRes = await axios.get(`/api/accounts/table/${tableId}`);
            setAccount(accRes.data);

            // Force Menu Refresh immediately to update Stock UI
            await fetchDailyMenu();
            refreshData();

        } catch (err) {
            alert("Error reduciendo cantidad de pedido");
            console.error(err);
        } finally {
            setIsActionInProgress(false);
        }
    };

    const handleCloseClick = async () => {
        if (isActionInProgress) return;
        setIsActionInProgress(true);
        try {
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
                    await axios.post(`/api/accounts/${account.id}/cancel`, { userId: user?.id, checkEmpty: true });
                    // Refresh table status in background or just close
                    onClose();
                } catch (e) {
                    alert(e.response?.data?.error || "Error liberando mesa");
                }
                return;
            }

            if (account.accountType === 'staff' && parseFloat(account.total) === 0) {
                if (!confirm("¿Cerrar consumo de personal? (Total S/ 0.00)")) return;
                try {
                    const formData = new FormData();
                    formData.append('paymentMethod', 'consumo_interno');
                    if (user?.id) {
                        formData.append('userId', user.id);
                    }
                    await axios.post(`/api/accounts/${account.id}/close`, formData);
                    onClose();
                    refreshData();
                } catch (e) {
                    alert("Error al cerrar consumo de personal");
                }
                return;
            }

            const totalPaid = account.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
            const remaining = Math.max(0, Math.round((parseFloat(account.total) - totalPaid) * 100) / 100);
            setPayAmount(remaining.toString());

            setShowPaymentModal(true);
            setIsConfirmingPayment(false); // Reset confirmation state
            setIssueInvoice(false); // ALWAYS start disabled
            setInvoiceType(clientForm.dni && clientForm.dni.length === 11 ? 'factura' : 'boleta');
        } finally {
            setIsActionInProgress(false);
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
    // Now delegated to menuStockUtils (pure function, same signature, no state deps).
    // The imported getEffectiveStock replaces this — all call sites work unchanged.


    // Helper to sync Daily Menu items with Real Product Stock
    // Delegated to menuStockUtils — wrap to inject `products` from component state.
    const syncMenuStockLocal = (items) => syncMenuStock(items, products);

    const filteredEntries = getMenuOptions(syncMenuStockLocal(parsedEntries));
    const filteredMains = getMenuOptions(syncMenuStockLocal(parsedMains));

    // Calculate Stock for Menu Products
    // Delegated to menuStockUtils — wrap to inject parsedEntries, parsedMains, products.
    const getMenuStockStatsLocal = (menuGroup) => getMenuStockStats(menuGroup, parsedEntries, parsedMains, products);

    // Delegated to menuStockUtils — wrap to inject cart, parsedEntries, parsedMains, products.
    const isProductOutOfStockLocal = (prod) => isProductOutOfStock(prod, cart, parsedEntries, parsedMains, products);

    const renderStockOrLibreBadge = (prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails) => {
        if (isMissingRecipe) {
            return (
                <span className="inline-block bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                    Receta
                </span>
            );
        }

        if (hasVariants && variantsList.length > 1) {
            const allOut = variantsList.every(v => v.stock !== undefined && v.stock <= 0);
            if (allOut) {
                return (
                    <span className="inline-block bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                        Agotado
                    </span>
                );
            }
            if (prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') {
                return (
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                        Con Stock
                    </span>
                );
            } else {
                return null;
            }
        }

        const isManaged = prod.isStockManaged || prod.requiresPreparation || (prod.type === 'menu' && !isMenuUnlimited);
        if (!isManaged) {
            return null;
        }

        if (isOutOfStock) {
            return (
                <span className="inline-block bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                    Agotado {stockDetails ? `(${stockDetails})` : ''}
                </span>
            );
        }

        const stockQty = (hasVariants && variantsList.length === 1 && variantsList[0].stock !== undefined) ? variantsList[0].stock : displayStock;
        return (
            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 shadow-sm">
                Stock: {stockQty}
            </span>
        );
    };

    // cartTotal is now provided by useCart
    const accountTotal = account ? parseFloat(account.total) : 0;
    const totalPaid = account?.Payments ? account.Payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) : 0;
    const remaining = account ? Math.max(0, accountTotal - totalPaid) : 0;

    const isStaff = (account?.accountType === 'staff') || (!account && clientForm.accountType === 'staff');
    
    // Original total (sum of all items at standard prices + cart)
    const originalOrdersTotal = account?.Orders 
        ? account.Orders.reduce((sum, o) => o.status !== 'cancelled' ? sum + (parseFloat(o.priceAtOrder) * o.quantity) : sum, 0) 
        : 0;
    const originalGrandTotal = originalOrdersTotal + cartTotal;

    // Custom/Payable total
    const staffPayableTotal = account ? accountTotal : (parseFloat(clientForm.staffTotal) || 0);
    const grandTotal = isStaff 
        ? Math.max(0, staffPayableTotal - totalPaid) 
        : (cartTotal + (totalPaid > 0 ? remaining : accountTotal));

    if (loading) {
        return createPortal(
            <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Cargando...</div>,
            document.body
        );
    }

    const cartSidebarProps = {
        account,
        clientForm,
        setClientForm,
        handleClose,
        handleCloseClick,
        setStaffTotalInput,
        setStaffCommentInput,
        setShowStaffConfirm,
        groupedOrders,
        products,
        user,
        deleteConfirmId,
        setDeleteConfirmId,
        handleDeleteOrder,
        handleDecrementOrder,
        cart,
        updateQuantity,
        removeItem,
        totalPaid,
        isStaff,
        staffPayableTotal,
        accountTotal,
        originalGrandTotal,
        grandTotal,
        orderError,
        sendOrder,
        isSendingOrder,
        printingEnabled,
        handlePrintPreCuenta
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4 z-50">
            <div className="bg-white w-full h-[100dvh] md:h-[90vh] md:max-w-6xl rounded-none md:rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

                {/* --- MOBILE: CART VIEW OVERLAY --- */}
                {showMobileCart && (
                    <CartSidebar viewMode="mobile" onCloseMobile={() => setShowMobileCart(false)} {...cartSidebarProps} />
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
                                    <p className="text-sm text-gray-500 mb-4">Selecciona las cantidades para cada presentación:</p>
                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                        {pendingVariantProduct.parsedVariants
                                            .filter(v => {
                                                const isManaged = pendingVariantProduct.isStockManaged || pendingVariantProduct.requiresPreparation || pendingVariantProduct.type === 'menu';
                                                return !isManaged || v.stock === undefined || v.stock > 0;
                                            })
                                            .map((v, idx) => {
                                            const currentQty = variantQuantities[v.name] || 0;
                                            const qtyInCart = cart.reduce((acc, item) => 
                                                (item.productId === pendingVariantProduct.id && item.presentation === v.name) ? acc + item.quantity : acc
                                            , 0);
                                            const isAddDisabled = v.stock !== undefined && (qtyInCart + currentQty) >= v.stock;
                                            
                                            const handleIncrement = () => {
                                                if (isAddDisabled) return;
                                                setVariantQuantities(prev => ({
                                                    ...prev,
                                                    [v.name]: (prev[v.name] || 0) + 1
                                                }));
                                            };
                                            
                                            const handleDecrement = () => {
                                                if (currentQty <= 0) return;
                                                setVariantQuantities(prev => ({
                                                    ...prev,
                                                    [v.name]: Math.max(0, (prev[v.name] || 0) - 1)
                                                }));
                                            };

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl transition-all ${v.stock <= 0 ? 'opacity-50 grayscale' : ''}`}
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-bold text-base text-gray-800">
                                                            {v.name === 'Normal' ? `Base` : v.name}
                                                        </span>
                                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                            {v.happyHourPrice && isHappyHourActive(v.happyHourStart, v.happyHourEnd) ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-gray-400 line-through">S/ {Number(parseFloat(v.price).toFixed(1))}</span>
                                                                    <span className="font-bold text-yellow-600 text-sm">S/ {Number(parseFloat(v.happyHourPrice).toFixed(1))}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-bold text-gray-700 text-sm">S/ {Number(parseFloat(v.price).toFixed(1))}</span>
                                                            )}
                                                            {v.stock !== undefined && (pendingVariantProduct.isStockManaged || pendingVariantProduct.requiresPreparation || pendingVariantProduct.type === 'menu') && (
                                                                <span className={`text-[10px] ${v.stock <= 0 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                                    Stock: {v.stock} {qtyInCart > 0 ? `(${qtyInCart} en cart)` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Quantity Controls */}
                                                    {v.stock > 0 ? (
                                                        <div className="flex items-center gap-2.5">
                                                            {currentQty > 0 && (
                                                                <>
                                                                    <button
                                                                        onClick={handleDecrement}
                                                                        className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 rounded-full font-black text-lg hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="font-bold text-blue-700 w-4 text-center">
                                                                        {currentQty}
                                                                    </span>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={handleIncrement}
                                                                disabled={isAddDisabled}
                                                                className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-lg transition-all
                                                                    ${isAddDisabled
                                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Agotado</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Action Buttons at bottom of modal */}
                                    <div className="mt-5 pt-3 border-t flex gap-3">
                                        <button
                                            onClick={() => setPendingVariantProduct(null)}
                                            className="flex-1 py-3 text-gray-600 bg-gray-100 font-bold hover:bg-gray-200 rounded-xl transition-colors text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleConfirmVariants}
                                            disabled={Object.values(variantQuantities).reduce((a, b) => a + b, 0) === 0}
                                            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-all text-sm
                                                ${Object.values(variantQuantities).reduce((a, b) => a + b, 0) === 0
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        >
                                            Confirmar ({Object.values(variantQuantities).reduce((a, b) => a + b, 0)})
                                        </button>
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
                    <div className="px-2.5 py-3.5 sm:p-4 bg-white shadow-sm z-10">
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
                                        
                                        if (cat === 'combo') {
                                            setViewMode('combo_categories');
                                            setPendingComboPromo(null);
                                            setComboSelection([]);
                                            setPendingMenuProduct(null);
                                            setPendingVariantProduct(null);
                                        } else if (cat === 'menu') {
                                            const menuProducts = products.filter(p => p.type === 'menu' && dailyMenu.activeGroups.includes(p.name) && !isProductOutOfStockLocal(p));
                                            if (menuProducts.length === 1) {
                                                setPendingMenuProduct(menuProducts[0]);
                                                setViewMode('menu_builder');
                                                setPendingVariantProduct(null);
                                                fetchDailyMenu(); // Ensure menu data is fresh
                                            } else {
                                                setViewMode('products');
                                                setPendingMenuProduct(null);
                                                setPendingVariantProduct(null);
                                            }
                                        } else {
                                            setViewMode('products');
                                            setPendingMenuProduct(null);
                                            setPendingVariantProduct(null);
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

                    {/* Pin Pad Modal */}
                    <PinPadModal
                        isOpen={showPinPad}
                        onClose={() => setShowPinPad(false)}
                        onConfirm={handlePinConfirm}
                        errorMsg={pinError}
                    />

                    {/* Print Confirm Modal */}
                    <PrintConfirmModal
                        isOpen={showPrintConfirm}
                        onClose={() => {
                            setShowPrintConfirm(false);
                            setValidatedPinForOrder(null);
                        }}
                        onConfirm={handlePrintConfirmDialog}
                    />

                    {/* Main Content Area — Flex column to support sticky footer */}
                    <div className="flex-1 flex flex-col min-h-0 px-1.5 py-3 sm:px-4 sm:py-4 pb-36 md:pb-4 overflow-hidden">

                        {/* Scrollable Content Wrapper */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">

                            {/* SEARCH RESULTS (Standard categories) */}
                            {searchTerm && selectedCategory !== 'combo' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No se encontraron productos para "{searchTerm}".
                                        </div>
                                    ) : (
                                        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            let isMenuUnlimited = false;
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStatsLocal(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                                isMenuUnlimited = stats.isUnlimited;
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
                                                    className={`bg-white p-2.5 sm:p-3 rounded-lg border shadow-sm text-center flex flex-col items-center justify-between min-h-[10.5rem] h-auto pb-3.5 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-[13px] sm:text-sm leading-tight line-clamp-3 px-1">{prod.name}</div>
                                                        {renderStockOrLibreBadge(prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails)}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-sm sm:text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
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
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                                    {(products.filter(p => {
                                        if (selectedCategory === 'menu') {
                                            return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name) && !isProductOutOfStockLocal(p);
                                        }
                                        return p.type === selectedCategory && !isProductOutOfStockLocal(p);
                                    }).length === 0) ? (
                                        <div className="col-span-full text-center text-gray-400 py-20 italic">
                                            No hay productos disponibles o no coinciden con la búsqueda.
                                        </div>
                                    ) : (
                                        products.filter(p => {
                                            if (selectedCategory === 'menu') {
                                                return p.type === 'menu' && dailyMenu.activeGroups.includes(p.name) && !isProductOutOfStockLocal(p);
                                            }
                                            return p.type === selectedCategory && !isProductOutOfStockLocal(p);
                                        }).map(prod => {
                                            const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
                                            let displayStock = getEffectiveStock(prod);
                                            let stockDetails = '';
                                            let isMenuUnlimited = false;
                                            if (prod.type === 'menu') {
                                                const stats = getMenuStockStatsLocal(prod);
                                                displayStock = stats.stock;
                                                stockDetails = stats.details;
                                                isMenuUnlimited = stats.isUnlimited;
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
                                                    className={`bg-white p-2.5 sm:p-3 rounded-lg border shadow-sm text-center flex flex-col items-center justify-between min-h-[9.5rem] h-auto pb-3.5 relative active:scale-95 transition-all ${isOutOfStock ? 'opacity-60' : ''} ${needsExtraWidth ? 'md:col-span-2' : ''}`}
                                                >
                                                    {cartQty > 0 && (
                                                        <div className="absolute top-2 right-2 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10">
                                                            {cartQty}
                                                        </div>
                                                    )}
                                                    <div className="w-full">
                                                        <div className="font-bold text-gray-800 text-[13px] sm:text-sm leading-tight line-clamp-3 px-1">{prod.name}</div>
                                                        {renderStockOrLibreBadge(prod, displayStock, isOutOfStock, isMissingRecipe, isMenuUnlimited, hasVariants, variantsList, stockDetails)}
                                                    </div>
                                                    <div className="w-full flex justify-center mt-4 pb-2">
                                                        {hasVariants && variantsList.length > 1 ? (
                                                            <div className="flex flex-wrap gap-2 justify-center max-w-[95%]">
                                                                {variantsList.map((variant, idx) => {
                                                                    const isHH = variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd);
                                                                    return (
                                                                        <div key={idx} className={`${isHH ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-sm sm:text-base font-bold border shadow-sm flex items-center gap-1`}>
                                                                            {isHH && <Clock size={14} />}
                                                                            S/ {Number(parseFloat(isHH ? variant.happyHourPrice : variant.price).toFixed(1))}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : hasVariants && variantsList.length === 1 ? (
                                                            <div className={`${variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
                                                                {variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) && <Clock size={14} />}
                                                                S/ {Number(parseFloat(variantsList[0].happyHourPrice && isHappyHourActive(variantsList[0].happyHourStart, variantsList[0].happyHourEnd) ? variantsList[0].happyHourPrice : variantsList[0].price).toFixed(1))}
                                                            </div>
                                                        ) : (
                                                            <div className={`${prod.happyHourPrice && isHappyHourActive(prod.happyHourStart, prod.happyHourEnd) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'} font-bold text-sm sm:text-base px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border flex items-center gap-1`}>
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
                                            const count = getComboItemCount(item.id, item._promo.id);
                                            return (
                                                <div
                                                    key={item._uid}
                                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all border bg-white border-gray-150 shadow-sm"
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-bold text-gray-800">{item.name}</span>
                                                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full uppercase font-black tracking-tight shrink-0">{item._promo.name}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400 mt-0.5">S/ {Number(parseFloat(item.individualPrice || 0).toFixed(1))} individual</span>
                                                    </div>
                                                    
                                                    {/* Quantity Selector Counter */}
                                                    <div className="flex items-center gap-2.5">
                                                        {count > 0 && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleDecrementComboItem(item.id, item._promo.id)}
                                                                    className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-black text-sm hover:bg-purple-200 transition-colors"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="font-bold text-purple-700 w-4 text-center">
                                                                    {count}
                                                                </span>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => handleIncrementComboItem(item, item._promo)}
                                                            disabled={comboSelection.length >= 2}
                                                            className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm transition-all
                                                                ${comboSelection.length >= 2
                                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
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
                                                    const count = getComboItemCount(item.id, pendingComboPromo.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all border bg-white border-gray-150 shadow-sm"
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-base font-bold text-gray-800">{item.name}</span>
                                                                <span className="text-xs text-gray-400 mt-0.5">S/ {Number(parseFloat(item.individualPrice ?? 0).toFixed(1))} individual</span>
                                                            </div>
                                                            
                                                            {/* Quantity Selector Counter */}
                                                            <div className="flex items-center gap-2.5">
                                                                {count > 0 && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleDecrementComboItem(item.id, pendingComboPromo.id)}
                                                                            className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full font-black text-sm hover:bg-purple-200 transition-colors"
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="font-bold text-purple-700 w-4 text-center">
                                                                            {count}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleIncrementComboItem(item, pendingComboPromo)}
                                                                    disabled={comboSelection.length >= 2}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm transition-all
                                                                        ${comboSelection.length >= 2
                                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                            : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
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
                                            onClick={() => confirmMenuSelection(filteredEntries, filteredMains)}
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

                            return (
                                <div className="border-t border-purple-100 pt-3 mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white z-20">
                                    <div className="flex flex-row items-center justify-between sm:justify-start gap-3 sm:gap-6 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full ring-1 ring-purple-100 shrink-0">
                                                {comboSelection.length}/2
                                            </span>
                                            <span className="text-xs text-gray-700 truncate font-semibold max-w-[120px] sm:max-w-xs">
                                                {comboSelection.map(s => s.name).join(' + ')}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-1.5 shrink-0">
                                            <span className="text-purple-700 font-black text-lg sm:text-2xl tracking-tight">
                                                S/ {Number(displayPrice.toFixed(1))}
                                            </span>
                                            <span className="text-[8px] text-gray-400 uppercase font-bold tracking-wider leading-none">{priceLabel}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setComboSelection([])}
                                            className="px-3 py-2 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors border text-center"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={() => confirmComboSelection(displayPrice)}
                                            className={`px-4 py-2 rounded-xl font-black text-xs transition-all shadow active:scale-95 flex items-center justify-center gap-1.5 
                                            ${comboSelection.length === 2
                                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                                                    : 'bg-white border-2 border-purple-600 text-purple-700 hover:bg-purple-50 shadow-sm'}`}
                                        >
                                            {comboSelection.length === 2 ? (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Agregar Combo
                                                </>
                                            ) : (
                                                'Llevar 1 Individual'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* MOBILE FLOATING FOOTER (Only if not showing cart) */}
                    {!showMobileCart && (
                        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50/95 via-gray-50/70 to-transparent pointer-events-none flex flex-col gap-2">
                            <button
                                onClick={handleClose}
                                className="w-full py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center justify-center gap-1.5 pointer-events-auto transition-transform active:scale-95 text-sm"
                            >
                                <X size={16} />
                                <span>Ir al salón</span>
                            </button>
                            <button
                                onClick={() => setShowMobileCart(true)}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex justify-between px-6 pointer-events-auto transition-transform active:scale-95 ${cart.length > 0 ? 'bg-blue-600' : 'bg-gray-800'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <ShoppingCart size={20} />
                                    <span>{cart.length > 0 ? 'Ver Carrito' : 'Ver Cuenta'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                    {isStaff && (
                                        <span className="text-xs text-white/60 line-through">
                                            S/ {Number(originalGrandTotal).toFixed(1)}
                                        </span>
                                    )}
                                    <span>S/ {Number(grandTotal).toFixed(1)}</span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: Desktop Cart Panel (Always visible on desktop, hidden on mobile) */}
                <CartSidebar viewMode="desktop" {...cartSidebarProps} />
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
                            <p className="text-gray-600 mb-4 font-medium text-sm">
                                ¿Estás seguro que deseas marcar esta mesa como Consumo de Trabajador?
                                <br /><br />
                                <span className="bg-orange-100 px-2 py-1.5 rounded text-orange-800 text-xs font-bold block text-left">
                                    Los productos mantendrán su precio original, pero el total de la cuenta se ajustará al valor ingresado.
                                </span>
                            </p>
                             <div className="flex flex-col gap-3 mb-6 text-left">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-700">Total a cobrar (S/)</label>
                                    <input 
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white" 
                                        value={staffTotalInput} 
                                        onChange={e => setStaffTotalInput(e.target.value)} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-700">Comentario / Nota de Consumo</label>
                                    <input 
                                        type="text"
                                        className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white" 
                                        value={staffCommentInput} 
                                        onChange={e => setStaffCommentInput(e.target.value)} 
                                        placeholder="Escriba un comentario (ej: Juan Pérez)"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowStaffConfirm(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        const parsedTotal = parseFloat(staffTotalInput) || 0;
                                        const comment = staffCommentInput.trim();
                                        if (!comment) {
                                            alert("Por favor ingrese un comentario o nota para el consumo de personal.");
                                            return;
                                        }
                                        const newClientForm = { ...clientForm, accountType: 'staff', name: 'Personal', dni: '', staffTotal: parsedTotal, direccion: comment };
                                        setClientForm(newClientForm);
                                        if (account) {
                                            try {
                                                const res = await axios.put(`/api/accounts/${account.id}`, {
                                                    customerName: newClientForm.name,
                                                    clientDni: newClientForm.dni,
                                                    clientAddress: comment,
                                                    accountType: newClientForm.accountType,
                                                    staffTotal: parsedTotal
                                                });
                                                setAccount(res.data);
                                                setIsEditingClient(false);
                                            } catch (err) {
                                                console.error("Error setting account to staff:", err);
                                                alert('Error al actualizar la cuenta a consumo de trabajador');
                                            }
                                        }
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
            <PaymentModal
                showPaymentModal={showPaymentModal}
                paymentFlow={paymentFlow}
                account={account}
                tableData={tableData}
                clientForm={clientForm}
                setClientForm={setClientForm}
                isSearchingClient={isSearchingClient}
                searchClientData={searchClientData}
                printingEnabled={printingEnabled}
                fetchAccount={fetchAccount}
                onClose={onClose}
            />
        </div >,
        document.body
    );
}

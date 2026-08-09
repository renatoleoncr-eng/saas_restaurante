import { useState } from 'react';

/**
 * useMenuFlow.js
 * Encapsula el estado y la lógica de flujo para la construcción de Menú del Día,
 * variantes de productos, y promociones 2x1 (Combos).
 */
export function useMenuFlow({ addToCart, setCart, setSearchTerm, dailyMenu, fetchDailyMenu }) {
    // Menu Daily & View State
    const [viewMode, setViewMode] = useState('products'); // 'products' | 'menu_builder' | 'combo_categories' | 'combo_picker'
    const [menuSelection, setMenuSelection] = useState({ entry: '', main: '' });
    const [pendingMenuProduct, setPendingMenuProduct] = useState(null);
    
    // Variant State
    const [pendingVariantProduct, setPendingVariantProduct] = useState(null);
    const [variantQuantities, setVariantQuantities] = useState({});

    // 2x1 Drink Promotions State
    const [pendingComboPromo, setPendingComboPromo] = useState(null);
    const [comboSelection, setComboSelection] = useState([]);

    // --- Variant Logic ---
    const handleConfirmVariants = () => {
        if (!pendingVariantProduct) return;
        Object.entries(variantQuantities).forEach(([presentationName, qty]) => {
            if (qty > 0) {
                addToCart(pendingVariantProduct, '', [], presentationName, null, qty);
            }
        });
        setPendingVariantProduct(null);
    };

    // --- Menu del Día Logic ---
    const openMenuBuilder = (product) => {
        setPendingMenuProduct(product);
        if (dailyMenu.entries.length === 0 && fetchDailyMenu) fetchDailyMenu();
        setViewMode('menu_builder');
        setMenuSelection({ entry: '', main: '' });
    };

    const confirmMenuSelection = (filteredEntries, filteredMains) => {
        if (!menuSelection.entry && !menuSelection.main) {
            alert("Debes seleccionar al menos una Entrada o un Segundo");
            return;
        }

        const entryObj = filteredEntries.find(e => e.name === menuSelection.entry && (e.groupName || 'Menú del Día') === pendingMenuProduct.name);
        const mainObj = filteredMains.find(m => m.name === menuSelection.main && (m.groupName || 'Menú del Día') === pendingMenuProduct.name);

        const subItems = [];
        let totalCustomPrice = 0;
        let isCombo = false;

        if (menuSelection.entry && menuSelection.main) {
            isCombo = true;
        }

        if (entryObj && menuSelection.entry) {
            subItems.push({
                productId: entryObj.linkId || null,
                menuItemId: entryObj.id || null, // BACKWARD COMPATIBILITY
                quantity: 1,
                name: entryObj.name,
                price: entryObj.individualPrice || 0
            });
            if (!isCombo) totalCustomPrice += Number(entryObj.individualPrice || 0);
        }

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

        const presentation = pendingMenuProduct.isVirtualGroup ? pendingMenuProduct.name : null;

        const productToCart = { ...pendingMenuProduct };
        let overridePrice = null;
        if (!isCombo) {
            overridePrice = totalCustomPrice;
            productToCart.price = totalCustomPrice;
        }

        addToCart(productToCart, note, subItems, presentation, overridePrice);
        setViewMode('products');
        setPendingMenuProduct(null);
        setMenuSelection({ entry: null, main: null });
    };

    const cancelMenuSelection = () => {
        setViewMode('products');
        setPendingMenuProduct(null);
    };

    // --- 2x1 Combo Logic ---
    const getComboItemCount = (itemId, promoId) => {
        return comboSelection.filter(s => s.id === itemId && s.promoId === promoId).length;
    };

    const handleIncrementComboItem = (item, promo) => {
        if (comboSelection.length >= 2) return;
        const instanceId = `${promo.id}:${item.id}:${Date.now()}:${Math.random()}`;
        setComboSelection(prev => [...prev, {
            ...item,
            promoId: promo.id,
            _uid: instanceId,
            _promoPrice: parseFloat(promo.price),
            _originalPrice: parseFloat(item.individualPrice || 0)
        }]);
    };

    const handleDecrementComboItem = (itemId, promoId) => {
        setComboSelection(prev => {
            const idx = prev.findIndex(s => s.id === itemId && s.promoId === promoId);
            if (idx === -1) return prev;
            return prev.filter((_, i) => i !== idx);
        });
    };

    const confirmComboSelection = (displayPrice) => {
        if (comboSelection.length === 0) return;
        const name = comboSelection.length === 2
            ? `${comboSelection[0].name} + ${comboSelection[1].name}`
            : comboSelection[0].name;
            
        const subItems = comboSelection.map(s => ({
            drinkItemId: s.id,
            productId: s.linkedProductId || null,
            type: s.type,
            quantity: 1,
            name: s.name
        }));
        
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
        setSearchTerm('');
    };

    return {
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
    };
}

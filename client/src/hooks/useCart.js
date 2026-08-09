import { useState } from 'react';
import { isHappyHourActive } from '../utils/timeUtils';

/**
 * useCart.js
 * Encapsula la lógica del carrito de compras local para el TableControl.
 */
export function useCart({ onOpenMenuBuilder }) {
    const [cart, setCart] = useState([]);

    const addToCart = (product, specificNotes = '', subItems = [], presentationName = null, overridePrice = null, quantityToAdd = 1) => {
        // Intercept Menu Type -> Switch to Inline Builder
        if (product.type === 'menu' && !specificNotes && onOpenMenuBuilder) {
            onOpenMenuBuilder(product);
            return;
        }

        let basePrice = 0;
        let activePrice = 0;

        const variants = product.parsedVariants || product.ProductVariants;

        if (overridePrice !== null) {
            basePrice = parseFloat(overridePrice);
            activePrice = parseFloat(overridePrice);
        } else if (presentationName && variants) {
            const variantEntry = variants.find(v => v.name === presentationName);
            if (variantEntry) {
                basePrice = parseFloat(variantEntry.price || 0);
                const isHH = variantEntry.happyHourPrice && isHappyHourActive(variantEntry.happyHourStart, variantEntry.happyHourEnd);
                activePrice = isHH ? parseFloat(variantEntry.happyHourPrice) : basePrice;
            } else {
                basePrice = product.price !== undefined ? parseFloat(product.price) : 0;
                const isHH = product.happyHourPrice && isHappyHourActive(product.happyHourStart, product.happyHourEnd);
                activePrice = isHH ? parseFloat(product.happyHourPrice) : basePrice;
            }
        } else {
            basePrice = product.price !== undefined ? parseFloat(product.price) : 0;
            const isHH = product.happyHourPrice && isHappyHourActive(product.happyHourStart, product.happyHourEnd);
            activePrice = isHH ? parseFloat(product.happyHourPrice) : basePrice;
        }

        const finalPriceCalc = activePrice;
        const originalPriceCalc = basePrice;

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
                    quantity: newCart[existingIndex].quantity + quantityToAdd
                };
                return newCart;
            }
            return [...prev, {
                productId: product.id,
                name: finalName,
                price: finalPriceCalc,
                originalPrice: originalPriceCalc,
                quantity: quantityToAdd,
                notes: specificNotes || '',
                subItems: subItems,
                presentation: presentationName // Important: Send this to backend
            }];
        });
    };

    const updateQuantity = (index, delta) => {
        setCart(prev => prev.map((item, i) => {
            if (i === index) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
        }));
    };

    const removeItem = (index) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const clearCart = () => setCart([]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return {
        cart,
        setCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        cartTotal
    };
}

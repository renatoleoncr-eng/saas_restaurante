/**
 * menuStockUtils.js
 * Utilidades puras de cálculo de stock para productos y menú del día.
 * Extraído de TableControl.jsx — las dependencias (cart, products, parsedEntries, parsedMains)
 * se reciben como parámetros en lugar de cerrar sobre el estado del componente.
 */

/**
 * Calcula el stock efectivo de un producto basado en recetas, variantes o stock directo.
 * @param {object} product - El producto (con Recipes, ProductVariants, isStockManaged, etc.)
 * @param {string|null} presentation - Nombre de la variante/presentación, o null para el producto base.
 * @returns {number} Stock efectivo disponible.
 */
export function getEffectiveStock(product, presentation = null) {
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
}

/**
 * Sincroniza los ítems del menú del día con el stock real de sus productos enlazados.
 * @param {Array} items - Lista de ítems del menú (parsedEntries o parsedMains).
 * @param {Array} products - Lista completa de productos del restaurante.
 * @returns {Array} Ítems con el campo `stock` actualizado al stock físico real.
 */
export function syncMenuStock(items, products) {
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
}

/**
 * Calcula las estadísticas de stock de un grupo de menú del día.
 * @param {object} menuGroup - El grupo de menú (tiene .name).
 * @param {Array} parsedEntries - Entradas del menú del día.
 * @param {Array} parsedMains - Fondos/principales del menú del día.
 * @param {Array} products - Lista completa de productos.
 * @returns {{ stock: number, isUnlimited: boolean, details: string }}
 */
export function getMenuStockStats(menuGroup, parsedEntries, parsedMains, products) {
    // 1. Get all items belonging to this group
    const groupEntries = syncMenuStock(parsedEntries, products).filter(e => (e.groupName || 'Menú del Día') === menuGroup.name);
    const groupMains = syncMenuStock(parsedMains, products).filter(m => (m.groupName || 'Menú del Día') === menuGroup.name);

    const totalEntriesStock = groupEntries.reduce((sum, e) => sum + Number(e.stock || 0), 0);
    const totalMainsStock = groupMains.reduce((sum, m) => sum + Number(m.stock || 0), 0);

    const minStock = Math.min(totalEntriesStock, totalMainsStock);

    const hasUnlimitedEntry = groupEntries.some(e => Number(e.stock || 0) >= 999);
    const hasUnlimitedMain = groupMains.some(m => Number(m.stock || 0) >= 999);
    const isUnlimited = hasUnlimitedEntry && hasUnlimitedMain;

    return {
        stock: minStock,
        isUnlimited,
        details: `E:${totalEntriesStock}/S:${totalMainsStock}`
    };
}

/**
 * Determina si un producto está agotado considerando el carrito actual.
 * @param {object} prod - El producto.
 * @param {Array} cart - Carrito actual (array de { productId, quantity }).
 * @param {Array} parsedEntries - Entradas del menú del día (para productos tipo 'menu').
 * @param {Array} parsedMains - Fondos del menú del día (para productos tipo 'menu').
 * @param {Array} products - Lista completa de productos.
 * @returns {boolean}
 */
export function isProductOutOfStock(prod, cart, parsedEntries, parsedMains, products) {
    const cartQty = cart.reduce((acc, c) => c.productId === prod.id ? acc + c.quantity : acc, 0);
    let displayStock = getEffectiveStock(prod);
    if (prod.type === 'menu') {
        const stats = getMenuStockStats(prod, parsedEntries, parsedMains, products);
        displayStock = stats.stock;
    }
    const isMissingRecipe = prod.requiresPreparation && !prod.isStockManaged && prod.type !== 'menu' && (!prod.Recipes || prod.Recipes.length === 0);
    return isMissingRecipe || ((prod.isStockManaged || prod.requiresPreparation || prod.type === 'menu') && (displayStock - cartQty) <= 0);
}

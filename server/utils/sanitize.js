/**
 * Utilidades para Blindaje Defensivo de Textos en Backend
 * Previene excepciones SQL "Data too long for column..."
 */

/**
 * Limpia y recorta una cadena al tamaño máximo especificado.
 * @param {string} val Valor a limpiar
 * @param {number} maxLen Límite máximo de caracteres
 * @returns {string} Cadena recortada
 */
function cleanString(val, maxLen = 255) {
    if (val === null || val === undefined) return '';
    return String(val).trim().slice(0, maxLen);
}

/**
 * Limpia y recorta una cadena opcional (preserva null/undefined si no hay valor).
 * @param {string|null} val Valor a limpiar
 * @param {number} maxLen Límite máximo de caracteres
 * @returns {string|null} Cadena recortada o null
 */
function cleanOptionalString(val, maxLen = 255) {
    if (val === null || val === undefined) return null;
    const trimmed = String(val).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}

function getMaxLength(def) {
    if (def.type && def.type.options && typeof def.type.options.length === 'number') {
        return def.type.options.length;
    }
    if (def.type && (def.type.key === 'STRING' || def.type.name === 'STRING')) {
        return 255;
    }
    return null;
}

function truncateObject(obj, rawAttributes, modelName) {
    if (!obj || typeof obj !== 'object' || !rawAttributes) return;
    for (const [key, def] of Object.entries(rawAttributes)) {
        if (key === 'password' || key === 'settings' || key === 'hexData') continue;
        const val = typeof obj.getDataValue === 'function' ? obj.getDataValue(key) : obj[key];
        if (typeof val === 'string') {
            const maxLen = getMaxLength(def);
            if (maxLen && val.length > maxLen) {
                console.warn(`[Defensive Sanitation] Truncating field "${key}" in model "${modelName || 'Model'}" from ${val.length} to ${maxLen} chars.`);
                if (typeof obj.setDataValue === 'function') {
                    obj.setDataValue(key, val.slice(0, maxLen));
                } else {
                    obj[key] = val.slice(0, maxLen);
                }
            }
        }
    }
}

/**
 * Hooks universales de Sequelize para blindar automáticamente cualquier modelo
 * recortando cadenas que excedan la longitud de la columna en la BD (create, save, bulkCreate, update).
 */
function setupDefensiveHooks(sequelize) {
    // 1. Instancias individuales (create, save)
    sequelize.addHook('beforeValidate', (instance) => {
        if (!instance || !instance.constructor || !instance.constructor.rawAttributes) return;
        truncateObject(instance, instance.constructor.rawAttributes, instance.constructor.name);
    });

    // 2. Creaciones masivas (bulkCreate)
    sequelize.addHook('beforeBulkCreate', (instances, options) => {
        if (!instances || !Array.isArray(instances)) return;
        const model = options.model || (instances[0] && instances[0].constructor);
        const rawAttributes = model && model.rawAttributes;
        if (!rawAttributes) return;
        for (const inst of instances) {
            truncateObject(inst, rawAttributes, model.name);
        }
    });

    // 3. Actualizaciones directas (Model.update)
    sequelize.addHook('beforeBulkUpdate', (options) => {
        if (!options || !options.attributes || !options.model || !options.model.rawAttributes) return;
        truncateObject(options.attributes, options.model.rawAttributes, options.model.name);
    });
}

module.exports = {
    cleanString,
    cleanOptionalString,
    setupDefensiveHooks
};

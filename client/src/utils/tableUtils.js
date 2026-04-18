/**
 * Formats a table name with its area prefix.
 * @param {Object} table - The table object (should have number and optionally Area)
 * @param {Object} area - Optional area override
 * @returns {string} - Formatted name like "A1", "Salon 2", etc.
 */
export const formatTableName = (table, area = null) => {
    if (!table) return 'N/A';

    const areaObj = area || table.Area;
    const areaName = areaObj?.name || table.areaName || table.areaname || '';

    if (!areaName || areaName.trim() === '') {
        return `Mesa ${table.number}`;
    }

    if (areaName.length === 1) {
        return `${areaName}${table.number}`;
    }

    return `${areaName} ${table.number}`.trim();
};

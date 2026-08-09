/**
 * timeUtils.js
 * Utilidades para el manejo de fechas, horas y promociones temporales.
 */

/**
 * Verifica si una promoción Happy Hour está activa en base a un rango de horas.
 * Soporta rangos normales (e.g. 10:00 - 17:00) y rangos cruzados (e.g. 20:00 - 07:00).
 * 
 * @param {string} startStr - Hora de inicio en formato "HH:mm"
 * @param {string} endStr - Hora de fin en formato "HH:mm"
 * @returns {boolean} True si la hora actual está dentro del rango.
 */
export const isHappyHourActive = (startStr, endStr) => {
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

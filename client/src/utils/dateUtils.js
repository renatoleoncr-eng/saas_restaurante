/**
 * dateUtils.js
 * Utilidades para manejo seguro de zonas horarias y fechas de facturación electrónica (SUNAT).
 */

export const getSafeDateLimits = (daysInPast = 3) => {
    // Current date in Lima TimeZone (America/Lima UTC-5)
    const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const [y, m, d] = todayLima.split('-').map(Number);
    
    // Past date calculation safe from UTC midnight shifts
    const pastDate = new Date(y, m - 1, d);
    pastDate.setDate(pastDate.getDate() - daysInPast);
    const minLima = pastDate.toLocaleDateString('en-CA');
    
    return { todayLima, minLima };
};

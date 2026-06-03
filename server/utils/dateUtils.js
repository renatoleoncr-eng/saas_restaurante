/**
 * Utility to calculate the date range for a "Hotel Day" (Business Day).
 * A hotel day starts at 07:00:00 AM and ends at 06:59:59 AM the next day.
 * 
 * @param {string} startDateString - ISO date string (YYYY-MM-DD)
 * @param {string} endDateString - ISO date string (YYYY-MM-DD)
 * @returns {Array} - [start, end] Date objects with the 7 AM offset
 */
const getHotelDayRange = (startDateString, endDateString) => {
    // If no dates provided, use current day's hotel day
    if (!startDateString) {
        const now = new Date();
        // Lima timezone is UTC-5
        const limaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        // If before 7 AM local time, operational day is yesterday
        if (limaTime.getUTCHours() < 7) {
            limaTime.setUTCDate(limaTime.getUTCDate() - 1);
        }
        const todayStr = limaTime.toISOString().split('T')[0];
        startDateString = todayStr;
        endDateString = todayStr;
    }

    // Start: 7 AM of the start date (Lima/Peru time -05:00)
    const start = new Date(startDateString + 'T07:00:00-05:00');

    // End: 7 AM of the day AFTER the end date
    const end = new Date(endDateString + 'T07:00:00-05:00');
    end.setDate(end.getDate() + 1);

    return [start, end];
};

module.exports = {
    getHotelDayRange
};

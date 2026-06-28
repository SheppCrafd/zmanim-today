/**
 * Convert a 12-hour time string (e.g. "7:34 AM") to 24-hour format (e.g. "07:34").
 * Returns the original string unchanged if it cannot be parsed.
 */
export function convertTo24(timeStr) {
    if (!timeStr) return timeStr;
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return timeStr;
    let [, h, min, ampm] = m;
    h = parseInt(h);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * Format a time string according to the use24Hour preference.
 */
export function formatTime(timeStr, use24Hour) {
    return use24Hour ? convertTo24(timeStr) : timeStr;
}
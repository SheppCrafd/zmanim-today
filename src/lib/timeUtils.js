/**
 * Central time utility module.
 * All time parsing and formatting logic lives here.
 */

/**
 * Parse a 12-hour "H:MM AM/PM" string into a Date (today's date, given time).
 * Returns null if the string can't be parsed.
 */
export function parseTimeStr(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return null;
    let [, h, min, ampm] = m;
    h = parseInt(h, 10);
    min = parseInt(min, 10);
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0);
}

/**
 * Convert a "H:MM AM/PM" string to 24-hour "HH:MM" format.
 * Returns the original string unchanged if it can't be parsed or is already 24h.
 */
export function to24Hour(timeStr) {
    if (!timeStr) return timeStr;
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return timeStr;
    let [, h, min, ampm] = m;
    h = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * Format a time string according to user preference.
 * @param {string} timeStr - Input time string (12h AM/PM format)
 * @param {boolean} use24Hour - Whether to output 24-hour format
 */
export function formatTime(timeStr, use24Hour = false) {
    if (!timeStr) return timeStr;
    return use24Hour ? to24Hour(timeStr) : timeStr;
}

/**
 * Format a millisecond countdown duration into a human-readable string.
 */
export function formatCountdown(ms) {
    if (ms <= 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Subtract `minutes` from a "H:MM AM/PM" time string.
 * Returns the adjusted time in "H:MM AM/PM" format.
 */
export function subtractMinutes(timeStr, minutes) {
    const d = parseTimeStr(timeStr);
    if (!d) return null;
    const totalMin = d.getHours() * 60 + d.getMinutes() - minutes;
    const norm = ((totalMin % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const min = norm % 60;
    const period = h < 12 ? 'AM' : 'PM';
    const display12 = h % 12 === 0 ? 12 : h % 12;
    return `${display12}:${String(min).padStart(2, '0')} ${period}`;
}
/**
 * Central time utility module.
 * All time parsing and formatting logic lives here.
 */

/**
 * Parses an ISO timestamp string (or fallback formats) into a JavaScript Date object
 */
export function parseTimeStr(timeInput) {
  if (!timeInput) return null;

  // First, try to parse it natively (works for Hebcal ISO strings)
  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) return d;

  // Fallback for old "H:MM AM/PM" strings (in case of old cached data)
  const m =
    typeof timeInput === "string"
      ? timeInput.match(/(\d+):(\d+)\s*(AM|PM)?/i)
      : null;
  if (m) {
    let [, h, min, ampm] = m;
    h = parseInt(h, 10);
    min = parseInt(min, 10);
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    }
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h,
      min,
      0,
    );
  }

  return null;
}

/**
 * Formats a raw ISO timestamp into a readable 12hr or 24hr string
 */
export function formatTime(timeInput, use24Hour = false, timeZone) {
  if (!timeInput) return "";

  const d = new Date(timeInput);

  // Fallback just in case invalid data or an old string format is passed
  if (isNaN(d.getTime())) {
    // Try to handle old 12-hour string if it leaked through
    if (typeof timeInput === "string" && timeInput.includes(":")) {
      if (!use24Hour) return timeInput;
      const m = timeInput.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (m) {
        let [, h, min, ampm] = m;
        h = parseInt(h, 10);
        if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
        if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${min}`;
      }
    }
    return timeInput;
  }

  // Rely on native JavaScript formatting for the ISO strings.
  // Format in the zman's own timezone (the location tzid) so a user whose
  // device is in a different zone still sees local prayer times.
  const opts = {
    hour: "numeric",
    minute: "2-digit",
    hour12: !use24Hour,
  };
  if (timeZone && timeZone !== "Local Time") opts.timeZone = timeZone;
  return d.toLocaleTimeString([], opts);
}

/**
 * Format a millisecond countdown duration into a human-readable string.
 */
export function formatCountdown(ms) {
  if (ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Subtract `minutes` from a timestamp.
 * Returns the adjusted time as an ISO string to maintain consistency with Hebcal data.
 */
export function subtractMinutes(timeStr, minutes) {
  const d = parseTimeStr(timeStr);
  if (!d) return null;

  // Subtract the minutes natively using the Date object
  d.setMinutes(d.getMinutes() - minutes);

  // Return an ISO string so it works exactly like the raw Hebcal timestamps
  return d.toISOString();
}
import { useState } from 'react';
import { ZMANIM_BY_ID } from '@/lib/zmanimSchema';

/**
 * Schema version — bump this whenever the prefs structure changes shape.
 * On version mismatch, stored prefs are migrated rather than wiped.
 */
const SCHEMA_VERSION = 2;
const PREFS_KEY = 'dashboard_prefs_v2';

export const ALL_DASHBOARD_ITEMS = [
    { id: 'compass',           label: 'Jerusalem Compass',    icon: '🧭', defaultOn: true  },
    { id: 'next_zman',         label: 'Next Zman Countdown',  icon: '⏱',  defaultOn: true  },
    { id: 'candle_lighting',   label: 'Candle Lighting',      icon: '🕯', defaultOn: true  },
    { id: 'alot_hashachar',    label: 'Alot HaShachar',       icon: '🌑', defaultOn: false },
    { id: 'sunrise',           label: 'Sunrise',              icon: '🌅', defaultOn: true  },
    { id: 'sof_zman_shma_gra', label: 'Sof Zman Kriat Shema', icon: '📜', defaultOn: false },
    { id: 'chatzot',           label: 'Chatzot',              icon: '☀️', defaultOn: false },
    { id: 'mincha_gedola',     label: 'Mincha Gedola',        icon: '🕌', defaultOn: false },
    { id: 'plag_hamincha',     label: 'Plag HaMincha',        icon: '🕐', defaultOn: false },
    { id: 'sunset',            label: 'Sunset',               icon: '🌇', defaultOn: true  },
    { id: 'tzait_hakochavim',  label: 'Tzeit HaKochavim',     icon: '✨', defaultOn: true  },
    { id: 'tzait_72',          label: 'Havdalah (72 min)',     icon: '🌟', defaultOn: false },
];

const defaultPrefs = () => ({
    _version: SCHEMA_VERSION,
    items: ALL_DASHBOARD_ITEMS.map(item => ({ id: item.id, enabled: item.defaultOn })),
    use24Hour: false,
});

/**
 * Migrate prefs from any previous version to the current schema.
 * - Merges in any newly added items (preserving user order and toggles).
 * - Drops items that no longer exist in ALL_DASHBOARD_ITEMS.
 * - Adds missing top-level keys with defaults.
 */
function migratePrefs(saved) {
    const validIds = new Set(ALL_DASHBOARD_ITEMS.map(i => i.id));

    // Keep existing items that are still valid, in the user's saved order
    const existingItems = (saved.items || []).filter(i => validIds.has(i.id));
    const existingIds = new Set(existingItems.map(i => i.id));

    // Append any newly added items the user hasn't seen yet
    const newItems = ALL_DASHBOARD_ITEMS
        .filter(i => !existingIds.has(i.id))
        .map(i => ({ id: i.id, enabled: i.defaultOn }));

    return {
        ...defaultPrefs(),
        ...saved,
        _version: SCHEMA_VERSION,
        items: [...existingItems, ...newItems],
        // Ensure new top-level prefs get defaults if missing
        use24Hour: saved.use24Hour ?? false,
    };
}

function loadPrefs() {
    try {
        // Try current key first
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            return migratePrefs(saved);
        }

        // Attempt migration from old key (v1)
        const oldRaw = localStorage.getItem('dashboard_prefs_v1');
        if (oldRaw) {
            const old = JSON.parse(oldRaw);
            const migrated = migratePrefs(old);
            // Persist under new key; leave old key for one version
            localStorage.setItem(PREFS_KEY, JSON.stringify(migrated));
            return migrated;
        }
    } catch { /* ignore parse errors */ }
    return defaultPrefs();
}

export function useDashboardPrefs() {
    const [prefs, setPrefs] = useState(() => loadPrefs());

    const savePrefs = (next) => {
        setPrefs(next);
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };

    const toggleItem = (id) =>
        savePrefs({
            ...prefs,
            items: prefs.items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i),
        });

    const reorderItems = (newItems) =>
        savePrefs({ ...prefs, items: newItems });

    const toggle24Hour = () =>
        savePrefs({ ...prefs, use24Hour: !prefs.use24Hour });

    return { prefs, toggleItem, reorderItems, toggle24Hour };
}
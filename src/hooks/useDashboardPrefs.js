import { useState, useEffect } from 'react';

const PREFS_KEY = 'dashboard_prefs_v1';

export const ALL_DASHBOARD_ITEMS = [
    { id: 'compass', label: 'Jerusalem Compass', icon: '🧭', defaultOn: true },
    { id: 'next_zman', label: 'Next Zman Countdown', icon: '⏱', defaultOn: true },
    { id: 'candle_lighting', label: 'Candle Lighting', icon: '🕯', defaultOn: true },
    { id: 'alot_hashachar', label: 'Alot HaShachar', icon: '🌑', defaultOn: false },
    { id: 'sunrise', label: 'Sunrise', icon: '🌅', defaultOn: true },
    { id: 'sof_zman_shma_gra', label: 'Sof Zman Kriat Shema', icon: '📜', defaultOn: false },
    { id: 'chatzot', label: 'Chatzot', icon: '☀️', defaultOn: false },
    { id: 'mincha_gedola', label: 'Mincha Gedola', icon: '🕌', defaultOn: false },
    { id: 'plag_hamincha', label: 'Plag HaMincha', icon: '🕐', defaultOn: false },
    { id: 'sunset', label: 'Sunset', icon: '🌇', defaultOn: true },
    { id: 'tzait_hakochavim', label: 'Tzeit HaKochavim', icon: '✨', defaultOn: true },
    { id: 'tzait_72', label: 'Havdalah (72 min)', icon: '🌟', defaultOn: false },
];

const defaultPrefs = () => ({
    items: ALL_DASHBOARD_ITEMS.map(item => ({ id: item.id, enabled: item.defaultOn })),
    use24Hour: false,
    darkMode: false,
});

export function useDashboardPrefs() {
    const [prefs, setPrefs] = useState(() => {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (!raw) return defaultPrefs();
            const saved = JSON.parse(raw);
            // Merge in any new items not in saved prefs
            const savedIds = new Set(saved.items.map(i => i.id));
            const merged = [
                ...saved.items,
                ...ALL_DASHBOARD_ITEMS.filter(i => !savedIds.has(i.id)).map(i => ({ id: i.id, enabled: i.defaultOn }))
            ];
            return { ...saved, items: merged };
        } catch { return defaultPrefs(); }
    });

    const savePrefs = (next) => {
        setPrefs(next);
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    };

    const toggleItem = (id) => {
        savePrefs({
            ...prefs,
            items: prefs.items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i)
        });
    };

    const reorderItems = (newItems) => {
        savePrefs({ ...prefs, items: newItems });
    };

    const toggle24Hour = () => {
        savePrefs({ ...prefs, use24Hour: !prefs.use24Hour });
    };

    const toggleDarkMode = () => {
        savePrefs({ ...prefs, darkMode: !prefs.darkMode });
    };

    return { prefs, toggleItem, reorderItems, toggle24Hour, toggleDarkMode };
}
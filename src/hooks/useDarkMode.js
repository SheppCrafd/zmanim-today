import { useEffect } from 'react';
import { useDashboardPrefs } from './useDashboardPrefs';

export function useDarkMode() {
    const { prefs } = useDashboardPrefs();

    useEffect(() => {
        const root = document.documentElement;
        if (prefs.darkMode) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [prefs.darkMode]);
}
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const getSystemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
    const getStoredTheme = () => localStorage.getItem('theme');
    const [theme, setTheme] = useState(() => getStoredTheme() || 'system');
    const [systemDark, setSystemDark] = useState(getSystemDark);
    const dark = theme === 'system' ? systemDark : theme === 'dark';

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    useEffect(() => {
        if (theme === 'system') {
            localStorage.removeItem('theme');
            return;
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!media) return;

        const updateSystemTheme = (event) => setSystemDark(event.matches);
        media.addEventListener?.('change', updateSystemTheme);
        media.addListener?.(updateSystemTheme);

        return () => {
            media.removeEventListener?.('change', updateSystemTheme);
            media.removeListener?.(updateSystemTheme);
        };
    }, []);

    return (
        <ThemeContext.Provider value={{ dark, theme, setTheme, toggleDark: () => setTheme(dark ? 'light' : 'dark') }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

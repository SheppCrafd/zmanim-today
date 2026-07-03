import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved !== null) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Apply theme class to <html> — does NOT persist (persistence is manual-toggle only)
    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    // Auto-follow system dark mode changes, but only if the user hasn't set a manual preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            const saved = localStorage.getItem('theme');
            if (!saved) setDark(e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Manual toggle — persists the user's explicit choice to localStorage
    const toggleDark = () => {
        setDark(d => {
            const newDark = !d;
            localStorage.setItem('theme', newDark ? 'dark' : 'light');
            return newDark;
        });
    };

    return (
        <ThemeContext.Provider value={{ dark, toggleDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
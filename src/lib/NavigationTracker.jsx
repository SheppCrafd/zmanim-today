import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { base44 } from '@/api/base44Client';
import { pagesConfig } from '@/pages.config';

// Strict allowlist of trusted parent origins (Base44 builder/dashboard only)
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*base44\.(com|app)$/i;

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    // Post navigation changes to parent window
    useEffect(() => {
        if (window.parent && window.parent !== window && document.referrer) {
            try {
                const parentOrigin = new URL(document.referrer).origin;
                if (ALLOWED_ORIGIN_PATTERN.test(parentOrigin)) {
                    window.parent.postMessage({
                        type: "app_changed_url",
                        url: window.location.href
                    }, parentOrigin);
                }
            } catch (e) {
                // ignore malformed referrer
            }
        }
    }, [location]);

    // Log user activity when navigating to a page
    useEffect(() => {
        // Extract page name from pathname
        const pathname = location.pathname;
        let pageName;
        
        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            // Remove leading slash and get the first segment
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];
            
            // Try case-insensitive lookup in Pages config
            const pageKeys = Object.keys(Pages);
            const matchedKey = pageKeys.find(
                key => key.toLowerCase() === pathSegment.toLowerCase()
            );
            
            pageName = matchedKey || null;
        }

        if (isAuthenticated && pageName) {
            base44.appLogs.logUserInApp(pageName).catch(() => {
                // Silently fail - logging shouldn't break the app
            });
        }
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}
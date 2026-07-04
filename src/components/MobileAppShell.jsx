import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { queryClientInstance } from '@/lib/query-client';

export function AnimatedPageShell({ children }) {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={location.pathname}
                className="min-h-screen"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

export function PullToRefreshShell({ children }) {
    const startY = useRef(0);
    const pulling = useRef(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const onTouchStart = (event) => {
            if (window.scrollY > 0 || refreshing) return;
            startY.current = event.touches[0]?.clientY || 0;
            pulling.current = true;
        };

        const onTouchMove = (event) => {
            if (!pulling.current || refreshing) return;
            const currentY = event.touches[0]?.clientY || 0;
            const nextDistance = Math.max(0, currentY - startY.current);

            if (nextDistance > 8 && window.scrollY === 0) {
                setPullDistance(Math.min(nextDistance * 0.45, 72));
            }
        };

        const onTouchEnd = async () => {
            if (!pulling.current) return;
            pulling.current = false;

            if (pullDistance >= 54) {
                setRefreshing(true);
                setPullDistance(64);
                await queryClientInstance.invalidateQueries();
                window.dispatchEvent(new CustomEvent('zmanim:pull-refresh'));
                setTimeout(() => {
                    setRefreshing(false);
                    setPullDistance(0);
                }, 450);
                return;
            }

            setPullDistance(0);
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [pullDistance, refreshing]);

    return (
        <div className="mobile-app-shell">
            <div
                className={`pull-refresh-indicator ${refreshing || pullDistance > 0 ? 'is-visible' : ''}`}
                style={{ transform: `translate(-50%, ${pullDistance - 56}px)` }}
                aria-hidden="true"
            >
                <RotateCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </div>
            {children}
        </div>
    );
}

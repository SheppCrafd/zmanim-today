import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function usePullToRefresh(onRefresh) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    const onTouchStart = (e) => {
        if (window.scrollY === 0) {
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    };

    const onTouchMove = (e) => {
        if (!isPulling.current || isRefreshing) return;
        const diff = e.touches[0].clientY - touchStartY.current;
        if (diff > 0 && window.scrollY === 0) {
            setPullDistance(Math.min(diff * 0.4, 80));
        }
    };

    const onTouchEnd = async () => {
        if (pullDistance > 60) {
            setIsRefreshing(true);
            await onRefresh();
            setIsRefreshing(false);
        }
        setPullDistance(0);
        isPulling.current = false;
    };

    const PullIndicator = (pullDistance > 0 || isRefreshing) ? (
        <div
            className="flex items-center justify-center overflow-hidden"
            style={{ height: `${isRefreshing ? 40 : pullDistance}px` }}
        >
            <Loader2 className={`w-5 h-5 text-blue-500 ${(isRefreshing || pullDistance > 40) ? 'animate-spin' : ''}`} />
        </div>
    ) : null;

    return { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PullIndicator };
}
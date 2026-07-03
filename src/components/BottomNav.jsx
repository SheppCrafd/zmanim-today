import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Clock, Compass, Settings } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Zmanim', path: '/Zmanim', icon: Clock },
    { label: 'Compass', path: '/Compass', icon: Compass },
    { label: 'Settings', path: '/Settings', icon: Settings },
];

export default function BottomNav() {
    const location = useLocation();

    // Don't show on siddur pages
    const hiddenPaths = ['/SephardicSiddur', '/AshkenaziSiddur', '/ChabadSiddur'];
    if (hiddenPaths.includes(location.pathname)) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 select-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
                    const active = location.pathname === path;
                    return (
                        <Link
                            key={path}
                            to={path}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-col items-center gap-0.5 px-4 py-2 min-h-[44px] justify-center rounded-xl transition-colors select-none ${
                                active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                            <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
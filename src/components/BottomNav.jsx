import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, Compass, Settings } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Zmanim', path: '/Zmanim', icon: Clock },
    { label: 'Compass', path: '/Compass', icon: Compass },
    { label: 'Settings', path: '/Settings', icon: Settings },
];

export default function BottomNav() {
    const location = useLocation();
    const navigate = useNavigate();

    // Store last visited path per tab for navigation stack preservation
    const tabHistories = React.useRef({});

    React.useEffect(() => {
        NAV_ITEMS.forEach(({ path }) => {
            if (location.pathname === path || location.pathname.startsWith(path + '/')) {
                tabHistories.current[path] = location.pathname;
            }
        });
    }, [location.pathname]);

    // Don't show on siddur pages (including sub-routes)
    const hiddenPaths = ['/SephardicSiddur', '/AshkenaziSiddur', '/ChabadSiddur'];
    if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-inset-bottom">
            <div className="flex items-center justify-around min-h-[64px] max-w-lg mx-auto">
                {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
                    const active = location.pathname === path;
                    return (
                        <Link
                            key={path}
                            to={path}
                            aria-label={`${label} tab`}
                            aria-current={active ? 'page' : undefined}
                            onClick={(e) => {
                                e.preventDefault();
                                if (location.pathname === path) {
                                    navigate(path, { replace: true });
                                    delete tabHistories.current[path];
                                } else {
                                    navigate(tabHistories.current[path] || path);
                                }
                            }}
                            className={`select-none flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl transition-colors active:opacity-70 ${
                                active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                            <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
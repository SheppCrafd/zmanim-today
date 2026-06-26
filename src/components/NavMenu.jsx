import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Clock, BookOpen, MapPin } from 'lucide-react';

const navItems = [
    { label: 'Zmanim', path: '/', icon: Clock, description: 'Daily prayer times' },
    { label: 'Jerusalem Compass', path: '/JerusalemCompass', icon: MapPin, description: 'Always points to Yerushalayim' },
    { label: 'Sephardic Siddur', path: '/SephardicSiddur', icon: BookOpen, description: 'Edot HaMizrach' },
    { label: 'Ashkenazi Siddur', path: '/AshkenaziSiddur', icon: BookOpen, description: 'Nusach Ashkenaz' },
    { label: 'Weekday Chabad Siddur', path: '/ChabadSiddur', icon: BookOpen, description: 'Nusach Ari' },
];

export default function NavMenu() {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setOpen(true)}
                className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/90 shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
            >
                <Menu className="w-5 h-5 text-slate-700" />
            </button>

            {/* Overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Drawer */}
            <div className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Menu</h2>
                    <button
                        onClick={() => setOpen(false)}
                        className="p-1 rounded hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
                <nav className="p-4 space-y-2">
                    {navItems.map(({ label, path, icon: Icon, description }) => {
                        const active = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                    active
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`p-2 rounded-lg ${active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{label}</p>
                                    <p className="text-xs text-slate-500">{description}</p>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
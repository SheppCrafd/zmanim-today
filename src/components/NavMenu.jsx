import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Clock, BookOpen, Compass, Home, ChevronDown, ChevronUp } from 'lucide-react';

const navItems = [
    { label: 'Home', path: '/', icon: Home, description: 'Dashboard' },
    { label: 'Zmanim', path: '/Zmanim', icon: Clock, description: 'Daily prayer times' },
    { label: 'Compass to Jerusalem', path: '/Compass', icon: Compass, description: 'מצפן לירושלים' },
];

const siddurimItems = [
    { label: 'Sephardic Siddur', path: '/SephardicSiddur', description: 'Edot HaMizrach' },
    { label: 'Ashkenazi Siddur', path: '/AshkenaziSiddur', description: 'Nusach Ashkenaz' },
    { label: 'Weekday Chabad Siddur', path: '/ChabadSiddur', description: 'Nusach Ari' },
];

export default function NavMenu() {
    const [open, setOpen] = useState(false);
    const [siddurimOpen, setSiddurimOpen] = useState(false);
    const location = useLocation();

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setOpen(true)}
                className="p-2 rounded-lg bg-white/90 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
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
                <nav className="p-4 space-y-1">
                    {navItems.map(({ label, path, icon: Icon, description }) => {
                        const active = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
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

                    {/* Siddurim section */}
                    <button
                        onClick={() => setSiddurimOpen(!siddurimOpen)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <div className="p-2 rounded-lg bg-slate-100">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">Siddurim (BETA)</p>
                            <p className="text-xs text-slate-500">Prayer books (BETA)</p>
                        </div>
                        {siddurimOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {siddurimOpen && (
                        <div className="pl-4 space-y-1">
                            {siddurimItems.map(({ label, path, description }) => {
                                const active = location.pathname === path;
                                return (
                                    <Link
                                        key={path}
                                        to={path}
                                        onClick={() => setOpen(false)}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                                            active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{label}</p>
                                            <p className="text-xs text-slate-500">{description}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </nav>
            </div>
        </>
    );
}
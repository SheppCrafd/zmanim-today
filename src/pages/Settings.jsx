import React, { useState } from 'react';
import { GripVertical, Check, ArrowLeft, Moon, LogOut, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavMenu from '@/components/NavMenu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDashboardPrefs, ALL_DASHBOARD_ITEMS } from '@/hooks/useDashboardPrefs';
import { useSavedLocation } from '@/hooks/useLocation';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function Settings() {
    const navigate = useNavigate();
    const { prefs, toggleItem, reorderItems, toggle24Hour } = useDashboardPrefs();
    const { location, clearLocation } = useSavedLocation();
    const { dark, toggleDark } = useTheme();
    const { logout } = useAuth();

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(prefs.items);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        reorderItems(items);
    };

    const getLabel = (id) => ALL_DASHBOARD_ITEMS.find(i => i.id === id)?.label || id;
    const getIcon = (id) => ALL_DASHBOARD_ITEMS.find(i => i.id === id)?.icon || '⏱';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 pb-24">
            <div className="max-w-lg mx-auto px-4 pt-4">

                <div className="flex items-center mb-6 min-h-[56px]">
                    <div className="shrink-0"><NavMenu /></div>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
                        <p className="text-slate-500 text-sm">Customize your dashboard</p>
                    </div>
                    <div className="shrink-0">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-white/90 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1 text-sm text-slate-700 pr-3">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                    </div>
                </div>

                {/* Location */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Location</p>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {location ? (
                            <div className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">
                                        {[location.city, location.state, location.country].filter(Boolean).join(', ') ||
                                            `${location.latitude?.toFixed(3)}°, ${location.longitude?.toFixed(3)}°`}
                                    </p>
                                    <p className="text-xs text-slate-400">Current location</p>
                                </div>
                                <button
                                    onClick={clearLocation}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                    Clear
                                </button>
                            </div>
                        ) : (
                            <div className="px-4 py-3">
                                <p className="text-sm text-slate-500">No location set. Set one from the Home screen.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Appearance */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Appearance</p>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={toggleDark}
                            role="switch"
                            aria-checked={dark}
                            className="w-full flex items-center justify-between px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <Moon className="w-4 h-4 text-indigo-400" />
                                <div className="text-left">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Dark Mode</p>
                                    <p className="text-xs text-slate-400">Easy on the eyes for night prayer</p>
                                </div>
                            </div>
                            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${dark ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Time Format */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Time Format</p>
                    <div className="bg-white rounded-xl border border-slate-200">
                        <button
                            onClick={toggle24Hour}
                            role="switch"
                            aria-checked={prefs.use24Hour}
                            className="w-full flex items-center justify-between px-4 py-3"
                        >
                            <div>
                                <p className="text-sm font-medium text-slate-800">24-Hour Time</p>
                                <p className="text-xs text-slate-400">Show times in 24h format (e.g. 18:30)</p>
                            </div>
                            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.use24Hour ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.use24Hour ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Dashboard Items */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Home Dashboard</p>
                    <p className="text-xs text-slate-400 mb-3 px-1">Toggle items and drag to reorder.</p>

                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="dashboard-items">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100"
                                >
                                    {prefs.items.map((item, index) => (
                                        <Draggable key={item.id} draggableId={item.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${snapshot.isDragging ? 'bg-blue-50 shadow-md' : 'bg-white'}`}
                                                >
                                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                                        <GripVertical className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                    <span className="text-base">{getIcon(item.id)}</span>
                                                    <span className="flex-1 text-sm font-medium text-slate-700">{getLabel(item.id)}</span>
                                                    <button
                                                        onClick={() => toggleItem(item.id)}
                                                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                                            item.enabled
                                                                ? 'bg-blue-600 border-blue-600'
                                                                : 'bg-white border-slate-300'
                                                        }`}
                                                    >
                                                        {item.enabled && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                                    </button>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>

                {/* Siddurim */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Siddurim</p>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {[
                            { label: 'Sephardic Siddur', sub: 'Edot HaMizrach', path: '/SephardicSiddur' },
                            { label: 'Ashkenazi Siddur', sub: 'Nusach Ashkenaz', path: '/AshkenaziSiddur' },
                            { label: 'Chabad Siddur', sub: 'Nusach Ari', path: '/ChabadSiddur' },
                        ].map(({ label, sub, path }) => (
                            <a key={path} href={path} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">📖 {label}</p>
                                    <p className="text-xs text-slate-400">{sub}</p>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M6 12l4-4-4-4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Account */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Account</p>
                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                        <button
                            onClick={() => logout()}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">Delete Account</span>
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        Delete Account?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete your account and all associated data. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => logout()}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        Delete Forever
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

            </div>
        </div>
    );
}
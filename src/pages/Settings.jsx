import React, { useState } from 'react';
import { GripVertical, Check } from 'lucide-react';
import NavMenu from '@/components/NavMenu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useDashboardPrefs, ALL_DASHBOARD_ITEMS } from '@/hooks/useDashboardPrefs';
import { useSavedLocation } from '@/hooks/useLocation';

export default function Settings() {
    const { prefs, toggleItem, reorderItems, toggle24Hour } = useDashboardPrefs();
    const { location, clearLocation } = useSavedLocation();

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
            <div className="max-w-lg mx-auto px-4 pt-12">

                <div className="flex items-center gap-3 mb-6">
                    <NavMenu />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
                        <p className="text-slate-500 text-sm">Customize your dashboard</p>
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

                {/* Time Format */}
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Time Format</p>
                    <div className="bg-white rounded-xl border border-slate-200">
                        <button
                            onClick={toggle24Hour}
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

            </div>
        </div>
    );
}
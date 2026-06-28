import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const STORAGE_KEY = 'zmanim_reminders';

const REMINDER_OPTIONS = [
    { key: 'candle_lighting',       label: 'Candle Lighting',       emoji: '🕯️' },
    { key: 'sof_zman_tefillah_gra', label: 'Shacharit (Latest)',     emoji: '🌅' },
    { key: 'chatzot',               label: 'Mussaf (Latest)',        emoji: '☀️' },
    { key: 'mincha_ketana',         label: 'Mincha',                 emoji: '🌤️' },
    { key: 'tzait_hakochavim',      label: "Ma'ariv / Arvit",        emoji: '🌙' },
    { key: 'sunset',                label: 'Sunset',                 emoji: '🌇' },
];

const MINUTES_OPTIONS = [5, 10, 15, 30];

function parseZmanTime(timeStr, date) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

function loadPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function savePrefs(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

export default function ZmanimRemindersPanel({ zmanimData, currentDate }) {
    const [open, setOpen] = useState(false);
    const [prefs, setPrefs] = useState(loadPrefs);
    const [notifPermission, setNotifPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );
    const timeoutsRef = useRef([]);

    const isToday = new Date().toDateString() === new Date(currentDate).toDateString();
    const hasEnabled = Object.values(prefs).some(p => p?.enabled);

    // Schedule / re-schedule notifications whenever prefs or zmanim change
    useEffect(() => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];

        if (!zmanimData?.zmanim || !isToday || notifPermission !== 'granted') return;

        REMINDER_OPTIONS.forEach(({ key, label, emoji }) => {
            const pref = prefs[key];
            if (!pref?.enabled) return;
            const timeStr = zmanimData.zmanim[key];
            if (!timeStr) return;
            const zmanTime = parseZmanTime(timeStr, currentDate);
            if (!zmanTime) return;
            const notifyAt = new Date(zmanTime.getTime() - pref.minutesBefore * 60000);
            const delay = notifyAt.getTime() - Date.now();
            if (delay < 0) return;
            const t = setTimeout(() => {
                new Notification(`${emoji} ${label} in ${pref.minutesBefore} min`, {
                    body: `${label} is at ${timeStr}`,
                    icon: '/favicon.ico',
                });
            }, delay);
            timeoutsRef.current.push(t);
        });

        return () => { timeoutsRef.current.forEach(clearTimeout); };
    }, [prefs, zmanimData, isToday, notifPermission]);

    const requestPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const result = await Notification.requestPermission();
        setNotifPermission(result);
    };

    const toggleReminder = (key) => {
        setPrefs(prev => {
            const current = prev[key] || { enabled: false, minutesBefore: 10 };
            const updated = { ...prev, [key]: { ...current, enabled: !current.enabled } };
            savePrefs(updated);
            return updated;
        });
    };

    const setMinutes = (key, minutes) => {
        setPrefs(prev => {
            const current = prev[key] || { enabled: true, minutesBefore: 10 };
            const updated = { ...prev, [key]: { ...current, minutesBefore: minutes } };
            savePrefs(updated);
            return updated;
        });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" title="Set reminders">
                    {hasEnabled
                        ? <BellRing className="w-5 h-5 text-blue-600" />
                        : <Bell className="w-5 h-5 text-slate-600" />
                    }
                    {hasEnabled && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-80 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5" /> Zmanim Reminders
                    </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                    {/* Permission banner */}
                    {notifPermission !== 'granted' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                            <p className="text-amber-800 mb-2">Enable browser notifications to receive reminders.</p>
                            <Button size="sm" onClick={requestPermission} className="bg-amber-600 hover:bg-amber-700 w-full">
                                Enable Notifications
                            </Button>
                        </div>
                    )}

                    {notifPermission === 'denied' && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 text-center">
                            Notifications are blocked. Please enable them in your browser settings.
                        </p>
                    )}

                    {!isToday && (
                        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 text-center">
                            Reminders only fire for today's zmanim.
                        </p>
                    )}

                    <p className="text-xs text-slate-500">
                        Toggle a zman to get notified before it. Choose your lead time below each one.
                    </p>

                    <div className="space-y-2">
                        {REMINDER_OPTIONS.map(({ key, label, emoji }) => {
                            const pref = prefs[key] || { enabled: false, minutesBefore: 10 };
                            const zmanTime = zmanimData?.zmanim?.[key];
                            return (
                                <div
                                    key={key}
                                    className={`rounded-xl border p-3 transition-colors ${
                                        pref.enabled ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => toggleReminder(key)}
                                            className="flex items-center gap-2 flex-1 text-left"
                                        >
                                            <span className="text-lg">{emoji}</span>
                                            <div>
                                                <p className={`text-sm font-medium ${pref.enabled ? 'text-blue-800' : 'text-slate-700'}`}>
                                                    {label}
                                                </p>
                                                {zmanTime && (
                                                    <p className="text-xs text-slate-400">{zmanTime}</p>
                                                )}
                                            </div>
                                        </button>

                                        {/* Toggle switch */}
                                        <div
                                            onClick={() => toggleReminder(key)}
                                            className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                                                pref.enabled ? 'bg-blue-500' : 'bg-slate-200'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${
                                                pref.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </div>
                                    </div>

                                    {/* Lead time selector */}
                                    {pref.enabled && (
                                        <div className="mt-2 flex gap-1">
                                            {MINUTES_OPTIONS.map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setMinutes(key, m)}
                                                    className={`flex-1 text-xs py-1 rounded-lg transition-colors ${
                                                        pref.minutesBefore === m
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {m}m
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {notifPermission === 'granted' && hasEnabled && isToday && (
                        <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2 text-center flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Reminders are active for today
                        </p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
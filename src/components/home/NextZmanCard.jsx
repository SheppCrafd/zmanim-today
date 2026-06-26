import React, { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

const ZMAN_META = {
    alot_hashachar:      { label: 'Alot HaShachar', icon: '🌑' },
    misheyakir:          { label: 'Misheyakir', icon: '🌒' },
    sunrise:             { label: 'Sunrise', icon: '🌅' },
    sof_zman_shma_gra:   { label: 'Sof Zman Shema', icon: '📜' },
    sof_zman_tefillah_gra: { label: 'Sof Zman Tefillah', icon: '🕍' },
    chatzot:             { label: 'Chatzot', icon: '☀️' },
    mincha_gedola:       { label: 'Mincha Gedola', icon: '🕌' },
    mincha_ketana:       { label: 'Mincha Ketana', icon: '🕐' },
    plag_hamincha:       { label: 'Plag HaMincha', icon: '⏳' },
    candle_lighting:     { label: 'Candle Lighting', icon: '🕯' },
    sunset:              { label: 'Sunset', icon: '🌇' },
    tzait_hakochavim:    { label: 'Tzeit HaKochavim', icon: '✨' },
    tzait_72:            { label: 'Havdalah (72 min)', icon: '🌟' },
};

function parseTime(timeStr) {
    if (!timeStr) return null;
    const now = new Date();
    const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return null;
    let [, h, min, ampm] = m;
    h = parseInt(h); min = parseInt(min);
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0);
    return d;
}

function formatCountdown(ms) {
    if (ms <= 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export default function NextZmanCard({ zmanim }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!zmanim?.zmanim) return null;

    // Find next upcoming zman
    const ORDERED_KEYS = [
        'alot_hashachar','misheyakir','sunrise','sof_zman_shma_gra','sof_zman_tefillah_gra',
        'chatzot','mincha_gedola','mincha_ketana','plag_hamincha','candle_lighting',
        'sunset','tzait_hakochavim','tzait_72'
    ];

    let next = null;
    for (const key of ORDERED_KEYS) {
        const val = zmanim.zmanim[key];
        if (!val) continue;
        const t = parseTime(val);
        if (t && t > now) {
            next = { key, val, time: t };
            break;
        }
    }

    if (!next) return null;

    const meta = ZMAN_META[next.key] || { label: next.key, icon: '⏱' };
    const ms = next.time - now;
    const countdown = formatCountdown(ms);
    const urgent = ms < 30 * 60 * 1000; // under 30 minutes

    return (
        <div className={`rounded-xl border p-4 ${urgent ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-2">
                <Timer className={`w-4 h-4 ${urgent ? 'text-amber-500' : 'text-blue-500'}`} />
                <p className={`text-xs font-semibold uppercase tracking-wide ${urgent ? 'text-amber-600' : 'text-blue-600'}`}>
                    Next Zman
                </p>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-lg font-bold text-slate-800">
                        {meta.icon} {meta.label}
                    </p>
                    <p className="text-sm text-slate-500">{next.val}</p>
                </div>
                <div className="text-right">
                    <p className={`text-2xl font-bold tabular-nums ${urgent ? 'text-amber-600' : 'text-blue-700'}`}>
                        {countdown}
                    </p>
                    <p className="text-xs text-slate-400">remaining</p>
                </div>
            </div>
        </div>
    );
}
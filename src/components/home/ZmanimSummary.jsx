import React from 'react';
import { formatTime } from '@/lib/timeUtils';

const ZMAN_META = {
    candle_lighting:     { label: 'Candle Lighting', icon: '🕯', zmanimKey: 'candle_lighting' },
    alot_hashachar:      { label: 'Alot HaShachar', icon: '🌑', zmanimKey: 'alot_hashachar' },
    sunrise:             { label: 'Sunrise', icon: '🌅', zmanimKey: 'sunrise' },
    sof_zman_shma_gra:   { label: 'Sof Zman Shema', icon: '📜', zmanimKey: 'sof_zman_shma_gra' },
    chatzot:             { label: 'Chatzot', icon: '☀️', zmanimKey: 'chatzot' },
    mincha_gedola:       { label: 'Mincha Gedola', icon: '🕌', zmanimKey: 'mincha_gedola' },
    plag_hamincha:       { label: 'Plag HaMincha', icon: '⏳', zmanimKey: 'plag_hamincha' },
    sunset:              { label: 'Sunset', icon: '🌇', zmanimKey: 'sunset' },
    tzait_hakochavim:    { label: 'Tzeit', icon: '✨', zmanimKey: 'tzait_hakochavim' },
    tzait_72:            { label: 'Havdalah (72 min)', icon: '🌟', zmanimKey: 'tzait_72' },
    havdalah:            { label: 'Havdalah', icon: '🕍', zmanimKey: 'havdalah' },
};

export default function ZmanimSummary({ zmanim, enabledIds, use24Hour }) {
    if (!zmanim?.zmanim) return null;

    const items = enabledIds
        .filter(id => ZMAN_META[id])
        .map(id => {
            const meta = ZMAN_META[id];
            const raw = zmanim.zmanim[meta.zmanimKey];
            if (!raw) return null;
            return { ...meta, value: formatTime(raw, use24Hour) };
        })
        .filter(Boolean);

    if (!items.length) return null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {items.map((item, i) => (
                <div
                    key={item.label}
                    className={`flex items-center justify-between px-4 py-3 ${i < items.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">{item.value}</span>
                </div>
            ))}
        </div>
    );
}
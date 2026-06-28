import { format } from 'date-fns';

// Groups mirror the Zmanim page exactly
function buildGroups(z, dow) {
    const isFriday = dow === 5;
    const isSaturday = dow === 6;

    return [
        {
            title: 'Dawn & Morning',
            icon: '☀️',
            from: '#f59e0b', to: '#f97316',
            times: [
                { label: 'Alot Hashachar', value: z.alot_hashachar, description: 'Dawn - 72 min before sunrise' },
                { label: 'Misheyakir', value: z.misheyakir, description: 'Earliest Tallit & Tefillin' },
                { label: 'Sunrise', value: z.sunrise, description: 'HaNetz HaChamah', highlight: true },
                { label: 'Sof Zman Shema (GRA)', value: z.sof_zman_shma_gra, description: 'Latest Shema - 3 hrs after sunrise', highlight: true },
                { label: 'Sof Zman Shema (MGA)', value: z.sof_zman_shma_mga, description: '3 hrs after dawn (stringent)' },
                { label: 'Sof Zman Tefillah (GRA)', value: z.sof_zman_tefillah_gra, description: 'Latest Shemoneh Esrei - 4 hrs', highlight: true },
                { label: 'Sof Zman Tefillah (MGA)', value: z.sof_zman_tefillah_mga, description: '4 hrs after dawn (stringent)' },
            ],
        },
        {
            title: 'Midday & Afternoon',
            icon: '🌤️',
            from: '#3b82f6', to: '#06b6d4',
            times: [
                { label: 'Chatzot', value: z.chatzot, description: 'Halachic Noon - midpoint of day', highlight: true },
                { label: 'Mincha Gedola', value: z.mincha_gedola, description: 'Earliest Mincha - 30 min after noon' },
                { label: 'Mincha Ketana', value: z.mincha_ketana, description: 'Preferred Mincha - 2.5 hrs before sunset' },
                { label: 'Plag HaMincha', value: z.plag_hamincha, description: 'Earliest candle lighting - 1.25 hrs before sunset' },
            ],
        },
        {
            title: 'Evening & Night',
            icon: '🌙',
            from: '#4f46e5', to: '#9333ea',
            times: [
                isFriday && z.candle_lighting && { label: 'Candle Lighting', value: z.candle_lighting, description: '18 min before sunset', highlight: true },
                { label: 'Sunset', value: z.sunset, description: 'Shkiyas HaChamah', highlight: true },
                { label: 'Tzait HaKochavim', value: z.tzait_hakochavim, description: 'Nightfall - 3 medium stars', highlight: true },
                isSaturday && { label: 'Havdalah', value: z.tzait_72, description: 'Nightfall - Rabbeinu Tam', highlight: true },
                !isSaturday && { label: 'Tzait (72 min)', value: z.tzait_72, description: 'Nightfall - Rabbeinu Tam' },
                { label: 'Chatzot Laila', value: z.chatzot_laila, description: 'Halachic Midnight' },
            ].filter(Boolean),
        },
    ];
}

function renderRow(t) {
    const valStyle = t.highlight
        ? 'color:#1d4ed8;background:#dbeafe;padding:4px 12px;border-radius:8px;'
        : 'color:#334155;';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #f1f5f9;${t.highlight ? 'background:#fffbeb80;' : ''}">
        <div style="flex:1;">
            <p style="margin:0;font-weight:600;color:${t.highlight ? '#0f172a' : '#334155'};">${t.label}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#64748b;">${t.description}</p>
        </div>
        <div style="font-family:ui-monospace,monospace;font-size:18px;font-weight:700;${valStyle}">${t.value || ''}</div>
    </div>`;
}

function renderGroup(g) {
    return `<div style="margin-bottom:16px;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);background:#fff;">
        <div style="background:linear-gradient(to right,${g.from},${g.to});padding:16px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;">${g.icon}</span>
            <span style="color:#fff;font-size:18px;font-weight:600;">${g.title}</span>
        </div>
        <div>${g.times.map(renderRow).join('')}</div>
    </div>`;
}

export function printZmanim({ zmanimData, date, locationLabel, hebrewInfo, timezone }) {
    const z = zmanimData?.zmanim || {};
    const dow = date.getDay();
    const dateStr = format(date, 'EEEE, MMMM d, yyyy');
    const groups = buildGroups(z, dow);

    const hebrewBlock = hebrewInfo ? `
        <div style="background:#fff;border-radius:14px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;">
                <span style="font-size:14px;color:#475569;">Hebrew Date</span>
                <div style="text-align:right;">
                    <div style="font-weight:600;color:#1e293b;font-size:18px;" dir="rtl">${hebrewInfo.hebrew_date || ''}</div>
                    <div style="font-size:13px;color:#64748b;">${hebrewInfo.hebrew_date_transliterated || ''}</div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-top:1px solid #f1f5f9;">
                <span style="font-size:14px;color:#475569;">Day</span>
                <div style="text-align:right;">
                    <div style="font-weight:600;color:#1e293b;" dir="rtl">${hebrewInfo.day_of_week_hebrew || ''}</div>
                    <div style="font-size:13px;color:#64748b;">${hebrewInfo.day_of_week_transliterated || ''}</div>
                </div>
            </div>
            ${hebrewInfo.parsha ? `<div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-top:1px solid #f1f5f9;">
                <span style="font-size:14px;color:#475569;">Parsha</span>
                <div style="text-align:right;">
                    ${hebrewInfo.parsha_hebrew ? `<div style="font-weight:600;color:#1d4ed8;" dir="rtl">${hebrewInfo.parsha_hebrew}</div>` : ''}
                    <div style="font-size:13px;color:#2563eb;">${hebrewInfo.parsha}</div>
                </div>
            </div>` : ''}
        </div>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zmanim – ${dateStr}</title>
    <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: linear-gradient(to bottom right,#f8fafc,#eff6ff,#fffbeb); color: #1e293b; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { font-size: 40px; font-weight: 700; color: #1e293b; margin: 0 0 4px; letter-spacing: -0.02em; }
        .header p { font-size: 18px; color: #475569; margin: 0; }
        .meta { background:#fff; border-radius:14px; padding:16px 20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
        .meta .loc { font-weight:600; color:#1e293b; }
        .meta .date { font-size:14px; color:#64748b; margin-top:2px; }
        .footer { text-align:center; margin-top:24px; font-size:13px; color:#64748b; }
        .printbtn { display:block; width:100%; max-width:640px; margin:0 auto 12px; padding:14px; background:#2563eb; color:#fff; border:none; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer; }
        @media print { body { background:#fff; } .printbtn { display:none; } .wrap { padding-top: 8px; } }
    </style></head><body>
    <button class="printbtn" onclick="window.print()">Print / Save as PDF</button>
    <div class="wrap">
        <div class="header"><h1>Zmanim</h1><p>זמני היום</p></div>
        <div class="meta">
            <div class="loc">${locationLabel || ''}</div>
            <div class="date">${dateStr}</div>
        </div>
        ${hebrewBlock}
        ${groups.map(renderGroup).join('')}
        <div class="footer">
            <p style="margin:0;">Times calculated based on your location</p>
            ${timezone ? `<p style="margin:4px 0 0;">Timezone: ${timezone}</p>` : ''}
            <p style="margin:8px 0 0;">Based on https://outorah.org/p/41921/ · Zmanim Today</p>
        </div>
    </div>
    <script>
        window.addEventListener('load', function () {
            setTimeout(function () { window.focus(); window.print(); }, 300);
        });
    </script>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
import { format } from 'date-fns';

const ALL_ZMANIM = [
    { key: 'alot_hashachar',        label: 'Alot HaShachar',          desc: 'Dawn' },
    { key: 'misheyakir',            label: 'Misheyakir',               desc: 'Earliest Tallit & Tefillin' },
    { key: 'sunrise',               label: 'Sunrise',                  desc: 'HaNetz HaChamah' },
    { key: 'sof_zman_shma_gra',     label: 'Sof Zman Shema (GRA)',     desc: 'Latest Shema' },
    { key: 'sof_zman_shma_mga',     label: 'Sof Zman Shema (MGA)',     desc: 'Latest Shema (stringent)' },
    { key: 'sof_zman_tefillah_gra', label: 'Sof Zman Tefillah (GRA)', desc: 'Latest Shacharit' },
    { key: 'sof_zman_tefillah_mga', label: 'Sof Zman Tefillah (MGA)', desc: 'Latest Shacharit (stringent)' },
    { key: 'chatzot',               label: 'Chatzot',                  desc: 'Halachic Noon' },
    { key: 'mincha_gedola',         label: 'Mincha Gedola',            desc: 'Earliest Mincha' },
    { key: 'mincha_ketana',         label: 'Mincha Ketana',            desc: 'Preferred Mincha' },
    { key: 'plag_hamincha',         label: 'Plag HaMincha',            desc: '1.25 hrs before sunset' },
    { key: 'candle_lighting',       label: 'Candle Lighting',          desc: '18 min before sunset', fridayOnly: true },
    { key: 'sunset',                label: 'Sunset',                   desc: 'Shkiyas HaChamah' },
    { key: 'tzait_hakochavim',      label: 'Tzait HaKochavim',         desc: 'Nightfall' },
    { key: 'tzait_72',              label: 'Tzait (72 min)',           desc: 'Rabbeinu Tam' },
    { key: 'chatzot_laila',         label: 'Chatzot Laila',            desc: 'Halachic Midnight' },
];

export function printZmanim({ zmanimData, date, locationLabel, hebrewInfo }) {
    const dow = date.getDay();
    const isFriday = dow === 5;
    const isSaturday = dow === 6;
    const dateStr = format(date, 'EEEE, MMMM d, yyyy');

    const rows = ALL_ZMANIM
        .filter(z => {
            if (z.fridayOnly && !isFriday) return false;
            const val = zmanimData?.zmanim?.[z.key];
            return !!val;
        })
        .map(z => {
            const val = zmanimData.zmanim[z.key];
            const label = (isSaturday && z.key === 'tzait_72') ? 'Havdalah' : z.label;
            return `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${label}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;">${z.desc}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#1e40af;text-align:right;font-variant-numeric:tabular-nums;">${val}</td>
            </tr>`;
        }).join('');

    const hebrewBlock = hebrewInfo ? `
        <div style="margin-bottom:12px;padding:10px 14px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
            <span style="color:#0369a1;font-size:14px;">
                ${hebrewInfo.hebrew_date_transliterated || ''} &nbsp;|&nbsp; 
                ${hebrewInfo.day_of_week_transliterated || ''}
                ${hebrewInfo.parsha ? ' &nbsp;|&nbsp; Parashat ' + hebrewInfo.parsha : ''}
            </span>
        </div>` : '';

    const html = `<!DOCTYPE html><html><head><title>Zmanim – ${dateStr}</title>
    <style>
        body { font-family: -apple-system, sans-serif; margin: 32px; color: #1e293b; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 16px; font-weight: 400; color: #64748b; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        @media print { body { margin: 16px; } }
    </style></head><body>
    <h1>Zmanim — ${dateStr}</h1>
    <h2>${locationLabel || ''}</h2>
    ${hebrewBlock}
    <table>${rows}</table>
    <p style="margin-top:20px;font-size:11px;color:#94a3b8;">Based on https://outorah.org/p/41921/ · Zmanim Today App</p>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
}
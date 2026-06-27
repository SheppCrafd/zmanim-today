import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'zmanim_cache_v2';

function fixCandleLighting(result) {
    if (!result?.zmanim?.sunset) return result;
    const sunsetStr = result.zmanim.sunset;
    const [time, meridiem] = sunsetStr.split(' ');
    const [hStr, mStr] = time.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const totalMins = hours * 60 + minutes - 18;
    let clHours = Math.floor(totalMins / 60) % 24;
    const clMins = totalMins % 60;
    const clMeridiem = clHours >= 12 ? 'PM' : 'AM';
    const clDisplay = clHours > 12 ? clHours - 12 : (clHours === 0 ? 12 : clHours);
    return {
        ...result,
        zmanim: {
            ...result.zmanim,
            candle_lighting: `${clDisplay}:${String(clMins).padStart(2, '0')} ${clMeridiem}`
        }
    };
}

function cacheKey(lat, lon, date) {
    return `${lat.toFixed(3)},${lon.toFixed(3)},${date}`;
}

function getCache(key) {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const store = JSON.parse(raw);
        return store[key] || null;
    } catch { return null; }
}

function setCache(key, data) {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        const store = raw ? JSON.parse(raw) : {};
        store[key] = data;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* ignore */ }
}

export function useZmanim(location, date = new Date()) {
    const [zmanim, setZmanim] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!location?.latitude || !location?.longitude) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const key = cacheKey(location.latitude, location.longitude, dateStr);
        const cached = getCache(key);
        if (cached) {
            setZmanim(fixCandleLighting(cached));
            return;
        }

        setLoading(true);
        setError(null);

        base44.integrations.Core.InvokeLLM({
            prompt: `Calculate accurate Jewish zmanim for ${dateStr} at coordinates: ${location.latitude}, ${location.longitude}

CRITICAL INSTRUCTIONS:
1. Search hebcal.com API specifically for these exact coordinates and date
2. Use this URL pattern: https://www.hebcal.com/zmanim?cfg=json&latitude=${location.latitude}&longitude=${location.longitude}&date=${dateStr}
3. Verify times match astronomical reality for this location

Required zmanim (return in 12-hour format with AM/PM):
- alot_hashachar, misheyakir, sunrise, sof_zman_shma_gra, sof_zman_shma_mga
- sof_zman_tefillah_gra, sof_zman_tefillah_mga, chatzot, mincha_gedola
- mincha_ketana, plag_hamincha, candle_lighting, sunset
- tzait_hakochavim, tzait_72, chatzot_laila

LOCATION INFO:
- location_name: City name for these coordinates
- timezone: Local timezone`,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    location_name: { type: "string" },
                    timezone: { type: "string" },
                    zmanim: {
                        type: "object",
                        properties: {
                            alot_hashachar: { type: "string" },
                            misheyakir: { type: "string" },
                            sunrise: { type: "string" },
                            sof_zman_shma_gra: { type: "string" },
                            sof_zman_shma_mga: { type: "string" },
                            sof_zman_tefillah_gra: { type: "string" },
                            sof_zman_tefillah_mga: { type: "string" },
                            chatzot: { type: "string" },
                            mincha_gedola: { type: "string" },
                            mincha_ketana: { type: "string" },
                            plag_hamincha: { type: "string" },
                            candle_lighting: { type: "string" },
                            sunset: { type: "string" },
                            tzait_hakochavim: { type: "string" },
                            tzait_72: { type: "string" },
                            chatzot_laila: { type: "string" }
                        }
                    }
                }
            }
        }).then(result => {
            const fixed = fixCandleLighting(result);
            setZmanim(fixed);
            setCache(key, fixed);
        }).catch(() => {
            setError('Failed to load zmanim.');
        }).finally(() => {
            setLoading(false);
        });
    }, [location?.latitude, location?.longitude, format(date, 'yyyy-MM-dd')]);

    return { zmanim, loading, error };
}
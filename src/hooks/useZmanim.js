import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { subtractMinutes } from '@/lib/timeUtils';

const STORAGE_KEY = 'zmanim_cache_v2';

/** Apply day-of-week rules: candle lighting only on Friday, havdalah only on Saturday. */
function applyDayRules(result, date) {
    if (!result?.zmanim) return result;
    const dow = date.getDay();
    return {
        ...result,
        zmanim: {
            ...result.zmanim,
            candle_lighting: dow === 5 ? result.zmanim.candle_lighting : null,
            havdalah:        dow === 6 ? result.zmanim.tzait_72 : null,
        }
    };
}

/** Derive alot_hashachar as exactly 72 minutes before sunrise. */
function fixAlotHashachar(result) {
    if (!result?.zmanim?.sunrise) return result;
    const alot = subtractMinutes(result.zmanim.sunrise, 72);
    if (!alot) return result;
    return { ...result, zmanim: { ...result.zmanim, alot_hashachar: alot } };
}

/** Derive candle_lighting as exactly 18 minutes before sunset. */
function fixCandleLighting(result) {
    if (!result?.zmanim?.sunset) return result;
    const cl = subtractMinutes(result.zmanim.sunset, 18);
    if (!cl) return result;
    return { ...result, zmanim: { ...result.zmanim, candle_lighting: cl } };
}

function cacheKey(lat, lon, date) {
    return `${lat.toFixed(3)},${lon.toFixed(3)},${date}`;
}

function getCache(key) {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw)[key] || null;
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

/** Apply all deterministic post-processing to a raw LLM result. */
function postProcess(result, date) {
    return applyDayRules(fixAlotHashachar(fixCandleLighting(result)), date);
}

export function useZmanim(location, date = new Date()) {
    const [zmanim, setZmanim] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const dateStr = format(date, 'yyyy-MM-dd');

    useEffect(() => {
        if (!location?.latitude || !location?.longitude) return;

        const key = cacheKey(location.latitude, location.longitude, dateStr);
        const cached = getCache(key);
        if (cached) {
            setZmanim(postProcess(cached, date));
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
                            alot_hashachar:        { type: "string" },
                            misheyakir:            { type: "string" },
                            sunrise:               { type: "string" },
                            sof_zman_shma_gra:     { type: "string" },
                            sof_zman_shma_mga:     { type: "string" },
                            sof_zman_tefillah_gra: { type: "string" },
                            sof_zman_tefillah_mga: { type: "string" },
                            chatzot:               { type: "string" },
                            mincha_gedola:         { type: "string" },
                            mincha_ketana:         { type: "string" },
                            plag_hamincha:         { type: "string" },
                            candle_lighting:       { type: "string" },
                            sunset:                { type: "string" },
                            tzait_hakochavim:      { type: "string" },
                            tzait_72:              { type: "string" },
                            chatzot_laila:         { type: "string" },
                        }
                    }
                }
            }
        }).then(result => {
            // Store the raw result (before day rules) so cache is date-agnostic
            const fixed = fixAlotHashachar(fixCandleLighting(result));
            setCache(key, fixed);
            setZmanim(postProcess(fixed, date));
        }).catch(() => {
            setError('Failed to load zmanim.');
        }).finally(() => {
            setLoading(false);
        });
    }, [location?.latitude, location?.longitude, dateStr]);

    return { zmanim, loading, error };
}
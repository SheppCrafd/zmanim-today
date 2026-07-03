import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { subtractMinutes } from '@/lib/timeUtils';

// Bumped cache version to clear out old LLM-formatted data
const STORAGE_KEY = 'zmanim_cache_v3'; 

/** Apply day-of-week rules: candle lighting only on Friday, havdalah only on Saturday. */
function applyDayRules(result, date) {
    if (!result?.zmanim) return result;
    const dow = date.getDay();
    return {
        ...result,
        zmanim: {
            ...result.zmanim,
            candle_lighting: dow === 5 ? result.zmanim.candle_lighting : null,
            // FIXED: Havdalah now uses the 8.5 degree calculation to match the main page
            havdalah:        dow === 6 ? result.zmanim.tzait_hakochavim : null, 
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
    if (result?.zmanim?.candle_lighting) return result; // Use Hebcal's exact time if provided
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

/** Apply all deterministic post-processing to a raw result. */
function postProcess(result, date) {
    return applyDayRules(fixAlotHashachar(fixCandleLighting(result)), date);
}

export function useZmanim(location, date = new Date()) {
    const [zmanim, setZmanim] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const dateStr = format(date, 'yyyy-MM-dd');

    const refetch = () => {
        if (location?.latitude && location?.longitude) {
            const key = cacheKey(location.latitude, location.longitude, dateStr);
            try {
                const raw = sessionStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const store = JSON.parse(raw);
                    delete store[key];
                    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
                }
            } catch { /* ignore */ }
        }
        setRefreshTrigger(t => t + 1);
    };

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

        // Fetch directly from Hebcal API for speed and precision (No LLM required)
        fetch(`https://www.hebcal.com/zmanim?cfg=json&latitude=${location.latitude}&longitude=${location.longitude}&date=${dateStr}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch data from Hebcal');
                return res.json();
            })
            .then(data => {
                const zmanimData = {
                    alot_hashachar: data.times.alotHashachar,
                    misheyakir: data.times.misheyakir,
                    sunrise: data.times.sunrise,
                    sof_zman_shma_gra: data.times.sofZmanShma,
                    sof_zman_shma_mga: data.times.sofZmanShmaMGA,
                    sof_zman_tefillah_gra: data.times.sofZmanTfilla,
                    sof_zman_tefillah_mga: data.times.sofZmanTfillaMGA,
                    chatzot: data.times.chatzot,
                    mincha_gedola: data.times.minchaGedola,
                    mincha_ketana: data.times.minchaKetana,
                    plag_hamincha: data.times.plagHaMincha,
                    candle_lighting: data.times.candleLighting || null,
                    sunset: data.times.sunset,
                    tzait_hakochavim: data.times.tzeit85deg, // FIXED: Now exactly matches main page
                    tzait_72: data.times.tzeit72min,
                    chatzot_laila: data.times.chatzotNight,
                };

                const rawResult = {
                    location_name: location.city || location.name || "Selected Location",
                    timezone: data.location?.tzid || "Local Time",
                    zmanim: zmanimData
                };

                // Store the raw result (before day rules) so cache is date-agnostic
                const fixed = fixAlotHashachar(fixCandleLighting(rawResult));
                setCache(key, fixed);
                setZmanim(postProcess(fixed, date));
            })
            .catch((err) => {
                console.error("Zmanim Hook Error:", err);
                setError('Failed to load zmanim.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [location?.latitude, location?.longitude, dateStr, refreshTrigger]);

    return { zmanim, loading, error, refetch };
}
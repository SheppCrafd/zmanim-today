import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const LOC_KEY = 'zmanim_saved_location';

export function useSavedLocation() {
    const [location, setLocationState] = useState(() => {
        try {
            const raw = localStorage.getItem(LOC_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const saveLocation = (loc) => {
        setLocationState(loc);
        try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch { /* ignore */ }
    };

    const clearLocation = () => {
        setLocationState(null);
        try { localStorage.removeItem(LOC_KEY); } catch { /* ignore */ }
    };

    const detectGPS = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }
        setLoading(true);
        setError(null);

        // Hard timeout fallback — in case the browser never calls success or error
        const hardTimeout = setTimeout(() => {
            setLoading(false);
            // Fall back to last known location silently, or show error
            const saved = (() => { try { return JSON.parse(localStorage.getItem(LOC_KEY)); } catch { return null; } })();
            if (!saved) setError('Location timed out. Please search manually.');
        }, 15000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(hardTimeout);
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                // Save raw coords immediately so user isn't left waiting
                saveLocation(loc);
                // Then enrich with city name
                base44.integrations.Core.InvokeLLM({
                    prompt: `Reverse-geocode these exact GPS coordinates to a real-world address: latitude ${loc.latitude}, longitude ${loc.longitude}.
Use mapping/geocoding data to find the nearest recognized city (not a small town, village, or suburb). Return the closest proper city name.
Return the local municipality name as "city", the state/province abbreviation (for USA, Canada, Australia; otherwise null) as "state", and the country as "country".`,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            city: { type: "string" },
                            state: { type: "string" },
                            country: { type: "string" }
                        }
                    }
                }).then(geo => {
                    saveLocation({ ...loc, city: geo.city, state: geo.state, country: geo.country });
                }).catch(() => {
                    // Keep raw coords if geocoding fails — already saved above
                }).finally(() => setLoading(false));
            },
            (err) => {
                clearTimeout(hardTimeout);
                const msgs = {
                    1: 'Location access denied. Please search for your city manually.',
                    2: 'Location unavailable. Please search manually.',
                    3: 'Location request timed out. Please search manually.',
                };
                setError(msgs[err.code] || 'Unable to get location.');
                setLoading(false);
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
        );
    };

    const searchLocation = async (query) => {
        setLoading(true);
        setError(null);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Get exact coordinates for: "${query}". Include state/province abbreviation for USA, Canada, Australia. Otherwise leave state null.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                        city: { type: "string" },
                        state: { type: "string" },
                        country: { type: "string" }
                    }
                }
            });
            if (!result.latitude || !result.longitude) throw new Error('No coordinates');
            saveLocation(result);
        } catch {
            setError(`Could not find "${query}".`);
        } finally {
            setLoading(false);
        }
    };

    return { location, loading, error, detectGPS, searchLocation, clearLocation };
}
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
            setError('Geolocation not supported.');
            return;
        }
        setLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                // Reverse geocode
                base44.integrations.Core.InvokeLLM({
                    prompt: `Get city, state/province abbreviation (if applicable), and country for: ${loc.latitude}, ${loc.longitude}. Leave state null if not applicable.`,
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
                    saveLocation(loc);
                }).finally(() => setLoading(false));
            },
            (err) => {
                const msgs = {
                    1: 'Location access denied.',
                    2: 'Location unavailable.',
                    3: 'Location request timed out.',
                };
                setError(msgs[err.code] || 'Unable to get location.');
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
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
import React, { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LocationDisplay({ location }) {
    const [locationName, setLocationName] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (location && !location.city) {
            getLocationName();
        } else if (location && location.city) {
            setLocationName({ city: location.city, state: location.state, country: location.country });
            setLoading(false);
        }
    }, [location]);

    const getLocationName = async () => {
        setLoading(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Get the city name, state/province (if applicable), and country for these coordinates: ${location.latitude}, ${location.longitude}. 
                For countries with states or provinces (e.g. USA, Canada, Australia), include the state/province abbreviation. Otherwise leave state null.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        city: { type: "string" },
                        state: { type: "string" },
                        country: { type: "string" }
                    }
                }
            });
            setLocationName(result);
        } catch (err) {
            console.error('Failed to get location name:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="text-sm text-slate-600">Your Location</p>
                {loading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        <span className="text-sm text-slate-400">Loading...</span>
                    </div>
                ) : locationName ? (
                    <p className="font-semibold text-slate-800">
                        {locationName.city}{locationName.state ? `, ${locationName.state}` : ''}, {locationName.country}
                    </p>
                ) : (
                    <p className="font-mono text-sm text-slate-600">
                        {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                    </p>
                )}
            </div>
        </div>
    );
}
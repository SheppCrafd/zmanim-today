import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import ZmanimCard from '../components/zmanim/ZmanimCard';
import LocationDisplay from '../components/zmanim/LocationDisplay';

export default function Zmanim() {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [zmanim, setZmanim] = useState(null);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        getLocation();
    }, []);

    useEffect(() => {
        if (location) {
            calculateZmanim();
        }
    }, [location]);

    const getLocation = () => {
        setLoading(true);
        setError(null);
        
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                setLoading(false);
            },
            (error) => {
                setError('Unable to retrieve your location. Please enable location services.');
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const calculateZmanim = async () => {
        setCalculating(true);
        setError(null);

        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Find the accurate Jewish zmanim (prayer times) for today's date: ${format(currentDate, 'yyyy-MM-dd')}

Location coordinates:
- Latitude: ${location.latitude}
- Longitude: ${location.longitude}

Search for accurate zmanim data from reliable Jewish calendar websites (like chabad.org, myzmanim.com, ou.org, hebcal.com, or similar).

Please provide the following zmanim in local time (use 12-hour format with AM/PM):

1. Alot Hashachar (Dawn)
2. Misheyakir (Earliest Tallit/Tefillin)
3. Sunrise (Netz Hachamah)
4. Sof Zman Shma MGA (Latest Shma - Magen Avraham)
5. Sof Zman Shma GRA (Latest Shma - Gra)
6. Sof Zman Tefillah MGA (Latest Shacharit - Magen Avraham)
7. Sof Zman Tefillah GRA (Latest Shacharit - Gra)
8. Chatzot (Midday)
9. Mincha Gedola (Earliest Mincha)
10. Mincha Ketana (Preferred Mincha)
11. Plag Hamincha
12. Sunset (Shkiah)
13. Tzait Hakochavim (Nightfall - 3 stars)
14. Chatzot Laila (Halachic midnight)

Also provide:
- Hebrew date (e.g., "15 Tevet 5785")
- Day of week in Hebrew
- Parsha of the week (Torah portion)
- Location timezone

IMPORTANT: Use actual astronomical calculations from reliable sources. Search the web for accurate data.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        hebrew_date: { type: "string" },
                        day_of_week_hebrew: { type: "string" },
                        parsha: { type: "string" },
                        timezone: { type: "string" },
                        zmanim: {
                            type: "object",
                            properties: {
                                alot_hashachar: { type: "string" },
                                misheyakir: { type: "string" },
                                sunrise: { type: "string" },
                                sof_zman_shma_mga: { type: "string" },
                                sof_zman_shma_gra: { type: "string" },
                                sof_zman_tefillah_mga: { type: "string" },
                                sof_zman_tefillah_gra: { type: "string" },
                                chatzot: { type: "string" },
                                mincha_gedola: { type: "string" },
                                mincha_ketana: { type: "string" },
                                plag_hamincha: { type: "string" },
                                sunset: { type: "string" },
                                tzait_hakochavim: { type: "string" },
                                chatzot_laila: { type: "string" }
                            }
                        }
                    }
                }
            });

            setZmanim(result);
        } catch (err) {
            setError('Failed to calculate zmanim. Please try again.');
        } finally {
            setCalculating(false);
        }
    };

    const handleRefresh = () => {
        setCurrentDate(new Date());
        if (location) {
            calculateZmanim();
        } else {
            getLocation();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-0">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <p className="text-lg text-slate-700">Detecting your location...</p>
                        <p className="text-sm text-slate-500 mt-2">Please allow location access</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error && !location) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-0">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <MapPin className="w-12 h-12 text-red-500 mb-4" />
                        <p className="text-lg text-slate-700 text-center mb-4">{error}</p>
                        <Button onClick={getLocation} className="bg-blue-600 hover:bg-blue-700">
                            <MapPin className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50">
            <div className="max-w-4xl mx-auto p-4 md:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2 tracking-tight">
                        Zmanim
                    </h1>
                    <p className="text-slate-600 text-lg">זמני היום</p>
                </div>

                {/* Location & Date Card */}
                <Card className="mb-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <LocationDisplay location={location} />
                        
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-amber-600" />
                                <div>
                                    <p className="text-sm text-slate-600">Civil Date</p>
                                    <p className="font-semibold text-slate-800">
                                        {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={handleRefresh}
                                disabled={calculating}
                                className="border-slate-300 hover:bg-slate-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        {zmanim && (
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">Hebrew Date</span>
                                    <span className="font-semibold text-slate-800">{zmanim.hebrew_date}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600">Day</span>
                                    <span className="font-semibold text-slate-800">{zmanim.day_of_week_hebrew}</span>
                                </div>
                                {zmanim.parsha && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600">Parsha</span>
                                        <span className="font-semibold text-blue-700">{zmanim.parsha}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Calculating State */}
                {calculating && (
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                            <p className="text-slate-700">Calculating zmanim...</p>
                        </CardContent>
                    </Card>
                )}

                {/* Error State */}
                {error && location && (
                    <Card className="shadow-lg border-0 bg-red-50">
                        <CardContent className="py-6 text-center">
                            <p className="text-red-700">{error}</p>
                            <Button 
                                onClick={handleRefresh}
                                className="mt-4 bg-red-600 hover:bg-red-700"
                            >
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Zmanim Display */}
                {zmanim && !calculating && (
                    <div className="space-y-4">
                        <ZmanimCard 
                            title="Dawn & Morning"
                            icon="☀️"
                            color="from-amber-500 to-orange-500"
                            times={[
                                { label: 'Alot Hashachar', value: zmanim.zmanim.alot_hashachar, description: 'Dawn' },
                                { label: 'Misheyakir', value: zmanim.zmanim.misheyakir, description: 'Tallit & Tefillin' },
                                { label: 'Sunrise', value: zmanim.zmanim.sunrise, description: 'Netz HaChamah', highlight: true },
                                { label: 'Sof Zman Shma (GRA)', value: zmanim.zmanim.sof_zman_shma_gra, description: 'Latest Shma', highlight: true },
                                { label: 'Sof Zman Shma (MGA)', value: zmanim.zmanim.sof_zman_shma_mga, description: 'Latest Shma (Stringent)' },
                                { label: 'Sof Zman Tefillah (GRA)', value: zmanim.zmanim.sof_zman_tefillah_gra, description: 'Latest Shacharit', highlight: true },
                                { label: 'Sof Zman Tefillah (MGA)', value: zmanim.zmanim.sof_zman_tefillah_mga, description: 'Latest Shacharit (Stringent)' }
                            ]}
                        />

                        <ZmanimCard 
                            title="Midday & Afternoon"
                            icon="🌤️"
                            color="from-blue-500 to-cyan-500"
                            times={[
                                { label: 'Chatzot', value: zmanim.zmanim.chatzot, description: 'Halachic Noon', highlight: true },
                                { label: 'Mincha Gedola', value: zmanim.zmanim.mincha_gedola, description: 'Earliest Mincha' },
                                { label: 'Mincha Ketana', value: zmanim.zmanim.mincha_ketana, description: 'Preferred Mincha' },
                                { label: 'Plag HaMincha', value: zmanim.zmanim.plag_hamincha, description: 'Early Maariv Time' }
                            ]}
                        />

                        <ZmanimCard 
                            title="Evening & Night"
                            icon="🌙"
                            color="from-indigo-600 to-purple-600"
                            times={[
                                { label: 'Sunset', value: zmanim.zmanim.sunset, description: 'Shkiah', highlight: true },
                                { label: 'Tzait HaKochavim', value: zmanim.zmanim.tzait_hakochavim, description: 'Nightfall (3 Stars)', highlight: true },
                                { label: 'Chatzot Laila', value: zmanim.zmanim.chatzot_laila, description: 'Halachic Midnight' }
                            ]}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-8 text-sm text-slate-500">
                    <p>Times calculated based on your GPS location</p>
                    {zmanim?.timezone && (
                        <p className="mt-1">Timezone: {zmanim.timezone}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar as CalendarIcon, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import ZmanimCard from '../components/zmanim/ZmanimCard';
import LocationDisplay from '../components/zmanim/LocationDisplay';

export default function Zmanim() {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [zmanim, setZmanim] = useState(null);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [manualLocation, setManualLocation] = useState('');
    const [searchingLocation, setSearchingLocation] = useState(false);



    useEffect(() => {
        if (location) {
            calculateZmanim();
        }
    }, [location, currentDate]);

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
                    longitude: position.coords.longitude
                });
                setLoading(false);
            },
            (error) => {
                setError('Unable to retrieve your location. Please enable location services.');
                setLoading(false);
            }
        );
    };

    const calculateZmanim = async () => {
        setCalculating(true);
        setError(null);

        try {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Calculate accurate Jewish zmanim for ${dateStr} at coordinates: ${location.latitude}, ${location.longitude}

CRITICAL INSTRUCTIONS:
1. Search hebcal.com API or website specifically for these exact coordinates and date
2. Use this URL pattern: https://www.hebcal.com/zmanim?cfg=json&latitude=${location.latitude}&longitude=${location.longitude}&date=${dateStr}
3. Verify times match astronomical reality for this location

Required zmanim (return in 12-hour format with AM/PM):

DAWN & MORNING:
- alot_hashachar: Dawn (72 minutes before sunrise OR when sun is 16.1° below horizon)
- misheyakir: When one can recognize someone from 6 feet (sun 11° below horizon)
- sunrise: Top of sun visible at horizon
- sof_zman_shma_gra: Latest Shema (3 halachic hours after sunrise using GRA method: divide sunrise to sunset into 12 parts)
- sof_zman_shma_mga: Latest Shema (3 halachic hours after dawn using MGA method: divide dawn to nightfall into 12 parts)
- sof_zman_tefillah_gra: Latest Shemoneh Esrei (4 halachic hours after sunrise, GRA)
- sof_zman_tefillah_mga: Latest Shemoneh Esrei (4 halachic hours after dawn, MGA)

MIDDAY & AFTERNOON:
- chatzot: Halachic noon (exact midpoint between sunrise and sunset)
- mincha_gedola: 30 minutes after chatzot
- mincha_ketana: 2.5 halachic hours before sunset
- plag_hamincha: 1.25 halachic hours before sunset (midpoint between mincha ketana and sunset)

EVENING & NIGHT:
- candle_lighting: 18 minutes before sunset (for Shabbat/Yom Tov)
- sunset: When sun disappears below horizon
- tzait_hakochavim: Nightfall - 3 medium stars visible (sun 8.5° below horizon OR 42-50 minutes after sunset)
- tzait_72: Nightfall per Rabbeinu Tam (72 minutes after sunset)
- chatzot_laila: Halachic midnight (midpoint between sunset and next sunrise)

HEBREW DATE INFO:
- hebrew_date: Full Hebrew date (e.g., "כ״א כסלו תשפ״ה" or "21 Kislev 5785")
- day_of_week_hebrew: Hebrew day name
- parsha: Torah portion for the week (if applicable)
- location_name: City name for these coordinates
- timezone: Local timezone

Use actual astronomical calculations. Verify data is correct.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        hebrew_date: { type: "string" },
                        day_of_week_hebrew: { type: "string" },
                        parsha: { type: "string" },
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
            });

            setZmanim(result);
        } catch (err) {
            setError('Failed to calculate zmanim. Please try again.');
        } finally {
            setCalculating(false);
        }
    };

    const handleManualLocation = async (e) => {
        e.preventDefault();
        if (!manualLocation.trim()) return;

        setSearchingLocation(true);
        setError(null);

        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Get the exact coordinates (latitude and longitude) for this location: "${manualLocation}"
                
                Return precise coordinates that can be used for zmanim calculations.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                        city: { type: "string" },
                        country: { type: "string" }
                    }
                }
            });

            setLocation({
                latitude: result.latitude,
                longitude: result.longitude,
                city: result.city,
                country: result.country
            });
        } catch (err) {
            setError('Could not find location. Please try a different search.');
        } finally {
            setSearchingLocation(false);
        }
    };

    const handleRefresh = () => {
        setCurrentDate(new Date());
        if (location) {
            calculateZmanim();
        }
    };

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

                {/* Location Search */}
                {!location && (
                    <Card className="mb-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <form onSubmit={handleManualLocation} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Enter Your Location
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            placeholder="e.g., Jerusalem, New York, London..."
                                            value={manualLocation}
                                            onChange={(e) => setManualLocation(e.target.value)}
                                            className="flex-1"
                                            disabled={searchingLocation}
                                        />
                                        <Button 
                                            type="submit"
                                            disabled={searchingLocation || !manualLocation.trim()}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {searchingLocation ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Search className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 border-t border-slate-300"></div>
                                    <span className="text-sm text-slate-500">or</span>
                                    <div className="flex-1 border-t border-slate-300"></div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={getLocation}
                                    disabled={loading}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Detecting Location...
                                        </>
                                    ) : (
                                        <>
                                            <MapPin className="w-4 h-4 mr-2" />
                                            Use My GPS Location
                                        </>
                                    )}
                                </Button>
                            </form>
                            {error && (
                                <p className="text-sm text-red-600 mt-3 text-center">{error}</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {!location && (
                    <div className="text-center text-slate-500 text-sm mt-8">
                        Enter a city or address to get accurate zmanim for your location
                    </div>
                )}

                {/* Location & Date Card */}
                {location && (
                    <Card className="mb-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <LocationDisplay location={location} />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setLocation(null);
                                        setZmanim(null);
                                        setManualLocation('');
                                    }}
                                    className="text-slate-500 hover:text-slate-700"
                                >
                                    Change
                                </Button>
                            </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="w-5 h-5 text-amber-600" />
                                    <p className="text-sm font-medium text-slate-600">Select Date</p>
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
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        const newDate = new Date(currentDate);
                                        newDate.setDate(newDate.getDate() - 1);
                                        setCurrentDate(newDate);
                                    }}
                                    disabled={calculating}
                                    className="h-10 w-10"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="flex-1 justify-start text-left font-semibold"
                                            disabled={calculating}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={currentDate}
                                            onSelect={(date) => date && setCurrentDate(date)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        const newDate = new Date(currentDate);
                                        newDate.setDate(newDate.getDate() + 1);
                                        setCurrentDate(newDate);
                                    }}
                                    disabled={calculating}
                                    className="h-10 w-10"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
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
                )}

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
                                { label: 'Alot Hashachar', value: zmanim.zmanim.alot_hashachar, description: 'Dawn - 72 min before sunrise' },
                                { label: 'Misheyakir', value: zmanim.zmanim.misheyakir, description: 'Earliest Tallit & Tefillin' },
                                { label: 'Sunrise', value: zmanim.zmanim.sunrise, description: 'HaNetz HaChamah', highlight: true },
                                { label: 'Sof Zman Shema (GRA)', value: zmanim.zmanim.sof_zman_shma_gra, description: 'Latest Shema - 3 hrs after sunrise', highlight: true },
                                { label: 'Sof Zman Shema (MGA)', value: zmanim.zmanim.sof_zman_shma_mga, description: '3 hrs after dawn (stringent)' },
                                { label: 'Sof Zman Tefillah (GRA)', value: zmanim.zmanim.sof_zman_tefillah_gra, description: 'Latest Shemoneh Esrei - 4 hrs', highlight: true },
                                { label: 'Sof Zman Tefillah (MGA)', value: zmanim.zmanim.sof_zman_tefillah_mga, description: '4 hrs after dawn (stringent)' }
                            ]}
                        />

                        <ZmanimCard 
                            title="Midday & Afternoon"
                            icon="🌤️"
                            color="from-blue-500 to-cyan-500"
                            times={[
                                { label: 'Chatzot', value: zmanim.zmanim.chatzot, description: 'Halachic Noon - midpoint of day', highlight: true },
                                { label: 'Mincha Gedola', value: zmanim.zmanim.mincha_gedola, description: 'Earliest Mincha - 30 min after noon' },
                                { label: 'Mincha Ketana', value: zmanim.zmanim.mincha_ketana, description: 'Preferred Mincha - 2.5 hrs before sunset' },
                                { label: 'Plag HaMincha', value: zmanim.zmanim.plag_hamincha, description: 'Earliest candle lighting - 1.25 hrs before sunset' }
                            ]}
                        />

                        <ZmanimCard 
                            title="Evening & Night"
                            icon="🌙"
                            color="from-indigo-600 to-purple-600"
                            times={[
                                zmanim.zmanim.candle_lighting && { label: 'Candle Lighting', value: zmanim.zmanim.candle_lighting, description: '18 min before sunset', highlight: true },
                                { label: 'Sunset', value: zmanim.zmanim.sunset, description: 'Shkiyas HaChamah', highlight: true },
                                { label: 'Tzait HaKochavim', value: zmanim.zmanim.tzait_hakochavim, description: 'Nightfall - 3 medium stars', highlight: true },
                                { label: 'Tzait (72 min)', value: zmanim.zmanim.tzait_72, description: 'Nightfall - Rabbeinu Tam' },
                                { label: 'Chatzot Laila', value: zmanim.zmanim.chatzot_laila, description: 'Halachic Midnight' }
                            ].filter(Boolean)}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-8 text-sm text-slate-500">
                    <p>Times calculated based on your GPS location</p>
                    {zmanim?.timezone && (
                        <p className="mt-1">Timezone: {zmanim.timezone}</p>
                    )}
                    <p className="mt-2">
                        Based on <a href="https://outorah.org/p/41921/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://outorah.org/p/41921/</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar as CalendarIcon, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import ZmanimCard from '../components/zmanim/ZmanimCard';
import LocationDisplay from '../components/zmanim/LocationDisplay';
import { getHebrewDate } from '../lib/hebrewDate';
import { useSavedLocation } from '@/hooks/useLocation';
import NavMenu from '@/components/NavMenu';
import { printZmanim } from '@/lib/printZmanim';
import { useDashboardPrefs } from '@/hooks/useDashboardPrefs';
import { ZMANIM_GROUPS, getGroupEntries } from '@/lib/zmanimSchema';

export default function Zmanim() {
    const { location, loading: gpsLoading, detectGPS, searchLocation: searchSavedLocation, clearLocation } = useSavedLocation();
    const { prefs } = useDashboardPrefs();
    const [calculating, setCalculating] = useState(false);
    const [rawZmanim, setRawZmanim] = useState(null); // Stores raw unformatted timestamps
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [manualLocation, setManualLocation] = useState('');
    const [searchingLocation, setSearchingLocation] = useState(false);
    const [hebrewInfo, setHebrewInfo] = useState(null);
    
    // The request bouncer to prevent race conditions
    const requestRef = useRef(0);

    // Debounced API call for when date or location changes
    useEffect(() => {
        if (!location) return;

        const debounceTimer = setTimeout(() => {
            calculateZmanim();
        }, 600); // Wait 600ms after last click before fetching

        return () => clearTimeout(debounceTimer);
    }, [location, currentDate]);

    useEffect(() => {
        getHebrewDate(currentDate)
            .then(setHebrewInfo)
            .catch(() => setHebrewInfo(null));
    }, [currentDate]);

    const getLocation = () => {
        detectGPS();
    };

    const calculateZmanim = async () => {
        const currentRequest = Date.now();
        requestRef.current = currentRequest;

        setCalculating(true);
        setError(null);

        try {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            
            // 1. Direct HTTP request to Hebcal's API
            const response = await fetch(
                `https://www.hebcal.com/zmanim?cfg=json&latitude=${location.latitude}&longitude=${location.longitude}&date=${dateStr}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch data from Hebcal');
            }

            const data = await response.json();
            const dayOfWeek = currentDate.getDay();

            // 2. Candle Lighting: Calculate raw time for Friday, OR if Hebcal provided a Yom Tov time
            let candleLightingTime = data.times.candleLighting;
            if (!candleLightingTime && dayOfWeek === 5 && data.times.sunset) {
                const sunsetDate = new Date(data.times.sunset);
                sunsetDate.setMinutes(sunsetDate.getMinutes() - 18);
                candleLightingTime = sunsetDate.toISOString(); 
            }

            // 3. Havdalah: ONLY calculate raw time if it's Saturday
            let havdalahTime = null;
            if (dayOfWeek === 6 && data.times.tzeit85deg) {
                havdalahTime = data.times.tzeit85deg;
            }

            // 4. Build the base raw payload
            const result = {
                location_name: location.city || location.name || "Selected Location",
                timezone: data.location?.tzid || "Local Time",
                times: {
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
                    sunset: data.times.sunset,
                    tzait_hakochavim: data.times.tzeit85deg, 
                    tzait_72: data.times.tzeit72min,
                    chatzot_laila: data.times.chatzotNight,
                    candle_lighting: candleLightingTime || null,
                    havdalah: havdalahTime || null,
                }
            };

            // Only update state if this is the most recent request
            if (requestRef.current === currentRequest) {
                setRawZmanim(result);
                setError(null);
            }

        } catch (err) {
            console.error("Zmanim Fetch Error:", err);
            if (requestRef.current === currentRequest) {
                setError('Failed to load zmanim data. Please try again.');
                setRawZmanim(null);
            }
        } finally {
            if (requestRef.current === currentRequest) {
                setCalculating(false);
            }
        }
    };

    // 5. Dynamically format the zmanim object whenever raw data or 12h/24h pref changes
    const zmanim = useMemo(() => {
        if (!rawZmanim) return null;

        const formatTime = (timeInput) => {
            if (!timeInput) return "";
            const d = new Date(timeInput);
            return d.toLocaleTimeString([], { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: !prefs?.use24Hour // Toggle 12hr representation dynamically
            });
        };

        const formattedZmanimData = {};
        Object.keys(rawZmanim.times).forEach(key => {
            if (rawZmanim.times[key]) {
                formattedZmanimData[key] = formatTime(rawZmanim.times[key]);
            }
        });

        return {
            location_name: rawZmanim.location_name,
            timezone: rawZmanim.timezone,
            zmanim: formattedZmanimData
        };
    }, [rawZmanim, prefs?.use24Hour]);

    const handleManualLocation = async (e) => {
        e.preventDefault();
        if (!manualLocation.trim()) return;
        setSearchingLocation(true);
        await searchSavedLocation(manualLocation);
        setManualLocation('');
        setSearchingLocation(false);
    };

    const handleRefresh = () => {
        setCurrentDate(new Date());
        if (location) {
            calculateZmanim();
        }
    };

    // Pull-to-refresh
    const touchStartY = useRef(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const onTouchStart = (e) => {
        if (window.scrollY === 0) {
            touchStartY.current = e.touches[0].clientY;
        } else {
            touchStartY.current = 0;
        }
    };

    const onTouchMove = (e) => {
        if (touchStartY.current <= 0 || isRefreshing) return;
        const diff = e.touches[0].clientY - touchStartY.current;
        if (diff > 0) setPullDistance(Math.min(diff * 0.5, 80));
    };

    const onTouchEnd = async () => {
        if (pullDistance > 60 && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(40);
            try { handleRefresh(); } catch { /* ignore */ }
            setIsRefreshing(false);
        }
        setPullDistance(0);
        touchStartY.current = 0;
    };

    return (
        <div
            className="min-h-screen bg-background pb-24"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ overscrollBehaviorY: 'none' }}
        >
            {/* Pull-to-refresh indicator */}
            {(pullDistance > 0 || isRefreshing) && (
                <div className="flex justify-center overflow-hidden" style={{ height: `${pullDistance}px` }}>
                    <Loader2 className={`text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} style={{ marginTop: 8 }} />
                </div>
            )}
            <div className="max-w-4xl mx-auto px-4 pt-safe pb-8 md:px-8">
                {/* Header */}
                <div className="flex items-center mb-8 min-h-[72px]">
                    <div className="shrink-0"><NavMenu /></div>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2 tracking-tight">Zmanim</h1>
                        <p className="text-slate-600 text-lg">זמני היום</p>
                    </div>
                    <div className="shrink-0 w-9"></div>
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
                                            placeholder="e.g., 'Jerusalem', 'New York, NY', 'London'..."
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
                                    disabled={gpsLoading}
                                    className="w-full"
                                >
                                    {gpsLoading ? (
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
                                        clearLocation();
                                        setRawZmanim(null);
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
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setCurrentDate(new Date())}
                                        disabled={calculating}
                                        className="border-slate-300 hover:bg-slate-50"
                                    >
                                        Today
                                    </Button>
                                    {zmanim && !calculating && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const locLabel = location ? [location.city, location.state, location.country].filter(Boolean).join(', ') || `${location.latitude?.toFixed(3)}°, ${location.longitude?.toFixed(3)}°` : '';
                                                printZmanim({ zmanimData: zmanim, date: currentDate, locationLabel: locLabel, hebrewInfo, timezone: zmanim.timezone });
                                            }}
                                            className="border-slate-300 hover:bg-slate-50"
                                            title="Print zmanim"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                    )}
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

                        {hebrewInfo && (
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-sm text-slate-600 shrink-0">Hebrew Date</span>
                                    <div className="text-right">
                                        <div className="font-semibold text-slate-800 text-lg leading-tight" dir="rtl">{hebrewInfo.hebrew_date}</div>
                                        <div className="text-sm text-slate-500">{hebrewInfo.hebrew_date_transliterated}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-sm text-slate-600 shrink-0">Day</span>
                                    <div className="text-right">
                                        <div className="font-semibold text-slate-800" dir="rtl">{hebrewInfo.day_of_week_hebrew}</div>
                                        <div className="text-sm text-slate-500">{hebrewInfo.day_of_week_transliterated}</div>
                                    </div>
                                </div>
                                {hebrewInfo.parsha && (
                                    <div className="flex justify-between items-start gap-4">
                                        <span className="text-sm text-slate-600 shrink-0">Parsha</span>
                                        <div className="text-right">
                                            {hebrewInfo.parsha_hebrew && (
                                                <div className="font-semibold text-blue-700" dir="rtl">{hebrewInfo.parsha_hebrew}</div>
                                            )}
                                            <div className="text-sm text-blue-600">{hebrewInfo.parsha}</div>
                                        </div>
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
                {error && !zmanim && location && (
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
                        {ZMANIM_GROUPS.map(group => {
                            const entries = getGroupEntries(group.id, zmanim.zmanim, currentDate.getDay());
                            if (!entries.length) return null;
                            return (
                                <ZmanimCard
                                    key={group.id}
                                    title={group.title}
                                    icon={group.icon}
                                    color={group.color}
                                    use24Hour={prefs.use24Hour}
                                    times={entries.map(e => ({
                                        label: e.label,
                                        value: e.value,
                                        description: e.description,
                                        highlight: e.highlight,
                                    }))}
                                />
                            );
                        })}
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
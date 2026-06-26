import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import NavMenu from '../components/NavMenu';

const JERUSALEM = { lat: 31.7767, lng: 35.2345 };

function getBearing(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLng = toRad(lng2 - lng1);
    const rlat1 = toRad(lat1);
    const rlat2 = toRad(lat2);
    const y = Math.sin(dLng) * Math.cos(rlat2);
    const x = Math.cos(rlat1) * Math.sin(rlat2) - Math.sin(rlat1) * Math.cos(rlat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function JerusalemCompass() {
    const [bearing, setBearing] = useState(null);
    const [distance, setDistance] = useState(null);
    const [heading, setHeading] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [orientationNote, setOrientationNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const orientationHandler = useRef(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported by your browser.');
            setLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setBearing(getBearing(latitude, longitude, JERUSALEM.lat, JERUSALEM.lng));
                setDistance(getDistance(latitude, longitude, JERUSALEM.lat, JERUSALEM.lng));
                setLoading(false);
            },
            () => {
                setLocationError('Could not get your location. Please enable location access.');
                setLoading(false);
            }
        );
    }, []);

    useEffect(() => {
        const startOrientation = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const perm = await DeviceOrientationEvent.requestPermission();
                    if (perm !== 'granted') {
                        setOrientationNote('Compass direction unavailable — showing fixed bearing.');
                        return;
                    }
                } catch {
                    setOrientationNote('Compass direction unavailable — showing fixed bearing.');
                    return;
                }
            }

            orientationHandler.current = (e) => {
                if (e.webkitCompassHeading != null) {
                    setHeading(e.webkitCompassHeading);
                } else if (e.alpha != null) {
                    setHeading((360 - e.alpha + 360) % 360);
                }
            };

            window.addEventListener('deviceorientationabsolute', orientationHandler.current, true);
            window.addEventListener('deviceorientation', orientationHandler.current, true);
        };

        startOrientation();
        return () => {
            if (orientationHandler.current) {
                window.removeEventListener('deviceorientationabsolute', orientationHandler.current, true);
                window.removeEventListener('deviceorientation', orientationHandler.current, true);
            }
        };
    }, []);

    const needleRotation = bearing != null ? (heading != null ? bearing - heading : bearing) : 0;
    const distanceKm = distance != null ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${Math.round(distance).toLocaleString()} km`) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center">
            <NavMenu />

            <div className="flex flex-col items-center justify-center flex-1 px-4 pt-16 pb-8 w-full max-w-md">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1 tracking-tight text-center">Jerusalem Compass</h1>
                <p className="text-blue-300 text-sm mb-10 text-center">ירושלים</p>

                {loading && (
                    <div className="flex flex-col items-center gap-3 text-white">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
                        <p className="text-slate-300">Getting your location...</p>
                    </div>
                )}

                {locationError && (
                    <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 text-red-300 text-center text-sm">
                        {locationError}
                    </div>
                )}

                {!loading && !locationError && (
                    <>
                        {/* Compass */}
                        <div className="relative w-72 h-72 flex items-center justify-center mb-8">
                            {/* Outer ring */}
                            <div className="absolute inset-0 rounded-full border-4 border-blue-700/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl" />

                            {/* Cardinal directions */}
                            {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([dir, deg]) => (
                                <span
                                    key={dir}
                                    className="absolute text-blue-300 text-xs font-bold"
                                    style={{
                                        transform: `rotate(${deg}deg) translateY(-122px) rotate(-${deg}deg)`,
                                    }}
                                >
                                    {dir}
                                </span>
                            ))}

                            {/* Tick marks */}
                            {Array.from({ length: 36 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-0.5 bg-blue-800"
                                    style={{
                                        height: i % 9 === 0 ? '12px' : '6px',
                                        top: i % 9 === 0 ? '14px' : '17px',
                                        left: '50%',
                                        transformOrigin: '0 122px',
                                        transform: `translateX(-50%) rotate(${i * 10}deg)`,
                                    }}
                                />
                            ))}

                            {/* Needle */}
                            <div
                                className="absolute w-3 flex flex-col items-center"
                                style={{
                                    height: '200px',
                                    top: '50%',
                                    left: '50%',
                                    transformOrigin: '50% 100px',
                                    transform: `translate(-50%, -100px) rotate(${needleRotation}deg)`,
                                    transition: 'transform 0.3s ease-out',
                                }}
                            >
                                {/* Gold tip pointing to Jerusalem */}
                                <div className="w-0 h-0"
                                    style={{
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderBottom: '90px solid #f59e0b',
                                    }}
                                />
                                {/* Blue tail */}
                                <div className="w-0 h-0"
                                    style={{
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderTop: '90px solid #3b82f6',
                                    }}
                                />
                            </div>

                            {/* Center dot */}
                            <div className="absolute w-4 h-4 rounded-full bg-white shadow-md border-2 border-slate-600" />

                            {/* Star of David in center glow */}
                            <div className="absolute text-2xl opacity-10 select-none">✡</div>
                        </div>

                        {/* Info */}
                        <div className="text-center space-y-2">
                            <div className="bg-white/10 rounded-2xl px-8 py-4 backdrop-blur-sm border border-white/10">
                                <p className="text-blue-300 text-xs uppercase tracking-widest mb-1">Direction to Jerusalem</p>
                                <p className="text-white text-4xl font-bold">{Math.round(bearing)}°</p>
                            </div>
                            {distanceKm && (
                                <div className="bg-white/5 rounded-xl px-6 py-3 border border-white/10">
                                    <p className="text-blue-300 text-xs uppercase tracking-widest mb-0.5">Distance</p>
                                    <p className="text-white text-xl font-semibold">{distanceKm}</p>
                                </div>
                            )}
                        </div>

                        {orientationNote && (
                            <p className="text-slate-400 text-xs text-center mt-6 max-w-xs">{orientationNote}</p>
                        )}
                        {!orientationNote && heading == null && (
                            <p className="text-slate-400 text-xs text-center mt-6 max-w-xs">
                                Showing fixed bearing — point your device north to calibrate.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
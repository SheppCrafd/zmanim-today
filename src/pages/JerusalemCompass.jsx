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
                        {/* Compass SVG */}
                        <div className="mb-8" style={{ filter: 'drop-shadow(0 0 24px rgba(59,130,246,0.3))' }}>
                            <svg width="300" height="300" viewBox="0 0 300 300">
                                <defs>
                                    <radialGradient id="dialGrad" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#1e3a5f" />
                                        <stop offset="100%" stopColor="#0a1628" />
                                    </radialGradient>
                                    <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#f8fafc" />
                                        <stop offset="100%" stopColor="#94a3b8" />
                                    </radialGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3" result="blur" />
                                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                    </filter>
                                </defs>

                                {/* Outer bezel — static */}
                                <circle cx="150" cy="150" r="148" fill="#0f1f35" stroke="#1e3a5f" strokeWidth="2" />
                                <circle cx="150" cy="150" r="143" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" />

                                {/* Rotating dial — spins with device heading */}
                                <g transform={`rotate(${-(heading ?? 0)}, 150, 150)`} style={{ transition: 'transform 0.35s ease-out' }}>
                                    {/* Dial face */}
                                    <circle cx="150" cy="150" r="138" fill="url(#dialGrad)" />

                                    {/* Tick marks */}
                                    {Array.from({ length: 72 }).map((_, i) => {
                                        const angle = i * 5;
                                        const isMajor = i % 18 === 0;
                                        const isMed = i % 9 === 0;
                                        const r1 = isMajor ? 108 : isMed ? 112 : 118;
                                        const r2 = 132;
                                        const rad = (angle - 90) * Math.PI / 180;
                                        const x1 = 150 + r1 * Math.cos(rad);
                                        const y1 = 150 + r1 * Math.sin(rad);
                                        const x2 = 150 + r2 * Math.cos(rad);
                                        const y2 = 150 + r2 * Math.sin(rad);
                                        return (
                                            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                                                stroke={isMajor ? '#60a5fa' : isMed ? '#3b82f6' : '#1e3a5f'}
                                                strokeWidth={isMajor ? 2.5 : isMed ? 1.5 : 1}
                                                strokeLinecap="round"
                                            />
                                        );
                                    })}

                                    {/* Cardinal labels */}
                                    {[['N', 0, '#ef4444'], ['E', 90, '#93c5fd'], ['S', 180, '#93c5fd'], ['W', 270, '#93c5fd']].map(([dir, deg, color]) => {
                                        const rad = (deg - 90) * Math.PI / 180;
                                        const x = 150 + 92 * Math.cos(rad);
                                        const y = 150 + 92 * Math.sin(rad);
                                        return (
                                            <text key={dir} x={x} y={y} textAnchor="middle" dominantBaseline="central"
                                                fill={color} fontSize="16" fontWeight="700" fontFamily="system-ui">
                                                {dir}
                                            </text>
                                        );
                                    })}
                                </g>

                                {/* Fixed needle — always points to Jerusalem (bearing from North) */}
                                <g transform={`rotate(${bearing ?? 0}, 150, 150)`} style={{ transition: 'transform 0.35s ease-out' }}>
                                    {/* Gold tip */}
                                    <polygon points="150,42 143,150 157,150" fill="#f59e0b" filter="url(#glow)" />
                                    <polygon points="150,42 146,100 154,100" fill="#fde68a" />
                                    {/* Blue tail */}
                                    <polygon points="150,258 143,150 157,150" fill="#1d4ed8" />
                                    <polygon points="150,258 146,200 154,200" fill="#3b82f6" />
                                </g>

                                {/* Center hub */}
                                <circle cx="150" cy="150" r="22" fill="#0a1628" stroke="#1e3a5f" strokeWidth="2" />
                                <text x="150" y="150" textAnchor="middle" dominantBaseline="central"
                                    fontSize="18" fill="#60a5fa" opacity="0.85">✡</text>
                                <circle cx="150" cy="150" r="5" fill="url(#centerGrad)" />
                            </svg>
                        </div>

                        {/* Info cards */}
                        <div className="text-center space-y-3 w-full">
                            <div className="flex gap-3 justify-center">
                                <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-sm border border-blue-400/20 flex-1 max-w-[160px]">
                                    <p className="text-blue-300 text-xs uppercase tracking-widest mb-1">Bearing</p>
                                    <p className="text-white text-3xl font-bold">{Math.round(bearing)}°</p>
                                </div>
                                {distanceKm && (
                                    <div className="bg-white/10 rounded-2xl px-6 py-4 backdrop-blur-sm border border-blue-400/20 flex-1 max-w-[160px]">
                                        <p className="text-blue-300 text-xs uppercase tracking-widest mb-1">Distance</p>
                                        <p className="text-white text-3xl font-bold">{distanceKm}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(orientationNote || heading == null) && (
                            <p className="text-slate-500 text-xs text-center mt-6 max-w-xs">
                                {orientationNote || 'Showing fixed bearing — point your device north to calibrate.'}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
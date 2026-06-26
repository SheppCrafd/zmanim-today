import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import NavMenu from '../components/NavMenu';

const JERUSALEM = { lat: 31.778, lon: 35.235 };

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function calcBearing(userLat, userLon) {
  const φ1 = toRad(userLat);
  const φ2 = toRad(JERUSALEM.lat);
  const Δλ = toRad(JERUSALEM.lon - userLon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function calcDistance(userLat, userLon) {
  const R = 6371; // km
  const φ1 = toRad(userLat);
  const φ2 = toRad(JERUSALEM.lat);
  const Δφ = toRad(JERUSALEM.lat - userLat);
  const Δλ = toRad(JERUSALEM.lon - userLon);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distKm;
}

function useLocale() {
  try {
    const locale = navigator.language || 'en-US';
    return locale.startsWith('en') ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

function CompassCanvas({ heading, bearing }) {
  const canvasRef = useRef(null);
  const animHeading = useRef(heading);
  const animFrame = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 10;

    function lerp(a, b, t) {
      let diff = b - a;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return a + diff * t;
    }

    function draw() {
      animHeading.current = lerp(animHeading.current, heading, 0.12);
      const h = animHeading.current;
      const arrowAngle = toRad(bearing - h);

      ctx.clearRect(0, 0, size, size);

      // Outer ring shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.restore();

      // Inner face gradient
      const grad = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R * 0.95);
      grad.addColorStop(0, '#334155');
      grad.addColorStop(1, '#0f172a');
      ctx.beginPath();
      ctx.arc(cx, cy, R - 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer border
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(toRad(-h));

      // Tick marks
      for (let deg = 0; deg < 360; deg += 5) {
        const angle = toRad(deg);
        const isMajor = deg % 90 === 0;
        const isMinor = deg % 15 === 0 && !isMajor;
        const tickLen = isMajor ? 18 : isMinor ? 12 : 7;
        const lineW = isMajor ? 2.5 : isMinor ? 1.5 : 1;
        const color = isMajor ? '#94a3b8' : isMinor ? '#64748b' : '#334155';

        ctx.beginPath();
        ctx.moveTo(Math.sin(angle) * (R - 8), -Math.cos(angle) * (R - 8));
        ctx.lineTo(Math.sin(angle) * (R - 8 - tickLen), -Math.cos(angle) * (R - 8 - tickLen));
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.stroke();
      }

      // Cardinal labels
      const cardinals = [
        { label: 'N', deg: 0, color: '#ef4444', size: 22 },
        { label: 'E', deg: 90, color: '#94a3b8', size: 18 },
        { label: 'S', deg: 180, color: '#94a3b8', size: 18 },
        { label: 'W', deg: 270, color: '#94a3b8', size: 18 },
      ];
      cardinals.forEach(({ label, deg, color, size: fSize }) => {
        const angle = toRad(deg);
        const dist = R - 36;
        ctx.font = `bold ${fSize}px system-ui, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, Math.sin(angle) * dist, -Math.cos(angle) * dist);
      });

      ctx.restore();

      // Jerusalem arrow
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(arrowAngle);

      // Arrow shaft
      const arrowLen = R * 0.6;
      const arrowGrad = ctx.createLinearGradient(0, -arrowLen, 0, arrowLen * 0.2);
      arrowGrad.addColorStop(0, '#fbbf24');
      arrowGrad.addColorStop(0.6, '#d97706');
      arrowGrad.addColorStop(1, '#92400e');

      ctx.beginPath();
      ctx.moveTo(0, -arrowLen);
      ctx.lineTo(10, -arrowLen * 0.35);
      ctx.lineTo(4, -arrowLen * 0.35);
      ctx.lineTo(4, arrowLen * 0.2);
      ctx.lineTo(-4, arrowLen * 0.2);
      ctx.lineTo(-4, -arrowLen * 0.35);
      ctx.lineTo(-10, -arrowLen * 0.35);
      ctx.closePath();
      ctx.fillStyle = arrowGrad;
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glow on arrow tip
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, -arrowLen + 6, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      ctx.restore();

      // Jerusalem label on arrow
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Jerusalem', 0, -arrowLen * 0.65);

      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();

      animFrame.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrame.current);
  }, [heading, bearing]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="w-full max-w-xs mx-auto"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

export default function Compass() {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [heading, setHeading] = useState(0);
  const [orientationSupported, setOrientationSupported] = useState(true);
  const [manualHeading, setManualHeading] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const units = useLocale();
  const watchId = useRef(null);
  const lastUpdate = useRef(0);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access is required to determine the direction and distance to Jerusalem.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Location information is unavailable.');
        } else {
          setLocationError('Location request timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // Device orientation
  const handleOrientation = useCallback((e) => {
    const now = Date.now();
    if (now - lastUpdate.current < 50) return; // throttle to ~20fps
    lastUpdate.current = now;

    if (document.hidden) return;

    let h = null;
    if (e.webkitCompassHeading != null) {
      h = e.webkitCompassHeading; // iOS true north
    } else if (e.alpha != null) {
      h = (360 - e.alpha) % 360; // Android
    }
    if (h != null) setHeading(h);
  }, []);

  useEffect(() => {
    const request = async () => {
      if (typeof DeviceOrientationEvent === 'undefined') {
        setOrientationSupported(false);
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm === 'granted') {
            setPermissionGranted(true);
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            setOrientationSupported(false);
          }
        } catch {
          setOrientationSupported(false);
        }
      } else {
        setPermissionGranted(true);
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    };
    request();
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [handleOrientation]);

  const effectiveHeading = orientationSupported ? heading : manualHeading;

  const bearing = location ? calcBearing(location.lat, location.lon) : 0;
  const distKm = location ? calcDistance(location.lat, location.lon) : null;
  const distDisplay = distKm != null
    ? units === 'imperial'
      ? `${Math.round(distKm * 0.621371).toLocaleString()} miles`
      : `${Math.round(distKm).toLocaleString()} km`
    : null;

  const requestIOSPermission = async () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === 'granted') {
          setOrientationSupported(true);
          setPermissionGranted(true);
          window.addEventListener('deviceorientationabsolute', handleOrientation, true);
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50">
      <NavMenu />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-12">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-1 tracking-tight">Compass to Jerusalem</h1>
          <p className="text-slate-500 text-base">מצפן לירושלים</p>
        </div>

        {/* Location error */}
        {locationError && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{locationError}</p>
          </div>
        )}

        {/* Compass */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-6 mb-6">
          {!location && !locationError && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-slate-500 text-sm">Acquiring location…</p>
            </div>
          )}

          {(location || locationError) && (
            <CompassCanvas heading={effectiveHeading} bearing={location ? bearing : 0} />
          )}

          {/* iOS permission button */}
          {!orientationSupported && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' && !permissionGranted && (
            <div className="mt-4 text-center">
              <Button onClick={requestIOSPermission} className="bg-blue-600 hover:bg-blue-700 text-sm">
                Enable Compass Sensor
              </Button>
            </div>
          )}

          {/* Manual heading slider fallback */}
          {!orientationSupported && (
            <div className="mt-5 px-2">
              <p className="text-xs text-slate-500 mb-2 text-center">Orientation sensor unavailable — rotate manually</p>
              <Slider
                min={0}
                max={359}
                step={1}
                value={[manualHeading]}
                onValueChange={([v]) => setManualHeading(v)}
                className="w-full"
              />
              <p className="text-xs text-slate-400 text-center mt-1">{manualHeading}°</p>
            </div>
          )}
        </div>

        {/* Info panel */}
        {location && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 p-5 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500 flex items-center gap-2"><Navigation className="w-4 h-4" /> Heading</span>
              <span className="font-semibold text-slate-800">{Math.round(effectiveHeading)}°</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500 flex items-center gap-2">🕍 Jerusalem Bearing</span>
              <span className="font-semibold text-amber-600">{Math.round(bearing)}°</span>
            </div>
            <div className="py-2 border-b border-slate-100">
              <p className="text-sm text-slate-700 leading-relaxed">
                Jerusalem is{' '}
                <span className="font-semibold text-amber-600">{distDisplay}</span> away at a bearing of{' '}
                <span className="font-semibold text-amber-600">{Math.round(bearing)}°</span>.
              </p>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Your location</span>
              <span className="text-xs text-slate-400 font-mono">
                {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
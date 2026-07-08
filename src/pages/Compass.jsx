import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import NavMenu from "@/components/NavMenu";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSavedLocation } from "@/hooks/useLocation";

const JERUSALEM = { lat: 31.778, lon: 35.235 };

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function calcBearing(userLat, userLon) {
  const φ1 = toRad(userLat);
  const φ2 = toRad(JERUSALEM.lat);
  const Δλ = toRad(JERUSALEM.lon - userLon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function calcDistance(userLat, userLon) {
  const R = 6371;
  const φ1 = toRad(userLat);
  const φ2 = toRad(JERUSALEM.lat);
  const Δφ = toRad(JERUSALEM.lat - userLat);
  const Δλ = toRad(JERUSALEM.lon - userLon);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useUnits() {
  try {
    return (navigator.language || "en-US").startsWith("en")
      ? "imperial"
      : "metric";
  } catch {
    return "metric";
  }
}

function lerp(a, b, t) {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

function CompassSVG({ heading, bearing }) {
  const animHeading = useRef(heading);
  const animFrame = useRef(null);
  const [displayHeading, setDisplayHeading] = useState(heading);

  useEffect(() => {
    function tick() {
      animHeading.current = lerp(animHeading.current, heading, 0.1);
      setDisplayHeading(animHeading.current);
      animFrame.current = requestAnimationFrame(tick);
    }
    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [heading]);

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const R = 126;

  const ticks = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const isMajor = deg % 30 === 0;
    const len = isMajor ? 14 : 7;
    const rad = toRad(deg);
    const x1 = cx + Math.sin(rad) * R;
    const y1 = cy - Math.cos(rad) * R;
    const x2 = cx + Math.sin(rad) * (R - len);
    const y2 = cy - Math.cos(rad) * (R - len);
    ticks.push(
      <line
        key={deg}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isMajor ? "#475569" : "#cbd5e1"}
        strokeWidth={isMajor ? 1.5 : 1}
        strokeLinecap="round"
      />,
    );
  }

  const cardinals = [
    { label: "N", deg: 0, color: "#2563eb", fontWeight: "700", fontSize: 18 },
    { label: "E", deg: 90, color: "#475569", fontWeight: "600", fontSize: 15 },
    { label: "S", deg: 180, color: "#475569", fontWeight: "600", fontSize: 15 },
    { label: "W", deg: 270, color: "#475569", fontWeight: "600", fontSize: 15 },
  ];

  const cardinalElements = cardinals.map(
    ({ label, deg, color, fontWeight, fontSize }) => {
      const rad = toRad(deg);
      const dist = R - 28;
      const x = cx + Math.sin(rad) * dist;
      const y = cy - Math.cos(rad) * dist;
      return (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {label}
        </text>
      );
    },
  );

  // Arrow pointing to Jerusalem (relative to compass, accounts for heading)
  const arrowAngle = bearing - displayHeading;
  const arrowRad = toRad(arrowAngle);
  const arrowLen = 80;
  const arrowTip = {
    x: cx + Math.sin(arrowRad) * arrowLen,
    y: cy - Math.cos(arrowRad) * arrowLen,
  };
  const arrowBase = {
    x: cx + Math.sin(arrowRad) * -28,
    y: cy - Math.cos(arrowRad) * -28,
  };
  // Perpendicular for chevron wings
  const perpRad = arrowRad + Math.PI / 2;
  const wingW = 9;
  const wingBackOffset = 18;
  const midPoint = {
    x: cx + Math.sin(arrowRad) * (arrowLen - wingBackOffset),
    y: cy - Math.cos(arrowRad) * (arrowLen - wingBackOffset),
  };
  const leftWing = {
    x: midPoint.x + Math.sin(perpRad) * wingW,
    y: midPoint.y - Math.cos(perpRad) * wingW,
  };
  const rightWing = {
    x: midPoint.x - Math.sin(perpRad) * wingW,
    y: midPoint.y + Math.cos(perpRad) * wingW,
  };

  // Label position: slightly beyond arrowhead
  const labelDist = arrowLen + 16;
  const labelPos = {
    x: cx + Math.sin(arrowRad) * labelDist,
    y: cy - Math.cos(arrowRad) * labelDist,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[280px] mx-auto"
      style={{ overflow: "visible" }}
    >
      {/* Compass ring */}
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="var(--compass-bg, white)"
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />

      {/* Rotating group: ticks + cardinals */}
      <g transform={`rotate(${-displayHeading}, ${cx}, ${cy})`}>
        {ticks}
        {cardinalElements}
      </g>

      {/* Jerusalem arrow — fixed in screen space, rotates based on bearing - heading */}
      <g>
        {/* Shaft */}
        <line
          x1={arrowBase.x}
          y1={arrowBase.y}
          x2={midPoint.x}
          y2={midPoint.y}
          stroke="#d97706"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Chevron head */}
        <polyline
          points={`${leftWing.x},${leftWing.y} ${arrowTip.x},${arrowTip.y} ${rightWing.x},${rightWing.y}`}
          fill="none"
          stroke="#d97706"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Label */}
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#d97706"
          fontSize="10"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Jerusalem
        </text>
      </g>

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="4" fill="#d97706" />
    </svg>
  );
}

export default function Compass() {
  const { location: savedLocation, error: locationError } = useSavedLocation();
  const location = savedLocation
    ? { lat: savedLocation.latitude, lon: savedLocation.longitude }
    : null;
  const [heading, setHeading] = useState(0);
  const [orientationSupported, setOrientationSupported] = useState(true);
  const [manualHeading, setManualHeading] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const units = useUnits();
  const lastUpdate = useRef(0);

  const handleOrientation = useCallback((e) => {
    const now = Date.now();
    if (now - lastUpdate.current < 50 || document.hidden) return;
    lastUpdate.current = now;
    let h =
      e.webkitCompassHeading != null
        ? e.webkitCompassHeading
        : e.alpha != null
          ? (360 - e.alpha) % 360
          : null;
    if (h != null) setHeading(h);
  }, []);

  useEffect(() => {
    const setup = async () => {
      if (typeof DeviceOrientationEvent === "undefined") {
        setOrientationSupported(false);
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm === "granted") {
            setPermissionGranted(true);
            window.addEventListener(
              "deviceorientationabsolute",
              handleOrientation,
              true,
            );
            window.addEventListener(
              "deviceorientation",
              handleOrientation,
              true,
            );
          } else {
            setOrientationSupported(false);
          }
        } catch {
          setOrientationSupported(false);
        }
      } else {
        setPermissionGranted(true);
        window.addEventListener(
          "deviceorientationabsolute",
          handleOrientation,
          true,
        );
        window.addEventListener("deviceorientation", handleOrientation, true);
      }
    };
    setup();
    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true,
      );
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [handleOrientation]);

  const requestIOSPermission = async () => {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === "granted") {
        setOrientationSupported(true);
        setPermissionGranted(true);
        window.addEventListener(
          "deviceorientationabsolute",
          handleOrientation,
          true,
        );
        window.addEventListener("deviceorientation", handleOrientation, true);
      }
    } catch {
      /* ignore */
    }
  };

  const effectiveHeading = orientationSupported ? heading : manualHeading;
  const bearing = location ? calcBearing(location.lat, location.lon) : 0;
  const distKm = location ? calcDistance(location.lat, location.lon) : null;
  const distDisplay =
    distKm != null
      ? units === "imperial"
        ? `${Math.round(distKm * 0.621371).toLocaleString()} miles`
        : `${Math.round(distKm).toLocaleString()} km`
      : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-sm mx-auto px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center mb-8 min-h-[72px]">
          <div className="shrink-0">
            <NavMenu />
          </div>
          <div className="flex-1 text-center px-2">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
              Compass to
              <br />
              Jerusalem
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              מצפן לירושלים
            </p>
          </div>
          <div className="shrink-0 w-9"></div>
        </div>

        {/* Location error */}
        {locationError && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {locationError}
            </p>
          </div>
        )}

        {/* Compass */}
        <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-5 flex flex-col items-center">
          {!location && !locationError ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm">Acquiring location…</p>
            </div>
          ) : (
            <CompassSVG heading={effectiveHeading} bearing={bearing} />
          )}

          {/* iOS sensor permission */}
          {!orientationSupported &&
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function" &&
            !permissionGranted && (
              <Button
                onClick={requestIOSPermission}
                size="sm"
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Enable Compass Sensor
              </Button>
            )}

          {/* Manual heading fallback */}
          {!orientationSupported && (
            <div className="mt-5 w-full px-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 text-center">
                Rotate manually — sensor unavailable
              </p>
              <Slider
                min={0}
                max={359}
                step={1}
                value={[manualHeading]}
                onValueChange={([v]) => setManualHeading(v)}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
                {manualHeading}°
              </p>
            </div>
          )}
        </div>

        {/* Info cards */}
        {location && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                  Heading
                </p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {Math.round(effectiveHeading)}°
                </p>
              </div>
              <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                  Bearing
                </p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {Math.round(bearing)}°
                </p>
              </div>
              <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                  Distance
                </p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  {distDisplay}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 mb-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                Jerusalem is{" "}
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {distDisplay}
                </span>{" "}
                away at a bearing of{" "}
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  {Math.round(bearing)}°
                </span>
                .
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <p className="text-xs text-slate-400 font-mono">
                {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

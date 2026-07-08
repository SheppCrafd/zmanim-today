import React, { useRef, useState, useEffect } from "react";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import { Link } from "react-router-dom";

const JERUSALEM = { lat: 31.778, lon: 35.235 };

function toRad(d) {
  return (d * Math.PI) / 180;
}
function toDeg(r) {
  return (r * 180) / Math.PI;
}

function bearingTo(lat, lon) {
  const φ1 = toRad(lat),
    φ2 = toRad(JERUSALEM.lat);
  const Δλ = toRad(JERUSALEM.lon - lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingLabel(b) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(b / 45) % 8];
}

export default function MiniCompass({ location }) {
  const { heading } = useCompassHeading();
  const bearing = location
    ? bearingTo(location.latitude, location.longitude)
    : 0;
  const arrowAngle = bearing - heading;
  const arrowRad = toRad(arrowAngle);

  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const R = 28;
  const tipDist = 22;
  const baseDist = -12;

  const tip = {
    x: cx + Math.sin(arrowRad) * tipDist,
    y: cy - Math.cos(arrowRad) * tipDist,
  };
  const base = {
    x: cx + Math.sin(arrowRad) * baseDist,
    y: cy - Math.cos(arrowRad) * baseDist,
  };
  const perp = arrowRad + Math.PI / 2;
  const wingBack = {
    x: cx + Math.sin(arrowRad) * (tipDist - 10),
    y: cy - Math.cos(arrowRad) * (tipDist - 10),
  };
  const lw = {
    x: wingBack.x + Math.sin(perp) * 6,
    y: wingBack.y - Math.cos(perp) * 6,
  };
  const rw = {
    x: wingBack.x - Math.sin(perp) * 6,
    y: wingBack.y + Math.cos(perp) * 6,
  };

  return (
    <Link to="/Compass" className="block">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
        >
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="white"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          {/* Arrow */}
          <line
            x1={base.x}
            y1={base.y}
            x2={wingBack.x}
            y2={wingBack.y}
            stroke="#d97706"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polyline
            points={`${lw.x},${lw.y} ${tip.x},${tip.y} ${rw.x},${rw.y}`}
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={cx} cy={cy} r="3" fill="#d97706" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 mb-0.5">Direction to</p>
          <p className="font-semibold text-slate-800 text-sm">Jerusalem</p>
          <p className="text-amber-600 font-bold text-lg leading-tight">
            {Math.round(bearing)}°{" "}
            <span className="text-sm font-medium">{bearingLabel(bearing)}</span>
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 12l4-4-4-4"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

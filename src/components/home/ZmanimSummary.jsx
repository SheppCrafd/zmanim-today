import React from "react";
import { formatTime } from "@/lib/timeUtils";
import { ZMANIM_BY_ID } from "@/lib/zmanimSchema";

export default function ZmanimSummary({ zmanim, enabledIds, use24Hour }) {
  if (!zmanim?.zmanim) return null;

  const items = enabledIds
    .map((id) => {
      const meta = ZMANIM_BY_ID[id];
      if (!meta) return null;
      const raw = zmanim.zmanim[id];
      if (!raw) return null;
      return { ...meta, value: formatTime(raw, use24Hour, zmanim.timezone) };
    })
    .filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`flex items-center justify-between px-4 py-3 ${i < items.length - 1 ? "border-b border-slate-100" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">{item.icon}</span>
            <span className="text-sm font-medium text-slate-700">
              {item.label}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-800 tabular-nums">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
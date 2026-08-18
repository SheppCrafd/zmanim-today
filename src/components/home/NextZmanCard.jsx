import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { parseTimeStr, formatCountdown, formatTime } from "@/lib/timeUtils";
import { ZMANIM_BY_ID, ZMANIM_ORDERED_KEYS, getZmanLabel } from "@/lib/zmanimSchema";

export default function NextZmanCard({ zmanim, use24Hour }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!zmanim?.zmanim) return null;

  let next = null;
  for (const key of ZMANIM_ORDERED_KEYS) {
    const val = zmanim.zmanim[key];
    if (!val) continue;
    const t = parseTimeStr(val);
    if (t && t > now) {
      next = { key, val, time: t };
      break;
    }
  }

  if (!next) return null;

  const meta = ZMANIM_BY_ID[next.key] || { label: next.key, icon: "⏱" };
  const ms = next.time - now;
  const countdown = formatCountdown(ms);
  const urgent = ms < 30 * 60 * 1000;

  return (
    <div
      className={`rounded-xl border p-4 ${
        urgent
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
          : "bg-primary/5 border-primary/15"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Timer
          className={`w-4 h-4 ${urgent ? "text-amber-500" : "text-primary"}`}
        />
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${urgent ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}
        >
          Next Zman
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-foreground">
            {meta.icon} {getZmanLabel(next.key, now.getDay())}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatTime(next.val, use24Hour, zmanim.timezone)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-2xl font-bold tabular-nums ${urgent ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}
          >
            {countdown}
          </p>
          <p className="text-xs text-muted-foreground">
            remaining
          </p>
        </div>
      </div>
    </div>
  );
}
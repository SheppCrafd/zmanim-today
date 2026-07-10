import React, { useState } from "react";
import { Bell, BellRing, Check, Wifi } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePushReminders } from "@/hooks/usePushReminders";

const STORAGE_KEY = "zmanim_reminders";

const ALL_ZMANIM = [
  {
    key: "alot_hashachar",
    label: "Alot Hashachar",
    emoji: "🌑",
    description: "Dawn",
  },
  {
    key: "misheyakir",
    label: "Misheyakir",
    emoji: "🌒",
    description: "Earliest Tallit & Tefillin",
  },
  {
    key: "sunrise",
    label: "Sunrise",
    emoji: "🌅",
    description: "HaNetz HaChamah",
  },
  {
    key: "sof_zman_shma_gra",
    label: "Sof Zman Shema (GRA)",
    emoji: "📖",
    description: "Latest Shema",
  },
  {
    key: "sof_zman_shma_mga",
    label: "Sof Zman Shema (MGA)",
    emoji: "📖",
    description: "Latest Shema (stringent)",
  },
  {
    key: "sof_zman_tefillah_gra",
    label: "Shacharit Latest (GRA)",
    emoji: "🌄",
    description: "Latest Shemoneh Esrei",
  },
  {
    key: "sof_zman_tefillah_mga",
    label: "Shacharit Latest (MGA)",
    emoji: "🌄",
    description: "Latest Shemoneh Esrei (stringent)",
  },
  {
    key: "chatzot",
    label: "Chatzot / Mussaf Latest",
    emoji: "☀️",
    description: "Halachic Noon",
  },
  {
    key: "mincha_gedola",
    label: "Mincha Gedola",
    emoji: "🌤️",
    description: "Earliest Mincha",
  },
  {
    key: "mincha_ketana",
    label: "Mincha Ketana",
    emoji: "🌤️",
    description: "Preferred Mincha time",
  },
  {
    key: "plag_hamincha",
    label: "Plag HaMincha",
    emoji: "🌥️",
    description: "Earliest candle lighting",
  },
  {
    key: "candle_lighting",
    label: "Candle Lighting",
    emoji: "🕯️",
    description: "18 min before sunset",
  },
  {
    key: "sunset",
    label: "Sunset",
    emoji: "🌇",
    description: "Shkiyas HaChamah",
  },
  {
    key: "tzait_hakochavim",
    label: "Ma'ariv / Tzait HaKochavim",
    emoji: "🌙",
    description: "Nightfall – 3 stars",
  },
  {
    key: "tzait_72",
    label: "Havdalah / Tzait (72 min)",
    emoji: "🌟",
    description: "Rabbeinu Tam nightfall",
  },
  {
    key: "chatzot_laila",
    label: "Chatzot Laila",
    emoji: "🌃",
    description: "Halachic Midnight",
  },
];

const MINUTES_OPTIONS = [5, 10, 15, 30];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

// Detect if running as installed PWA (standalone mode)
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// Detect iOS
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function ZmanimRemindersPanel({ zmanimData, currentDate }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const iosNotStandalone = isIOS() && !isStandalone();
  const { status: pushStatus, error: pushError } = usePushReminders({
    prefs,
    notifPermission,
  });

  const date = currentDate || new Date();
  const isToday = new Date().toDateString() === new Date(date).toDateString();
  const hasEnabled = Object.values(prefs).some((p) => p?.enabled);



  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const toggleReminder = (key) => {
    setPrefs((prev) => {
      const current = prev[key] || { enabled: false, minutesBefore: 10 };
      const updated = {
        ...prev,
        [key]: { ...current, enabled: !current.enabled },
      };
      savePrefs(updated);
      return updated;
    });
  };

  const setMinutes = (key, minutes) => {
    setPrefs((prev) => {
      const current = prev[key] || { enabled: true, minutesBefore: 10 };
      const updated = {
        ...prev,
        [key]: { ...current, minutesBefore: minutes },
      };
      savePrefs(updated);
      return updated;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-lg bg-white/90 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors relative"
          title="Set reminders"
        >
          {hasEnabled ? (
            <BellRing className="w-5 h-5 text-blue-600" />
          ) : (
            <Bell className="w-5 h-5 text-slate-700" />
          )}
          {hasEnabled && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" /> Zmanim Reminders
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {iosNotStandalone ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="text-blue-900 font-semibold mb-1">
                📲 Add to Home Screen
              </p>
              <p className="text-blue-800 text-xs">
                To enable reminders on iOS, tap the <strong>Share</strong>{" "}
                button in Safari, then choose{" "}
                <strong>"Add to Home Screen"</strong>. Open the app from there
                to unlock notifications.
              </p>
            </div>
          ) : (
            <>
              {notifPermission !== "granted" &&
                notifPermission !== "denied" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <p className="text-amber-800 mb-2">
                      Enable notifications to receive reminders.
                    </p>
                    <button
                      onClick={requestPermission}
                      className="w-full py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
                    >
                      Enable Notifications
                    </button>
                  </div>
                )}
              {notifPermission === "denied" && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 text-center">
                  Notifications are blocked. Please allow them in your browser
                  settings.
                </p>
              )}
            </>
          )}

          {!isToday && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 text-center">
              Reminders only fire for today's zmanim.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Toggle any zman to get notified before it starts, then choose your
            lead time.
          </p>

          <div className="space-y-2">
            {ALL_ZMANIM.map(({ key, label, emoji, description }) => {
              const pref = prefs[key] || { enabled: false, minutesBefore: 10 };
              const zmanTime = zmanimData?.zmanim?.[key];
              const todayDow = new Date().getDay();
              const dayNote =
                key === "candle_lighting"
                  ? "(Fridays only)"
                  : key === "tzait_72"
                    ? "(Saturdays only)"
                    : null;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 transition-colors ${
                    pref.enabled
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleReminder(key)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <span className="text-lg leading-none">{emoji}</span>
                      <div>
                        <p
                          className={`text-sm font-medium leading-tight ${pref.enabled ? "text-blue-800" : "text-slate-700"}`}
                        >
                          {label}{" "}
                          {dayNote && (
                            <span className="text-xs font-normal text-slate-400">
                              {dayNote}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {zmanTime ? zmanTime : description}
                        </p>
                      </div>
                    </button>

                    <div
                      onClick={() => toggleReminder(key)}
                      className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ml-2 ${
                        pref.enabled ? "bg-blue-500" : "bg-slate-200"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${
                          pref.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </div>

                  {pref.enabled && (
                    <div className="mt-2 flex gap-1">
                      {MINUTES_OPTIONS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMinutes(key, m)}
                          className={`flex-1 text-xs py-1 rounded-lg transition-colors ${
                            pref.minutesBefore === m
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {notifPermission === "granted" && hasEnabled && isToday && (
            <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2 text-center flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Reminders are active
            </p>
          )}
          {pushStatus === "subscribed" && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 text-center flex items-center justify-center gap-1">
              <Wifi className="w-3 h-3" /> Background delivery on — works even when the app is closed
            </p>
          )}
          {pushError && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 text-center">
              {pushError}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
import React, { useState } from "react";
import {
  MapPin,
  Loader2,
  Search,
  ChevronRight,
  AlertCircle,
  Settings,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useSavedLocation } from "@/hooks/useLocation";
import { useZmanim } from "@/hooks/useZmanim";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import MiniCompass from "@/components/home/MiniCompass";
import NextZmanCard from "@/components/home/NextZmanCard";
import ZmanimSummary from "@/components/home/ZmanimSummary";
import NavMenu from "@/components/NavMenu";
import { printZmanim } from "@/lib/printZmanim";
import ZmanimRemindersPanel from "@/components/zmanim/ZmanimRemindersPanel";
import { formatTime } from "@/lib/timeUtils";

function LocationLabel({ location }) {
  if (!location) return null;
  const parts = [location.city, location.state, location.country].filter(
    Boolean,
  );
  if (parts.length > 0) return <span>{parts.join(", ")}</span>;
  return (
    <span>
      {location.latitude?.toFixed(3)}°, {location.longitude?.toFixed(3)}°
    </span>
  );
}

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const isFriday = today.getDay() === 5;

export default function Home() {
  const {
    location,
    loading: locLoading,
    error: locError,
    detectGPS,
    searchLocation,
    clearLocation,
  } = useSavedLocation();
  const { zmanim, loading: zmanimLoading } = useZmanim(location);
  const { zmanim: tomorrowZmanim } = useZmanim(location, tomorrow);
  const { prefs } = useDashboardPrefs();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const displayLocation = location;

  const enabledZmanimIds = prefs.items
    .filter((i) => i.enabled && !["compass", "next_zman"].includes(i.id))
    .map((i) => i.id);
  const showCompass = prefs.items.find((i) => i.id === "compass")?.enabled;
  const showNextZman = prefs.items.find((i) => i.id === "next_zman")?.enabled;

  const locationLabel = displayLocation
    ? [displayLocation.city, displayLocation.state, displayLocation.country]
        .filter(Boolean)
        .join(", ") ||
      `${displayLocation.latitude?.toFixed(3)}°, ${displayLocation.longitude?.toFixed(3)}°`
    : "";

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await searchLocation(searchQuery);
    setSearchQuery("");
    setShowSearch(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center mb-6 min-h-[56px]">
          <div className="shrink-0">
            <NavMenu />
          </div>
          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Zmanim Today
            </h1>
            <p className="text-slate-500 text-sm">זמני היום</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <ZmanimRemindersPanel zmanimData={zmanim} currentDate={today} />
            <Link to="/Settings">
              <button className="p-2 rounded-lg bg-white/90 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                <Settings className="w-5 h-5 text-slate-700" />
              </button>
            </Link>
          </div>
        </div>

        {/* Location */}
        {location ? (
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-sm font-medium text-slate-700 flex-1">
              <LocationLabel location={displayLocation} />
            </p>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mb-6">
            {locError && (
              <div className="flex gap-2 items-start mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{locError}</p>
              </div>
            )}
            <p className="text-sm text-slate-500 mb-3">
              Set your location to get prayer times.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={detectGPS}
                disabled={locLoading}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                {locLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                <span className="ml-1">
                  {locLoading ? "Detecting…" : "Use My Location"}
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Search box */}
        {showSearch && (
          <div className="mb-6 space-y-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                autoFocus
                placeholder="e.g. Jerusalem, New York, NY…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm"
                disabled={locLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={locLoading || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {locLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowSearch(false)}
              >
                ✕
              </Button>
            </form>
          </div>
        )}

        {location && (
          <div className="space-y-3">
            {/* Mini Compass */}
            {showCompass && <MiniCompass location={location} />}

            {/* Zmanim loading */}
            {zmanimLoading && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <p className="text-sm text-slate-500">
                  Calculating prayer times…
                </p>
              </div>
            )}

            {/* Next Zman */}
            {showNextZman && zmanim && !zmanimLoading && (
              <NextZmanCard zmanim={zmanim} use24Hour={prefs.use24Hour} />
            )}

            {/* Tomorrow's Havdalah (Fridays only) */}
            {isFriday &&
              (tomorrowZmanim?.zmanim?.havdalah ||
                tomorrowZmanim?.zmanim?.tzait_hakochavim) && (
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base">🕍</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        Tomorrow's Havdalah
                      </p>
                      <p className="text-xs text-slate-400">Motzei Shabbat</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">
                    {formatTime(
                      tomorrowZmanim.zmanim.havdalah ||
                        tomorrowZmanim.zmanim.tzait_hakochavim,
                      prefs.use24Hour,
                      tomorrowZmanim.timezone,
                    )}
                  </span>
                </div>
              )}

            {/* Zmanim Summary */}
            {zmanim && !zmanimLoading && enabledZmanimIds.length > 0 && (
              <ZmanimSummary
                zmanim={zmanim}
                enabledIds={enabledZmanimIds}
                use24Hour={prefs.use24Hour}
              />
            )}

            {/* Print buttons */}
            {zmanim && !zmanimLoading && (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    printZmanim({
                      zmanimData: zmanim,
                      date: today,
                      locationLabel,
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Print Today's Zmanim
                </button>
                {tomorrowZmanim && (
                  <button
                    onClick={() =>
                      printZmanim({
                        zmanimData: tomorrowZmanim,
                        date: tomorrow,
                        locationLabel,
                      })
                    }
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    Print Tomorrow's Zmanim
                  </button>
                )}
              </div>
            )}

            {/* Link to full zmanim */}
            {zmanim && !zmanimLoading && (
              <Link to="/Zmanim">
                <div className="flex items-center justify-center gap-1.5 py-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View full zmanim list
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
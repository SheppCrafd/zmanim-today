import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Calendar as CalendarIcon,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import ZmanimCard from "../components/zmanim/ZmanimCard";
import LocationDisplay from "../components/zmanim/LocationDisplay";
import { getHebrewDate } from "../lib/hebrewDate";
import { useSavedLocation } from "@/hooks/useLocation";
import { useZmanim } from "@/hooks/useZmanim";
import PageHeader from "@/components/PageHeader";
import { printZmanim } from "@/lib/printZmanim";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { ZMANIM_GROUPS, getGroupEntries } from "@/lib/zmanimSchema";

export default function Zmanim() {
  const {
    location,
    loading: gpsLoading,
    detectGPS,
    searchLocation: searchSavedLocation,
    clearLocation,
  } = useSavedLocation();
  const { prefs } = useDashboardPrefs();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [manualLocation, setManualLocation] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [hebrewInfo, setHebrewInfo] = useState(null);

  // Shared with Home's dashboard (same sessionStorage cache, keyed by
  // lat/lon/date/tzid) — opening today's zmanim from Home is instant instead
  // of re-fetching and waiting through a debounce for data Home already has.
  const {
    zmanim,
    loading: calculating,
    error,
    refetch,
  } = useZmanim(location, currentDate);

  useEffect(() => {
    getHebrewDate(currentDate)
      .then(setHebrewInfo)
      .catch(() => setHebrewInfo(null));
  }, [currentDate]);

  const getLocation = () => {
    detectGPS();
  };

  const handleManualLocation = async (e) => {
    e.preventDefault();
    if (!manualLocation.trim()) return;
    setSearchingLocation(true);
    await searchSavedLocation(manualLocation);
    setManualLocation("");
    setSearchingLocation(false);
  };

  const handleRefresh = () => {
    setCurrentDate(new Date());
    refetch();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-8 md:px-8">
        <PageHeader title="Zmanim" subtitle="זמני היום" />

        {/* Location Search */}
        {!location && (
          <Card className="mb-6 border border-border shadow-sm bg-card">
            <CardContent className="p-6">
              <form onSubmit={handleManualLocation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <div className="flex-1 border-t border-border"></div>
                  <span className="text-sm text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border"></div>
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
                <p className="text-sm text-destructive mt-3 text-center">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {!location && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            Enter a city or address to get accurate zmanim for your location
          </div>
        )}

        {/* Location & Date Card */}
        {location && (
          <Card className="mb-6 border border-border shadow-sm bg-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <LocationDisplay location={location} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearLocation();
                    setManualLocation("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Select Date
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                      disabled={calculating}
                    >
                      Today
                    </Button>
                    {zmanim && !calculating && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const locLabel = location
                            ? [location.city, location.state, location.country]
                                .filter(Boolean)
                                .join(", ") ||
                              `${location.latitude?.toFixed(3)}°, ${location.longitude?.toFixed(3)}°`
                            : "";
                          printZmanim({
                            zmanimData: zmanim,
                            date: currentDate,
                            locationLabel: locLabel,
                            hebrewInfo,
                            timezone: zmanim.timezone,
                          });
                        }}
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
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${calculating ? "animate-spin" : ""}`}
                      />
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
                        {format(currentDate, "EEEE, MMMM d, yyyy")}
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
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">
                      Hebrew Date
                    </span>
                    <div className="text-right">
                      <div
                        className="font-display font-semibold text-foreground text-lg leading-tight"
                        dir="rtl"
                      >
                        {hebrewInfo.hebrew_date}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {hebrewInfo.hebrew_date_transliterated}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">Day</span>
                    <div className="text-right">
                      <div className="font-semibold text-foreground" dir="rtl">
                        {hebrewInfo.day_of_week_hebrew}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {hebrewInfo.day_of_week_transliterated}
                      </div>
                    </div>
                  </div>
                  {hebrewInfo.parsha && (
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-sm text-muted-foreground shrink-0">
                        Parsha
                      </span>
                      <div className="text-right">
                        {hebrewInfo.parsha_hebrew && (
                          <div
                            className="font-semibold text-primary"
                            dir="rtl"
                          >
                            {hebrewInfo.parsha_hebrew}
                          </div>
                        )}
                        <div className="text-sm text-primary">
                          {hebrewInfo.parsha}
                        </div>
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
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-foreground">Calculating zmanim...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !zmanim && location && (
          <Card className="shadow-sm border-0 bg-destructive/10">
            <CardContent className="py-6 text-center">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={handleRefresh}
                variant="destructive"
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Zmanim Display */}
        {location && zmanim && !calculating && (
          <div className="space-y-4">
            {ZMANIM_GROUPS.map((group) => {
              const entries = getGroupEntries(
                group.id,
                zmanim.zmanim,
                currentDate.getDay(),
              );
              if (!entries.length) return null;
              return (
                <ZmanimCard
                  key={group.id}
                  title={group.title}
                  icon={group.icon}
                  color={group.color}
                  use24Hour={prefs.use24Hour}
                  timezone={zmanim.timezone}
                  times={entries.map((e) => ({
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
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Times calculated based on your GPS location</p>
          {zmanim?.timezone && (
            <p className="mt-1">Timezone: {zmanim.timezone}</p>
          )}
          <p className="mt-2">
            Times computed via{" "}
            <a
              href="https://www.hebcal.com/home/195/zmanim-halachic-times-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Hebcal&apos;s zmanim API
            </a>
            . See our{" "}
            <a
              href="https://zmanimtoday.mintlify.app/technical/zman-calculations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              zman calculation methodology
            </a>{" "}
            for the exact assumptions used.
          </p>
          <p className="mt-2 max-w-md mx-auto">
            Times are computed from Hebcal&apos;s published formulas under the
            assumptions described above. If these don&apos;t match your
            community&apos;s custom, or you have a halachic question, consult
            your rabbi.
          </p>
        </div>
      </div>
    </div>
  );
}
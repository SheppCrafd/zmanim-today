import { useState, useEffect } from "react";

const LOC_KEY = "zmanim_saved_location";

// BigDataCloud returns verbose ISO country names; normalize to friendly names
function cleanCountry(name) {
  if (!name) return "";
  const map = {
    "United States of America (the)": "United States",
    "United Kingdom of Great Britain and Northern Ireland (the)":
      "United Kingdom",
    "Russian Federation (the)": "Russia",
    "Netherlands (the)": "Netherlands",
    "Korea (the Republic of)": "South Korea",
    "Iran (Islamic Republic of)": "Iran",
  };
  return map[name] || name.replace(" (the)", "");
}

// US state names — when a search query matches one, prefer the state-level
// result over a city that happens to share the name (e.g. "California" → the
// state of California, not California, MO).
const US_STATES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota",
  "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
  "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
  "virginia", "washington", "west virginia", "wisconsin", "wyoming",
  "district of columbia", "washington dc",
]);

export function useSavedLocation() {
  const [location, setLocationState] = useState(() => {
    try {
      const raw = localStorage.getItem(LOC_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveLocation = (loc) => {
    setLocationState(loc);
    try {
      localStorage.setItem(LOC_KEY, JSON.stringify(loc));
    } catch {
      /* ignore */
    }
  };

  const clearLocation = () => {
    setLocationState(null);
    try {
      localStorage.removeItem(LOC_KEY);
    } catch {
      /* ignore */
    }
  };

  const detectGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    setError(null);

    // Hard timeout fallback — in case the browser never calls success or error
    const hardTimeout = setTimeout(() => {
      setLoading(false);
      const saved = (() => {
        try {
          return JSON.parse(localStorage.getItem(LOC_KEY));
        } catch {
          return null;
        }
      })();
      if (!saved) setError("Location timed out. Please search manually.");
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(hardTimeout);
        // Device timezone matches the GPS location (user is physically here)
        const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: deviceTz,
        };
        saveLocation(loc);
        // Reverse-geocode coordinates to city/state/country (no LLM)
        fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.latitude}&longitude=${loc.longitude}&localityLanguage=en`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((geo) => {
            if (geo)
              saveLocation({
                ...loc,
                city: geo.city || geo.locality || "",
                state: geo.principalSubdivision || "",
                country: cleanCountry(geo.countryName),
              });
          })
          .catch(() => {
            /* keep raw coords */
          })
          .finally(() => setLoading(false));
      },
      (err) => {
        clearTimeout(hardTimeout);
        const msgs = {
          1: "Location access denied. Please search for your city manually.",
          2: "Location unavailable. Please search manually.",
          3: "Location request timed out. Please search manually.",
        };
        setError(msgs[err.code] || "Unable to get location.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const searchLocation = async (query) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`,
      );
      if (!resp.ok) throw new Error("Geocoding failed");
      const data = await resp.json();
      const results = data?.results || [];
      if (!results.length) throw new Error("No coordinates");

      // If the query matches a US state name, prefer the state-level record
      // (feature_code "ADM1") instead of a same-named city.
      let r = results[0];
      if (US_STATES.has(query.trim().toLowerCase())) {
        r =
          results.find(
            (res) =>
              res.feature_code === "ADM1" &&
              (res.country || "").toLowerCase().includes("united states"),
          ) || r;
      }
      const isState = r.feature_code === "ADM1";
      saveLocation({
        latitude: r.latitude,
        longitude: r.longitude,
        city: isState ? "" : r.name || "",
        state: r.admin1 || (isState ? r.name : ""),
        country: r.country || "",
        timezone:
          r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch {
      setError(`Could not find "${query}".`);
    } finally {
      setLoading(false);
    }
  };

  // Auto reverse-geocode when a saved location lacks a city name (e.g. raw coords)
  useEffect(() => {
    if (!location || location.city || !location.latitude) return;
    let cancelled = false;
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=en`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (cancelled || !geo) return;
        saveLocation({
          ...location,
          city: geo.city || geo.locality || "",
          state: geo.principalSubdivision || "",
          country: cleanCountry(geo.countryName),
        });
      })
      .catch(() => {
        /* keep raw coords */
      });
    return () => {
      cancelled = true;
    };
  }, [location?.latitude, location?.longitude]);

  return { location, loading, error, detectGPS, searchLocation, clearLocation };
}
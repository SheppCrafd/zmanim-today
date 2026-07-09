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

// US state name → centroid {lat, lng, tz}. Open-Meteo's geocoding database does
// not surface state-level (ADM1) records, so a bare state-name query resolves
// to a same-named city or country (e.g. "California" → California, MO; "Georgia"
// → the country). When a query matches a state name we use these coordinates
// directly instead of hitting the API.
const US_STATES = {
  alabama: { lat: 32.8, lng: -86.8, tz: "America/Chicago" },
  alaska: { lat: 61.4, lng: -149.4, tz: "America/Anchorage" },
  arizona: { lat: 34.2, lng: -111.6, tz: "America/Phoenix" },
  arkansas: { lat: 34.8, lng: -91.4, tz: "America/Chicago" },
  california: { lat: 36.8, lng: -119.4, tz: "America/Los_Angeles" },
  colorado: { lat: 39.6, lng: -105.8, tz: "America/Denver" },
  connecticut: { lat: 41.6, lng: -73.1, tz: "America/New_York" },
  delaware: { lat: 38.9, lng: -75.5, tz: "America/New_York" },
  "district of columbia": { lat: 38.9, lng: -77.0, tz: "America/New_York" },
  "washington dc": { lat: 38.9, lng: -77.0, tz: "America/New_York" },
  florida: { lat: 28.0, lng: -81.8, tz: "America/New_York" },
  georgia: { lat: 33.0, lng: -83.6, tz: "America/New_York" },
  hawaii: { lat: 20.8, lng: -156.3, tz: "Pacific/Honolulu" },
  idaho: { lat: 44.2, lng: -114.5, tz: "America/Boise" },
  illinois: { lat: 40.0, lng: -89.0, tz: "America/Chicago" },
  indiana: { lat: 39.9, lng: -86.3, tz: "America/Indiana/Indianapolis" },
  iowa: { lat: 42.0, lng: -93.6, tz: "America/Chicago" },
  kansas: { lat: 38.5, lng: -98.0, tz: "America/Chicago" },
  kentucky: { lat: 37.7, lng: -84.7, tz: "America/New_York" },
  louisiana: { lat: 31.0, lng: -92.0, tz: "America/Chicago" },
  maine: { lat: 45.4, lng: -69.0, tz: "America/New_York" },
  maryland: { lat: 39.1, lng: -77.2, tz: "America/New_York" },
  massachusetts: { lat: 42.3, lng: -71.8, tz: "America/New_York" },
  michigan: { lat: 44.3, lng: -85.6, tz: "America/Detroit" },
  minnesota: { lat: 46.4, lng: -94.3, tz: "America/Chicago" },
  mississippi: { lat: 32.7, lng: -89.7, tz: "America/Chicago" },
  missouri: { lat: 38.6, lng: -92.6, tz: "America/Chicago" },
  montana: { lat: 46.9, lng: -110.5, tz: "America/Denver" },
  nebraska: { lat: 41.5, lng: -99.8, tz: "America/Chicago" },
  nevada: { lat: 39.9, lng: -117.0, tz: "America/Los_Angeles" },
  "new hampshire": { lat: 43.7, lng: -71.6, tz: "America/New_York" },
  "new jersey": { lat: 40.3, lng: -74.5, tz: "America/New_York" },
  "new mexico": { lat: 34.3, lng: -106.0, tz: "America/Denver" },
  "new york": { lat: 43.0, lng: -75.5, tz: "America/New_York" },
  "north carolina": { lat: 35.8, lng: -80.8, tz: "America/New_York" },
  "north dakota": { lat: 47.5, lng: -100.7, tz: "America/Chicago" },
  ohio: { lat: 40.4, lng: -83.0, tz: "America/New_York" },
  oklahoma: { lat: 35.6, lng: -96.9, tz: "America/Chicago" },
  oregon: { lat: 44.0, lng: -120.5, tz: "America/Los_Angeles" },
  pennsylvania: { lat: 41.2, lng: -77.2, tz: "America/New_York" },
  "rhode island": { lat: 41.7, lng: -71.5, tz: "America/New_York" },
  "south carolina": { lat: 33.9, lng: -80.9, tz: "America/New_York" },
  "south dakota": { lat: 44.5, lng: -100.0, tz: "America/Chicago" },
  tennessee: { lat: 35.9, lng: -86.4, tz: "America/Chicago" },
  texas: { lat: 31.0, lng: -100.0, tz: "America/Chicago" },
  utah: { lat: 39.3, lng: -111.7, tz: "America/Denver" },
  vermont: { lat: 44.1, lng: -72.7, tz: "America/New_York" },
  virginia: { lat: 37.8, lng: -78.9, tz: "America/New_York" },
  washington: { lat: 47.5, lng: -120.5, tz: "America/Los_Angeles" },
  "west virginia": { lat: 38.6, lng: -80.5, tz: "America/New_York" },
  wisconsin: { lat: 44.5, lng: -89.5, tz: "America/Chicago" },
  wyoming: { lat: 43.0, lng: -107.5, tz: "America/Denver" },
};

const titleCaseState = (s) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

// Trailing geographic qualifiers that users append but the geocoder doesn't
// index (e.g. "Hashima Island" finds nothing, "Hashima" works). When the full
// query returns no results we strip one of these and retry.
const GEO_SUFFIX_RE = /\s+(island|islands|country|state|city)$/i;

async function geocodeFirst(name) {
  if (!name) return null;
  try {
    const resp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.results?.[0] || null;
  } catch {
    return null;
  }
}

// Returns up to `count` geocoding results (used for fuzzy candidate searches).
async function geocodeList(name, count) {
  if (!name) return [];
  try {
    const resp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.results || [];
  } catch {
    return [];
  }
}

// Iterative Levenshtein distance — used to recover small typos
// ("coneticut"→"connecticut", "londun"→"london").
function editDistance(a, b) {
  a = (a || "").toLowerCase();
  b = (b || "").toLowerCase();
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

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
    const trimmed = query.trim();
    // Bare US state name → resolve directly to the state centroid (Open-Meteo
    // has no state-level records, so the API would otherwise pick a same-named
    // city or country).
    const state = US_STATES[trimmed.toLowerCase()];
    if (state) {
      saveLocation({
        latitude: state.lat,
        longitude: state.lng,
        city: "",
        state: titleCaseState(trimmed.toLowerCase()),
        country: "United States",
        timezone: state.tz,
      });
      setLoading(false);
      return;
    }
    try {
      const ql = trimmed.toLowerCase();
      const stripped = trimmed.replace(GEO_SUFFIX_RE, "").trim();
      const threshold = Math.max(2, Math.floor(ql.length * 0.25));

      // Fast path: direct lookup (full query, then suffix-stripped). Accept
      // only when the returned name is an exact-or-1-char match, otherwise the
      // geocoder may have returned a wrong near-match for a typo
      // (e.g. "londun" → Londungo, Angola).
      const r =
        (await geocodeFirst(trimmed)) || (await geocodeFirst(stripped));
      if (r && editDistance(ql, r.name.toLowerCase()) <= 1) {
        saveLocation({
          latitude: r.latitude,
          longitude: r.longitude,
          city: r.name || "",
          state: r.admin1 || "",
          country: r.country || "",
          timezone:
            r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        return;
      }

      // Fuzzy path: gather candidates and pick the closest by edit distance.
      const candidates = []; // { key?, result?, name, dist }
      const pushResult = (item) => {
        if (!item) return;
        const name = item.name.toLowerCase();
        candidates.push({ result: item, name, dist: editDistance(ql, name) });
      };
      if (r) pushResult(r);
      if (stripped && stripped.toLowerCase() !== ql) {
        pushResult(await geocodeFirst(stripped));
      }
      // US state names (handles state typos the geocoder can't resolve at all).
      let bestState = null;
      for (const key of Object.keys(US_STATES)) {
        const d = editDistance(ql, key);
        if (!bestState || d < bestState.dist) bestState = { key, dist: d };
      }
      if (bestState && bestState.dist <= threshold) {
        candidates.push({ key: bestState.key, name: bestState.key, dist: bestState.dist });
      }
      // Prefix search — drop trailing chars the user likely mistyped
      // ("londun" → prefix "lond" → surfaces London).
      if (trimmed.length > 4) {
        const prefix = trimmed.slice(0, Math.max(3, trimmed.length - 2));
        for (const item of await geocodeList(prefix, 8)) pushResult(item);
      }

      const best = candidates.sort((a, b) => a.dist - b.dist)[0];
      if (!best || best.dist > threshold) throw new Error("No coordinates");

      if (best.key) {
        const s = US_STATES[best.key];
        saveLocation({
          latitude: s.lat,
          longitude: s.lng,
          city: "",
          state: titleCaseState(best.key),
          country: "United States",
          timezone: s.tz,
        });
      } else {
        saveLocation({
          latitude: best.result.latitude,
          longitude: best.result.longitude,
          city: best.result.name || "",
          state: best.result.admin1 || "",
          country: best.result.country || "",
          timezone:
            best.result.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
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
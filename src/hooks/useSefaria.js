import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Extract and Clean Text ---
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];
  const version = data.versions.find((v) => v.language === expectedLang);
  if (!version || !version.text) return [];

  const rawArray = Array.isArray(version.text) ? version.text : [version.text];

  if (expectedLang === "en") {
    return rawArray.map((line) => {
      const containsHebrew = /[\u0590-\u05FF]/.test(line || "");
      return containsHebrew ? "" : line;
    });
  }
  return rawArray;
};

// --- Exported Fetcher (Centralized Logic) ---
export const fetchAndZipSefaria = async (ref) => {
  const encodedRef = encodeURIComponent(ref);

  const [hebResp, engResp] = await Promise.all([
    fetch(
      `https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&context=0`,
    ),
    fetch(
      `https://www.sefaria.org/api/v3/texts/${encodedRef}?version=english|Sefaria%20Community%20Translation&context=0`,
    ),
  ]);

  // ONLY throw if the Hebrew source fails.
  if (!hebResp.ok) throw new Error(`Failed to fetch Hebrew text for ${ref}`);

  const hebData = await hebResp.json();
  // Let English fail gracefully! Sefaria might not have this specific translation.
  const engData = engResp.ok ? await engResp.json() : null;

  const heArr = extractText(hebData, "he");
  const enArr = engData ? extractText(engData, "en") : [];

  const maxLen = Math.max(heArr.length, enArr.length);
  const segments = [];

  for (let i = 0; i < maxLen; i++) {
    segments.push({
      segmentId: `${ref}-${i + 1}`,
      he: heArr[i] || null,
      en: enArr[i] || null,
    });
  }

  return segments;
};

// --- Hook 1: Fetch the Table of Contents ---
export function useSefariaTOC(bookRef) {
  return useQuery({
    queryKey: ["sefaria-toc", bookRef],
    queryFn: async () => {
      const res = await fetch(`https://www.sefaria.org/api/index/${bookRef}`);
      if (!res.ok) throw new Error("Failed to fetch TOC");
      return res.json();
    },
    enabled: !!bookRef,
  });
}

// --- Hook 2: Fetch a Specific Text Section ---
export function useSefariaText(ref) {
  return useQuery({
    queryKey: ["sefaria-text", ref],
    // Re-use the centralized logic!
    queryFn: () => fetchAndZipSefaria(ref),
    enabled: !!ref,
  });
}

// --- Hook 3: Background Prefetcher ---
export function usePrefetchSefariaText() {
  const queryClient = useQueryClient();

  return (ref) => {
    if (!ref) return;
    queryClient.prefetchQuery({
      queryKey: ["sefaria-text", ref],
      // Re-use the centralized logic!
      queryFn: () => fetchAndZipSefaria(ref),
      staleTime: 1000 * 60 * 60 * 24,
    });
  };
}
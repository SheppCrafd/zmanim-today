import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Extract and Clean Text ---
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];

  // FIX: Find the first version that matches the language AND actually contains text
  const version = data.versions.find(
    (v) => v.language === expectedLang && v.text && v.text.length > 0,
  );
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
  if (!ref) return [];

  const safeRef = encodeURIComponent(ref.replace(/ /g, "_")).replace(
    /'/g,
    "%27",
  );

  // ATTEMPT 1: V3 API (Gets modern defaults)
  let resp = await fetch(`https://www.sefaria.org/api/v3/texts/${safeRef}`);
  let data = resp.ok ? await resp.json() : null;

  let heArr = extractText(data, "he");
  let enArr = extractText(data, "en");

  // ATTEMPT 2 (THE FALLBACK): V2 API
  // If V3 yielded no Hebrew text, ask Sefaria's classic API as a catch-all.
  if (heArr.length === 0) {
    console.warn(`V3 API empty for ${ref}. Trying V2 Fallback...`);
    const fallbackResp = await fetch(
      `https://www.sefaria.org/api/texts/${safeRef}?context=0`,
    );

    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();

      // The V2 API puts arrays directly on the root object, ignoring complex versioning
      if (fallbackData.he && fallbackData.he.length > 0) {
        heArr = fallbackData.he;
      }
      if (
        fallbackData.text &&
        fallbackData.text.length > 0 &&
        enArr.length === 0
      ) {
        enArr = fallbackData.text; // Keep V3 English if we already found it, otherwise use V2
      }
    }
  }

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
      queryFn: () => fetchAndZipSefaria(ref),
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
    });
  };
}
import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Extract and Clean Text ---
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];

  // Find the first version that matches the requested language
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
  if (!ref) return [];

  // 1. Sefaria prefers underscores to spaces in API calls
  // 2. We must manually encode apostrophes (%27) because JavaScript ignores them!
  const safeRef = encodeURIComponent(ref.replace(/ /g, "_")).replace(
    /'/g,
    "%27",
  );

  // Fetch the text WITHOUT forcing specific version names.
  // Sefaria will automatically return the default Hebrew and English texts.
  const resp = await fetch(`https://www.sefaria.org/api/v3/texts/${safeRef}`);

  // If the API completely rejects the request (e.g. 404), return an empty array
  // instead of throwing an error. This prevents the red "Failed to load" UI crash!
  if (!resp.ok) {
    console.warn(`Sefaria API rejected ref: ${ref}`);
    return [];
  }

  const data = await resp.json();

  const heArr = extractText(data, "he");
  const enArr = extractText(data, "en");

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
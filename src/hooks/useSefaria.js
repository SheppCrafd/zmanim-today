import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Flatten deeply nested arrays from Sefaria ---
const flatten = (arr) => (Array.isArray(arr) ? arr.flat(Infinity) : [arr]);

// --- Helper: Extract and Clean Text ---
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];

  // Find the first version matching the language that actually has text
  const version = data.versions.find(
    (v) =>
      v.language === expectedLang &&
      v.text &&
      flatten(v.text).filter(Boolean).length > 0,
  );

  if (!version || !version.text) return [];

  // Flatten nested text arrays into a single continuous list of paragraphs
  const rawArray = flatten(version.text);

  if (expectedLang === "en") {
    return rawArray.map((line) => {
      if (!line) return "";
      // NEW LOGIC: Only erase the line if it contains NO English letters.
      // This preserves lines that have both English and Hebrew (like transliterations)
      // while safely removing Sefaria's duplicate pure-Hebrew placeholder arrays.
      const hasEnglish = /[a-zA-Z]/.test(line);
      return hasEnglish ? line : "";
    });
  }

  return rawArray;
};

// --- Exported Fetcher ---
export const fetchAndZipSefaria = async (ref) => {
  if (!ref) return [];

  // Sefaria endpoints require spaces to be underscores
  const safeRef = encodeURIComponent(ref.replace(/ /g, "_"));

  try {
    // ATTEMPT 1: V3 API
    const resp = await fetch(`https://www.sefaria.org/api/v3/texts/${safeRef}`);
    let data = resp.ok ? await resp.json() : null;

    let heArr = extractText(data, "he");
    let enArr = extractText(data, "en");

    // ATTEMPT 2: V2 API FALLBACK
    if (heArr.length === 0) {
      const fallbackResp = await fetch(
        `https://www.sefaria.org/api/texts/${safeRef}?context=0`,
      );
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();

        // V2 puts the arrays directly on the root object
        if (fallbackData.he && fallbackData.he.length > 0) {
          heArr = flatten(fallbackData.he);
        }
        if (
          fallbackData.text &&
          fallbackData.text.length > 0 &&
          enArr.length === 0
        ) {
          enArr = flatten(fallbackData.text);
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
  } catch (err) {
    console.error(`Failed to fetch ${ref}:`, err);
    return [];
  }
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
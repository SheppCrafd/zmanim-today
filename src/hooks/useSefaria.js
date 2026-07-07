import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Flatten deeply nested arrays from Sefaria ---
const flatten = (arr) => (Array.isArray(arr) ? arr.flat(Infinity) : [arr]);

// --- Helper: Extract and Merge Text from ALL versions ---
const extractAndMergeText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];

  // 1. Find all versions for the requested language that actually contain text
  let matchingVersions = data.versions.filter(
    (v) => v.language === expectedLang && v.text
  );

  if (matchingVersions.length === 0) return [];

  // 2. Explicitly prioritize "Sefaria Community Translation" 
  // so it gets checked first for every single paragraph.
  matchingVersions.sort((a, b) => {
    if (a.versionTitle === "Sefaria Community Translation") return -1;
    if (b.versionTitle === "Sefaria Community Translation") return 1;
    return 0;
  });

  // 3. Find the maximum segment length across all matching versions
  const maxLength = Math.max(
    ...matchingVersions.map((v) => flatten(v.text).length)
  );
  
  const mergedArr = new Array(maxLength).fill("");

  // 4. Fill in the merged array by checking each version line-by-line
  for (let i = 0; i < maxLength; i++) {
    for (const version of matchingVersions) {
      const flatText = flatten(version.text);
      const line = flatText[i];

      // If this version has a translation for this paragraph, use it!
      if (line && typeof line === "string" && line.trim().length > 0) {
        if (expectedLang === "en") {
          // Ensure it actually contains English characters
          if (/[a-zA-Z]/.test(line)) {
            mergedArr[i] = line;
            break; // Found a valid translation! Stop looking and move to the next paragraph.
          }
        } else {
          mergedArr[i] = line;
          break; // Found valid Hebrew! Stop looking and move to the next paragraph.
        }
      }
    }
  }

  return mergedArr;
};

// --- Exported Fetcher ---
export const fetchAndZipSefaria = async (ref) => {
  if (!ref) return [];

  const safeRef = encodeURIComponent(ref.replace(/ /g, "_")).replace(
    /'/g,
    "%27"
  );

  try {
    // ATTEMPT 1: V3 API
    const resp = await fetch(`https://www.sefaria.org/api/v3/texts/${safeRef}`);
    let data = resp.ok ? await resp.json() : null;

    // Use the new line-by-line fallback merger
    let heArr = extractAndMergeText(data, "he");
    let enArr = extractAndMergeText(data, "en");

    // ATTEMPT 2: V2 API FALLBACK (Catches anything V3 completely missed)
    const needsHeFallback = heArr.length === 0 || heArr.includes("");
    const needsEnFallback = enArr.length === 0 || enArr.includes("");

    if (needsHeFallback || needsEnFallback) {
      const fallbackResp = await fetch(
        `https://www.sefaria.org/api/texts/${safeRef}?context=0`
      );
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();

        // Patch missing Hebrew segments
        if (needsHeFallback && fallbackData.he && fallbackData.he.length > 0) {
          const flatFallbackHe = flatten(fallbackData.he);
          const maxLen = Math.max(heArr.length, flatFallbackHe.length);
          for (let i = 0; i < maxLen; i++) {
            if (!heArr[i]) heArr[i] = flatFallbackHe[i] || "";
          }
        }

        // Patch missing English segments
        if (needsEnFallback && fallbackData.text && fallbackData.text.length > 0) {
          const flatFallbackEn = flatten(fallbackData.text);
          const maxLen = Math.max(enArr.length, flatFallbackEn.length);
          for (let i = 0; i < maxLen; i++) {
            if (!enArr[i]) enArr[i] = flatFallbackEn[i] || "";
          }
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
    queryKey: ["sefaria-toc-v2", bookRef],
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
    queryKey: ["sefaria-text-v2", ref],
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
      queryKey: ["sefaria-text-v2", ref],
      queryFn: () => fetchAndZipSefaria(ref),
      staleTime: 1000 * 60 * 60 * 24,
    });
  };
}
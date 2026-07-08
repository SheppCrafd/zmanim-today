import { useQuery, useQueryClient } from "@tanstack/react-query";

// --- Helper: Flatten deeply nested arrays from Sefaria ---
const flatten = (arr) => (Array.isArray(arr) ? arr.flat(Infinity) : [arr]);

// --- Helper: Extract and Merge Text from ALL versions ---
const extractAndMergeText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];

  // 1. Find all versions for the requested language that actually contain text
  let matchingVersions = data.versions.filter(
    (v) => v.language === expectedLang && v.text,
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
    ...matchingVersions.map((v) => flatten(v.text).length),
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

// ... keep your existing flatten and extractAndMergeText helpers ...

export const fetchAndZipSefaria = async (ref) => {
  if (!ref) return [];

  const safeRef = encodeURIComponent(ref.replace(/ /g, "_")).replace(
    /'/g,
    "%27",
  );

  try {
    // ATTEMPT 1: V3 API (Now with Sefaria's native missing-segment filler!)
    const resp = await fetch(
      `https://www.sefaria.org/api/v3/texts/${safeRef}?fill_in_missing_segments=1`,
    );
    let data = resp.ok ? await resp.json() : null;

    let heArr = extractAndMergeText(data, "he");
    let enArr = extractAndMergeText(data, "en");

    // ATTEMPT 2: V2 API FALLBACK
    const needsHeFallback = heArr.length === 0 || heArr.includes("");
    const needsEnFallback = enArr.length === 0 || enArr.includes("");

    if (needsHeFallback || needsEnFallback) {
      const fallbackResp = await fetch(
        `https://www.sefaria.org/api/texts/${safeRef}?context=0`,
      );
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();

        // Patch Hebrew
        if (needsHeFallback && fallbackData.he && fallbackData.he.length > 0) {
          const flatFallbackHe = flatten(fallbackData.he);
          const maxLen = Math.max(heArr.length, flatFallbackHe.length);
          for (let i = 0; i < maxLen; i++) {
            if (!heArr[i]) heArr[i] = flatFallbackHe[i] || "";
          }
        }

        // Patch English
        if (
          needsEnFallback &&
          fallbackData.text &&
          fallbackData.text.length > 0
        ) {
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
      // 💣 BLOWING UP THE ERROR: We guarantee there is ALWAYS text.
      // If Sefaria literally has zero translation in their DB, we provide a clean fallback string.
      // Note: If you want it to just look clean and blank instead of showing text, change the fallback to " " (a space).
      const finalHe = heArr[i]?.trim() ? heArr[i] : " ";
      const finalEn = enArr[i]?.trim() ? enArr[i] : " ";

      segments.push({
        segmentId: `${ref}-${i + 1}`,
        he: finalHe,
        en: finalEn,
      });
    }

    return segments;
  } catch (err) {
    console.error(`Failed to fetch ${ref}:`, err);
    // Even in a total crash, return a safe fallback so the UI doesn't blow up
    return [
      {
        segmentId: `${ref}-error`,
        he: "(שגיאת תקשורת)",
        en: "Failed to connect to Sefaria.",
      },
    ];
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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheGet, cacheSet } from "@/lib/sefariaCache";

// --- Helper: Flatten deeply nested arrays from Sefaria ---
const flatten = (arr) => (Array.isArray(arr) ? arr.flat(Infinity) : [arr]);

// --- Helpers: language guards (shared by V3 merge + V2 fallback) ---
// Sefaria sometimes labels a version "en" while its text is actually Hebrew
// (or another non-English language). These guards keep each column clean by
// checking the actual script content of a line, not just the API's label.
const stripHtml = (s) => (s || "").replace(/<[^>]*>/g, " ");

const looksHebrew = (line) => {
  const s = stripHtml(line);
  if (!s || !s.trim()) return false;
  return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(s);
};

const looksEnglish = (line) => {
  const s = stripHtml(line);
  if (!s || !s.trim()) return false;
  const latin = (s.match(/[a-zA-Z]/g) || []).length;
  if (latin === 0) return false; // no Latin at all → not English
  const hebrew = (s.match(/[\u0590-\u05FF\uFB1D-\uFB4F]/g) || []).length;
  // Reject lines dominated by Hebrew script (the main pollution case);
  // Latin-only transliterations still pass and stay readable.
  if (hebrew > latin) return false;
  return true;
};

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
          if (looksEnglish(line)) {
            mergedArr[i] = line;
            break; // Found a valid translation! Stop looking and move to the next paragraph.
          }
        } else {
          // Only accept lines that actually contain Hebrew characters —
          // keeps English / other-language text out of the Hebrew column
          if (looksHebrew(line)) {
            mergedArr[i] = line;
            break; // Found valid Hebrew! Move to the next paragraph.
          }
        }
      }
    }
  }

  return mergedArr;
};

// ... keep your existing flatten and extractAndMergeText helpers ...

// Core: fetch + merge he/en for a single Sefaria ref (V3, then V2 fallback).
const fetchSegmentsForRef = async (ref) => {
  if (!ref) return [];
  const safeRef = encodeURIComponent(ref.replace(/ /g, "_")).replace(
    /'/g,
    "%27",
  );

  try {
    // ATTEMPT 1: V3 API (with Sefaria's native missing-segment filler)
    const resp = await fetch(
      `https://www.sefaria.org/api/v3/texts/${safeRef}?fill_in_missing_segments=1`,
    );
    let data = resp.ok ? await resp.json() : null;

    let heArr = extractAndMergeText(data, "he");
    let enArr = extractAndMergeText(data, "en");

    // ATTEMPT 2: V2 API FALLBACK to fill any gaps
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
            if (!heArr[i] && looksHebrew(flatFallbackHe[i])) heArr[i] = flatFallbackHe[i];
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
            // Only fill from the fallback when it's genuinely English —
            // Sefaria's default `text` for some sections is actually Hebrew.
            if (!enArr[i] && looksEnglish(flatFallbackEn[i])) enArr[i] = flatFallbackEn[i];
          }
        }
      }
    }

    const maxLen = Math.max(heArr.length, enArr.length);
    const segments = [];
    for (let i = 0; i < maxLen; i++) {
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
    return [];
  }
};

const segmentsHaveText = (segs) =>
  segs.some((s) => (s.he && s.he.trim()) || (s.en && s.en.trim()));

export const fetchAndZipSefaria = async (ref, altRefs = []) => {
  // Persistent cache (IndexedDB) — survives reloads, so a section that was
  // fetched once loads instantly on every subsequent visit without re-hitting
  // the network.
  const cached = await cacheGet(ref);
  if (cached) return cached;

  const primary = await fetchSegmentsForRef(ref);
  if (segmentsHaveText(primary)) {
    cacheSet(ref, primary);
    return primary;
  }

  // Some siddur nodes are references to other Sefaria texts (e.g. "Ashrei" →
  // "Psalm 145"). Their own path returns nothing, so try the node's alternate
  // titles as real refs until one yields text.
  for (const alt of altRefs || []) {
    if (!alt || alt === ref) continue;
    const segs = await fetchSegmentsForRef(alt);
    if (segmentsHaveText(segs)) {
      cacheSet(ref, segs);
      return segs;
    }
  }

  // Cache empty results too, so empty refs never re-hit the network.
  cacheSet(ref, primary);
  return primary;
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
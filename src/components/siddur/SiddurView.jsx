import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import DOMPurify from "dompurify";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchAndZipSefaria } from "@/hooks/useSefaria";
import { processSefariaSchema } from "@/lib/siddurSchema";
import TocTree from "@/components/siddur/TocTree";
import NavMenu from "@/components/NavMenu";
import {
  SiddurHeader,
  SiddurSegment,
  SiddurLoading,
  SiddurError,
} from "@/components/siddur/SiddurSegment";

/* ---------------- SANITIZER ----------------
 * Sefaria text can include community-contributed HTML, so this is untrusted
 * input rendered via dangerouslySetInnerHTML. Delegate to DOMPurify (fuzzed
 * against real browser parsers, actively maintained) rather than a hand-rolled
 * parser+stripper — the latter is exactly the pattern that's historically
 * produced subtle mutation-XSS bypasses. Zero surviving attributes, matching
 * the plain-text-with-basic-formatting output the reader has always shown.
 * (Note: don't combine ALLOWED_ATTR with USE_PROFILES here — DOMPurify 3.x
 * silently drops the ALLOWED_ATTR restriction when both are set together.) */
function sanitizeHTML(htmlString) {
  if (!htmlString) return "";
  return DOMPurify.sanitize(htmlString, {
    ALLOWED_ATTR: [],
  });
}

// Query data is immutable once fetched (react-query + IndexedDB cache), so the
// same raw he/en string comes back on every re-render of a given section. The
// flatItems memo below recomputes for the *entire* activeSections list every
// time it grows (infinite scroll) or langMode toggles, which without a cache
// means re-running DOMPurify over every already-seen segment again and again.
// Caching by the raw string sidesteps that — pure function of its input, so a
// plain module-level Map (never invalidated) is safe and keeps the sanitized
// output byte-identical to calling sanitizeHTML directly.
const sanitizeCache = new Map();
function sanitizeCached(htmlString) {
  if (!htmlString) return "";
  const hit = sanitizeCache.get(htmlString);
  if (hit !== undefined) return hit;
  const clean = sanitizeHTML(htmlString);
  sanitizeCache.set(htmlString, clean);
  return clean;
}

const clampScale = (s) => Math.max(0.5, Math.min(3, Math.round(s * 20) / 20));

/* ---------------- SUBHEADER DETECTION ---------------- */
// Sefaria injects a section's title (and its parent-category titles) as the
// opening text segments of a section. The sticky header already shows the
// title, so these in-text subheaders are redundant. We detect a subheader by
// normalizing a segment's text and matching it against the normalized titles
// of EVERY node in the siddur's TOC tree (English + Hebrew), plus a gloss
// heuristic for foreign parenthetical subtitles (e.g. Portuguese).
const stripNikud = (s) => (s || "").replace(/[\u0591-\u05C7\u05F3\u05F4]/g, "");
const sig = (s) => {
  let t = stripNikud(s);
  t = t.replace(/<[^>]*>/g, " ");
  t = t.toLowerCase();
  t = t.replace(/[^a-z0-9\u05D0-\u05FF\s]/g, " ");
  t = t.replace(/\b(the|of|on|and|a|an|in|to|for)\b/g, " ");
  t = t.replace(/([a-z])\1+/g, "$1"); // collapse doubled Latin letters (translit variants: Tikkun≈Tikun)
  return t.split(/\s+/).filter(Boolean).sort().join(" ");
};
const ENGLISH_PROSE_RE =
  /\b(the|and|of|to|is|it|that|was|for|on|are|with|this|have|from|they|not|but|his|her|she|you|your|all|been|will|there|when|who|its|into|our|may|then|them|would|had|has|their|him|which|where|why|now|did|here|each|same|both|most|other|such|should|those|every|made|my|one|can|out|up|way|could|over|than|after|back|down|off|just|also|only|very|much|like|well|even|own|while|thee|thou|thy|thine|hath|doth|art|shalt|ye|unto|wherefore|thereof|therein|thereon|wert|hast)\b/i;
// Short foreign-language parenthetical gloss title (no English prose markers)
const isGlossTitle = (en) => {
  const s = (en || "").replace(/<[^>]*>/g, " ").trim();
  if (!s || !/\([^)]*\)/.test(s)) return false;
  if (s.split(/\s+/).filter(Boolean).length > 10) return false;
  return !ENGLISH_PROSE_RE.test(s);
};

// A section is "empty" if Sefaria returned no usable Hebrew or English text
const segmentsHaveText = (segs) =>
  Array.isArray(segs) &&
  segs.some((s) => (s.he && s.he.trim()) || (s.en && s.en.trim()));

// Fetch every section (concurrency-limited) and return the set of empty refs.
// Runs once on cold start so the TOC/reader never show empty entries.
async function sweepEmpties(sections, queryClient, concurrency = 8) {
  const empty = new Set();
  let idx = 0;
  const run = async () => {
    while (idx < sections.length) {
      const i = idx++;
      const sec = sections[i];
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ["sefaria-text-v3", sec.ref],
          queryFn: () => fetchAndZipSefaria(sec.ref, sec.altRefs),
          staleTime: 86400000,
        });
        if (!segmentsHaveText(data)) empty.add(sec.ref);
      } catch {
        /* skip — leave visible rather than hide on error */
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, sections.length) }, run),
  );
  return empty;
}

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const scrollDebounce = useRef(null);
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const pendingScaleRef = useRef(null);
  const zoomRafRef = useRef(null);
  const contentRef = useRef(null);
  const labelRef = useRef(null);
  // Per-section flatItems cache (keyed by ref + lang mode) — see flatItems
  // below for why this exists.
  const sectionItemsCacheRef = useRef(new Map());
  const scaleRef = useRef(
    (typeof localStorage !== "undefined" &&
      parseFloat(localStorage.getItem("siddur-font-scale"))) ||
      1,
  );
  const persistTimer = useRef(null);

  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);

  // Render count for infinite downward scroll (always starts at 0)
  const [renderCount, setRenderCount] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState("toc");
  const [langMode, setLangMode] = useState("both");

  // Refs Sefaria has confirmed to have NO text — hidden from TOC & reader.
  // Seeded from localStorage so pruning is instant on reload (no fetch wait).
  const emptyRefsKey = `siddur-empty-refs:${bookRef}`;
  const [emptyRefs, setEmptyRefs] = useState(() => {
    try {
      const raw = localStorage.getItem(emptyRefsKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // True only on a cold start (no persisted empties): block the TOC until the
  // one-time sweep finishes so empty entries never flash in.
  const [pruning, setPruning] = useState(() => {
    try {
      return !localStorage.getItem(emptyRefsKey);
    } catch {
      return true;
    }
  });

  // Step-loading state
  const [jumpTargetSection, setJumpTargetSection] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  const showEN = langMode !== "he";
  const showHB = langMode !== "en";

  // Text size is driven entirely through refs + direct DOM mutation so that
  // pinch / wheel / button zoom NEVER triggers a React re-render of the reader
  // (which would recreate hundreds of segment elements and cause jank).
  // Zoom is anchored to the top visible text row (excluding sticky headers):
  // we snapshot that row's viewport position, change font size, then nudge
  // scrollTop so the row stays put.
  const applyScale = useCallback((next) => {
    const s = clampScale(next);
    const container = scrollRef.current;
    const content = contentRef.current;

    // Find the text row currently at the top of the reader viewport.
    let anchorEl = null;
    if (container && content) {
      const cRect = container.getBoundingClientRect();
      const x = cRect.left + cRect.width / 2;
      for (const y of [cRect.top + 52, cRect.top + 72, cRect.top + 100]) {
        const hit = document.elementFromPoint(x, y);
        if (hit) {
          const seg = hit.closest && hit.closest('[id^="seg-"]');
          if (seg) {
            anchorEl = seg;
            break;
          }
        }
      }
    }
    const beforeTop = anchorEl ? anchorEl.getBoundingClientRect().top : null;

    scaleRef.current = s;
    if (content) content.style.fontSize = `${s}rem`;
    if (labelRef.current)
      labelRef.current.textContent = `${Math.round(s * 100)}%`;

    if (anchorEl && beforeTop != null && container) {
      const afterTop = anchorEl.getBoundingClientRect().top;
      container.scrollTop += afterTop - beforeTop;
    }

    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem("siddur-font-scale", String(s));
      } catch {
        /* ignore */
      }
    }, 350);
  }, []);

  // Pinch-to-zoom (touch) + trackpad pinch (ctrl+wheel) drive text size.
  // Updates go straight to the DOM via applyScale — zero React re-renders.
  //
  // applyScale itself does several layout-forcing reads (elementFromPoint to
  // find the anchor row, getBoundingClientRect before/after the font-size
  // write) so it can keep that row visually pinned while the text resizes.
  // touchmove and ctrl+wheel can both fire many times faster than the
  // display can actually paint, and calling applyScale directly from the raw
  // event handler ran that whole read-write-read-write sequence once per
  // *event* rather than once per *frame* — during a fast pinch or trackpad
  // gesture that's several rounds of forced layout crammed into a single
  // 16ms frame budget, which is exactly what shows up as zoom feeling
  // stuttery instead of buttery. scheduleScale coalesces any number of
  // same-frame requests into a single applyScale call using only the latest
  // value, since intermediate values within one frame were never painted
  // anyway.
  const scheduleScale = useCallback(
    (next) => {
      pendingScaleRef.current = next;
      if (zoomRafRef.current != null) return;
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        const value = pendingScaleRef.current;
        // Reset before applying — once consumed, the next event outside this
        // frame's batch should compute its delta from applyScale's fresh,
        // authoritative scaleRef.current, not a stale leftover pending value
        // (which may predate clamping, e.g. past the 0.5–3 range).
        pendingScaleRef.current = null;
        applyScale(value);
      });
    },
    [applyScale],
  );

  useEffect(() => {
    if (page !== "reader") return;
    const el = scrollRef.current;
    if (!el) return;

    const dist = (a, b) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          active: true,
          startDist: dist(e.touches[0], e.touches[1]),
          startScale: scaleRef.current,
        };
      }
    };

    const onTouchMove = (e) => {
      if (!pinchRef.current.active || e.touches.length !== 2) return;
      e.preventDefault();
      const ratio =
        dist(e.touches[0], e.touches[1]) / (pinchRef.current.startDist || 1);
      scheduleScale(pinchRef.current.startScale * ratio);
    };

    const endPinch = (e) => {
      if (e.touches.length < 2) pinchRef.current.active = false;
    };

    const onWheel = (e) => {
      if (!e.ctrlKey) return; // trackpad pinch fires ctrl+wheel
      e.preventDefault();
      // Base off any not-yet-applied pending value so several wheel ticks
      // landing in the same animation frame accumulate correctly, instead of
      // each one computing its delta from the same stale scaleRef.current
      // and only the last tick in the frame actually counting.
      const base =
        pendingScaleRef.current != null
          ? pendingScaleRef.current
          : scaleRef.current;
      scheduleScale(base - e.deltaY * 0.003);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endPinch);
    el.addEventListener("touchcancel", endPinch);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endPinch);
      el.removeEventListener("touchcancel", endPinch);
      el.removeEventListener("wheel", onWheel);
      if (zoomRafRef.current != null) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = null;
      }
    };
  }, [page, scheduleScale]);

  // Persist the known-empty refs so next load prunes instantly
  useEffect(() => {
    try {
      if (emptyRefs.size) {
        localStorage.setItem(emptyRefsKey, JSON.stringify([...emptyRefs]));
      } else {
        localStorage.removeItem(emptyRefsKey);
      }
    } catch {
      /* ignore */
    }
  }, [emptyRefs, emptyRefsKey]);

  // Load TOC
  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then((r) => r.json())
      .then((data) => {
        const { tree, flat } = processSefariaSchema(data?.schema || {});
        setTree(tree);
        setSections(flat);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [bookRef]);

  // Normalized titles of EVERY node in the TOC tree — used to detect redundant
  // in-text subheaders (a segment whose text matches a known section/category title).
  const titleSets = useMemo(() => {
    const en = new Set();
    const he = new Set();
    const walk = (nodes) =>
      nodes.forEach((n) => {
        if (n.title) en.add(sig(n.title));
        if (n.heTitle) he.add(sig(n.heTitle));
        if (n.children?.length) walk(n.children);
      });
    walk(tree);
    return { en, he };
  }, [tree]);

  // Prune the tree of sections Sefaria has no text for (and their now-empty parents)
  const visibleTree = useMemo(() => {
    if (emptyRefs.size === 0) return tree;
    const prune = (nodes) =>
      nodes
        .map((node) => {
          if (!node.children.length) {
            return emptyRefs.has(node.ref) ? null : node;
          }
          const kids = prune(node.children).filter(Boolean);
          return kids.length ? { ...node, children: kids } : null;
        })
        .filter(Boolean);
    return prune(tree);
  }, [tree, emptyRefs]);

  // Reader sections (only those with text), keeping their original query index
  const visibleSections = useMemo(
    () =>
      sections
        .map((sec, originalIndex) => ({ ...sec, originalIndex }))
        .filter((sec) => !emptyRefs.has(sec.ref)),
    [sections, emptyRefs],
  );

  // Map ref → visible index (for TOC jump targets)
  const visibleRefToIndex = useMemo(() => {
    const map = {};
    visibleSections.forEach((sec, i) => {
      map[sec.ref] = i;
    });
    return map;
  }, [visibleSections]);

  // Recursive search filter: keeps nodes that match OR have children that match
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return visibleTree;

    const query = searchQuery.toLowerCase();

    const filterNodes = (nodes) => {
      return nodes
        .map((node) => {
          const matches =
            node.title?.toLowerCase().includes(query) ||
            node.heTitle?.includes(query);

          const filteredChildren = filterNodes(node.children || []);

          if (matches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean);
    };

    return filterNodes(visibleTree);
  }, [visibleTree, searchQuery]);

  // Jump trigger
  const jumpTo = useCallback((i) => {
    setPage("reader");
    setJumpTargetSection(i);
  }, []);

  // URL parsing
  useEffect(() => {
    if (!sections.length) return;
    const parts = location.pathname.split("/");
    if (parts.length >= 5 && parts[2] === "section") {
      const sectionId = parseInt(parts[3], 10);
      const lang = parts[4];
      if (["en", "he", "both"].includes(lang)) setLangMode(lang);

      if (
        !isNaN(sectionId) &&
        jumpTargetSection === null &&
        page !== "reader"
      ) {
        jumpTo(sectionId);
      }
    }
  }, [location.pathname, sections.length, jumpTargetSection, page, jumpTo]);

  // First-start emptiness sweep: only runs when there's no persisted set, so
  // warm loads stay instant. Gates the TOC until empty entries are detected.
  useEffect(() => {
    if (!sections.length || !pruning) return;
    let cancelled = false;
    (async () => {
      const empty = await sweepEmpties(sections, queryClient);
      if (cancelled) return;
      setEmptyRefs(empty);
      setPruning(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sections, queryClient, pruning]);

  // Sliced queries starting from 0. Memoized so unrelated re-renders (e.g. a
  // search-box keystroke while on the TOC page) don't produce a new array
  // identity, which would otherwise force flatItems/itemsBySection below to
  // recompute (and re-walk every loaded segment) even though nothing about
  // the reader's visible content actually changed.
  const activeSections = useMemo(
    () => visibleSections.slice(0, renderCount + 1),
    [visibleSections, renderCount],
  );

  const sectionQueries = useQueries({
    queries: activeSections.map((sec) => ({
      queryKey: ["sefaria-text-v3", sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref, sec.altRefs),
      staleTime: 86400000,
    })),
  });

  // Are ANY of the current queries still loading?
  const currentQueriesLoading = useMemo(() => {
    return sectionQueries.some((q) => q.isLoading);
  }, [sectionQueries]);

  // DOM Items
  //
  // Previously this walked *every* active section from scratch on every call
  // — including all of infinite scroll's growing history — even though only
  // the newly-added tail sections are actually new. Late in a long reading
  // session (renderCount deep into a big siddur), each +5 growth tick was
  // re-running the per-segment subheader/hasH/hasE logic over every section
  // already read, not just the new ones — steadily more expensive right at
  // the moment new content streams in, which is exactly when a scroll hitch
  // is most visible. A finished section's item list is a pure function of
  // (its ref, showHB, showEN) and query data never mutates in place once
  // loaded, so it's cached per-section and only the newly-active sections
  // (or sections whose loading/error state just resolved) do real work.
  const flatItems = useMemo(() => {
    const cache = sectionItemsCacheRef.current;
    const items = [];
    activeSections.forEach((sec, i) => {
      const query = sectionQueries[i];
      const header = {
        type: "header",
        id: `hdr-${i}`,
        label: sec.label,
        heLabel: sec.heLabel,
        sectionIndex: i,
      };

      if (!query || query.isLoading) {
        items.push(header);
        items.push({ type: "loading", id: `load-${sec.ref}`, sectionIndex: i });
        return;
      }
      if (query.isError) {
        items.push(header);
        items.push({ type: "error", id: `err-${sec.ref}`, sectionIndex: i });
        return;
      }

      const cacheKey = `${sec.ref}::${showHB ? 1 : 0}::${showEN ? 1 : 0}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        items.push(header, ...cached);
        return;
      }

      const sectionBody = [];
      // Empty section: Sefaria has no text for this ref — render nothing (header only)
      if (query.data && query.data.length > 0) {
        query.data.forEach((seg, segIndex) => {
          const heText = seg.he || "";
          const enText = seg.en || "";
          const hasH = !!heText.replace(/<[^>]*>/g, "").trim();
          const hasE = !!enText.replace(/<[^>]*>/g, "").trim();

          // Subheader = every present column is a title line: it matches a
          // known TOC title (normalized) or — for English — is a short
          // foreign parenthetical gloss. The sticky header already shows the
          // section title, so skip these redundant in-text subheaders.
          const heIsTitle = !hasH || titleSets.he.has(sig(heText));
          const enIsTitle =
            !hasE || titleSets.en.has(sig(enText)) || isGlossTitle(enText);
          if ((hasH || hasE) && heIsTitle && enIsTitle) return;

          if (!(showHB && hasH) && !(showEN && hasE)) return;
          sectionBody.push({
            type: "segment",
            id: `seg-${i}-${segIndex}`,
            sanitizedHe: sanitizeCached(seg.he),
            sanitizedEn: sanitizeCached(seg.en),
            hasH,
            hasE,
            sectionIndex: i,
          });
        });
      }
      cache.set(cacheKey, sectionBody);
      items.push(header, ...sectionBody);
    });
    return items;
  }, [activeSections, sectionQueries, showEN, showHB, titleSets]);

  // Group flat items by section index once — avoids an O(n²) filter per render
  const itemsBySection = useMemo(() => {
    const map = {};
    flatItems.forEach((item) => {
      if (!map[item.sectionIndex]) map[item.sectionIndex] = [];
      map[item.sectionIndex].push(item);
    });
    return map;
  }, [flatItems]);

  // -------------------------
  // NATIVE JUMP ENGINE
  // -------------------------
  useEffect(() => {
    if (jumpTargetSection === null || page !== "reader") return;

    if (currentQueriesLoading) return; // Wait for batch to load

    if (renderCount < jumpTargetSection + 1) {
      // Step A: Load next batch behind overlay
      setRenderCount((prev) => Math.min(visibleSections.length - 1, prev + 5));
    } else {
      // Step B: Target loaded! Find it natively in the DOM
      const targetElement = document.getElementById(`hdr-${jumpTargetSection}`);

      if (targetElement) {
        // Step C: Native browser scroll! No virtualizer math!
        targetElement.scrollIntoView({ behavior: "auto", block: "start" });

        // Step D: Load buffer and remove overlay
        setRenderCount((prev) =>
          Math.min(visibleSections.length - 1, prev + 5),
        );

        // Slight delay ensures the browser finishes snapping before revealing
        setTimeout(() => setJumpTargetSection(null), 50);
      } else {
        setJumpTargetSection(null);
      }
    }
  }, [
    jumpTargetSection,
    page,
    renderCount,
    currentQueriesLoading,
    visibleSections.length,
  ]);

  // -------------------------
  // NATIVE SCROLL HANDLER
  // -------------------------
  const onScroll = useCallback(
    (e) => {
      const el = e.target;
      const scrollTop = el.scrollTop;

      // 1. Infinite Scroll Downwards
      if (scrollTop + el.clientHeight > el.scrollHeight - 1500) {
        if (renderCount < visibleSections.length - 1) {
          setRenderCount((prev) =>
            Math.min(visibleSections.length - 1, prev + 5),
          );
        }
      }

      if (jumpTargetSection !== null) return;

      // 2. Native URL Sync (Checks which header is currently at the top of the screen)
      // Scoped to just section headers (id^="hdr-") — data-section-index also
      // appears on every segment/loading/error item below, so querying that
      // attribute directly meant scanning (and getBoundingClientRect()-ing)
      // every rendered segment in a long reading session, not just the
      // handful of section headers this check actually needs.
      clearTimeout(scrollDebounce.current);
      scrollDebounce.current = setTimeout(() => {
        const headerElements = document.querySelectorAll('[id^="hdr-"]');
        let activeIndex = null;

        for (let i = 0; i < headerElements.length; i++) {
          const rect = headerElements[i].getBoundingClientRect();
          // If the header is near the top of the viewport
          if (rect.top >= 0 && rect.top < 300) {
            activeIndex = headerElements[i].getAttribute("data-section-index");
            break;
          }
        }

        if (activeIndex !== null) {
          const base = location.pathname.split("/")[1] || "Siddur";
          const newUrl = `/${base}/section/${activeIndex}/${langMode}`;
          window.history.replaceState(null, "", newUrl);
        }
      }, 150);
    },
    [
      renderCount,
      visibleSections.length,
      jumpTargetSection,
      langMode,
      location.pathname,
    ],
  );

  // Styled Search Bar Component matching the header/footer row treatment
  const renderSearchBar = () => (
    <div className="shrink-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-sm">
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-slate-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-3 flex items-center"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b bg-white dark:bg-slate-950">
        <div className="flex justify-between items-center px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <NavMenu />
            <div>
              <h1 className="font-display text-lg font-semibold">{title}</h1>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={sefariaUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>

        <div className="px-4 flex items-center gap-2 py-2 flex-wrap">
          <Button
            size="sm"
            variant={langMode === "en" ? "default" : "outline"}
            onClick={() => setLangMode("en")}
          >
            EN
          </Button>
          <Button
            size="sm"
            variant={langMode === "he" ? "default" : "outline"}
            onClick={() => setLangMode("he")}
          >
            HB
          </Button>
          <Button
            size="sm"
            variant={langMode === "both" ? "default" : "outline"}
            onClick={() => setLangMode("both")}
          >
            BOTH
          </Button>

          {page === "reader" && (
            <>
              <div className="flex items-center gap-1 ml-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => applyScale(scaleRef.current - 0.05)}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span
                  ref={labelRef}
                  className="text-xs text-slate-500 w-10 text-center tabular-nums"
                >
                  {Math.round(scaleRef.current * 100)}%
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => applyScale(scaleRef.current + 0.05)}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={jumpTargetSection !== null}
                onClick={() => {
                  const base = location.pathname.split("/")[1];
                  navigate(`/${base}/toc`, { replace: true });
                  setPage("toc");
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">
        {page === "toc" && (
          <div className="h-full flex flex-col overflow-hidden">
            {renderSearchBar()}
            <div className="flex-1 overflow-y-auto px-4 pb-4 overscroll-y-contain">
              {(loading || pruning) && (
                <div className="py-10 flex justify-center">
                  <Loader2 className="animate-spin text-blue-500" />
                </div>
              )}
              {error && (
                <div className="py-10 flex justify-center text-red-500">
                  <AlertCircle className="w-8 h-8" />
                </div>
              )}
              {!loading && !error && !pruning && (
                <TocTree
                  nodes={filteredTree}
                  onSelect={jumpTo}
                  refToIndex={visibleRefToIndex}
                  isSearching={searchQuery.length > 0}
                />
              )}
            </div>
          </div>
        )}

        {page === "reader" && (
          <div className="h-full relative overflow-hidden">
            {/* OVERLAY ENGINE */}
            {(jumpTargetSection !== null || pruning) && (
              <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 z-40 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-9 h-9 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Preparing text layers...
                </p>
              </div>
            )}

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="h-full overflow-y-auto relative"
              style={{
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* PURE NATIVE DOM RENDERING WITH STICKY SECTION CONTAINERS */}
              <div
                ref={contentRef}
                className="pb-8"
                style={{ fontSize: `${scaleRef.current}rem` }}
              >
                {activeSections.map((sec, i) => {
                  const sectionItems = itemsBySection[i] || [];
                  const headerItem = sectionItems.find(
                    (it) => it.type === "header",
                  );
                  const bodyItems = sectionItems.filter(
                    (it) => it.type !== "header",
                  );
                  return (
                    <div key={i} className="relative">
                      {headerItem && (
                        <div
                          key={headerItem.id}
                          id={headerItem.id}
                          data-section-index={headerItem.sectionIndex}
                          className="sticky top-0 z-10 shadow-sm bg-white dark:bg-slate-950"
                        >
                          <SiddurHeader
                            label={headerItem.label}
                            heLabel={headerItem.heLabel}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          contentVisibility: "auto",
                          containIntrinsicSize: "auto 600px",
                        }}
                      >
                        {bodyItems.map((item) => (
                          <div key={item.id} id={item.id}>
                            {item.type === "segment" && (
                              <SiddurSegment
                                sanitizedHe={item.sanitizedHe}
                                sanitizedEn={item.sanitizedEn}
                                hasH={item.hasH}
                                hasE={item.hasE}
                                showHB={showHB}
                                showEN={showEN}
                              />
                            )}
                            {item.type === "loading" && <SiddurLoading />}
                            {item.type === "error" && <SiddurError />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- SEFARIA ATTRIBUTION FOOTER --- */}
      <div
        className="shrink-0 bg-slate-100 dark:bg-slate-900 border-t pt-3 px-4 flex flex-col items-center justify-center gap-1 z-40"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <a
          href="https://www.sefaria.org/texts"
          target="_blank"
          rel="noreferrer"
          className="transition-transform hover:scale-105"
        >
          <img
            src="https://files.readme.io/dcee0a8-image.png"
            alt="Powered by Sefaria"
            className="h-10 w-auto rounded-md shadow-sm bg-white"
          />
        </a>

        <div className="text-[10px] text-slate-500 leading-none">
          and the{" "}
          <a
            href="https://developers.sefaria.org"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Sefaria API
          </a>
        </div>
      </div>

    </div>
  );
}
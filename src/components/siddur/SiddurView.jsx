import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  List,
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

/* ---------------- SANITIZER ---------------- */
function sanitizeHTML(htmlString) {
  if (!htmlString) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  doc
    .querySelectorAll("script, iframe, object, embed, style, link, meta, base")
    .forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
  });
  return doc.body.innerHTML;
}

const clampScale = (s) => Math.max(0.5, Math.min(3, Math.round(s * 100) / 100));

// A section is "empty" if Sefaria returned no usable Hebrew or English text
const segmentsHaveText = (segs) =>
  Array.isArray(segs) &&
  segs.some((s) => (s.he && s.he.trim()) || (s.en && s.en.trim()));

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const scrollDebounce = useRef(null);

  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);
  const [refToIndex, setRefToIndex] = useState({});

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

  // Step-loading state
  const [jumpTargetSection, setJumpTargetSection] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  const [fontScale, setFontScale] = useState(() => {
    try {
      return parseFloat(localStorage.getItem("siddur-font-scale")) || 1;
    } catch {
      return 1;
    }
  });

  const showEN = langMode !== "he";
  const showHB = langMode !== "en";

  useEffect(() => {
    try {
      localStorage.setItem("siddur-font-scale", String(fontScale));
    } catch {
      /* ignore */
    }
  }, [fontScale]);

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
        const { tree, flat, refToIndex } = processSefariaSchema(
          data?.schema || {},
        );
        setTree(tree);
        setSections(flat);
        setRefToIndex(refToIndex);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [bookRef]);

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

  // Prefetch every section in batches and record which refs have no text
  useEffect(() => {
    if (!sections.length) return;
    let cancelled = false;
    // Start from the persisted set so already-known empties never flash back in
    const known = new Set(emptyRefs);
    (async () => {
      for (let i = 0; i < sections.length; i += 5) {
        const batch = sections.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((sec) =>
            queryClient
              .fetchQuery({
                queryKey: ["sefaria-text-v3", sec.ref],
                queryFn: () => fetchAndZipSefaria(sec.ref, sec.altRefs),
                staleTime: 86400000,
              })
              .then((data) => ({ ref: sec.ref, data }))
              .catch(() => ({ ref: sec.ref, data: null })),
          ),
        );
        if (cancelled) return;
        results.forEach(({ ref, data }) => {
          if (!data) return; // errored — leave existing status unchanged
          if (segmentsHaveText(data)) known.delete(ref);
          else known.add(ref);
        });
        setEmptyRefs(new Set(known));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sections, queryClient]);

  // Sliced queries starting from 0
  const activeSections = visibleSections.slice(0, renderCount + 1);

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
  const flatItems = useMemo(() => {
    const items = [];
    activeSections.forEach((sec, i) => {
      const query = sectionQueries[i];

      items.push({
        type: "header",
        id: `hdr-${i}`,
        label: sec.label,
        sectionIndex: i,
      });

      if (!query || query.isLoading) {
        items.push({ type: "loading", id: `load-${sec.ref}`, sectionIndex: i });
        return;
      }
      if (query.isError) {
        items.push({ type: "error", id: `err-${sec.ref}`, sectionIndex: i });
        return;
      }
      if (query.data) {
        // Empty section: Sefaria has no text for this ref — render nothing (header only)
        if (query.data.length === 0) return;

        query.data.forEach((seg, segIndex) => {
          const hasH =
            seg.he && seg.he.replace(/<[^>]*>/g, "").trim().length > 0;
          const hasE =
            seg.en && seg.en.replace(/<[^>]*>/g, "").trim().length > 0;
          if (!(showHB && hasH) && !(showEN && hasE)) return;
          items.push({
            type: "segment",
            id: `seg-${i}-${segIndex}`,
            sanitizedHe: sanitizeHTML(seg.he),
            sanitizedEn: sanitizeHTML(seg.en),
            hasH,
            hasE,
            sectionIndex: i,
          });
        });
      }
    });
    return items;
  }, [activeSections, sectionQueries, showEN, showHB]);

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
      clearTimeout(scrollDebounce.current);
      scrollDebounce.current = setTimeout(() => {
        const headerElements = document.querySelectorAll(
          "[data-section-index]",
        );
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
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTocOpen(true)}
            >
              <List className="w-4 h-4" />
            </Button>
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
                  onClick={() => setFontScale((s) => clampScale(s - 0.1))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500 w-10 text-center tabular-nums">
                  {Math.round(fontScale * 100)}%
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => setFontScale((s) => clampScale(s + 0.1))}
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
              {loading && (
                <div className="py-10 flex justify-center">
                  <Loader2 className="animate-spin text-blue-500" />
                </div>
              )}
              {error && (
                <div className="py-10 flex justify-center text-red-500">
                  <AlertCircle className="w-8 h-8" />
                </div>
              )}
              {!loading && !error && (
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
            {jumpTargetSection !== null && (
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
              <div className="pb-8">
                {activeSections.map((sec, i) => {
                  const sectionItems = flatItems.filter(
                    (item) => item.sectionIndex === i,
                  );
                  return (
                    <div key={i} className="relative">
                      {sectionItems.map((item) => {
                        if (item.type === "header") {
                          return (
                            <div
                              key={item.id}
                              id={item.id}
                              data-section-index={item.sectionIndex}
                              className="sticky top-0 z-10 shadow-sm bg-white dark:bg-slate-950"
                            >
                              <SiddurHeader label={item.label} />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            id={item.id}
                            data-section-index={item.sectionIndex}
                          >
                            {item.type === "segment" && (
                              <SiddurSegment
                                sanitizedHe={item.sanitizedHe}
                                sanitizedEn={item.sanitizedEn}
                                hasH={item.hasH}
                                hasE={item.hasE}
                                showHB={showHB}
                                showEN={showEN}
                                fontScale={fontScale}
                              />
                            )}
                            {item.type === "loading" && <SiddurLoading />}
                            {item.type === "error" && <SiddurError />}
                          </div>
                        );
                      })}
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

      {/* DRAWER */}
      {tocOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
            onClick={() => setTocOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-slate-950 z-50 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
              <h2 className="text-lg font-bold">Contents</h2>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setTocOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {renderSearchBar()}

            <div className="flex-1 p-4 overflow-y-auto">
              <TocTree
                nodes={filteredTree}
                onSelect={(i) => {
                  jumpTo(i);
                  setTocOpen(false);
                }}
                refToIndex={visibleRefToIndex}
                isSearching={searchQuery.length > 0}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
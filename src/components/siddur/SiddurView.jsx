import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const fontScaleRef = useRef(1);
  const anchorRef = useRef(null);
  const scrollDebounce = useRef(null);
  const restoreAnchorRef = useRef(null);

  // NEW: Background measuring variables to eliminate layout thrashing
  const floatingHeaderRef = useRef(null);
  const headerHeightRef = useRef(48); // Fallback starter height
  const headerObserver = useRef(null);

  // NEW: Background measuring engine (Gets the real height without freezing the scroll)
  const setFloatingHeaderRef = useCallback((node) => {
    floatingHeaderRef.current = node;
    if (node) {
      headerHeightRef.current = node.offsetHeight;
      if (!headerObserver.current) {
        headerObserver.current = new ResizeObserver((entries) => {
          headerHeightRef.current = entries[0].target.offsetHeight;
        });
      }
      headerObserver.current.observe(node);
    } else {
      if (headerObserver.current) {
        headerObserver.current.disconnect();
        headerObserver.current = null;
      }
    }
  }, []);

  const isProgrammaticScroll = useRef(false);
  const programmaticScrollTimeout = useRef(null);

  const lockScroll = useCallback(() => {
    isProgrammaticScroll.current = true;
    clearTimeout(programmaticScrollTimeout.current);
    programmaticScrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 200);
  }, []);

  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);
  const [refToIndex, setRefToIndex] = useState({});
  const [range, setRange] = useState({ start: 0, end: 10 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState("toc");
  const [langMode, setLangMode] = useState("both");
  const [pendingJump, setPendingJump] = useState(null);
  const [tocOpen, setTocOpen] = useState(false);

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
    fontScaleRef.current = fontScale;
    try {
      localStorage.setItem("siddur-font-scale", String(fontScale));
    } catch {
      /* ignore */
    }
  }, [fontScale]);

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

  const jumpTo = useCallback((i) => {
    anchorRef.current = null;
    setPage("reader");
    setRange((prev) => ({
      start: 0,
      end: Math.max(prev.end, i + 10),
    }));
    setPendingJump(i);
  }, []);

  // URL parsing
  useEffect(() => {
    if (!sections.length) return;
    const parts = location.pathname.split("/");
    if (parts.length >= 5 && parts[2] === "section") {
      const sectionId = parseInt(parts[3], 10);
      const lang = parts[4];
      if (["en", "he", "both"].includes(lang)) setLangMode(lang);

      if (!isNaN(sectionId) && pendingJump !== sectionId) {
        const isAlreadyThere = anchorRef.current?.sectionIndex === sectionId;
        if (!isAlreadyThere || page !== "reader") {
          jumpTo(sectionId);
        }
      }
    }
  }, [location.pathname, sections.length, pendingJump, page, jumpTo]);

  // Cache-busted background prefetcher
  useEffect(() => {
    if (!sections.length) return;
    (async () => {
      for (let i = 0; i < sections.length; i += 5) {
        await Promise.all(
          sections.slice(i, i + 5).map((sec) =>
            queryClient.prefetchQuery({
              queryKey: ["sefaria-text-v2", sec.ref],
              queryFn: () => fetchAndZipSefaria(sec.ref),
              staleTime: 86400000,
            }),
          ),
        );
      }
    })();
  }, [sections, queryClient]);

  const activeSections = sections.slice(range.start, range.end + 1);

  const sectionQueries = useQueries({
    queries: activeSections.map((sec) => ({
      queryKey: ["sefaria-text-v2", sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref),
      staleTime: 86400000,
    })),
  });

  // FLAT ITEMS (With empty text safety net)
  const flatItems = useMemo(() => {
    const items = [];
    activeSections.forEach((sec, i) => {
      const globalIndex = range.start + i;
      const query = sectionQueries[i];

      items.push({
        type: "header",
        id: `hdr-${globalIndex}`,
        label: sec.label,
        sectionIndex: globalIndex,
      });

      if (query.isLoading) {
        items.push({
          type: "loading",
          id: `load-${sec.ref}`,
          sectionIndex: globalIndex,
        });
        return;
      }
      if (query.isError) {
        items.push({
          type: "error",
          id: `err-${sec.ref}`,
          sectionIndex: globalIndex,
        });
        return;
      }
      if (query.data) {
        if (query.data.length === 0) {
          items.push({
            type: "segment",
            id: `seg-${globalIndex}-empty`,
            sanitizedHe: "",
            sanitizedEn:
              "<span class='italic opacity-50'>No text provided by Sefaria for this section.</span>",
            hasH: false,
            hasE: true,
            sectionIndex: globalIndex,
          });
          return;
        }

        query.data.forEach((seg, segIndex) => {
          const hasH =
            seg.he && seg.he.replace(/<[^>]*>/g, "").trim().length > 0;
          const hasE =
            seg.en && seg.en.replace(/<[^>]*>/g, "").trim().length > 0;
          if (!(showHB && hasH) && !(showEN && hasE)) return;
          items.push({
            type: "segment",
            id: `seg-${globalIndex}-${segIndex}`,
            sanitizedHe: sanitizeHTML(seg.he),
            sanitizedEn: sanitizeHTML(seg.en),
            hasH,
            hasE,
            sectionIndex: globalIndex,
          });
        });
      }
    });
    return items;
  }, [activeSections, sectionQueries, showEN, showHB, range.start]);

  const flatItemsRef = useRef(flatItems);
  flatItemsRef.current = flatItems;

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 150,
    overscan: 20,
  });

  // Force virtualizer to recalculate ALL sizes immediately when layout changes
  useEffect(() => {
    if (virtualizer) {
      virtualizer.measure();
    }
  }, [fontScale, langMode, virtualizer]);

  // Smooth jump engine
  useEffect(() => {
    if (pendingJump === null || page !== "reader") return;
    lockScroll();
    requestAnimationFrame(() => {
      const idx = flatItemsRef.current.findIndex(
        (it) => it.type === "header" && it.sectionIndex === pendingJump,
      );
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: "start" });
        anchorRef.current = {
          id: `hdr-${pendingJump}`,
          offset: 0,
          sectionIndex: pendingJump,
        };
      }
    });
    setPendingJump(null);
  }, [pendingJump, page, virtualizer, lockScroll]);

  // Anchor engine
  const captureAnchor = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const virtualItems = virtualizer.getVirtualItems();
    if (!virtualItems.length) return;
    const topVI =
      virtualItems.find((vi) => vi.start + vi.size > scrollTop) ||
      virtualItems[0];
    const item = flatItemsRef.current[topVI.index];
    if (!item) return;
    anchorRef.current = {
      id: item.id,
      offset: scrollTop - topVI.start,
      sectionIndex: item.sectionIndex,
    };
  }, [virtualizer]);

  const restoreAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || !scrollRef.current) return;

    let idx = flatItems.findIndex((it) => it.id === anchor.id);
    if (idx === -1 && anchor.sectionIndex !== undefined) {
      idx = flatItems.findIndex(
        (it) => it.type === "header" && it.sectionIndex === anchor.sectionIndex,
      );
    }
    if (idx === -1) return;

    const virtualItems = virtualizer.getVirtualItems();
    const vi = virtualItems.find((v) => v.index === idx);

    if (!vi) {
      lockScroll();
      virtualizer.scrollToIndex(idx, { align: "start" });
      return;
    }

    const target = vi.start + anchor.offset;
    if (Math.abs(scrollRef.current.scrollTop - target) > 1) {
      lockScroll();
      scrollRef.current.scrollTop = target;
    }
  }, [virtualizer, flatItems, lockScroll]);

  restoreAnchorRef.current = restoreAnchor;

  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!anchorRef.current || page !== "reader") return;
    restoreAnchorRef.current();
  }, [fontScale, langMode, flatItems.length, page, totalSize]);

  // JANK-FREE SCROLL HANDLER (Now with dynamic, anti-thrashing height calculation)
  const onScroll = useCallback(
    (e) => {
      const el = e.target;
      const scrollTop = el.scrollTop;

      // 1. O(1) DOM READ PHASE - NO LAYOUT THRASHING!
      const headerEl = floatingHeaderRef.current;
      const headerHeight = headerHeightRef.current;

      // 2. LOGIC & WRITE PHASE
      if (headerEl && virtualizer) {
        const vItems = virtualizer.getVirtualItems();
        const nextHeader = vItems.find(
          (vi) =>
            flatItemsRef.current[vi.index]?.type === "header" &&
            vi.start > scrollTop,
        );

        if (nextHeader) {
          const dist = nextHeader.start - scrollTop;
          if (dist < headerHeight) {
            headerEl.style.transform = `translateY(${dist - headerHeight}px)`;
          } else {
            headerEl.style.transform = `translateY(0px)`;
          }
        } else {
          headerEl.style.transform = `translateY(0px)`;
        }
      }

      if (isProgrammaticScroll.current) return;
      captureAnchor();

      clearTimeout(scrollDebounce.current);
      scrollDebounce.current = setTimeout(() => {
        const virtualItems = virtualizer.getVirtualItems();
        const top = virtualItems[0];
        if (!top) return;
        const item = flatItemsRef.current[top.index];
        if (!item || item.sectionIndex === undefined) return;

        const base = location.pathname.split("/")[1] || "Siddur";
        const newUrl = `/${base}/section/${item.sectionIndex}/${langMode}`;
        window.history.replaceState(null, "", newUrl);
      }, 150);

      if (scrollTop + el.clientHeight > el.scrollHeight - 1500) {
        if (range.end < sections.length - 1) {
          setRange((r) => ({
            ...r,
            end: Math.min(sections.length - 1, r.end + 5),
          }));
        }
      }
      if (scrollTop < 1000 && range.start > 0) {
        setRange((r) => ({ start: Math.max(0, r.start - 5), end: r.end }));
      }
    },
    [
      captureAnchor,
      virtualizer,
      location.pathname,
      langMode,
      sections.length,
      range,
    ],
  );

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
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
          <div className="h-full overflow-y-auto px-4 pb-24 overscroll-y-contain">
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
              <TocTree nodes={tree} onSelect={jumpTo} refToIndex={refToIndex} />
            )}
          </div>
        )}

        {page === "reader" && (
          <div className="h-full relative overflow-hidden">
            {/* FLOATING STICKY HEADER ENGINE */}
            {(() => {
              const vItems = virtualizer.getVirtualItems();
              if (!vItems.length || !scrollRef.current) return null;

              const scrollTop = scrollRef.current.scrollTop;
              let activeHeader = null;

              const visibleItem =
                vItems.find((vi) => vi.start + vi.size > scrollTop) ||
                vItems[0];

              for (let i = visibleItem.index; i >= 0; i--) {
                if (flatItems[i] && flatItems[i].type === "header") {
                  activeHeader = flatItems[i];
                  break;
                }
              }

              return activeHeader ? (
                <div
                  ref={setFloatingHeaderRef} // <--- ATTACHES THE MEASURING TOOL HERE
                  className="absolute top-0 left-0 right-0 z-10 shadow-md will-change-transform"
                >
                  <SiddurHeader label={activeHeader.label} />
                </div>
              ) : null;
            })()}

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="h-full overflow-y-auto relative"
              style={{
                overflowAnchor: "none",
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((v) => {
                  const item = flatItems[v.index];
                  if (!item) return null;
                  return (
                    <div
                      key={v.key}
                      data-index={v.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        transform: `translateY(${v.start}px)`,
                        width: "100%",
                      }}
                    >
                      {item.type === "header" && (
                        <SiddurHeader label={item.label} />
                      )}
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
            </div>
          </div>
        )}
      </div>

      {/* DRAWER */}
      {tocOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm"
            onClick={() => setTocOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-slate-950 z-50 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
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
            <div className="p-4">
              <TocTree
                nodes={tree}
                onSelect={(i) => {
                  jumpTo(i);
                  setTocOpen(false);
                }}
                refToIndex={refToIndex}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
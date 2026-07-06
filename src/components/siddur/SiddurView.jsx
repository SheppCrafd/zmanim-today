import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NavMenu from "@/components/NavMenu";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchAndZipSefaria } from "@/hooks/useSefaria";
import { processSefariaSchema } from "@/lib/siddurSchema";
import TocTree from "@/components/siddur/TocTree";

const clampScale = (scale) =>
  Math.max(0.5, Math.min(3, Math.round(scale * 100) / 100));

// Step 2 & 6: Pre-compiled sanitization engine with asset stability guardrails
function sanitizeHTML(htmlString) {
  if (!htmlString) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  // Stripping layout-breaking tags and images to avoid post-render layout shifts
  const badTags = doc.querySelectorAll(
    "script, iframe, object, embed, style, link, meta, base, img",
  );
  badTags.forEach((el) => el.remove());

  const allElements = doc.querySelectorAll("*");
  allElements.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
  });
  return doc.body.innerHTML;
}

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const activeSectionRef = useRef(null);
  const fontScaleRef = useRef(1);
  const activeAnchorRef = useRef(null);
  const anchorTimeoutRef = useRef(null);

  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);
  const [refToIndex, setRefToIndex] = useState({});

  // Step 1: Replace unstable range states with an index-based viewport tracker
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 4 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState("toc");
  const [langMode, setLangMode] = useState("both");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Fetch structural schema
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

  // Global background prefetch worker to fill cache smoothly
  useEffect(() => {
    if (sections.length === 0) return;
    const prefetchAllSections = async () => {
      const batchSize = 5;
      for (let i = 0; i < sections.length; i += batchSize) {
        await Promise.all(
          sections.slice(i, i + batchSize).map((sec) =>
            queryClient.prefetchQuery({
              queryKey: ["sefaria-text", sec.ref],
              queryFn: async () => {
                const rawData = await fetchAndZipSefaria(sec.ref);
                return rawData.map((seg) => ({
                  ...seg,
                  sanitizedHe: sanitizeHTML(seg.he),
                  sanitizedEn: sanitizeHTML(seg.en),
                  hasHebrew:
                    (seg.he ? seg.he.replace(/<[^>]*>/g, "").trim() : "")
                      .length > 0,
                  hasEnglish:
                    (seg.en ? seg.en.replace(/<[^>]*>/g, "").trim() : "")
                      .length > 0,
                }));
              },
              staleTime: 1000 * 60 * 60 * 24,
            }),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };
    prefetchAllSections();
  }, [sections, queryClient]);

  // Step 1: Compute target viewport query window (Overscan adjusted to protect memory)
  const activeSectionWindow = useMemo(() => {
    if (!sections.length) return [];
    const start = Math.max(0, visibleRange.start - 3);
    const end = Math.min(sections.length - 1, visibleRange.end + 3);
    const targetSlice = [];
    for (let i = start; i <= end; i++) {
      targetSlice.push({ sec: sections[i], index: i });
    }
    return targetSlice;
  }, [sections, visibleRange]);

  // Step 2: Offload parsing routines into the cache execution lifecycle
  const sectionQueries = useQueries({
    queries: activeSectionWindow.map(({ sec }) => ({
      queryKey: ["sefaria-text", sec.ref],
      queryFn: async () => {
        const rawData = await fetchAndZipSefaria(sec.ref);
        if (!Array.isArray(rawData)) return [];
        return rawData.map((seg) => ({
          ...seg,
          sanitizedHe: sanitizeHTML(seg.he),
          sanitizedEn: sanitizeHTML(seg.en),
          hasHebrew:
            (seg.he ? seg.he.replace(/<[^>]*>/g, "").trim() : "").length > 0,
          hasEnglish:
            (seg.en ? seg.en.replace(/<[^>]*>/g, "").trim() : "").length > 0,
        }));
      },
      staleTime: 1000 * 60 * 60 * 24,
    })),
  });

  // Map active query streams to static component indexes
  const queriesMap = useMemo(() => {
    const map = {};
    activeSectionWindow.forEach(({ index }, i) => {
      map[index] = sectionQueries[i];
    });
    return map;
  }, [activeSectionWindow, sectionQueries]);

  // Step 1 & 4: Virtualizer tracking static document schemas
  const virtualizer = useVirtualizer({
    count: sections.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => sections[index]?.ref || index,
    estimateSize: () => 250,
    overscan: 3,
    onChange: (instance) => {
      if (page !== "reader") return;
      const items = instance.getVirtualItems();
      if (!items.length) return;

      const start = items[0].index;
      const end = items[items.length - 1].index;

      setVisibleRange((prev) => {
        if (prev.start === start && prev.end === end) return prev;
        return { start, end };
      });

      const topItem = items[0];
      if (topItem && topItem.index !== activeSectionRef.current) {
        activeSectionRef.current = topItem.index;
        const basePath = "/" + location.pathname.split("/")[1];

        if (anchorTimeoutRef.current) clearTimeout(anchorTimeoutRef.current);
        anchorTimeoutRef.current = setTimeout(() => {
          navigate(`${basePath}/section/${topItem.index}/${langMode}`, {
            replace: true,
          });
        }, 120);
      }
    },
  });

  // Step 4: Clear size nodes globally when typography configurations change
  useEffect(() => {
    virtualizer.measure();
  }, [fontScale, langMode, virtualizer]);

  // Absolute instant-jump positioning mechanics
  const jumpTo = (i) => {
    setPage("reader");
    setIsSidebarOpen(false);
    setTimeout(() => {
      virtualizer.scrollToIndex(i, { align: "start" });
    }, 16);
  };

  // Safe internal anchor matrix builders
  const captureAnchorData = () => {
    if (!scrollRef.current) return null;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return null;

    const scrollTop = scrollRef.current.scrollTop;
    const trueTopItem =
      items.find((item) => item.start + item.size > scrollTop) || items[0];
    const offsetPx = scrollTop - trueTopItem.start;

    return {
      index: trueTopItem.index,
      percentage: Math.max(0, offsetPx / (trueTopItem.size || 1)),
    };
  };

  const lockAnchorSession = () => {
    if (!activeAnchorRef.current) activeAnchorRef.current = captureAnchorData();
    if (anchorTimeoutRef.current) clearTimeout(anchorTimeoutRef.current);
    anchorTimeoutRef.current = setTimeout(() => {
      activeAnchorRef.current = null;
    }, 500);
  };

  useEffect(
    () => () => {
      if (anchorTimeoutRef.current) clearTimeout(anchorTimeoutRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!activeAnchorRef.current || page !== "reader" || !scrollRef.current)
      return;
    const { index, percentage } = activeAnchorRef.current;

    const targetItem = virtualizer
      .getVirtualItems()
      .find((it) => it.index === index);
    if (targetItem) {
      const targetScrollTop = targetItem.start + targetItem.size * percentage;
      virtualizer.scrollToOffset(targetScrollTop);
    } else {
      virtualizer.scrollToIndex(index, { align: "start" });
    }
  }, [fontScale, page]);

  // Device Input Handlers
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || page !== "reader") return;

    let pinchStartDist = 0;
    let pinchStartScale = 1;
    const getDist = (touches) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = getDist(e.touches);
        pinchStartScale = fontScaleRef.current;
        lockAnchorSession();
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e.touches);
        if (pinchStartDist > 0) {
          lockAnchorSession();
          setFontScale(clampScale(pinchStartScale * (dist / pinchStartDist)));
        }
      }
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        lockAnchorSession();
        setFontScale((s) => clampScale(s + (e.deltaY > 0 ? -0.05 : 0.05)));
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("wheel", onWheel);
    };
  }, [page]);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <NavMenu />
            <div>
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <a href={sefariaUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
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
                  onClick={() => {
                    lockAnchorSession();
                    setFontScale((s) => clampScale(s - 0.05));
                  }}
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
                  onClick={() => {
                    lockAnchorSession();
                    setFontScale((s) => clampScale(s + 0.05));
                  }}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="ml-auto"
              >
                {isSidebarOpen ? (
                  <X className="w-4 h-4 mr-1" />
                ) : (
                  <Menu className="w-4 h-4 mr-1" />
                )}
                TOC
              </Button>
            </>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        {page === "toc" && (
          <div className="flex-1 h-full overflow-y-auto px-4 pb-24 w-full bg-white dark:bg-slate-950">
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
          <>
            {/* Main Reader View */}
            <div
              className="flex-1 h-full overflow-y-auto pb-24 bg-white dark:bg-slate-950 relative"
              ref={scrollRef}
              style={{ overflowAnchor: "none", willChange: "scroll-position" }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const sec = sections[virtualItem.index];
                  const query = queriesMap[virtualItem.index];
                  const hasNoEnglish = query?.data
                    ? !query.data.some((seg) => seg.hasEnglish)
                    : false;

                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualItem.start}px)`,
                        // Step 5: Native GPU Rendering Offload Optimization Layers
                        contain: "layout paint style",
                        contentVisibility: "auto",
                        willChange: "transform",
                      }}
                    >
                      {/* Section Title Header Block */}
                      <div
                        className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 shadow-sm px-2"
                        style={{
                          fontSize: `${Math.max(1, fontScale * 0.9)}em`,
                          paddingTop: "0.75em",
                          paddingBottom: "0.5em",
                        }}
                      >
                        <p className="font-semibold text-slate-700 dark:text-slate-100">
                          {sec?.label}
                        </p>
                        {showEN && !showHB && hasNoEnglish && (
                          <p className="mt-2 text-sm italic text-amber-600 dark:text-amber-400">
                            This section has no English
                          </p>
                        )}
                      </div>

                      {/* Content Streaming States */}
                      {(!query || query.isLoading) && (
                        <div className="py-8 flex justify-center">
                          <Loader2 className="animate-spin text-blue-500/70" />
                        </div>
                      )}

                      {query?.isError && (
                        <div className="py-6 flex justify-center items-center gap-2 text-red-500 text-sm">
                          <AlertCircle className="w-4 h-4" /> Error loading
                          compilation segment.
                        </div>
                      )}

                      {query?.data && (
                        <div className="flex flex-col">
                          {query.data.map((seg, segIndex) => {
                            const willShow =
                              (showHB && seg.hasHebrew) ||
                              (showEN && seg.hasEnglish);
                            if (!willShow) return null;

                            return (
                              <div
                                key={segIndex}
                                className="px-4"
                                style={{
                                  fontSize: `${fontScale}em`,
                                  paddingTop: "0.25em",
                                  paddingBottom: "1.5em",
                                }}
                              >
                                {showHB && seg.hasHebrew && (
                                  <p
                                    className="text-right text-[1.125em] leading-loose text-slate-800 dark:text-slate-100 font-serif min-h-[1.5em]"
                                    dir="rtl"
                                    dangerouslySetInnerHTML={{
                                      __html: seg.sanitizedHe,
                                    }}
                                  />
                                )}
                                {showEN && seg.hasEnglish && (
                                  <p
                                    className="text-left text-[0.875em] leading-relaxed text-slate-500 dark:text-slate-400 min-h-[1.5em]"
                                    style={{
                                      paddingTop:
                                        showHB && seg.hasHebrew ? "1em" : "0",
                                    }}
                                    dangerouslySetInnerHTML={{
                                      __html: seg.sanitizedEn,
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Overlay for TOC */}
            {isSidebarOpen && (
              <div className="absolute inset-y-0 right-0 w-72 bg-white dark:bg-slate-950 border-l shadow-2xl z-40 flex flex-col transition-transform duration-300 md:relative md:shadow-none">
                <div className="flex-1 overflow-y-auto px-4 pb-24 bg-white dark:bg-slate-950">
                  <TocTree
                    nodes={tree}
                    onSelect={jumpTo}
                    refToIndex={refToIndex}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="bg-slate-100 dark:bg-slate-900 border-t py-3 px-4 flex flex-col items-center justify-center gap-1 z-50 shrink-0">
        <a
          href="https://www.sefaria.org/texts"
          target="_blank"
          rel="noreferrer"
          className="transition-transform hover:scale-105"
        >
          <img
            src="https://files.readme.io/dcee0a8-image.png"
            alt="Powered by Sefaria"
            className="h-11 w-auto rounded-md shadow-sm bg-white"
          />
        </a>
        <div className="text-[10px] text-slate-500">
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

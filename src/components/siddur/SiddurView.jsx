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
  const isProgrammaticScroll = useRef(false);
  const anchorRef = useRef(null);
  const scrollDebounce = useRef(null);
  const restoreAnchorRef = useRef(null);

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

  // Persist font scale
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

  // Parse URL to restore reader state (deep-link support)
  useEffect(() => {
    if (!sections.length) return;
    const parts = location.pathname.split("/");
    // /SephardicSiddur/section/5/en
    if (parts.length >= 5 && parts[2] === "section") {
      const sectionId = parseInt(parts[3], 10);
      const lang = parts[4];
      if (["en", "he", "both"].includes(lang)) setLangMode(lang);
      if (!isNaN(sectionId) && page !== "reader") {
        jumpTo(sectionId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sections.length]);

  // Background prefetch all sections (sliding window cache)
  useEffect(() => {
    if (!sections.length) return;
    (async () => {
      for (let i = 0; i < sections.length; i += 5) {
        await Promise.all(
          sections.slice(i, i + 5).map((sec) =>
            queryClient.prefetchQuery({
              queryKey: ["sefaria-text", sec.ref],
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
      queryKey: ["sefaria-text", sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref),
      staleTime: 86400000,
    })),
  });

  // -------------------------
  // FLAT ITEMS
  // -------------------------
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

  // -------------------------
  // VIRTUALIZER
  // -------------------------
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 20,
  });

  // -------------------------
  // ANCHOR ENGINE (id-based — survives index shifts)
  // -------------------------
  const captureAnchor = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const virtualItems = virtualizer.getVirtualItems();
    if (!virtualItems.length) return;
    const topVI =
      virtualItems.find((vi) => vi.start + vi.size > scrollTop) ||
      virtualItems[0];
    const item = flatItems[topVI.index];
    if (!item) return;
    anchorRef.current = {
      id: item.id,
      offset: scrollTop - topVI.start,
      sectionIndex: item.sectionIndex,
    };
  }, [virtualizer, flatItems]);

  const restoreAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || !scrollRef.current) return;

    // Try exact id match first
    let idx = flatItems.findIndex((it) => it.id === anchor.id);
    // Fallback: find the section header (survives language toggle filtering)
    if (idx === -1 && anchor.sectionIndex !== undefined) {
      idx = flatItems.findIndex(
        (it) =>
          it.type === "header" && it.sectionIndex === anchor.sectionIndex,
      );
    }
    if (idx === -1) return;

    const virtualItems = virtualizer.getVirtualItems();
    const vi = virtualItems.find((v) => v.index === idx);
    if (!vi) {
      // Item not currently virtualized — scroll to bring it into view
      isProgrammaticScroll.current = true;
      virtualizer.scrollToIndex(idx, { align: "start" });
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
      return;
    }

    const target = vi.start + anchor.offset;
    if (Math.abs(scrollRef.current.scrollTop - target) > 1) {
      isProgrammaticScroll.current = true;
      scrollRef.current.scrollTop = target;
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    }
  }, [virtualizer, flatItems]);
  restoreAnchorRef.current = restoreAnchor;

  // Restore anchor synchronously after DOM commit (before paint) to prevent visible jumps.
  // totalSize dep re-fires after ResizeObserver corrects dynamic measurements (fine-tuning pass).
  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!anchorRef.current || page !== "reader") return;
    restoreAnchorRef.current();
  }, [fontScale, langMode, flatItems.length, page, totalSize]);

  // -------------------------
  // PROGRAMMATIC JUMP
  // -------------------------
  useEffect(() => {
    if (pendingJump === null || page !== "reader") return;
    const idx = flatItems.findIndex(
      (it) => it.type === "header" && it.sectionIndex === pendingJump,
    );
    if (idx !== -1) {
      isProgrammaticScroll.current = true;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(idx, { align: "start" });
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
      });
    }
    setPendingJump(null);
  }, [pendingJump, page, flatItems, virtualizer]);

  const jumpTo = useCallback(
    (i) => {
      anchorRef.current = null; // clear anchor so restore doesn't fight the jump
      setPage("reader");
      setRange({
        start: Math.max(0, i - 5),
        end: Math.min(sections.length - 1, i + 10),
      });
      setPendingJump(i);
    },
    [sections.length],
  );

  // -------------------------
  // SCROLL HANDLER
  // -------------------------
  const onScroll = useCallback(
    (e) => {
      if (isProgrammaticScroll.current) return;
      const el = e.target;

      // Continuously update anchor so any async layout change can restore it
      captureAnchor();

      // Debounced URL sync (replace: true — no history bloat)
      clearTimeout(scrollDebounce.current);
      scrollDebounce.current = setTimeout(() => {
        const virtualItems = virtualizer.getVirtualItems();
        const top = virtualItems[0];
        if (!top) return;
        const item = flatItems[top.index];
        if (!item || item.sectionIndex === undefined) return;
        const base = location.pathname.split("/")[1];
        navigate(`/${base}/section/${item.sectionIndex}/${langMode}`, {
          replace: true,
        });
      }, 150);

      // Downward expansion
      if (el.scrollTop + el.clientHeight > el.scrollHeight - 1500) {
        setRange((r) =>
          r.end < sections.length - 1
            ? { ...r, end: Math.min(sections.length - 1, r.end + 5) }
            : r,
        );
      }

      // Upward expansion — anchor engine restores scroll position after prepend
      if (el.scrollTop < 1000 && range.start > 0) {
        setRange((r) => ({ start: Math.max(0, r.start - 5), end: r.end }));
      }
      },
      [
      captureAnchor,
      virtualizer,
      flatItems,
      location.pathname,
      langMode,
      navigate,
      sections.length,
      range.start,
      ],
      );

  // -------------------------
  // RENDER
  // -------------------------
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
            <Button size="sm" variant="outline" onClick={() => setTocOpen(true)}>
              <List className="w-4 h-4" />
            </Button>
            <a href={sefariaUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>

        {/* CONTROLS */}
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
                  onClick={() =>
                    setFontScale((s) => clampScale(s - 0.1))
                  }
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
                  onClick={() =>
                    setFontScale((s) => clampScale(s + 0.1))
                  }
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
        {/* TOC VIEW */}
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
              <TocTree
                nodes={tree}
                onSelect={jumpTo}
                refToIndex={refToIndex}
              />
            )}
          </div>
        )}

        {/* VIRTUALIZED READER VIEW */}
        {page === "reader" && (
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
        )}
      </div>

      {/* RIGHT-SIDE TOC DRAWER */}
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
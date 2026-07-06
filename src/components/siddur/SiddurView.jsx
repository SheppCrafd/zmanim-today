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

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const fontScaleRef = useRef(1);

  // -------------------------
  // SCROLL CONTROL STATE
  // -------------------------
  const isProgrammaticScroll = useRef(false);

  // -------------------------
  // ANCHOR SYSTEM
  // -------------------------
  const activeAnchorRef = useRef(null);
  const anchorTimeoutRef = useRef(null);

  const captureAnchor = () => {
    if (!scrollRef.current) return null;
    const items = virtualizer.getVirtualItems();
    if (!items.length) return null;

    const scrollTop = scrollRef.current.scrollTop;

    const current =
      items.find((it) => it.start + it.size > scrollTop) || items[0];

    const offset = scrollTop - current.start;

    return {
      index: current.index,
      offsetRatio: offset / (current.size || 1),
    };
  };

  const lockAnchor = () => {
    if (!activeAnchorRef.current) {
      activeAnchorRef.current = captureAnchor();
    }

    clearTimeout(anchorTimeoutRef.current);
    anchorTimeoutRef.current = setTimeout(() => {
      activeAnchorRef.current = null;
    }, 500);
  };

  const restoreAnchor = () => {
    const anchor = activeAnchorRef.current;
    if (!anchor) return;

    const items = virtualizer.getVirtualItems();
    const target = items.find((it) => it.index === anchor.index);

    if (!target) return;

    const scrollTop = target.start + target.size * anchor.offsetRatio;

    isProgrammaticScroll.current = true;

    requestAnimationFrame(() => {
      virtualizer.scrollToOffset(scrollTop);
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    });
  };

  // -------------------------
  // STATE
  // -------------------------
  const [pendingJump, setPendingJump] = useState(null);
  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);
  const [refToIndex, setRefToIndex] = useState({});
  const [range, setRange] = useState({ start: 0, end: 10 });

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
    localStorage.setItem("siddur-font-scale", String(fontScale));
    lockAnchor();
  }, [fontScale]);

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

  // -------------------------
  // PREFETCH
  // -------------------------
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
  }, [sections]);

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
        items.push({ type: "loading", id: sec.ref });
        return;
      }

      if (query.isError) {
        items.push({ type: "error", id: sec.ref });
        return;
      }

      query.data?.forEach((seg, segIndex) => {
        const hasH = seg.he && seg.he.replace(/<[^>]*>/g, "").trim().length > 0;
        const hasE = seg.en && seg.en.replace(/<[^>]*>/g, "").trim().length > 0;

        if (!(showHB && hasH) && !(showEN && hasE)) return;

        items.push({
          type: "segment",
          id: `seg-${globalIndex}-${segIndex}`,
          sanitizedHe: sanitizeHTML(seg.he),
          sanitizedEn: sanitizeHTML(seg.en),
          hasH,
          hasE,
        });
      });
    });

    return items;
  }, [activeSections, sectionQueries, showEN, showHB]);

  // -------------------------
  // VIRTUALIZER
  // -------------------------
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 12,
  });

  // -------------------------
  // JUMP SYSTEM
  // -------------------------
  useEffect(() => {
    if (pendingJump === null || page !== "reader") return;

    const idx = flatItems.findIndex(
      (i) => i.type === "header" && i.sectionIndex === pendingJump,
    );

    if (idx !== -1) {
      isProgrammaticScroll.current = true;

      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(idx, { align: "start" });

        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
      });

      setPendingJump(null);
    }
  }, [pendingJump, flatItems]);

  // -------------------------
  // SCROLL HANDLER (CLEAN)
  // -------------------------
  let scrollDebounce = useRef(null);

  const onScroll = (e) => {
    if (isProgrammaticScroll.current) return;

    const el = e.target;

    lockAnchor();

    clearTimeout(scrollDebounce.current);
    scrollDebounce.current = setTimeout(() => {
      const top = virtualizer.getVirtualItems()[0];
      if (!top) return;

      const item = flatItems[top.index];
      if (!item) return;

      navigate(
        `${location.pathname.split("/")[1]}/section/${
          item.sectionIndex
        }/${langMode}`,
        { replace: true },
      );
    }, 120);

    // lazy extend
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 1200) {
      setRange((r) => ({
        ...r,
        end: Math.min(sections.length - 1, r.end + 5),
      }));
    }
  };

  // -------------------------
  // RESTORE ANCHOR ON LAYOUT CHANGE
  // -------------------------
  useLayoutEffect(() => {
    restoreAnchor();
  }, [fontScale, langMode, flatItems.length]);

  // -------------------------
  // JUMP API
  // -------------------------
  const jumpTo = (i) => {
    setPage("reader");
    setRange({
      start: Math.max(0, i - 2),
      end: Math.min(sections.length - 1, i + 6),
    });
    setPendingJump(i);
    setIsSidebarOpen(false);
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
      <div className="sticky top-0 z-50 border-b bg-white dark:bg-slate-950">
        <div className="flex justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>

          <a href={sefariaUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {page === "reader" && (
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="h-full overflow-y-auto relative"
            style={{ overflowAnchor: "none" }}
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
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      transform: `translateY(${v.start}px)`,
                      width: "100%",
                    }}
                  >
                    {item.type === "header" && (
                      <div className="px-3 py-2 font-semibold bg-slate-50 dark:bg-slate-900">
                        {item.label}
                      </div>
                    )}

                    {item.type === "segment" && (
                      <div
                        className="px-4 py-2"
                        style={{ fontSize: `${fontScale}em` }}
                      >
                        {showHB && item.hasH && (
                          <p
                            dir="rtl"
                            dangerouslySetInnerHTML={{
                              __html: item.sanitizedHe,
                            }}
                          />
                        )}
                        {showEN && item.hasE && (
                          <p
                            dangerouslySetInnerHTML={{
                              __html: item.sanitizedEn,
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
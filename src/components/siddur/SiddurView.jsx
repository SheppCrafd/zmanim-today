import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAndZipSefaria } from '@/hooks/useSefaria';
import { processSefariaSchema } from '@/lib/siddurSchema';
import TocTree from '@/components/siddur/TocTree';

/* ---------------- NATIVE SANITIZER ---------------- */
function sanitizeHTML(htmlString) {
  if (!htmlString) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const badTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, base');
  badTags.forEach(el => el.remove());

  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes).map(attr => attr.name);
    attrs.forEach(attrName => el.removeAttribute(attrName));
  });

  return doc.body.innerHTML;
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const scrollRef = useRef(null);
  const activeSectionRef = useRef(null);
  const fontScaleRef = useRef(1);
  const anchorRef = useRef(null);
  const [pendingJump, setPendingJump] = useState(null);

  const [tree, setTree] = useState([]);
  const [sections, setSections] = useState([]);
  const [refToIndex, setRefToIndex] = useState({});
  const [range, setRange] = useState({ start: 0, end: 10 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useState('toc');
  const [langMode, setLangMode] = useState('both');
  const [fontScale, setFontScale] = useState(() => {
    try {
      const saved = localStorage.getItem('siddur-font-scale');
      return saved ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });

  // Keep ref in sync for touch handlers + persist
  useEffect(() => {
    fontScaleRef.current = fontScale;
    try { localStorage.setItem('siddur-font-scale', String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  /* ---------------- LOAD TOC ---------------- */
  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then(r => r.json())
      .then(data => {
        const schema = data?.schema || {};
        const { tree, flat, refToIndex } = processSefariaSchema(schema);
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

  /* ---------------- SILENT BACKGROUND PREFETCHER ---------------- */
  useEffect(() => {
    if (sections.length === 0) return;

    const prefetchAllSections = async () => {
      const batchSize = 5;
      for (let i = 0; i < sections.length; i += batchSize) {
        const batch = sections.slice(i, i + batchSize);
        await Promise.all(
          batch.map(sec =>
            queryClient.prefetchQuery({
              queryKey: ['sefaria-text', sec.ref],
              queryFn: () => fetchAndZipSefaria(sec.ref),
              staleTime: 1000 * 60 * 60 * 24,
            })
          )
        );
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    prefetchAllSections();
  }, [sections, queryClient]);

  /* ---------------- DATA FETCHING (USE QUERIES) ---------------- */
  const activeSections = sections.slice(range.start, range.end + 1);

  const sectionQueries = useQueries({
    queries: activeSections.map(sec => ({
      queryKey: ['sefaria-text', sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref),
      staleTime: 1000 * 60 * 60 * 24,
    }))
  });

  /* ---------------- FLATTEN THE STATE ---------------- */
  const flatItems = useMemo(() => {
    const items = [];
    activeSections.forEach((sec, i) => {
      const currentSectionIndex = range.start + i;
      const query = sectionQueries[i];

      // Detect if this section's segments completely lack English translation
      let hasNoEnglish = false;
      if (query.data && query.data.length > 0) {
        const hasAnyEnglish = query.data.some(seg => {
          const text = seg.en ? seg.en.replace(/<[^>]*>/g, '').trim() : '';
          return text.length > 0;
        });
        hasNoEnglish = !hasAnyEnglish;
      }

      items.push({
        type: 'header',
        label: sec.label,
        sectionIndex: currentSectionIndex,
        hasNoEnglish
      });

      if (query.isLoading) {
        items.push({ type: 'loading', id: `load-${sec.ref}`, sectionIndex: currentSectionIndex });
      } else if (query.isError) {
        items.push({ type: 'error', id: `err-${sec.ref}`, sectionIndex: currentSectionIndex });
      } else if (query.data) {
        query.data.forEach(seg => {
          items.push({ type: 'segment', ...seg, sectionIndex: currentSectionIndex });
        });
      }
    });
    return items;
  }, [activeSections, sectionQueries, range.start]);

  /* ---------------- VIRTUALIZER INITIALIZATION ---------------- */
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,
    overscan: 15,
  });

  // Capture the top visible item + pixel offset within it, to preserve scroll on font scaling
  const captureAnchor = () => {
    const el = scrollRef.current;
    if (!el) return;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;
    const topItem = items[0];
    anchorRef.current = {
      index: topItem.index,
      offset: el.scrollTop - topItem.start
    };
  };

  // After font scale changes, restore scroll so the anchored content stays at the top
  useLayoutEffect(() => {
    if (!anchorRef.current || !scrollRef.current) return;
    const { index, offset } = anchorRef.current;

    const restore = () => {
      if (!scrollRef.current || !anchorRef.current) return;
      const newStart = virtualizer.getOffsetForIndex(index);
      scrollRef.current.scrollTop = newStart + offset;
    };

    const rafId = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });

    return () => cancelAnimationFrame(rafId);
  }, [fontScale]);

  /* ---------------- URL SYNCING ---------------- */
  const visibleItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (page !== 'reader' || visibleItems.length === 0) return;

    const topItemIndex = visibleItems[0].index;
    const topItem = flatItems[topItemIndex];

    if (topItem && topItem.sectionIndex !== activeSectionRef.current) {
      activeSectionRef.current = topItem.sectionIndex;

      const basePath = '/' + location.pathname.split('/')[1];

      navigate(
        `${basePath}/section/${topItem.sectionIndex}/${langMode}`,
        { replace: true }
      );
    }
  }, [visibleItems, flatItems, page, langMode, navigate, location.pathname]);

  /* ---------------- SCROLL WINDOW (expand end only — keeps indices stable) ---------------- */
  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 1500) {
      setRange(r => ({
        start: r.start,
        end: Math.min(sections.length - 1, r.end + 5)
      }));
    }
  };

  /* ---------------- PERFECT JUMPING ---------------- */
  const jumpTo = (i) => {
    setPage('reader');
    setRange(r => ({
      start: 0,
      end: Math.max(r.end, i + 6)
    }));
    setPendingJump(i);
  };

  useEffect(() => {
    if (pendingJump === null || page !== 'reader') return;

    const targetIndex = flatItems.findIndex(
      item => item.type === 'header' && item.sectionIndex === pendingJump
    );

    if (targetIndex !== -1) {
      virtualizer.scrollToIndex(targetIndex, { align: 'start' });
      setPendingJump(null);
    }
  }, [pendingJump, page, flatItems, virtualizer]);

  /* ---------------- PINCH-TO-ZOOM (mobile) + CTRL+WHEEL (desktop) ---------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || page !== 'reader') return;

    let pinchStartDist = 0;
    let pinchStartScale = 1;

    const getDist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = getDist(e.touches);
        pinchStartScale = fontScaleRef.current;
        captureAnchor();
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e.touches);
        if (pinchStartDist > 0) {
          const newScale = pinchStartScale * (dist / pinchStartDist);
          setFontScale(Math.max(0.5, Math.min(3, Math.round(newScale * 10) / 10)));
        }
      }
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        captureAnchor();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setFontScale(s => Math.max(0.5, Math.min(3, Math.round((s + delta) * 10) / 10)));
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
    };
  }, [page]);

  /* ---------------- RENDER ---------------- */
  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

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
            <Button size="sm" variant="outline"><ExternalLink className="w-4 h-4" /></Button>
          </a>
        </div>
        <div className="px-4 flex items-center gap-2 py-2 flex-wrap">
          <Button size="sm" variant={langMode === 'en' ? "default" : "outline"} onClick={() => setLangMode('en')}>EN</Button>
          <Button size="sm" variant={langMode === 'he' ? "default" : "outline"} onClick={() => setLangMode('he')}>HB</Button>
          <Button size="sm" variant={langMode === 'both' ? "default" : "outline"} onClick={() => setLangMode('both')}>BOTH</Button>

          {page === 'reader' && (
            <>
              <div className="flex items-center gap-1 ml-2">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { captureAnchor(); setFontScale(s => Math.max(0.5, Math.round((s - 0.1) * 10) / 10)); }}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500 w-10 text-center tabular-nums">{Math.round(fontScale * 100)}%</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { captureAnchor(); setFontScale(s => Math.min(3, Math.round((s + 0.1) * 10) / 10)); }}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPage('toc')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">

        {/* TOC VIEW */}
        {page === 'toc' && (
          <div className="h-full overflow-y-auto px-4 pb-24">
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

        {/* VIRTUALIZED READER VIEW */}
        {page === 'reader' && (
          <div
            className="h-full overflow-y-auto px-4 pb-24"
            onScroll={onScroll}
            ref={scrollRef}
          >
            {/* The Virtualizer Wrapper */}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flatItems[virtualItem.index];

                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="py-2"
                  >
                    {/* Render Header */}
                    {item.type === 'header' && (
                      <div className="bg-white dark:bg-slate-900 py-2 border-b mb-4">
                        <p className="font-semibold text-slate-700 dark:text-slate-100">
                          {item.label}
                        </p>
                        {showEN && !showHB && item.hasNoEnglish && (
                          <p className="mt-2 text-sm italic text-amber-600 dark:text-amber-400">
                            This section has no English
                          </p>
                        )}
                      </div>
                    )}

                    {/* Render Loading State */}
                    {item.type === 'loading' && (
                      <div className="py-6 flex justify-center">
                        <Loader2 className="animate-spin text-blue-500" />
                      </div>
                    )}

                    {/* Render Mapped Segment */}
                    {item.type === 'segment' && (
                      <div className="space-y-2 mb-6" style={{ fontSize: `${fontScale}em` }}>
                        {showHB && (
                          <p
                            className="text-right text-[1.125em] leading-loose text-slate-800 dark:text-slate-100 font-serif min-h-[1.5em]"
                            dir="rtl"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.he) }}
                          />
                        )}
                        {showEN && (
                          <p
                            className="text-left text-[0.875em] leading-relaxed text-slate-500 dark:text-slate-400 min-h-[1.5em]"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.en) }}
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

      {/* --- SEFARIA ATTRIBUTION FOOTER --- */}
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
          and the{' '}
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
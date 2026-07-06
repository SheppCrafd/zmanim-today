import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, AlertCircle, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAndZipSefaria } from '@/hooks/useSefaria';
import { processSefariaSchema } from '@/lib/siddurSchema';
import TocTree from '@/components/siddur/TocTree';

const clampScale = (scale) => Math.max(0.5, Math.min(3, Math.round(scale * 100) / 100));

function sanitizeHTML(htmlString) {
  if (!htmlString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const badTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, base');
  badTags.forEach(el => el.remove());
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
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
      return parseFloat(localStorage.getItem('siddur-font-scale')) || 1;
    } catch {
      return 1;
    }
  });

  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  useEffect(() => {
    fontScaleRef.current = fontScale;
    try { localStorage.setItem('siddur-font-scale', String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then(r => r.json())
      .then(data => {
        const { tree, flat, refToIndex } = processSefariaSchema(data?.schema || {});
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

  useEffect(() => {
    if (sections.length === 0) return;
    const prefetchAllSections = async () => {
      const batchSize = 5;
      for (let i = 0; i < sections.length; i += batchSize) {
        await Promise.all(
          sections.slice(i, i + batchSize).map(sec =>
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

  const activeSections = sections.slice(range.start, range.end + 1);
  const sectionQueries = useQueries({
    queries: activeSections.map(sec => ({
      queryKey: ['sefaria-text', sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref),
      staleTime: 1000 * 60 * 60 * 24,
    }))
  });

  // 1. Create a stable tracker that only changes when query statuses change (Fixes DOMParser CPU loop)
  const queryTracker = JSON.stringify(
    sectionQueries.map(q => ({ status: q.status, updated: q.dataUpdatedAt }))
  );

  const flatItems = useMemo(() => {
    const items = [];
    activeSections.forEach((sec, i) => {
      const currentSectionIndex = range.start + i;
      const query = sectionQueries[i];

      const hasNoEnglish = query.data ? !query.data.some(seg =>
        (seg.en ? seg.en.replace(/<[^>]*>/g, '').trim() : '').length > 0
      ) : false;

      items.push({ type: 'header', id: `hdr-${currentSectionIndex}`, label: sec.label, sectionIndex: currentSectionIndex, hasNoEnglish });

      if (query.isLoading) {
        items.push({ type: 'loading', id: `load-${sec.ref}`, sectionIndex: currentSectionIndex });
      } else if (query.isError) {
        items.push({ type: 'error', id: `err-${sec.ref}`, sectionIndex: currentSectionIndex });
      } else if (query.data) {
        query.data.forEach((seg, segIndex) => {
          const hasHebrew = (seg.he ? seg.he.replace(/<[^>]*>/g, '').trim() : '').length > 0;
          const hasEnglish = (seg.en ? seg.en.replace(/<[^>]*>/g, '').trim() : '').length > 0;

          // 2. Filter out 0-height items entirely so the virtualizer doesn't choke!
          const willShow = (showHB && hasHebrew) || (showEN && hasEnglish);
          if (!willShow) return;

          items.push({
            type: 'segment',
            id: `seg-${currentSectionIndex}-${segIndex}`, // Bulletproof key
            ...seg,
            sanitizedHe: sanitizeHTML(seg.he),
            sanitizedEn: sanitizeHTML(seg.en),
            hasHebrew,
            hasEnglish,
            sectionIndex: currentSectionIndex
          });
        });
      }
    });
    return items;
  }, [activeSections, queryTracker, range.start, showHB, showEN]); // Use stable trackers!

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => flatItems[index]?.id || index,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (!item) return 100;

      if (item.type === 'header') return 45 * fontScale;
      if (item.type === 'loading' || item.type === 'error') return 100;

      if (item.type === 'segment') {
        let chars = 0;
        if (showHB && item.hasHebrew) chars += item.sanitizedHe.length;
        if (showEN && item.hasEnglish) chars += item.sanitizedEn.length;

        const lines = Math.max(1, chars / 60);
        return (lines * 30 * fontScale) + 30;
      }
      return 100;
    },
    overscan: 15,
    // 3. Move the scroll-tracking logic here to avoid React useEffect render loops
    onChange: (instance) => {
      if (page !== 'reader') return;
      const items = instance.getVirtualItems();
      if (!items.length) return;
      
      const topItem = flatItems[items[0].index];
      if (topItem && topItem.sectionIndex !== activeSectionRef.current) {
        activeSectionRef.current = topItem.sectionIndex;
        const basePath = '/' + location.pathname.split('/')[1];
        
        // Defer state updates to avoid React render conflicts
        setTimeout(() => {
          navigate(`${basePath}/section/${topItem.sectionIndex}/${langMode}`, { replace: true });
        }, 0);
      }
    }
  });

  const measureRef = useRef(virtualizer.measure);
  useEffect(() => {
    measureRef.current = virtualizer.measure;
  }, [virtualizer.measure]);

  useEffect(() => {
    measureRef.current();
  }, [fontScale, langMode]);

  // 4. Implement bi-directional scroll detection
  const onScroll = (e) => {
    const el = e.target;
    
    // Scroll Down Detection
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 1500) {
      setRange(r => ({ start: r.start, end: Math.min(sections.length - 1, r.end + 5) }));
    }
    
    // Scroll Up Detection
    if (el.scrollTop < 1500 && range.start > 0) {
      lockAnchorSession(); // Must lock before injecting items above to stop violent snapping
      setRange(r => ({ ...r, start: Math.max(0, r.start - 5) }));
    }
  };

  const jumpTo = (i) => {
    setPage('reader');
    // 5. Window the jump! Do not load the entire book at once (0 to i)
    setRange({ 
      start: Math.max(0, i - 2), 
      end: Math.min(sections.length - 1, i + 6) 
    });
    setPendingJump(i);
  };

  useEffect(() => {
    if (pendingJump === null || page !== 'reader') return;
    const targetIndex = flatItems.findIndex(item => item.type === 'header' && item.sectionIndex === pendingJump);
    if (targetIndex !== -1) {
      virtualizer.scrollToIndex(targetIndex, { align: 'start' });
      setPendingJump(null);
    }
  }, [pendingJump, page, flatItems, virtualizer]);

  const captureAnchorData = () => {
    if (!scrollRef.current) return null;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return null;

    const scrollTop = scrollRef.current.scrollTop;
    const trueTopItem = items.find(item => item.start + item.size > scrollTop) || items[0];
    const offsetPx = scrollTop - trueTopItem.start;

    return {
      index: trueTopItem.index,
      percentage: Math.max(0, offsetPx / (trueTopItem.size || 1)),
    };
  };

  const lockAnchorSession = () => {
    if (!activeAnchorRef.current) activeAnchorRef.current = captureAnchorData();
    if (anchorTimeoutRef.current) clearTimeout(anchorTimeoutRef.current);
    anchorTimeoutRef.current = setTimeout(() => { activeAnchorRef.current = null; }, 500);
  };

  useEffect(() => () => { if (anchorTimeoutRef.current) clearTimeout(anchorTimeoutRef.current); }, []);

  useLayoutEffect(() => {
    if (!activeAnchorRef.current || page !== 'reader' || !scrollRef.current) return;
    const { index, percentage } = activeAnchorRef.current;

    const targetItem = virtualizer.getVirtualItems().find(it => it.index === index);
    if (targetItem) {
      const targetScrollTop = targetItem.start + (targetItem.size * percentage);
      virtualizer.scrollToOffset(targetScrollTop);
    } else {
      virtualizer.scrollToIndex(index, { align: 'start' });
    }
  }, [fontScale, page]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || page !== 'reader') return;

    let pinchStartDist = 0;
    let pinchStartScale = 1;
    const getDist = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

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
        setFontScale(s => clampScale(s + (e.deltaY > 0 ? -0.05 : 0.05)));
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
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                  lockAnchorSession();
                  setFontScale(s => clampScale(s - 0.05));
                }}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500 w-10 text-center tabular-nums">
                  {Math.round(fontScale * 100)}%
                </span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                  lockAnchorSession();
                  setFontScale(s => clampScale(s + 0.05));
                }}>
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
        {page === 'toc' && (
          <div className="h-full overflow-y-auto px-4 pb-24">
            {loading && <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>}
            {error && <div className="py-10 flex justify-center text-red-500"><AlertCircle className="w-8 h-8" /></div>}
            {!loading && !error && <TocTree nodes={tree} onSelect={jumpTo} refToIndex={refToIndex} />}
          </div>
        )}

        {page === 'reader' && (
          <div
            className="h-full overflow-y-auto px-4 pb-24"
            onScroll={onScroll}
            ref={scrollRef}
            style={{ overflowAnchor: 'none' }}
          >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flatItems[virtualItem.index];
                
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    // contain: content ensures the browser cleanly locks the height of this node
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`, contain: 'content' }}
                  >
                    {item.type === 'header' && (
                      <div className="bg-white dark:bg-slate-900 border-b px-2" style={{ fontSize: `${Math.max(1, fontScale * 0.9)}em`, paddingTop: '0.75em', paddingBottom: '0.5em' }}>
                        <p className="font-semibold text-slate-700 dark:text-slate-100">{item.label}</p>
                        {showEN && !showHB && item.hasNoEnglish && <p className="mt-2 text-sm italic text-amber-600 dark:text-amber-400">This section has no English</p>}
                      </div>
                    )}

                    {item.type === 'loading' && <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>}

                    {item.type === 'segment' && (
                      <div style={{ fontSize: `${fontScale}em`, paddingTop: '0.25em', paddingBottom: '1.5em' }}>
                        {showHB && item.hasHebrew && (
                          <p
                            className="text-right text-[1.125em] leading-loose text-slate-800 dark:text-slate-100 font-serif min-h-[1.5em]"
                            dir="rtl"
                            dangerouslySetInnerHTML={{ __html: item.sanitizedHe }}
                          />
                        )}
                        {showEN && item.hasEnglish && (
                          <p
                            // Margins collapsed out of the measurement boundary. Converted to padding!
                            className="text-left text-[0.875em] leading-relaxed text-slate-500 dark:text-slate-400 min-h-[1.5em]"
                            style={{ paddingTop: showHB ? '1em' : '0' }}
                            dangerouslySetInnerHTML={{ __html: item.sanitizedEn }}
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

      {/* FOOTER */}
      <div className="bg-slate-100 dark:bg-slate-900 border-t py-3 px-4 flex flex-col items-center justify-center gap-1 z-50 shrink-0">
        <a href="https://www.sefaria.org/texts" target="_blank" rel="noreferrer" className="transition-transform hover:scale-105">
          <img src="https://files.readme.io/dcee0a8-image.png" alt="Powered by Sefaria" className="h-11 w-auto rounded-md shadow-sm bg-white" />
        </a>
        <div className="text-[10px] text-slate-500">
          and the{' '}<a href="https://developers.sefaria.org" target="_blank" rel="noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Sefaria API</a>
        </div>
      </div>
    </div>
  );
}
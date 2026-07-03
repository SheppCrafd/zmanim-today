import React, { useState, useEffect, useRef } from 'react';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/* ---------------- API & REACT QUERY HOOKS ---------------- */

const fetchSefariaText = async (ref) => {
  if (!ref) return null;
  const encodedRef = encodeURIComponent(ref);
  
  // Fire both requests simultaneously
  const [hebResp, engResp] = await Promise.all([
    fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&context=0`),
    fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=english|Sefaria%20Community%20Translation&context=0`)
  ]);

  if (!hebResp.ok || !engResp.ok) throw new Error("Failed to fetch Sefaria API");

  const hebData = await hebResp.json();
  const engData = await engResp.json();

  return { hebData, engData };
};

export function useSefariaText(ref) {
  return useQuery({
    queryKey: ['sefaria-text', ref],
    queryFn: () => fetchSefariaText(ref),
    staleTime: 1000 * 60 * 60 * 24, // Cache the text for 24 hours
    refetchOnWindowFocus: false,
    enabled: !!ref, // Only fetch if a ref actually exists
  });
}

/* ---------------- TOC CATEGORIZER ---------------- */
function getCategory(breadcrumb) {
  const lower = (breadcrumb || '').toLowerCase();
  
  if (lower.includes('shacharit') || lower.includes('morning')) return 'Shacharit';
  if (lower.includes('mussaf') || lower.includes('musaf')) return 'Mussaf';
  if (lower.includes('mincha') || lower.includes('minha') || lower.includes('afternoon')) return 'Mincha';
  if (lower.includes('maariv') || lower.includes("ma'ariv") || lower.includes('arvit') || lower.includes('arbit') || lower.includes('evening')) return "Ma'ariv / Arbit";
  
  return 'Other';
}

/* ---------------- TOC FLATTEN ---------------- */
function flattenNodes(nodes, keyPath = '', labelPath = '') {
  const result = [];

  for (const node of nodes) {
    const key = node.key || node.title;
    const fullKeyPath = keyPath ? `${keyPath}, ${key}` : key;
    const fullLabelPath = labelPath ? `${labelPath} > ${node.title}` : node.title;

    if (node.nodes) {
      result.push(...flattenNodes(node.nodes, fullKeyPath, fullLabelPath));
    } else {
      result.push({
        label: node.title,
        heLabel: node.heTitle,
        breadcrumb: fullLabelPath,
        ref: fullKeyPath
      });
    }
  }

  return result;
}

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

/* ---------------- LEGACY EXTRACTOR (To be replaced in Phase 2) ---------------- */
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];
  const version = data.versions.find(v => v.language === expectedLang);
  if (!version || !version.text) return [];

  const rawArray = Array.isArray(version.text) ? version.text : [version.text];

  if (expectedLang === 'en') {
    return rawArray.map(line => {
      const containsHebrew = /[\u0590-\u05FF]/.test(line || '');
      return containsHebrew ? '' : line;
    });
  }
  return rawArray;
};

/* ---------------- SECTION ---------------- */
function Section({ sec, langMode, rowRef, index }) {
  const { data, isLoading, isError } = useSefariaText(sec.ref);

  // The wrapper div MUST always render so rowRefs.current[index] is never null!
  return (
    <div
      ref={rowRef}
      data-index={index}
      className="space-y-4 scroll-mt-24 min-h-[120px] pb-6"
    >
      <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
        <p className="font-semibold text-slate-700 dark:text-slate-100">
          {sec.label}
        </p>
      </div>

      {isLoading && (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      )}

      {isError && (
        <div className="text-center text-sm text-red-500 py-6">
          Failed to load section
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          {(() => {
            const heArr = extractText(data.hebData, 'he') || [];
            const enArr = extractText(data.engData, 'en') || [];
            const showEN = langMode !== 'he';
            const showHB = langMode !== 'en';
            const maxLen = Math.max(heArr.length, enArr.length);

            return Array.from({ length: maxLen }).map((_, i) => (
              <div key={i} className="space-y-2">
                {showHB && heArr[i] && (
                  <p
                    className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif"
                    dir="rtl"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(heArr[i]) }}
                  />
                )}

                {showEN && enArr[i] && (
                  <p
                    className="text-left text-sm leading-relaxed text-slate-500 dark:text-slate-400"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(enArr[i]) }}
                  />
                )}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient(); // Inject React Query Client

  const scrollRef = useRef(null);
  const rowRefs = useRef({});
  const observerRef = useRef(null);
  const [pendingJump, setPendingJump] = useState(null);

  const [sections, setSections] = useState([]);
  const [range, setRange] = useState({ start: 0, end: 5 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useState('toc');
  const [langMode, setLangMode] = useState('both');

  const currentSection = useRef(0);

  /* ---------------- LOAD TOC ---------------- */
  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then(r => r.json())
      .then(data => {
        const nodes = data?.schema?.nodes || [];
        const rootKey = data?.schema?.key || bookRef.replace(/_/g, ' ');

        const flat = flattenNodes(nodes, rootKey);

        setSections(flat);
        setLoading(false);
        setRange({ start: 0, end: 5 });
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [bookRef]);

  /* ---------------- REACT QUERY PREFETCHING ---------------- */
  useEffect(() => {
    if (!sections.length || page !== 'reader') return;

    // Aggressively prefetch the NEXT 3 sections invisibly in the background
    const prefetchEnd = Math.min(sections.length - 1, range.end + 3);
    
    for (let i = range.start; i <= prefetchEnd; i++) {
      const refToFetch = sections[i]?.ref;
      if (refToFetch) {
        queryClient.prefetchQuery({
          queryKey: ['sefaria-text', refToFetch],
          queryFn: () => fetchSefariaText(refToFetch)
        });
      }
    }
  }, [range, sections, queryClient, page]);

  /* ---------------- OBSERVER ---------------- */
  useEffect(() => {
    if (!sections.length || page !== 'reader') return;

    if (observerRef.current) observerRef.current.disconnect();

    const basePath = '/' + location.pathname.split('/')[1];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const index = Number(entry.target.dataset.index);
          if (Number.isNaN(index)) continue;

          currentSection.current = index;

          navigate(
            `${basePath}/section/${index}/${langMode}`,
            { replace: true }
          );
        }
      },
      {
        rootMargin: '-45% 0px -45% 0px'
      }
    );

    Object.values(rowRefs.current).forEach(el => {
      if (el) observerRef.current.observe(el);
    });

  }, [sections, langMode, navigate, location.pathname, page, range]);

  /* ---------------- SCROLL WINDOW ---------------- */
  const onScroll = (e) => {
      // CRITICAL GUARD: If we are programmatically jumping, 
      // ignore scroll events so we don't accidentally expand pagination mid-flight.
      if (pendingJump !== null) return;

      const el = e.target;

      if (el.scrollTop + el.clientHeight > el.scrollHeight - 800) {
        setRange(r => ({
          start: r.start,
          end: Math.min(sections.length - 1, r.end + 2)
        }));
      }

      if (el.scrollTop < 800) {
        setRange(r => ({
          start: Math.max(0, r.start - 2),
          end: r.end
        }));
      }
    };

  /* ---------------- FIXED JUMP ---------------- */
  const jumpTo = (i) => {
    setPage('reader');
    setRange({
      start: Math.max(0, i - 2),
      end: i + 6
    });
    setPendingJump(i);
  };

  const scrollToExactHeader = (targetIndex) => {
      const container = scrollRef.current;
      const el = rowRefs.current[targetIndex];

      if (!container || !el) return false;

      // Check if the container is still showing the empty/loading state.
      // If it's short, the text hasn't painted yet.
      if (el.offsetHeight < 100) return false;

      // Get exact screen coordinates
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Calculate the distance needed to make the top of the element (the header)
      // hit the exact top of the scroll window.
      const distanceToTop = elRect.top - containerRect.top;

      // Apply the math directly to the scrollbar
      container.scrollTop = container.scrollTop + distanceToTop;
    
      return true;
    };

  useEffect(() => {
    if (pendingJump === null || page !== 'reader') return;

    // 1. VERIFY DATA: Ensure React Query has the data before we even try to scroll
    const startIdx = Math.max(0, pendingJump - 2);
    let allReady = true;
    for (let j = startIdx; j <= pendingJump; j++) {
      const refToCheck = sections[j]?.ref;
      if (refToCheck) {
        const cachedData = queryClient.getQueryData(['sefaria-text', refToCheck]);
        if (!cachedData) {
          allReady = false;
          break;
        }
      }
    }

    if (!allReady) return; // Keep waiting for network

    // 2. VERIFY DOM: Data is in memory, now wait for React to paint it
    let attempts = 0;
    const maxAttempts = 50; // Give it about 800ms total to settle

    const executionLoop = () => {
      attempts++;
      
      // Fire our precision function
      const success = scrollToExactHeader(pendingJump);

      if (success) {
        // It successfully found the fully rendered text and aligned it.
        // We fire it one more time on the next frame just to ensure no 
        // late-stage layout shifts bumped it, then release the lock.
        requestAnimationFrame(() => {
          scrollToExactHeader(pendingJump);
          setPendingJump(null);
        });
      } else if (attempts < maxAttempts) {
        // Text is still painting. Try again next frame.
        requestAnimationFrame(executionLoop);
      } else {
        // Timeout safeguard
        setPendingJump(null);
      }
    };

    // Push the first check to the end of the event loop to let React commit
    setTimeout(() => {
      requestAnimationFrame(executionLoop);
    }, 0);

  }, [pendingJump, page, sections, queryClient]);

  /* ---------------- GROUP TOC ---------------- */
  const groupedSections = sections.reduce((acc, sec, index) => {
    const category = getCategory(sec.breadcrumb);
    if (!acc[category]) acc[category] = [];
    
    acc[category].push({ ...sec, originalIndex: index });
    return acc;
  }, {});

  const categoryOrder = ['Shacharit', 'Mussaf', 'Mincha', "Ma'ariv / Arbit", 'Other'];

  /* ---------------- RENDER ---------------- */
  return (
    <div className="h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

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

        <div className="px-4 flex gap-2 py-2">
          <Button size="sm" variant={langMode === 'en' ? "default" : "outline"} onClick={() => setLangMode('en')}>EN</Button>
          <Button size="sm" variant={langMode === 'he' ? "default" : "outline"} onClick={() => setLangMode('he')}>HB</Button>
          <Button size="sm" variant={langMode === 'both' ? "default" : "outline"} onClick={() => setLangMode('both')}>BOTH</Button>

          {page === 'reader' && (
            <Button size="sm" variant="outline" onClick={() => setPage('toc')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">

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

            {!loading && !error && categoryOrder.map(category => {
              const items = groupedSections[category];
              if (!items || items.length === 0) return null;

              return (
                <div key={category} className="mb-8">
                  <h2 className="font-bold text-xl text-slate-800 dark:text-slate-100 border-b-2 border-blue-500 pb-2 mb-2 mt-4 sticky top-0 bg-slate-50 dark:bg-slate-950">
                    {category}
                  </h2>
                  <div className="flex flex-col">
                    {items.map((sec) => (
                      <button
                        key={sec.originalIndex}
                        onClick={() => jumpTo(sec.originalIndex)}
                        className="w-full text-left py-3 border-b text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 px-2 rounded-sm transition-colors"
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {page === 'reader' && (
          <div
            className="h-full overflow-y-auto px-4 pb-24"
            onScroll={onScroll}
            ref={scrollRef}
          >
            {sections.slice(range.start, range.end + 1).map((sec, i) => {
              const index = range.start + i;

              return (
                <Section
                  key={index}
                  index={index}
                  sec={sec}
                  langMode={langMode}
                  rowRef={(el) => {
                    rowRefs.current[index] = el;
                  }}
                />
              );
            })}
          </div>
        )}

      </div>

      {/* --- SEFARIA ATTRIBUTION FOOTER --- */}
      <div className="bg-slate-100 dark:bg-slate-900 border-t py-3 px-4 flex flex-col items-center justify-center gap-1 z-50">
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
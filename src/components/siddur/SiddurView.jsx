import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueries } from '@tanstack/react-query';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSefariaText, usePrefetchSefariaText, fetchAndZipSefaria } from '@/hooks/useSefaria';

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

  // Use the browser's native parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // 1. Destroy dangerous tags completely
  const badTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, base');
  badTags.forEach(el => el.remove());

  // 2. Strip ALL attributes from remaining tags to kill inline event handlers
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

  const scrollRef = useRef(null);
  const [pendingJump, setPendingJump] = useState(null);

  const [sections, setSections] = useState([]);
  const [range, setRange] = useState({ start: 0, end: 5 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useState('toc');
  const [langMode, setLangMode] = useState('both');

  /* ---------------- LOAD TOC ---------------- */
  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then(r => r.json())
      .then(data => {
        const nodes = data?.schema?.nodes || [];
        const rootKey = data?.schema?.key || bookRef.replace(/_/g, ' ');
        setSections(flattenNodes(nodes, rootKey));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [bookRef]);

  /* ---------------- DATA FETCHING (USE QUERIES) ---------------- */
  const activeSections = sections.slice(range.start, range.end + 1);

  // Fetch all sections in the active range dynamically
  const sectionQueries = useQueries({
    queries: activeSections.map(sec => ({
      queryKey: ['sefaria-text', sec.ref],
      queryFn: () => fetchAndZipSefaria(sec.ref),
      staleTime: 1000 * 60 * 60 * 24,
    }))
  });

  /* ---------------- FLATTEN THE STATE ---------------- */
    const flatItems = React.useMemo(() => {
      const items = [];
      activeSections.forEach((sec, i) => {
        const currentSectionIndex = range.start + i; // 1. Calculate it once per section
      
        items.push({ 
          type: 'header', 
          label: sec.label, 
          sectionIndex: currentSectionIndex 
        });
      
        const query = sectionQueries[i];
        if (query.isLoading) {
          items.push({ type: 'loading', id: `load-${sec.ref}`, sectionIndex: currentSectionIndex });
        } else if (query.isError) {
          items.push({ type: 'error', id: `err-${sec.ref}`, sectionIndex: currentSectionIndex });
        } else if (query.data) {
          // 2. Attach it to every single segment!
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
    estimateSize: () => 100, // Guesses each row is 100px until measured
    overscan: 10,            // Keeps 10 rows rendered off-screen for smoothness
  });

  /* ---------------- SCROLL WINDOW ---------------- */
  const onScroll = (e) => {
    const el = e.target;
    // Keep expanding the range when we near the bottom of the virtualized list
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 1000) {
      setRange(r => ({
        start: r.start,
        end: Math.min(sections.length - 1, r.end + 2)
      }));
    }
    if (el.scrollTop < 1000) {
      setRange(r => ({
        start: Math.max(0, r.start - 2),
        end: r.end
      }));
    }
  };

  /* ---------------- PERFECT JUMPING ---------------- */
  const jumpTo = (i) => {
    setPage('reader');
    setRange({ start: Math.max(0, i - 2), end: i + 6 });
    setPendingJump(i);
  };

  // Natively scroll to the exact header index once the data loads
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

  /* ---------------- GROUP TOC ---------------- */
  const groupedSections = sections.reduce((acc, sec, index) => {
    const category = getCategory(sec.breadcrumb);
    if (!acc[category]) acc[category] = [];
    acc[category].push({ ...sec, originalIndex: index });
    return acc;
  }, {});

  const categoryOrder = ['Shacharit', 'Mussaf', 'Mincha', "Ma'ariv / Arbit", 'Other'];

  /* ---------------- RENDER ---------------- */
  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* TOP BAR (Unchanged) */}
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
        <div className="px-4 flex gap-2 py-2">
          <Button size="sm" variant={langMode === 'en' ? "default" : "outline"} onClick={() => setLangMode('en')}>EN</Button>
          <Button size="sm" variant={langMode === 'he' ? "default" : "outline"} onClick={() => setLangMode('he')}>HB</Button>
          <Button size="sm" variant={langMode === 'both' ? "default" : "outline"} onClick={() => setLangMode('both')}>BOTH</Button>
          {page === 'reader' && (
            <Button size="sm" variant="outline" onClick={() => setPage('toc')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">
        
        {/* TOC VIEW */}
        {page === 'toc' && (
           // ... (Leave your TOC mapping code here exactly as it was) ...
           <div className="h-full overflow-y-auto px-4 pb-24">
             {/* Replace this comment with your TOC rendering logic */}
             {categoryOrder.map(category => {
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
                    ref={virtualizer.measureElement} // Dynamic measurement magic!
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`, // Places the element dynamically
                    }}
                    className="py-2"
                  >
                    {/* Render Header */}
                    {item.type === 'header' && (
                      <div className="bg-white dark:bg-slate-900 py-2 border-b mb-4">
                        <p className="font-semibold text-slate-700 dark:text-slate-100">
                          {item.label}
                        </p>
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
                      <div className="space-y-2 mb-6">
                        {showHB && (
                          <p
                            className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif min-h-[1.5rem]"
                            dir="rtl"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.he) }}
                          />
                        )}
                        {showEN && (
                          <p
                            className="text-left text-sm leading-relaxed text-slate-500 dark:text-slate-400 min-h-[1.5rem]"
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
    </div>
  );
}
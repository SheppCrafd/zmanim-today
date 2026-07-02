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
  
  // 2. Strip ALL attributes from remaining tags to kill inline event handlers (e.g., onerror, onclick, href="javascript:")
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    // Collect all attribute names
    const attrs = Array.from(el.attributes).map(attr => attr.name);
    // Remove them all
    attrs.forEach(attrName => el.removeAttribute(attrName));
  });
  
  return doc.body.innerHTML;
}

/* ---------------- SECTION ---------------- */
function Section({ sec, data, langMode, rowRef, index }) {
  if (!data) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="text-center text-sm text-red-500">
        Failed to load section
      </div>
    );
  }

  const heArr = data.he || [];
  const enArr = data.en || [];

  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  const maxLen = Math.max(heArr.length, enArr.length);

  return (
    <div
      ref={rowRef}
      data-index={index}
      className="space-y-4 scroll-mt-24"
    >
      <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
        <p className="font-semibold text-slate-700 dark:text-slate-100">
          {sec.label}
        </p>
      </div>

      <div className="space-y-6">
        {Array.from({ length: maxLen }).map((_, i) => (
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
        ))}
      </div>
    </div>
  );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollRef = useRef(null);
  const rowRefs = useRef({});
  const observerRef = useRef(null);
  const [pendingJump, setPendingJump] = useState(null);

  const [sections, setSections] = useState([]);
  const [textMap, setTextMap] = useState({});
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

  /* ---------------- TEXT WINDOW LOADING ---------------- */
  useEffect(() => {
    if (!sections.length) return;

    const load = async () => {
      for (let i = range.start; i <= range.end; i++) {
        if (!sections[i] || textMap[i]) continue;

        try {
          const ref = encodeURIComponent(sections[i].ref);
          
          // Fetch Hebrew (source)
          const hebResp = await fetch(
            `https://www.sefaria.org/api/v3/texts/${ref}?version=source&context=0`
          );
          const hebData = await hebResp.json();
          
          // Fetch English (Community Translation)
          const engResp = await fetch(
            `https://www.sefaria.org/api/v3/texts/${ref}?version=english|Sefaria%20Community%20Translation&context=0`
          );
          const engData = await engResp.json();

          // 1. Update the function to accept an expected language ('he' or 'en')
          const extractText = (data, expectedLang) => {
          if (!data?.versions || data.versions.length === 0) return [];

          // Find the version that explicitly matches 'he' or 'en'
          const version = data.versions.find(v => v.language === expectedLang);
        
          // If no version matches that language, return an empty array instead of a fallback
          if (!version || !version.text) return [];

          return Array.isArray(version.text) ? version.text : [version.text];
          };

          // 2. Pass the expected languages into the calls below it:
          const heArr = extractText(hebData, 'he');
          const enArr = extractText(engData, 'en');

          setTextMap(prev => ({ 
            ...prev, 
            [i]: { he: heArr, en: enArr } 
          }));
        } catch {
          setTextMap(prev => ({ ...prev, [i]: { error: true } }));
        }
      }
    };

    load();
  }, [range, sections]);

/* ---------------- OBSERVER ---------------- */
  useEffect(() => {
    if (!sections.length) return;

    if (observerRef.current) observerRef.current.disconnect();

    // Extract ONLY the base book route (e.g., "/ChabadSiddur")
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

  }, [sections, langMode, navigate, location.pathname]);

  /* ---------------- SCROLL WINDOW ---------------- */
  const onScroll = (e) => {
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

  useEffect(() => {
    if (pendingJump === null || page !== 'reader') return;

    // 1. Wait for the text to actually fetch from Sefaria
    const startIdx = Math.max(0, pendingJump - 2);
    let allReady = true;
    for (let j = startIdx; j <= pendingJump; j++) {
      if (!textMap[j]) {
        allReady = false;
        break;
      }
    }

    if (!allReady) return; // Data isn't here yet, keep waiting

    // 2. Data is ready! Now we align mathematically instead of trusting the browser.
    let attempts = 0;
    
    const tryAlign = () => {
      const container = scrollRef.current;
      const el = rowRefs.current[pendingJump];

      if (!container || !el) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Calculate the exact distance to the target header
      const targetTop = elRect.top - containerRect.top;

      // Snap the scrollbar exactly to that pixel
      if (Math.abs(targetTop) > 1) {
        container.scrollTop += targetTop;
      }
    };

    const loop = () => {
      attempts++;
      tryAlign();

      // "Lock" the scroll in place for 15 frames (~250ms).
      // As the heavy Hebrew/English text pops into the DOM and tries to shift the layout,
      // this loop will aggressively pin the target header right to the top.
      if (attempts < 15) {
        requestAnimationFrame(loop);
      } else {
        setPendingJump(null); // We are stable, release the jump lock
      }
    };

    requestAnimationFrame(loop);

  }, [textMap, pendingJump, page]);

  /* ---------------- GROUP TOC ---------------- */
  // Moved this ABOVE the return statement so the variables actually exist!
  const groupedSections = sections.reduce((acc, sec, index) => {
    const category = getCategory(sec.breadcrumb);
    if (!acc[category]) acc[category] = [];
    
    acc[category].push({ ...sec, originalIndex: index });
    return acc;
  }, {});

  const categoryOrder = ['Shacharit', 'Mussaf', 'Mincha', "Ma'ariv / Arbit", 'Other'];

  /* ---------------- RENDER ---------------- */
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
                  data={textMap[index]}
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
              
              {/* Clickable Badge Linking to Sefaria Library */}
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

              {/* Technical Credit Linking to API Portal */}
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
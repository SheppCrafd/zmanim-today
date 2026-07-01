import React, { useState, useEffect, useRef } from 'react';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate } from 'react-router-dom';

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
      <div className="text-center text-sm text-red-500 py-6">
        Failed to load section
      </div>
    );
  }

  // Use values directly from Sefaria's localized responses without letter-checking filters
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
        <p className="font-semibold text-slate-700 dark:text-slate-100 flex items-center justify-between">
          <span>{sec.label}</span>
          {sec.heLabel && (
            <span className="text-sm font-normal text-slate-400 font-serif" dir="rtl">
              {sec.heLabel}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-6">
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} className="space-y-2">

            {showHB && heArr[i] && (
              <p
                className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: heArr[i] }}
              />
            )}

            {showEN && enArr[i] && (
              <p
                className="text-left text-sm leading-relaxed text-slate-500 dark:text-slate-400"
                dangerouslySetInnerHTML={{ __html: enArr[i] }}
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

  const rowRefs = useRef({});
  const observerRef = useRef(null);

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
    // Keep using padded index API for full structural table of contents mapping
    fetch(`https://www.sefaria.org/api/v2/index/${bookRef}`)
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

  /* ---------------- WINDOW LOADING (SEFARIA V3 PARALLEL FETCH) ---------------- */

  useEffect(() => {
    if (!sections.length) return;

    const loadSections = async () => {
      for (let i = range.start; i <= range.end; i++) {
        if (!sections[i] || textMap[i]) continue;

        const ref = encodeURIComponent(sections[i].ref);
        const hebURL = `https://www.sefaria.org/api/v3/texts/${ref}?version=source&context=0`;
        const engURL = `https://www.sefaria.org/api/v3/texts/${ref}?version=english|Sefaria%20Community%20Translation&context=0`;

        try {
          // Parallel network execution precisely mirrors Sefaria's web application performance layer
          const [hebResp, engResp] = await Promise.all([
            fetch(hebURL),
            fetch(engURL)
          ]);

          const hebData = await hebResp.json();
          const engData = await engResp.json();

          // Standardize unstructured nodes or text fragments into strict iteration arrays
          const heArr = Array.isArray(hebData.he) ? hebData.he : (hebData.he ? [hebData.he] : []);
          const enArr = Array.isArray(engData.text) ? engData.text : (engData.text ? [engData.text] : []);

          setTextMap(prev => ({
            ...prev,
            [i]: { he: heArr, en: enArr }
          }));
        } catch (e) {
          setTextMap(prev => ({
            ...prev,
            [i]: { error: true }
          }));
        }
      }
    };

    loadSections();
  }, [range, sections, textMap]);

  /* ---------------- OBSERVER (CURRENT SECTION) ---------------- */

  useEffect(() => {
    if (!sections.length) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const index = Number(entry.target.dataset.index);
          if (Number.isNaN(index)) continue;

          currentSection.current = index;

          // Fixed dynamic interpolation to ensure compliance across all dynamic book types
          navigate(
            `/${bookRef}/section/${index}/${langMode}`,
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

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [sections, langMode, bookRef, navigate]);

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
      end: Math.min(sections.length - 1, i + 5)
    });

    const startTime = performance.now();
    const duration = 900; 

    const animate = (now) => {
      const el = rowRefs.current[i];
      const container = document.querySelector('.reader-container');

      if (!el || !container) {
        requestAnimationFrame(animate);
        return;
      }

      const target = el.offsetTop;
      const current = container.scrollTop;

      const progressRaw = (now - startTime) / duration;
      const progress = Math.min(progressRaw, 1); 

      const ease = 1 - Math.pow(1 - progress, 3);
      const next = current + (target - current) * ease;

      container.scrollTop = next;

      if (progressRaw < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 relative z-50">
            <NavMenu />
            <div>
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>

          <a href={sefariaUrl} target="_blank" rel="noopener noreferrer" className="relative z-50">
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
              TOC
            </Button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">

        {page === 'toc' && (
          <div className="h-full overflow-y-auto px-4 py-4 space-y-1">
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-blue-500" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center gap-2 text-red-500 py-10">
                <AlertCircle className="w-5 h-5" />
                <span>Failed to load Table of Contents.</span>
              </div>
            )}

            {!loading && !error && sections.map((sec, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className="w-full text-left py-3 px-3 border-b hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition-colors flex justify-between items-center"
              >
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{sec.label}</span>
                {sec.heLabel && <span className="text-xs text-slate-400 font-serif" dir="rtl">{sec.heLabel}</span>}
              </button>
            ))}
          </div>
        )}

        {page === 'reader' && (
          <div className="reader-container h-full overflow-y-auto px-4 pb-10 space-y-10" onScroll={onScroll}>
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
    </div>
  );
}
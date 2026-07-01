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

  const scrollRef = useRef(null);
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

          // In Sefaria v3, the text is nested under versions[0].text
          const extractText = (data) => {
            const textContent = data?.versions?.[0]?.text;
            if (!textContent) return [];
            return Array.isArray(textContent) ? textContent : [textContent];
          };

          const heArr = extractText(hebData);
          const enArr = extractText(engData);

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

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const index = Number(entry.target.dataset.index);
          if (Number.isNaN(index)) continue;

          currentSection.current = index;

          navigate(
            `/SephardicSiddur/section/${index}/${langMode}`,
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

  }, [sections, langMode, navigate]);

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

    const tryAlign = () => {
      const container = scrollRef.current;
      const el = rowRefs.current[i];

      if (!container || !el) return false;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      const targetTop = elRect.top - containerRect.top;

      const tolerance = 1; // pixel-perfect threshold

      if (Math.abs(targetTop) <= tolerance) return true;

      container.scrollTop += targetTop;

      return false;
    };

    requestAnimationFrame(() => {
      let attempts = 0;

      const loop = () => {
        attempts++;
        const done = tryAlign();

        if (!done && attempts < 10) {
          requestAnimationFrame(loop);
        }
      };

      loop();
    });
  };

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
              TOC
            </Button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">

        {page === 'toc' && (
          <div className="h-full overflow-y-auto px-4">
            {loading && <Loader2 className="animate-spin" />}
            {error && <AlertCircle />}

            {sections.map((sec, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className="w-full text-left py-3 border-b"
              >
                {sec.label}
              </button>
            ))}
          </div>
        )}

        {page === 'reader' && (
          <div
            className="h-full overflow-y-auto px-4 pb-10"
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
    </div>
  );
}
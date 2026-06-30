import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

/* ---------------- HELPERS ---------------- */

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
        index: result.length,
        label: node.title,
        heLabel: node.heTitle,
        breadcrumb: fullLabelPath,
        ref: fullKeyPath
      });
    }
  }

  return result;
}

const isEnglishLine = (t) => {
  if (!t) return false;
  const plain = t.replace(/<[^>]*>/g, '').trim();
  const latin = plain.match(/[A-Za-z]/g) || [];
  const hebrew = plain.match(/[\u0590-\u05FF]/g) || [];
  const total = latin.length + hebrew.length;
  if (total === 0) return false;
  return latin.length > 5 && (latin.length / total) > 0.75;
};

/* ---------------- SECTION ---------------- */

function Section({ sec, data, rowRef, langMode }) {
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

  const heArr = Array.isArray(data.he) ? data.he : (data.he ? [data.he] : []);
  const enRaw = Array.isArray(data.text) ? data.text : (data.text ? [data.text] : []);
  const enArr = enRaw.filter(isEnglishLine);

  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  const maxLen = Math.max(heArr.length, enArr.length);

  return (
    <div
    id={`section-${sec.ref}`}
    className="space-y-4 scroll-mt-24"
    >
      <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
        <p
        id={`sec-${sec.index}`}
         className="font-semibold"
        >
        {sec.label}
        </p>
      </div>

      <div className="space-y-6">
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} className="space-y-2">

            {showHB && heArr[i] && (
              <p
                className="text-right text-lg font-serif"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: heArr[i] }}
              />
            )}

            {showEN && enArr[i] && (
              <p
                className="text-sm text-slate-500"
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
    const rowRefs = useRef({});
    const observerRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [textMap, setTextMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [page, setPage] = useState('toc');
    const [langMode, setLangMode] = useState('both');

    const [currentSection, setCurrentSection] = useState(0);
    const [range, setRange] = useState({ start: 0, end: 4 });

    const navigate = useNavigate();
    const { sectionId } = useParams();

    /* ---------------- LOAD TOC (UNCHANGED) ---------------- */

    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const schema = data?.schema;
                const rootKey = schema?.key || bookRef.replace(/_/g, ' ');
                const nodes = schema?.nodes || [];

                const flat = flattenNodes(nodes, rootKey);

                setSections(flat);
                setLoading(false);

                setRange({ start: 0, end: Math.min(4, flat.length - 1) });
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [bookRef]);

    /* ---------------- WINDOWED TEXT LOAD ---------------- */

    useEffect(() => {
        if (!sections.length) return;

        const load = async () => {
            for (let i = range.start; i <= range.end; i++) {
                if (textMap[i]) continue;

                try {
                    const res = await fetch(
                        `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}?lang=bi`
                    );
                    const data = await res.json();

                    setTextMap(prev => ({ ...prev, [i]: data }));
                } catch {
                    setTextMap(prev => ({ ...prev, [i]: { error: true } }));
                }
            }
        };

        load();
    }, [range, sections]);

    /* ---------------- OBSERVER BRAIN (NEW CORE) ---------------- */

    useEffect(() => {
        if (!sections.length) return;

        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                let best = null;

                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;

                    const idx = Number(entry.target.dataset.index);

                    if (best === null || idx > best) best = idx;
                }

                if (best === null || best === currentSection) return;

                setCurrentSection(best);

                const lang = langMode;

                navigate(
                    `/SephardicSiddur/section/${best}/${lang}`,
                    { replace: true }
                );
            },
            {
                rootMargin: '-40% 0px -40% 0px'
            }
        );

        Object.values(rowRefs.current).forEach(el => {
            if (el) observerRef.current.observe(el);
        });

    }, [sections, langMode, currentSection]);

    /* ---------------- VIRTUAL WINDOW (INVISIBLE) ---------------- */

    useEffect(() => {
        const buffer = 2;

        setRange({
            start: Math.max(0, currentSection - buffer),
            end: Math.min(sections.length - 1, currentSection + buffer)
        });
    }, [currentSection, sections.length]);

    /* ---------------- TOC JUMP (UNCHANGED VISUAL) ---------------- */

    const jumpTo = (index) => {
        setPage('reader');
        setCurrentSection(index);

        navigate(`/SephardicSiddur/section/${index}/both`, {
            replace: true
        });

        requestAnimationFrame(() => {
            rowRefs.current[index]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    };

    /* ---------------- RENDER (UNCHANGED VISUAL STRUCTURE) ---------------- */

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

            <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">

                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 relative z-50">
                        <NavMenu />
                        <div>
                            <h1 className="text-lg font-bold">{title}</h1>
                            <p className="text-xs text-slate-500">{subtitle}</p>
                        </div>
                    </div>

                    <a href={sefariaUrl} target="_blank" className="relative z-50">
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

            <div className="flex-1 overflow-hidden">

                {page === 'toc' && (
                    <div className="h-full overflow-y-auto px-4">
                        {loading && <div className="py-10">Loading…</div>}
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
                    <div className="h-full overflow-y-auto px-4 pb-10">

                        {sections.slice(range.start, range.end + 1).map((sec, i) => {
                            const index = range.start + i;

                            return (
                                <div
                                    key={index}
                                    data-index={index}
                                    ref={(el) => {
                                        rowRefs.current[index] = el;
                                    }}
                                >
                                    <Section
                                        sec={sec}
                                        data={textMap[index]}
                                        langMode={langMode}
                                    />
                                </div>
                            );
                        })}

                    </div>
                )}

            </div>

        </div>
    );
}
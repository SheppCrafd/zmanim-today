import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- CACHE ---------------- */
const cache = {};

async function fetchSection(ref) {
    if (cache[ref]) return cache[ref];

    try {
        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=bi`
        );
        const data = await res.json();
        cache[ref] = data;
        return data;
    } catch {
        cache[ref] = { error: true };
        return cache[ref];
    }
}

/* ---------------- SECTION ---------------- */

function Section({ sec, index, data, langMode, setHeight, rowRef }) {
    if (!data) {
        return (
            <div ref={rowRef} className="py-10 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (data.error) {
        return (
            <div ref={rowRef} className="text-red-500 py-6">
                Failed to load section
            </div>
        );
    }

    const heArr = Array.isArray(data.he) ? data.he : (data.he ? [data.he] : []);
    const enRaw = Array.isArray(data.text) ? data.text : (data.text ? [data.text] : []);

    const showEN = langMode !== 'he';
    const showHB = langMode !== 'en';

    const ref = useRef(null);

    useEffect(() => {
        if (!ref.current) return;

        const measure = () => {
            setHeight(index, ref.current.offsetHeight);
        };

        measure();

        const obs = new ResizeObserver(measure);
        obs.observe(ref.current);

        return () => obs.disconnect();
    }, [data]);

    return (
        <div ref={(el) => { ref.current = el; rowRef(el); }} className="py-6 scroll-mt-24">

            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
                <p className="font-semibold">{sec.label}</p>
            </div>

            <div className="space-y-4">
                {heArr.map((h, i) => (
                    <div key={i}>
                        {showHB && (
                            <p
                                className="text-right font-serif text-lg"
                                dir="rtl"
                                dangerouslySetInnerHTML={{ __html: h }}
                            />
                        )}

                        {showEN && enRaw[i] && (
                            <p
                                className="text-sm text-slate-500"
                                dangerouslySetInnerHTML={{ __html: enRaw[i] }}
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

    const containerRef = useRef(null);
    const rowRefs = useRef({});
    const heights = useRef({});

    const [sections, setSections] = useState([]);
    const [textMap, setTextMap] = useState({});
    const [visible, setVisible] = useState({ start: 0, end: 10 });

    const [langMode, setLangMode] = useState('both');
    const [page, setPage] = useState('toc');

    /* TOC LOAD */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const rootKey = data?.schema?.key || bookRef;

                const flatten = (nodes, keyPath = '') => {
                    let out = [];
                    for (const n of nodes) {
                        const key = n.key || n.title;
                        const full = keyPath ? `${keyPath}, ${key}` : key;

                        if (n.nodes) {
                            out.push(...flatten(n.nodes, full));
                        } else {
                            out.push({ label: n.title, ref: full });
                        }
                    }
                    return out;
                };

                setSections(flatten(nodes, rootKey));
            });
    }, [bookRef]);

    /* REAL FETCH */
    useEffect(() => {
        const { start, end } = visible;

        for (let i = start; i <= end; i++) {
            const sec = sections[i];
            if (!sec) continue;

            fetchSection(sec.ref).then(data => {
                setTextMap(prev => ({ ...prev, [i]: data }));
            });
        }
    }, [visible, sections]);

    /* REAL HEIGHT TRACKING */
    const setHeight = (i, h) => {
        heights.current[i] = h;
    };

    /* REAL SCROLL CALC (NO APPROX) */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onScroll = () => {
            const scrollTop = el.scrollTop;

            let total = 0;
            let start = 0;

            for (let i = 0; i < sections.length; i++) {
                const h = heights.current[i] || 200;

                if (total <= scrollTop) start = i;
                total += h;

                if (total > scrollTop + el.clientHeight) {
                    setVisible({
                        start: Math.max(0, start - 2),
                        end: Math.min(sections.length - 1, i + 2)
                    });
                    break;
                }
            }
        };

        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [sections]);

    const jumpTo = (i) => {
        setPage('reader');

        let y = 0;
        for (let k = 0; k < i; k++) {
            y += heights.current[k] || 200;
        }

        requestAnimationFrame(() => {
            containerRef.current?.scrollTo({
                top: y,
                behavior: 'smooth'
            });
        });
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden">

            {/* TOP BAR */}
            <div className="border-b bg-white dark:bg-slate-900">
                <div className="flex justify-between p-3">
                    <div className="flex gap-2 items-center">
                        <NavMenu />
                        <div>
                            <div className="font-bold">{title}</div>
                            <div className="text-xs text-gray-500">{subtitle}</div>
                        </div>
                    </div>

                    <a href={sefariaUrl}>
                        <Button size="sm" variant="outline">
                            <ExternalLink />
                        </Button>
                    </a>
                </div>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-hidden">

                {page === 'toc' && (
                    <div className="h-full overflow-y-auto p-3">
                        {sections.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => jumpTo(i)}
                                className="block w-full text-left p-2 border-b"
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                )}

                {page === 'reader' && (
                    <div
                        ref={containerRef}
                        className="h-full overflow-y-auto p-4"
                    >
                        {sections.map((sec, i) => {
                            if (i < visible.start || i > visible.end) {
                                return <div key={i} style={{ height: 20 }} />;
                            }

                            return (
                                <Section
                                    key={i}
                                    index={i}
                                    sec={sec}
                                    data={textMap[i]}
                                    langMode={langMode}
                                    setHeight={setHeight}
                                    rowRef={(el) => (rowRefs.current[i] = el)}
                                />
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}
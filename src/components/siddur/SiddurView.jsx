import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK OUTER SCROLL ONLY ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
}

/* ---------------- FLATTEN ---------------- */
function flattenNodes(nodes, keyPath = '') {
    const out = [];

    for (const n of nodes) {
        const key = n.key || n.title;
        const full = keyPath ? `${keyPath}, ${key}` : key;

        if (n.nodes) {
            out.push(...flattenNodes(n.nodes, full));
        } else {
            out.push({
                label: n.title,
                heLabel: n.heTitle,
                ref: full
            });
        }
    }

    return out;
}

/* ---------------- TEXT ---------------- */
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(text) ? text : text ? [text] : [];

    const max = Math.max(heArr.length, enArr.length);

    return (
        <div className="space-y-6">
            {Array.from({ length: max }).map((_, i) => (
                <div key={i} className="space-y-2">
                    {heArr[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg font-serif"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}
                    {enArr[i] && (
                        <p className="text-sm text-slate-500"
                            dangerouslySetInnerHTML={{ __html: enArr[i] }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef }) {
    const containerRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(null);

    const WINDOW = 2;

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const root = data?.schema?.key || bookRef;
                setSections(flattenNodes(nodes, root));
            });
    }, [bookRef]);

    /* ---------------- LOAD SECTION ---------------- */
    const load = async (i) => {
        if (loaded[i] || !sections[i]) return;

        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}`
        );

        const data = await res.json();

        setLoaded(prev => ({ ...prev, [i]: data }));
    };

    /* ---------------- OPEN READER ---------------- */
    const openAt = async (i) => {
        setStartIndex(i);
        setActiveIndex(i);

        for (let x = i - WINDOW; x <= i + WINDOW; x++) {
            if (x >= 0 && x < sections.length) load(x);
        }
    };

    /* ---------------- INTERSECTION OBSERVER (NO SCROLL MATH) ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    const i = Number(entry.target.dataset.index);
                    setActiveIndex(i);

                    for (let x = i - WINDOW; x <= i + WINDOW; x++) {
                        if (x >= 0 && x < sections.length) load(x);
                    }
                });
            },
            {
                root: containerRef.current,
                threshold: 0.5
            }
        );

        const nodes = containerRef.current?.querySelectorAll('[data-index]');
        nodes?.forEach(n => observer.observe(n));

        return () => observer.disconnect();
    }, [startIndex, sections]);

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between">
                <div>
                    <NavMenu />
                    <h1 className="font-bold">{title}</h1>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>

                <Button variant="ghost" onClick={() => setStartIndex(null)}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
            </div>

            {/* SCROLL CONTAINER (BROWSER OWNS SCROLL) */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between p-3 border-b"
                            >
                                {sec.label}
                                <ChevronRight />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER (FULL DOM, BUT SAFE) */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {sections.map((sec, i) => {
                            const data = loaded[i];

                            if (!data) load(i);

                            return (
                                <div
                                    key={i}
                                    data-index={i}
                                    className="space-y-3"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    {data ? (
                                        <SectionText he={data.he} text={data.text} />
                                    ) : (
                                        <div className="py-6 flex justify-center">
                                            <Loader2 className="animate-spin" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>
        </div>
    );
}
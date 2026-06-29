import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL ---------------- */
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
                        <p dir="rtl" className="text-right text-lg font-serif"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }} />
                    )}
                    {enArr[i] && (
                        <p className="text-sm text-slate-500"
                            dangerouslySetInnerHTML={{ __html: enArr[i] }} />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef }) {
    const scrollRef = useRef(null);
    const startRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [active, setActive] = useState(0);
    const [startIndex, setStartIndex] = useState(null);

    const WINDOW = 3;

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

    /* ---------------- OPEN ---------------- */
    const openAt = async (i) => {
        setStartIndex(i);
        setActive(i);

        for (let x = i - WINDOW; x <= i + WINDOW; x++) {
            if (x >= 0 && x < sections.length) load(x);
        }

        setTimeout(() => {
            startRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    /* ---------------- ACTIVE TRACKING ---------------- */
    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;

        const scrollTop = el.scrollTop;
        const approx = Math.floor(scrollTop / 120); // stable estimate per section

        setActive(prev => {
            if (prev !== approx) {
                for (let i = approx - WINDOW; i <= approx + WINDOW; i++) {
                    if (i >= 0 && i < sections.length) load(i);
                }
                return approx;
            }
            return prev;
        });
    };

    /* ---------------- WINDOW ---------------- */
    const start = Math.max(0, active - WINDOW);
    const end = Math.min(sections.length - 1, active + WINDOW);

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

            {/* SCROLL */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {sections.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between p-3 border-b"
                            >
                                {s.label}
                                <ChevronRight />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER (TRUE VIRTUALIZATION) */}
                {startIndex !== null && (
                    <div className="p-4">

                        {/* TOP SPACER */}
                        <div style={{ height: start * 200 }} />

                        {sections.slice(start, end + 1).map((sec, i) => {
                            const realIndex = start + i;
                            const data = loaded[realIndex];

                            if (!data) load(realIndex);

                            return (
                                <div
                                    key={realIndex}
                                    ref={realIndex === startIndex ? startRef : null}
                                    className="mb-12"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    {data ? (
                                        <SectionText he={data.he} text={data.text} />
                                    ) : (
                                        <Loader2 className="animate-spin" />
                                    )}
                                </div>
                            );
                        })}

                        {/* BOTTOM SPACER */}
                        <div style={{ height: (sections.length - end) * 200 }} />

                    </div>
                )}
            </div>
        </div>
    );
}
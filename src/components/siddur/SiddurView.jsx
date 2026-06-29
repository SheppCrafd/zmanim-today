import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
}

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

export default function SiddurView({ title, subtitle, bookRef }) {
    const containerRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(null);

    const WINDOW = 1;

    /* ---------------- LOAD INDEX ---------------- */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const root = data?.schema?.key || bookRef;
                setSections(flattenNodes(nodes, root));
            });
    }, [bookRef]);

    /* ---------------- SAFE LOAD (ONLY HERE) ---------------- */
    const load = async (i) => {
        if (loaded[i] || !sections[i]) return;

        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}`
        );

        const data = await res.json();

        setLoaded(prev => ({ ...prev, [i]: data }));
    };

    /* ---------------- ENTER ---------------- */
    const openAt = async (i) => {
        setStartIndex(i);
        setActiveIndex(i);
    };

    /* ---------------- OBSERVER (ONLY DRIVER OF STATE) ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const root = containerRef.current;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;

                    const i = Number(e.target.dataset.index);

                    setActiveIndex(i);
                }
            },
            {
                root,
                threshold: 0.6
            }
        );

        const nodes = root?.querySelectorAll('[data-index]');
        nodes?.forEach(n => observer.observe(n));

        return () => observer.disconnect();
    }, [startIndex, sections]);

    /* ---------------- LOAD WINDOW (CORRECT PLACE) ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        for (let i = activeIndex - WINDOW; i <= activeIndex + WINDOW; i++) {
            if (i >= 0 && i < sections.length) load(i);
        }
    }, [activeIndex, startIndex, sections]);

    const start = Math.max(0, activeIndex - WINDOW);
    const end = Math.min(sections.length - 1, activeIndex + WINDOW);

    const visible = sections.slice(start, end + 1);

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
                    <ArrowLeft />
                </Button>
            </div>

            {/* SCROLL */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl"
            >

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

                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {visible.map((sec, idx) => {
                            const real = start + idx;
                            const data = loaded[real];

                            return (
                                <div
                                    key={real}
                                    data-index={real}
                                    className="space-y-3"
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

                    </div>
                )}
            </div>
        </div>
    );
}
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
function flattenNodes(nodes, keyPath = '', labelPath = '') {
    const result = [];

    for (const node of nodes) {
        const key = node.key || node.title;
        const fullKeyPath = keyPath ? `${keyPath}, ${key}` : key;

        if (node.nodes) {
            result.push(...flattenNodes(node.nodes, fullKeyPath, labelPath));
        } else {
            result.push({
                label: node.title,
                heLabel: node.heTitle,
                ref: fullKeyPath
            });
        }
    }

    return result;
}

/* ---------------- TEXT ---------------- */
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(text) ? text : text ? [text] : [];
    const maxLen = Math.max(heArr.length, enArr.length);

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
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
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const scrollRef = useRef(null);
    const startRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [startIndex, setStartIndex] = useState(null);
    const [activeIndex, setActiveIndex] = useState(null);

    const WINDOW = 2;

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const rootKey = data?.schema?.key || bookRef.replace(/_/g, ' ');
                setSections(flattenNodes(nodes, rootKey));
            });
    }, [bookRef]);

    /* ---------------- LOAD TEXT ---------------- */
    const loadSection = async (index) => {
        if (loaded[index] || !sections[index]) return;

        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[index].ref)}`
        );

        const data = await res.json();

        setLoaded(prev => ({
            ...prev,
            [index]: data
        }));
    };

    /* ---------------- ENTER ---------------- */
    const openAt = async (index) => {
        setStartIndex(index);
        setActiveIndex(index);

        for (let i = index - WINDOW; i <= index + WINDOW; i++) {
            if (i >= 0 && i < sections.length) loadSection(i);
        }

        setTimeout(() => {
            startRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    /* ---------------- OBSERVER (NO SNAPPING) ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.dataset.index);
                        setActiveIndex(index);

                        // preload neighbors
                        for (let i = index - WINDOW; i <= index + WINDOW; i++) {
                            if (i >= 0 && i < sections.length) loadSection(i);
                        }
                    }
                }
            },
            {
                root: scrollRef.current,
                threshold: 0.4
            }
        );

        const nodes = scrollRef.current?.querySelectorAll('[data-index]');
        nodes?.forEach(n => observer.observe(n));

        return () => observer.disconnect();
    }, [startIndex, sections]);

    const visibleStart = Math.max(0, (activeIndex ?? startIndex ?? 0) - WINDOW);
    const visibleEnd = Math.min(
        sections.length - 1,
        (activeIndex ?? startIndex ?? 0) + WINDOW
    );

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between">
                <div className="flex gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <Button variant="ghost" onClick={() => setStartIndex(null)}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
            </div>

            {/* SCROLL */}
            <div
                ref={scrollRef}
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

                {/* READER */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {sections.map((sec, i) => {
                            if (i < visibleStart || i > visibleEnd) return null;

                            const data = loaded[i];

                            if (!data) {
                                loadSection(i);
                                return (
                                    <div key={i} className="py-10 flex justify-center">
                                        <Loader2 className="animate-spin" />
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={i}
                                    data-index={i}
                                    ref={i === startIndex ? startRef : null}
                                    className="space-y-3"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    <SectionText he={data.he} text={data.text} />
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>
        </div>
    );
}
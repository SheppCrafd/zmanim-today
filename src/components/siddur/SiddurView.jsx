import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL GLOBALLY ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.getElementById('root')?.style.setProperty('height', '100%');
    document.getElementById('root')?.style.setProperty('overflow', 'hidden');
}

/* ---------------- CONFIG ---------------- */
const RENDER_BUFFER = 2;

/* ---------------- HELPERS ---------------- */
const isProbablyEnglish = (str = '') =>
    /^[\x00-\x7F\s.,;:'"!?()\-–—]*$/.test(str);

/* ---------------- TEXT ---------------- */
function SectionText({ he, en, showEnglish }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(en) ? en : en ? [en] : [];

    const maxLen = Math.max(heArr.length, enArr.length);

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">

                    {/* Hebrew ALWAYS */}
                    {heArr[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg leading-loose font-serif text-slate-800 dark:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}

                    {/* English filtered */}
                    {showEnglish &&
                        enArr[i] &&
                        isProbablyEnglish(enArr[i]) && (
                            <p
                                className="text-left text-sm text-slate-500 dark:text-slate-400"
                                dangerouslySetInnerHTML={{ __html: enArr[i] }}
                            />
                        )}
                </div>
            ))}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({
    title,
    subtitle,
    bookRef,
    sefariaUrl
}) {
    const scrollRef = useRef(null);
    const sectionRefs = useRef([]);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [startIndex, setStartIndex] = useState(null);
    const [showEnglish, setShowEnglish] = useState(true);

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const schema = data?.schema;
                const rootKey = schema?.key || bookRef.replace(/_/g, ' ');
                const nodes = schema?.nodes || [];

                const flatten = (nodes, keyPath = '') => {
                    let res = [];

                    for (const node of nodes) {
                        const key = node.key || node.title;
                        const full = keyPath ? `${keyPath}, ${key}` : key;

                        if (node.nodes) {
                            res.push(...flatten(node.nodes, full));
                        } else {
                            res.push({
                                label: node.title,
                                ref: full
                            });
                        }
                    }
                    return res;
                };

                setSections(flatten(nodes, rootKey));
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [bookRef]);

    /* ---------------- LOAD SECTION ---------------- */
    const loadSection = async (index) => {
        if (loaded[index]) return;

        const sec = sections[index];
        if (!sec) return;

        try {
            const res = await fetch(
                `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}`
            );

            const data = await res.json();

            setLoaded(prev => ({
                ...prev,
                [index]: data
            }));
        } catch {
            setLoaded(prev => ({
                ...prev,
                [index]: { error: true }
            }));
        }
    };

    /* ---------------- OPEN SECTION ---------------- */
    const openAt = async (index) => {
        setStartIndex(index);
        await loadSection(index);
    };

    /* ---------------- WINDOW LOGIC ---------------- */
    const windowStart =
        startIndex === null
            ? 0
            : Math.max(0, startIndex - RENDER_BUFFER);

    const windowEnd =
        startIndex === null
            ? sections.length - 1
            : Math.min(sections.length - 1, startIndex + RENDER_BUFFER);

    /* ---------------- PRELOAD WINDOW ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const start = Math.max(0, startIndex - RENDER_BUFFER);
        const end = Math.min(sections.length - 1, startIndex + RENDER_BUFFER);

        for (let i = start; i <= end; i++) {
            if (!loaded[i]) {
                loadSection(i);
            }
        }
    }, [startIndex]);

    /* ---------------- SCROLL TO ACTIVE ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        sectionRefs.current[startIndex]?.scrollIntoView({
            block: 'start',
            behavior: 'smooth'
        });
    }, [startIndex, loaded]);

    const sectionUrl =
        startIndex !== null
            ? `https://www.sefaria.org/${encodeURIComponent(sections[startIndex]?.ref)}`
            : sefariaUrl;

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="text-lg font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEnglish(v => !v)}
                    >
                        EN {showEnglish ? 'ON' : 'OFF'}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStartIndex(null)}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>

                    <a href={sectionUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </a>
                </div>
            </div>

            {/* SCROLL AREA */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto mx-4 mb-4 rounded-xl border bg-white dark:bg-slate-900"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {loading && (
                            <div className="p-10 flex justify-center">
                                <Loader2 className="animate-spin" />
                            </div>
                        )}

                        {error && (
                            <div className="p-6 text-red-500">
                                Failed to load
                            </div>
                        )}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between px-4 py-3 border-b hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <span>{sec.label}</span>
                                <ChevronRight />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER (WINDOWED RENDER) */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {sections.map((sec, i) => {
                            if (i < windowStart || i > windowEnd) return null;

                            const data = loaded[i];

                            if (!data) {
                                loadSection(i);

                                return (
                                    <div
                                        key={i}
                                        ref={el => (sectionRefs.current[i] = el)}
                                        className="flex justify-center py-10"
                                    >
                                        <Loader2 className="animate-spin" />
                                    </div>
                                );
                            }

                            if (data.error) {
                                return (
                                    <div
                                        key={i}
                                        ref={el => (sectionRefs.current[i] = el)}
                                        className="text-red-500 text-sm text-center"
                                    >
                                        Failed to load section
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={i}
                                    ref={el => (sectionRefs.current[i] = el)}
                                    className="space-y-4"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    <SectionText
                                        he={data.he}
                                        en={data.text}
                                        showEnglish={showEnglish}
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
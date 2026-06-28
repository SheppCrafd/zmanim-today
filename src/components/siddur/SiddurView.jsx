import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useParams } from 'react-router-dom';

/* ---------------- CONFIG ---------------- */
const WINDOW = 2;

/* ---------------- SCROLL LOCK ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
}

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

                    {heArr[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg font-serif text-slate-900 dark:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}

                    {showEnglish &&
                        enArr[i] &&
                        isProbablyEnglish(enArr[i]) && (
                            <p
                                className="text-sm text-slate-500 dark:text-slate-400"
                                dangerouslySetInnerHTML={{ __html: enArr[i] }}
                            />
                        )}
                </div>
            ))}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const navigate = useNavigate();
    const { index } = useParams();

    const scrollRef = useRef(null);
    const sectionRefs = useRef([]);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [showEnglish, setShowEnglish] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const isReader = index !== undefined;
    const activeIndex = isReader ? parseInt(index, 10) : 0;

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
    const loadSection = async (i) => {
        if (loaded[i]) return;

        const sec = sections[i];
        if (!sec) return;

        try {
            const res = await fetch(
                `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}`
            );

            const data = await res.json();

            setLoaded(prev => ({
                ...prev,
                [i]: data
            }));
        } catch {
            setLoaded(prev => ({
                ...prev,
                [i]: { error: true }
            }));
        }
    };

    /* ---------------- OPEN SECTION ---------------- */
    const openAt = (i) => {
        navigate(`/read/${i}`);
    };

    const goBack = () => {
        navigate('/toc');
    };

    /* ---------------- CHUNK WINDOW ---------------- */
    const windowStart = Math.max(0, activeIndex - WINDOW);
    const windowEnd = Math.min(sections.length - 1, activeIndex + WINDOW);

    /* ---------------- PRELOAD ---------------- */
    useEffect(() => {
        if (!isReader) return;

        const start = Math.max(0, activeIndex - WINDOW);
        const end = Math.min(sections.length - 1, activeIndex + WINDOW);

        for (let i = start; i <= end; i++) {
            if (!loaded[i]) loadSection(i);
        }
    }, [activeIndex, isReader, sections]);

    /* ---------------- SCROLL TRACKING ---------------- */
    useEffect(() => {
        if (!isReader) return;

        const el = scrollRef.current;
        if (!el) return;

        const handler = () => {
            const nodes = sectionRefs.current;

            let best = Infinity;
            let closest = activeIndex;

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (!n) continue;

                const dist = Math.abs(n.getBoundingClientRect().top);

                if (dist < best) {
                    best = dist;
                    closest = i;
                }
            }

            navigate(`/read/${closest}`, { replace: true });
        };

        el.addEventListener('scroll', handler);
        return () => el.removeEventListener('scroll', handler);
    }, [isReader, sections]);

    /* ---------------- RENDER ---------------- */

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="text-lg font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {isReader && (
                        <Button variant="ghost" size="sm" onClick={goBack}>
                            ← TOC
                        </Button>
                    )}

                    {isReader && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowEnglish(v => !v)}
                        >
                            EN {showEnglish ? 'ON' : 'OFF'}
                        </Button>
                    )}
                </div>
            </div>

            {/* BODY */}
            <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto mx-4 mb-4 rounded-xl border bg-white dark:bg-slate-900"
            >

                {/* ---------------- TOC ---------------- */}
                {!isReader && (
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

                {/* ---------------- READER (MC CHUNKS) ---------------- */}
                {isReader && (
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
import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL GLOBALLY ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.getElementById('root')?.style.setProperty('height', '100%');
    document.getElementById('root')?.style.setProperty('overflow', 'hidden');
}

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

/* ---------------- TEXT RENDER ---------------- */
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(text) ? text : text ? [text] : [];
    const maxLen = Math.max(heArr.length, enArr.length);

    if (!maxLen) {
        return (
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">
                No text available.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">
                    {heArr[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}
                    {enArr[i] && (
                        <p
                            className="text-left text-sm leading-relaxed text-slate-500 dark:text-slate-400"
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
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const sectionRefs = useRef([]);

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [startIndex, setStartIndex] = useState(null);
    const [loaded, setLoaded] = useState({});

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then(data => {
                const schema = data?.schema;
                const rootKey = schema?.key || bookRef.replace(/_/g, ' ');
                const nodes = schema?.nodes || [];

                setSections(flattenNodes(nodes, rootKey));
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

    /* ---------------- ENTER READER ---------------- */
    const openAt = async (index) => {
        setStartIndex(index);
        await loadSection(index);
    };

    /* ---------------- SCROLL TO SECTION ---------------- */
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
        <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {title}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStartIndex(null)}
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        {startIndex === null ? 'Back' : 'TOC'}
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
                className="flex-1 min-h-0 overflow-y-auto mx-4 mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {loading && (
                            <div className="flex items-center justify-center py-20 gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                Loading…
                            </div>
                        )}

                        {error && (
                            <div className="p-6 text-center">
                                <AlertCircle className="mx-auto w-8 h-8 text-amber-500" />
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                    Failed to load
                                </p>
                            </div>
                        )}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <div className="text-left">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {sec.label}
                                    </p>
                                    {sec.heLabel && (
                                        <p className="text-xs text-slate-400" dir="rtl">
                                            {sec.heLabel}
                                        </p>
                                    )}
                                </div>

                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER MODE */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">
                        {sections.map((sec, i) => {
                            const data = loaded[i];

                            if (!data) {
                                loadSection(i);

                                return (
                                    <div
                                        key={i}
                                        ref={el => (sectionRefs.current[i] = el)}
                                        className="flex justify-center py-10"
                                    >
                                        <Loader2 className="animate-spin text-blue-500" />
                                    </div>
                                );
                            }

                            if (data.error) {
                                return (
                                    <div
                                        key={i}
                                        ref={el => (sectionRefs.current[i] = el)}
                                        className="text-center text-red-500 text-sm"
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
                                    <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 py-2">
                                        <p className="font-semibold text-slate-700 dark:text-slate-100">
                                            {sec.label}
                                        </p>
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
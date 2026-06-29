import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

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

/* ---------------- SECTION TEXT ---------------- */

function SectionText({ he, text, showEN, showHB }) {
    const heArr = Array.isArray(he) ? he : (he ? [he] : []);
    const enRaw = Array.isArray(text) ? text : (text ? [text] : []);

    const enArr = enRaw.filter(t => {
        if (!t) return false;
        const latin = (t.match(/[A-Za-z]/g) || []).length;
        const hebrew = (t.match(/[\u0590-\u05FF]/g) || []).length;
        return latin > hebrew;
    });

    const maxLen = Math.max(heArr.length, enArr.length);

    if (maxLen === 0) {
        return (
            <p className="text-slate-400 text-sm italic">
                No text available.
            </p>
        );
    }

    return (
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
    );
}

/* ---------------- ROW ---------------- */

function SectionRow({
    sec,
    index,
    loadedSections,
    loadSection,
    showEN,
    showHB,
    scrollRef,
    onVisible
}) {
    const rowRef = useRef(null);

    useEffect(() => {
        loadSection(index);
    }, [index]);

    useEffect(() => {
        const el = rowRef.current;
        const root = scrollRef?.current;

        if (!el || !root) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onVisible(index);
                }
            },
            {
                root,
                threshold: 0.25
            }
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [index, onVisible, scrollRef]);

    const data = loadedSections[index];

    if (!data) {
        return (
            <div ref={rowRef} className="py-10 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (data.error) {
        return (
            <div ref={rowRef} className="text-center text-sm text-red-500">
                Failed to load section
            </div>
        );
    }

    return (
        <div
            ref={rowRef}
            id={`section-${index}`}
            className="space-y-4 scroll-mt-20"
        >
            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {sec.label}
                </p>
            </div>

            <SectionText
                he={data.he}
                text={data.text}
                showEN={showEN}
                showHB={showHB}
            />
        </div>
    );
}

/* ---------------- MAIN ---------------- */

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const scrollRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [startIndex, setStartIndex] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(null);
    const [loadedSections, setLoadedSections] = useState({});

    const [showEN, setShowEN] = useState(true);
    const [showHB, setShowHB] = useState(true);

    /* LOAD TOC */
    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
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

    /* LOAD SECTION */
    const loadSection = async (index) => {
        if (loadedSections[index]) return;

        const sec = sections[index];
        if (!sec) return;

        try {
            const res = await fetch(
                `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}?lang=bi`
            );

            const data = await res.json();

            setLoadedSections(prev => ({
                ...prev,
                [index]: data
            }));
        } catch {
            setLoadedSections(prev => ({
                ...prev,
                [index]: { error: true }
            }));
        }
    };

    /* TOC CLICK */
    const openAt = (index) => {
        setStartIndex(index);
        setCurrentIndex(index);

        requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        });

        for (
            let i = Math.max(0, index - 2);
            i <= Math.min(sections.length - 1, index + 4);
            i++
        ) {
            loadSection(i);
        }
    };

    const center = currentIndex ?? startIndex ?? 0;

    const firstSection = Math.max(0, center - 2);
    const lastSection = Math.min(sections.length, center + 3);

    const sectionUrl =
        startIndex !== null
            ? `https://www.sefaria.org/${encodeURIComponent(sections[startIndex]?.ref)}`
            : sefariaUrl;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="text-lg font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <a href={sectionUrl} target="_blank">
                    <Button size="sm" variant="outline">
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </a>
            </div>

            {/* TOGGLES */}
            <div className="px-4 flex gap-2 mb-2">
                <Button
                    size="sm"
                    variant={showEN ? "default" : "outline"}
                    onClick={() => setShowEN(v => !v)}
                >
                    EN
                </Button>

                <Button
                    size="sm"
                    variant={showHB ? "default" : "outline"}
                    onClick={() => setShowHB(v => !v)}
                >
                    HB
                </Button>
            </div>

            {/* MAIN SCROLL */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 pb-10"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {loading && <div className="py-10">Loading…</div>}
                        {error && <AlertCircle />}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full text-left py-3 border-b"
                            >
                                {sec.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* READER */}
                {startIndex !== null && (
                    <div className="space-y-10">
                        {sections
                            .slice(firstSection, lastSection)
                            .map((sec, i) => {
                                const idx = firstSection + i;

                                return (
                                    <SectionRow
                                        key={idx}
                                        sec={sec}
                                        index={idx}
                                        loadedSections={loadedSections}
                                        loadSection={loadSection}
                                        showEN={showEN}
                                        showHB={showHB}
                                        scrollRef={scrollRef}
                                        onVisible={(i) => {
                                            if (i === currentIndex) return;

                                            setCurrentIndex(i);

                                            for (
                                                let j = Math.max(0, i - 2);
                                                j <= Math.min(sections.length - 1, i + 4);
                                                j++
                                            ) {
                                                loadSection(j);
                                            }

                                            setLoadedSections(prev => {
                                                const next = {};

                                                for (
                                                    let j = Math.max(0, i - 4);
                                                    j <= Math.min(sections.length - 1, i + 6);
                                                    j++
                                                ) {
                                                    if (prev[j]) next[j] = prev[j];
                                                }

                                                return next;
                                            });
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
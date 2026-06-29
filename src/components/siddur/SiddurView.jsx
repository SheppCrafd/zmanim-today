import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft
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

/* ---------------- EN FILTER ---------------- */

const isEnglishLine = (t) => {
    if (!t) return false;

    const plain = t.replace(/<[^>]*>/g, '').trim();
    if (plain.length < 2) return false;

    const latin = plain.match(/[A-Za-z]/g) || [];
    const hebrew = plain.match(/[\u0590-\u05FF]/g) || [];

    const total = latin.length + hebrew.length;
    if (total === 0) return false;

    const latinRatio = latin.length / total;

    return latin.length > 5 && latinRatio > 0.75;
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
        <div ref={rowRef} className="space-y-4 scroll-mt-24">
            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {sec.label}
                </p>
            </div>

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
        </div>
    );
}

/* ---------------- MAIN ---------------- */

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const rowRefs = useRef({});

    const [sections, setSections] = useState([]);
    const [textMap, setTextMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [page, setPage] = useState('toc');
    const [langMode, setLangMode] = useState('both');

    const [currentIndex, setCurrentIndex] = useState(null);

    const loadedSetRef = useRef(new Set());

    /* ---------------- FETCH SECTION ---------------- */

    const fetchSection = async (i) => {
        const sec = sections[i];
        if (!sec) return;

        if (loadedSetRef.current.has(i)) return;
        loadedSetRef.current.add(i);

        try {
            const res = await fetch(
                `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}?lang=bi`
            );
            const data = await res.json();

            setTextMap(prev => ({
                ...prev,
                [i]: data
            }));
        } catch {
            setTextMap(prev => ({
                ...prev,
                [i]: { error: true }
            }));
        }
    };

    /* ---------------- WINDOW ---------------- */

    const inWindow = (i) => {
        if (currentIndex == null) return false;
        return i >= currentIndex - 2 && i <= currentIndex + 2;
    };

    /* ---------------- LOAD TOC ---------------- */

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

    /* ---------------- SCROLL TRACKER ---------------- */

    useEffect(() => {
        if (page !== 'reader') return;

        const observer = new IntersectionObserver(
            (entries) => {
                let bestIndex = null;
                let bestRatio = 0;

                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const index = Number(entry.target.dataset.index);
                    if (isNaN(index)) return;

                    if (entry.intersectionRatio > bestRatio) {
                        bestRatio = entry.intersectionRatio;
                        bestIndex = index;
                    }
                });

                if (bestIndex != null) {
                    setCurrentIndex(bestIndex);
                }
            },
            {
                rootMargin: '150px',
                threshold: [0.25, 0.5, 0.75]
            }
        );

        const timer = setTimeout(() => {
            Object.entries(rowRefs.current).forEach(([i, el]) => {
                if (el instanceof Element) {
                    el.dataset.index = i;
                    observer.observe(el);
                }
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [page, sections]);

    /* ---------------- WINDOW FETCH ---------------- */

    useEffect(() => {
        if (currentIndex == null) return;

        for (let i = currentIndex - 2; i <= currentIndex + 2; i++) {
            if (i < 0 || i >= sections.length) continue;
            fetchSection(i);
        }
    }, [currentIndex, sections]);

    /* ---------------- TOC CLICK ---------------- */

    const jumpTo = (index) => {
        setPage('reader');
        setCurrentIndex(index);

        requestAnimationFrame(() => {
            rowRefs.current[index]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    };

    /* ---------------- RENDER ---------------- */

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* TOP BAR */}
            <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">

                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                        <NavMenu />
                        <div>
                            <h1 className="text-lg font-bold">{title}</h1>
                            <p className="text-xs text-slate-500">{subtitle}</p>
                        </div>
                    </div>

                    <a href={sefariaUrl} target="_blank">
                        <Button size="sm" variant="outline">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </a>
                </div>

                <div className="px-4 flex gap-2 py-2">
                    <Button size="sm" onClick={() => setLangMode('en')}>EN</Button>
                    <Button size="sm" onClick={() => setLangMode('he')}>HB</Button>
                    <Button size="sm" onClick={() => setLangMode('both')}>BOTH</Button>

                    {page === 'reader' && (
                        <Button size="sm" onClick={() => setPage('toc')}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            TOC
                        </Button>
                    )}
                </div>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-hidden">

                {/* TOC */}
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

                {/* READER (WINDOWED) */}
                {page === 'reader' && (
                    <div className="h-full overflow-y-auto px-4 pb-10">

                        {sections.map((sec, i) => {
                            if (!inWindow(i)) {
                                return (
                                    <div key={i} className="py-6 text-center text-slate-300 text-sm">
                                        ·
                                    </div>
                                );
                            }

                            return (
                                <Section
                                    key={i}
                                    sec={sec}
                                    data={textMap[i]}
                                    langMode={langMode}
                                    rowRef={(el) => {
                                        if (el) rowRefs.current[i] = el;
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
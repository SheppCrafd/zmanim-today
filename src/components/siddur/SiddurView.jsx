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

/* ---------------- EN FILTER (FIXED) ---------------- */

const isCleanEnglishLine = (t) => {
    if (!t) return false;

    const plain = t.replace(/<[^>]*>/g, '').trim();
    if (plain.length < 2) return false;

    // hard reject Hebrew
    if (/[\u0590-\u05FF]/.test(plain)) return false;

    const letters = plain.match(/[a-zA-Z]/g) || [];
    if (letters.length < 3) return false;

    // allow accented languages (DON'T over-filter!)
    const hebrewishOrCyrillic = plain.match(/[\u0400-\u04FF]/g);
    if (hebrewishOrCyrillic && hebrewishOrCyrillic.length > 0) return false;

    return true;
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
            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
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

    const [page, setPage] = useState('toc'); // toc | reader
    const [langMode, setLangMode] = useState('both');

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

    /* LOAD ALL TEXT (progressive, no blocking) */
    useEffect(() => {
        if (!sections.length) return;

        let cancelled = false;

        const loadAll = async () => {
            for (let i = 0; i < sections.length; i++) {
                try {
                    const res = await fetch(
                        `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}?lang=bi`
                    );
                    const data = await res.json();

                    if (!cancelled) {
                        setTextMap(prev => ({
                            ...prev,
                            [i]: data
                        }));
                    }
                } catch {
                    if (!cancelled) {
                        setTextMap(prev => ({
                            ...prev,
                            [i]: { error: true }
                        }));
                    }
                }
            }
        };

        loadAll();

        return () => {
            cancelled = true;
        };
    }, [sections]);

    /* JUMP */
    const jumpTo = (index) => {
        setPage('reader');

        requestAnimationFrame(() => {
            rowRefs.current[index]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    };

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

                <a href={sefariaUrl} target="_blank">
                    <Button size="sm" variant="outline">
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </a>
            </div>

            {/* TOGGLES */}
            <div className="px-4 flex gap-2 mb-2">
                <Button
                    size="sm"
                    variant={langMode === 'en' ? "default" : "outline"}
                    onClick={() => setLangMode('en')}
                >
                    EN
                </Button>

                <Button
                    size="sm"
                    variant={langMode === 'he' ? "default" : "outline"}
                    onClick={() => setLangMode('he')}
                >
                    HB
                </Button>

                <Button
                    size="sm"
                    variant={langMode === 'both' ? "default" : "outline"}
                    onClick={() => setLangMode('both')}
                >
                    BOTH
                </Button>

                {page === 'reader' && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage('toc')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        TOC
                    </Button>
                )}
            </div>

            {/* BODY */}
            <div className="flex flex-1 overflow-hidden">

                {/* TOC */}
                {page === 'toc' && (
                    <div className="w-full overflow-y-auto px-4">
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

                {/* READER */}
                {page === 'reader' && (
                    <div className="w-full overflow-y-auto px-4 pb-10">
                        {sections.map((sec, i) => (
                            <Section
                                key={i}
                                sec={sec}
                                data={textMap[i]}
                                langMode={langMode}
                                rowRef={(el) => {
                                    rowRefs.current[i] = el;
                                }}
                            />
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
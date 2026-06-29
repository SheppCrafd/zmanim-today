import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- TOC FLATTEN (SAFE) ---------------- */

function flattenNodes(nodes, path = []) {
    const result = [];

    for (const node of nodes || []) {
        const currentPath = [...path, node.title];

        if (node.nodes && node.nodes.length) {
            result.push(...flattenNodes(node.nodes, currentPath));
        } else {
            result.push({
                label: node.title,
                path: currentPath
            });
        }
    }

    return result;
}

/* ---------------- BUILD SAFE SEFARIA REF ---------------- */

function buildRef(path) {
    if (!path || !path.length) return null;

    // Sefaria canonical format is comma-separated
    return path.join(', ');
}

/* ---------------- SECTION ---------------- */

function Section({ sec, data, rowRef }) {
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

    const heArr = Array.isArray(data.he) ? data.he : [];
    const enArr = Array.isArray(data.text) ? data.text : [];

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

                        {heArr[i] && (
                            <p
                                className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif"
                                dir="rtl"
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

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const flat = flattenNodes(nodes);

                setSections(flat);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [bookRef]);

    /* ---------------- LOAD TEXT (SAFE FETCH) ---------------- */
    useEffect(() => {
        if (!sections.length) return;

        let cancelled = false;

        const load = async () => {
            for (let i = 0; i < sections.length; i++) {
                const ref = buildRef(sections[i].path);

                // 🚨 skip invalid refs
                if (!ref) continue;

                try {
                    const res = await fetch(
                        `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?lang=he,en&context=0`
                    );

                    if (!res.ok) throw new Error("bad ref");

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

        load();

        return () => {
            cancelled = true;
        };
    }, [sections]);

    /* ---------------- JUMP ---------------- */
    const jumpTo = (index) => {
        setPage('reader');

        requestAnimationFrame(() => {
            rowRefs.current[index]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    };

    /* ---------------- UI ---------------- */
    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* HEADER */}
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

                {/* CONTROLS */}
                <div className="px-4 flex gap-2 py-2">
                    {page === 'reader' && (
                        <Button size="sm" variant="outline" onClick={() => setPage('toc')}>
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

                {/* READER */}
                {page === 'reader' && (
                    <div className="h-full overflow-y-auto px-4 pb-10">
                        {sections.map((sec, i) => (
                            <Section
                                key={i}
                                sec={sec}
                                data={textMap[i]}
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
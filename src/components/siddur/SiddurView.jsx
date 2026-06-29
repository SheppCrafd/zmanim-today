import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
}

/* ---------------- FLATTEN TOC ---------------- */
function flattenNodes(nodes, keyPath = '') {
    const out = [];

    function walk(node, path) {
        const key = node.key || node.title;
        const full = path ? `${path}, ${key}` : key;

        // REAL text node
        if (node.nodeType === 'JaggedArrayNode') {
            out.push({
                label: node.title,
                heLabel: node.heTitle,
                ref: full
            });
            return;
        }

        // Container
        if (node.nodes?.length) {
            node.nodes.forEach(child => walk(child, full));
        }
    }

    nodes?.forEach(node => walk(node, keyPath));

    return out;
}

/* ---------------- NORMALIZE ---------------- */
function normalizeArray(x) {
    if (x == null) return [];

    if (Array.isArray(x)) {
        return x.flat(Infinity).filter(
            item =>
                item !== '' &&
                item !== null &&
                item !== undefined
        );
    }

    return [x];
}

/* ---------------- TEXT ---------------- */
function SectionText({ he, en }) {
    const max = Math.max(he.length, en.length);

    if (!max) {
        return (
            <p className="text-sm text-slate-400 italic">
                No text available.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            {Array.from({ length: max }).map((_, i) => (
                <div key={i} className="space-y-2">
                    {he[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg font-serif leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: he[i]
                            }}
                        />
                    )}

                    {en[i] && (
                        <p
                            className="text-sm text-slate-500 leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: en[i]
                            }}
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
    bookRef
}) {
    const containerRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [startIndex, setStartIndex] = useState(null);

    const WINDOW = 3;

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const root =
                    data?.schema?.key || bookRef;

                setSections(
                    flattenNodes(nodes, root)
                );
            })
            .catch(console.error);
    }, [bookRef]);

    /* ---------------- LOAD TEXT ---------------- */
    const load = async i => {
        if (loaded[i]) return;
        if (!sections[i]) return;

        try {
            const ref = encodeURIComponent(
                sections[i].ref
            );

            const res = await fetch(
                `https://www.sefaria.org/api/texts/${ref}?lang=he&lang2=en`
            );

            const data = await res.json();

            const he = normalizeArray(data.he);
            const en = normalizeArray(
                data.text ||
                    data.en ||
                    data.english
            );

            setLoaded(prev => ({
                ...prev,
                [i]: {
                    he,
                    en
                }
            }));
        } catch (err) {
            console.error(err);

            setLoaded(prev => ({
                ...prev,
                [i]: {
                    he: [],
                    en: []
                }
            }));
        }
    };

    /* ---------------- OPEN ---------------- */
    const openAt = i => {
        setStartIndex(i);
        setActiveIndex(i);
    };

    /* ---------------- PRELOAD WINDOW ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const first = Math.max(
            0,
            activeIndex - WINDOW
        );

        const last = Math.min(
            sections.length - 1,
            activeIndex + WINDOW
        );

        for (let i = first; i <= last; i++) {
            load(i);
        }
    }, [
        activeIndex,
        sections,
        startIndex
    ]);

    /* ---------------- WINDOW ---------------- */
    const start = Math.max(
        0,
        activeIndex - WINDOW
    );

    const end = Math.min(
        sections.length - 1,
        activeIndex + WINDOW
    );

    const visible = sections.slice(
        start,
        end + 1
    );

    /* ---------------- OBSERVER ---------------- */
    useEffect(() => {
        if (startIndex === null) return;

        const root = containerRef.current;
        if (!root) return;

        const observer =
            new IntersectionObserver(
                entries => {
                    let best = null;

                    for (const e of entries) {
                        if (!e.isIntersecting)
                            continue;

                        if (
                            !best ||
                            e.intersectionRatio >
                                best.intersectionRatio
                        ) {
                            best = e;
                        }
                    }

                    if (!best) return;

                    const i = Number(
                        best.target.dataset.index
                    );

                    setActiveIndex(i);
                },
                {
                    root,
                    threshold: [
                        0.25,
                        0.5,
                        0.75
                    ]
                }
            );

        const nodes =
            root.querySelectorAll(
                '[data-index]'
            );

        nodes.forEach(node =>
            observer.observe(node)
        );

        return () => {
            observer.disconnect();
        };
    }, [
        startIndex,
        start,
        end
    ]);

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between">
                <div>
                    <NavMenu />

                    <h1 className="font-bold">
                        {title}
                    </h1>

                    <p className="text-xs text-slate-500">
                        {subtitle}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    onClick={() =>
                        setStartIndex(null)
                    }
                >
                    <ArrowLeft />
                </Button>
            </div>

            {/* SCROLL */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl"
            >
                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {sections.map(
                            (s, i) => (
                                <button
                                    key={i}
                                    onClick={() =>
                                        openAt(i)
                                    }
                                    className="w-full flex justify-between p-3 border-b"
                                >
                                    <div className="text-left">
                                        <p>
                                            {
                                                s.label
                                            }
                                        </p>

                                        {s.heLabel && (
                                            <p
                                                dir="rtl"
                                                className="text-xs text-slate-400"
                                            >
                                                {
                                                    s.heLabel
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <ChevronRight />
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* READER */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">
                        {visible.map(
                            (
                                sec,
                                idx
                            ) => {
                                const real =
                                    start +
                                    idx;

                                const data =
                                    loaded[
                                        real
                                    ];

                                return (
                                    <div
                                        key={
                                            real
                                        }
                                        data-index={
                                            real
                                        }
                                        className="space-y-3"
                                    >
                                        <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                            {
                                                sec.label
                                            }
                                        </div>

                                        {data ? (
                                            <SectionText
                                                he={
                                                    data.he
                                                }
                                                en={
                                                    data.en
                                                }
                                            />
                                        ) : (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
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

// flatten Sefaria tree
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

// render section text
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : (he ? [he] : []);
    const enArr = Array.isArray(text) ? text : (text ? [text] : []);
    const maxLen = Math.max(heArr.length, enArr.length);

    if (maxLen === 0) {
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
    );
}

// TOC list
function SectionList({ sections, onSelect }) {
    return (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sections.map((sec, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(sec)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left"
                >
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {sec.label}
                        </p>
                        {sec.heLabel && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5" dir="rtl">
                                {sec.heLabel}
                            </p>
                        )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                </button>
            ))}
        </div>
    );
}

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const navigate = useNavigate();

    const [sections, setSections] = useState(null);
    const [tocLoading, setTocLoading] = useState(true);
    const [tocError, setTocError] = useState(false);

    const [selected, setSelected] = useState(null);

    const [sectionDataMap, setSectionDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});

    const sectionRefs = useRef({});
    const [activeSection, setActiveSection] = useState(null);

    // LOAD TOC
    useEffect(() => {
        setTocLoading(true);
        setTocError(false);

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
                setTocLoading(false);
            })
            .catch(() => {
                setTocError(true);
                setTocLoading(false);
            });
    }, [bookRef]);

    // LOAD ALL TEXT ONCE ENTERING READER MODE
    useEffect(() => {
        if (!selected || !sections) return;

        const loadAll = async () => {
            for (const sec of sections) {
                if (sectionDataMap[sec.ref]) continue;

                setLoadingMap(prev => ({ ...prev, [sec.ref]: true }));

                try {
                    const encoded = encodeURIComponent(sec.ref);
                    const res = await fetch(`https://www.sefaria.org/api/texts/${encoded}`);
                    const data = await res.json();

                    setSectionDataMap(prev => ({
                        ...prev,
                        [sec.ref]: data
                    }));
                } catch {}

                setLoadingMap(prev => ({ ...prev, [sec.ref]: false }));
            }
        };

        loadAll();
    }, [selected, sections]);

    // TRACK CURRENT SECTION IN VIEW
    useEffect(() => {
        if (!selected) return;

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.dataset.ref);
                    }
                });
            },
            {
                rootMargin: '-40% 0px -50% 0px',
                threshold: 0.1
            }
        );

        Object.values(sectionRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [selected, sectionDataMap]);

    const sectionUrl = selected
        ? `https://www.sefaria.org/${encodeURIComponent(selected.ref)}`
        : sefariaUrl;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 shrink-0">

                <div className="flex items-center mb-3 min-h-[56px]">
                    <div className="shrink-0"><NavMenu /></div>

                    <div className="flex-1 text-center px-2">
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <div className="shrink-0 w-9" />
                </div>

                <div className="relative flex items-center justify-between">

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(null)}
                        className="gap-2 text-slate-600 dark:text-slate-300"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {selected ? 'Contents' : 'Back'}
                    </Button>

                    <div className="absolute left-1/2 -translate-x-1/2">
                        {activeSection && (
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[180px] truncate">
                                {sections?.find(s => s.ref === activeSection)?.label}
                            </p>
                        )}
                    </div>

                    <a href={sectionUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Sefaria
                        </Button>
                    </a>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">

                {/* TOC */}
                {!selected && (
                    <>
                        {tocLoading && (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Loading contents…
                                </p>
                            </div>
                        )}

                        {tocError && (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <AlertCircle className="w-10 h-10 text-amber-500" />
                                <p className="text-slate-700 dark:text-slate-200 font-semibold">
                                    Failed to load
                                </p>
                            </div>
                        )}

                        {sections && !tocLoading && (
                            <SectionList sections={sections} onSelect={setSelected} />
                        )}
                    </>
                )}

                {/* READER MODE (continuous scroll) */}
                {selected && (
                    <div className="overflow-y-auto h-full p-4 space-y-12">

                        {sections.map(sec => {
                            const data = sectionDataMap[sec.ref];
                            const loading = loadingMap[sec.ref];

                            return (
                                <div
                                    key={sec.ref}
                                    ref={el => sectionRefs.current[sec.ref] = el}
                                    data-ref={sec.ref}
                                    className="scroll-mt-24"
                                >
                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                                        {sec.label}
                                    </h2>

                                    {loading && (
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading…
                                        </div>
                                    )}

                                    {data && (
                                        <SectionText he={data.he} text={data.text} />
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
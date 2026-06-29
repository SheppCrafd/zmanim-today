import React, { useState, useEffect } from 'react';
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

/* ---------------- SECTION ---------------- */

function Section({ sec, data, langMode }) {
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

    const heArr = Array.isArray(data.he)
        ? data.he
        : (data.he ? [data.he] : []);

    const enArr = Array.isArray(data.en)
        ? data.en
        : (data.en ? [data.en] : []);

    const showEN = langMode !== 'he';
    const showHB = langMode !== 'en';

    const maxLen = Math.max(heArr.length, enArr.length);

    return (
        <div className="space-y-4 scroll-mt-24">

            {/* sticky header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {sec?.label}
                </p>
            </div>

            <div className="space-y-6">
                {Array.from({ length: maxLen }).map((_, i) => (
                    <div key={i} className="space-y-2">

                        {/* Hebrew first */}
                        {showHB && heArr[i] && (
                            <p
                                className="text-right text-lg leading-loose text-slate-800 dark:text-slate-100 font-serif"
                                dir="rtl"
                                dangerouslySetInnerHTML={{ __html: heArr[i] }}
                            />
                        )}

                        {/* English below */}
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
    const [sections, setSections] = useState([]);
    const [loadingTOC, setLoadingTOC] = useState(true);
    const [error, setError] = useState(false);

    const [page, setPage] = useState('toc');
    const [langMode, setLangMode] = useState('both');

    const [activeSection, setActiveSection] = useState(null);
    const [activeData, setActiveData] = useState(null);
    const [loadingText, setLoadingText] = useState(false);

    /* ---------------- LOAD TOC ---------------- */

    useEffect(() => {
        setLoadingTOC(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const schema = data?.schema;
                const rootKey = schema?.key || bookRef.replace(/_/g, ' ');
                const nodes = schema?.nodes || [];

                setSections(flattenNodes(nodes, rootKey));
                setLoadingTOC(false);
            })
            .catch(() => {
                setError(true);
                setLoadingTOC(false);
            });
    }, [bookRef]);

    /* ---------------- CLICK SECTION ---------------- */

    const openSection = async (sec) => {
        setPage('reader');
        setActiveSection(sec);
        setLoadingText(true);
        setActiveData(null);

        try {
            const res = await fetch(
                `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}?lang=he&lang2=en`
            );

            const data = await res.json();
            setActiveData(data);
        } catch {
            setActiveData({ error: true });
        }

        setLoadingText(false);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* ---------------- HEADER ---------------- */}
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

                {/* controls */}
                <div className="px-4 flex gap-2 py-2">
                    <Button size="sm" variant={langMode === 'en' ? "default" : "outline"} onClick={() => setLangMode('en')}>EN</Button>
                    <Button size="sm" variant={langMode === 'he' ? "default" : "outline"} onClick={() => setLangMode('he')}>HB</Button>
                    <Button size="sm" variant={langMode === 'both' ? "default" : "outline"} onClick={() => setLangMode('both')}>BOTH</Button>

                    {page === 'reader' && (
                        <Button size="sm" variant="outline" onClick={() => setPage('toc')}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            TOC
                        </Button>
                    )}
                </div>
            </div>

            {/* ---------------- BODY ---------------- */}
            <div className="flex-1 overflow-hidden">

                {/* TOC */}
                {page === 'toc' && (
                    <div className="h-full overflow-y-auto px-4">
                        {loadingTOC && <div className="py-10">Loading…</div>}
                        {error && <AlertCircle className="text-red-500" />}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openSection(sec)}
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

                        {loadingText && (
                            <div className="py-10 flex justify-center">
                                <Loader2 className="animate-spin text-blue-500" />
                            </div>
                        )}

                        {!loadingText && activeData && (
                            <Section
                                sec={activeSection}
                                data={activeData}
                                langMode={langMode}
                            />
                        )}

                    </div>
                )}

            </div>
        </div>
    );
}
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

/* ---------------- SECTION ---------------- */

function Section({ sec, data, rowRef, showEN, showHB }) {
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

    return (
        <div ref={rowRef} className="space-y-4 scroll-mt-24">
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
    const rowRefs = useRef({});

    const [sections, setSections] = useState([]);
    const [textMap, setTextMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

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

    /* LOAD ALL TEXT ONCE */
    useEffect(() => {
        if (!sections.length) return;

        const loadAll = async () => {
            const results = {};

            await Promise.all(
                sections.map(async (sec, i) => {
                    try {
                        const res = await fetch(
                            `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}?lang=bi`
                        );
                        const data = await res.json();
                        results[i] = data;
                    } catch {
                        results[i] = { error: true };
                    }
                })
            );

            setTextMap(results);
        };

        loadAll();
    }, [sections]);

    /* TOC CLICK */
    const jumpTo = (index) => {
        rowRefs.current[index]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    };

    const sectionUrl = sefariaUrl;

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

            {/* BODY */}
            <div className="flex flex-1 overflow-hidden">

                {/* TOC */}
                <div className="w-1/3 overflow-y-auto border-r px-2">
                    {loading && <div className="py-10">Loading…</div>}
                    {error && <AlertCircle />}

                    {sections.map((sec, i) => (
                        <button
                            key={i}
                            onClick={() => jumpTo(i)}
                            className="w-full text-left py-2 border-b text-sm"
                        >
                            {sec.label}
                        </button>
                    ))}
                </div>

                {/* READER */}
                <div className="flex-1 overflow-y-auto px-4 pb-10">
                    {sections.map((sec, i) => (
                        <Section
                            key={i}
                            sec={sec}
                            data={textMap[i]}
                            showEN={showEN}
                            showHB={showHB}
                            rowRef={(el) => {
                                rowRefs.current[i] = el;
                            }}
                        />
                    ))}
                </div>

            </div>
        </div>
    );
}
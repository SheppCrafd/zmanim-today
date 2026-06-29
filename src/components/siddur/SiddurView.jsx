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
                ref: fullKeyPath
            });
        }
    }

    return result;
}

/* ---------------- SECTION TEXT ---------------- */

function SectionText({ he, en, tr, showHB, showEN, showTR }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(en) ? en : en ? [en] : [];
    const trArr = Array.isArray(tr) ? tr : tr ? [tr] : [];

    const maxLen = Math.max(heArr.length, enArr.length, trArr.length);

    if (!maxLen) {
        return (
            <p className="text-slate-400 text-sm italic">
                No text available.
            </p>
        );
    }

    return (
        <div className="space-y-8">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">

                    {/* HEBREW */}
                    {showHB && heArr[i] && (
                        <p
                            className="text-right text-lg font-serif leading-loose"
                            dir="rtl"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}

                    {/* ENGLISH */}
                    {showEN && enArr[i] && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {enArr[i]?.replace(/<[^>]+>/g, '')}
                        </p>
                    )}

                    {/* TRANSLITERATION (FROM SEFARIA) */}
                    {showTR && trArr[i] && (
                        <p className="text-sm italic text-blue-500">
                            {trArr[i]}
                        </p>
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
    showHB,
    showEN,
    showTR
}) {
    useEffect(() => {
        loadSection(index);
    }, [index]);

    const data = loadedSections[index];

    if (!data) {
        return (
            <div className="py-10 flex justify-center">
                <Loader2 className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (data.error) {
        return (
            <div className="text-red-500 text-sm">
                Failed to load section
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {sec.label}
                </p>
            </div>

            <SectionText
                he={data.he}
                en={data.en}
                tr={data.tr}
                showHB={showHB}
                showEN={showEN}
                showTR={showTR}
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
    const [loadedSections, setLoadedSections] = useState({});

    /* TOGGLES */
    const [showHB, setShowHB] = useState(true);
    const [showEN, setShowEN] = useState(true);
    const [showTR, setShowTR] = useState(false);

    /* LOAD TOC */
    useEffect(() => {
        setLoading(true);

        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                setSections(flattenNodes(nodes));
                setLoading(false);
            })
            .catch(() => setError(true));
    }, [bookRef]);

    /* LOAD SECTION (NOW PROPER MULTI-VERSION FETCH) */
    const loadSection = async (index) => {
        if (loadedSections[index]) return;

        const sec = sections[index];
        if (!sec) return;

        try {
            const base = `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}`;

            const [heRes, enRes, trRes] = await Promise.all([
                fetch(`${base}?lang=he`),
                fetch(`${base}?lang=en`),
                fetch(`${base}?transliteration=1`)
            ]);

            const [heData, enData, trData] = await Promise.all([
                heRes.json(),
                enRes.json(),
                trRes.json()
            ]);

            setLoadedSections(prev => ({
                ...prev,
                [index]: {
                    he: heData.he,
                    en: enData.text,
                    tr: trData.text
                }
            }));
        } catch {
            setLoadedSections(prev => ({
                ...prev,
                [index]: { error: true }
            }));
        }
    };

    /* ---------------- UI ---------------- */

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="p-4 flex justify-between items-center">
                <div>
                    <NavMenu />
                    <h1 className="font-bold">{title}</h1>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>

                <a href={sefariaUrl} target="_blank">
                    <Button variant="outline">
                        <ExternalLink />
                    </Button>
                </a>
            </div>

            {/* TOGGLES */}
            <div className="px-4 flex gap-2">
                <Button size="sm" onClick={() => setShowHB(v => !v)} variant={showHB ? "default" : "outline"}>
                    HB
                </Button>
                <Button size="sm" onClick={() => setShowEN(v => !v)} variant={showEN ? "default" : "outline"}>
                    EN
                </Button>
                <Button size="sm" onClick={() => setShowTR(v => !v)} variant={showTR ? "default" : "outline"}>
                    TR
                </Button>
            </div>

            {/* CONTENT */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">

                {startIndex === null ? (
                    <>
                        {loading && <div>Loading...</div>}
                        {error && <AlertCircle />}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => setStartIndex(i)}
                                className="w-full text-left py-3 border-b"
                            >
                                {sec.label}
                            </button>
                        ))}
                    </>
                ) : (
                    sections.slice(startIndex, startIndex + 20).map((sec, i) => (
                        <SectionRow
                            key={i}
                            sec={sec}
                            index={startIndex + i}
                            loadedSections={loadedSections}
                            loadSection={loadSection}
                            showHB={showHB}
                            showEN={showEN}
                            showTR={showTR}
                        />
                    ))
                )}

            </div>
        </div>
    );
}
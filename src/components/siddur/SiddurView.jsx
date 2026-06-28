import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import NavMenu from '@/components/NavMenu';

// Flatten schema
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

// Text renderer
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : (he ? [he] : []);
    const enArr = Array.isArray(text) ? text : (text ? [text] : []);
    const maxLen = Math.max(heArr.length, enArr.length);

    if (!maxLen) {
        return <p className="text-slate-400 text-sm italic">No text available.</p>;
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
                        <p className="text-left text-sm text-slate-500 dark:text-slate-400">
                            {enArr[i]}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

// TOC
function SectionList({ sections, onSelect }) {
    return (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sections.map((sec, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(sec)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900"
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
    );
}

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const navigate = useNavigate();

    const [sections, setSections] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [selected, setSelected] = useState(null);
    const [sectionData, setSectionData] = useState(null);
    const [sectionLoading, setSectionLoading] = useState(false);

    // load TOC
    useEffect(() => {
        setLoading(true);
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const root = data?.schema?.key || bookRef;
                setSections(flattenNodes(nodes, root));
                setLoading(false);
            })
            .catch(() => setError(true));
    }, [bookRef]);

    // load section
    useEffect(() => {
        if (!selected) return;

        setSectionLoading(true);
        setSectionData(null);

        fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(selected.ref)}`)
            .then(r => r.json())
            .then(data => {
                setSectionData(data);
                setSectionLoading(false);
            })
            .catch(() => setSectionLoading(false));
    }, [selected]);

    const goBack = () => {
        if (selected) {
            setSelected(null);
            setSectionData(null);
        } else {
            navigate(-1);
        }
    };

    const sectionUrl = selected
        ? `https://www.sefaria.org/${encodeURIComponent(selected.ref)}`
        : sefariaUrl;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <NavMenu />

                    <div className="text-center flex-1">
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-xs text-slate-500">{subtitle}</p>
                        )}
                    </div>

                    <a href={sectionUrl} target="_blank">
                        <Button variant="outline" size="sm">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                    </a>
                </div>

                <button
                    onClick={goBack}
                    className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {selected ? "Contents" : "Back"}
                </button>
            </div>

            {/* BODY (NO INTERNAL SCROLL CONTAINERS) */}
            <div className="flex-1 px-4 py-4">

                {/* TOC */}
                {!selected && (
                    <>
                        {loading && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading…
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 text-amber-500">
                                <AlertCircle className="w-4 h-4" />
                                Failed to load
                            </div>
                        )}

                        {sections && (
                            <SectionList sections={sections} onSelect={setSelected} />
                        )}
                    </>
                )}

                {/* SECTION PAGE */}
                {selected && (
                    <div className="space-y-6">
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                            <p className="font-semibold text-slate-700 dark:text-slate-100">
                                {selected.label}
                            </p>
                        </div>

                        {sectionLoading && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading text…
                            </div>
                        )}

                        {sectionData && (
                            <SectionText
                                he={sectionData.he}
                                text={sectionData.text}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
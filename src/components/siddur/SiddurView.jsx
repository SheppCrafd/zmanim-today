import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, AlertCircle, ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import NavMenu from '@/components/NavMenu';

// Recursively flatten a Sefaria schema node tree into a list of sections
function flattenNodes(nodes, path = '') {
    const result = [];
    for (const node of nodes) {
        const fullPath = path ? `${path}, ${node.title}` : node.title;
        if (node.nodes) {
            result.push(...flattenNodes(node.nodes, fullPath));
        } else {
            result.push({ label: node.title, heLabel: node.heTitle, ref: fullPath });
        }
    }
    return result;
}

// Strip HTML tags from Sefaria text
function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]+>/g, '');
}

// Render one text section (arrays of Hebrew + English paragraphs)
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : (he ? [he] : []);
    const enArr = Array.isArray(text) ? text : (text ? [text] : []);
    const maxLen = Math.max(heArr.length, enArr.length);

    if (maxLen === 0) return <p className="text-slate-400 text-sm italic">No text available.</p>;

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">
                    {heArr[i] && (
                        <p
                            className="text-right text-lg leading-loose text-slate-800 font-serif"
                            dir="rtl"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}
                    {enArr[i] && (
                        <p
                            className="text-left text-sm leading-relaxed text-slate-500"
                            dangerouslySetInnerHTML={{ __html: enArr[i] }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

// Panel showing a list of sections (TOC)
function SectionList({ sections, onSelect }) {
    return (
        <div className="divide-y divide-slate-100">
            {sections.map((sec, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(sec)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                    <div>
                        <p className="text-sm font-medium text-slate-700">{sec.label}</p>
                        {sec.heLabel && <p className="text-xs text-slate-400 mt-0.5" dir="rtl">{sec.heLabel}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
            ))}
        </div>
    );
}

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const navigate = useNavigate();

    // TOC state
    const [sections, setSections] = useState(null);
    const [tocLoading, setTocLoading] = useState(true);
    const [tocError, setTocError] = useState(false);

    // Selected section state
    const [selected, setSelected] = useState(null);
    const [sectionData, setSectionData] = useState(null);
    const [sectionLoading, setSectionLoading] = useState(false);
    const [sectionError, setSectionError] = useState(false);

    // Load TOC
    useEffect(() => {
        setTocLoading(true);
        setTocError(false);
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                setSections(flattenNodes(nodes, title));
                setTocLoading(false);
            })
            .catch(() => { setTocError(true); setTocLoading(false); });
    }, [bookRef, title]);

    // Load selected section text
    useEffect(() => {
        if (!selected) return;
        setSectionLoading(true);
        setSectionError(false);
        setSectionData(null);
        const encodedRef = encodeURIComponent(selected.ref);
        fetch(`https://www.sefaria.org/api/texts/${encodedRef}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => { setSectionData(data); setSectionLoading(false); })
            .catch(() => { setSectionError(true); setSectionLoading(false); });
    }, [selected]);

    const sectionUrl = selected
        ? `https://www.sefaria.org/${encodeURIComponent(selected.ref)}`
        : sefariaUrl;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex flex-col">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 shrink-0">
                <div className="flex items-center mb-3 min-h-[56px]">
                    <div className="shrink-0"><NavMenu /></div>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-2xl font-bold text-slate-800 leading-tight">{title}</h1>
                        {subtitle && <p className="text-slate-500 text-sm">{subtitle}</p>}
                    </div>
                    <div className="shrink-0 w-9" />
                </div>
                <div className="relative flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={selected ? () => setSelected(null) : () => navigate(-1)}
                        className="gap-2 text-slate-600"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {selected ? 'Contents' : 'Back'}
                    </Button>
                    <div className="absolute left-1/2 -translate-x-1/2">
                        {selected && (
                            <p className="text-sm font-medium text-slate-700 max-w-[160px] truncate text-center">{selected.label}</p>
                        )}
                    </div>
                    <a href={sectionUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Sefaria
                        </Button>
                    </a>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                {/* TOC view */}
                {!selected && (
                    <>
                        {tocLoading && (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                <p className="text-sm text-slate-500">Loading contents…</p>
                            </div>
                        )}
                        {tocError && (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                                <AlertCircle className="w-10 h-10 text-amber-500" />
                                <p className="text-slate-700 font-semibold">Unable to load text from Sefaria</p>
                                <a href={sefariaUrl} target="_blank" rel="noopener noreferrer">
                                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        <ExternalLink className="w-4 h-4" /> Open in Sefaria
                                    </Button>
                                </a>
                            </div>
                        )}
                        {sections && !tocLoading && (
                            <div className="overflow-y-auto max-h-full">
                                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Table of Contents</p>
                                </div>
                                <SectionList sections={sections} onSelect={setSelected} />
                            </div>
                        )}
                    </>
                )}

                {/* Section text view */}
                {selected && (
                    <div className="overflow-y-auto h-full">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 sticky top-0">
                            <p className="text-sm font-semibold text-slate-700">{selected.label}</p>
                            {selected.heLabel && <p className="text-xs text-slate-400 mt-0.5" dir="rtl">{selected.heLabel}</p>}
                        </div>
                        <div className="p-4">
                            {sectionLoading && (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <p className="text-sm text-slate-500">Loading…</p>
                                </div>
                            )}
                            {sectionError && (
                                <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                                    <AlertCircle className="w-10 h-10 text-amber-500" />
                                    <p className="text-slate-700 font-semibold">Unable to load text from Sefaria</p>
                                    <a href={sectionUrl} target="_blank" rel="noopener noreferrer">
                                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                                            <ExternalLink className="w-4 h-4" /> Open in Sefaria
                                        </Button>
                                    </a>
                                </div>
                            )}
                            {sectionData && !sectionLoading && (
                                <SectionText he={sectionData.he} text={sectionData.text} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
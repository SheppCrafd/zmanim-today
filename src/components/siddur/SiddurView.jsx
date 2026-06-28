import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
}

/* ---------------- FLATTEN ---------------- */
function flattenNodes(nodes, keyPath = '') {
    const result = [];

    for (const node of nodes) {
        const key = node.key || node.title;
        const fullKey = keyPath ? `${keyPath}, ${key}` : key;

        if (node.nodes) {
            result.push(...flattenNodes(node.nodes, fullKey));
        } else {
            result.push({
                label: node.title,
                heLabel: node.heTitle,
                ref: fullKey
            });
        }
    }

    return result;
}

/* ---------------- TEXT ---------------- */
function SectionText({ he, text, showEnglish, showTranslit }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(text) ? text : text ? [text] : [];

    const maxLen = Math.max(heArr.length, enArr.length);

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">

                    {/* HEBREW ALWAYS */}
                    {heArr[i] && (
                        <p
                            dir="rtl"
                            className="text-right text-lg font-serif"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }}
                        />
                    )}

                    {/* ENGLISH TOGGLE */}
                    {showEnglish && enArr[i] && (
                        <p className="text-sm text-slate-500">
                            {enArr[i]}
                        </p>
                    )}

                    {/* TRANSLITERATION (best effort fallback) */}
                    {showTranslit && enArr[i] && (
                        <p className="text-xs italic text-slate-400">
                            {generateTranslitFallback(enArr[i])}
                        </p>
                    )}

                </div>
            ))}
        </div>
    );
}

/* ---------------- SIMPLE TRANSLIT FALLBACK ---------------- */
/* (Sefaria doesn’t consistently provide translit, so this is basic fallback) */
function generateTranslitFallback(text = '') {
    return text
        .replace(/[aeiou]/gi, '')
        .replace(/[^a-zA-Z\s]/g, '')
        .slice(0, 200);
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const scrollRef = useRef(null);
    const startRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [startIndex, setStartIndex] = useState(null);

    /* TOGGLES */
    const [showEnglish, setShowEnglish] = useState(true);
    const [showTranslit, setShowTranslit] = useState(false);

    const WINDOW = 2;

    /* ---------------- LOAD TOC ---------------- */
    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const rootKey = data?.schema?.key || bookRef.replace(/_/g, ' ');
                setSections(flattenNodes(nodes, rootKey));
            });
    }, [bookRef]);

    /* ---------------- LOAD TEXT ---------------- */
    const loadSection = async (i) => {
        if (loaded[i] || !sections[i]) return;

        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}`
        );

        const data = await res.json();

        setLoaded(prev => ({
            ...prev,
            [i]: data
        }));
    };

    /* ---------------- OPEN ---------------- */
    const openAt = async (i) => {
        setStartIndex(i);

        for (let x = i - WINDOW; x <= i + WINDOW; x++) {
            if (x >= 0 && x < sections.length) loadSection(x);
        }

        setTimeout(() => {
            startRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between items-start">
                <div className="flex gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>

                        {/* TOGGLES */}
                        {startIndex !== null && (
                            <div className="flex gap-2 mt-2">
                                <Button
                                    size="sm"
                                    variant={showEnglish ? "default" : "outline"}
                                    onClick={() => setShowEnglish(v => !v)}
                                >
                                    English
                                </Button>

                                <Button
                                    size="sm"
                                    variant={showTranslit ? "default" : "outline"}
                                    onClick={() => setShowTranslit(v => !v)}
                                >
                                    Transliteration
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <Button variant="ghost" onClick={() => setStartIndex(null)}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
            </div>

            {/* SCROLL AREA */}
            <div className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl">

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between p-3 border-b"
                            >
                                {sec.label}
                                <ChevronRight />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {sections.map((sec, i) => {
                            const data = loaded[i];

                            if (!data) loadSection(i);

                            return (
                                <div
                                    key={i}
                                    ref={i === startIndex ? startRef : null}
                                    className="space-y-3"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    {data ? (
                                        <SectionText
                                            he={data.he}
                                            text={data.text}
                                            showEnglish={showEnglish}
                                            showTranslit={showTranslit}
                                        />
                                    ) : (
                                        <div className="py-6 flex justify-center">
                                            <Loader2 className="animate-spin" />
                                        </div>
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
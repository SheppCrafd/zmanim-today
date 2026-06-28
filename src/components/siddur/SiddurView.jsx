import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';

/* ---------------- LOCK SCROLL GLOBALLY ---------------- */
if (typeof document !== 'undefined') {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.getElementById('root')?.style.setProperty('height', '100%');
    document.getElementById('root')?.style.setProperty('overflow', 'hidden');
}

/* ---------------- FLATTEN ---------------- */
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

/* ---------------- TEXT ---------------- */
function SectionText({ he, text }) {
    const heArr = Array.isArray(he) ? he : he ? [he] : [];
    const enArr = Array.isArray(text) ? text : text ? [text] : [];
    const maxLen = Math.max(heArr.length, enArr.length);

    if (!maxLen) {
        return <p className="text-slate-400 italic">No text.</p>;
    }

    return (
        <div className="space-y-6">
            {Array.from({ length: maxLen }).map((_, i) => (
                <div key={i} className="space-y-2">
                    {heArr[i] && (
                        <p dir="rtl" className="text-right text-lg font-serif"
                            dangerouslySetInnerHTML={{ __html: heArr[i] }} />
                    )}
                    {enArr[i] && (
                        <p className="text-sm text-slate-500"
                            dangerouslySetInnerHTML={{ __html: enArr[i] }} />
                    )}
                </div>
            ))}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const scrollRef = useRef(null);
    const startRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [loaded, setLoaded] = useState({});
    const [startIndex, setStartIndex] = useState(null);

    /* ---- virtualization window ---- */
    const [windowIndex, setWindowIndex] = useState(null);
    const WINDOW_SIZE = 2;

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

    /* ---------------- LOAD SECTION ---------------- */
    const loadSection = async (index) => {
        if (loaded[index]) return;

        const sec = sections[index];
        if (!sec) return;

        const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sec.ref)}`
        );

        const data = await res.json();

        setLoaded(prev => ({
            ...prev,
            [index]: data
        }));
    };

    /* ---------------- ENTER READER ---------------- */
    const openAt = async (index) => {
        setStartIndex(index);
        setWindowIndex(index);

        // preload window
        for (let i = index - WINDOW_SIZE; i <= index + WINDOW_SIZE; i++) {
            if (i >= 0 && i < sections.length) loadSection(i);
        }

        setTimeout(() => {
            startRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    /* ---------------- WINDOW SHIFT ON SCROLL ---------------- */
    const onScroll = () => {
        const el = scrollRef.current;
        if (!el || startIndex === null) return;

        const scrollTop = el.scrollTop;
        const height = el.clientHeight;

        const approxIndex = Math.floor(scrollTop / (height * 0.8));

        const newWindow = startIndex + approxIndex;
        if (Math.abs(newWindow - windowIndex) > 0) {
            setWindowIndex(newWindow);

            for (let i = newWindow - WINDOW_SIZE; i <= newWindow + WINDOW_SIZE; i++) {
                if (i >= 0 && i < sections.length) loadSection(i);
            }
        }
    };

    const visibleStart = Math.max(0, windowIndex - WINDOW_SIZE);
    const visibleEnd = Math.min(sections.length - 1, windowIndex + WINDOW_SIZE);

    const sectionUrl =
        startIndex !== null
            ? `https://www.sefaria.org/${encodeURIComponent(sections[startIndex]?.ref)}`
            : sefariaUrl;

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

            {/* HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between">
                <div className="flex gap-2">
                    <NavMenu />
                    <div>
                        <h1 className="font-bold">{title}</h1>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStartIndex(null)}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>

                    <a href={sectionUrl} target="_blank">
                        <Button variant="outline">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </a>
                </div>
            </div>

            {/* SCROLL AREA */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto mx-4 mb-4 bg-white dark:bg-slate-900 rounded-xl"
            >

                {/* TOC */}
                {startIndex === null && (
                    <div>
                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => openAt(i)}
                                className="w-full flex justify-between p-3 border-b hover:bg-slate-100"
                            >
                                <span>{sec.label}</span>
                                <ChevronRight />
                            </button>
                        ))}
                    </div>
                )}

                {/* READER */}
                {startIndex !== null && (
                    <div className="p-4 space-y-12">

                        {sections.map((sec, i) => {
                            if (i < visibleStart || i > visibleEnd) return null;

                            const data = loaded[i];

                            if (!data) {
                                loadSection(i);
                                return (
                                    <div key={i} className="py-10 flex justify-center">
                                        <Loader2 className="animate-spin" />
                                    </div>
                                );
                            }

                            const isStart = i === startIndex;

                            return (
                                <div
                                    key={i}
                                    ref={isStart ? startRef : null}
                                    className="space-y-3"
                                >
                                    <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 font-semibold">
                                        {sec.label}
                                    </div>

                                    <SectionText he={data.he} text={data.text} />
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>
        </div>
    );
}
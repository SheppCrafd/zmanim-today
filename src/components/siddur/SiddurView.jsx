import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate } from 'react-router-dom';

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

/* ---------------- TEXT QUALITY ---------------- */

const isHebrew = (t) => /[\u0590-\u05FF]/.test(t || '');
const hasLatin = (t) => /[A-Za-z]/.test(t || '');

const isBadEnglish = (t) => {
    if (!t) return true;

    const text = t.replace(/<[^>]*>/g, '').trim();

    const accents = (text.match(/[áéíóúãõçñ]/gi) || []).length;
    const words = text.split(/\s+/).length;

    const foreignHints =
        /ção|não|para|este|esta|que|de la|por la|el |los |con /i.test(text);

    const accentRatio = words ? accents / words : 0;

    return foreignHints || accentRatio > 0.08;
};

/* fake English → translate */
const translateToEnglish = async (text) => {
    try {
        const res = await fetch('https://libretranslate.de/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text,
                source: 'auto',
                target: 'en',
                format: 'text'
            })
        });

        const data = await res.json();
        return data?.translatedText || null;
    } catch {
        return null;
    }
};

/* ---------------- PROCESS LINE ---------------- */

const processLine = async (line) => {
    if (!line) return null;

    const plain = line.replace(/<[^>]*>/g, '').trim();
    if (plain.length < 2) return null;

    const hebrew = isHebrew(plain);
    const latin = hasLatin(plain);

    // NEVER touch Hebrew-only content
    if (hebrew && !latin) return line;

    // if no Latin at all → drop
    if (!latin) return null;

    // Latin text that is NOT real English → fix it
    if (isBadEnglish(plain)) {
        const translated = await translateToEnglish(plain);
        return translated || null;
    }

    // good English → keep
    return line;
};

/* ---------------- SECTION ---------------- */

function Section({ sec, data, langMode, rowRef, index }) {
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

    const heArr = Array.isArray(data.he) ? data.he : (data.he ? [data.he] : []);
    const enArr = Array.isArray(data.text) ? data.text : (data.text ? [data.text] : []);

    const showEN = langMode !== 'he';
    const showHB = langMode !== 'en';

    const maxLen = Math.max(heArr.length, enArr.length);

    return (
        <div ref={rowRef} data-index={index} className="space-y-4 scroll-mt-24">

            <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                    {sec.label}
                </p>
            </div>

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
        </div>
    );
}

/* ---------------- MAIN ---------------- */

export default function SiddurView({ title, subtitle, bookRef, sefariaUrl }) {
    const navigate = useNavigate();

    const rowRefs = useRef({});
    const observerRef = useRef(null);

    const [sections, setSections] = useState([]);
    const [textMap, setTextMap] = useState({});
    const [range, setRange] = useState({ start: 0, end: 5 });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [page, setPage] = useState('toc');
    const [langMode, setLangMode] = useState('both');

    const currentSection = useRef(0);

    /* ---------------- LOAD TOC ---------------- */

    useEffect(() => {
        fetch(`https://www.sefaria.org/api/index/${bookRef}`)
            .then(r => r.json())
            .then(data => {
                const nodes = data?.schema?.nodes || [];
                const flat = flattenNodes(nodes, data?.schema?.key || bookRef);

                setSections(flat);
                setLoading(false);
                setRange({ start: 0, end: 5 });
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [bookRef]);

    /* ---------------- LOAD TEXT (CLEAN PIPELINE) ---------------- */

    useEffect(() => {
        if (!sections.length) return;

        const load = async () => {
            for (let i = range.start; i <= range.end; i++) {
                if (!sections[i] || textMap[i]) continue;

                try {
                    const res = await fetch(
                        `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}?lang=bi`
                    );
                    const data = await res.json();

                    const rawEN = Array.isArray(data.text)
                        ? data.text
                        : (data.text ? [data.text] : []);

                    const cleaned = [];

                    for (const line of rawEN) {
                        const processed = await processLine(line);
                        if (processed) cleaned.push(processed);
                    }

                    setTextMap(prev => ({
                        ...prev,
                        [i]: {
                            ...data,
                            text: cleaned
                        }
                    }));

                } catch {
                    setTextMap(prev => ({ ...prev, [i]: { error: true } }));
                }
            }
        };

        load();
    }, [range, sections]);

    /* ---------------- SCROLL ---------------- */

    const onScroll = (e) => {
        const el = e.target;

        if (el.scrollTop + el.clientHeight > el.scrollHeight - 800) {
            setRange(r => ({
                start: r.start,
                end: Math.min(sections.length - 1, r.end + 2)
            }));
        }

        if (el.scrollTop < 800) {
            setRange(r => ({
                start: Math.max(0, r.start - 2),
                end: r.end
            }));
        }
    };

    /* ---------------- RENDER ---------------- */

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">

            <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">

                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 relative z-50">
                        <NavMenu />
                        <div>
                            <h1 className="text-lg font-bold">{title}</h1>
                            <p className="text-xs text-slate-500">{subtitle}</p>
                        </div>
                    </div>

                    <a href={sefariaUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </a>
                </div>

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

            <div className="flex-1 overflow-hidden">

                {page === 'toc' && (
                    <div className="h-full overflow-y-auto px-4">
                        {loading && <Loader2 className="animate-spin" />}
                        {error && <AlertCircle />}

                        {sections.map((sec, i) => (
                            <button
                                key={i}
                                onClick={() => setPage('reader')}
                                className="w-full text-left py-3 border-b"
                            >
                                {sec.label}
                            </button>
                        ))}
                    </div>
                )}

                {page === 'reader' && (
                    <div className="h-full overflow-y-auto px-4 pb-10" onScroll={onScroll}>
                        {sections.slice(range.start, range.end + 1).map((sec, i) => {
                            const index = range.start + i;

                            return (
                                <Section
                                    key={index}
                                    index={index}
                                    sec={sec}
                                    data={textMap[index]}
                                    langMode={langMode}
                                    rowRef={(el) => {
                                        rowRefs.current[index] = el;
                                    }}
                                />
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}
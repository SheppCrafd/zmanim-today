import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavMenu from '@/components/NavMenu';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

/* ---------------- HELPERS ---------------- */

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

const isEnglishLine = (t) => {
  if (!t) return false;
  const plain = t.replace(/<[^>]*>/g, '').trim();
  const latin = plain.match(/[A-Za-z]/g) || [];
  const hebrew = plain.match(/[\u0590-\u05FF]/g) || [];
  const total = latin.length + hebrew.length;
  if (total === 0) return false;
  return latin.length > 5 && (latin.length / total) > 0.75;
};

/* ---------------- SECTION ---------------- */

function Section({ sec, data, rowRef, langMode }) {
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
  const enRaw = Array.isArray(data.text) ? data.text : (data.text ? [data.text] : []);
  const enArr = enRaw.filter(isEnglishLine);

  const showEN = langMode !== 'he';
  const showHB = langMode !== 'en';

  const maxLen = Math.max(heArr.length, enArr.length);

  return (
    <div ref={rowRef} className="space-y-4 scroll-mt-24">
      <div className="sticky top-0 bg-white dark:bg-slate-900 py-2 z-10 border-b">
        <p className="font-semibold">{sec.label}</p>
      </div>

      <div className="space-y-6">
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} className="space-y-2">

            {showHB && heArr[i] && (
              <p
                className="text-right text-lg font-serif"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: heArr[i] }}
              />
            )}

            {showEN && enArr[i] && (
              <p
                className="text-sm text-slate-500"
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
  const { sectionId, language } = useParams();
  const location = useLocation();

  const langMode = language || 'both';

  const rowRefs = useRef({});
  const observerRef = useRef(null);

  const [sections, setSections] = useState([]);
  const [textMap, setTextMap] = useState({});
  const [range, setRange] = useState({ start: 0, end: 4 });
  const [loading, setLoading] = useState(true);

  const currentSection = sectionId ? parseInt(sectionId) : null;

  /* ---------------- LOAD TOC ---------------- */

  useEffect(() => {
    fetch(`https://www.sefaria.org/api/index/${bookRef}`)
      .then(r => r.json())
      .then(data => {
        const nodes = data?.schema?.nodes || [];
        const rootKey = data?.schema?.key || bookRef.replace(/_/g, ' ');
        const flat = flattenNodes(nodes, rootKey);
        setSections(flat);
        setLoading(false);

        setRange({ start: 0, end: Math.min(4, flat.length - 1) });
      });
  }, [bookRef]);

  /* ---------------- LOAD WINDOWED TEXT ---------------- */

  useEffect(() => {
    const load = async () => {
      const slice = sections.slice(range.start, range.end + 1);

      for (let i = range.start; i <= range.end; i++) {
        if (textMap[i]) continue;

        try {
          const res = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(sections[i].ref)}?lang=bi`
          );
          const data = await res.json();

          setTextMap(prev => ({ ...prev, [i]: data }));
        } catch {
          setTextMap(prev => ({ ...prev, [i]: { error: true } }));
        }
      }
    };

    if (sections.length) load();
  }, [range, sections]);

  /* ---------------- INTERSECTION OBSERVER ---------------- */

  useEffect(() => {
    if (!sections.length) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const index = Number(entry.target.dataset.index);

          const newUrl = `/SephardicSiddur/section/${index}/${langMode}`;

          navigate(newUrl, { replace: true });
        });
      },
      { rootMargin: '-40% 0px -40% 0px' }
    );

    Object.values(rowRefs.current).forEach(el => {
      if (el) observerRef.current.observe(el);
    });

  }, [sections, langMode]);

  /* ---------------- WINDOW SCROLLING ---------------- */

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

  /* ---------------- TOC ---------------- */

  const openSection = (i) => {
    navigate(`/SephardicSiddur/section/${i}/both`);
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white border-b px-4 py-2 flex justify-between">
        <div>
          <NavMenu />
          <div>
            <h1 className="font-bold">{title}</h1>
            <p className="text-xs">{subtitle}</p>
          </div>
        </div>

        <a href={sefariaUrl} target="_blank">
          <Button>Open</Button>
        </a>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden">

        {/* TOC */}
        {!sectionId && (
          <div className="overflow-y-auto h-full px-4">
            {loading && <Loader2 className="animate-spin" />}
            {sections.map((s, i) => (
              <button key={i} onClick={() => openSection(i)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* READER */}
        {sectionId && (
          <div className="overflow-y-auto h-full px-4" onScroll={onScroll}>

            {sections.slice(range.start, range.end + 1).map((sec, i) => {
              const index = range.start + i;

              return (
                <Section
                  key={index}
                  sec={sec}
                  data={textMap[index]}
                  langMode={langMode}
                  rowRef={(el) => {
                    rowRefs.current[index] = el;
                    if (el) el.dataset.index = index;
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
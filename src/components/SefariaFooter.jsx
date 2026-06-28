import React from 'react';

export default function SefariaFooter() {
    return (
        <div className="flex items-center justify-center gap-2 py-3 px-4 border-t border-slate-100 bg-white/60 shrink-0">
            <span className="text-xs text-slate-400">Texts powered by</span>
            <a
                href="https://www.sefaria.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
                <img
                    src="https://www.sefaria.org/static/img/logo.svg"
                    alt="Sefaria"
                    className="h-4 w-auto"
                    onError={e => { e.target.style.display = 'none'; }}
                />
                <span className="text-xs font-semibold text-[#004E5F]">Sefaria</span>
            </a>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-400">Open Source Torah</span>
        </div>
    );
}
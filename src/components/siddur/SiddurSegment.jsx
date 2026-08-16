import { memo } from "react";
import { AlertCircle, Bookmark, BookmarkCheck } from "lucide-react";

/* Memoized header — only re-renders if the label/bookmark state changes */
export const SiddurHeader = memo(function SiddurHeader({
  label,
  heLabel,
  bookmarked,
  onToggleBookmark,
}) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-2 font-semibold text-base bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div>
        {label}
        {heLabel ? (
          <span className="font-normal text-slate-500 dark:text-slate-400">
            {" - "}
            <span dir="rtl">{heLabel}</span>
          </span>
        ) : null}
      </div>
      {onToggleBookmark && (
        <button
          onClick={onToggleBookmark}
          aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
          className="shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {bookmarked ? (
            <BookmarkCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
});

// Sefaria text sometimes marks a footnote as a <sup> immediately followed by
// an <i> (the note body). Since that markup arrives as raw sanitized HTML via
// dangerouslySetInnerHTML — outside React's tree — toggling it on click has
// to be plain DOM event delegation rather than component state.
const handleNoteClick = (e) => {
  const sup = e.target.closest("sup");
  if (!sup) return;
  const note = sup.nextElementSibling;
  if (!note || note.tagName !== "I") return;
  const open = sup.classList.toggle("siddur-note-open");
  note.classList.toggle("siddur-note-open", open);
};

// Tailwind needs literal class strings to find at build time — a template
// literal like `md:grid-cols-${n}` wouldn't be picked up by its scanner.
const GRID_COLS_CLASS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

/* Memoized segment — only re-renders if its own text or visibility props change */
export const SiddurSegment = memo(function SiddurSegment({
  sanitizedHe,
  sanitizedEn,
  sanitizedHeTranslit,
  hasH,
  hasE,
  showHB,
  showEN,
  showTranslit,
  specialLabel,
}) {
  // Column count follows the toggles themselves, not hasH/hasE, so every
  // segment in a section shares the same grid shape (no per-segment column
  // count drift/misalignment down a long list).
  const activeColumns = [showHB, showEN, showTranslit].filter(Boolean).length;
  const gridClass =
    activeColumns > 1
      ? `md:grid ${GRID_COLS_CLASS[activeColumns] || ""} md:gap-4 space-y-4 md:space-y-0`
      : "";

  return (
    <div className={`px-4 py-2 ${specialLabel ? "siddur-special-row" : ""}`}>
      {specialLabel && (
        <span className="siddur-special-badge" dir="auto">
          {specialLabel} — say today
        </span>
      )}
      <div className={gridClass}>
        {/* HEBREW — first in source order so mobile stacks it on top;
            desktop pins it rightmost (order-3) of up to 3 columns. */}
        {showHB && (
          <div className="md:order-3">
            {hasH && (
              <p
                dir="rtl"
                className={`siddur-text text-right leading-loose font-serif ${
                  specialLabel ? "siddur-special" : ""
                }`}
                onClick={handleNoteClick}
                dangerouslySetInnerHTML={{ __html: sanitizedHe }}
              />
            )}
          </div>
        )}

        {/* TRANSLITERATION — second in source order so on mobile it stacks
            directly under Hebrew (not floating between Hebrew and English);
            desktop places it as a real middle column (order-2). Block is
            right-aligned to match Hebrew's mobile position, but the text
            itself stays dir="ltr" (a right-justified Latin paragraph, not a
            mirrored one). */}
        {showTranslit && (
          <div className="md:order-2 text-right md:text-left">
            {hasH && sanitizedHeTranslit && (
              <p
                dir="ltr"
                className={`siddur-text leading-relaxed text-slate-500 dark:text-slate-500 italic ${
                  specialLabel ? "siddur-special" : ""
                }`}
                onClick={handleNoteClick}
                dangerouslySetInnerHTML={{ __html: sanitizedHeTranslit }}
              />
            )}
          </div>
        )}

        {/* ENGLISH — last in source order (bottom on mobile); desktop
            leftmost (order-1). */}
        {showEN && (
          <div className="md:order-1">
            {hasE && (
              <p
                className={`siddur-text text-left leading-relaxed text-slate-600 dark:text-slate-400 ${
                  specialLabel ? "siddur-special" : ""
                }`}
                onClick={handleNoteClick}
                dangerouslySetInnerHTML={{ __html: sanitizedEn }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* Skeleton placeholder — stable height prevents scrollbar jitter on load */
export const SiddurLoading = memo(function SiddurLoading() {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
    </div>
  );
});

export const SiddurError = memo(function SiddurError() {
  return (
    <div className="px-4 py-3 text-sm text-red-500 flex items-center gap-2">
      <AlertCircle className="w-4 h-4" /> Failed to load section
    </div>
  );
});

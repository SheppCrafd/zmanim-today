import React, { memo } from "react";
import { AlertCircle } from "lucide-react";

/* Memoized header — only re-renders if the label changes */
export const SiddurHeader = memo(function SiddurHeader({ label }) {
  return (
    <div className="px-3 py-2 font-semibold bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {label}
    </div>
  );
});

/* Memoized segment — only re-renders if its own text or visibility props change */
export const SiddurSegment = memo(function SiddurSegment({
  sanitizedHe,
  sanitizedEn,
  hasH,
  hasE,
  showHB,
  showEN,
  fontScale,
}) {
  return (
    <div
      className="px-4 py-2 md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0"
      style={{ fontSize: `${fontScale}em` }}
    >
      {/* Hebrew always goes on the right if both are showing, but flex/grid order can handle this naturally.
            Since grid defaults to LTR, we actually want Hebrew on the right side of the screen 
            if both are present. Let's ensure the order is correct. */}
      {showEN && hasE && (
        <div className={`${showHB && hasH ? "order-2 md:order-1" : ""}`}>
          <p
            className="text-left leading-relaxed text-slate-600 dark:text-slate-400"
            dangerouslySetInnerHTML={{ __html: sanitizedEn }}
          />
        </div>
      )}

      {showHB && hasH && (
        <div className={`${showEN && hasE ? "order-1 md:order-2" : ""}`}>
          <p
            dir="rtl"
            className="text-right leading-loose font-serif"
            dangerouslySetInnerHTML={{ __html: sanitizedHe }}
          />
        </div>
      )}
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
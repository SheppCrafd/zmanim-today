import { useState } from "react";

// Per-book bookmark list for the Siddur reader. Colon-namespaced key, same
// convention SiddurView.jsx already uses for its own per-book localStorage
// state (siddur-empty-refs:${bookRef}).
export function useSiddurBookmarks(bookRef) {
  const key = `siddur-bookmarks:${bookRef}`;

  const [bookmarks, setBookmarksState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const persist = (next) => {
    setBookmarksState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const isBookmarked = (ref) => bookmarks.some((b) => b.ref === ref);

  const toggleBookmark = ({ ref, label, heLabel }) => {
    if (isBookmarked(ref)) {
      persist(bookmarks.filter((b) => b.ref !== ref));
    } else {
      persist([...bookmarks, { ref, label, heLabel }]);
    }
  };

  const removeBookmark = (ref) => {
    persist(bookmarks.filter((b) => b.ref !== ref));
  };

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark };
}

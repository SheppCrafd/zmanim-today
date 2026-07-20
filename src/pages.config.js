// NavigationTracker only reads Object.keys(PAGES) to match a URL segment to a
// page name for logging — the values themselves are never used, so this stays
// a plain name map rather than importing (and eagerly bundling) the actual
// page components.
export const PAGES = {
  Zmanim: true,
};

export const pagesConfig = {
  mainPage: "Zmanim",
  Pages: PAGES,
};

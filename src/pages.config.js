// NavigationTracker only reads Object.keys(PAGES) to match a URL segment to a
// page name for logging — the values themselves are never used, so this stays
// a plain name map rather than importing (and eagerly bundling) the actual
// page components. Every real route in App.jsx needs an entry here or its
// page views are silently never logged — previously only Zmanim was listed,
// so Compass, Settings, and all three Siddur routes got zero analytics.
export const PAGES = {
  Zmanim: true,
  Compass: true,
  Settings: true,
  SephardicSiddur: true,
  AshkenaziSiddur: true,
  ChabadSiddur: true,
};

export const pagesConfig = {
  mainPage: "Zmanim",
  Pages: PAGES,
};

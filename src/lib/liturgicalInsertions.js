// Conditional insertions in the weekday/Shabbat liturgy — segments containing
// one of these phrases get highlighted in the Siddur reader when today's
// getLiturgicalFlags() (src/lib/hebrewDate.js) says the condition applies.
// Phrases are given without nikud (consonants only) since segment text is
// stripped of nikud before matching, and are shared across nusachot — the
// core wording of each insertion doesn't vary between Ashkenaz/Sephard/Chabad.
export const INSERTIONS = [
  {
    id: "yaaleh-vyavo",
    label: "Ya'aleh V'yavo",
    // Ashkenaz/Chabad spell it defective (ויבא); Edot HaMizrach's own
    // halachic notes spell it plene (ויבוא) — different nusachot, different
    // spelling of the same word, so both variants need to be checked.
    he: ["יעלה ויבא", "יעלה ויבוא"],
    active: (f) => f.yaalehVyavo,
  },
  {
    id: "al-hanisim-chanukah",
    label: "Al Hanisim — Chanukah",
    he: "בימי מתתיהו",
    active: (f) => f.chanukah,
  },
  {
    id: "al-hanisim-purim",
    label: "Al Hanisim — Purim",
    he: "בימי מרדכי ואסתר",
    active: (f) => f.purim,
  },
  {
    // Sefaria splits this blessing into separate segments at the seasonal
    // switch point — "...וְתֵן" ends one segment and "טַל וּמָטָר לִבְרָכָה"
    // is its own segment right after. A phrase spanning both ("ותן טל ומטר
    // לברכה") would never match any single segment's text, so match just
    // the self-contained "טל ומטר" segment instead.
    id: "tal-umatar",
    label: "V'ten Tal U'matar",
    he: "טל ומטר",
    active: (f) => f.talUmatar,
  },
  {
    id: "mashiv-haruach",
    label: "Mashiv Haruach",
    he: "משיב הרוח ומוריד הגשם",
    active: (f) => f.mashivHaruach,
  },
  {
    id: "morid-hatal",
    label: "Morid Hatal",
    he: "מוריד הטל",
    active: (f) => !f.mashivHaruach,
  },
  {
    id: "aneinu",
    label: "Aneinu (fast day)",
    he: "עננו ביום צום",
    active: (f) => f.fastDay,
  },
  {
    id: "avinu-malkeinu",
    label: "Avinu Malkeinu",
    he: "אבינו מלכנו",
    active: (f) => f.aseretYemeiTeshuva || f.fastDay,
  },
  {
    id: "hallel",
    label: "Hallel",
    he: "הללויה הללו עבדי",
    active: (f) => f.hallel,
  },
];

const stripNikud = (s) => (s || "").replace(/[֑-ׇ׳״]/g, "");
const stripTags = (s) => (s || "").replace(/<[^>]*>/g, "");
const normalize = (s) => stripNikud(stripTags(s));

// Returns the first active insertion whose phrase appears in this segment's
// raw Hebrew text, or null. `activeInsertions` is the pre-filtered subset of
// INSERTIONS that apply today (see getActiveInsertions below). `he` may be a
// single phrase or an array of spelling variants (nusachot don't always
// spell the same word the same way — see yaaleh-vyavo above).
export function matchInsertion(heText, activeInsertions) {
  if (!heText || !activeInsertions.length) return null;
  const normalized = normalize(heText);
  return (
    activeInsertions.find((ins) => {
      const variants = Array.isArray(ins.he) ? ins.he : [ins.he];
      return variants.some((phrase) => normalized.includes(phrase));
    }) || null
  );
}

export function getActiveInsertions(flags) {
  if (!flags) return [];
  return INSERTIONS.filter((ins) => ins.active(flags));
}

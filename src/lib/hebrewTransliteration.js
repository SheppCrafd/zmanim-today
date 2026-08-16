// Rule-based Hebrew (with nikud) -> Latin transliteration, Sephardi/Modern
// Hebrew convention (matches Sefaria's own English translation styling, not
// Ashkenazi). No transliteration/nikud-classification code existed anywhere
// in this repo before this file — genuinely greenfield, verified against
// real Sefaria segments (see scratchpad verification script referenced in
// the Siddur Footnote/Liturgical-Insertion decision note's sibling session).
//
// Known, accepted simplifications (no per-character table can resolve these
// without full grammatical/stress analysis):
//   - sheva na/nach isn't truly disambiguated, but word-initial sheva is
//     vocalized as a short "e" (a common, cheap heuristic — word-initial
//     sheva is almost always vocal in practice) and silent everywhere else;
//     without this, real connected text produces unpronounceable clusters
//     like "Bkhal-lvavkha" instead of "Bekhal-levavkha"
//   - dagesh chazak (gemination) is not doubled in output ("Shabat" not
//     "Shabbat")
//   - kamatz gadol vs. katan is not distinguished (always "a"); the rarer
//     explicit qamats-qatan codepoint (U+05C7) IS honored, since it's
//     unambiguous when present
//   - matres lectionis are handled for the common patterns (vav+holam,
//     vav+shuruk, yod after hiriq/tzere) but not fully generalized

const HEBREW_BASE_RE = /[א-ת]/;
const HEBREW_RUN_RE = /[א-ת֑-ׇ]+/g;

const CANTILLATION_MIN = 0x0591;
const CANTILLATION_MAX = 0x05af;
const isCantillation = (cp) => cp >= CANTILLATION_MIN && cp <= CANTILLATION_MAX;

const DAGESH = 0x05bc; // also mapiq when hosted on he
const SHIN_DOT = 0x05c1;
const SIN_DOT = 0x05c2;
const MAQAF = 0x05be;
const SOF_PASUQ = 0x05c3;
const PASEQ = 0x05c0;
const METEG = 0x05bd;
const RAFE = 0x05bf;

const SHEVA = 0x05b0;

const VOWEL_MAP = {
  0x05b0: "", // sheva - silent by default; word-initial override below
  0x05b1: "e", // hataf segol
  0x05b2: "a", // hataf patach
  0x05b3: "o", // hataf kamatz
  0x05b4: "i", // hiriq
  0x05b5: "e", // tzere
  0x05b6: "e", // segol
  0x05b7: "a", // patach
  0x05b8: "a", // kamatz (gadol/katan not distinguished)
  0x05b9: "o", // holam
  0x05ba: "o", // holam haser for vav
  0x05bb: "u", // kubutz
  0x05c7: "o", // qamats qatan (unambiguous codepoint)
};

const ALEF = 0x05d0;
const BET = 0x05d1;
const HE = 0x05d4;
const VAV = 0x05d5;
const KAF = 0x05db;
const KAF_SOFIT = 0x05da;
const YOD = 0x05d9;
const AYIN = 0x05e2;
const PE = 0x05e4;
const PE_SOFIT = 0x05e3;
const SHIN = 0x05e9;

// Consonant -> plain sound. Bet/kaf/pe are overridden by dagesh presence in
// classifyCluster(); shin/sin resolved separately via shin/sin dot.
const CONSONANT_MAP = {
  [ALEF]: "",
  [BET]: "v",
  0x05d2: "g", // gimel
  0x05d3: "d", // dalet
  [HE]: "h",
  [VAV]: "v",
  0x05d6: "z", // zayin
  0x05d7: "ch", // het
  0x05d8: "t", // tet
  [YOD]: "y",
  [KAF_SOFIT]: "kh",
  [KAF]: "kh",
  0x05dc: "l", // lamed
  0x05dd: "m", // mem sofit
  0x05de: "m", // mem
  0x05df: "n", // nun sofit
  0x05e0: "n", // nun
  0x05e1: "s", // samekh
  [AYIN]: "'",
  [PE_SOFIT]: "f",
  [PE]: "f",
  0x05e5: "tz", // tsadi sofit
  0x05e6: "tz", // tsadi
  0x05e7: "k", // qof
  0x05e8: "r", // resh
  [SHIN]: "sh",
  0x05ea: "t", // tav (Sephardi: always t)
};

const DAGESH_HARD = {
  [BET]: "b",
  [KAF]: "k",
  [KAF_SOFIT]: "k",
  [PE]: "p",
  [PE_SOFIT]: "p",
};

// Split raw Hebrew text (nikud intact) into clusters of {base, marks[]} plus
// standalone punctuation clusters (maqaf/sof-pasuq/paseq) and pass-through
// runs of non-Hebrew text (spaces, Latin, digits, other punctuation).
function clusterHebrewRun(run) {
  const clusters = [];
  let i = 0;
  while (i < run.length) {
    const cp = run.codePointAt(i);
    if (cp === MAQAF) {
      clusters.push({ punct: "-" });
      i++;
      continue;
    }
    if (cp === SOF_PASUQ) {
      clusters.push({ punct: "." });
      i++;
      continue;
    }
    if (cp === PASEQ || cp === METEG || cp === RAFE) {
      i++; // silent marks with no standalone meaning here
      continue;
    }
    if (isCantillation(cp)) {
      i++; // cantillation trope, never voiced
      continue;
    }
    if (!HEBREW_BASE_RE.test(run[i])) {
      i++; // stray combining mark with no base (shouldn't normally happen)
      continue;
    }
    const base = cp;
    i++;
    const marks = [];
    while (i < run.length) {
      const mcp = run.codePointAt(i);
      if (HEBREW_BASE_RE.test(run[i])) break;
      if (mcp === MAQAF || mcp === SOF_PASUQ) break;
      if (mcp === PASEQ || mcp === METEG || mcp === RAFE) {
        i++;
        continue;
      }
      if (isCantillation(mcp)) {
        i++;
        continue;
      }
      marks.push(mcp);
      i++;
    }
    clusters.push({ base, marks });
  }
  return clusters;
}

function vowelOf(marks) {
  for (const m of marks) {
    if (m in VOWEL_MAP) return VOWEL_MAP[m];
  }
  return null; // no vowel mark present on this cluster
}

function isSilentMaterYod(cluster) {
  return (
    cluster &&
    cluster.base === YOD &&
    (!cluster.marks || vowelOf(cluster.marks) === null) &&
    !(cluster.marks || []).includes(DAGESH)
  );
}

// The Tetragrammaton (יהוה) is never read aloud by its literal letters in
// Jewish practice — the text is vocalized with Adonai's own vowels
// specifically as a reading cue. A literal per-letter transliteration here
// would be both wrong and religiously off — every real transliteration
// renders this word as "Adonai" outright, so this checks base letters only
// (ignoring which exact vowel cue is present) and short-circuits before any
// per-cluster processing runs.
const TETRAGRAMMATON = [YOD, HE, VAV, HE];
function isTetragrammaton(clusters) {
  return (
    clusters.length === 4 &&
    clusters.every((c, i) => !c.punct && c.base === TETRAGRAMMATON[i])
  );
}

// Transliterate one maximal run of Hebrew letters/marks (a "word" — the
// caller has already split on everything non-Hebrew, so word boundaries are
// implicit: cluster[0] is word-initial, the last cluster is word-final).
function transliterateHebrewRun(run) {
  const clusters = clusterHebrewRun(run);
  if (isTetragrammaton(clusters)) return "Adonai";
  let out = "";

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    if (c.punct) {
      out += c.punct;
      continue;
    }

    const hasDagesh = c.marks.includes(DAGESH);
    const isWordInitial = i === 0;
    const isWordFinal = i === clusters.length - 1;

    // Vav acting as a vowel-carrier (holam/shuruk) rather than a consonant:
    // the vowel is hosted ON the vav itself, so the "v" sound is dropped.
    if (c.base === VAV) {
      const v = vowelOf(c.marks);
      if (hasDagesh && v === null) {
        out += "u"; // shuruk
        continue;
      }
      if (v === "o" && !hasDagesh) {
        out += "o"; // vav + holam
        continue;
      }
    }

    let consonant;
    if (c.base === HE) {
      // Word-final he is spelled "h" by every real transliteration
      // convention ("Torah", "Atah") regardless of mapiq — the mapiq/non-
      // mapiq distinction only matters for formal phonetic precision, which
      // isn't what any real siddur transliteration actually follows here.
      consonant = "h";
    } else if (c.base === AYIN) {
      // Silent at word boundaries (never "Shema'" or "Yeshua'"); only a
      // truly medial ayin gets the apostrophe ("Ma'ariv", "Ha'olam").
      consonant = isWordInitial || isWordFinal ? "" : "'";
    } else if (c.base === SHIN) {
      if (c.marks.includes(SIN_DOT)) consonant = "s";
      else consonant = "sh"; // shin dot or undotted both default to sh
    } else if (hasDagesh && c.base in DAGESH_HARD) {
      consonant = DAGESH_HARD[c.base];
    } else {
      consonant = CONSONANT_MAP[c.base] ?? "";
    }

    let vowel = vowelOf(c.marks) || "";
    if (isWordInitial && c.marks.includes(SHEVA)) vowel = "e";

    // Mater lectionis: a bare yod immediately after a hiriq or tzere cluster
    // is a silent vowel-lengthener, not a consonant "y" — absorb it,
    // rendering tzere+yod as the "ei" diphthong.
    const next = clusters[i + 1];
    if (isSilentMaterYod(next)) {
      if (vowel === "i") {
        i++; // skip the yod cluster, hiriq malei is just "i"
      } else if (vowel === "e") {
        vowel = "ei"; // tzere malei diphthong
        i++;
      }
    }

    out += consonant + vowel;
  }

  return out;
}

// Capitalize each transliterated word for readability, matching the
// convention most siddur transliterations already use.
function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/**
 * Transliterate a plain string of Hebrew (with nikud) mixed with ordinary
 * text (spaces, digits, Latin, punctuation) — non-Hebrew runs pass through
 * unchanged; Hebrew runs are transliterated word-by-word and capitalized.
 */
export function transliterateSegment(text) {
  if (!text) return "";
  return text.replace(HEBREW_RUN_RE, (run) => capitalize(transliterateHebrewRun(run)));
}

/**
 * Transliterate a single Hebrew word (nikud intact, no surrounding text).
 * Exposed separately for direct, DOM-free unit testing.
 */
export function transliterateWord(word) {
  return capitalize(transliterateHebrewRun(word || ""));
}

// Tag-safe wrapper: Sefaria/DOMPurify-sanitized segment HTML only ever
// contains a small set of bare tags (<sup>/<i>/<b>/<small>/<em>/<br>, no
// attributes). Splitting on tag boundaries and transliterating only the
// non-tag runs keeps this whole engine — including tag-safety — testable in
// plain Node with no DOM/jsdom dependency, and keeps footnote <sup> markers
// intact so the existing click-to-expand behavior (SiddurSegment.jsx) still
// works on transliterated text.
const TAG_SPLIT_RE = /(<[^>]+>)/g;

export function transliterateHebrewText(htmlString) {
  if (!htmlString) return "";
  return htmlString
    .split(TAG_SPLIT_RE)
    .map((piece) => (piece.startsWith("<") ? piece : transliterateSegment(piece)))
    .join("");
}

// Module-level cache, mirroring SiddurView.jsx's sanitizeCache/sanitizeCached
// exactly — transliteration is a pure function of its input string, and
// Sefaria text is immutable once fetched, so caching forever is safe.
const transliterateCache = new Map();

export function transliterateCached(htmlString) {
  if (!htmlString) return "";
  const hit = transliterateCache.get(htmlString);
  if (hit !== undefined) return hit;
  const out = transliterateHebrewText(htmlString);
  transliterateCache.set(htmlString, out);
  return out;
}

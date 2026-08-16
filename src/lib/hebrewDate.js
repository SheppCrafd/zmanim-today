// Fetches accurate Hebrew date info from the Hebcal converter API

const HEBREW_DAYS = [
  { hebrew: "יוֹם רִאשׁוֹן", transliterated: "Yom Rishon" }, // Sunday
  { hebrew: "יוֹם שֵׁנִי", transliterated: "Yom Sheni" }, // Monday
  { hebrew: "יוֹם שְׁלִישִׁי", transliterated: "Yom Shlishi" }, // Tuesday
  { hebrew: "יוֹם רְבִיעִי", transliterated: "Yom Revi'i" }, // Wednesday
  { hebrew: "יוֹם חֲמִישִׁי", transliterated: "Yom Chamishi" }, // Thursday
  { hebrew: "יוֹם שִׁשִּׁי", transliterated: "Yom Shishi" }, // Friday
  { hebrew: "שַׁבָּת", transliterated: "Shabbat" }, // Saturday
];

// Keys match Hebcal's exact spelling (including curly apostrophes)
const PARSHA_HEBREW = {
  Bereshit: "בְּרֵאשִׁית",
  Noach: "נֹחַ",
  "Lech-Lecha": "לֶךְ-לְךָ",
  Vayera: "וַיֵּרָא",
  "Chayei Sara": "חַיֵּי שָׂרָה",
  Toldot: "תּוֹלְדוֹת",
  Vayetzei: "וַיֵּצֵא",
  Vayishlach: "וַיִּשְׁלַח",
  Vayeshev: "וַיֵּשֶׁב",
  Miketz: "מִקֵּץ",
  Vayigash: "וַיִּגַּשׁ",
  Vayechi: "וַיְחִי",
  Shemot: "שְׁמוֹת",
  Vaera: "וָאֵרָא",
  Bo: "בֹּא",
  Beshalach: "בְּשַׁלַּח",
  Yitro: "יִתְרוֹ",
  Mishpatim: "מִשְׁפָּטִים",
  Terumah: "תְּרוּמָה",
  Tetzaveh: "תְּצַוֶּה",
  "Ki Tisa": "כִּי תִשָּׂא",
  Vayakhel: "וַיַּקְהֵל",
  Pekudei: "פְקוּדֵי",
  "Vayakhel-Pekudei": "וַיַּקְהֵל-פְקוּדֵי",
  Vayikra: "וַיִּקְרָא",
  Tzav: "צַו",
  Shmini: "שְׁמִינִי",
  Tazria: "תַּזְרִיעַ",
  Metzora: "מְצֹרָע",
  "Tazria-Metzora": "תַּזְרִיעַ-מְצֹרָע",
  "Achrei Mot": "אַחֲרֵי מוֹת",
  Kedoshim: "קְדֹשִׁים",
  "Achrei Mot-Kedoshim": "אַחֲרֵי מוֹת-קְדֹשִׁים",
  Emor: "אֱמֹר",
  Behar: "בְּהַר",
  Bechukotai: "בְּחֻקֹּתַי",
  "Behar-Bechukotai": "בְּהַר-בְּחֻקֹּתַי",
  Bamidbar: "בְּמִדְבַּר",
  Nasso: "נָשֹׂא",
  "Beha\u2019alotcha": "בְּהַעֲלֹתְךָ", // Hebcal uses curly apostrophe
  "Sh\u2019lach": "שְׁלַח", // Hebcal spells it "Sh'lach"
  Shelach: "שְׁלַח", // fallback straight spelling
  Korach: "קֹרַח",
  Chukat: "חֻקַּת",
  Balak: "בָּלָק",
  "Chukat-Balak": "חֻקַּת-בָּלָק",
  Pinchas: "פִּינְחָס",
  Matot: "מַטּוֹת",
  Masei: "מַסְעֵי",
  "Matot-Masei": "מַטּוֹת-מַסְעֵי",
  Devarim: "דְּבָרִים",
  Vaetchanan: "וָאֶתְחַנַּן",
  Eikev: "עֵקֶב",
  "Re\u2019eh": "רְאֵה", // Hebcal uses curly apostrophe
  Reeh: "רְאֵה", // fallback
  Shoftim: "שֹׁפְטִים",
  "Ki Teitzei": "כִּי תֵצֵא",
  "Ki Tavo": "כִּי תָבוֹא",
  Nitzavim: "נִצָּבִים",
  Vayeilech: "וַיֵּלֶךְ",
  "Nitzavim-Vayeilech": "נִצָּבִים-וַיֵּלֶךְ",
  "Ha\u2019azinu": "הַאֲזִינוּ", // Hebcal uses curly apostrophe + lowercase
  "Vezot Haberakhah": "וְזֹאת הַבְּרָכָה",
};

async function convert(date) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const res = await fetch(
    `https://www.hebcal.com/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1&strict=1`,
  );
  if (!res.ok) throw new Error("Hebrew date conversion failed");
  return res.json();
}

// A Gregorian date's Hebrew date/parsha never changes, so once resolved it's
// cached for the rest of the session — repeat visits to the same date (very
// common via the Zmanim page's Today/prev/next controls) are instant instead
// of re-hitting Hebcal.
const hebrewDateCache = new Map();
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Raw Hebcal converter response (hm/hd/events), cached separately from the
// display-formatted result above — used by getLiturgicalFlags to detect
// Rosh Chodesh/festivals/fasts for a given day.
const rawDayCache = new Map();
async function convertCached(date) {
  const key = dateKey(date);
  const hit = rawDayCache.get(key);
  if (hit) return hit;
  const data = await convert(date);
  rawDayCache.set(key, data);
  return data;
}

const WINTER_HEBREW_MONTHS = [
  "Kislev",
  "Tevet",
  "Shevat",
  "Adar",
  "Adar I",
  "Adar II",
];

const isGregorianLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

// V'ten Tal U'matar (the request for rain) — Israel: 7 Cheshvan through erev
// Pesach (14 Nisan). Diaspora: a fixed Gregorian date (Dec 4, or Dec 5 the
// year before a civil leap year) through the same erev Pesach cutoff. This
// is the standard approximation; it does not special-case century years.
function talUmatarActive({ hm, hd }, gregDate, isIsrael) {
  if (hm === "Nisan") return hd < 15;
  if (WINTER_HEBREW_MONTHS.includes(hm)) {
    if (isIsrael || hm !== "Kislev") return true;
    // Diaspora + Kislev: only true once we're past the Dec 4/5 start date.
    const y = gregDate.getFullYear();
    const startDay = isGregorianLeap(y + 1) ? 5 : 4;
    if (gregDate.getMonth() === 11) return gregDate.getDate() >= startDay;
    return false; // early Kislev can fall in November, before the season starts
  }
  if (hm === "Cheshvan") return isIsrael && hd >= 7;
  return false;
}

// Mashiv Haruach (acknowledging rain/wind) — Shemini Atzeret (22 Tishrei)
// through erev Pesach, everywhere (no Israel/diaspora split, unlike the
// Tal U'matar *request* above).
function mashivHaruachActive({ hm, hd }) {
  if (hm === "Tishrei") return hd >= 22;
  if (WINTER_HEBREW_MONTHS.includes(hm)) return true;
  if (hm === "Nisan") return hd < 15;
  return false;
}

// Which conditional liturgical insertions apply on a given day. Backs the
// Siddur reader's "highlight what to say today" feature — see
// src/lib/liturgicalInsertions.js for the phrase list these flags gate.
export async function getLiturgicalFlags(date, isIsrael = false) {
  const data = await convertCached(date);
  const events = data.events || [];
  const has = (re) => events.some((e) => re.test(e));

  const roshChodesh = has(/Rosh Chodesh/);
  // Hebcal abbreviates this in-event as "(CH''M)" (e.g. "Sukkot III (CH''M)",
  // "Pesach IV (CH''M)"), never spells out "Chol HaMoed".
  const cholHamoed = has(/\(CH.{0,2}M\)/);
  const pesach = has(/Pesach/);
  const sukkotFamily = has(/Sukkot|Shmini Atzeret|Simchat Torah/);
  const shavuot = has(/Shavuot/);
  const roshHashana = has(/Rosh Hashana/);
  const yomKippur = has(/Yom Kippur/);
  const chanukah = has(/Chanukah/);
  // \bPurim\b (not ^) so this also catches "Shushan Purim" (14→15 Adar,
  // walled cities), which gets Al Hanisim too — just excludes "Purim Katan"
  // (the non-observed extra Adar I "Purim" in a leap year).
  const purim = has(/\bPurim\b/) && !has(/Purim Katan/);
  const fastDay =
    yomKippur ||
    has(/Tzom|Ta.?anit Esther|Asara B.?Tevet|Fast of/i);

  return {
    roshChodesh,
    cholHamoed,
    chanukah,
    purim,
    fastDay,
    aseretYemeiTeshuva: data.hm === "Tishrei" && data.hd <= 10,
    // Ya'aleh V'yavo (Amidah/Birkat Hamazon insertion): Rosh Chodesh + every
    // festival day, including Chol Hamoed.
    yaalehVyavo:
      roshChodesh || cholHamoed || pesach || sukkotFamily || shavuot || roshHashana,
    // Hallel: Rosh Chodesh (half), festivals, Chanukah. Doesn't distinguish
    // full vs. half Hallel — both get flagged as "recited today".
    hallel: roshChodesh || chanukah || pesach || sukkotFamily || shavuot,
    talUmatar: talUmatarActive(data, date, isIsrael),
    mashivHaruach: mashivHaruachActive(data),
  };
}

export async function getHebrewDate(date) {
  const key = dateKey(date);
  const cached = hebrewDateCache.get(key);
  if (cached) return cached;

  // Parsha: from the Shabbat of the week containing this date
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
  const saturday = new Date(date);
  saturday.setDate(saturday.getDate() + daysUntilSaturday);

  // These two lookups don't depend on each other, so run them in parallel
  // instead of paying two sequential round trips before anything can render.
  const [data, satData] = await Promise.all([
    convert(date),
    convert(saturday),
  ]);

  const parshaEvent = (satData.events || []).find(
    (e) => e.startsWith("Parashat") || e.startsWith("Parshat"),
  );
  const parsha = parshaEvent
    ? parshaEvent.replace(/^Parashat\s+|^Parshat\s+/, "").trim()
    : "";

  const day = HEBREW_DAYS[date.getDay()];

  const result = {
    hebrew_date: data.hebrew,
    hebrew_date_transliterated: `${data.hd} ${data.hm} ${data.hy}`,
    day_of_week_hebrew: day.hebrew,
    day_of_week_transliterated: day.transliterated,
    parsha,
    parsha_hebrew: parsha ? PARSHA_HEBREW[parsha] || "" : "",
  };
  hebrewDateCache.set(key, result);
  return result;
}

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

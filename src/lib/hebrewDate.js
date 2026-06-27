// Fetches accurate Hebrew date info from the Hebcal converter API

const HEBREW_DAYS = [
    { hebrew: 'יוֹם רִאשׁוֹן', transliterated: 'Yom Rishon' },   // Sunday
    { hebrew: 'יוֹם שֵׁנִי', transliterated: 'Yom Sheni' },      // Monday
    { hebrew: 'יוֹם שְׁלִישִׁי', transliterated: 'Yom Shlishi' }, // Tuesday
    { hebrew: 'יוֹם רְבִיעִי', transliterated: "Yom Revi'i" },   // Wednesday
    { hebrew: 'יוֹם חֲמִישִׁי', transliterated: 'Yom Chamishi' }, // Thursday
    { hebrew: 'יוֹם שִׁשִּׁי', transliterated: 'Yom Shishi' },   // Friday
    { hebrew: 'שַׁבָּת', transliterated: 'Shabbat' },             // Saturday
];

const PARSHA_HEBREW = {
    'Bereshit': 'בְּרֵאשִׁית', 'Noach': 'נֹחַ', 'Lech-Lecha': 'לֶךְ-לְךָ',
    'Vayera': 'וַיֵּרָא', 'Chayei Sara': 'חַיֵּי שָׂרָה', 'Toldot': 'תּוֹלְדוֹת',
    'Vayetzei': 'וַיֵּצֵא', 'Vayishlach': 'וַיִּשְׁלַח', 'Vayeshev': 'וַיֵּשֶׁב',
    'Miketz': 'מִקֵּץ', 'Vayigash': 'וַיִּגַּשׁ', 'Vayechi': 'וַיְחִי',
    'Shemot': 'שְׁמוֹת', 'Vaera': 'וָאֵרָא', 'Bo': 'בֹּא',
    'Beshalach': 'בְּשַׁלַּח', 'Yitro': 'יִתְרוֹ', 'Mishpatim': 'מִשְׁפָּטִים',
    'Terumah': 'תְּרוּמָה', 'Tetzaveh': 'תְּצַוֶּה', 'Ki Tisa': 'כִּי תִשָּׂא',
    'Vayakhel': 'וַיַּקְהֵל', 'Pekudei': 'פְקוּדֵי', 'Vayakhel-Pekudei': 'וַיַּקְהֵל-פְקוּדֵי',
    'Vayikra': 'וַיִּקְרָא', 'Tzav': 'צַו', 'Shmini': 'שְׁמִינִי',
    'Tazria': 'תַּזְרִיעַ', 'Metzora': 'מְצֹרָע', 'Tazria-Metzora': 'תַּזְרִיעַ-מְצֹרָע',
    'Achrei Mot': 'אַחֲרֵי מוֹת', 'Kedoshim': 'קְדֹשִׁים', 'Achrei Mot-Kedoshim': 'אַחֲרֵי מוֹת-קְדֹשִׁים',
    'Emor': 'אֱמֹר', 'Behar': 'בְּהַר', 'Bechukotai': 'בְּחֻקֹּתַי', 'Behar-Bechukotai': 'בְּהַר-בְּחֻקֹּתַי',
    'Bamidbar': 'בְּמִדְבַּר', 'Nasso': 'נָשֹׂא', "Beha'alotcha": 'בְּהַעֲלֹתְךָ',
    'Shelach': 'שְׁלַח', 'Korach': 'קֹרַח', 'Chukat': 'חֻקַּת',
    'Balak': 'בָּלָק', 'Chukat-Balak': 'חֻקַּת-בָּלָק', 'Pinchas': 'פִּינְחָס',
    'Matot': 'מַטּוֹת', 'Masei': 'מַסְעֵי', 'Matot-Masei': 'מַטּוֹת-מַסְעֵי',
    'Devarim': 'דְּבָרִים', 'Vaetchanan': 'וָאֶתְחַנַּן', 'Eikev': 'עֵקֶב',
    'Reeh': 'רְאֵה', 'Shoftim': 'שֹׁפְטִים', 'Ki Teitzei': 'כִּי תֵצֵא',
    'Ki Tavo': 'כִּי תָבוֹא', 'Nitzavim': 'נִצָּבִים', 'Vayeilech': 'וַיֵּלֶךְ',
    'Nitzavim-Vayeilech': 'נִצָּבִים-וַיֵּלֶךְ', "Ha'Azinu": 'הַאֲזִינוּ',
    'Vezot Haberakhah': 'וְזֹאת הַבְּרָכָה',
};

async function convert(date) {
    const gy = date.getFullYear();
    const gm = date.getMonth() + 1;
    const gd = date.getDate();
    const res = await fetch(
        `https://www.hebcal.com/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1&strict=1`
    );
    if (!res.ok) throw new Error('Hebrew date conversion failed');
    return res.json();
}

export async function getHebrewDate(date) {
    const data = await convert(date);

    // Parsha: from the Shabbat of the week containing this date
    const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
    const saturday = new Date(date);
    saturday.setDate(saturday.getDate() + daysUntilSaturday);
    const satData = await convert(saturday);
    const parshaEvent = (satData.events || []).find((e) =>
        e.startsWith('Parashat') || e.startsWith('Parshat')
    );
    const parsha = parshaEvent ? parshaEvent.replace(/^Parashat\s+|^Parshat\s+/, '').trim() : '';

    const day = HEBREW_DAYS[date.getDay()];

    return {
        hebrew_date: data.hebrew,
        hebrew_date_transliterated: `${data.hd} ${data.hm} ${data.hy}`,
        day_of_week_hebrew: day.hebrew,
        day_of_week_transliterated: day.transliterated,
        parsha,
        parsha_hebrew: parsha ? (PARSHA_HEBREW[parsha] || '') : '',
    };
}
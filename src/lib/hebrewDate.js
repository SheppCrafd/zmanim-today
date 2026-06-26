// Fetches accurate Hebrew date info from the Hebcal converter API
// (the same authoritative calendar source used by date converters like Chabad's).

const HEBREW_DAYS = [
    'יום ראשון', // Sunday
    'יום שני',   // Monday
    'יום שלישי', // Tuesday
    'יום רביעי', // Wednesday
    'יום חמישי', // Thursday
    'יום שישי',  // Friday
    'שבת',       // Saturday
];

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
    // Hebrew date for the selected day
    const data = await convert(date);

    // Parsha: read from the Shabbat of the week containing this date
    const saturday = new Date(date);
    saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));
    const satData = await convert(saturday);
    const parshaEvent = (satData.events || []).find((e) =>
        e.startsWith('Parashat') || e.startsWith('Parshat')
    );

    return {
        hebrew_date: data.hebrew,
        day_of_week_hebrew: HEBREW_DAYS[date.getDay()],
        parsha: parshaEvent ? parshaEvent.replace(/^Parashat |^Parshat /, '') : '',
    };
}
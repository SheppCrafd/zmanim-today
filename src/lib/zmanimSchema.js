/**
 * Central Zmanim schema registry.
 * Single source of truth for zmanim keys, labels, icons, descriptions,
 * highlight status, and ordering — used by all components and utilities.
 */

export const ZMANIM_SCHEMA = [
  // Dawn & Morning
  {
    id: "alot_hashachar",
    label: "Alot HaShachar",
    icon: "🌑",
    description: "Dawn - 72 min before sunrise",
    group: "morning",
    highlight: false,
  },
  {
    id: "misheyakir",
    label: "Misheyakir",
    icon: "🌒",
    description: "Earliest Tallit & Tefillin",
    group: "morning",
    highlight: false,
  },
  {
    id: "sunrise",
    label: "Sunrise",
    icon: "🌅",
    description: "HaNetz HaChamah",
    group: "morning",
    highlight: true,
  },
  {
    id: "sof_zman_shma_mga",
    label: "Sof Zman Shema (MGA)",
    icon: "📜",
    description: "3 halachic hrs after dawn (stringent)",
    group: "morning",
    highlight: false,
  },
  {
    id: "sof_zman_shma_gra",
    label: "Sof Zman Shema (GRA)",
    icon: "📜",
    description: "Latest Shema - 3 halachic hrs after sunrise",
    group: "morning",
    highlight: true,
  },
  {
    id: "sof_zman_tefillah_mga",
    label: "Sof Zman Tefillah (MGA)",
    icon: "🕍",
    description: "4 halachic hrs after dawn (stringent)",
    group: "morning",
    highlight: false,
  },
  {
    id: "sof_zman_tefillah_gra",
    label: "Sof Zman Tefillah (GRA)",
    icon: "🕍",
    description: "Latest Shemoneh Esrei - 4 halachic hrs",
    group: "morning",
    highlight: true,
  },

  // Midday & Afternoon
  {
    id: "chatzot",
    label: "Chatzot",
    icon: "☀️",
    description: "Halachic Noon - midpoint of day",
    group: "afternoon",
    highlight: true,
  },
  {
    id: "mincha_gedola",
    label: "Mincha Gedola",
    icon: "🕌",
    description: "Earliest Mincha - 30 min after noon",
    group: "afternoon",
    highlight: false,
  },
  {
    id: "mincha_ketana",
    label: "Mincha Ketana",
    icon: "🕐",
    description: "Preferred Mincha - 2.5 halachic hrs before sunset",
    group: "afternoon",
    highlight: false,
  },
  {
    id: "plag_hamincha",
    label: "Plag HaMincha",
    icon: "⏳",
    description: "1.25 halachic hrs before sunset",
    group: "afternoon",
    highlight: false,
  },

  // Evening & Night
  {
    id: "candle_lighting",
    label: "Candle Lighting",
    icon: "🕯",
    description: "18 min before sunset",
    group: "evening",
    highlight: true,
    fridayOnly: true,
  },
  {
    id: "sunset",
    label: "Sunset",
    icon: "🌇",
    description: "Shkiyas HaChamah",
    group: "evening",
    highlight: true,
  },
  {
    id: "tzait_hakochavim",
    label: "Tzeit HaKochavim",
    icon: "✨",
    description: "Nightfall - 3 medium stars",
    group: "evening",
    highlight: true,
  },
  {
    id: "tzait_72",
    label: "Tzait (72 min)",
    icon: "🌟",
    description: "Nightfall - Rabbeinu Tam",
    group: "evening",
    highlight: false,
  },
  {
    id: "chatzot_laila",
    label: "Chatzot Laila",
    icon: "🌙",
    description: "Halachic Midnight",
    group: "evening",
    highlight: false,
  },
];

/** Map of id → schema entry for O(1) lookups */
export const ZMANIM_BY_ID = Object.fromEntries(
  ZMANIM_SCHEMA.map((z) => [z.id, z]),
);

/** Ordered list of zmanim keys (for next-zman countdown ordering) */
export const ZMANIM_ORDERED_KEYS = ZMANIM_SCHEMA.map((z) => z.id);

/**
 * Returns the display label for a zman, adjusting for day-of-week
 * (e.g. Tzeit HaKochavim doubles as Havdalah on Saturday).
 */
export function getZmanLabel(id, dayOfWeek) {
  const meta = ZMANIM_BY_ID[id];
  if (!meta) return id;
  if (id === "tzait_hakochavim" && dayOfWeek === 6) {
    return "Tzeit HaKochavim/Havdalah";
  }
  return meta.label;
}

/** Group definitions for the full Zmanim page */
export const ZMANIM_GROUPS = [
  {
    id: "morning",
    title: "Dawn & Morning",
    icon: "☀️",
    color: "from-amber-500 to-orange-500",
    printFrom: "#f59e0b",
    printTo: "#f97316",
  },
  {
    id: "afternoon",
    title: "Midday & Afternoon",
    icon: "🌤️",
    color: "from-blue-500 to-cyan-500",
    printFrom: "#3b82f6",
    printTo: "#06b6d4",
  },
  {
    id: "evening",
    title: "Evening & Night",
    icon: "🌙",
    color: "from-indigo-600 to-purple-600",
    printFrom: "#4f46e5",
    printTo: "#9333ea",
  },
];

/**
 * Returns the zmanim entries for a given group, filtered for day-of-week rules.
 * @param {string} groupId - 'morning' | 'afternoon' | 'evening'
 * @param {object} zmanimData - flat zmanim object (e.g. result.zmanim)
 * @param {number} dayOfWeek - 0=Sun … 6=Sat
 */
export function getGroupEntries(groupId, zmanimData, dayOfWeek) {
  const isFriday = dayOfWeek === 5;
  const isSaturday = dayOfWeek === 6;

  return ZMANIM_SCHEMA.filter((z) => z.group === groupId)
    .filter((z) => {
      if (z.fridayOnly && !isFriday) return false;
      // Hide tzait_72 on Saturday (clutter reduction)
      if (z.id === "tzait_72" && isSaturday) return false;
      return true;
    })
    .map((z) => ({
      ...z,
      label: getZmanLabel(z.id, dayOfWeek),
      value: zmanimData?.[z.id] ?? null,
    }))
    .filter((z) => z.value !== null);
}
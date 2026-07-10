import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import webpush from "npm:web-push@3.6.7";

// Hebcal camelCase keys -> our snake_case reminder keys
const HEBCAL_MAP = {
  alot_hashachar: "alotHashachar",
  misheyakir: "misheyakir",
  sunrise: "sunrise",
  sof_zman_shma_gra: "sofZmanShma",
  sof_zman_shma_mga: "sofZmanShmaMGA",
  sof_zman_tefillah_gra: "sofZmanTfilla",
  sof_zman_tefillah_mga: "sofZmanTfillaMGA",
  chatzot: "chatzot",
  mincha_gedola: "minchaGedola",
  mincha_ketana: "minchaKetana",
  plag_hamincha: "plagHaMincha",
  candle_lighting: "candleLighting",
  sunset: "sunset",
  tzait_hakochavim: "tzeit85deg",
  tzait_72: "tzeit72min",
  chatzot_laila: "chatzotNight",
};

const REMINDER_KEYS = Object.keys(HEBCAL_MAP);

const LABELS = {
  alot_hashachar: { emoji: "\uD83C\uDF11", label: "Alot HaShachar" },
  misheyakir: { emoji: "\uD83C\uDF12", label: "Misheyakir" },
  sunrise: { emoji: "\uD83C\uDF05", label: "Sunrise" },
  sof_zman_shma_gra: { emoji: "\uD83D\uDCD6", label: "Sof Zman Shema (GRA)" },
  sof_zman_shma_mga: { emoji: "\uD83D\uDCD6", label: "Sof Zman Shema (MGA)" },
  sof_zman_tefillah_gra: { emoji: "\uD83C\uDF84", label: "Shacharit Latest (GRA)" },
  sof_zman_tefillah_mga: { emoji: "\uD83C\uDF84", label: "Shacharit Latest (MGA)" },
  chatzot: { emoji: "\u2600\uFE0F", label: "Chatzot" },
  mincha_gedola: { emoji: "\uD83C\uDF24\uFE0F", label: "Mincha Gedola" },
  mincha_ketana: { emoji: "\uD83C\uDF24\uFE0F", label: "Mincha Ketana" },
  plag_hamincha: { emoji: "\uD83C\uDF25\uFE0F", label: "Plag HaMincha" },
  candle_lighting: { emoji: "\uD83D\uDD6F\uFE0F", label: "Candle Lighting" },
  sunset: { emoji: "\uD83C\uDF07", label: "Sunset" },
  tzait_hakochavim: { emoji: "\uD83C\uDF19", label: "Tzeit HaKochavim" },
  tzait_72: { emoji: "\uD83C\uDF1F", label: "Havdalah / Tzait (72 min)" },
  chatzot_laila: { emoji: "\uD83C\uDF03", label: "Chatzot Laila" },
};

function localDateStr(tzid) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tzid || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function localDow(tzid) {
  try {
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid || undefined,
      weekday: "short",
    }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  } catch {
    return new Date().getDay();
  }
}

function subtractMin(iso, mins) {
  const d = new Date(iso);
  d.setTime(d.getTime() - mins * 60000);
  return d.toISOString();
}

// Build the zmanim map from Hebcal, applying the same deterministic overrides
// the frontend uses (alot = sunrise - 72min; candle = sunset - 18min fallback)
// so reminder times match what the user sees.
async function fetchZmanim(lat, lng, tzid, dateStr) {
  const url =
    `https://www.hebcal.com/zmanim?cfg=json&latitude=${lat}&longitude=${lng}` +
    `&date=${dateStr}&tzid=${encodeURIComponent(tzid || "")}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  const t = (data && data.times) || {};
  const map = {};
  for (const k of REMINDER_KEYS) {
    map[k] = t[HEBCAL_MAP[k]] || null;
  }
  if (map.sunrise) map.alot_hashachar = subtractMin(map.sunrise, 72);
  if (!map.candle_lighting && map.sunset) {
    map.candle_lighting = subtractMin(map.sunset, 18);
  }
  return map;
}

Deno.serve(async (req) => {
  try {
    // Authorization: this endpoint processes ALL push subscriptions under the
    // service role and sends notifications / mutates records on behalf of every
    // user, so it must only be invokable by the platform's scheduled
    // automation runner — never by unauthenticated external callers. The
    // runner supplies a pre-shared secret via the automation's function_args
    // (request body `args.secret`). Any request missing/mismatching the secret
    // is rejected before any service-role work runs.
    const cronSecret = Deno.env.get("REMINDERS_CRON_SECRET");
    if (!cronSecret) {
      return Response.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      );
    }
    let suppliedSecret = null;
    try {
      const body = await req.json();
      suppliedSecret = body?.args?.secret || body?.secret || null;
    } catch {
      /* non-JSON or empty body */
    }
    const headerSecret = req.headers.get("x-cron-secret");
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const supplied = suppliedSecret || headerSecret || querySecret;
    if (supplied !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) {
      return Response.json(
        { error: "VAPID keys not configured" },
        { status: 500 },
      );
    }
    webpush.setVapidDetails(
      "mailto:admin@zmanim-today.app",
      publicKey,
      privateKey,
    );

    const subs = await base44.asServiceRole.entities.PushSubscription.list(
      "-created_date",
      500,
    );
    const now = Date.now();
    const results = { sent: 0, skipped: 0, errors: 0, removed: 0, total: subs.length };
    const zmanimCache = new Map();

    for (const sub of subs) {
      try {
        if (
          !sub.endpoint || !sub.p256dh || !sub.auth ||
          !sub.latitude || !sub.longitude
        ) {
          results.skipped++;
          continue;
        }
        const tzid = sub.timezone || "";
        const today = localDateStr(tzid);
        const dow = localDow(tzid);
        const cacheKey =
          `${sub.latitude.toFixed(3)},${sub.longitude.toFixed(3)},${today}`;
        let zmanim = zmanimCache.get(cacheKey);
        if (!zmanim) {
          zmanim = await fetchZmanim(
            sub.latitude,
            sub.longitude,
            tzid,
            today,
          );
          zmanimCache.set(cacheKey, zmanim);
        }
        if (!zmanim) {
          results.skipped++;
          continue;
        }

        let sentKeys = Array.isArray(sub.sent_keys) ? sub.sent_keys.slice() : [];
        if (sub.sent_date !== today) sentKeys = [];

        const prefs = sub.prefs || {};
        const toSend = [];
        for (const key of REMINDER_KEYS) {
          const pref = prefs[key];
          if (!pref || !pref.enabled) continue;
          if (key === "candle_lighting" && dow !== 5) continue;
          if (key === "tzait_72" && dow !== 6) continue;
          const timeStr = zmanim[key];
          if (!timeStr) continue;
          const zmanTime = new Date(timeStr).getTime();
          if (isNaN(zmanTime)) continue;
          const minutesBefore = pref.minutesBefore || 10;
          const notifyAt = zmanTime - minutesBefore * 60000;
          if (sentKeys.includes(key)) continue;
          // Fire once within the reminder window (up to ~5 min early, always
          // before the zman itself) so the 5-min polling cadence delivers it.
          if (now >= notifyAt && now < zmanTime) {
            const remaining = Math.max(1, Math.round((zmanTime - now) / 60000));
            toSend.push({ key, timeStr, remaining });
          }
        }

        let anySent = false;
        let dead = false;
        for (const item of toSend) {
          const { emoji, label } = LABELS[item.key] || { emoji: "", label: item.key };
          const payload = JSON.stringify({
            title: `${emoji} ${label}`,
            body: `${label} in ~${item.remaining} min (at ${item.timeStr})`,
            icon: "/favicon.ico",
          });
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
              { TTL: 600, urgency: "normal" },
            );
            sentKeys.push(item.key);
            anySent = true;
            results.sent++;
          } catch (e) {
            const status = e && e.statusCode;
            if (status === 404 || status === 410) {
              dead = true;
            } else {
              results.errors++;
            }
          }
        }

        if (dead) {
          try {
            await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
            results.removed++;
          } catch {
            results.errors++;
          }
        } else if (anySent) {
          try {
            await base44.asServiceRole.entities.PushSubscription.update(
              sub.id,
              { sent_date: today, sent_keys: sentKeys },
            );
          } catch {
            results.errors++;
          }
        }
      } catch {
        results.skipped++;
      }
    }

    return Response.json({ ok: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
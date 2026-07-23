import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

const SUB_ID_KEY = "zmanim_push_sub_id";
const SUB_SNAPSHOT_KEY = "zmanim_push_sub_snapshot";
const LOC_KEY = "zmanim_saved_location";

function bufferToB64url(buf) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function readLocation() {
  try {
    return JSON.parse(localStorage.getItem(LOC_KEY)) || null;
  } catch {
    return null;
  }
}

const pushSupported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

/**
 * Keeps a Web Push subscription in sync with the PushSubscription entity so the
 * scheduled backend job can deliver reminders even when the app is closed.
 * Re-syncs whenever prefs or permission change and at least one reminder is on.
 */
export function usePushReminders({ prefs, notifPermission }) {
  const [status, setStatus] = useState("idle"); // idle | subscribing | subscribed | error
  const [error, setError] = useState(null);

  const sync = useCallback(async () => {
    if (!pushSupported()) {
      setError("Push notifications aren't supported on this browser.");
      return;
    }
    const location = readLocation();
    if (!location?.latitude || !location?.longitude) {
      setError("Set your location first to enable push reminders.");
      return;
    }
    if (notifPermission !== "granted") return;
    setStatus("subscribing");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const payload = {
        endpoint: sub.endpoint,
        p256dh: bufferToB64url(sub.getKey("p256dh")),
        auth: bufferToB64url(sub.getKey("auth")),
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone || "",
        city: location.city || "",
        country: location.country || "",
        prefs: prefs || {},
      };
      const savedId = (() => {
        try {
          return localStorage.getItem(SUB_ID_KEY);
        } catch {
          return null;
        }
      })();

      // This effect re-runs on every Home mount whenever notifications are
      // already granted, which previously meant a backend PUT on every single
      // page load even when nothing about the subscription had changed since
      // the last sync. Skip the round trip entirely when the payload is
      // byte-identical to what was last successfully synced.
      const fingerprint = JSON.stringify(payload);
      const lastSynced = (() => {
        try {
          return localStorage.getItem(SUB_SNAPSHOT_KEY);
        } catch {
          return null;
        }
      })();
      if (savedId && lastSynced === fingerprint) {
        setStatus("subscribed");
        return;
      }

      if (savedId) {
        try {
          await base44.entities.PushSubscription.update(savedId, payload);
        } catch {
          const created = await base44.entities.PushSubscription.create(payload);
          try {
            localStorage.setItem(SUB_ID_KEY, created.id);
          } catch {}
        }
      } else {
        const created = await base44.entities.PushSubscription.create(payload);
        try {
          localStorage.setItem(SUB_ID_KEY, created.id);
        } catch {}
      }
      try {
        localStorage.setItem(SUB_SNAPSHOT_KEY, fingerprint);
      } catch {}
      setStatus("subscribed");
    } catch (e) {
      setError(e?.message || "Failed to enable push reminders.");
      setStatus("error");
    }
  }, [notifPermission, prefs]);

  useEffect(() => {
    const hasEnabled =
      prefs && Object.values(prefs).some((p) => p?.enabled);
    if (notifPermission === "granted" && hasEnabled) {
      sync();
    }
  }, [notifPermission, prefs, sync]);

  return { status, error, sync };
}
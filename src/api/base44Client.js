import { createClient } from "@base44/sdk";
import { appParams } from "@/lib/app-params";

const { appId, serverUrl, token, functionsVersion } = appParams;

// requiresAuth: false — the core zmanim view is a public utility (today's
// prayer times for a detected/default location) and must render for
// anonymous visitors and crawlers. With requiresAuth: true the SDK itself
// fires an unconditional `redirectToLogin` a tick after client creation
// (see @base44/sdk dist/client.js), independent of anything AuthContext/App
// decide — that's what was sending every visitor straight to /login before
// any UI painted. Auth is still enforced per-request by the backend for
// account-specific calls (entities, auth.me, etc.); this flag only controls
// the SDK's own eager redirect side effect.
export const base44 = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  requiresAuth: false,
});
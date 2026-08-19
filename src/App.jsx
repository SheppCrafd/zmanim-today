import "./App.css";
import { lazy, Suspense, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import NavigationTracker from "@/lib/NavigationTracker";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import { Navigate } from "react-router-dom";

// Home is the landing route, so it stays in the main bundle — first paint is
// unaffected. Every other route is code-split and warmed via idle-time
// prefetch below, so by the time a user actually navigates there the chunk
// is already cached and the transition is just as instant as before.
import Home from "./pages/Home";
const loadZmanim = () => import("./pages/Zmanim");
const loadSephardicSiddur = () => import("./pages/SephardicSiddur");
const loadAshkenaziSiddur = () => import("./pages/AshkenaziSiddur");
const loadChabadSiddur = () => import("./pages/ChabadSiddur");
const loadCompass = () => import("./pages/Compass");
const loadSettings = () => import("./pages/Settings");
const loadPrivacy = () => import("./pages/Privacy");

const Zmanim = lazy(loadZmanim);
const SephardicSiddur = lazy(loadSephardicSiddur);
const AshkenaziSiddur = lazy(loadAshkenaziSiddur);
const ChabadSiddur = lazy(loadChabadSiddur);
const Compass = lazy(loadCompass);
const Settings = lazy(loadSettings);
const Privacy = lazy(loadPrivacy);

// VisualEditAgent (~700 lines) exists purely to let the base44 builder
// highlight/edit elements live inside its own iframe — it does nothing for a
// real visitor (installed PWA, direct browser visit, no trusted parent) and
// its own postMessage calls are already no-ops without a trusted referrer.
// Gating the import on that same check means real users never fetch/parse/
// execute it at all, instead of paying for it on every load just in case.
const ALLOWED_BUILDER_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*base44\.(com|app)$/i;
function isInsideTrustedBuilder() {
  try {
    return (
      window.parent !== window &&
      ALLOWED_BUILDER_ORIGIN.test(new URL(document.referrer).origin)
    );
  } catch {
    return false;
  }
}
const VisualEditAgent = isInsideTrustedBuilder()
  ? lazy(() => import("@/lib/VisualEditAgent"))
  : null;

const ROUTE_PREFETCHERS = [
  loadZmanim,
  loadSephardicSiddur,
  loadAshkenaziSiddur,
  loadChabadSiddur,
  loadCompass,
  loadSettings,
  loadPrivacy,
];

// Warms every non-Home route's chunk once the browser is idle, so
// clicking a nav link never has to wait on a network fetch in practice.
function useIdlePrefetchRoutes() {
  useEffect(() => {
    const requestIdle =
      window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const id = requestIdle(() => {
      ROUTE_PREFETCHERS.forEach((load) => load());
    });
    return () => cancelIdle(id);
  }, []);
}

// Identical markup to the auth-loading spinner below, so on the rare chance
// this ever renders (e.g. a cold direct link to a non-Home route) it looks
// like a loading state the app already shows elsewhere, not a new one.
const RouteFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Wraps a route that genuinely needs an authenticated user (saved-settings
// persistence, push-reminder sync tied to an account). Unlike the old
// app-wide gate, this only sends someone to /login when they actually try to
// reach a gated route — the public zmanim views never trigger it.
const RequireAuth = ({ children }) => {
  const { isAuthenticated, navigateToLogin } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) navigateToLogin();
  }, [isAuthenticated, navigateToLogin]);

  if (!isAuthenticated) return <RouteFallback />;
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  useIdlePrefetchRoutes();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <RouteFallback />;
  }

  // "user_not_registered" means a real token was presented but the account
  // isn't provisioned for this app — that's a genuine access error, not an
  // anonymous visitor, so it still blocks. Every other authError (including
  // "auth_required" from the public-settings check, and any unknown/backend
  // failure) now falls through to the routes below: the core zmanim view is
  // public, so an anonymous visitor is just... anonymous, not an error state.
  if (authError && authError.type === "user_not_registered") {
    return <UserNotRegisteredError />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Zmanim" element={<Zmanim />} />
        <Route path="/Compass" element={<Compass />} />
        <Route
          path="/Settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route path="/Privacy" element={<Privacy />} />

        {/* SIDDUR ROUTES — wildcard prevents remount on TOC↔section navigation */}
        <Route
          path="/SephardicSiddur"
          element={<Navigate to="/SephardicSiddur/toc" replace />}
        />
        <Route path="/SephardicSiddur/*" element={<SephardicSiddur />} />

        <Route
          path="/AshkenaziSiddur"
          element={<Navigate to="/AshkenaziSiddur/toc" replace />}
        />
        <Route path="/AshkenaziSiddur/*" element={<AshkenaziSiddur />} />

        <Route
          path="/ChabadSiddur"
          element={<Navigate to="/ChabadSiddur/toc" replace />}
        />
        <Route path="/ChabadSiddur/*" element={<ChabadSiddur />} />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          {VisualEditAgent && (
            <Suspense fallback={null}>
              <VisualEditAgent />
            </Suspense>
          )}
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

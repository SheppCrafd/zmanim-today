import "./App.css";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import VisualEditAgent from "@/lib/VisualEditAgent";
import NavigationTracker from "@/lib/NavigationTracker";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import BottomTabBar from "@/components/BottomTabBar";
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

const Zmanim = lazy(loadZmanim);
const SephardicSiddur = lazy(loadSephardicSiddur);
const AshkenaziSiddur = lazy(loadAshkenaziSiddur);
const ChabadSiddur = lazy(loadChabadSiddur);
const Compass = lazy(loadCompass);
const Settings = lazy(loadSettings);

const ROUTE_PREFETCHERS = [
  loadZmanim,
  loadSephardicSiddur,
  loadAshkenaziSiddur,
  loadChabadSiddur,
  loadCompass,
  loadSettings,
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

// The four primary destinations get a flex-column app shell with the tab
// bar as a normal last child (not `position: fixed` — see BottomTabBar.jsx
// for why). The page itself scrolls inside the flex-1 middle; the tab bar
// takes only the space it needs and is never overlaid or scrolled away.
// The Siddur reading routes deliberately don't get this shell — they're a
// full-screen focused mode with their own internal layout.
const TabPage = ({ children }) => (
  <div className="h-[100dvh] flex flex-col">
    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    <BottomTabBar />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } =
    useAuth();
  useIdlePrefetchRoutes();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <RouteFallback />;
  }

  if (authError) {
    if (authError.type === "user_not_registered")
      return <UserNotRegisteredError />;
    if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<TabPage><Home /></TabPage>} />
        <Route path="/Zmanim" element={<TabPage><Zmanim /></TabPage>} />
        <Route path="/Compass" element={<TabPage><Compass /></TabPage>} />
        <Route path="/Settings" element={<TabPage><Settings /></TabPage>} />

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
          <Toaster />
          <VisualEditAgent />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

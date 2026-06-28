import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Home from './pages/Home';
import Zmanim from './pages/Zmanim';
import SephardicSiddur from './pages/SephardicSiddur';
import AshkenaziSiddur from './pages/AshkenaziSiddur';
import ChabadSiddur from './pages/ChabadSiddur';
import Compass from './pages/Compass';
import Settings from './pages/Settings';

// ✅ ADD THIS (your new reader engine)
import SiddurView from '@/components/siddur/SiddurView';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      {/* ---------------- CORE PAGES ---------------- */}
      <Route path="/" element={<Home />} />
      <Route path="/Zmanim" element={<Zmanim />} />
      <Route path="/Compass" element={<Compass />} />
      <Route path="/Settings" element={<Settings />} />

      {/* ---------------- SIDDUr ROOT PAGES ---------------- */}
      <Route path="/SephardicSiddur" element={<SephardicSiddur />} />
      <Route path="/AshkenaziSiddur" element={<AshkenaziSiddur />} />
      <Route path="/ChabadSiddur" element={<ChabadSiddur />} />

      {/* ---------------- NEW UNIFIED READER ENGINE ---------------- */}
      {/* Ashkenazi */}
      <Route
        path="/siddur/ashkenazi/:index?"
        element={<AshkenaziSiddur />}
      />

      {/* Sephardic */}
      <Route
        path="/siddur/sephardic/:index?"
        element={<SephardicSiddur />}
      />

      {/* Chabad */}
      <Route
        path="/siddur/chabad/:index?"
        element={<ChabadSiddur />}
      />

      {/* ---------------- OPTIONAL GENERIC ENGINE (future-proof) ---------------- */}
      <Route
        path="/siddur/:type/:index?"
        element={<SiddurView />}
      />

      {/* ---------------- FALLBACK ---------------- */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Home from './pages/Home';
import Zmanim from './pages/Zmanim';
import Compass from './pages/Compass';
import Settings from './pages/Settings';

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

      <Route path="/" element={<Home />} />
      <Route path="/Zmanim" element={<Zmanim />} />
      <Route path="/Compass" element={<Compass />} />
      <Route path="/Settings" element={<Settings />} />

      {/* redirects */}
      <Route path="/AshkenaziSiddur" element={<Navigate to="/siddur/ashkenazi" />} />
      <Route path="/SephardicSiddur" element={<Navigate to="/siddur/sephardic" />} />
      <Route path="/ChabadSiddur" element={<Navigate to="/siddur/chabad" />} />

      {/* unified engine */}
      <Route path="/siddur/:type/:index?" element={<SiddurView />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
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
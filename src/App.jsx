import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import PageWrapper from './components/PageWrapper'
import PageNotFound from './lib/PageNotFound'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { ThemeProvider } from '@/lib/ThemeContext'
import UserNotRegisteredError from '@/components/UserNotRegisteredError'
import { Navigate } from 'react-router-dom';

import Home from './pages/Home'
import Zmanim from './pages/Zmanim'
import SephardicSiddur from './pages/SephardicSiddur'
import AshkenaziSiddur from './pages/AshkenaziSiddur'
import ChabadSiddur from './pages/ChabadSiddur'
import Compass from './pages/Compass'
import Settings from './pages/Settings'

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
      <Route path="/Zmanim" element={<PageWrapper><Zmanim /></PageWrapper>} />
      <Route path="/Compass" element={<PageWrapper><Compass /></PageWrapper>} />
      <Route path="/Settings" element={<PageWrapper><Settings /></PageWrapper>} />

      {/* SIDDUR ROUTES (NEW ARCHITECTURE) */}
      <Route path="/SephardicSiddur/toc" element={<PageWrapper><SephardicSiddur /></PageWrapper>} />
      <Route path="/SephardicSiddur/section/:sectionId/:language" element={<PageWrapper><SephardicSiddur /></PageWrapper>} />

      <Route path="/AshkenaziSiddur/toc" element={<PageWrapper><AshkenaziSiddur /></PageWrapper>} />
      <Route path="/AshkenaziSiddur/section/:sectionId/:language" element={<PageWrapper><AshkenaziSiddur /></PageWrapper>} />

      <Route path="/ChabadSiddur/toc" element={<PageWrapper><ChabadSiddur /></PageWrapper>} />
      <Route path="/ChabadSiddur/section/:sectionId/:language" element={<PageWrapper><ChabadSiddur /></PageWrapper>} />

      <Route path="*" element={<PageNotFound />} />

      <Route
      path="/SephardicSiddur"
      element={<Navigate to="/SephardicSiddur/toc" replace />}
      />

      <Route
      path="/AshkenaziSiddur"
      element={<Navigate to="/AshkenaziSiddur/toc" replace />}
      />

      <Route
      path="/ChabadSiddur"
      element={<Navigate to="/ChabadSiddur/toc" replace />}
      />
      </Routes>
    </AnimatePresence>
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
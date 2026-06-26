import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Home from './pages/Home';
import Zmanim from './pages/Zmanim';
import SephardicSiddur from './pages/SephardicSiddur';
import AshkenaziSiddur from './pages/AshkenaziSiddur';
import ChabadSiddur from './pages/ChabadSiddur';
import Compass from './pages/Compass';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';

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
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Zmanim" element={<Zmanim />} />
        <Route path="/Compass" element={<Compass />} />
        <Route path="/Settings" element={<Settings />} />
        <Route path="/SephardicSiddur" element={<SephardicSiddur />} />
        <Route path="/AshkenaziSiddur" element={<AshkenaziSiddur />} />
        <Route path="/ChabadSiddur" element={<ChabadSiddur />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <BottomNav />
    </>
  );
};

function App() {
  return (
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
  );
}

export default App;
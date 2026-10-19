import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar.js';
import { OwnerDashboard } from './pages/owner/OwnerDashboard.js';
import { DeliveryManagement } from './pages/owner/DeliveryManagement.js';
import { StockLedger } from './pages/owner/StockLedger.js';
import { CatalogManagement } from './pages/owner/CatalogManagement.js';
import { PaymentTracking } from './pages/owner/PaymentTracking.js';
import { ShopAnalytics } from './pages/owner/ShopAnalytics.js';
import { EmployeeReporting } from './pages/employee/EmployeeReporting.js';
import { Login } from './pages/auth/Login.js';
import { ToastProvider, useToast } from './components/ui/Toast.js';
import { ErrorBoundary } from './components/ui/ErrorBoundary.js';
import { AppLoadingScreen } from './components/ui/AppLoadingScreen.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export interface UserState {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'employee';
  assignedShop?: string;
}

const STORAGE_USER_KEY = 'rtr_current_user';
const STORAGE_EXPIRY_KEY = 'rtr_session_expiry';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const AppContent: React.FC = () => {
  const { success, warning, info } = useToast();
  const [currentUser, setCurrentUser] = useState<UserState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // 1. Session verification & hydration
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
      const storedExpiry = localStorage.getItem(STORAGE_EXPIRY_KEY);

      if (storedUser) {
        const expiryTime = storedExpiry ? parseInt(storedExpiry, 10) : 0;
        if (expiryTime && Date.now() > expiryTime) {
          localStorage.removeItem(STORAGE_USER_KEY);
          localStorage.removeItem(STORAGE_EXPIRY_KEY);
          warning('Your session has expired. Please sign in again.');
        } else {
          setCurrentUser(JSON.parse(storedUser));
        }
      } else {
        // Default initial session for immediate workspace access
        const defaultOwner: UserState = {
          id: 'u0000000-0000-0000-0000-000000000001',
          email: 'owner@rtrmobiles.com',
          name: 'Business Owner',
          role: 'owner',
        };
        setCurrentUser(defaultOwner);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(defaultOwner));
        localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
      }
    } catch (err) {
      console.warn('Could not restore stored session:', err);
    } finally {
      const timer = setTimeout(() => {
        setIsBootstrapping(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [warning]);

  // 2. Network connectivity listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      info('Network connection restored. Real-time sync online.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      warning('You are currently offline. Changes will save locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [info, warning]);

  // 3. Global session expiration event handler
  const handleSessionExpired = useCallback(() => {
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
    setCurrentUser(null);
    warning('Your session has expired. Please sign in again.');
  }, [warning]);

  useEffect(() => {
    window.addEventListener('rtr:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('rtr:session-expired', handleSessionExpired);
    };
  }, [handleSessionExpired]);

  const handleSignIn = (user: UserState) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    } catch (err) {
      console.error('Failed to save session to localStorage:', err);
    }
    success(`Welcome back, ${user.name}`);
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
    } catch (err) {
      console.error('Failed to clear session from localStorage:', err);
    }
    setCurrentUser(null);
    info('Signed out successfully.');
  };

  if (isBootstrapping) {
    return <AppLoadingScreen message="Initializing RTR Wholesale Management..." />;
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleSignIn} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-crimpston-offwhite text-slate-800 flex flex-col font-sans">
        <Navbar
          userRole={currentUser.role}
          userName={currentUser.name}
          assignedShopName={currentUser.assignedShop}
          isOnline={isOnline}
          onSignOut={handleSignOut}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <Routes>
            {currentUser.role === 'owner' ? (
              <>
                <Route path="/" element={<OwnerDashboard />} />
                <Route path="/deliveries" element={<DeliveryManagement />} />
                <Route path="/stock-ledger" element={<StockLedger />} />
                <Route path="/payments" element={<PaymentTracking />} />
                <Route path="/analytics" element={<ShopAnalytics />} />
                <Route path="/management" element={<CatalogManagement />} />
                <Route path="/employee" element={<EmployeeReporting />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route path="/employee" element={<EmployeeReporting />} />
                <Route path="/stock-ledger" element={<StockLedger />} />
                <Route path="*" element={<Navigate to="/employee" replace />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

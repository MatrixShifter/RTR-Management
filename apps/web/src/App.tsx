import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar.js';
import { ToastProvider, useToast } from './components/ui/Toast.js';
import { ErrorBoundary } from './components/ui/ErrorBoundary.js';
import { AppLoadingScreen } from './components/ui/AppLoadingScreen.js';
import { TableSkeleton } from './components/ui/Skeleton.js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

// Route-level code splitting & lazy loading
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard.js').then(m => ({ default: m.OwnerDashboard })));
const DeliveryManagement = lazy(() => import('./pages/owner/DeliveryManagement.js').then(m => ({ default: m.DeliveryManagement })));
const StockLedger = lazy(() => import('./pages/owner/StockLedger.js').then(m => ({ default: m.StockLedger })));
const ShopWorkspace = lazy(() => import('./pages/owner/ShopWorkspace.js').then(m => ({ default: m.ShopWorkspace })));
const CatalogManagement = lazy(() => import('./pages/owner/CatalogManagement.js').then(m => ({ default: m.CatalogManagement })));
const PaymentTracking = lazy(() => import('./pages/owner/PaymentTracking.js').then(m => ({ default: m.PaymentTracking })));
const ShopAnalytics = lazy(() => import('./pages/owner/ShopAnalytics.js').then(m => ({ default: m.ShopAnalytics })));
const EmployeeReporting = lazy(() => import('./pages/employee/EmployeeReporting.js').then(m => ({ default: m.EmployeeReporting })));
const Login = lazy(() => import('./pages/auth/Login.js').then(m => ({ default: m.Login })));
const NotFound = lazy(() => import('./pages/NotFound.js').then(m => ({ default: m.NotFound })));

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
    let isMounted = true;

    async function initSession() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: membership } = await supabase
              .from('business_memberships')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            const role = membership?.role === 'owner' ? 'owner' : 'employee';

            let assignedShopName: string | undefined;
            if (role === 'employee') {
              const { data: shopMember } = await supabase
                .from('shop_memberships')
                .select('shop_id')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (shopMember?.shop_id) {
                const { data: shopData } = await supabase
                  .from('shops')
                  .select('name')
                  .eq('id', shopMember.shop_id)
                  .maybeSingle();
                assignedShopName = shopData?.name;
              }
            }

            if (isMounted) {
              const userState: UserState = {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || (role === 'owner' ? 'Business Owner' : 'Store Staff'),
                role,
                assignedShop: assignedShopName
              };
              setCurrentUser(userState);
              localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userState));
              localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
              return;
            }
          }
        }

        // Stored local session fallback
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
        }
      } catch (err) {
        console.warn('Could not restore stored session:', err);
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
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

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
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
    return (
      <Suspense fallback={<AppLoadingScreen message="Loading wholesale portal..." />}>
        <Login onLoginSuccess={handleSignIn} />
      </Suspense>
    );
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
        <main className="flex-1 w-full lg:pl-64 print:pl-0 animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Suspense fallback={<div className="py-6"><TableSkeleton rows={5} /></div>}>
              <Routes>
                {currentUser.role === 'owner' ? (
                  <>
                    <Route path="/" element={<OwnerDashboard />} />
                    <Route path="/shops" element={<ShopWorkspace />} />
                    <Route path="/deliveries" element={<DeliveryManagement />} />
                    <Route path="/stock-ledger" element={<StockLedger />} />
                    <Route path="/payments" element={<PaymentTracking />} />
                    <Route path="/analytics" element={<ShopAnalytics />} />
                    <Route path="/catalog" element={<CatalogManagement />} />
                    <Route path="/management" element={<CatalogManagement />} />
                    <Route path="/employee" element={<EmployeeReporting />} />
                    <Route path="*" element={<NotFound userRole={currentUser.role} />} />
                  </>
                ) : (
                  <>
                    <Route path="/employee" element={<EmployeeReporting />} />
                    <Route path="/stock-ledger" element={<StockLedger />} />
                    <Route path="*" element={<NotFound userRole={currentUser.role} />} />
                  </>
                )}
              </Routes>
            </Suspense>
          </div>
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

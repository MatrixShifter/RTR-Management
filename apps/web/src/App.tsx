import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar.js';
import { ToastProvider, useToast } from './components/ui/Toast.js';
import { ErrorBoundary } from './components/ui/ErrorBoundary.js';
import { AppLoadingScreen } from './components/ui/AppLoadingScreen.js';
import { TableSkeleton } from './components/ui/Skeleton.js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { setDemoMode } from './services/db.js';

// Route-level code splitting & lazy loading
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard.js').then(m => ({ default: m.OwnerDashboard })));
const SettingsPage = lazy(() => import('./pages/owner/Settings.js').then(m => ({ default: m.SettingsPage })));
const Login = lazy(() => import('./pages/auth/Login.js').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.js').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.js').then(m => ({ default: m.ResetPassword })));
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
  role: 'owner' | 'demo';
  isDemo?: boolean;
}

const STORAGE_USER_KEY = 'rtr_current_user';
const STORAGE_EXPIRY_KEY = 'rtr_session_expiry';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const AppContent: React.FC = () => {
  const { success, warning, info } = useToast();
  const [currentUser, setCurrentUser] = useState<UserState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const isVerifyingRef = useRef(false);
  const lastVerifiedTokenRef = useRef<string | null>(null);
  const warningRef = useRef(warning);
  warningRef.current = warning;

  // 1. Session verification & hydration
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // Prevent duplicate in-flight session verification calls
      if (isVerifyingRef.current) {
        return;
      }
      isVerifyingRef.current = true;

      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && session?.access_token) {
            // If this token was already verified, skip duplicate network call
            if (lastVerifiedTokenRef.current === session.access_token && currentUser) {
              return;
            }

            const isDemoAccount = session.user.email === 'demo-owner@rtrmobiles.com' || 
              session.user.user_metadata?.role === 'demo' || 
              session.user.user_metadata?.username === 'demo-owner';

            // Server-side token and membership verification
            try {
              const res = await fetch('/api/auth/verify-session', {
                headers: { Authorization: `Bearer ${session.access_token}` }
              });

              if (res.ok) {
                const data = await res.json();
                if (data.user?.role !== 'owner' && data.user?.role !== 'demo') {
                  throw new Error('Unauthorized account role');
                }
                const isDemo = data.user?.role === 'demo' || isDemoAccount;
                setDemoMode(isDemo);
                lastVerifiedTokenRef.current = session.access_token;
                if (isMounted) {
                  const userState: UserState = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: data.user?.name || session.user.user_metadata?.full_name || (isDemo ? 'Demo Owner (Sandbox)' : 'Business Owner'),
                    role: isDemo ? 'demo' : 'owner',
                    isDemo
                  };
                  setCurrentUser(userState);
                  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userState));
                  localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
                  return;
                }
              } else if (res.status === 401 || res.status === 403) {
                // Token revoked, expired, or non-owner access denied
                lastVerifiedTokenRef.current = null;
                await supabase.auth.signOut().catch(() => {});
                localStorage.removeItem(STORAGE_USER_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
                if (isMounted) {
                  setCurrentUser(null);
                  setIsBootstrapping(false);
                }
                return;
              } else {
                // Backend outage (502 / 503 / 500)
                lastVerifiedTokenRef.current = null;
                if (isMounted) {
                  warningRef.current('Backend authentication service is temporarily unavailable. Please verify API server is running on port 4000.');
                  setCurrentUser(null);
                  setIsBootstrapping(false);
                }
                return;
              }
            } catch {
              // Network error reaching /api/auth/verify-session
              lastVerifiedTokenRef.current = null;
              if (isMounted) {
                warningRef.current('Unable to connect to backend authentication server. Please check your connection.');
                setCurrentUser(null);
                setIsBootstrapping(false);
              }
              return;
            }
          }
        }

        // Stored local session fallback if token exists and is valid
        const storedUser = localStorage.getItem(STORAGE_USER_KEY);
        const storedExpiry = localStorage.getItem(STORAGE_EXPIRY_KEY);

        if (storedUser) {
          const expiryTime = storedExpiry ? parseInt(storedExpiry, 10) : 0;
          if (expiryTime && Date.now() > expiryTime) {
            localStorage.removeItem(STORAGE_USER_KEY);
            localStorage.removeItem(STORAGE_EXPIRY_KEY);
            warningRef.current('Your session has expired. Please sign in again.');
          } else {
            const parsed = JSON.parse(storedUser);
            if (parsed && (parsed.role === 'owner' || parsed.role === 'demo' || parsed.isDemo)) {
              if (parsed.role === 'demo' || parsed.isDemo) {
                setDemoMode(true);
              } else {
                setDemoMode(false);
              }
              if (isMounted) {
                setCurrentUser(parsed);
              }
            } else {
              localStorage.removeItem(STORAGE_USER_KEY);
            }
          }
        }
      } catch (err) {
        console.warn('Could not restore stored session:', err);
      } finally {
        isVerifyingRef.current = false;
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    initSession();

    // Listen to Supabase auth events (sign in, sign out, token refresh)
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          lastVerifiedTokenRef.current = null;
          if (isMounted) {
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_USER_KEY);
            localStorage.removeItem(STORAGE_EXPIRY_KEY);
          }
        } else if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          if (lastVerifiedTokenRef.current !== session.access_token) {
            initSession();
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          if (lastVerifiedTokenRef.current !== session.access_token) {
            initSession();
          }
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

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
    queryClient.clear();
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
    if (user.role === 'demo' || user.isDemo) {
      setDemoMode(true);
    } else {
      setDemoMode(false);
    }
    try {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    } catch (err) {
      console.error('Failed to save session to localStorage:', err);
    }
    if (user.role === 'demo' || user.isDemo) {
      success('Welcome to RTR Wholesale Demo Sandbox');
    } else {
      success(`Welcome back, ${user.name}`);
    }
  };

  const handleSignOut = async () => {
    setDemoMode(false);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
      queryClient.clear();
    } catch (err) {
      console.error('Failed to clear session from localStorage:', err);
    }
    setCurrentUser(null);
    info('Signed out successfully.');
  };

  // Prevent flashing of protected content before authentication is verified
  if (isBootstrapping) {
    return <AppLoadingScreen message="Initializing RTR Wholesale Management..." />;
  }

  return (
    <BrowserRouter>
      {!currentUser ? (
        // Public Authentication Routes (Owner Login & Password Recovery Only)
        <Suspense fallback={<AppLoadingScreen message="Loading wholesale portal..." />}>
          <Routes>
            <Route path="/login" element={<Login onLoginSuccess={handleSignIn} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      ) : (
        // Protected Workspace Routes (Owner Only)
        <div className="min-h-screen bg-[#F4F9FF] text-[#102A4C] flex flex-col font-sans">
          <Navbar
            userRole={currentUser.role}
            userName={currentUser.name}
            isOnline={isOnline}
            onSignOut={handleSignOut}
          />
          <main className="flex-1 w-full lg:pl-[205px] print:pl-0 animate-fade-in overflow-x-hidden">
            <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
              <Suspense fallback={<div className="py-6"><TableSkeleton rows={5} /></div>}>
                <Routes>
                  <Route path="/" element={<OwnerDashboard />} />
                  <Route path="/records" element={<OwnerDashboard />} />
                  <Route path="/settings" element={<SettingsPage onSignOut={handleSignOut} />} />
                  <Route path="/management" element={<SettingsPage onSignOut={handleSignOut} />} />
                  {/* Cleanly redirect legacy navigation links back to central Records ledger */}
                  <Route path="/shops" element={<Navigate to="/records" replace />} />
                  <Route path="/catalog" element={<Navigate to="/records" replace />} />
                  <Route path="/products" element={<Navigate to="/records" replace />} />
                  <Route path="/analytics" element={<Navigate to="/records" replace />} />
                  <Route path="/reports" element={<Navigate to="/records" replace />} />
                  <Route path="/deliveries" element={<Navigate to="/records" replace />} />
                  <Route path="/stock-ledger" element={<Navigate to="/records" replace />} />
                  <Route path="/payments" element={<Navigate to="/records" replace />} />
                  {/* Redirect legacy employee links to records */}
                  <Route path="/employee" element={<Navigate to="/records" replace />} />
                  {/* Redirect auth pages to workspace when already signed in */}
                  <Route path="/login" element={<Navigate to="/records" replace />} />
                  <Route path="/forgot-password" element={<Navigate to="/records" replace />} />
                  <Route path="/reset-password" element={<Navigate to="/records" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      )}
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

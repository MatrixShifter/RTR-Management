import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { ToastProvider, useToast } from './components/ui/Toast.js';
import { ErrorBoundary } from './components/ui/ErrorBoundary.js';
import { AppLoadingScreen } from './components/ui/AppLoadingScreen.js';
import { TableSkeleton } from './components/ui/Skeleton.js';
import { setDemoMode } from './services/demoMode.js';
import { Login } from './pages/auth/Login.js';
import { ForgotPassword } from './pages/auth/ForgotPassword.js';
import { ResetPassword } from './pages/auth/ResetPassword.js';
import { NotFound } from './pages/NotFound.js';
import { StatusError } from './pages/StatusError.js';
import { Navbar } from './components/Navbar.js';
import { InstallAppBanner } from './components/InstallAppBanner.js';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';

// Route-level code splitting & lazy loading for heavy workspace pages
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard.js').then(m => ({ default: m.OwnerDashboard })));
const SettingsPage = lazy(() => import('./pages/owner/Settings.js').then(m => ({ default: m.SettingsPage })));

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

/**
 * Enforces a timeout on any promise to prevent indefinite hanging during bootstrap.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMsg)), ms))
  ]);
}

interface WorkspaceLayoutProps {
  currentUser: UserState;
  isOnline: boolean;
  onSignOut: () => Promise<void>;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ currentUser, isOnline, onSignOut }) => {
  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#102A4C] flex flex-col font-sans">
      <Navbar
        userRole={currentUser.role}
        userName={currentUser.name}
        userId={currentUser.id}
        isOnline={isOnline}
        onSignOut={onSignOut}
      />
      <InstallAppBanner />
      <main className="flex-1 w-full lg:pl-[205px] print:pl-0 animate-fade-in overflow-x-hidden">
        <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Suspense fallback={<div className="py-6"><TableSkeleton rows={5} /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, warning, info } = useToast();
  
  // Synchronous initial session check from localStorage for instantaneous first paint
  const [currentUser, setCurrentUser] = useState<UserState | null>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_USER_KEY);
        const storedExpiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
        if (stored && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.role === 'owner' || parsed.role === 'demo' || parsed.isDemo)) {
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  });

  // Synchronous bootstrap check:
  // 1. If valid session already restored synchronously from localStorage, do not block first paint.
  // 2. If visitor is on public auth pages (/login, /forgot-password, /reset-password), do not block first paint.
  // 3. Only show loading screen if on a protected route with no local session, while checking Supabase credentials.
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_USER_KEY);
        const storedExpiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
        if (stored && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
          return false;
        }
      }
    } catch {}

    const p = location.pathname;
    if (p.startsWith('/login') || p.startsWith('/forgot-password') || p.startsWith('/reset-password')) {
      return false;
    }
    return true;
  });

  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const isVerifyingRef = useRef(false);
  const lastVerifiedTokenRef = useRef<string | null>(null);
  const warningRef = useRef(warning);
  warningRef.current = warning;

  // 1. Session verification & hydration
  const runInitSession = useCallback(async () => {
    // If user is currently on unauthenticated auth routes (/login, /forgot-password, /reset-password)
    // with no stored user session, do not make network calls or initialize a session
    const p = location.pathname;
    if (p.startsWith('/reset-password') || ((p.startsWith('/login') || p.startsWith('/forgot-password')) && (!localStorage.getItem(STORAGE_USER_KEY)))) {
      isVerifyingRef.current = false;
      setIsBootstrapping(false);
      return;
    }

    if (isVerifyingRef.current) {
      return;
    }
    isVerifyingRef.current = true;

    try {
      if (isSupabaseConfigured && supabase) {
        // Enforce 2500ms timeout on Supabase session lookup to avoid browser lock freezes
        let session = null;
        try {
          const sessionPromise = supabase.auth.getSession().catch(() => ({ data: { session: null } }));
          const res = await withTimeout(sessionPromise, 2500, 'Supabase session lookup timed out');
          session = res?.data?.session;
        } catch {
          session = null;
        }

        if (session?.user && session?.access_token) {
          // If this token was already verified, skip duplicate network call
          if (lastVerifiedTokenRef.current === session.access_token && currentUser) {
            return;
          }

          const isDemoAccount = session.user.email === 'demo-owner@rtrmobiles.com' || 
            session.user.user_metadata?.role === 'demo' || 
            session.user.user_metadata?.username === 'demo-owner';

          // Bounded retry loop for server-side token verification (up to 3 attempts total)
          // Gracefully absorbs brief startup latency between Vite and API server without failing
          const MAX_ATTEMPTS = 3;

          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (attempt > 1) {
              // Bounded backoff between attempts: 1000ms, then 2000ms
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
              const res = await fetch('/api/auth/verify-session', {
                headers: { Authorization: `Bearer ${session.access_token}` },
                signal: controller.signal
              });
              clearTimeout(timeoutId);

              if (res.ok) {
                const data = await res.json();
                if (data.user?.role !== 'owner' && data.user?.role !== 'demo') {
                  throw new Error('Unauthorized account role');
                }
                const isDemo = data.user?.role === 'demo' || isDemoAccount;
                setDemoMode(isDemo);
                lastVerifiedTokenRef.current = session.access_token;
                const userState: UserState = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: data.user?.name || session.user.user_metadata?.full_name || (isDemo ? 'Demo Owner (Sandbox)' : 'Business Owner'),
                  role: isDemo ? 'demo' : 'owner',
                  isDemo
                };
                setCurrentUser(userState);
                setBootstrapError(null);
                localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userState));
                localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
                return;
              } else if (res.status === 401 || res.status === 403) {
                // Definitive auth rejection (token expired or revoked) — do not retry
                lastVerifiedTokenRef.current = null;
                await supabase.auth.signOut().catch(() => {});
                localStorage.removeItem(STORAGE_USER_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
                setCurrentUser(null);
                setBootstrapError(null);
                return;
              } else if (res.status === 404) {
                // Backend API route not hosted on static deployment (e.g. Vercel without serverless route)
                // Proceed immediately to direct Supabase session validation
                break;
              } else {
                // 502, 503, or temporary server error: retry if attempts remain
                if (attempt < MAX_ATTEMPTS) {
                  continue;
                }
              }
            } catch {
              clearTimeout(timeoutId);
              // Network error or connection refused: retry if attempts remain
              if (attempt < MAX_ATTEMPTS) {
                continue;
              }
            }
          }

          // Direct Supabase authorization fallback if backend verification is unavailable/offline
          if (isSupabaseConfigured && supabase) {
            try {
              if (isDemoAccount) {
                setDemoMode(true);
                lastVerifiedTokenRef.current = session.access_token;
                const userState: UserState = {
                  id: session.user.id,
                  email: session.user.email || 'demo-owner@rtrmobiles.com',
                  name: session.user.user_metadata?.full_name || 'Demo Owner (Sandbox)',
                  role: 'demo',
                  isDemo: true
                };
                setCurrentUser(userState);
                setBootstrapError(null);
                localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userState));
                localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
                return;
              }

              const { data: membership, error: membershipErr } = await supabase
                .from('business_memberships')
                .select('role')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (!membershipErr && membership?.role === 'owner') {
                setDemoMode(false);
                lastVerifiedTokenRef.current = session.access_token;
                const userState: UserState = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.full_name || 'Business Owner',
                  role: 'owner',
                  isDemo: false
                };
                setCurrentUser(userState);
                setBootstrapError(null);
                localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userState));
                localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
                return;
              } else if (membership && membership.role !== 'owner') {
                // Found membership but not owner: access restricted
                lastVerifiedTokenRef.current = null;
                await supabase.auth.signOut().catch(() => {});
                localStorage.removeItem(STORAGE_USER_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
                setCurrentUser(null);
                setBootstrapError('Access restricted to Business Owner only.');
                return;
              }
            } catch (fallbackErr) {
              console.warn('Direct Supabase session verification fallback failed:', fallbackErr);
            }
          }

          // If both backend and direct Supabase verification failed:
          lastVerifiedTokenRef.current = null;
          setBootstrapError(
            'Unable to connect to authentication service. Please check your connection and try again.'
          );
          return;
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
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed && (parsed.role === 'demo' || parsed.isDemo)) {
              setDemoMode(true);
              setCurrentUser(parsed);
              setBootstrapError(null);
            } else if (parsed && parsed.role === 'owner') {
              // If Supabase is configured but has no active session, owner session has expired
              if (isSupabaseConfigured && supabase) {
                localStorage.removeItem(STORAGE_USER_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
                setCurrentUser(null);
                warningRef.current('Your session has expired. Please sign in again.');
              } else {
                setDemoMode(false);
                setCurrentUser(parsed);
                setBootstrapError(null);
              }
            } else {
              localStorage.removeItem(STORAGE_USER_KEY);
            }
          } catch {
            localStorage.removeItem(STORAGE_USER_KEY);
          }
        }
      }
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Could not restore stored session');
      }
    } finally {
      isVerifyingRef.current = false;
      setIsBootstrapping(false);
    }
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    // Fail-safe watchdog timer: guarantees loading screen settles within 3.5s under all circumstances
    const watchdogTimer = setTimeout(() => {
      if (isMounted) {
        setIsBootstrapping(false);
      }
    }, 3500);

    runInitSession();

    let authSub: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY') return;
        if (location.pathname.startsWith('/reset-password')) return;
        if (event === 'SIGNED_OUT') {
          lastVerifiedTokenRef.current = null;
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_USER_KEY);
          localStorage.removeItem(STORAGE_EXPIRY_KEY);
          if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/forgot-password') && !location.pathname.startsWith('/reset-password')) {
            navigate('/login', { replace: true });
          }
        } else if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          if (lastVerifiedTokenRef.current !== session.access_token) {
            runInitSession();
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          if (lastVerifiedTokenRef.current !== session.access_token) {
            runInitSession();
          }
        }
      });
      authSub = subscription;
    }

    return () => {
      isMounted = false;
      clearTimeout(watchdogTimer);
      authSub?.unsubscribe();
    };
  }, [runInitSession]);

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
    navigate('/login', { replace: true });
  }, [warning, navigate]);

  useEffect(() => {
    window.addEventListener('rtr:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('rtr:session-expired', handleSessionExpired);
    };
  }, [handleSessionExpired]);

  const handleSignIn = (user: UserState) => {
    setCurrentUser(user);
    setBootstrapError(null);
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
    success(`Welcome back, ${user.name}`);
    navigate('/records', { replace: true });
  };

  const handleSignOut = async () => {
    setDemoMode(false);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem(STORAGE_USER_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
      // Message service worker to clear private application caches
      if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'clear-cache' });
      }
    } catch (err) {
      console.error('Failed to clear session from localStorage:', err);
    }
    setCurrentUser(null);
    info('Signed out successfully.');
    navigate('/login', { replace: true });
  };

  // Prevent flashing of protected content before authentication is verified
  if (isBootstrapping) {
    return <AppLoadingScreen message="Initializing RTR Wholesale Management..." />;
  }

  // Display actionable error screen if backend outage occurred during startup
  if (bootstrapError && !currentUser) {
    return (
      <AppLoadingScreen 
        error={bootstrapError} 
        onRetry={() => {
          setBootstrapError(null);
          setIsBootstrapping(true);
          runInitSession();
        }}
        onProceedToLogin={() => {
          setBootstrapError(null);
          setIsBootstrapping(false);
          setCurrentUser(null);
        }}
      />
    );
  }

  return (
    <Routes>
      {/* 1. Public Authentication Routes */}
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to="/records" replace />
          ) : (
            <Login 
              onLoginSuccess={handleSignIn} 
              onNavigateToForgot={() => navigate('/forgot-password')} 
            />
          )
        }
      />
      <Route
        path="/forgot-password"
        element={
          currentUser ? (
            <Navigate to="/records" replace />
          ) : (
            <ForgotPassword 
              onNavigateToLogin={() => navigate('/login')} 
            />
          )
        }
      />
      <Route
        path="/reset-password"
        element={
          <ResetPassword
            onNavigateToLogin={() => {
              if (currentUser) {
                handleSignOut();
              } else {
                navigate('/login?reset=success');
              }
            }}
            onNavigateToForgot={() => navigate('/forgot-password')}
          />
        }
      />

      {/* 2. Protected Workspace Routes (Owner Only) */}
      <Route
        element={
          currentUser ? (
            <WorkspaceLayout
              currentUser={currentUser}
              isOnline={isOnline}
              onSignOut={handleSignOut}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<OwnerDashboard />} />
        <Route path="/records" element={<OwnerDashboard />} />
        <Route path="/settings" element={<SettingsPage currentUser={currentUser!} isOnline={isOnline} onSignOut={handleSignOut} />} />
        <Route path="/management" element={<SettingsPage currentUser={currentUser!} isOnline={isOnline} onSignOut={handleSignOut} />} />
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
      </Route>

      {/* 3. HTTP Status and Error Showcase Routes */}
      <Route path="/error" element={<StatusError />} />
      <Route path="/status/:code" element={<StatusError />} />

      {/* 4. Global Catch-All Route for Unmatched URLs */}
      <Route path="*" element={<NotFound isAuthenticated={Boolean(currentUser)} />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;

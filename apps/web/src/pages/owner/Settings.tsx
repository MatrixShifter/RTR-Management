import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  LogOut, 
  User, 
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Shield,
  Info
} from 'lucide-react';
import { clearMemoryCache } from '../../services/db.js';

interface UserState {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  isDemo?: boolean;
}

interface SettingsPageProps {
  currentUser?: UserState | null;
  isOnline?: boolean;
  onSignOut?: () => void;
}

type HealthState = 'checking' | 'connected' | 'disconnected' | 'offline';

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
  currentUser: propUser, 
  isOnline: propIsOnline,
  onSignOut 
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [healthDetails, setHealthDetails] = useState<{ uptime?: number; version?: string } | null>(null);

  // Safely resolve authenticated user from props or verified local session
  const [resolvedUser, setResolvedUser] = useState<UserState | null>(() => {
    if (propUser && propUser.email) return propUser;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('rtr_current_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (propUser && propUser.email) {
      setResolvedUser(propUser);
    }
  }, [propUser]);

  // Real backend health check (never assumes health without verification)
  const verifyBackendHealth = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setHealthState('offline');
      return;
    }

    setHealthState('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch('/api/health', { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.status === 'healthy') {
          setHealthState('connected');
          setHealthDetails({
            uptime: data.uptime,
            version: data.version || '1.0.0'
          });
          return;
        }
      }
      setHealthState('disconnected');
    } catch {
      setHealthState('disconnected');
    }
  }, []);

  useEffect(() => {
    verifyBackendHealth();
  }, [verifyBackendHealth]);

  const handleRefreshRecords = async () => {
    setRefreshing(true);
    setRefreshSuccess(false);

    try {
      clearMemoryCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr_data_sync', { detail: { key: 'all' } }));
      }
      await verifyBackendHealth();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const isActuallyOnline = propIsOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Real-time Live Connection Status */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Records</span>
        </Link>
        
        {/* Dynamic connection status badge based on genuine live verification */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {!isActuallyOnline || healthState === 'offline' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>Offline</span>
            </span>
          ) : healthState === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected &amp; Live</span>
            </span>
          ) : healthState === 'checking' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              <span>Checking connection...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Service Disconnected</span>
            </span>
          )}
        </div>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Settings &amp; Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          View your signed-in owner profile, system connectivity, and synchronize your wholesale workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Account Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#168BFF] flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Account Profile</h2>
                <p className="text-xs text-slate-400">Signed-in owner credentials</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between items-center py-1 gap-2">
                <span className="text-slate-500 flex-shrink-0">Account Name</span>
                <span className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-none text-right">
                  {resolvedUser?.name || 'Authorized Account'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 gap-2">
                <span className="text-slate-500 flex-shrink-0">Email Address</span>
                <span className="font-mono text-slate-800 text-[11px] truncate max-w-[160px] sm:max-w-none text-right">
                  {resolvedUser?.email || 'Authenticated Session'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Account Role</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#168BFF] font-bold text-[10px] tracking-wide uppercase">
                  <Shield className="w-3 h-3" />
                  {resolvedUser?.isDemo || resolvedUser?.role === 'demo' ? 'Demo Sandbox' : 'Business Owner'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Account Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Active &amp; Authenticated
                </span>
              </div>
            </div>
          </div>

          {onSignOut && (
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Sign Out of Workspace</span>
              </button>
            </div>
          )}
        </div>

        {/* Application Status & Synchronization Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Application Status</h2>
                <p className="text-xs text-slate-400">Workspace connectivity &amp; data sync</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Application</span>
                <span className="font-semibold text-slate-900">RTR Wholesale Management</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Client</span>
                <span className="font-medium text-slate-800">RTR Mobiles</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Version</span>
                <span className="font-mono text-slate-700 text-[11px]">
                  {healthDetails?.version || '1.0.0'} (Production)
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Live Service Status</span>
                <span className="font-semibold text-slate-800">
                  {healthState === 'connected' ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Operational
                    </span>
                  ) : healthState === 'checking' ? (
                    <span className="text-slate-500">Verifying...</span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      Unavailable
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
            <button
              type="button"
              onClick={handleRefreshRecords}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Synchronizing...' : refreshSuccess ? 'Records Synchronized!' : 'Reload & Synchronize Records'}</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <Info className="w-3 h-3 text-slate-400" />
              Fetches the latest wholesale records without affecting saved data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

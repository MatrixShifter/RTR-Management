import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  LogOut, 
  User, 
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { clearMemoryCache } from '../../services/db.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';

interface SettingsPageProps {
  onSignOut?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onSignOut }) => {
  const [cacheCleared, setCacheCleared] = useState(false);
  const currentUserRaw = localStorage.getItem('rtr_current_user');
  const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : { name: 'Business Owner', role: 'owner' };

  const handleClearCache = () => {
    clearMemoryCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Records</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>System Healthy</span>
        </div>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Settings & Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your RTR Wholesale session, database connectivity, and local storage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Account Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Session</h2>
              <p className="text-xs text-slate-400">Authenticated owner profile</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">User Name</span>
              <span className="font-semibold text-slate-900">{currentUser.name || 'Business Owner'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Role</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold uppercase text-[10px]">
                {currentUser.role || 'OWNER'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Access Scope</span>
              <span className="font-medium text-slate-800">Full Wholesale Records & Ledger</span>
            </div>
          </div>

          {onSignOut && (
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of Session</span>
              </button>
            </div>
          )}
        </div>

        {/* Database & Security Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Database Engine</h2>
              <p className="text-xs text-slate-400">Supabase & PostgreSQL persistence</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Supabase Connection</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSupabaseConfigured ? 'Configured & Online' : 'Local Fallback'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Security / RLS</span>
              <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Active (Row-Level Security)
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Canonical SQL</span>
              <span className="font-mono text-[11px] text-slate-600">database/rtr_complete.sql</span>
            </div>
          </div>
        </div>

        {/* Local Memory & Cache Management */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cache & Memory Store</h2>
              <p className="text-xs text-slate-400">Manage client-side caching and refresh records sync</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-800">
                Clear In-Memory Cache
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Forces a clean fetch from Supabase on your next view without deleting any database records.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cacheCleared ? 'animate-spin' : ''}`} />
              <span>{cacheCleared ? 'Cache Cleared!' : 'Clear Cache'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

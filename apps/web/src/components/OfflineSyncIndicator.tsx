import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getSyncMetadata, SyncMetadata } from '../services/offlineStorage.js';
import { synchronizeUserData } from '../services/syncEngine.js';

interface OfflineSyncIndicatorProps {
  userId: string | null;
  variant?: 'light' | 'dark';
}

export const OfflineSyncIndicator: React.FC<OfflineSyncIndicatorProps> = ({ userId, variant = 'light' }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncMeta, setSyncMeta] = useState<SyncMetadata | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const loadMeta = useCallback(async () => {
    if (!userId) return;
    try {
      const meta = await getSyncMetadata(userId);
      setSyncMeta(meta);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      loadMeta();
    };

    const handleSyncState = () => {
      loadMeta();
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('rtr:sync-state-changed', handleSyncState);
    window.addEventListener('rtr:sync-completed', handleSyncState);

    loadMeta();

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('rtr:sync-state-changed', handleSyncState);
      window.removeEventListener('rtr:sync-completed', handleSyncState);
    };
  }, [loadMeta]);

  const handleSyncNow = async () => {
    if (!userId || !isOnline || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await synchronizeUserData(userId);
      await loadMeta();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Not yet synced';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  const isSyncing = isManualSyncing || syncMeta?.syncState === 'syncing';
  const pendingCount = syncMeta?.pendingCount || 0;

  const isDark = variant === 'dark';

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="flex items-center gap-2 text-xs"
    >
      {/* Online/Offline Status Pill */}
      {!isOnline ? (
        <span 
          title="Device is currently offline. Viewing local cached records." 
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${
            isDark 
              ? 'bg-amber-950/80 text-amber-300 border-amber-700/60' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span className="hidden sm:inline">Offline Mode</span>
        </span>
      ) : (
        <span 
          title="Connected to RTR production cloud service" 
          className={`hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[11px] border ${
            isDark 
              ? 'bg-[#152744]/80 text-emerald-300 border-[#233B60]' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Online</span>
        </span>
      )}

      {/* Pending operations counter */}
      {pendingCount > 0 && (
        <span 
          title={`${pendingCount} operation(s) waiting for connection to synchronize`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] border ${
            isDark 
              ? 'bg-blue-950/80 text-sky-300 border-blue-700/60' 
              : 'bg-blue-50 text-[#168BFF] border-blue-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#168BFF] animate-ping" />
          <span>{pendingCount} Pending Sync</span>
        </span>
      )}

      {/* Sync Button & Last Sync Timestamp */}
      {userId && (
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={!isOnline || isSyncing}
          title={isOnline ? `Last synced: ${formatLastSync(syncMeta?.lastSyncedAt || null)}. Click to synchronize now.` : 'Cannot synchronize while offline'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
            isDark
              ? isOnline
                ? 'bg-[#152744] hover:bg-[#1f3a60] text-slate-200 border-[#233B60] hover:border-slate-400 shadow-2xs'
                : 'bg-slate-800/50 text-slate-500 border-slate-700 cursor-not-allowed'
              : isOnline
                ? 'bg-white hover:bg-slate-50 text-[#102A4C] border-[#DCE4EC] hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          }`}
        >
          <RefreshCw className={`w-3 h-3 text-[#168BFF] ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden lg:inline">{isSyncing ? 'Syncing...' : `Synced ${formatLastSync(syncMeta?.lastSyncedAt || null)}`}</span>
          <span className="lg:hidden">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      )}
    </div>
  );
};

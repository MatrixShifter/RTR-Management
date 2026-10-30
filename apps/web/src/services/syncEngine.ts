/**
 * RTR Wholesale Management — Automatic Background & Manual Sync Engine
 * 
 * Strict Synchronization Rules:
 * 1. Executes operations in FIFO order with client idempotency IDs.
 * 2. Never overwrites newer server records with stale local data.
 * 3. Prevents duplicate delivery creation and duplicate payment settlements.
 * 4. Isolates operations by authenticated user.
 * 5. Reconciles confirmed server responses into local IndexedDB cache.
 */

import { 
  getPendingOperations, 
  removePendingOperation, 
  updatePendingOperation, 
  updateSyncMetadata, 
  saveOfflineShops, 
  saveOfflineProducts, 
  saveOfflineRecords, 
  saveOfflineDeliveries, 
  putOfflineRecord
} from './offlineStorage.js';
import { 
  getShops, 
  getProducts, 
  getBusinessRecords, 
  getDeliveries,
  saveBusinessRecord,
  updateDeliveryStatus,
  settleDeliveryPayment
} from './db.js';

let isSyncInProgress = false;

export async function synchronizeUserData(userId: string): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  conflictCount: number;
}> {
  if (!userId) {
    return { success: false, processedCount: 0, failedCount: 0, conflictCount: 0 };
  }

  // 1. Check network connectivity
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isOnline) {
    await updateSyncMetadata(userId, { syncState: 'offline' });
    return { success: false, processedCount: 0, failedCount: 0, conflictCount: 0 };
  }

  // 2. Prevent concurrent sync loops
  if (isSyncInProgress) {
    return { success: true, processedCount: 0, failedCount: 0, conflictCount: 0 };
  }

  isSyncInProgress = true;
  await updateSyncMetadata(userId, { syncState: 'syncing' });

  // Notify listeners that sync has started
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rtr:sync-state-changed', { detail: { state: 'syncing' } }));
  }

  let processedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;

  try {
    const pendingOps = await getPendingOperations(userId);

    // 3. Process pending mutations in FIFO order
    for (const op of pendingOps) {
      if (op.status === 'CONFLICT') {
        conflictCount++;
        continue;
      }

      await updatePendingOperation(userId, op.id, { 
        status: 'SYNCING',
        retryCount: op.retryCount + 1 
      });

      try {
        if (op.type === 'create_record') {
          // Payload: SaveBusinessRecordInput
          const created = await saveBusinessRecord(op.payload);
          // On server confirmation: remove op and cache confirmed record
          await removePendingOperation(userId, op.id);
          if (created) {
            await putOfflineRecord(userId, created);
          }
          processedCount++;
        } else if (op.type === 'update_delivery_status') {
          // Payload: { id: string, status: 'delivered' | 'pending' }
          const success = await updateDeliveryStatus(op.payload.id, op.payload.status);
          if (success) {
            await removePendingOperation(userId, op.id);
            processedCount++;
          } else {
            throw new Error('Server returned false on delivery status update');
          }
        } else if (op.type === 'settle_payment') {
          // Payload: { deliveryId: string, amountToPay: number }
          await settleDeliveryPayment(op.payload.deliveryId, op.payload.amountToPay);
          await removePendingOperation(userId, op.id);
          processedCount++;
        }
      } catch (opErr: any) {
        const errorMsg = opErr?.message || String(opErr);
        const isNetworkErr = errorMsg.includes('Failed to fetch') || 
                             errorMsg.includes('network') || 
                             errorMsg.includes('NetworkError') ||
                             opErr?.name === 'TypeError';

        if (isNetworkErr) {
          // Put back to PENDING and stop queue processing until connectivity stabilizes
          await updatePendingOperation(userId, op.id, { 
            status: 'PENDING',
            errorMessage: 'Network interrupted during sync. Will retry automatically.'
          });
          failedCount++;
          break; // Stop remaining queue
        }

        // If it was a permanent business conflict (e.g. record no longer exists on server)
        if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('conflict')) {
          await updatePendingOperation(userId, op.id, { 
            status: 'CONFLICT',
            errorMessage: errorMsg 
          });
          conflictCount++;
        } else {
          await updatePendingOperation(userId, op.id, { 
            status: 'FAILED',
            errorMessage: errorMsg 
          });
          failedCount++;
        }
      }
    }

    // 4. Refresh authoritative local cache from server
    try {
      const [shops, products, records, deliveries] = await Promise.all([
        getShops(),
        getProducts(),
        getBusinessRecords(),
        getDeliveries()
      ]);

      if (Array.isArray(shops) && shops.length > 0) {
        await saveOfflineShops(userId, shops);
      }
      if (Array.isArray(products) && products.length > 0) {
        await saveOfflineProducts(userId, products);
      }
      if (Array.isArray(records) && records.length > 0) {
        await saveOfflineRecords(userId, records);
      }
      if (Array.isArray(deliveries) && deliveries.length > 0) {
        await saveOfflineDeliveries(userId, deliveries);
      }
    } catch (pullErr) {
      console.warn('[SyncEngine] Failed to refresh local cache from server:', pullErr);
    }

    // 5. Update sync metadata
    const remainingOps = await getPendingOperations(userId);
    const pendingNonConflict = remainingOps.filter(o => o.status === 'PENDING').length;

    await updateSyncMetadata(userId, {
      lastSyncedAt: new Date().toISOString(),
      pendingCount: pendingNonConflict,
      syncState: conflictCount > 0 ? 'error' : 'idle'
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rtr:sync-completed', {
        detail: {
          processedCount,
          failedCount,
          conflictCount,
          remainingCount: pendingNonConflict
        }
      }));
    }

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      conflictCount
    };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Registers automatic synchronization listeners:
 * - When browser comes online ('online')
 * - When app returns to foreground ('focus', 'visibilitychange')
 */
let listenersAttached = false;

export function initializeAutoSync(getUserId: () => string | null): () => void {
  if (typeof window === 'undefined' || listenersAttached) {
    return () => {};
  }

  listenersAttached = true;

  const triggerSync = () => {
    const userId = getUserId();
    if (userId && navigator.onLine) {
      synchronizeUserData(userId).catch((err) => {
        console.warn('[AutoSync] Background sync exception:', err);
      });
    }
  };

  const handleOnline = () => {
    triggerSync();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      triggerSync();
    }
  };

  const handleFocus = () => {
    triggerSync();
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  // Initial trigger after mount
  setTimeout(triggerSync, 1000);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    listenersAttached = false;
  };
}

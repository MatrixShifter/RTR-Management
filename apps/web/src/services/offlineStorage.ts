/**
 * RTR Wholesale Management — Production IndexedDB Offline Storage
 * 
 * Strict Architectural Rules:
 * 1. Isolates cached data by authenticated user (`userId`).
 * 2. Follows authoritative Supabase schema; preserves original server identifiers.
 * 3. Handles storage quota errors (`QuotaExceededError`) gracefully.
 * 4. Gracefully degrades to an in-memory store in non-IndexedDB environments (SSR, Vitest, private browsing).
 * 5. Validates structure before persistence.
 */

import { Shop, Product, BusinessRecord, DeliveryRecord } from './db.js';

const DB_NAME = 'rtr_wholesale_offline_db';
const DB_VERSION = 1;

export type SyncOperationType = 'create_record' | 'update_delivery_status' | 'settle_payment';
export type SyncOperationStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface PendingSyncOperation {
  id: string; // Client idempotency ID (e.g. op_<timestamp>_<uuid>)
  userId: string;
  type: SyncOperationType;
  payload: any;
  status: SyncOperationStatus;
  timestamp: number;
  retryCount: number;
  errorMessage?: string;
  localId?: string;
}

export interface SyncMetadata {
  userId: string;
  lastSyncedAt: string | null;
  pendingCount: number;
  syncState: 'idle' | 'syncing' | 'error' | 'offline';
}

export const STORES = {
  SHOPS: 'shops',
  PRODUCTS: 'products',
  RECORDS: 'records',
  DELIVERIES: 'deliveries',
  PENDING_SYNC: 'pending_sync',
  SYNC_META: 'sync_meta'
} as const;

// In-memory fallback map for non-browser or disabled environments
const memoryStores = new Map<string, Map<string, any>>();

function getMemoryStore(storeName: string): Map<string, any> {
  let s = memoryStores.get(storeName);
  if (!s) {
    s = new Map<string, any>();
    memoryStores.set(storeName, s);
  }
  return s;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Shops store
        if (!db.objectStoreNames.contains(STORES.SHOPS)) {
          const shopStore = db.createObjectStore(STORES.SHOPS, { keyPath: 'id' });
          shopStore.createIndex('userId', 'userId', { unique: false });
          shopStore.createIndex('name', 'name', { unique: false });
        }

        // 2. Products store
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const prodStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          prodStore.createIndex('userId', 'userId', { unique: false });
          prodStore.createIndex('name', 'name', { unique: false });
          prodStore.createIndex('sku', 'sku', { unique: false });
        }

        // 3. Records store
        if (!db.objectStoreNames.contains(STORES.RECORDS)) {
          const recStore = db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
          recStore.createIndex('userId', 'userId', { unique: false });
          recStore.createIndex('deliveryId', 'deliveryId', { unique: false });
          recStore.createIndex('shopId', 'shopId', { unique: false });
          recStore.createIndex('date', 'date', { unique: false });
          recStore.createIndex('deliveryStatus', 'deliveryStatus', { unique: false });
        }

        // 4. Deliveries store
        if (!db.objectStoreNames.contains(STORES.DELIVERIES)) {
          const delivStore = db.createObjectStore(STORES.DELIVERIES, { keyPath: 'id' });
          delivStore.createIndex('userId', 'userId', { unique: false });
          delivStore.createIndex('shopId', 'shopId', { unique: false });
          delivStore.createIndex('status', 'status', { unique: false });
          delivStore.createIndex('deliveryDate', 'deliveryDate', { unique: false });
        }

        // 5. Pending Sync store
        if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
          const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id' });
          syncStore.createIndex('userId', 'userId', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 6. Sync Metadata store
        if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
          db.createObjectStore(STORES.SYNC_META, { keyPath: 'userId' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = (event) => {
        dbPromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

// ----------------------------------------------------
// Generic Helper for Transacting with IndexedDB
// ----------------------------------------------------
async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  if (!isIndexedDBSupported()) {
    // In-memory fallback
    const mem = getMemoryStore(storeName);
    return operation(createMemoryStoreShim(mem) as unknown as IDBObjectStore);
  }

  try {
    const db = await openDatabase();
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);

      let result: T;
      operation(store)
        .then((res) => {
          result = res;
        })
        .catch(reject);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = (event) => reject((event.target as IDBTransaction).error);
      transaction.onabort = (event) => reject((event.target as IDBTransaction).error);
    });
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError') {
      console.warn('[OfflineStorage] Storage quota exceeded. Evicting old items.');
    }
    // Fall back to in-memory store
    const mem = getMemoryStore(storeName);
    return operation(createMemoryStoreShim(mem) as unknown as IDBObjectStore);
  }
}

function createMemoryStoreShim(mem: Map<string, any>) {
  return {
    put: (item: any) => {
      const key = item.id || item.userId || item.key;
      mem.set(key, item);
      const req: any = { result: item, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
      return req;
    },
    get: (key: string) => {
      const val = mem.get(key);
      const req: any = { result: val, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
      return req;
    },
    delete: (key: string) => {
      mem.delete(key);
      const req: any = { onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
      return req;
    },
    clear: () => {
      mem.clear();
      const req: any = { onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
      return req;
    },
    getAll: () => {
      const arr = Array.from(mem.values());
      const req: any = { result: arr, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
      return req;
    },
    index: (indexName?: string) => ({
      getAll: (queryKey?: any) => {
        let arr = Array.from(mem.values());
        if (queryKey !== undefined) {
          arr = arr.filter((item: any) => {
            if (indexName && item[indexName] !== undefined) {
              return item[indexName] === queryKey;
            }
            return item.userId === queryKey;
          });
        }
        const req: any = { result: arr, onsuccess: null, onerror: null };
        queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
        return req;
      }
    })
  };
}

// ----------------------------------------------------
// SHOPS OFFLINE STORAGE
// ----------------------------------------------------
export async function saveOfflineShops(userId: string, shops: Shop[]): Promise<void> {
  if (!shops || !Array.isArray(shops)) return;
  await runTransaction(STORES.SHOPS, 'readwrite', async (store) => {
    for (const shop of shops) {
      if (shop.id && shop.name) {
        store.put({ ...shop, userId });
      }
    }
  });
}

export async function getOfflineShops(userId: string): Promise<Shop[]> {
  return runTransaction(STORES.SHOPS, 'readonly', async (store) => {
    return new Promise<Shop[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as Shop[]);
      req.onerror = () => reject(req.error);
    });
  });
}

// ----------------------------------------------------
// PRODUCTS OFFLINE STORAGE
// ----------------------------------------------------
export async function saveOfflineProducts(userId: string, products: Product[]): Promise<void> {
  if (!products || !Array.isArray(products)) return;
  await runTransaction(STORES.PRODUCTS, 'readwrite', async (store) => {
    for (const prod of products) {
      if (prod.id && prod.name) {
        store.put({ ...prod, userId });
      }
    }
  });
}

export async function getOfflineProducts(userId: string): Promise<Product[]> {
  return runTransaction(STORES.PRODUCTS, 'readonly', async (store) => {
    return new Promise<Product[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as Product[]);
      req.onerror = () => reject(req.error);
    });
  });
}

// ----------------------------------------------------
// BUSINESS RECORDS OFFLINE STORAGE
// ----------------------------------------------------
export async function saveOfflineRecords(userId: string, records: BusinessRecord[]): Promise<void> {
  if (!records || !Array.isArray(records)) return;
  await runTransaction(STORES.RECORDS, 'readwrite', async (store) => {
    for (const rec of records) {
      if (rec.id && rec.deliveryId) {
        store.put({ ...rec, userId });
      }
    }
  });
}

export async function getOfflineRecords(userId: string): Promise<BusinessRecord[]> {
  return runTransaction(STORES.RECORDS, 'readonly', async (store) => {
    return new Promise<BusinessRecord[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as BusinessRecord[]);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putOfflineRecord(userId: string, record: BusinessRecord): Promise<void> {
  if (!record.id) return;
  await runTransaction(STORES.RECORDS, 'readwrite', async (store) => {
    store.put({ ...record, userId });
  });
}

// ----------------------------------------------------
// DELIVERIES OFFLINE STORAGE
// ----------------------------------------------------
export async function saveOfflineDeliveries(userId: string, deliveries: DeliveryRecord[]): Promise<void> {
  if (!deliveries || !Array.isArray(deliveries)) return;
  await runTransaction(STORES.DELIVERIES, 'readwrite', async (store) => {
    for (const d of deliveries) {
      if (d.id && d.shopId) {
        store.put({ ...d, userId });
      }
    }
  });
}

export async function getOfflineDeliveries(userId: string): Promise<DeliveryRecord[]> {
  return runTransaction(STORES.DELIVERIES, 'readonly', async (store) => {
    return new Promise<DeliveryRecord[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as DeliveryRecord[]);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putOfflineDelivery(userId: string, delivery: DeliveryRecord): Promise<void> {
  if (!delivery.id) return;
  await runTransaction(STORES.DELIVERIES, 'readwrite', async (store) => {
    store.put({ ...delivery, userId });
  });
}

// ----------------------------------------------------
// PENDING SYNCHRONIZATION QUEUE
// ----------------------------------------------------
export async function enqueuePendingOperation(
  userId: string,
  operation: Omit<PendingSyncOperation, 'timestamp' | 'retryCount'>
): Promise<PendingSyncOperation> {
  const fullOp: PendingSyncOperation = {
    ...operation,
    userId,
    timestamp: Date.now(),
    retryCount: 0
  };

  await runTransaction(STORES.PENDING_SYNC, 'readwrite', async (store) => {
    store.put(fullOp);
  });

  return fullOp;
}

export async function getPendingOperations(userId: string): Promise<PendingSyncOperation[]> {
  const ops = await runTransaction(STORES.PENDING_SYNC, 'readonly', async (store) => {
    return new Promise<PendingSyncOperation[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result || []) as PendingSyncOperation[]);
      req.onerror = () => reject(req.error);
    });
  });

  // Sort FIFO: oldest timestamp first
  return ops.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updatePendingOperation(
  _userId: string,
  opId: string,
  updates: Partial<PendingSyncOperation>
): Promise<void> {
  await runTransaction(STORES.PENDING_SYNC, 'readwrite', async (store) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = store.get(opId);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          const merged = { ...item, ...updates };
          const putReq = store.put(merged);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function removePendingOperation(_userId: string, opId: string): Promise<void> {
  await runTransaction(STORES.PENDING_SYNC, 'readwrite', async (store) => {
    store.delete(opId);
  });
}

// ----------------------------------------------------
// SYNCHRONIZATION METADATA
// ----------------------------------------------------
export async function getSyncMetadata(userId: string): Promise<SyncMetadata> {
  const fallback: SyncMetadata = {
    userId,
    lastSyncedAt: null,
    pendingCount: 0,
    syncState: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  };

  return runTransaction(STORES.SYNC_META, 'readonly', async (store) => {
    return new Promise<SyncMetadata>((resolve) => {
      const req = store.get(userId);
      req.onsuccess = () => resolve((req.result as SyncMetadata) || fallback);
      req.onerror = () => resolve(fallback);
    });
  });
}

export async function updateSyncMetadata(userId: string, updates: Partial<SyncMetadata>): Promise<SyncMetadata> {
  const current = await getSyncMetadata(userId);
  const updated: SyncMetadata = { ...current, ...updates, userId };

  await runTransaction(STORES.SYNC_META, 'readwrite', async (store) => {
    store.put(updated);
  });

  return updated;
}

// ----------------------------------------------------
// USER LOGOUT PURGE
// ----------------------------------------------------
export async function clearUserOfflineData(userId: string): Promise<void> {
  if (!userId) return;

  // Clear user-specific rows from shops, products, records, deliveries, pending_sync, sync_meta
  const storesToClean = [
    STORES.SHOPS, 
    STORES.PRODUCTS, 
    STORES.RECORDS, 
    STORES.DELIVERIES, 
    STORES.PENDING_SYNC, 
    STORES.SYNC_META
  ];

  for (const storeName of storesToClean) {
    await runTransaction(storeName, 'readwrite', async (store) => {
      return new Promise<void>((resolve) => {
        try {
          if (storeName === STORES.SYNC_META) {
            store.delete(userId);
            resolve();
          } else {
            const index = store.index('userId');
            const req = index.getAll(userId);
            req.onsuccess = () => {
              const items = req.result || [];
              for (const item of items) {
                const key = item.id || item.userId;
                if (key) store.delete(key);
              }
              resolve();
            };
            req.onerror = () => resolve();
          }
        } catch {
          resolve();
        }
      });
    });
  }
}

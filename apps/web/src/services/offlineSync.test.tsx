import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  saveOfflineShops,
  getOfflineShops,
  saveOfflineProducts,
  getOfflineProducts,
  saveOfflineRecords,
  getOfflineRecords,
  putOfflineRecord,
  saveOfflineDeliveries,
  getOfflineDeliveries,
  enqueuePendingOperation,
  getPendingOperations,
  updatePendingOperation,
  removePendingOperation,
  getSyncMetadata,
  updateSyncMetadata,
  clearUserOfflineData
} from './offlineStorage.js';
import { isStandaloneMode } from './usePwaInstall.js';
import { OfflineSyncIndicator } from '../components/OfflineSyncIndicator.js';
import { InstallAppBanner } from '../components/InstallAppBanner.js';

describe('RTR Wholesale Management — Offline Storage & Synchronization Engine', () => {
  const USER_A = 'usr_owner_alpha_123';
  const USER_B = 'usr_owner_beta_456';

  beforeEach(async () => {
    // Purge local storage and clean state before each test
    await clearUserOfflineData(USER_A);
    await clearUserOfflineData(USER_B);
  });

  describe('Phase 3: Multi-tenant IndexedDB Offline Storage Isolation', () => {
    it('persists and retrieves shops scoped strictly by userId', async () => {
      const shopsA = [
        { id: 'shop-1', name: 'Al-Madina Telecom', code: 'RTR-ALMA', address: 'Main Bazaar', phone: '9876543210', isActive: true, assignedEmployees: [] },
        { id: 'shop-2', name: 'Zubair Mobile Care', code: 'RTR-ZUBA', address: 'Station Road', phone: '9876543211', isActive: true, assignedEmployees: [] }
      ];
      const shopsB = [
        { id: 'shop-3', name: 'City Center Mobiles', code: 'RTR-CITY', address: 'Mall Road', phone: '9876543212', isActive: true, assignedEmployees: [] }
      ];

      await saveOfflineShops(USER_A, shopsA as any);
      await saveOfflineShops(USER_B, shopsB as any);

      const retrievedA = await getOfflineShops(USER_A);
      const retrievedB = await getOfflineShops(USER_B);

      expect(retrievedA).toHaveLength(2);
      expect(retrievedA.map(s => s.id)).toEqual(['shop-1', 'shop-2']);

      expect(retrievedB).toHaveLength(1);
      expect(retrievedB[0]?.id).toBe('shop-3');
    });

    it('persists and retrieves products scoped strictly by userId', async () => {
      const productsA = [
        { id: 'prod-1', name: 'Fast Charger 65W', sku: 'SKU-FC65', category: 'Chargers', minStock: 10, unitPrice: 450, isActive: true },
        { id: 'prod-2', name: 'Braided Type-C Cable', sku: 'SKU-CABL', category: 'Cables', minStock: 20, unitPrice: 120, isActive: true }
      ];

      await saveOfflineProducts(USER_A, productsA as any);

      const retrieved = await getOfflineProducts(USER_A);
      expect(retrieved).toHaveLength(2);
      expect(retrieved.find(p => p.sku === 'SKU-FC65')?.name).toBe('Fast Charger 65W');

      // User B should receive empty list (isolation check)
      const retrievedB = await getOfflineProducts(USER_B);
      expect(retrievedB).toHaveLength(0);
    });

    it('persists, updates, and retrieves business records scoped by userId', async () => {
      const recordA: any = {
        id: 'rec-1',
        deliveryId: 'deliv-1',
        date: '2026-10-30',
        shopId: 'shop-1',
        shopName: 'Al-Madina Telecom',
        productId: 'prod-1',
        productName: 'Fast Charger 65W',
        quantity: 5,
        unitPrice: 450,
        totalAmount: 2250,
        deliveryStatus: 'pending',
        pendingAmount: 2250,
        createdAt: '2026-10-30T10:00:00Z'
      };

      await saveOfflineRecords(USER_A, [recordA]);

      let records = await getOfflineRecords(USER_A);
      expect(records).toHaveLength(1);
      expect(records[0]?.pendingAmount).toBe(2250);

      // Mutate single record offline (e.g. status transition)
      await putOfflineRecord(USER_A, {
        ...recordA,
        deliveryStatus: 'delivered',
        pendingAmount: 0
      });

      records = await getOfflineRecords(USER_A);
      expect(records).toHaveLength(1);
      expect(records[0]?.deliveryStatus).toBe('delivered');
      expect(records[0]?.pendingAmount).toBe(0);
    });

    it('persists and retrieves deliveries scoped by userId', async () => {
      const delivery = {
        id: 'deliv-101',
        shopId: 'shop-1',
        shopName: 'Al-Madina Telecom',
        deliveryDate: '2026-10-30',
        status: 'pending' as const,
        createdBy: 'Business Owner',
        items: [{ productId: 'prod-1', productName: 'Fast Charger', productSku: 'FC', quantity: 5, unitPrice: 450 }],
        pendingAmount: 2250,
        createdAt: '2026-10-30T10:00:00Z'
      };

      await saveOfflineDeliveries(USER_A, [delivery]);

      const deliveriesA = await getOfflineDeliveries(USER_A);
      expect(deliveriesA).toHaveLength(1);
      expect(deliveriesA[0]?.id).toBe('deliv-101');

      // User B receives empty list
      const deliveriesB = await getOfflineDeliveries(USER_B);
      expect(deliveriesB).toHaveLength(0);
    });

    it('clears only targeted user offline data on account sign out or purge', async () => {
      await saveOfflineShops(USER_A, [{ id: 's-a', name: 'Shop A' }] as any);
      await saveOfflineShops(USER_B, [{ id: 's-b', name: 'Shop B' }] as any);

      await clearUserOfflineData(USER_A);

      expect(await getOfflineShops(USER_A)).toHaveLength(0);
      expect(await getOfflineShops(USER_B)).toHaveLength(1);
    });
  });

  describe('Phase 5 & 6: Pending Sync Operations FIFO Queue & Conflict Resilience', () => {
    it('enqueues pending operations with client idempotency IDs and preserves FIFO ordering', async () => {
      await enqueuePendingOperation(USER_A, {
        id: 'op_rec_001',
        userId: USER_A,
        type: 'create_record',
        payload: { shopName: 'Shop A', productName: 'Prod A', quantity: 1, unitPrice: 100 },
        status: 'PENDING'
      });

      // Small delay to ensure timestamp progression
      await new Promise(r => setTimeout(r, 10));

      await enqueuePendingOperation(USER_A, {
        id: 'op_status_002',
        userId: USER_A,
        type: 'update_delivery_status',
        payload: { deliveryId: 'deliv-101', status: 'delivered' },
        status: 'PENDING'
      });

      const queue = await getPendingOperations(USER_A);
      expect(queue).toHaveLength(2);
      expect(queue[0]?.id).toBe('op_rec_001');
      expect(queue[1]?.id).toBe('op_status_002');
      expect(queue[0]!.timestamp).toBeLessThanOrEqual(queue[1]!.timestamp);
    });

    it('updates pending operation status and increments retry count safely', async () => {
      await enqueuePendingOperation(USER_A, {
        id: 'op_pay_003',
        userId: USER_A,
        type: 'settle_payment',
        payload: { deliveryId: 'deliv-101', amountToPay: 500 },
        status: 'PENDING'
      });

      await updatePendingOperation(USER_A, 'op_pay_003', {
        status: 'SYNCING',
        retryCount: 1
      });

      const queue = await getPendingOperations(USER_A);
      expect(queue).toHaveLength(1);
      expect(queue[0]?.status).toBe('SYNCING');
      expect(queue[0]?.retryCount).toBe(1);
    });

    it('removes confirmed operations from the pending sync queue', async () => {
      await enqueuePendingOperation(USER_A, {
        id: 'op_rem_004',
        userId: USER_A,
        type: 'create_record',
        payload: {},
        status: 'PENDING'
      });

      expect(await getPendingOperations(USER_A)).toHaveLength(1);

      await removePendingOperation(USER_A, 'op_rem_004');
      expect(await getPendingOperations(USER_A)).toHaveLength(0);
    });

    it('maintains sync metadata state across sessions', async () => {
      const initial = await getSyncMetadata(USER_A);
      expect(initial.userId).toBe(USER_A);
      expect(['idle', 'offline']).toContain(initial.syncState);
      expect(initial.pendingCount).toBe(0);

      const timestamp = new Date().toISOString();
      await updateSyncMetadata(USER_A, {
        lastSyncedAt: timestamp,
        pendingCount: 3,
        syncState: 'idle'
      });

      const updated = await getSyncMetadata(USER_A);
      expect(updated.lastSyncedAt).toBe(timestamp);
      expect(updated.pendingCount).toBe(3);
    });
  });

  describe('Phase 1: PWA Standalone Mode Detection', () => {
    it('detects standalone display mode correctly via matchMedia or window properties', () => {
      // Default non-window environment is not standalone
      expect(isStandaloneMode()).toBe(false);

      // Mock window.matchMedia for standalone
      (globalThis as any).window = {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)'
        }))
      };

      expect(isStandaloneMode()).toBe(true);

      delete (globalThis as any).window;
    });
  });

  describe('Phase 4: Offline UI Indicators & Non-intrusive Banner', () => {
    it('renders Offline indicator status correctly in offline and online modes', () => {
      // In default environment without live connection
      const offlineHtml = renderToString(<OfflineSyncIndicator userId={USER_A} variant="light" />);
      expect(offlineHtml).toContain('Offline Mode');
      expect(offlineHtml).toContain('Sync');

      // Dark variant (used in navy navigation bar)
      const darkHtml = renderToString(<OfflineSyncIndicator userId={USER_A} variant="dark" />);
      expect(darkHtml).toContain('Offline Mode');
      expect(darkHtml).toContain('border-amber-700/60');
    });

    it('renders non-intrusive Install App banner with required actions', () => {
      const html = renderToString(<InstallAppBanner />);
      expect(html).toContain('Install RTR App');
      expect(html).toContain('instant offline records');
      expect(html).toContain('Dismiss banner');
    });
  });
});

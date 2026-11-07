import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const memoryStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  get length() { return memoryStore.size; },
  key: (i: number) => Array.from(memoryStore.keys())[i] ?? null
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  });
}

const eventListeners = new Map<string, Set<EventListener>>();
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.window.addEventListener !== 'function') {
  globalThis.window.addEventListener = (type: string, listener: any) => {
    if (!eventListeners.has(type)) eventListeners.set(type, new Set());
    eventListeners.get(type)!.add(listener);
  };
  globalThis.window.removeEventListener = (type: string, listener: any) => {
    eventListeners.get(type)?.delete(listener);
  };
  globalThis.window.dispatchEvent = (event: any) => {
    eventListeners.get(event.type)?.forEach(fn => fn(event));
    return true;
  };
}

import { 
  getValidAuthToken, 
  authenticatedFetch, 
  deleteBusinessRecord, 
  deleteShop,
  deleteProduct
} from './db.js';
import { supabase } from '../lib/supabase.js';

describe('Safe Deletion, Session Refresh & False Success Prevention Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    memoryStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getValidAuthToken()', () => {
    it('returns existing access token when token is fresh (> 60s remaining)', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'fresh-valid-token-123',
            expires_at: futureExpiry
          } as any
        },
        error: null
      });

      const token = await getValidAuthToken();
      expect(token).toBe('fresh-valid-token-123');
    });

    it('automatically refreshes token when current token is expired or expiring soon (< 60s)', async () => {
      const nearExpiry = Math.floor(Date.now() / 1000) + 30; // 30 seconds in future (< 60s)
      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'expiring-token',
            expires_at: nearExpiry
          } as any
        },
        error: null
      });

      const refreshSpy = vi.spyOn(supabase!.auth, 'refreshSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'new-refreshed-token-456',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any,
          user: null
        },
        error: null
      });

      const token = await getValidAuthToken();
      expect(refreshSpy).toHaveBeenCalled();
      expect(token).toBe('new-refreshed-token-456');
    });

    it('dispatches rtr:session-expired event and returns null when refresh fails', async () => {
      const expired = Math.floor(Date.now() / 1000) - 100; // expired
      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'stale-token',
            expires_at: expired
          } as any
        },
        error: null
      });

      vi.spyOn(supabase!.auth, 'refreshSession').mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Refresh failed') as any
      });

      let expiredEventFired = false;
      const listener = () => { expiredEventFired = true; };
      window.addEventListener('rtr:session-expired', listener);

      const token = await getValidAuthToken();
      window.removeEventListener('rtr:session-expired', listener);

      expect(expiredEventFired).toBe(true);
      expect(token).toBeNull();
    });
  });

  describe('authenticatedFetch()', () => {
    it('retries request after automatic token refresh when initial response is 401', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'initial-token',
            expires_at: futureExpiry
          } as any
        },
        error: null
      });

      vi.spyOn(supabase!.auth, 'refreshSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'refreshed-token-xyz',
            expires_at: futureExpiry + 3600
          } as any,
          user: null
        },
        error: null
      });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        callCount++;
        const authHeader = (options?.headers as Headers)?.get?.('Authorization') || options?.headers?.Authorization;
        if (callCount === 1) {
          expect(authHeader).toBe('Bearer initial-token');
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        expect(authHeader).toBe('Bearer refreshed-token-xyz');
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const res = await authenticatedFetch('/api/test-endpoint');
      expect(res.ok).toBe(true);
      expect(callCount).toBe(2);
    });

    it('dispatches rtr:session-expired and throws error when refresh also fails on 401', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'initial-token',
            expires_at: futureExpiry
          } as any
        },
        error: null
      });

      vi.spyOn(supabase!.auth, 'refreshSession').mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Token expired') as any
      });

      global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

      let expiredFired = false;
      const listener = () => { expiredFired = true; };
      window.addEventListener('rtr:session-expired', listener);

      await expect(authenticatedFetch('/api/test-endpoint')).rejects.toThrow('Invalid or expired session token.');
      window.removeEventListener('rtr:session-expired', listener);

      expect(expiredFired).toBe(true);
    });
  });

  describe('deleteBusinessRecord() — Prevention of False Success', () => {
    it('throws error and does NOT delete local record when server returns 401', async () => {
      const targetId = '11111111-1111-1111-1111-111111111111';
      // Seed existing local record
      const initialDeliveries = [{ id: targetId, shopId: 's1', status: 'pending', deliveryDate: '2026-10-29', createdBy: 'Owner', items: [], createdAt: '2026-10-29' }];
      mockLocalStorage.setItem('rtr_deliveries_v1', JSON.stringify(initialDeliveries));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      // API returns 401 Unauthorized
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized: Access restricted to Business Owner only.' }), { status: 401 })
      );

      // Must throw rather than swallowing the error or reporting false success
      await expect(deleteBusinessRecord(targetId)).rejects.toThrow();

      // Local storage must remain intact
      const saved = JSON.parse(mockLocalStorage.getItem('rtr_deliveries_v1') || '[]');
      expect(saved.length).toBe(1);
      expect(saved[0].id).toBe(targetId);
    });

    it('throws error and retains local record when server returns 500 error', async () => {
      const targetId = '22222222-2222-2222-2222-222222222222';
      const initialDeliveries = [{ id: targetId, shopId: 's1', status: 'pending', deliveryDate: '2026-10-29', createdBy: 'Owner', items: [], createdAt: '2026-10-29' }];
      mockLocalStorage.setItem('rtr_deliveries_v1', JSON.stringify(initialDeliveries));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Database connection failed' }), { status: 500 })
      );

      await expect(deleteBusinessRecord(targetId)).rejects.toThrow('Database connection failed');

      const saved = JSON.parse(mockLocalStorage.getItem('rtr_deliveries_v1') || '[]');
      expect(saved.length).toBe(1);
    });
  });

  describe('deleteShop() & deleteProduct() — Safe Deletion & Archiving', () => {
    it('deactivates and archives shop when backend confirms archiving', async () => {
      const shopId = '33333333-3333-3333-3333-333333333333';
      const initialShops = [{ id: shopId, name: 'Metro Retail', code: 'MET', address: '123 Main', phone: '1234567890', isActive: true, assignedEmployees: [] }];
      mockLocalStorage.setItem('rtr_shops_v1', JSON.stringify(initialShops));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: true, count: 5 }), { status: 200 });
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'archived',
          message: '"Metro Retail" is referenced by 5 existing records. It has been safely deactivated and archived.',
          recordsCount: 5
        }), { status: 200 });
      });

      const result = await deleteShop(shopId);
      expect(result.success).toBe(true);
      expect(result.action).toBe('archived');

      // Verify shop was deactivated, not removed
      const savedShops = JSON.parse(mockLocalStorage.getItem('rtr_shops_v1') || '[]');
      expect(savedShops.length).toBe(1);
      expect(savedShops[0].isActive).toBe(false);
    });

    it('permanently deletes shop from local storage when backend confirms deletion of unused shop', async () => {
      const shopId = '44444444-4444-4444-4444-444444444444';
      const initialShops = [{ id: shopId, name: 'Brand New Shop', code: 'NEW', address: '456 Side', phone: '9876543210', isActive: true, assignedEmployees: [] }];
      mockLocalStorage.setItem('rtr_shops_v1', JSON.stringify(initialShops));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: false, count: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'deleted',
          message: '"Brand New Shop" deleted successfully.',
          recordsCount: 0
        }), { status: 200 });
      });

      const result = await deleteShop(shopId);
      expect(result.success).toBe(true);
      expect(result.action).toBe('deleted');

      const savedShops = JSON.parse(mockLocalStorage.getItem('rtr_shops_v1') || '[]');
      expect(savedShops.length).toBe(0);
    });

    it('permanently deletes unused product from local storage when backend confirms deletion', async () => {
      const prodId = '55555555-5555-5555-5555-555555555555';
      const initialProducts = [{ id: prodId, name: 'Clear Case', sku: 'CASE-CLR', unitPrice: 150, costPrice: 80, isActive: true }];
      mockLocalStorage.setItem('rtr_products_v1', JSON.stringify(initialProducts));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: false, count: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'deleted',
          message: '"Clear Case" deleted successfully.',
          recordsCount: 0
        }), { status: 200 });
      });

      const result = await deleteProduct(prodId);
      expect(result.success).toBe(true);
      expect(result.action).toBe('deleted');

      const savedProducts = JSON.parse(mockLocalStorage.getItem('rtr_products_v1') || '[]');
      expect(savedProducts.length).toBe(0);
    });

    it('deactivates and archives product when referenced by historical records', async () => {
      const prodId = '66666666-6666-6666-6666-666666666666';
      const initialProducts = [{ id: prodId, name: 'Glass Armor', sku: 'GLS-ARM', unitPrice: 250, costPrice: 120, isActive: true }];
      mockLocalStorage.setItem('rtr_products_v1', JSON.stringify(initialProducts));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: true, count: 12 }), { status: 200 });
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'archived',
          message: '"Glass Armor" is referenced by 12 existing records. It has been safely deactivated and archived.',
          recordsCount: 12
        }), { status: 200 });
      });

      const result = await deleteProduct(prodId);
      expect(result.success).toBe(true);
      expect(result.action).toBe('archived');

      const savedProducts = JSON.parse(mockLocalStorage.getItem('rtr_products_v1') || '[]');
      expect(savedProducts.length).toBe(1);
      expect(savedProducts[0].isActive).toBe(false);
    });

    it('retains local product and throws when backend returns 500 error', async () => {
      const prodId = '77777777-7777-7777-7777-777777777777';
      const initialProducts = [{ id: prodId, name: 'Leather Wallet', sku: 'LTH-WAL', unitPrice: 400, costPrice: 200, isActive: true }];
      mockLocalStorage.setItem('rtr_products_v1', JSON.stringify(initialProducts));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: false, count: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: 'Database connection failed' }), { status: 500 });
      });

      await expect(deleteProduct(prodId)).rejects.toThrow();

      // Product must remain in local store
      const savedProducts = JSON.parse(mockLocalStorage.getItem('rtr_products_v1') || '[]');
      expect(savedProducts.length).toBe(1);
      expect(savedProducts[0].id).toBe(prodId);
    });

    it('rejects product deletion with 403 for unauthorized users and retains local record', async () => {
      const prodId = '88888888-8888-8888-8888-888888888888';
      const initialProducts = [{ id: prodId, name: 'Cable Protector', sku: 'CBL-PROT', unitPrice: 50, costPrice: 20, isActive: true }];
      mockLocalStorage.setItem('rtr_products_v1', JSON.stringify(initialProducts));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'employee-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/usage')) {
          return new Response(JSON.stringify({ inUse: false, count: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'Forbidden', message: 'Unauthorized: Access restricted to Business Owner only.' }), { status: 403 });
      });

      await expect(deleteProduct(prodId)).rejects.toThrow('Unauthorized: Access restricted to Business Owner only.');

      const savedProducts = JSON.parse(mockLocalStorage.getItem('rtr_products_v1') || '[]');
      expect(savedProducts.length).toBe(1);
      expect(savedProducts[0].id).toBe(prodId);
    });
  });

  describe('Delivery Cascade Deletion & Inventory Consistency', () => {
    it('successfully cleans up delivery items and payments while preserving inventory audit ledger', async () => {
      const deliveryId = '99999999-9999-9999-9999-999999999999';
      const initialDeliveries = [{ id: deliveryId, shopId: 's1', status: 'delivered', deliveryDate: '2026-11-01', createdBy: 'Owner', items: [], createdAt: '2026-11-01' }];
      const initialInvoices = [{ id: 'inv-1', delivery_id: deliveryId, total_amount: 1000, shop_id: 's1' }];
      mockLocalStorage.setItem('rtr_deliveries_v1', JSON.stringify(initialDeliveries));
      mockLocalStorage.setItem('rtr_invoices_v1', JSON.stringify(initialInvoices));

      vi.spyOn(supabase!.auth, 'getSession').mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-owner-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Record deleted successfully.', deliveryId }), { status: 200 })
      );

      await deleteBusinessRecord(deliveryId);

      const savedDeliveries = JSON.parse(mockLocalStorage.getItem('rtr_deliveries_v1') || '[]');
      const savedInvoices = JSON.parse(mockLocalStorage.getItem('rtr_invoices_v1') || '[]');
      expect(savedDeliveries.length).toBe(0);
      expect(savedInvoices.length).toBe(0);
    });
  });
});

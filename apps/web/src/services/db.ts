import { 
  type StockBalance, 
  type Invoice, 
  type PaymentRecord, 
  type ProductCategory,
  type ShopBusinessSummary,
  type ProductHistoryItem,
  type CategorySalesAnalytics,
  type TimelineEvent,
  calculatePaymentStatus,
  calculateGrossProfit,
  isDatabaseCapacityError,
  DatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  getRecordPriority,
  compareBusinessRecords,
  sortBusinessRecords,
  type RecordPriorityRank,
  type RecordPriorityInput,
  type RecordSortField,
  type RecordSortDirection,
  SaveBusinessRecordSchema,
  UpdateBusinessRecordSchema,
  SettlePaymentSchema
} from '@crimpston/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export {
  isDatabaseCapacityError,
  DatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  getRecordPriority,
  compareBusinessRecords,
  sortBusinessRecords,
  type RecordPriorityRank,
  type RecordPriorityInput,
  type RecordSortField,
  type RecordSortDirection
};

export interface Shop {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  assignedEmployees: string[];
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  minStock: number;
  unitPrice?: number;
  costPrice?: number | null;
  isActive: boolean;
  createdAt?: string;
}

export interface DeliveryItemRecord {
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  unitPrice?: number;
}

export interface DeliveryRecord {
  id: string;
  shopId: string;
  shopName?: string;
  deliveryDate: string;
  status: 'delivered' | 'pending' | 'cancelled';
  notes?: string;
  createdBy: string;
  items: DeliveryItemRecord[];
  pendingAmount?: number;
  createdAt: string;
}

export interface BusinessRecord {
  id: string;
  deliveryId: string;
  date: string;
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  deliveryStatus: 'delivered' | 'pending' | 'cancelled';
  pendingAmount: number;
  notes?: string;
  createdAt: string;
}

export interface SaveBusinessRecordInput {
  date: string;
  shopName: string;
  shopId?: string;
  productName: string;
  productId?: string;
  quantity?: number;
  unitPrice: number;
  deliveryStatus?: 'delivered' | 'pending' | 'cancelled';
  pendingAmount?: number;
  paidAmount?: number;
  notes?: string;
}

export interface DailyReportItemRecord {
  productId: string;
  productName?: string;
  quantitySold: number;
  physicalCount?: number | null;
}

export interface DailyReportRecord {
  id: string;
  shopId: string;
  shopName?: string;
  reportDate: string;
  isZeroSales: boolean;
  status: 'submitted' | 'approved' | 'rejected';
  submittedBy: string;
  submittedAt: string;
  notes?: string;
  items: DailyReportItemRecord[];
  totalQuantitySold: number;
  createdAt: string;
}

export interface StockTransferRecord {
  id: string;
  fromShopId: string;
  fromShopName?: string;
  toShopId: string;
  toShopName?: string;
  productId: string;
  productName?: string;
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface StockAuditRecord {
  id: string;
  shopId: string;
  productId: string;
  physicalCount: number;
  expectedCount: number;
  discrepancy: number;
  countedAt: string;
  notes?: string;
}

const STORAGE_KEYS = {
  SHOPS: 'rtr_shops_v1',
  PRODUCTS: 'rtr_products_v1',
  DELIVERIES: 'rtr_deliveries_v1',
  REPORTS: 'rtr_reports_v1',
  TRANSFERS: 'rtr_transfers_v1',
  AUDITS: 'rtr_audits_v1',
  INVOICES: 'rtr_invoices_v1',
  PAYMENTS: 'rtr_payments_v1'
} as const;

export const DEMO_STORAGE_KEYS = {
  SHOPS: 'rtr_demo_shops_v1',
  PRODUCTS: 'rtr_demo_products_v1',
  DELIVERIES: 'rtr_demo_deliveries_v1',
  INVOICES: 'rtr_demo_invoices_v1',
  PAYMENTS: 'rtr_demo_payments_v1'
} as const;

export const DEFAULT_DEMO_SHOPS: Shop[] = [
  {
    id: 'demo-shop-1',
    name: '[DEMO] Apex Cellular - T. Nagar',
    code: 'DEMO-APX',
    address: '12 North Usman Road, T. Nagar, Chennai',
    phone: '+91 98400 11223',
    isActive: true,
    assignedEmployees: []
  },
  {
    id: 'demo-shop-2',
    name: '[DEMO] Supreme Mobiles - Velachery',
    code: 'DEMO-SUP',
    address: '45 100 Feet Bypass Road, Velachery, Chennai',
    phone: '+91 98400 22334',
    isActive: true,
    assignedEmployees: []
  },
  {
    id: 'demo-shop-3',
    name: '[DEMO] Metro Mobile Hub - Tambaram',
    code: 'DEMO-MTR',
    address: '88 GST Road, Tambaram Sanatorium, Chennai',
    phone: '+91 98400 33445',
    isActive: true,
    assignedEmployees: []
  },
  {
    id: 'demo-shop-4',
    name: '[DEMO] Royal Phone Gallery - Anna Nagar',
    code: 'DEMO-RYL',
    address: '2nd Avenue, Anna Nagar, Chennai',
    phone: '+91 98400 44556',
    isActive: true,
    assignedEmployees: []
  }
];

export const DEFAULT_DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-prod-1',
    name: '[DEMO] 65W GaN Fast Charger (Type-C)',
    sku: 'DEMO-CHG-65W',
    category: 'Chargers & Adapters',
    minStock: 25,
    unitPrice: 850,
    costPrice: 520,
    isActive: true
  },
  {
    id: 'demo-prod-2',
    name: '[DEMO] Magnetic Wireless Power Bank 10000mAh',
    sku: 'DEMO-PB-10K',
    category: 'Power Banks',
    minStock: 15,
    unitPrice: 1400,
    costPrice: 890,
    isActive: true
  },
  {
    id: 'demo-prod-3',
    name: '[DEMO] Shockproof Matte Silicone Case',
    sku: 'DEMO-CS-MATTE',
    category: 'Mobile Cases',
    minStock: 50,
    unitPrice: 180,
    costPrice: 75,
    isActive: true
  },
  {
    id: 'demo-prod-4',
    name: '[DEMO] 9H Edge-to-Edge Tempered Glass',
    sku: 'DEMO-TMP-9H',
    category: 'Tempered Glass',
    minStock: 100,
    unitPrice: 120,
    costPrice: 45,
    isActive: true
  },
  {
    id: 'demo-prod-5',
    name: '[DEMO] Heavy Duty Braided Type-C Cable 1.5m',
    sku: 'DEMO-CBL-TYPC',
    category: 'USB Cables',
    minStock: 60,
    unitPrice: 250,
    costPrice: 110,
    isActive: true
  }
];

import { isDemoMode, setDemoMode as baseSetDemoMode } from './demoMode.js';
export { isDemoMode };

export function setDemoMode(active: boolean): void {
  clearMemoryCache();
  baseSetDemoMode(active);
}

export function resetDemoData(): void {
  const today = new Date().toISOString().split('T')[0] || '2026-10-24';
  const dMinus1 = new Date(Date.now() - 86400000).toISOString().split('T')[0] || '2026-10-23';
  const dMinus2 = new Date(Date.now() - 172800000).toISOString().split('T')[0] || '2026-10-22';
  const dMinus3 = new Date(Date.now() - 259200000).toISOString().split('T')[0] || '2026-10-21';

  const demoDeliveries: DeliveryRecord[] = [
    {
      id: 'demo-deliv-1',
      shopId: 'demo-shop-1',
      shopName: '[DEMO] Apex Cellular - T. Nagar',
      deliveryDate: today,
      status: 'pending',
      notes: JSON.stringify({
        memo: 'Sample pending delivery order awaiting dispatch and cash collection',
        totalAmount: 17000,
        paidAmount: 0,
        pendingAmount: 17000,
        items: [{
          productId: 'demo-prod-1',
          productName: '[DEMO] 65W GaN Fast Charger (Type-C)',
          quantity: 20,
          unitPrice: 850
        }]
      }),
      createdBy: 'demo-owner',
      items: [{
        productId: 'demo-prod-1',
        productName: '[DEMO] 65W GaN Fast Charger (Type-C)',
        quantity: 20,
        unitPrice: 850
      }],
      pendingAmount: 17000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-deliv-2',
      shopId: 'demo-shop-2',
      shopName: '[DEMO] Supreme Mobiles - Velachery',
      deliveryDate: dMinus1,
      status: 'delivered',
      notes: JSON.stringify({
        memo: 'Initial token received via UPI; balance of ₹8,000 due next week',
        totalAmount: 14000,
        paidAmount: 6000,
        pendingAmount: 8000,
        items: [{
          productId: 'demo-prod-2',
          productName: '[DEMO] Magnetic Wireless Power Bank 10000mAh',
          quantity: 10,
          unitPrice: 1400
        }]
      }),
      createdBy: 'demo-owner',
      items: [{
        productId: 'demo-prod-2',
        productName: '[DEMO] Magnetic Wireless Power Bank 10000mAh',
        quantity: 10,
        unitPrice: 1400
      }],
      pendingAmount: 8000,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'demo-deliv-3',
      shopId: 'demo-shop-3',
      shopName: '[DEMO] Metro Mobile Hub - Tambaram',
      deliveryDate: dMinus2,
      status: 'delivered',
      notes: JSON.stringify({
        memo: 'Stock delivered yesterday; payment terms 7-day credit',
        totalAmount: 9000,
        paidAmount: 0,
        pendingAmount: 9000,
        items: [{
          productId: 'demo-prod-3',
          productName: '[DEMO] Shockproof Matte Silicone Case',
          quantity: 50,
          unitPrice: 180
        }]
      }),
      createdBy: 'demo-owner',
      items: [{
        productId: 'demo-prod-3',
        productName: '[DEMO] Shockproof Matte Silicone Case',
        quantity: 50,
        unitPrice: 180
      }],
      pendingAmount: 9000,
      createdAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: 'demo-deliv-4',
      shopId: 'demo-shop-4',
      shopName: '[DEMO] Royal Phone Gallery - Anna Nagar',
      deliveryDate: dMinus3,
      status: 'delivered',
      notes: JSON.stringify({
        memo: 'Bulk delivery settled in full via NEFT',
        totalAmount: 12000,
        paidAmount: 12000,
        pendingAmount: 0,
        items: [{
          productId: 'demo-prod-4',
          productName: '[DEMO] 9H Edge-to-Edge Tempered Glass',
          quantity: 100,
          unitPrice: 120
        }]
      }),
      createdBy: 'demo-owner',
      items: [{
        productId: 'demo-prod-4',
        productName: '[DEMO] 9H Edge-to-Edge Tempered Glass',
        quantity: 100,
        unitPrice: 120
      }],
      pendingAmount: 0,
      createdAt: new Date(Date.now() - 259200000).toISOString()
    }
  ];

  setLocalItem(DEMO_STORAGE_KEYS.SHOPS, DEFAULT_DEMO_SHOPS);
  setLocalItem(DEMO_STORAGE_KEYS.PRODUCTS, DEFAULT_DEMO_PRODUCTS);
  setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, demoDeliveries);
  setLocalItem(DEMO_STORAGE_KEYS.INVOICES, []);
  setLocalItem(DEMO_STORAGE_KEYS.PAYMENTS, []);
  clearMemoryCache();
}

export function ensureDemoData(): void {
  const existing = getLocalItem<Shop[]>(DEMO_STORAGE_KEYS.SHOPS, []);
  if (!existing || existing.length === 0) {
    resetDemoData();
  }
}

// In-memory fallback for non-browser environments / tests
const nodeMemoryStore = new Map<string, string>();

// Helper for local persistent storage
function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage === 'undefined') {
      const raw = nodeMemoryStore.get(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw);
    }
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

// Silent local caching - does NOT trigger 'rtr_data_sync' event storm
function setLocalCache<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') {
      nodeMemoryStore.set(key, JSON.stringify(value));
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error saving cache for ${key}:`, err);
  }
}

// In-memory cache & in-flight request deduplication
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const memCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 2500; // 2.5 seconds cache TTL

export function clearMemoryCache(): void {
  memCache.clear();
  inFlightRequests.clear();
}

async function dedupeRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      memCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

// Mutate local storage and notify listeners of data change (ONLY on user mutations)
function setLocalItem<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      nodeMemoryStore.set(key, JSON.stringify(value));
    }
    clearMemoryCache();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rtr_data_sync', { detail: { key } }));
    }
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

// Supabase network timeout wrapper for responsive fallback
async function withTimeout<T = any>(promise: Promise<T> | any, timeoutMs = 800): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Supabase network timeout')), timeoutMs);
  });
  try {
    return (await Promise.race([Promise.resolve(promise), timeoutPromise])) as T;
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_BUSINESS_ID = '4fba6fb7-4e1b-4106-ac84-908f821d73c3';
let cachedBusinessId: string | null = null;

/**
 * Retrieves a fresh, verified access token from the active Supabase session.
 * If the current token is close to expiry (within 60s) or expired, refreshes it automatically.
 * If session is missing or unrefreshable, dispatches 'rtr:session-expired' and returns null.
 */
export async function getValidAuthToken(): Promise<string | null> {
  if (isDemoMode()) return null;
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr:session-expired'));
      }
      return null;
    }

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    // If expired or expiring within 60 seconds, refresh session
    if (expiresAt && expiresAt - now < 60000) {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshData.session?.access_token) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rtr:session-expired'));
        }
        return null;
      }
      return refreshData.session.access_token;
    }

    return session.access_token;
  } catch {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rtr:session-expired'));
    }
    return null;
  }
}

/**
 * Performs an authenticated fetch against the RTR backend API.
 * Ensures the Authorization Bearer header contains a verified, valid access token.
 * If unauthorized (401), automatically attempts a session refresh once and retries.
 * If refresh fails or returns 401 again, dispatches 'rtr:session-expired' and throws an error.
 */
export async function authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getValidAuthToken();
  if (!token) {
    throw new Error('Invalid or expired session token.');
  }

  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && isSupabaseConfigured && supabase) {
    try {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshData.session?.access_token) {
        const retryHeaders = new Headers(init?.headers || {});
        retryHeaders.set('Authorization', `Bearer ${refreshData.session.access_token}`);
        if (!retryHeaders.has('Content-Type') && init?.body && typeof init.body === 'string') {
          retryHeaders.set('Content-Type', 'application/json');
        }
        res = await fetch(url, { ...init, headers: retryHeaders });
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rtr:session-expired'));
        }
        throw new Error('Invalid or expired session token.');
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr:session-expired'));
      }
      throw new Error('Invalid or expired session token.');
    }
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rtr:session-expired'));
    }
    throw new Error('Invalid or expired session token.');
  }

  return res;
}

export async function ensureAuthenticatedSession(): Promise<string> {
  if (isDemoMode()) {
    return 'demo-user-00000000-0000-0000-0000-000000000000';
  }

  if (!isSupabaseConfigured || !supabase) {
    return 'b46689e9-754e-49b5-b79b-ebc1ee42538f';
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Could not establish Supabase auth session');
    }
  }

  return 'b46689e9-754e-49b5-b79b-ebc1ee42538f';
}

async function getBusinessId(): Promise<string> {
  if (cachedBusinessId) return cachedBusinessId;
  if (isSupabaseConfigured && supabase) {
    try {
      await ensureAuthenticatedSession();
      const { data } = await withTimeout(
        supabase.from('businesses').select('id').limit(1).maybeSingle(),
        5000
      );
      if (data?.id) {
        cachedBusinessId = data.id;
        return data.id;
      }
    } catch (e) {
      console.warn('Failed to resolve business id:', e);
    }
  }
  return DEFAULT_BUSINESS_ID;
}

async function getCurrentUserId(): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    try {
      const userId = await ensureAuthenticatedSession();
      if (userId) return userId;
    } catch (e) {
      console.warn('Failed to resolve current user id:', e);
    }
  }
  return 'b46689e9-754e-49b5-b79b-ebc1ee42538f';
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// ----------------------------------------------------
// SHOPS
// ----------------------------------------------------
export async function getShops(): Promise<Shop[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return getLocalItem<Shop[]>(DEMO_STORAGE_KEYS.SHOPS, DEFAULT_DEMO_SHOPS);
  }

  return dedupeRequest('shops', async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await ensureAuthenticatedSession();
        const { data, error } = await withTimeout(
          supabase
            .from('shops')
            .select('id, name, code, address, phone, is_active, created_at')
            .order('name'),
          6000
        );
        if (!error && Array.isArray(data)) {
          const nonDemo = data.filter((s: any) => !s.code?.toUpperCase().startsWith('DEMO') && !s.name?.startsWith('DEMO -'));
          const shops: Shop[] = nonDemo.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            address: s.address || '',
            phone: s.phone || '',
            isActive: s.is_active ?? true,
            assignedEmployees: [],
            createdAt: s.created_at
          }));
          setLocalCache(STORAGE_KEYS.SHOPS, shops);
          return shops;
        }
      } catch (err) {
        console.warn('Supabase getShops error, using local fallback:', err);
      }
    }
    const local = getLocalItem<Shop[]>(STORAGE_KEYS.SHOPS, []);
    return local.filter(s => !s.code?.toUpperCase().startsWith('DEMO') && !s.name?.startsWith('DEMO -'));
  });
}

export async function saveShop(input: Omit<Shop, 'id'> & { id?: string }): Promise<Shop> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    ensureDemoData();
    const shops = getLocalItem<Shop[]>(DEMO_STORAGE_KEYS.SHOPS, DEFAULT_DEMO_SHOPS);
    if (input.id) {
      const updated = shops.map(s => s.id === input.id ? { ...s, ...input } : s);
      setLocalItem(DEMO_STORAGE_KEYS.SHOPS, updated);
      return updated.find(s => s.id === input.id)!;
    }
    const rawCode = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'DEMO');
    const newShop: Shop = {
      ...input,
      code: input.code || `DEMO-${rawCode}-${Date.now().toString().slice(-4)}`,
      id: generateId('demo-shop'),
      createdAt: now
    };
    setLocalItem(DEMO_STORAGE_KEYS.SHOPS, [...shops, newShop]);
    return newShop;
  }

  const shops = await getShops();

  if (isSupabaseConfigured && supabase) {
    try {
      await ensureAuthenticatedSession();
      const businessId = await getBusinessId();
      const userId = await getCurrentUserId();

      if (input.id && !input.id.startsWith('shop-')) {
        const { data, error } = await supabase
          .from('shops')
          .update({
            name: input.name,
            code: input.code,
            address: input.address,
            phone: input.phone,
            is_active: input.isActive,
            updated_at: now
          })
          .eq('id', input.id)
          .select()
          .single();

        if (!error && data) {
          const updated: Shop = {
            id: data.id,
            name: data.name,
            code: data.code,
            address: data.address || '',
            phone: data.phone || '',
            isActive: data.is_active ?? true,
            assignedEmployees: input.assignedEmployees || [],
            createdAt: data.created_at
          };
          const next = shops.map(s => s.id === updated.id ? updated : s);
          setLocalItem(STORAGE_KEYS.SHOPS, next);
          return updated;
        }
      } else {
        const rawCode = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP');
        const code = input.code || `SH-${rawCode}-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase
          .from('shops')
          .insert({
            business_id: businessId,
            name: input.name,
            code,
            address: input.address || '',
            phone: input.phone || '',
            is_active: input.isActive ?? true
          })
          .select()
          .single();

        if (error) {
          if (isDatabaseCapacityError(error)) {
            throw new DatabaseCapacityError(error.message, error.code);
          }
        }

        if (!error && data) {
          // Assign creator to shop_memberships so RLS policies allow report operations
          try {
            await supabase.from('shop_memberships').insert({
              shop_id: data.id,
              user_id: userId
            });
          } catch {
            // Already member
          }

          const created: Shop = {
            id: data.id,
            name: data.name,
            code: data.code,
            address: data.address || '',
            phone: data.phone || '',
            isActive: data.is_active ?? true,
            assignedEmployees: input.assignedEmployees || [],
            createdAt: data.created_at
          };
          setLocalItem(STORAGE_KEYS.SHOPS, [...shops, created]);
          return created;
        }
      }
    } catch (err) {
      if (isDatabaseCapacityError(err)) {
        throw (err instanceof DatabaseCapacityError) ? err : new DatabaseCapacityError((err as any)?.message, (err as any)?.code);
      }
      console.warn('Supabase saveShop error, using local fallback:', err);
    }
  }

  if (input.id) {
    const updated = shops.map(s => s.id === input.id ? { ...s, ...input } : s);
    setLocalItem(STORAGE_KEYS.SHOPS, updated);
    return updated.find(s => s.id === input.id)!;
  }

  const rawCode = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP');
  const newShop: Shop = {
    ...input,
    code: input.code || `SH-${rawCode}-${Date.now().toString().slice(-4)}`,
    id: generateId('shop'),
    createdAt: now
  };
  setLocalItem(STORAGE_KEYS.SHOPS, [...shops, newShop]);
  return newShop;
}

export interface DeleteCatalogResult {
  success: boolean;
  action: 'archived' | 'deleted';
  message: string;
  inUse?: boolean;
  recordsCount?: number;
}

export async function checkShopUsage(id: string): Promise<{ inUse: boolean; count: number }> {
  if (isDemoMode()) {
    const demoDeliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const count = demoDeliveries.filter(d => d.shopId === id).length;
    return { inUse: count > 0, count };
  }

  if (isSupabaseConfigured && supabase && !id.startsWith('shop-')) {
    try {
      const res = await authenticatedFetch(`/api/shops/${encodeURIComponent(id)}/usage`);
      if (res.ok) {
        const data = await res.json();
        return { inUse: !!data.inUse, count: data.count || 0 };
      }
    } catch (err: any) {
      if (err.message?.includes('session token')) {
        throw err;
      }
      console.warn('checkShopUsage API error, falling back to direct Supabase query:', err);
    }

    try {
      await ensureAuthenticatedSession();
      const [delivRes, moveRes, invRes, repRes, transFromRes, transToRes] = await Promise.all([
        supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('shop_id', id),
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('shop_id', id),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('shop_id', id),
        supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('shop_id', id),
        supabase.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('from_shop_id', id),
        supabase.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('to_shop_id', id)
      ]);
      const totalCount = (delivRes.count || 0) + 
                         (moveRes.count || 0) + 
                         (invRes.count || 0) + 
                         (repRes.count || 0) + 
                         (transFromRes.count || 0) + 
                         (transToRes.count || 0);
      return { inUse: totalCount > 0, count: totalCount };
    } catch (supErr) {
      console.warn('Direct Supabase checkShopUsage error:', supErr);
    }
  }

  const deliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
  const count = deliveries.filter(d => d.shopId === id).length;
  return { inUse: count > 0, count };
}

export async function deleteShop(id: string): Promise<DeleteCatalogResult> {
  const usage = await checkShopUsage(id);

  if (isDemoMode()) {
    const shops = getLocalItem<Shop[]>(DEMO_STORAGE_KEYS.SHOPS, DEFAULT_DEMO_SHOPS);
    const targetShop = shops.find(s => s.id === id);
    const shopName = targetShop?.name || 'Shop';

    if (usage.inUse) {
      const updated = shops.map(s => s.id === id ? { ...s, isActive: false } : s);
      setLocalItem(DEMO_STORAGE_KEYS.SHOPS, updated);
      return {
        success: true,
        action: 'archived',
        message: `"${shopName}" is referenced by ${usage.count} existing records. It has been safely deactivated and archived.`,
        inUse: true,
        recordsCount: usage.count
      };
    } else {
      setLocalItem(DEMO_STORAGE_KEYS.SHOPS, shops.filter(s => s.id !== id));
      return {
        success: true,
        action: 'deleted',
        message: `"${shopName}" deleted successfully.`,
        inUse: false,
        recordsCount: 0
      };
    }
  }

  const shops = await getShops();
  const targetShop = shops.find(s => s.id === id);
  const shopName = targetShop?.name || 'Shop';

  // 1. Authoritative Backend Endpoint (/api/shops/:id) with direct Supabase safe fallback
  if (isSupabaseConfigured && supabase && !id.startsWith('shop-')) {
    let apiSuccess = false;
    let serverResult: DeleteCatalogResult | null = null;

    try {
      const res = await authenticatedFetch(`/api/shops/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const json = await res.json();
        apiSuccess = true;
        serverResult = {
          success: true,
          action: json.action || (usage.inUse ? 'archived' : 'deleted'),
          message: json.message || `"${shopName}" deleted successfully.`,
          inUse: json.action === 'archived' || usage.inUse,
          recordsCount: json.recordsCount ?? usage.count
        };
      } else if (res.status === 401 || res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Unauthorized: Access restricted to Business Owner only.');
      }
    } catch (apiErr: any) {
      if (apiErr.message?.includes('Unauthorized') || apiErr.message?.includes('restricted') || apiErr.message?.includes('session token')) {
        throw apiErr;
      }
      console.warn('API /api/shops/:id failed, attempting direct Supabase mutation:', apiErr);
    }

    if (!apiSuccess) {
      await ensureAuthenticatedSession();
      if (usage.inUse) {
        // Safe archival preserving append-only immutable stock_movements ledger (NEVER raises 23505 conflict)
        const { error: archErr } = await supabase
          .from('shops')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (archErr) throw new Error(archErr.message || 'Database rejected shop archive.');
        serverResult = {
          success: true,
          action: 'archived',
          message: `"${shopName}" is referenced by ${usage.count} historical records. It has been safely deactivated and archived.`,
          inUse: true,
          recordsCount: usage.count
        };
      } else {
        await supabase.from('shop_memberships').delete().eq('shop_id', id);
        const { error: delErr } = await supabase.from('shops').delete().eq('id', id);
        if (delErr) throw new Error(delErr.message || 'Database rejected shop deletion.');
        serverResult = {
          success: true,
          action: 'deleted',
          message: `"${shopName}" deleted successfully.`,
          inUse: false,
          recordsCount: 0
        };
      }
    }

    if (serverResult) {
      if (serverResult.action === 'archived') {
        const next = shops.map(s => s.id === id ? { ...s, isActive: false } : s);
        setLocalItem(STORAGE_KEYS.SHOPS, next);
      } else {
        setLocalItem(STORAGE_KEYS.SHOPS, shops.filter(s => s.id !== id));
      }
      clearMemoryCache();
      return serverResult;
    }
  }

  // Purely offline/mock fallback if Supabase is not configured
  if (usage.inUse) {
    const next = shops.map(s => s.id === id ? { ...s, isActive: false } : s);
    setLocalItem(STORAGE_KEYS.SHOPS, next);
    return {
      success: true,
      action: 'archived',
      message: `"${shopName}" is referenced by existing records. It has been safely archived.`,
      inUse: true,
      recordsCount: usage.count
    };
  } else {
    setLocalItem(STORAGE_KEYS.SHOPS, shops.filter(s => s.id !== id));
    return {
      success: true,
      action: 'deleted',
      message: `"${shopName}" deleted successfully.`,
      inUse: false,
      recordsCount: 0
    };
  }
}

// ----------------------------------------------------
// PRODUCTS
// ----------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return getLocalItem<Product[]>(DEMO_STORAGE_KEYS.PRODUCTS, DEFAULT_DEMO_PRODUCTS);
  }

  return dedupeRequest('products', async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await ensureAuthenticatedSession();
        const { data, error } = await withTimeout(
          supabase
            .from('products')
            .select('id, name, sku, category, min_stock_threshold, is_active, created_at')
            .order('name'),
          6000
        );
        if (!error && Array.isArray(data)) {
          const nonDemo = data.filter((p: any) => !p.sku?.toUpperCase().startsWith('DEMO') && !p.name?.startsWith('DEMO -'));
          const localProds = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
          const localMap = new Map(localProds.map(p => [p.id, p]));

          const prods: Product[] = nonDemo.map((p: any) => {
            const local = localMap.get(p.id);
            return {
              id: p.id,
              name: p.name,
              sku: p.sku,
              category: p.category as ProductCategory,
              minStock: p.min_stock_threshold || 0,
              unitPrice: p.unit_price ?? local?.unitPrice ?? 0,
              costPrice: p.cost_price ?? local?.costPrice ?? null,
              isActive: p.is_active ?? true,
              createdAt: p.created_at
            };
          });
          setLocalCache(STORAGE_KEYS.PRODUCTS, prods);
          return prods;
        }
      } catch (err) {
        console.warn('Supabase getProducts error, using local fallback:', err);
      }
    }
    const local = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    return local.filter(p => !p.sku?.toUpperCase().startsWith('DEMO') && !p.name?.startsWith('DEMO -'));
  });
}

export async function saveProduct(input: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    ensureDemoData();
    const products = getLocalItem<Product[]>(DEMO_STORAGE_KEYS.PRODUCTS, DEFAULT_DEMO_PRODUCTS);
    if (input.id) {
      const updated = products.map(p => p.id === input.id ? { ...p, ...input } : p);
      setLocalItem(DEMO_STORAGE_KEYS.PRODUCTS, updated);
      return updated.find(p => p.id === input.id)!;
    }
    const rawSku = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'DEMO');
    const newProd: Product = {
      ...input,
      sku: input.sku || `DEMO-SKU-${rawSku}-${Date.now().toString().slice(-4)}`,
      category: input.category || 'Other Accessories',
      unitPrice: input.unitPrice ?? 0,
      costPrice: input.costPrice ?? null,
      id: generateId('demo-prod'),
      createdAt: now
    };
    setLocalItem(DEMO_STORAGE_KEYS.PRODUCTS, [...products, newProd]);
    return newProd;
  }

  const products = await getProducts();

  if (isSupabaseConfigured && supabase) {
    try {
      await ensureAuthenticatedSession();
      const businessId = await getBusinessId();

      if (input.id && !input.id.startsWith('prod-')) {
        const { data, error } = await supabase
          .from('products')
          .update({
            name: input.name,
            sku: input.sku,
            category: input.category,
            min_stock_threshold: input.minStock,
            is_active: input.isActive,
            updated_at: now
          })
          .eq('id', input.id)
          .select()
          .single();

        if (!error && data) {
          const updated: Product = {
            id: data.id,
            name: data.name,
            sku: data.sku,
            category: data.category as ProductCategory,
            minStock: data.min_stock_threshold || 0,
            unitPrice: input.unitPrice ?? 0,
            costPrice: input.costPrice ?? null,
            isActive: data.is_active ?? true,
            createdAt: data.created_at
          };
          const next = products.map(p => p.id === updated.id ? updated : p);
          setLocalItem(STORAGE_KEYS.PRODUCTS, next);
          return updated;
        }
      } else {
        const rawSku = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ACC');
        const sku = input.sku || `SKU-${rawSku}-${Date.now().toString().slice(-4)}`;
        const category = input.category || 'Other Accessories';
        const { data, error } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: input.name,
            sku,
            category,
            unit_of_measure: 'piece',
            min_stock_threshold: input.minStock || 0,
            is_active: input.isActive ?? true
          })
          .select()
          .single();

        if (error) {
          if (isDatabaseCapacityError(error)) {
            throw new DatabaseCapacityError(error.message, error.code);
          }
        }

        if (!error && data) {
          const created: Product = {
            id: data.id,
            name: data.name,
            sku: data.sku,
            category: data.category as ProductCategory,
            minStock: data.min_stock_threshold || 0,
            unitPrice: input.unitPrice ?? 0,
            costPrice: input.costPrice ?? null,
            isActive: data.is_active ?? true,
            createdAt: data.created_at
          };
          setLocalItem(STORAGE_KEYS.PRODUCTS, [...products, created]);
          return created;
        }
      }
    } catch (err) {
      if (isDatabaseCapacityError(err)) {
        throw (err instanceof DatabaseCapacityError) ? err : new DatabaseCapacityError((err as any)?.message, (err as any)?.code);
      }
      console.warn('Supabase saveProduct error, using local fallback:', err);
    }
  }

  if (input.id) {
    const updated = products.map(p => p.id === input.id ? { ...p, ...input } : p);
    setLocalItem(STORAGE_KEYS.PRODUCTS, updated);
    return updated.find(p => p.id === input.id)!;
  }

  const rawSku = (input.name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ACC');
  const newProd: Product = {
    ...input,
    sku: input.sku || `SKU-${rawSku}-${Date.now().toString().slice(-4)}`,
    category: input.category || 'Other Accessories',
    unitPrice: input.unitPrice ?? 0,
    costPrice: input.costPrice ?? null,
    id: generateId('prod'),
    createdAt: now
  };
  setLocalItem(STORAGE_KEYS.PRODUCTS, [...products, newProd]);
  return newProd;
}

export async function checkProductUsage(id: string): Promise<{ inUse: boolean; count: number }> {
  if (isDemoMode()) {
    const demoDeliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const count = demoDeliveries.filter(d => d.items?.some(i => i.productId === id)).length;
    return { inUse: count > 0, count };
  }

  if (isSupabaseConfigured && supabase && !id.startsWith('prod-')) {
    try {
      const res = await authenticatedFetch(`/api/products/${encodeURIComponent(id)}/usage`);
      if (res.ok) {
        const data = await res.json();
        return { inUse: !!data.inUse, count: data.count || 0 };
      }
    } catch (err: any) {
      if (err.message?.includes('session token')) {
        throw err;
      }
      console.warn('checkProductUsage API error, falling back to direct Supabase query:', err);
    }

    try {
      await ensureAuthenticatedSession();
      const [delivRes, moveRes, repRes, transRes] = await Promise.all([
        supabase.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id),
        supabase.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        supabase.from('stock_transfer_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
      ]);
      const totalCount = (delivRes.count || 0) + (moveRes.count || 0) + (repRes.count || 0) + (transRes.count || 0);
      return { inUse: totalCount > 0, count: totalCount };
    } catch (dbErr) {
      console.warn('Direct Supabase product usage check error:', dbErr);
    }
  }

  const deliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
  const count = deliveries.filter(d => d.items?.some(i => i.productId === id)).length;
  return { inUse: count > 0, count };
}

export async function deleteProduct(id: string): Promise<DeleteCatalogResult> {
  const usage = await checkProductUsage(id);

  if (isDemoMode()) {
    const products = getLocalItem<Product[]>(DEMO_STORAGE_KEYS.PRODUCTS, DEFAULT_DEMO_PRODUCTS);
    const targetProduct = products.find(p => p.id === id);
    const prodName = targetProduct?.name || 'Product';

    if (usage.inUse) {
      const updated = products.map(p => p.id === id ? { ...p, isActive: false } : p);
      setLocalItem(DEMO_STORAGE_KEYS.PRODUCTS, updated);
      return {
        success: true,
        action: 'archived',
        message: `"${prodName}" is referenced by ${usage.count} existing records. It has been safely deactivated and archived.`,
        inUse: true,
        recordsCount: usage.count
      };
    } else {
      setLocalItem(DEMO_STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
      return {
        success: true,
        action: 'deleted',
        message: `"${prodName}" deleted successfully.`,
        inUse: false,
        recordsCount: 0
      };
    }
  }

  const products = await getProducts();
  const targetProduct = products.find(p => p.id === id);
  const prodName = targetProduct?.name || 'Product';

  // 1. Authoritative Backend Endpoint (/api/products/:id) with direct Supabase safe fallback
  if (isSupabaseConfigured && supabase && !id.startsWith('prod-')) {
    let apiSuccess = false;
    let serverResult: DeleteCatalogResult | null = null;

    try {
      const res = await authenticatedFetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const json = await res.json();
        apiSuccess = true;
        serverResult = {
          success: true,
          action: json.action || (usage.inUse ? 'archived' : 'deleted'),
          message: json.message || `"${prodName}" ${usage.inUse ? 'archived' : 'deleted'} successfully.`,
          inUse: json.action === 'archived' || usage.inUse,
          recordsCount: json.recordsCount ?? usage.count
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error(errJson.message || 'Unauthorized: Access restricted to Business Owner only.');
        }
        console.warn(`DELETE /api/products/${id} failed (HTTP ${res.status}):`, errJson.message);
      }
    } catch (apiErr: any) {
      if (apiErr.message?.includes('Unauthorized') || apiErr.message?.includes('restricted') || apiErr.message?.includes('session token')) {
        throw apiErr;
      }
      console.warn('DELETE /api/products error, falling back to direct Supabase safe mutation:', apiErr);
    }

    if (apiSuccess && serverResult) {
      if (serverResult.action === 'archived') {
        const next = products.map(p => p.id === id ? { ...p, isActive: false } : p);
        setLocalItem(STORAGE_KEYS.PRODUCTS, next);
      } else {
        setLocalItem(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
      }
      return serverResult;
    }

    // Direct Supabase safe fallback
    try {
      await ensureAuthenticatedSession();
      if (usage.inUse) {
        // Safe archive: set is_active = false
        const { error: updErr } = await supabase
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updErr) throw new Error(updErr.message);

        const next = products.map(p => p.id === id ? { ...p, isActive: false } : p);
        setLocalItem(STORAGE_KEYS.PRODUCTS, next);

        return {
          success: true,
          action: 'archived',
          message: `"${prodName}" is referenced by ${usage.count} existing records. It has been safely deactivated and archived.`,
          inUse: true,
          recordsCount: usage.count
        };
      } else {
        // Safe hard delete: only if 0 records reference this product
        const { error: delErr } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (delErr) {
          // If foreign key constraint still blocks, fall back to archiving
          if (delErr.code === '23503' || delErr.code === '23505') {
            await supabase
              .from('products')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', id);

            const next = products.map(p => p.id === id ? { ...p, isActive: false } : p);
            setLocalItem(STORAGE_KEYS.PRODUCTS, next);

            return {
              success: true,
              action: 'archived',
              message: `"${prodName}" is referenced by existing history. It has been safely deactivated and archived.`,
              inUse: true,
              recordsCount: usage.count || 1
            };
          }
          throw new Error(delErr.message);
        }

        setLocalItem(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
        return {
          success: true,
          action: 'deleted',
          message: `"${prodName}" deleted successfully.`,
          inUse: false,
          recordsCount: 0
        };
      }
    } catch (dbErr: any) {
      console.error('Direct Supabase deleteProduct error:', dbErr);
      throw new Error(dbErr.message || 'Failed to delete product from database.');
    }
  }

  // Purely offline/mock fallback if Supabase is not configured
  if (usage.inUse) {
    const next = products.map(p => p.id === id ? { ...p, isActive: false } : p);
    setLocalItem(STORAGE_KEYS.PRODUCTS, next);
    return {
      success: true,
      action: 'archived',
      message: `"${prodName}" is referenced by existing records. It has been safely archived.`,
      inUse: true,
      recordsCount: usage.count
    };
  } else {
    setLocalItem(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
    return {
      success: true,
      action: 'deleted',
      message: `"${prodName}" deleted successfully.`,
      inUse: false,
      recordsCount: 0
    };
  }
}

// ----------------------------------------------------
// DELIVERIES
// ----------------------------------------------------
export async function getDeliveries(): Promise<DeliveryRecord[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
  }

  return dedupeRequest('deliveries', async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await ensureAuthenticatedSession();
        const { data, error } = await withTimeout(
          supabase
            .from('deliveries')
            .select('id, shop_id, delivery_date, status, notes, created_at, delivery_items(product_id, quantity, notes)')
            .order('delivery_date', { ascending: false }),
          6000
        );

        if (!error && Array.isArray(data)) {
          const [shops, prods, invoices] = await Promise.all([getShops(), getProducts(), getInvoices()]);
          const shopMap = new Map(shops.map(s => [s.id, s.name]));
          const prodMap = new Map(prods.map(p => [p.id, p]));
          const invMap = new Map<string, Invoice>();
          invoices.forEach(inv => {
            if (inv.delivery_id) invMap.set(inv.delivery_id, inv);
          });

          const deliveries: DeliveryRecord[] = data.map((d: any) => {
            const inv = invMap.get(d.id);
            let parsedNotes = d.notes || '';
            let metaPending: number | undefined = inv ? Number(inv.outstanding_amount) : undefined;
            let metaPaid: number | undefined = undefined;
            let metaTotal: number | undefined = undefined;
            let metaItems: any[] = [];
            const metaItemsMap = new Map<string, number>();

            try {
              if (d.notes && d.notes.startsWith('{')) {
                const meta = JSON.parse(d.notes);
                parsedNotes = meta.memo ?? meta.notes ?? '';
                if (meta.pendingAmount !== undefined && !isNaN(Number(meta.pendingAmount))) {
                  metaPending = Number(meta.pendingAmount);
                }
                if (meta.paidAmount !== undefined && !isNaN(Number(meta.paidAmount))) {
                  metaPaid = Number(meta.paidAmount);
                }
                if (meta.totalAmount !== undefined && !isNaN(Number(meta.totalAmount))) {
                  metaTotal = Number(meta.totalAmount);
                }
                if (Array.isArray(meta.items)) {
                  metaItems = meta.items;
                  meta.items.forEach((it: any) => {
                    if (it.productId && it.unitPrice !== undefined) {
                      metaItemsMap.set(it.productId, Number(it.unitPrice));
                    }
                  });
                }
              }
            } catch {
              // Plain text notes fallback
            }

            // 1. Resolve delivery line items (Supabase joined delivery_items with meta.items fallback)
            let items: DeliveryItemRecord[] = [];
            if (Array.isArray(d.delivery_items) && d.delivery_items.length > 0) {
              items = d.delivery_items.map((i: any) => {
                const metaItem = metaItems.find((m: any) => m.productId === i.product_id);
                const metaPrice = metaItemsMap.get(i.product_id);
                const notesPrice = i.notes && !isNaN(Number(i.notes)) ? Number(i.notes) : undefined;
                const unitPrice = metaPrice !== undefined 
                  ? metaPrice 
                  : (notesPrice !== undefined 
                      ? notesPrice 
                      : (Number(metaItem?.unitPrice) || prodMap.get(i.product_id)?.unitPrice || 0));
                const prod = prodMap.get(i.product_id);
                return {
                  productId: i.product_id,
                  productName: prod?.name || metaItem?.productName || 'Wholesale Accessory',
                  productSku: prod?.sku || '',
                  quantity: Number(i.quantity) || Number(metaItem?.quantity) || 1,
                  unitPrice
                };
              });
            } else if (metaItems.length > 0) {
              items = metaItems.map((m: any) => ({
                productId: m.productId,
                productName: m.productName || prodMap.get(m.productId)?.name || 'Wholesale Accessory',
                productSku: prodMap.get(m.productId)?.sku || '',
                quantity: Number(m.quantity) || 1,
                unitPrice: Number(m.unitPrice) || 0
              }));
            }

            // 2. Derive total and pending payment balances consistently
            const computedItemsTotal = items.reduce((sum, it) => sum + (it.quantity * (it.unitPrice || 0)), 0);
            const totalBilled = metaTotal !== undefined && metaTotal > 0 ? metaTotal : computedItemsTotal;

            let finalPending: number;
            if (metaPending !== undefined) {
              finalPending = metaPending;
            } else if (metaPaid !== undefined) {
              finalPending = Math.max(0, totalBilled - metaPaid);
            } else {
              finalPending = isDelivered(d.status) ? 0 : totalBilled;
            }

            return {
              id: d.id,
              shopId: d.shop_id,
              shopName: shopMap.get(d.shop_id) || 'Retail Store',
              deliveryDate: d.delivery_date,
              status: normalizeDeliveryStatus(d.status),
              notes: parsedNotes,
              createdBy: 'Business Owner',
              items,
              pendingAmount: finalPending,
              createdAt: d.created_at
            };
          });
          const nonDemoDeliveries = deliveries.filter(d => !d.shopName?.startsWith('DEMO -'));
          setLocalCache(STORAGE_KEYS.DELIVERIES, nonDemoDeliveries);
          return nonDemoDeliveries;
        }
      } catch (err) {
        console.warn('Supabase getDeliveries error, using local fallback:', err);
      }
    }
    const local = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
    return local
      .filter(d => !d.shopName?.startsWith('DEMO -'))
      .map(d => ({
        ...d,
        items: Array.isArray(d.items) ? d.items : []
      }));
  });
}

export async function recordDelivery(input: Omit<DeliveryRecord, 'id' | 'createdAt'>): Promise<DeliveryRecord> {
  if (isDemoMode()) {
    ensureDemoData();
    const deliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const newDelivery: DeliveryRecord = {
      ...input,
      id: generateId('demo-deliv'),
      createdAt: new Date().toISOString()
    };
    setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, [newDelivery, ...deliveries]);
    clearMemoryCache();
    return newDelivery;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await ensureAuthenticatedSession();
      const businessId = await getBusinessId();
      const userId = await getCurrentUserId();

      // Store pendingAmount, totalAmount, paidAmount and item details in structured metadata
      const computedItemsTotal = input.items.reduce((s, it) => s + (it.quantity * (it.unitPrice || 0)), 0);
      const pendingVal = input.pendingAmount !== undefined ? Number(input.pendingAmount) : computedItemsTotal;
      const paidVal = Math.max(0, computedItemsTotal - pendingVal);

      const meta = {
        memo: input.notes || '',
        totalAmount: computedItemsTotal,
        paidAmount: paidVal,
        pendingAmount: pendingVal,
        items: input.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        }))
      };
      const serializedNotes = JSON.stringify(meta);

      // 1. Insert delivery record with ample timeout
      const paymentStatus = pendingVal === 0 ? 'fully_paid' : (paidVal > 0 ? 'partially_paid' : 'unpaid');
      let delivData: any = null;
      let delivErr: any = null;

      // Try inserting with first-class financial columns
      const fullRes = await withTimeout(
        supabase
          .from('deliveries')
          .insert({
            business_id: businessId,
            shop_id: input.shopId,
            delivery_date: input.deliveryDate,
            status: input.status,
            total_amount: computedItemsTotal,
            amount_paid: paidVal,
            payment_status: paymentStatus,
            notes: serializedNotes,
            created_by: userId
          })
          .select()
          .single(),
        6000
      );
      delivData = fullRes.data;
      delivErr = fullRes.error;

      // If Supabase rejected because columns aren't yet migrated in database, fallback to baseline
      if (delivErr && (delivErr.message?.includes('total_amount') || delivErr.message?.includes('payment_status') || delivErr.code === '42703')) {
        const baselineRes = await withTimeout(
          supabase
            .from('deliveries')
            .insert({
              business_id: businessId,
              shop_id: input.shopId,
              delivery_date: input.deliveryDate,
              status: input.status,
              notes: serializedNotes,
              created_by: userId
            })
            .select()
            .single(),
          6000
        );
        delivData = baselineRes.data;
        delivErr = baselineRes.error;
      }

      if (delivErr) {
        console.error('Supabase recordDelivery error:', delivErr);
        if (isDatabaseCapacityError(delivErr)) {
          throw new DatabaseCapacityError(delivErr.message, delivErr.code);
        }
        throw new Error(delivErr.message || 'Database rejected delivery insert.');
      }

      if (delivData) {
        // 2. Insert items (with unit_price if column exists, fallback to notes)
        const itemsWithPrice = input.items.map(item => ({
          delivery_id: delivData.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice !== undefined ? Number(item.unitPrice) : 0,
          notes: item.unitPrice !== undefined ? String(item.unitPrice) : null
        }));

        let { error: itemsErr } = await supabase.from('delivery_items').insert(itemsWithPrice);
        if (itemsErr && (itemsErr.message?.includes('unit_price') || itemsErr.code === '42703')) {
          const baselineItems = input.items.map(item => ({
            delivery_id: delivData.id,
            product_id: item.productId,
            quantity: item.quantity,
            notes: item.unitPrice !== undefined ? String(item.unitPrice) : null
          }));
          const fallbackRes = await supabase.from('delivery_items').insert(baselineItems);
          itemsErr = fallbackRes.error;
        }

        if (itemsErr) {
          console.warn('Supabase delivery_items insert warning:', itemsErr);
          if (isDatabaseCapacityError(itemsErr)) {
            throw new DatabaseCapacityError(itemsErr.message, itemsErr.code);
          }
        }

        // 3. Record payment in payments table if any payment made at creation
        if (paidVal > 0) {
          try {
            await supabase.from('payments').insert({
              business_id: businessId,
              shop_id: input.shopId,
              delivery_id: delivData.id,
              payment_date: input.deliveryDate,
              amount: paidVal,
              payment_method: 'CASH',
              payment_reference: 'Initial Delivery Payment',
              status: 'COMPLETED',
              notes: 'Recorded at delivery creation',
              recorded_by: userId
            });
          } catch {
            // Non-fatal if payments table not yet created
          }
        }

        // 3. Insert stock movement
        if (input.status === 'delivered') {
          const movements = input.items.map(item => ({
            business_id: businessId,
            shop_id: input.shopId,
            product_id: item.productId,
            movement_type: 'DELIVERY_IN',
            quantity: item.quantity,
            reference_id: delivData.id,
            is_provisional: false,
            reason: `Delivery supply #${delivData.id.slice(-6)}`,
            actor_id: userId
          }));
          try {
            const { error: moveErr } = await supabase.from('stock_movements').insert(movements);
            if (moveErr && isDatabaseCapacityError(moveErr)) {
              throw new DatabaseCapacityError(moveErr.message, moveErr.code);
            }
          } catch (moveEx) {
            if (isDatabaseCapacityError(moveEx)) {
              throw moveEx;
            }
            // non-fatal
          }
        }

        const newDelivery: DeliveryRecord = {
          ...input,
          id: delivData.id,
          createdAt: delivData.created_at
        };
        const localDeliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
        setLocalItem(STORAGE_KEYS.DELIVERIES, [newDelivery, ...localDeliveries.filter(d => d.id !== newDelivery.id)]);
        clearMemoryCache();
        return newDelivery;
      }
    } catch (err: any) {
      console.error('Failed to record delivery in Supabase:', err);
      if (isDatabaseCapacityError(err)) {
        throw (err instanceof DatabaseCapacityError) ? err : new DatabaseCapacityError(err?.message, err?.code);
      }
      throw err;
    }
  }

  const deliveries = await getDeliveries();
  const newDelivery: DeliveryRecord = {
    ...input,
    id: generateId('deliv'),
    createdAt: new Date().toISOString()
  };
  setLocalItem(STORAGE_KEYS.DELIVERIES, [newDelivery, ...deliveries]);
  clearMemoryCache();
  return newDelivery;
}

// ----------------------------------------------------
// BUSINESS RECORDS (UNIFIED DELIVERY & PAYMENT LEDGER)
// ----------------------------------------------------

export function mapViewRecordToBusinessRecord(row: any): BusinessRecord {
  const rawStatus = row.delivery_status ?? row.deliveryStatus ?? row.status;
  const deliveryStatus = getAuthoritativeDeliveryStatus(rawStatus);
  const targetId = String(row.record_id || row.id || row.delivery_id || row.deliveryId);
  const deliveryId = String(row.delivery_id || row.deliveryId || targetId);

  return {
    id: targetId,
    deliveryId,
    date: row.date || row.delivery_date || row.deliveryDate || '',
    shopId: row.shop_id || row.shopId || '',
    shopName: row.shop_name || row.shopName || 'Retail Store',
    productId: row.product_id || row.productId || '',
    productName: row.product_name || row.productName || 'Wholesale Accessory',
    productSku: row.product_sku || row.productSku || '',
    quantity: Number(row.quantity) || 1,
    unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    deliveryStatus,
    pendingAmount: Number(row.pending_amount ?? row.pendingAmount ?? 0),
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

function buildBusinessRecordsFromDeliveries(
  deliveries: DeliveryRecord[],
  invoices: Invoice[],
  shops: Shop[],
  products: Product[]
): BusinessRecord[] {
  const shopMap = new Map(shops.map(s => [s.id, s.name]));
  const prodMap = new Map(products.map(p => [p.id, p]));
  const invoiceByDelivery = new Map<string, Invoice>();
  invoices.forEach(inv => {
    if (inv.delivery_id) {
      invoiceByDelivery.set(inv.delivery_id, inv);
    }
  });

  const records: BusinessRecord[] = [];

  const relevantDeliveries = isDemoMode() 
    ? deliveries 
    : deliveries.filter(d => !d.shopName?.startsWith('[DEMO]') && !d.shopName?.startsWith('DEMO -'));

  for (const deliv of relevantDeliveries) {
    const shopName = deliv.shopName || shopMap.get(deliv.shopId) || 'Retail Store';
    const inv = invoiceByDelivery.get(deliv.id);
    const pendingVal = deliv.pendingAmount !== undefined 
      ? Number(deliv.pendingAmount) 
      : (inv ? Number(inv.outstanding_amount) : 0);

    if (deliv.items && deliv.items.length > 0) {
      deliv.items.forEach((item, index) => {
        const prod = prodMap.get(item.productId);
        const unitPrice = item.unitPrice !== undefined 
          ? Number(item.unitPrice) 
          : (Number(prod?.unitPrice) || 0);
        const qty = Number(item.quantity) || 0;
        const totalAmount = qty * unitPrice;
        // For multi-item deliveries, attribute the delivery's pending balance to the first item line
        const itemPending = index === 0 ? pendingVal : 0;

        records.push({
          id: `${deliv.id}-${item.productId || index}`,
          deliveryId: deliv.id,
          date: deliv.deliveryDate,
          shopId: deliv.shopId,
          shopName,
          productId: item.productId,
          productName: item.productName || prod?.name || 'Wholesale Accessory',
          productSku: item.productSku || prod?.sku || '',
          quantity: qty,
          unitPrice,
          totalAmount,
          deliveryStatus: getAuthoritativeDeliveryStatus(deliv.status),
          pendingAmount: itemPending,
          notes: deliv.notes,
          createdAt: deliv.createdAt
        });
      });
    } else {
      // Fallback: Check if item metadata was saved in deliv.notes JSON
      let fallbackProdName = 'Wholesale Accessory';
      let fallbackQty = 1;
      let fallbackPrice = pendingVal;

      try {
        if (deliv.notes && deliv.notes.startsWith('{')) {
          const meta = JSON.parse(deliv.notes);
          if (Array.isArray(meta.items) && meta.items.length > 0) {
            fallbackProdName = meta.items[0].productName || fallbackProdName;
            fallbackQty = Number(meta.items[0].quantity) || fallbackQty;
            fallbackPrice = Number(meta.items[0].unitPrice) || fallbackPrice;
          }
        }
      } catch {}

      const totalAmount = fallbackQty * fallbackPrice;

      records.push({
        id: deliv.id,
        deliveryId: deliv.id,
        date: deliv.deliveryDate,
        shopId: deliv.shopId,
        shopName,
        productId: '',
        productName: fallbackProdName,
        quantity: fallbackQty,
        unitPrice: fallbackPrice,
        totalAmount,
        deliveryStatus: getAuthoritativeDeliveryStatus(deliv.status),
        pendingAmount: pendingVal,
        notes: deliv.notes,
        createdAt: deliv.createdAt
      });
    }
  }

  return sortBusinessRecords(records);
}

export async function getBusinessRecords(): Promise<BusinessRecord[]> {
  if (isDemoMode()) {
    return dedupeRequest('business_records_demo', async () => {
      const [deliveries, invoices, shops, products] = await Promise.all([
        getDeliveries(),
        getInvoices(),
        getShops(),
        getProducts()
      ]);
      return buildBusinessRecordsFromDeliveries(deliveries, invoices, shops, products);
    });
  }

  return dedupeRequest('business_records', async () => {
    // 1. Direct query against canonical Supabase view (public.v_business_records)
    if (isSupabaseConfigured && supabase) {
      try {
        await ensureAuthenticatedSession();
        const { data: viewRecords, error: viewErr } = await withTimeout(
          supabase
            .from('v_business_records')
            .select('*')
            .order('priority_rank', { ascending: true })
            .order('date', { ascending: false }),
          6000
        );

        if (!viewErr && Array.isArray(viewRecords) && viewRecords.length > 0) {
          const nonDemo = viewRecords.filter((r: any) => !r.shop_name?.startsWith('[DEMO]') && !r.shop_name?.startsWith('DEMO -'));
          const mapped = nonDemo.map(mapViewRecordToBusinessRecord);
          return sortBusinessRecords(mapped);
        }
      } catch (viewEx) {
        console.warn('Direct v_business_records query error, attempting API / fallback:', viewEx);
      }

      // 2. Query through backend Express API (/api/records) which queries v_business_records via admin client
      try {
        const res = await authenticatedFetch('/api/records');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.records) && json.records.length > 0) {
            const nonDemo = json.records.filter((r: any) => !r.shop_name?.startsWith('[DEMO]') && !r.shop_name?.startsWith('DEMO -'));
            const mapped = nonDemo.map(mapViewRecordToBusinessRecord);
            return sortBusinessRecords(mapped);
          }
        }
      } catch (apiEx) {
        // Non-fatal, fallback to join below
      }
    }

    // 3. Fallback: Reconstruct from deliveries, invoices, shops, products
    const [deliveries, invoices, shops, products] = await Promise.all([
      getDeliveries(),
      getInvoices(),
      getShops(),
      getProducts()
    ]);
    return buildBusinessRecordsFromDeliveries(deliveries, invoices, shops, products);
  });
}

export async function saveBusinessRecord(input: SaveBusinessRecordInput): Promise<BusinessRecord> {
  SaveBusinessRecordSchema.parse(input);
  const [shops, products] = await Promise.all([getShops(), getProducts()]);

  // 1. Resolve or create Shop
  let targetShop = shops.find(s => 
    input.shopId ? s.id === input.shopId : s.name.trim().toLowerCase() === input.shopName.trim().toLowerCase()
  );
  if (!targetShop) {
    const rawCode = input.shopName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP';
    const code = `RTR-${rawCode}-${Date.now().toString().slice(-4)}`;
    targetShop = await saveShop({
      name: input.shopName.trim(),
      code,
      address: 'Registered Partner Shop',
      phone: '',
      isActive: true,
      assignedEmployees: []
    });
  }

  // 2. Resolve or create Product
  let targetProduct = products.find(p => 
    input.productId ? p.id === input.productId : p.name.trim().toLowerCase() === input.productName.trim().toLowerCase()
  );
  if (!targetProduct) {
    const rawSku = input.productName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ACC';
    const sku = `SKU-${rawSku}-${Date.now().toString().slice(-4)}`;
    targetProduct = await saveProduct({
      name: input.productName.trim(),
      sku,
      category: 'Other Accessories',
      minStock: 5,
      unitPrice: input.unitPrice,
      isActive: true
    });
  }

  // 3. Save Delivery
  const qty = Number(input.quantity) || 1;
  const rate = Number(input.unitPrice) || 0;
  const totalAmount = qty * rate;
  let pendingAmount = Number(input.pendingAmount);
  if (isNaN(pendingAmount)) {
    if (input.paidAmount !== undefined && !isNaN(Number(input.paidAmount))) {
      pendingAmount = Math.max(0, totalAmount - Number(input.paidAmount));
    } else {
      pendingAmount = totalAmount;
    }
  }
  pendingAmount = Math.max(0, pendingAmount);

  const delivery = await recordDelivery({
    shopId: targetShop.id,
    shopName: targetShop.name,
    deliveryDate: input.date,
    status: input.deliveryStatus || 'pending',
    notes: input.notes || '',
    createdBy: 'Business Owner',
    items: [{
      productId: targetProduct.id,
      productName: targetProduct.name,
      productSku: targetProduct.sku,
      quantity: qty,
      unitPrice: rate
    }],
    pendingAmount
  });

  // 4. Save linked Invoice for payment accounting
  const billedAmount = Math.max(totalAmount, pendingAmount);
  const amountPaid = Math.max(0, billedAmount - pendingAmount);
  const invoiceStatus = pendingAmount === 0 ? 'fully_paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid');

  try {
    await saveInvoice({
      business_id: await getBusinessId(),
      shop_id: targetShop.id,
      shop_name: targetShop.name,
      delivery_id: delivery.id,
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      invoice_date: input.date,
      total_amount: billedAmount,
      amount_paid: amountPaid,
      outstanding_amount: pendingAmount,
      status: invoiceStatus,
      notes: input.notes || ''
    });
  } catch (invErr) {
    if (isDatabaseCapacityError(invErr)) {
      throw (invErr instanceof DatabaseCapacityError) ? invErr : new DatabaseCapacityError((invErr as any)?.message, (invErr as any)?.code);
    }
    console.warn('Could not save invoice along with business record:', invErr);
  }

  clearMemoryCache();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('rtr_data_sync', { detail: { key: 'deliveries' } }));
  }

  return {
    id: delivery.id,
    deliveryId: delivery.id,
    date: input.date,
    shopId: targetShop.id,
    shopName: targetShop.name,
    productId: targetProduct.id,
    productName: targetProduct.name,
    productSku: targetProduct.sku,
    quantity: qty,
    unitPrice: rate,
    totalAmount,
    deliveryStatus: input.deliveryStatus || 'pending',
    pendingAmount,
    notes: input.notes,
    createdAt: delivery.createdAt
  };
}

export interface UpdateBusinessRecordInput extends SaveBusinessRecordInput {
  deliveryId: string;
}

export async function updateBusinessRecord(input: UpdateBusinessRecordInput): Promise<BusinessRecord> {
  UpdateBusinessRecordSchema.parse(input);
  const [shops, products] = await Promise.all([getShops(), getProducts()]);

  // 1. Resolve or create Shop
  let targetShop = shops.find(s => 
    input.shopId ? s.id === input.shopId : s.name.trim().toLowerCase() === input.shopName.trim().toLowerCase()
  );
  if (!targetShop) {
    const rawCode = input.shopName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP';
    const code = `RTR-${rawCode}-${Date.now().toString().slice(-4)}`;
    targetShop = await saveShop({
      name: input.shopName.trim(),
      code,
      address: 'Registered Partner Shop',
      phone: '',
      isActive: true,
      assignedEmployees: []
    });
  }

  // 2. Resolve or create Product
  let targetProduct = products.find(p => 
    input.productId ? p.id === input.productId : p.name.trim().toLowerCase() === input.productName.trim().toLowerCase()
  );
  if (!targetProduct) {
    const rawSku = input.productName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ACC';
    const sku = `SKU-${rawSku}-${Date.now().toString().slice(-4)}`;
    targetProduct = await saveProduct({
      name: input.productName.trim(),
      sku,
      category: 'Other Accessories',
      minStock: 5,
      unitPrice: input.unitPrice,
      isActive: true
    });
  }

  const qty = Number(input.quantity) || 1;
  const rate = Number(input.unitPrice) || 0;
  const totalAmount = qty * rate;
  const pendingAmount = Math.max(0, Number(input.pendingAmount) || 0);

  if (isDemoMode()) {
    ensureDemoData();
    const deliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    let idx = deliveries.findIndex(d => d.id === input.deliveryId);
    if (idx < 0) {
      idx = deliveries.findIndex(d => input.deliveryId.startsWith(d.id));
    }
    const resolvedDeliveryId = idx >= 0 && deliveries[idx] ? deliveries[idx]!.id : input.deliveryId;
    const existingCreatedAt = idx >= 0 && deliveries[idx] ? deliveries[idx]!.createdAt : new Date().toISOString();
    const updatedDelivery: DeliveryRecord = {
      id: resolvedDeliveryId,
      shopId: targetShop.id,
      shopName: targetShop.name,
      deliveryDate: input.date,
      status: input.deliveryStatus || 'pending',
      notes: JSON.stringify({
        memo: input.notes || '',
        totalAmount,
        paidAmount: Math.max(0, totalAmount - pendingAmount),
        pendingAmount,
        items: [{
          productId: targetProduct.id,
          productName: targetProduct.name,
          quantity: qty,
          unitPrice: rate
        }]
      }),
      createdBy: 'demo-owner',
      items: [{
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: qty,
        unitPrice: rate
      }],
      pendingAmount,
      createdAt: existingCreatedAt
    };

    if (idx >= 0) {
      deliveries[idx] = updatedDelivery;
    } else {
      deliveries.unshift(updatedDelivery);
    }
    setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, deliveries);
    clearMemoryCache();

    return {
      id: input.deliveryId,
      deliveryId: input.deliveryId,
      date: input.date,
      shopId: targetShop.id,
      shopName: targetShop.name,
      productId: targetProduct.id,
      productName: targetProduct.name,
      productSku: targetProduct.sku,
      quantity: qty,
      unitPrice: rate,
      totalAmount,
      deliveryStatus: input.deliveryStatus || 'pending',
      pendingAmount,
      notes: input.notes,
      createdAt: updatedDelivery.createdAt
    };
  }

  if (isSupabaseConfigured && supabase && !input.deliveryId.startsWith('deliv-')) {
    try {
      await ensureAuthenticatedSession();
      const meta = {
        memo: input.notes || '',
        pendingAmount,
        items: [{
          productId: targetProduct.id,
          productName: targetProduct.name,
          quantity: qty,
          unitPrice: rate
        }]
      };

      const { error: updErr } = await supabase
        .from('deliveries')
        .update({
          shop_id: targetShop.id,
          delivery_date: input.date,
          status: input.deliveryStatus || 'pending',
          notes: JSON.stringify(meta),
          updated_at: new Date().toISOString()
        })
        .eq('id', input.deliveryId);

      if (updErr && isDatabaseCapacityError(updErr)) {
        throw new DatabaseCapacityError(updErr.message, updErr.code);
      }

      await supabase
        .from('delivery_items')
        .delete()
        .eq('delivery_id', input.deliveryId);

      const { error: insErr } = await supabase
        .from('delivery_items')
        .insert([{
          delivery_id: input.deliveryId,
          product_id: targetProduct.id,
          quantity: qty,
          notes: String(rate)
        }]);

      if (insErr && isDatabaseCapacityError(insErr)) {
        throw new DatabaseCapacityError(insErr.message, insErr.code);
      }

      const billedAmount = Math.max(totalAmount, pendingAmount);
      const amountPaid = Math.max(0, billedAmount - pendingAmount);
      const invoiceStatus = pendingAmount === 0 ? 'fully_paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid');

      try {
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            shop_id: targetShop.id,
            total_amount: billedAmount,
            amount_paid: amountPaid,
            status: invoiceStatus,
            notes: input.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('delivery_id', input.deliveryId);

        if (invErr && isDatabaseCapacityError(invErr)) {
          throw new DatabaseCapacityError(invErr.message, invErr.code);
        }
      } catch (invEx) {
        if (isDatabaseCapacityError(invEx)) {
          throw invEx;
        }
        // non-fatal
      }
    } catch (err) {
      if (isDatabaseCapacityError(err)) {
        throw (err instanceof DatabaseCapacityError) ? err : new DatabaseCapacityError((err as any)?.message, (err as any)?.code);
      }
      console.warn('Supabase updateBusinessRecord error:', err);
    }
  }

  // Update local storage
  const deliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
  let idx = deliveries.findIndex(d => d.id === input.deliveryId);
  if (idx < 0) {
    idx = deliveries.findIndex(d => input.deliveryId.startsWith(d.id));
  }
  const resolvedDeliveryId = idx >= 0 && deliveries[idx] ? deliveries[idx]!.id : input.deliveryId;
  const existingCreatedAt = idx >= 0 && deliveries[idx] ? deliveries[idx]!.createdAt : new Date().toISOString();
  const updatedDelivery: DeliveryRecord = {
    id: resolvedDeliveryId,
    shopId: targetShop.id,
    shopName: targetShop.name,
    deliveryDate: input.date,
    status: input.deliveryStatus || 'pending',
    notes: input.notes || '',
    createdBy: 'Business Owner',
    items: [{
      productId: targetProduct.id,
      productName: targetProduct.name,
      productSku: targetProduct.sku,
      quantity: qty,
      unitPrice: rate
    }],
    pendingAmount,
    createdAt: existingCreatedAt
  };

  if (idx >= 0) {
    deliveries[idx] = updatedDelivery;
  } else {
    deliveries.unshift(updatedDelivery);
  }
  setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries);

  const invoices = getLocalItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  const invIdx = invoices.findIndex(i => i.delivery_id === resolvedDeliveryId || i.delivery_id === input.deliveryId);
  if (invIdx >= 0 && invoices[invIdx]) {
    const billedAmount = Math.max(totalAmount, pendingAmount);
    const amountPaid = Math.max(0, billedAmount - pendingAmount);
    const existingInv = invoices[invIdx];
    invoices[invIdx] = {
      ...existingInv,
      shop_id: targetShop.id,
      shop_name: targetShop.name,
      total_amount: billedAmount,
      amount_paid: amountPaid,
      outstanding_amount: pendingAmount,
      status: pendingAmount === 0 ? 'fully_paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid'),
      notes: input.notes || existingInv.notes
    };
    setLocalItem(STORAGE_KEYS.INVOICES, invoices);
  }

  clearMemoryCache();

  return {
    id: input.deliveryId,
    deliveryId: resolvedDeliveryId,
    date: input.date,
    shopId: targetShop.id,
    shopName: targetShop.name,
    productId: targetProduct.id,
    productName: targetProduct.name,
    productSku: targetProduct.sku,
    quantity: qty,
    unitPrice: rate,
    totalAmount,
    deliveryStatus: input.deliveryStatus || 'pending',
    pendingAmount,
    notes: input.notes,
    createdAt: updatedDelivery.createdAt
  };
}

/**
 * Resolves raw or composite delivery ID against a list of deliveries.
 * e.g., if passed 'deliv-101-item-0', matches against delivery 'deliv-101'.
 */
function resolveDeliveryIdFromList(rawId: string, availableDeliveries: DeliveryRecord[]): string {
  const clean = rawId.trim();
  if (availableDeliveries.some(d => d.id === clean)) return clean;
  const match = availableDeliveries.find(d => clean.startsWith(d.id));
  return match ? match.id : clean;
}

export interface UpdateDeliveryStatusResult {
  success: boolean;
  deliveryId: string;
  status: 'delivered' | 'pending';
  message: string;
}

export function getAuthoritativeDeliveryStatus(
  statusOrRecord?: string | boolean | BusinessRecord | RecordPriorityInput | any | null
): 'delivered' | 'pending' | 'cancelled' {
  if (!statusOrRecord) return 'pending';
  if (statusOrRecord === true || statusOrRecord === 'true') return 'delivered';
  if (typeof statusOrRecord === 'string') {
    const s = statusOrRecord.trim().toLowerCase();
    if (s === 'delivered' || s === 'completed') return 'delivered';
    if (s === 'cancelled') return 'cancelled';
    return 'pending';
  }
  const anyRec = statusOrRecord as any;
  const raw = statusOrRecord.deliveryStatus ?? anyRec.delivery_status ?? anyRec.status ?? (anyRec.isDelivered ? 'delivered' : undefined);
  if (raw === true || raw === 'true') return 'delivered';
  if (!raw) return 'pending';
  const s = String(raw).trim().toLowerCase();
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'cancelled') return 'cancelled';
  return 'pending';
}

export function isDelivered(statusOrRecord?: string | boolean | BusinessRecord | RecordPriorityInput | any | null): boolean {
  return getAuthoritativeDeliveryStatus(statusOrRecord) === 'delivered';
}

export function normalizeDeliveryStatus(statusOrRecord?: string | boolean | BusinessRecord | RecordPriorityInput | any | null): 'delivered' | 'pending' {
  return isDelivered(statusOrRecord) ? 'delivered' : 'pending';
}

/**
 * Robust delivery status lifecycle:
 * - Direct authenticated update through server API endpoint (/api/records/:id/delivery-status).
 * - Fallback to Supabase client if server is offline.
 * - Confirms persistence before resolving.
 * - Keeps local cache updated and clears memory cache.
 */
export async function updateDeliveryStatus(
  deliveryId: string, 
  status: 'delivered' | 'pending'
): Promise<UpdateDeliveryStatusResult> {
  const cleanId = deliveryId.trim();
  const uuidMatch = cleanId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const targetId = uuidMatch ? uuidMatch[0] : cleanId;

  // 1. Demo Mode Storage
  if (isDemoMode()) {
    ensureDemoData();
    const deliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const resolvedId = resolveDeliveryIdFromList(targetId, deliveries) || targetId;
    const idx = deliveries.findIndex(d => d.id === resolvedId || d.id === targetId || d.id === cleanId);
    if (idx >= 0 && deliveries[idx]) {
      deliveries[idx] = { ...deliveries[idx]!, status };
      setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, deliveries);
    } else {
      deliveries.push({
        id: targetId,
        shopId: 'demo-shop-1',
        deliveryDate: new Date().toISOString().split('T')[0] || '',
        status,
        createdBy: 'demo-owner',
        items: [],
        createdAt: new Date().toISOString()
      });
      setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, deliveries);
    }
    clearMemoryCache();
    return {
      success: true,
      deliveryId: targetId,
      status,
      message: `Delivery status updated to ${status} in demo sandbox.`
    };
  }

  // 2. Authoritative API Server Request (/api/records/:id/delivery-status)
  let apiSuccess = false;
  let confirmedStatus: 'delivered' | 'pending' = status;

  if (isSupabaseConfigured && supabase && !targetId.startsWith('deliv-')) {
    try {
      const res = await authenticatedFetch(`/api/records/${encodeURIComponent(targetId)}/delivery-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          apiSuccess = true;
          confirmedStatus = json.status || status;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error(errJson.message || 'Unauthorized: Access restricted to Business Owner only.');
        } else if (res.status === 400 && errJson.message?.includes('invalid status')) {
          throw new Error(errJson.message || 'Invalid delivery status provided.');
        }
        console.warn(`PATCH /api/records/${targetId}/delivery-status failed (HTTP ${res.status}):`, errJson.message);
      }
    } catch (apiErr: any) {
      if (
        apiErr.message?.includes('Unauthorized') || 
        apiErr.message?.includes('restricted') || 
        apiErr.message?.includes('invalid delivery status') ||
        apiErr.message?.includes('session token')
      ) {
        throw apiErr;
      }
      console.warn('API /api/records/:id/delivery-status failed, falling back to direct Supabase update:', apiErr);
    }

    // Direct Supabase fallback if backend API server did not confirm
    if (!apiSuccess) {
      try {
        await ensureAuthenticatedSession();
        const { data, error } = await supabase
          .from('deliveries')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId)
          .select('id, status')
          .single();

        if (error) {
          throw new Error(error.message);
        }
        if (data) {
          apiSuccess = true;
          confirmedStatus = (data.status as 'delivered' | 'pending') || status;
        }
      } catch (dbErr: any) {
        console.error('Direct Supabase updateDeliveryStatus error:', dbErr);
        throw new Error(dbErr.message || 'Failed to update delivery status in database.');
      }
    }
  }

  // If targetId is a local/offline record or Supabase is not configured, handle local storage update directly
  const isLocalRecord = !isSupabaseConfigured || !supabase || targetId.startsWith('deliv-');
  if (isLocalRecord) {
    apiSuccess = true;
  }

  // Ensure that if neither API nor database confirmed the mutation for a server record, we throw so UI rolls back
  if (!apiSuccess) {
    throw new Error('Failed to update delivery status on the server. Restored previous state.');
  }

  // 4. Update local storage cache to keep client storage synchronized
  const deliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
  const resolvedId = resolveDeliveryIdFromList(targetId, deliveries) || targetId;
  const idx = deliveries.findIndex(d => d.id === resolvedId || d.id === targetId || d.id === cleanId);
  if (idx >= 0 && deliveries[idx]) {
    deliveries[idx] = { ...deliveries[idx]!, status: confirmedStatus };
    setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries);
  } else {
    deliveries.unshift({
      id: targetId,
      shopId: 'shop-synced',
      deliveryDate: new Date().toISOString().split('T')[0] || '',
      status: confirmedStatus,
      createdBy: 'Business Owner',
      items: [],
      createdAt: new Date().toISOString()
    });
    setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries);
  }
  clearMemoryCache();

  // Dispatch sync event with confirmed details
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('rtr_data_sync', { 
      detail: { key: 'deliveries', deliveryId: targetId, status: confirmedStatus } 
    }));
  }

  return {
    success: true,
    deliveryId: targetId,
    status: confirmedStatus,
    message: `Delivery status updated to ${confirmedStatus}.`
  };
}

export async function deleteBusinessRecord(deliveryId: string): Promise<void> {
  const cleanId = deliveryId.trim();

  if (isDemoMode()) {
    const deliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const resolvedId = resolveDeliveryIdFromList(cleanId, deliveries);
    setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, deliveries.filter(d => d.id !== resolvedId && d.id !== cleanId));
    clearMemoryCache();
    return;
  }

  if (isSupabaseConfigured && supabase && !cleanId.startsWith('deliv-')) {
    const uuidMatch = cleanId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const targetId = uuidMatch ? uuidMatch[0] : cleanId;

    const res = await authenticatedFetch(`/api/records/${encodeURIComponent(targetId)}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error(errJson.message || 'Unauthorized: Access restricted to Business Owner only.');
      }
      throw new Error(errJson.message || `Failed to delete record (HTTP ${res.status}).`);
    }
  }

  const deliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
  const resolvedId = resolveDeliveryIdFromList(cleanId, deliveries);
  setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries.filter(d => d.id !== resolvedId && d.id !== cleanId));

  const invoices = getLocalItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  setLocalItem(STORAGE_KEYS.INVOICES, invoices.filter(i => i.delivery_id !== resolvedId && i.delivery_id !== cleanId));

  clearMemoryCache();
}

export async function settleRecordPayment(deliveryId: string, amountToPay?: number): Promise<void> {
  SettlePaymentSchema.parse({ deliveryId, amountToPay });
  if (isDemoMode()) {
    ensureDemoData();
    const deliveries = getLocalItem<DeliveryRecord[]>(DEMO_STORAGE_KEYS.DELIVERIES, []);
    const idx = deliveries.findIndex(d => d.id === deliveryId);
    if (idx >= 0 && deliveries[idx]) {
      const d = deliveries[idx]!;
      const curPending = d.pendingAmount !== undefined ? d.pendingAmount : 0;
      const payment = amountToPay !== undefined ? Math.min(amountToPay, curPending) : curPending;
      const newPending = Math.max(0, curPending - payment);
      const updated: DeliveryRecord = {
        ...d,
        pendingAmount: newPending,
        notes: JSON.stringify({
          memo: d.notes || 'Settled in demo sandbox',
          pendingAmount: newPending
        })
      };
      deliveries[idx] = updated;
      setLocalItem(DEMO_STORAGE_KEYS.DELIVERIES, deliveries);
      clearMemoryCache();
    }
    return;
  }

  if (isSupabaseConfigured && supabase && !deliveryId.startsWith('deliv-')) {
    try {
      await ensureAuthenticatedSession();
      const { data: d } = await supabase
        .from('deliveries')
        .select('shop_id, notes')
        .eq('id', deliveryId)
        .maybeSingle();

      let meta: any = {};
      try {
        if (d?.notes && d.notes.startsWith('{')) {
          meta = JSON.parse(d.notes);
        } else {
          meta = { memo: d?.notes || '' };
        }
      } catch {
        meta = { memo: d?.notes || '' };
      }

      const curPending = Number(meta.pendingAmount) || 0;
      const payAmount = amountToPay !== undefined ? amountToPay : curPending;
      meta.pendingAmount = Math.max(0, curPending - payAmount);

      const { error: updErr } = await supabase
        .from('deliveries')
        .update({
          notes: JSON.stringify(meta),
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId);

      if (updErr && isDatabaseCapacityError(updErr)) {
        throw new DatabaseCapacityError(updErr.message, updErr.code);
      }

      // Record payment transaction in payments table
      if (payAmount > 0) {
        try {
          const businessId = await getBusinessId();
          const userId = await getCurrentUserId();
          await supabase.from('payments').insert({
            business_id: businessId,
            shop_id: d?.shop_id || undefined,
            delivery_id: deliveryId,
            payment_date: new Date().toISOString().slice(0, 10),
            amount: payAmount,
            payment_method: 'CASH',
            payment_reference: `SETTLE-${Date.now().toString().slice(-4)}`,
            status: 'COMPLETED',
            notes: 'Settlement from records ledger',
            recorded_by: userId
          });
        } catch {
          // non-fatal if table not yet created
        }
      }
    } catch (e) {
      if (isDatabaseCapacityError(e)) {
        throw (e instanceof DatabaseCapacityError) ? e : new DatabaseCapacityError((e as any)?.message, (e as any)?.code);
      }
      console.warn('Could not settle payment in Supabase:', e);
    }
  }

  const invoices = await getInvoices();
  const invoice = invoices.find(i => i.delivery_id === deliveryId);

  if (invoice) {
    const payAmount = amountToPay !== undefined ? amountToPay : invoice.outstanding_amount;
    if (payAmount > 0) {
      await recordPayment({
        business_id: invoice.business_id,
        shop_id: invoice.shop_id,
        invoice_id: invoice.id,
        payment_date: new Date().toISOString().slice(0, 10),
        amount: payAmount,
        payment_method: 'CASH',
        payment_reference: `SETTLE-${Date.now().toString().slice(-4)}`,
        status: 'COMPLETED',
        notes: 'Settlement from records ledger'
      });
    }
  } else {
    const deliveries = await getDeliveries();
    const dIdx = deliveries.findIndex(d => d.id === deliveryId);
    if (dIdx >= 0 && deliveries[dIdx]) {
      const curPending = deliveries[dIdx].pendingAmount || 0;
      const payAmount = amountToPay !== undefined ? amountToPay : curPending;
      deliveries[dIdx] = {
        ...deliveries[dIdx],
        pendingAmount: Math.max(0, curPending - payAmount)
      };
      setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries);
    }
  }

  clearMemoryCache();
}

// ----------------------------------------------------
// DAILY REPORTS
// ----------------------------------------------------
export async function getDailyReports(): Promise<DailyReportRecord[]> {
  return dedupeRequest('daily_reports', async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('daily_reports')
          .select('id, shop_id, report_date, is_zero_sales, status, notes, created_at, daily_report_items(product_id, quantity_sold)')
          .order('report_date', { ascending: false });

        if (!error && Array.isArray(data)) {
          const [shops, prods] = await Promise.all([getShops(), getProducts()]);
          const shopMap = new Map(shops.map(s => [s.id, s.name]));
          const prodMap = new Map(prods.map(p => [p.id, p]));

          const reports: DailyReportRecord[] = data.map((r: any) => {
            const rawItems = Array.isArray(r.daily_report_items) ? r.daily_report_items : [];
            const items = rawItems.map((i: any) => ({
              productId: i.product_id,
              productName: prodMap.get(i.product_id)?.name || 'Product',
              quantitySold: Number(i.quantity_sold) || 0,
              physicalCount: null
            }));
            const totalQuantitySold = items.reduce((s: number, i: any) => s + (i.quantitySold || 0), 0);

            return {
              id: r.id,
              shopId: r.shop_id,
              shopName: shopMap.get(r.shop_id) || 'Retail Store',
              reportDate: r.report_date,
              isZeroSales: Boolean(r.is_zero_sales),
              status: (r.status as 'submitted' | 'approved' | 'rejected') || 'submitted',
              submittedBy: 'Store Staff',
              submittedAt: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '18:00',
              notes: r.notes || '',
              items,
              totalQuantitySold,
              createdAt: r.created_at
            };
          });
          setLocalCache(STORAGE_KEYS.REPORTS, reports);
          return reports;
        }
      } catch (err) {
        console.warn('Supabase getDailyReports error, using local fallback:', err);
      }
    }
    const local = getLocalItem<DailyReportRecord[]>(STORAGE_KEYS.REPORTS, []);
    return local.map(r => ({
      ...r,
      items: Array.isArray(r.items) ? r.items : [],
      totalQuantitySold: typeof r.totalQuantitySold === 'number' ? r.totalQuantitySold : (Array.isArray(r.items) ? r.items.reduce((s, i) => s + (i.quantitySold || 0), 0) : 0)
    }));
  });
}

export async function submitDailyReport(input: Omit<DailyReportRecord, 'id' | 'createdAt'>): Promise<DailyReportRecord> {
  if (isSupabaseConfigured && supabase) {
    try {
      const businessId = await getBusinessId();
      const userId = await getCurrentUserId();

      // Ensure shop membership exists for current user so RLS check passes
      try {
        await supabase.from('shop_memberships').insert({
          shop_id: input.shopId,
          user_id: userId
        });
      } catch {
        // Membership already exists
      }

      // 1. Insert daily_report
      const { data: repData, error: repErr } = await supabase
        .from('daily_reports')
        .insert({
          business_id: businessId,
          shop_id: input.shopId,
          report_date: input.reportDate,
          is_zero_sales: input.isZeroSales,
          status: input.status,
          notes: input.notes || null,
          submitted_by: userId
        })
        .select()
        .single();

      if (repErr) {
        console.error('Supabase submitDailyReport error:', repErr);
      } else if (repData) {
        // 2. Insert items
        if (!input.isZeroSales && input.items.length > 0) {
          const itemsToInsert = input.items.map(item => ({
            report_id: repData.id,
            product_id: item.productId,
            quantity_sold: item.quantitySold
          }));
          await supabase.from('daily_report_items').insert(itemsToInsert);
        }

        const newReport: DailyReportRecord = {
          ...input,
          id: repData.id,
          createdAt: repData.created_at
        };
        const localReports = getLocalItem<DailyReportRecord[]>(STORAGE_KEYS.REPORTS, []);
        setLocalItem(STORAGE_KEYS.REPORTS, [newReport, ...localReports]);
        return newReport;
      }
    } catch (err) {
      console.warn('Supabase submitDailyReport exception, using local fallback:', err);
    }
  }

  const reports = await getDailyReports();
  const newReport: DailyReportRecord = {
    ...input,
    id: generateId('rep'),
    createdAt: new Date().toISOString()
  };
  setLocalItem(STORAGE_KEYS.REPORTS, [newReport, ...reports]);
  return newReport;
}

export async function approveDailyReport(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase && !id.startsWith('rep-')) {
    try {
      const userId = await getCurrentUserId();
      const businessId = await getBusinessId();

      const { data: repData, error: repErr } = await supabase
        .from('daily_reports')
        .update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*, daily_report_items(*)')
        .single();

      if (!repErr && repData) {
        const items = repData.daily_report_items || [];
        if (items.length > 0) {
          const movements = items
            .filter((item: any) => item.quantity_sold > 0)
            .map((item: any) => ({
              business_id: businessId,
              shop_id: repData.shop_id,
              product_id: item.product_id,
              movement_type: 'SALE_OUT',
              quantity: -item.quantity_sold,
              reference_id: id,
              is_provisional: false,
              reason: 'Approved daily sales report deduction',
              actor_id: userId
            }));

          if (movements.length > 0) {
            await supabase.from('stock_movements').insert(movements);
          }
        }
      }
    } catch (err) {
      console.warn('Supabase approveDailyReport error:', err);
    }
  }

  const reports = await getDailyReports();
  const updated = reports.map(r => r.id === id ? { ...r, status: 'approved' as const } : r);
  setLocalItem(STORAGE_KEYS.REPORTS, updated);
}

// ----------------------------------------------------
// STOCK TRANSFERS
// ----------------------------------------------------
export async function getStockTransfers(): Promise<StockTransferRecord[]> {
  return dedupeRequest('transfers', async () => {
    return getLocalItem<StockTransferRecord[]>(STORAGE_KEYS.TRANSFERS, []);
  });
}

export async function recordStockTransfer(input: Omit<StockTransferRecord, 'id' | 'createdAt'>): Promise<StockTransferRecord> {
  const transfers = await getStockTransfers();
  const newTransfer: StockTransferRecord = {
    ...input,
    id: generateId('trf'),
    createdAt: new Date().toISOString()
  };
  setLocalItem(STORAGE_KEYS.TRANSFERS, [newTransfer, ...transfers]);
  return newTransfer;
}

// ----------------------------------------------------
// STOCK AUDITS (PHYSICAL COUNTS)
// ----------------------------------------------------
export async function getStockAudits(): Promise<StockAuditRecord[]> {
  return dedupeRequest('stock_audits', async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('stock_counts')
          .select('id, shop_id, product_id, counted_quantity, expected_quantity, variance, created_at, notes')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          const audits: StockAuditRecord[] = data.map((c: any) => ({
            id: c.id,
            shopId: c.shop_id,
            productId: c.product_id,
            physicalCount: Number(c.counted_quantity) || 0,
            expectedCount: Number(c.expected_quantity) || 0,
            discrepancy: Number(c.variance) || 0,
            countedAt: c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            notes: c.notes || undefined
          }));
          setLocalCache(STORAGE_KEYS.AUDITS, audits);
          return audits;
        }
      } catch (err) {
        console.warn('Supabase getStockAudits error, fallback to local:', err);
      }
    }
    return getLocalItem<StockAuditRecord[]>(STORAGE_KEYS.AUDITS, []);
  });
}

export async function recordStockAudit(input: Omit<StockAuditRecord, 'id'>): Promise<StockAuditRecord> {
  if (isSupabaseConfigured && supabase) {
    try {
      const businessId = await getBusinessId();
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('stock_counts')
        .insert({
          business_id: businessId,
          shop_id: input.shopId,
          product_id: input.productId,
          counted_quantity: input.physicalCount,
          expected_quantity: input.expectedCount,
          counted_by: userId,
          notes: input.notes || null
        })
        .select()
        .single();

      if (!error && data) {
        const newAudit: StockAuditRecord = {
          id: data.id,
          shopId: data.shop_id,
          productId: data.product_id,
          physicalCount: data.counted_quantity,
          expectedCount: data.expected_quantity,
          discrepancy: data.variance,
          countedAt: data.created_at.slice(0, 10),
          notes: data.notes || undefined
        };
        const audits = getLocalItem<StockAuditRecord[]>(STORAGE_KEYS.AUDITS, []);
        setLocalItem(STORAGE_KEYS.AUDITS, [newAudit, ...audits]);
        return newAudit;
      }
    } catch (err) {
      console.warn('Supabase recordStockAudit error, fallback to local:', err);
    }
  }

  const audits = await getStockAudits();
  const newAudit: StockAuditRecord = {
    ...input,
    id: generateId('audit')
  };
  setLocalItem(STORAGE_KEYS.AUDITS, [newAudit, ...audits]);
  return newAudit;
}

// ----------------------------------------------------
// INVOICES & PAYMENTS (SHOP CASH TRACKING)
// ----------------------------------------------------
export async function getInvoices(): Promise<Invoice[]> {
  if (isDemoMode()) {
    return getLocalItem<Invoice[]>(DEMO_STORAGE_KEYS.INVOICES, []);
  }

  return dedupeRequest('invoices', async () => {
    return getLocalItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  });
}

export async function saveInvoice(input: Omit<Invoice, 'id'> & { id?: string }): Promise<Invoice> {
  const targetKey = isDemoMode() ? DEMO_STORAGE_KEYS.INVOICES : STORAGE_KEYS.INVOICES;
  const invoices = await getInvoices();
  if (input.id) {
    const updated = invoices.map(i => i.id === input.id ? { ...i, ...input } : i);
    setLocalItem(targetKey, updated);
    return updated.find(i => i.id === input.id)!;
  }
  const newInvoice: Invoice = {
    ...input,
    id: generateId(isDemoMode() ? 'demo-inv' : 'inv')
  };
  setLocalItem(targetKey, [newInvoice, ...invoices]);
  return newInvoice;
}

export async function getPayments(): Promise<PaymentRecord[]> {
  if (isDemoMode()) {
    return getLocalItem<PaymentRecord[]>(DEMO_STORAGE_KEYS.PAYMENTS, []);
  }

  return dedupeRequest('payments', async () => {
    return getLocalItem<PaymentRecord[]>(STORAGE_KEYS.PAYMENTS, []);
  });
}

export async function recordPayment(input: Omit<PaymentRecord, 'id' | 'created_at'>): Promise<PaymentRecord> {
  const targetKey = isDemoMode() ? DEMO_STORAGE_KEYS.PAYMENTS : STORAGE_KEYS.PAYMENTS;
  const payments = await getPayments();
  const newPayment: PaymentRecord = {
    ...input,
    id: generateId(isDemoMode() ? 'demo-pay' : 'pay'),
    created_at: new Date().toISOString()
  };
  setLocalItem(targetKey, [newPayment, ...payments]);

  // If this payment was tied to an invoice, recalculate invoice balance
  if (input.invoice_id) {
    const invoices = await getInvoices();
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === input.invoice_id) {
        const newPaid = inv.amount_paid + input.amount;
        const calc = calculatePaymentStatus(inv.total_amount, newPaid);
        return {
          ...inv,
          amount_paid: newPaid,
          outstanding_amount: calc.outstandingBalance,
          status: calc.status
        };
      }
      return inv;
    });
    setLocalItem(STORAGE_KEYS.INVOICES, updatedInvoices);
  }

  return newPayment;
}

// ----------------------------------------------------
// DYNAMIC STOCK CALCULATION ENGINE
// ----------------------------------------------------
export interface PreloadedStockData {
  shops?: Shop[];
  products?: Product[];
  deliveries?: DeliveryRecord[];
  reports?: DailyReportRecord[];
  transfers?: StockTransferRecord[];
  audits?: StockAuditRecord[];
}

export async function calculateStockBalances(
  shopIdFilter?: string,
  preloaded?: PreloadedStockData
): Promise<StockBalance[]> {
  const [shops, products, deliveries, reports, transfers, audits] = await Promise.all([
    preloaded?.shops ? Promise.resolve(preloaded.shops) : getShops(),
    preloaded?.products ? Promise.resolve(preloaded.products) : getProducts(),
    preloaded?.deliveries ? Promise.resolve(preloaded.deliveries) : getDeliveries(),
    preloaded?.reports ? Promise.resolve(preloaded.reports) : getDailyReports(),
    preloaded?.transfers ? Promise.resolve(preloaded.transfers) : getStockTransfers(),
    preloaded?.audits ? Promise.resolve(preloaded.audits) : getStockAudits()
  ]);

  const filteredShops = shopIdFilter && shopIdFilter !== 'all'
    ? shops.filter(s => s.id === shopIdFilter)
    : shops;

  // Pre-index deliveries by `${shopId}:${productId}` -> total quantity
  const deliveryMap = new Map<string, number>();
  for (const d of deliveries) {
    if (d.status === 'delivered' && Array.isArray(d.items)) {
      for (const item of d.items) {
        const key = `${d.shopId}:${item.productId}`;
        deliveryMap.set(key, (deliveryMap.get(key) || 0) + (Number(item.quantity) || 0));
      }
    }
  }

  // Pre-index reports by `${shopId}:${productId}`
  const confirmedSoldMap = new Map<string, number>();
  const provisionalSoldMap = new Map<string, number>();
  for (const rep of reports) {
    if (!rep.isZeroSales && Array.isArray(rep.items)) {
      for (const item of rep.items) {
        const key = `${rep.shopId}:${item.productId}`;
        const qty = Number(item.quantitySold) || 0;
        if (rep.status === 'approved') {
          confirmedSoldMap.set(key, (confirmedSoldMap.get(key) || 0) + qty);
        } else if (rep.status === 'submitted') {
          provisionalSoldMap.set(key, (provisionalSoldMap.get(key) || 0) + qty);
        }
      }
    }
  }

  // Pre-index transfers
  const transferredInMap = new Map<string, number>();
  const transferredOutMap = new Map<string, number>();
  for (const trf of transfers) {
    const inKey = `${trf.toShopId}:${trf.productId}`;
    const outKey = `${trf.fromShopId}:${trf.productId}`;
    transferredInMap.set(inKey, (transferredInMap.get(inKey) || 0) + (Number(trf.quantity) || 0));
    transferredOutMap.set(outKey, (transferredOutMap.get(outKey) || 0) + (Number(trf.quantity) || 0));
  }

  // Pre-index latest audits
  const auditMap = new Map<string, StockAuditRecord>();
  for (const a of audits) {
    const key = `${a.shopId}:${a.productId}`;
    if (!auditMap.has(key)) {
      auditMap.set(key, a);
    }
  }

  const balances: StockBalance[] = [];

  for (const shop of filteredShops) {
    for (const prod of products) {
      const key = `${shop.id}:${prod.id}`;
      const totalDelivered = deliveryMap.get(key) || 0;
      const confirmedSold = confirmedSoldMap.get(key) || 0;
      const provisionalSold = provisionalSoldMap.get(key) || 0;
      const transferredIn = transferredInMap.get(key) || 0;
      const transferredOut = transferredOutMap.get(key) || 0;

      const expectedStock = totalDelivered - (confirmedSold + provisionalSold) + transferredIn - transferredOut;
      const latestAudit = auditMap.get(key) || null;
      const physicalCount = latestAudit ? latestAudit.physicalCount : null;
      const discrepancy = physicalCount !== null ? physicalCount - expectedStock : null;

      balances.push({
        shop_id: shop.id,
        shop_name: shop.name,
        product_id: prod.id,
        product_name: prod.name,
        product_sku: prod.sku,
        category: prod.category,
        total_delivered: totalDelivered,
        confirmed_sold: confirmedSold,
        provisional_sold: provisionalSold,
        total_returned: 0,
        total_damaged: 0,
        total_transferred_in: transferredIn,
        total_transferred_out: transferredOut,
        expected_stock: expectedStock,
        last_physical_count: physicalCount,
        last_counted_at: latestAudit ? latestAudit.countedAt : null,
        discrepancy: discrepancy,
        min_stock_threshold: prod.minStock
      });
    }
  }

  return balances;
}

// ----------------------------------------------------
// CLEAN RESET UTILITY
// ----------------------------------------------------
export function resetWorkspaceToCleanEmptyState(): void {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent('rtr_data_sync', { detail: { action: 'clear' } }));
}

// ====================================================
// SHOP HISTORICAL ANALYTICS & TIMELINE ENGINE
// ====================================================

export async function getShopHistoricalSummary(
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<ShopBusinessSummary | null> {
  const shops = await getShops();
  const shop = shops.find(s => s.id === shopId);
  if (!shop) return null;

  const start = startDate || '2000-01-01';
  const end = endDate || new Date().toISOString().slice(0, 10);

  const [products, allDeliveries, allReports, allTransfers, allAudits, allInvoices, allPayments] = await Promise.all([
    getProducts(),
    getDeliveries(),
    getDailyReports(),
    getStockTransfers(),
    getStockAudits(),
    getInvoices(),
    getPayments()
  ]);

  // Shop-filtered records
  const shopDeliveries = allDeliveries.filter(d => d.shopId === shopId && d.status === 'delivered');
  const inPeriodDeliveries = shopDeliveries.filter(d => d.deliveryDate >= start && d.deliveryDate <= end);

  const shopReports = allReports.filter(r => r.shopId === shopId && !r.isZeroSales);
  const inPeriodReports = shopReports.filter(r => r.reportDate >= start && r.reportDate <= end);

  const inPeriodTransfers = allTransfers.filter(t => {
    const tDate = t.createdAt.slice(0, 10);
    return (t.fromShopId === shopId || t.toShopId === shopId) && tDate >= start && tDate <= end;
  });

  const inPeriodInvoices = allInvoices.filter(i => i.shop_id === shopId && i.invoice_date >= start && i.invoice_date <= end);
  const inPeriodPayments = allPayments.filter(p => p.shop_id === shopId && p.status === 'COMPLETED' && p.payment_date >= start && p.payment_date <= end);

  // Deliveries count and units
  const deliveriesCount = inPeriodDeliveries.length;
  const totalDeliveredUnits = inPeriodDeliveries.reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);
  const totalSoldUnits = inPeriodReports.reduce((sum, r) => sum + r.totalQuantitySold, 0);

  // Transfers
  const transfersInUnits = inPeriodTransfers.filter(t => t.toShopId === shopId).reduce((sum, t) => sum + t.quantity, 0);
  const transfersOutUnits = inPeriodTransfers.filter(t => t.fromShopId === shopId).reduce((sum, t) => sum + t.quantity, 0);

  // Invoices & Payments
  const totalInvoiced = inPeriodInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalPayments = inPeriodPayments.reduce((sum, pay) => sum + pay.amount, 0);
  const outstandingBalance = Math.max(0, Math.round((totalInvoiced - totalPayments) * 100) / 100);
  const paymentStatus = calculatePaymentStatus(totalInvoiced, totalPayments).status;

  // Expected Remaining Stock (accounting for all historical records up to 'end' date)
  let expectedRemainingStock = 0;
  for (const prod of products) {
    const historicalDelivered = shopDeliveries
      .filter(d => d.deliveryDate <= end)
      .reduce((sum, d) => sum + d.items.filter(i => i.productId === prod.id).reduce((s, i) => s + i.quantity, 0), 0);

    const historicalSold = shopReports
      .filter(r => r.reportDate <= end)
      .reduce((sum, r) => sum + r.items.filter(i => i.productId === prod.id).reduce((s, i) => s + i.quantitySold, 0), 0);

    const historicalTrfIn = allTransfers
      .filter(t => t.toShopId === shopId && t.productId === prod.id && t.createdAt.slice(0, 10) <= end)
      .reduce((sum, t) => sum + t.quantity, 0);

    const historicalTrfOut = allTransfers
      .filter(t => t.fromShopId === shopId && t.productId === prod.id && t.createdAt.slice(0, 10) <= end)
      .reduce((sum, t) => sum + t.quantity, 0);

    expectedRemainingStock += (historicalDelivered - historicalSold + historicalTrfIn - historicalTrfOut);
  }

  // Audits & Discrepancies
  const shopAudits = allAudits.filter(a => a.shopId === shopId && a.countedAt <= end);
  const totalDiscrepancy = shopAudits.reduce((sum, a) => sum + a.discrepancy, 0);

  // Revenue, COGS & Profit
  let salesRevenue = 0;
  let totalCogs = 0;
  let hasMissingCost = false;
  let hasSales = false;

  for (const rep of inPeriodReports) {
    for (const item of rep.items) {
      if (item.quantitySold > 0) {
        hasSales = true;
        const prod = products.find(p => p.id === item.productId);
        const unitPrice = prod?.unitPrice || 0;
        salesRevenue += item.quantitySold * unitPrice;

        if (prod && prod.costPrice !== null && prod.costPrice !== undefined) {
          totalCogs += item.quantitySold * prod.costPrice;
        } else {
          hasMissingCost = true;
        }
      }
    }
  }

  const profitCalc = calculateGrossProfit(
    salesRevenue,
    hasSales && hasMissingCost ? null : hasSales ? totalCogs : 0
  );

  return {
    shopId: shop.id,
    shopName: shop.name,
    shopCode: shop.code,
    periodLabel: `${start} to ${end}`,
    startDate: start,
    endDate: end,
    deliveriesCount,
    totalDeliveredUnits,
    totalSoldUnits,
    expectedRemainingStock,
    totalDiscrepancy,
    salesRevenue: Math.round(salesRevenue * 100) / 100,
    costOfGoodsSold: profitCalc.status === 'calculated' ? Math.round(totalCogs * 100) / 100 : null,
    grossProfit: profitCalc.grossProfit,
    grossMarginPercent: profitCalc.marginPercent,
    profitStatus: profitCalc.status,
    profitStatusMessage: profitCalc.message,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPayments: Math.round(totalPayments * 100) / 100,
    outstandingBalance,
    paymentStatus,
    returnsUnits: 0,
    damagedUnits: 0,
    transfersInUnits,
    transfersOutUnits
  };
}

export async function getShopProductHistory(
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<ProductHistoryItem[]> {
  const start = startDate || '2000-01-01';
  const end = endDate || new Date().toISOString().slice(0, 10);

  const [products, allDeliveries, allReports, allTransfers, allAudits] = await Promise.all([
    getProducts(),
    getDeliveries(),
    getDailyReports(),
    getStockTransfers(),
    getStockAudits()
  ]);

  const shopDeliveries = allDeliveries.filter(d => d.shopId === shopId && d.status === 'delivered');
  const inPeriodDeliveries = shopDeliveries.filter(d => d.deliveryDate >= start && d.deliveryDate <= end);

  const shopReports = allReports.filter(r => r.shopId === shopId && !r.isZeroSales);
  const inPeriodReports = shopReports.filter(r => r.reportDate >= start && r.reportDate <= end);

  const inPeriodTransfers = allTransfers.filter(t => {
    const tDate = t.createdAt.slice(0, 10);
    return (t.fromShopId === shopId || t.toShopId === shopId) && tDate >= start && tDate <= end;
  });

  const shopAudits = allAudits.filter(a => a.shopId === shopId && a.countedAt <= end);

  const historyItems: ProductHistoryItem[] = [];

  for (const prod of products) {
    // In-period delivered
    const deliveredInPeriod = inPeriodDeliveries.reduce((sum, d) => {
      const line = d.items.find(i => i.productId === prod.id);
      return sum + (line ? line.quantity : 0);
    }, 0);

    // In-period sold
    const soldInPeriod = inPeriodReports.reduce((sum, r) => {
      const line = r.items.find(i => i.productId === prod.id);
      return sum + (line ? line.quantitySold : 0);
    }, 0);

    // In-period transfers
    const transferredInPeriod = inPeriodTransfers
      .filter(t => t.toShopId === shopId && t.productId === prod.id)
      .reduce((sum, t) => sum + t.quantity, 0);

    const transferredOutPeriod = inPeriodTransfers
      .filter(t => t.fromShopId === shopId && t.productId === prod.id)
      .reduce((sum, t) => sum + t.quantity, 0);

    // All-time expected stock up to 'end'
    const histDelivered = shopDeliveries
      .filter(d => d.deliveryDate <= end)
      .reduce((sum, d) => sum + d.items.filter(i => i.productId === prod.id).reduce((s, i) => s + i.quantity, 0), 0);

    const histSold = shopReports
      .filter(r => r.reportDate <= end)
      .reduce((sum, r) => sum + r.items.filter(i => i.productId === prod.id).reduce((s, i) => s + i.quantitySold, 0), 0);

    const histTrfIn = allTransfers
      .filter(t => t.toShopId === shopId && t.productId === prod.id && t.createdAt.slice(0, 10) <= end)
      .reduce((sum, t) => sum + t.quantity, 0);

    const histTrfOut = allTransfers
      .filter(t => t.fromShopId === shopId && t.productId === prod.id && t.createdAt.slice(0, 10) <= end)
      .reduce((sum, t) => sum + t.quantity, 0);

    const currentRemainingStock = histDelivered - histSold + histTrfIn - histTrfOut;

    // Latest audit
    const latestAudit = shopAudits.filter(a => a.productId === prod.id)[0] || null;
    const lastPhysicalCount = latestAudit ? latestAudit.physicalCount : null;
    const discrepancy = latestAudit ? latestAudit.discrepancy : null;

    // Financials
    const unitPrice = prod.unitPrice || 0;
    const costPrice = prod.costPrice !== undefined ? prod.costPrice : null;
    const hasCostData = costPrice !== null;
    const salesRevenue = Math.round(soldInPeriod * unitPrice * 100) / 100;
    const cogs = hasCostData ? Math.round(soldInPeriod * costPrice * 100) / 100 : null;
    const grossProfit = cogs !== null ? Math.round((salesRevenue - cogs) * 100) / 100 : null;

    historyItems.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      category: prod.category,
      deliveredInPeriod,
      soldInPeriod,
      returnedInPeriod: 0,
      damagedInPeriod: 0,
      transferredInPeriod,
      transferredOutPeriod,
      currentRemainingStock,
      lastPhysicalCount,
      discrepancy,
      unitPrice,
      costPrice,
      salesRevenue,
      cogs,
      grossProfit,
      hasCostData
    });
  }

  return historyItems;
}

export async function getShopCategoryAnalytics(
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<CategorySalesAnalytics[]> {
  const productHistory = await getShopProductHistory(shopId, startDate, endDate);
  const categories = Array.from(new Set(productHistory.map(p => p.category)));

  const categoryList: CategorySalesAnalytics[] = [];

  for (const cat of categories) {
    const catProducts = productHistory.filter(p => p.category === cat);
    const quantityDelivered = catProducts.reduce((sum, p) => sum + p.deliveredInPeriod, 0);
    const quantitySold = catProducts.reduce((sum, p) => sum + p.soldInPeriod, 0);
    const salesRevenue = Math.round(catProducts.reduce((sum, p) => sum + p.salesRevenue, 0) * 100) / 100;
    const remainingStock = catProducts.reduce((sum, p) => sum + p.currentRemainingStock, 0);

    const hasMissingCost = catProducts.some(p => p.soldInPeriod > 0 && !p.hasCostData);
    let cogs: number | null = null;
    let grossProfit: number | null = null;
    let grossMarginPercent: number | null = null;

    if (!hasMissingCost && quantitySold > 0) {
      cogs = Math.round(catProducts.reduce((sum, p) => sum + (p.cogs || 0), 0) * 100) / 100;
      grossProfit = Math.round((salesRevenue - cogs) * 100) / 100;
      grossMarginPercent = salesRevenue > 0 ? Math.round((grossProfit / salesRevenue) * 1000) / 10 : 0;
    } else if (quantitySold === 0) {
      cogs = 0;
      grossProfit = 0;
      grossMarginPercent = 0;
    }

    categoryList.push({
      category: cat,
      quantityDelivered,
      quantitySold,
      salesRevenue,
      cogs,
      grossProfit,
      grossMarginPercent,
      returnsQuantity: 0,
      damagedQuantity: 0,
      remainingStock,
      productCount: catProducts.length,
      products: catProducts,
      hasCompleteCostData: !hasMissingCost
    });
  }

  return categoryList;
}

export async function getShopTimelineEvents(
  shopId: string,
  startDate?: string,
  endDate?: string
): Promise<TimelineEvent[]> {
  const start = startDate || '2000-01-01';
  const end = endDate || new Date().toISOString().slice(0, 10);

  const [deliveries, reports, payments, transfers, audits] = await Promise.all([
    getDeliveries(),
    getDailyReports(),
    getPayments(),
    getStockTransfers(),
    getStockAudits()
  ]);

  const events: TimelineEvent[] = [];

  // 1. Deliveries
  deliveries
    .filter(d => d.shopId === shopId && d.deliveryDate >= start && d.deliveryDate <= end)
    .forEach(d => {
      const units = d.items.reduce((sum, i) => sum + i.quantity, 0);
      events.push({
        id: d.id,
        date: d.deliveryDate,
        type: 'delivery',
        title: `Supply Delivery #${d.id.slice(-6).toUpperCase()}`,
        reference: d.notes || 'Batch supply delivery',
        summary: `${units} accessory units delivered across ${d.items.length} items`,
        quantity: units,
        amount: null,
        responsibleUser: d.createdBy,
        notes: d.notes,
        badgeVariant: 'info',
        rawDetails: d as unknown as Record<string, unknown>
      });
    });

  // 2. Sales Reports
  reports
    .filter(r => r.shopId === shopId && r.reportDate >= start && r.reportDate <= end)
    .forEach(r => {
      events.push({
        id: r.id,
        date: r.reportDate,
        type: 'sale_report',
        title: r.isZeroSales ? 'Daily Report (Zero Sales Today)' : `Daily Sales Report (${r.totalQuantitySold} sold)`,
        reference: `Status: ${r.status.toUpperCase()}`,
        summary: r.isZeroSales ? 'Verified zero customer demand recorded' : `${r.totalQuantitySold} units sold across shelves`,
        quantity: r.isZeroSales ? 0 : r.totalQuantitySold,
        amount: null,
        responsibleUser: r.submittedBy,
        notes: r.notes,
        badgeVariant: r.status === 'approved' ? 'success' : 'warning',
        rawDetails: r as unknown as Record<string, unknown>
      });
    });

  // 3. Payments
  payments
    .filter(p => p.shop_id === shopId && p.payment_date >= start && p.payment_date <= end)
    .forEach(p => {
      events.push({
        id: p.id,
        date: p.payment_date,
        type: 'payment',
        title: `Payment Received (${p.payment_method})`,
        reference: p.payment_reference || 'Cash entry',
        summary: `₹${p.amount.toLocaleString('en-IN')} collected via ${p.payment_method}`,
        quantity: null,
        amount: p.amount,
        responsibleUser: p.recorded_by_name || 'Business Owner',
        notes: p.notes || undefined,
        badgeVariant: 'success',
        rawDetails: p as unknown as Record<string, unknown>
      });
    });

  // 4. Transfers
  transfers
    .filter(t => {
      const tDate = t.createdAt.slice(0, 10);
      return (t.fromShopId === shopId || t.toShopId === shopId) && tDate >= start && tDate <= end;
    })
    .forEach(t => {
      const isOut = t.fromShopId === shopId;
      events.push({
        id: t.id,
        date: t.createdAt.slice(0, 10),
        type: 'transfer',
        title: isOut ? `Stock Transfer Out (${t.quantity} units)` : `Stock Transfer In (${t.quantity} units)`,
        reference: isOut ? `Sent to ${t.toShopName || 'Partner Store'}` : `Received from ${t.fromShopName || 'Partner Store'}`,
        summary: `${t.quantity} units of ${t.productName || 'product'} ${isOut ? 'transferred out' : 'received'}`,
        quantity: isOut ? -t.quantity : t.quantity,
        amount: null,
        responsibleUser: 'Business Owner',
        notes: t.notes,
        badgeVariant: 'warning',
        rawDetails: t as unknown as Record<string, unknown>
      });
    });

  // 5. Audits
  audits
    .filter(a => a.shopId === shopId && a.countedAt >= start && a.countedAt <= end)
    .forEach(a => {
      events.push({
        id: a.id,
        date: a.countedAt,
        type: 'audit',
        title: `Physical Stock Count (Variance: ${a.discrepancy >= 0 ? '+' : ''}${a.discrepancy})`,
        reference: `Physical Count: ${a.physicalCount} | Expected: ${a.expectedCount}`,
        summary: a.discrepancy === 0 ? 'Physical shelf count matched expected stock exactly' : `Discrepancy of ${a.discrepancy} units recorded`,
        quantity: a.physicalCount,
        amount: null,
        responsibleUser: 'Store Staff',
        notes: a.notes,
        badgeVariant: a.discrepancy === 0 ? 'success' : 'neutral',
        rawDetails: a as unknown as Record<string, unknown>
      });
    });

  // Sort descending by date
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


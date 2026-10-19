import { 
  type StockBalance, 
  type Invoice, 
  type PaymentRecord, 
  type ProductCategory,
  type Database,
  type ShopBusinessSummary,
  type ProductHistoryItem,
  type CategorySalesAnalytics,
  type TimelineEvent,
  calculatePaymentStatus,
  calculateGrossProfit
} from '@crimpston/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

type ShopRow = Database['public']['Tables']['shops']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

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
  createdAt: string;
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

// Helper for local persistent storage
function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('rtr_data_sync', { detail: { key } }));
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

const DEFAULT_BUSINESS_ID = '4fba6fb7-4e1b-4106-ac84-908f821d73c3';
let cachedBusinessId: string | null = null;

async function getBusinessId(): Promise<string> {
  if (cachedBusinessId) return cachedBusinessId;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) return user.id;
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
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('shops').select('*').order('name');
      if (!error && data) {
        const shops: Shop[] = (data as unknown as ShopRow[]).map(s => ({
          id: s.id,
          name: s.name,
          code: s.code,
          address: s.address || '',
          phone: s.phone || '',
          isActive: s.is_active ?? true,
          assignedEmployees: [],
          createdAt: s.created_at
        }));
        setLocalItem(STORAGE_KEYS.SHOPS, shops);
        return shops;
      }
    } catch (err) {
      console.warn('Supabase getShops error, using local fallback:', err);
    }
  }
  return getLocalItem<Shop[]>(STORAGE_KEYS.SHOPS, []);
}

export async function saveShop(input: Omit<Shop, 'id'> & { id?: string }): Promise<Shop> {
  const shops = await getShops();
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
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
        const { data, error } = await supabase
          .from('shops')
          .insert({
            business_id: businessId,
            name: input.name,
            code: input.code,
            address: input.address,
            phone: input.phone,
            is_active: input.isActive ?? true
          })
          .select()
          .single();

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
      console.warn('Supabase saveShop error, using local fallback:', err);
    }
  }

  if (input.id) {
    const updated = shops.map(s => s.id === input.id ? { ...s, ...input } : s);
    setLocalItem(STORAGE_KEYS.SHOPS, updated);
    return updated.find(s => s.id === input.id)!;
  }

  const newShop: Shop = {
    ...input,
    id: generateId('shop'),
    createdAt: now
  };
  setLocalItem(STORAGE_KEYS.SHOPS, [...shops, newShop]);
  return newShop;
}

export async function deleteShop(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase && !id.startsWith('shop-')) {
    try {
      await supabase.from('shops').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteShop error:', err);
    }
  }
  const shops = await getShops();
  setLocalItem(STORAGE_KEYS.SHOPS, shops.filter(s => s.id !== id));
}

// ----------------------------------------------------
// PRODUCTS
// ----------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (!error && data) {
        const localProds = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
        const localMap = new Map(localProds.map(p => [p.id, p]));

        const prods: Product[] = (data as unknown as ProductRow[]).map(p => {
          const local = localMap.get(p.id);
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            category: p.category as ProductCategory,
            minStock: p.min_stock_threshold || 0,
            unitPrice: (p as any).unit_price ?? local?.unitPrice ?? 0,
            costPrice: (p as any).cost_price ?? local?.costPrice ?? null,
            isActive: p.is_active ?? true,
            createdAt: p.created_at
          };
        });
        setLocalItem(STORAGE_KEYS.PRODUCTS, prods);
        return prods;
      }
    } catch (err) {
      console.warn('Supabase getProducts error, using local fallback:', err);
    }
  }
  return getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
}

export async function saveProduct(input: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
  const products = await getProducts();
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
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
        const { data, error } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: input.name,
            sku: input.sku,
            category: input.category,
            unit_of_measure: 'piece',
            min_stock_threshold: input.minStock || 0,
            is_active: input.isActive ?? true
          })
          .select()
          .single();

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
      console.warn('Supabase saveProduct error, using local fallback:', err);
    }
  }

  if (input.id) {
    const updated = products.map(p => p.id === input.id ? { ...p, ...input } : p);
    setLocalItem(STORAGE_KEYS.PRODUCTS, updated);
    return updated.find(p => p.id === input.id)!;
  }

  const newProd: Product = {
    ...input,
    unitPrice: input.unitPrice ?? 0,
    costPrice: input.costPrice ?? null,
    id: generateId('prod'),
    createdAt: now
  };
  setLocalItem(STORAGE_KEYS.PRODUCTS, [...products, newProd]);
  return newProd;
}

export async function deleteProduct(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase && !id.startsWith('prod-')) {
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteProduct error:', err);
    }
  }
  const products = await getProducts();
  setLocalItem(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
}

// ----------------------------------------------------
// DELIVERIES
// ----------------------------------------------------
export async function getDeliveries(): Promise<DeliveryRecord[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, delivery_items(*)')
        .order('delivery_date', { ascending: false });

      if (!error && data) {
        const [shops, prods] = await Promise.all([getShops(), getProducts()]);
        const shopMap = new Map(shops.map(s => [s.id, s.name]));
        const prodMap = new Map(prods.map(p => [p.id, p]));

        const deliveries: DeliveryRecord[] = data.map((d: any) => ({
          id: d.id,
          shopId: d.shop_id,
          shopName: shopMap.get(d.shop_id) || 'Retail Store',
          deliveryDate: d.delivery_date,
          status: d.status as 'delivered' | 'pending' | 'cancelled',
          notes: d.notes || '',
          createdBy: 'Business Owner',
          items: (d.delivery_items || []).map((i: any) => ({
            productId: i.product_id,
            productName: prodMap.get(i.product_id)?.name || 'Product',
            productSku: prodMap.get(i.product_id)?.sku || '',
            quantity: i.quantity
          })),
          createdAt: d.created_at
        }));
        setLocalItem(STORAGE_KEYS.DELIVERIES, deliveries);
        return deliveries;
      }
    } catch (err) {
      console.warn('Supabase getDeliveries error, using local fallback:', err);
    }
  }
  return getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
}

export async function recordDelivery(input: Omit<DeliveryRecord, 'id' | 'createdAt'>): Promise<DeliveryRecord> {
  if (isSupabaseConfigured && supabase) {
    try {
      const businessId = await getBusinessId();
      const userId = await getCurrentUserId();

      // 1. Insert delivery record
      const { data: delivData, error: delivErr } = await supabase
        .from('deliveries')
        .insert({
          business_id: businessId,
          shop_id: input.shopId,
          delivery_date: input.deliveryDate,
          status: input.status,
          notes: input.notes || null,
          created_by: userId
        })
        .select()
        .single();

      if (delivErr) {
        console.error('Supabase recordDelivery error:', delivErr);
      } else if (delivData) {
        // 2. Insert items
        const itemsToInsert = input.items.map(item => ({
          delivery_id: delivData.id,
          product_id: item.productId,
          quantity: item.quantity
        }));

        await supabase.from('delivery_items').insert(itemsToInsert);

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
          await supabase.from('stock_movements').insert(movements);
        }

        const newDelivery: DeliveryRecord = {
          ...input,
          id: delivData.id,
          createdAt: delivData.created_at
        };
        const localDeliveries = getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
        setLocalItem(STORAGE_KEYS.DELIVERIES, [newDelivery, ...localDeliveries]);
        return newDelivery;
      }
    } catch (err) {
      console.warn('Supabase recordDelivery exception, using local fallback:', err);
    }
  }

  const deliveries = await getDeliveries();
  const newDelivery: DeliveryRecord = {
    ...input,
    id: generateId('deliv'),
    createdAt: new Date().toISOString()
  };
  setLocalItem(STORAGE_KEYS.DELIVERIES, [newDelivery, ...deliveries]);
  return newDelivery;
}

// ----------------------------------------------------
// DAILY REPORTS
// ----------------------------------------------------
export async function getDailyReports(): Promise<DailyReportRecord[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*, daily_report_items(*)')
        .order('report_date', { ascending: false });

      if (!error && data) {
        const [shops, prods] = await Promise.all([getShops(), getProducts()]);
        const shopMap = new Map(shops.map(s => [s.id, s.name]));
        const prodMap = new Map(prods.map(p => [p.id, p]));

        const reports: DailyReportRecord[] = data.map((r: any) => {
          const items = (r.daily_report_items || []).map((i: any) => ({
            productId: i.product_id,
            productName: prodMap.get(i.product_id)?.name || 'Product',
            quantitySold: i.quantity_sold,
            physicalCount: null
          }));
          const totalQuantitySold = items.reduce((s: number, i: any) => s + i.quantitySold, 0);

          return {
            id: r.id,
            shopId: r.shop_id,
            shopName: shopMap.get(r.shop_id) || 'Retail Store',
            reportDate: r.report_date,
            isZeroSales: r.is_zero_sales,
            status: r.status as 'submitted' | 'approved' | 'rejected',
            submittedBy: 'Store Staff',
            submittedAt: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            notes: r.notes || '',
            items,
            totalQuantitySold,
            createdAt: r.created_at
          };
        });
        setLocalItem(STORAGE_KEYS.REPORTS, reports);
        return reports;
      }
    } catch (err) {
      console.warn('Supabase getDailyReports error, using local fallback:', err);
    }
  }
  return getLocalItem<DailyReportRecord[]>(STORAGE_KEYS.REPORTS, []);
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
  return getLocalItem<StockTransferRecord[]>(STORAGE_KEYS.TRANSFERS, []);
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
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('stock_counts').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const audits: StockAuditRecord[] = data.map((c: any) => ({
          id: c.id,
          shopId: c.shop_id,
          productId: c.product_id,
          physicalCount: c.counted_quantity,
          expectedCount: c.expected_quantity,
          discrepancy: c.variance,
          countedAt: c.created_at.slice(0, 10),
          notes: c.notes || undefined
        }));
        setLocalItem(STORAGE_KEYS.AUDITS, audits);
        return audits;
      }
    } catch (err) {
      console.warn('Supabase getStockAudits error, fallback to local:', err);
    }
  }
  return getLocalItem<StockAuditRecord[]>(STORAGE_KEYS.AUDITS, []);
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
  return getLocalItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
}

export async function saveInvoice(input: Omit<Invoice, 'id'> & { id?: string }): Promise<Invoice> {
  const invoices = await getInvoices();
  if (input.id) {
    const updated = invoices.map(i => i.id === input.id ? { ...i, ...input } : i);
    setLocalItem(STORAGE_KEYS.INVOICES, updated);
    return updated.find(i => i.id === input.id)!;
  }
  const newInvoice: Invoice = {
    ...input,
    id: generateId('inv')
  };
  setLocalItem(STORAGE_KEYS.INVOICES, [newInvoice, ...invoices]);
  return newInvoice;
}

export async function getPayments(): Promise<PaymentRecord[]> {
  return getLocalItem<PaymentRecord[]>(STORAGE_KEYS.PAYMENTS, []);
}

export async function recordPayment(input: Omit<PaymentRecord, 'id' | 'created_at'>): Promise<PaymentRecord> {
  const payments = await getPayments();
  const newPayment: PaymentRecord = {
    ...input,
    id: generateId('pay'),
    created_at: new Date().toISOString()
  };
  setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...payments]);

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
export async function calculateStockBalances(shopIdFilter?: string): Promise<StockBalance[]> {
  const shops = await getShops();
  const products = await getProducts();
  const deliveries = await getDeliveries();
  const reports = await getDailyReports();
  const transfers = await getStockTransfers();
  const audits = await getStockAudits();

  const filteredShops = shopIdFilter && shopIdFilter !== 'all'
    ? shops.filter(s => s.id === shopIdFilter)
    : shops;

  const balances: StockBalance[] = [];

  for (const shop of filteredShops) {
    for (const prod of products) {
      // 1. Deliveries sum
      let totalDelivered = 0;
      for (const d of deliveries) {
        if (d.shopId === shop.id && d.status === 'delivered') {
          for (const item of d.items) {
            if (item.productId === prod.id) {
              totalDelivered += item.quantity;
            }
          }
        }
      }

      // 2. Sales sum from daily reports
      let confirmedSold = 0;
      let provisionalSold = 0;
      for (const rep of reports) {
        if (rep.shopId === shop.id && !rep.isZeroSales) {
          for (const item of rep.items) {
            if (item.productId === prod.id) {
              if (rep.status === 'approved') {
                confirmedSold += item.quantitySold;
              } else if (rep.status === 'submitted') {
                provisionalSold += item.quantitySold;
              }
            }
          }
        }
      }

      // 3. Transfers sum
      let transferredIn = 0;
      let transferredOut = 0;
      for (const trf of transfers) {
        if (trf.productId === prod.id) {
          if (trf.toShopId === shop.id) transferredIn += trf.quantity;
          if (trf.fromShopId === shop.id) transferredOut += trf.quantity;
        }
      }

      // 4. Expected stock calculation
      const expectedStock = totalDelivered - (confirmedSold + provisionalSold) + transferredIn - transferredOut;

      // Only include products that have stock, deliveries, or are active in catalog
      // 5. Audits
      const shopAudits = audits.filter(a => a.shopId === shop.id && a.productId === prod.id);
      const latestAudit = shopAudits[0] ?? null;

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


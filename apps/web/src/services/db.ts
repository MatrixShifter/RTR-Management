import { 
  type StockBalance, 
  type Invoice, 
  type PaymentRecord, 
  type ProductCategory,
  calculatePaymentStatus 
} from '@crimpston/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

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

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// ----------------------------------------------------
// SHOPS
// ----------------------------------------------------
export async function getShops(): Promise<Shop[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('shops').select('*').order('name');
    if (!error && data) {
      return data.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        address: s.address || '',
        phone: s.phone || '',
        isActive: s.is_active ?? true,
        assignedEmployees: [],
        createdAt: s.created_at
      }));
    }
  }
  return getLocalItem<Shop[]>(STORAGE_KEYS.SHOPS, []);
}

export async function saveShop(input: Omit<Shop, 'id'> & { id?: string }): Promise<Shop> {
  const shops = await getShops();
  const now = new Date().toISOString();

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
  const shops = await getShops();
  setLocalItem(STORAGE_KEYS.SHOPS, shops.filter(s => s.id !== id));
}

// ----------------------------------------------------
// PRODUCTS
// ----------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) {
      return data.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        minStock: p.min_stock_threshold || 0,
        isActive: p.is_active ?? true,
        createdAt: p.created_at
      }));
    }
  }
  return getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
}

export async function saveProduct(input: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
  const products = await getProducts();
  const now = new Date().toISOString();

  if (input.id) {
    const updated = products.map(p => p.id === input.id ? { ...p, ...input } : p);
    setLocalItem(STORAGE_KEYS.PRODUCTS, updated);
    return updated.find(p => p.id === input.id)!;
  }

  const newProd: Product = {
    ...input,
    id: generateId('prod'),
    createdAt: now
  };
  setLocalItem(STORAGE_KEYS.PRODUCTS, [...products, newProd]);
  return newProd;
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await getProducts();
  setLocalItem(STORAGE_KEYS.PRODUCTS, products.filter(p => p.id !== id));
}

// ----------------------------------------------------
// DELIVERIES
// ----------------------------------------------------
export async function getDeliveries(): Promise<DeliveryRecord[]> {
  return getLocalItem<DeliveryRecord[]>(STORAGE_KEYS.DELIVERIES, []);
}

export async function recordDelivery(input: Omit<DeliveryRecord, 'id' | 'createdAt'>): Promise<DeliveryRecord> {
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
  return getLocalItem<DailyReportRecord[]>(STORAGE_KEYS.REPORTS, []);
}

export async function submitDailyReport(input: Omit<DailyReportRecord, 'id' | 'createdAt'>): Promise<DailyReportRecord> {
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
  return getLocalItem<StockAuditRecord[]>(STORAGE_KEYS.AUDITS, []);
}

export async function recordStockAudit(input: Omit<StockAuditRecord, 'id'>): Promise<StockAuditRecord> {
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

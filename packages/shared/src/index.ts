import { z } from 'zod';

// Roles & Permissions & Demo Config
export const DEMO_USERNAME = 'demo-owner';
export const DEMO_PASSWORD_PLACEHOLDER = 'Configure-a-unique-demo-password';

export const UserRoleSchema = z.enum(['owner', 'employee', 'demo']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Business & Membership
export const BusinessProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  timezone: z.string().default('Asia/Kolkata'),
  reportCutoffTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format must be HH:MM').default('21:00'),
  created_at: z.string().optional()
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

// Shops
export const ShopSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().min(1, 'Shop name is required').max(100),
  code: z.string().min(1, 'Shop code is required').max(20),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});
export type Shop = z.infer<typeof ShopSchema>;

export const CreateShopSchema = ShopSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});
export type CreateShopInput = z.infer<typeof CreateShopSchema>;

// Products
export const ProductCategorySchema = z.enum([
  'Mobile Cases',
  'Tempered Glass',
  'Chargers & Adapters',
  'USB Cables',
  'Earphones & Audio',
  'Holders & Mounts',
  'Power Banks',
  'Other Accessories'
]);
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  name: z.string().min(1, 'Product name is required').max(150),
  sku: z.string().min(1, 'SKU is required').max(50),
  category: ProductCategorySchema,
  unit_of_measure: z.string().default('piece'),
  min_stock_threshold: z.number().int().nonnegative().default(5),
  unit_price: z.number().nonnegative().default(0),
  cost_price: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

// Deliveries
export const PaymentStatusSchema = z.enum(['fully_paid', 'partially_paid', 'unpaid']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const DeliveryStatusSchema = z.enum(['pending', 'delivered', 'cancelled']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const DeliveryItemSchema = z.object({
  id: z.string().uuid().optional(),
  delivery_id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unit_price: z.number().nonnegative('Unit price must be non-negative').default(0).optional(),
  total_price: z.number().nonnegative().optional(),
  notes: z.string().max(255).optional().nullable()
});
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;

export const CreateDeliverySchema = z.object({
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  status: DeliveryStatusSchema.default('delivered').optional(),
  total_amount: z.number().nonnegative().optional(),
  amount_paid: z.number().nonnegative().optional(),
  payment_status: PaymentStatusSchema.optional(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(DeliveryItemSchema).min(1, 'At least one product item is required'),
  idempotency_key: z.string().uuid().optional()
});
export type CreateDeliveryInput = z.infer<typeof CreateDeliverySchema>;

// Daily Reports
export const DailyReportStatusSchema = z.enum(['submitted', 'approved', 'rejected']);
export type DailyReportStatus = z.infer<typeof DailyReportStatusSchema>;

export const DailyReportItemSchema = z.object({
  id: z.string().uuid().optional(),
  report_id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  quantity_sold: z.number().int().nonnegative('Quantity sold cannot be negative'),
  physical_count: z.number().int().nonnegative('Physical count cannot be negative').optional().nullable(),
  notes: z.string().max(255).optional().nullable()
});
export type DailyReportItem = z.infer<typeof DailyReportItemSchema>;

export const CreateDailyReportSchema = z.object({
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  is_zero_sales: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(DailyReportItemSchema),
  idempotency_key: z.string().uuid().optional()
}).refine(data => {
  if (data.is_zero_sales) {
    return true; // zero sales can have 0 items or items with 0 sold
  }
  return data.items.length > 0 && data.items.some(i => i.quantity_sold > 0);
}, {
  message: 'Non-zero sales reports must have at least one product with quantity sold > 0. Otherwise check "Zero Sales Today".',
  path: ['items']
});
export type CreateDailyReportInput = z.infer<typeof CreateDailyReportSchema>;

// Inventory Ledger & Shop-wise Balances
export const StockBalanceSchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_sku: z.string(),
  category: ProductCategorySchema,
  total_delivered: z.number().int().nonnegative(),
  confirmed_sold: z.number().int().nonnegative(),
  provisional_sold: z.number().int().nonnegative(),
  total_returned: z.number().int().nonnegative().default(0),
  total_damaged: z.number().int().nonnegative().default(0),
  total_transferred_in: z.number().int().nonnegative().default(0),
  total_transferred_out: z.number().int().nonnegative().default(0),
  expected_stock: z.number().int(),
  last_physical_count: z.number().int().nullable().optional(),
  last_counted_at: z.string().nullable().optional(),
  discrepancy: z.number().int().nullable().optional(), // physical - expected
  min_stock_threshold: z.number().int()
});
export type StockBalance = z.infer<typeof StockBalanceSchema>;

// Shop Stock Transfer
export const CreateStockTransferSchema = z.object({
  business_id: z.string().uuid(),
  from_shop_id: z.string().uuid(),
  to_shop_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('Transfer quantity must be positive'),
  notes: z.string().max(255).optional().nullable(),
  idempotency_key: z.string().uuid().optional()
}).refine(data => data.from_shop_id !== data.to_shop_id, {
  message: 'Source and destination shops must be different',
  path: ['to_shop_id']
});
export type CreateStockTransferInput = z.infer<typeof CreateStockTransferSchema>;

// ==========================================
// SHOP-WISE CASH & PAYMENT TRACKING
// ==========================================
export const PaymentMethodSchema = z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;


export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  shop_name: z.string().optional(),
  delivery_id: z.string().uuid().optional().nullable(),
  invoice_number: z.string().min(1).max(50),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  total_amount: z.number().nonnegative('Total amount must be non-negative'),
  amount_paid: z.number().nonnegative().default(0),
  outstanding_amount: z.number().default(0),
  status: PaymentStatusSchema,
  notes: z.string().optional().nullable(),
  created_at: z.string().optional()
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const CreateInvoiceSchema = z.object({
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  delivery_id: z.string().uuid().optional().nullable(),
  invoice_number: z.string().min(1).max(50),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  total_amount: z.number().positive('Invoice total must be greater than zero'),
  notes: z.string().max(500).optional().nullable(),
  idempotency_key: z.string().uuid().optional()
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const PaymentRecordSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  shop_name: z.string().optional(),
  delivery_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  amount: z.number().positive('Payment amount must be positive'),
  payment_method: PaymentMethodSchema.default('CASH'),
  payment_reference: z.string().max(100).optional().nullable(),
  status: z.enum(['COMPLETED', 'REVERSED', 'REFUNDED']).default('COMPLETED'),
  notes: z.string().max(500).optional().nullable(),
  recorded_by_name: z.string().optional(),
  created_at: z.string().optional()
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

export const CreatePaymentSchema = z.object({
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  delivery_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  payment_method: PaymentMethodSchema.default('CASH'),
  payment_reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  idempotency_key: z.string().uuid().optional()
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export interface ShopPaymentSummary {
  shop_id: string;
  shop_name: string;
  shop_code: string;
  total_due: number;
  total_paid: number;
  outstanding_balance: number;
  status: PaymentStatus;
  badge_color: 'green' | 'yellow' | 'grey';
  last_payment_date: string | null;
  payment_count: number;
}

/**
 * Mandatory Payment Status Color & Calculation Rules:
 * - GREEN: Fully Paid (Outstanding is 0)
 * - YELLOW / AMBER: Partially Paid (Some payment received, outstanding > 0)
 * - NEUTRAL GREY: Unpaid (No payment received, amount_paid is 0)
 * - NEVER USE RED for payment status!
 */
export function calculatePaymentStatus(totalDue: number, totalPaid: number): {
  status: PaymentStatus;
  outstandingBalance: number;
  outstandingAmount: number;
  badgeColor: 'green' | 'yellow' | 'grey';
  colorTheme: 'GREEN' | 'YELLOW' | 'GREY';
  statusLabel: string;
  badgeClasses: {
    bg: string;
    text: string;
    border: string;
  };
} {
  const roundedDue = Math.round(totalDue * 100) / 100;
  const roundedPaid = Math.round(totalPaid * 100) / 100;
  const outstanding = Math.max(0, Math.round((roundedDue - roundedPaid) * 100) / 100);

  if (roundedPaid >= roundedDue && roundedDue > 0) {
    return {
      status: 'fully_paid',
      outstandingBalance: 0,
      outstandingAmount: 0,
      badgeColor: 'green',
      colorTheme: 'GREEN',
      statusLabel: 'Fully Paid',
      badgeClasses: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
      }
    };
  }

  if (roundedPaid > 0 && roundedPaid < roundedDue) {
    return {
      status: 'partially_paid',
      outstandingBalance: outstanding,
      outstandingAmount: outstanding,
      badgeColor: 'yellow',
      colorTheme: 'YELLOW',
      statusLabel: 'Partially Paid',
      badgeClasses: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200'
      }
    };
  }

  return {
    status: 'unpaid',
    outstandingBalance: roundedDue,
    outstandingAmount: roundedDue,
    badgeColor: 'grey',
    colorTheme: 'GREY',
    statusLabel: 'Unpaid',
    badgeClasses: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200'
    }
  };
}

// ==========================================
// RECORD PRIORITY & DETERMINISTIC SORTING
// ==========================================

export type RecordPriorityRank = 1 | 2 | 3 | 4;

export type RecordSortField = 'date' | 'shop' | 'product' | 'quantity' | 'unitPrice' | 'pendingAmount';
export type RecordSortDirection = 'asc' | 'desc';

export interface RecordPriorityInput {
  deliveryStatus?: 'delivered' | 'pending' | 'cancelled' | string;
  totalAmount?: number | null;
  pendingAmount?: number | null;
  amountPaid?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  date?: string;
  createdAt?: string;
  id?: string;
  shopName?: string;
  productName?: string;
}

/**
 * Calculates deterministic priority rank for business records in RTR Wholesale Management:
 *
 * 1. Pending: Incomplete delivery or outstanding payment (specifically: delivery is pending and unpaid).
 * 2. Partially completed / partially paid: Records in progress or with remaining balance
 *    (e.g., delivered with partial payment, or delivery pending with partial payment or prepaid).
 * 3. Delivered but payment pending: Delivery is complete, but customer still owes full money.
 * 4. Completed and fully settled: Delivery is complete and outstanding payment is zero.
 */
export function getRecordPriority(record: RecordPriorityInput): RecordPriorityRank {
  const rawStatus = String(record.deliveryStatus ?? (record as any).delivery_status ?? (record as any).status ?? '').toLowerCase();
  const deliveryStatus: 'delivered' | 'pending' | 'cancelled' = 
    rawStatus === 'delivered' || rawStatus === 'completed' 
      ? 'delivered' 
      : (rawStatus === 'cancelled' ? 'cancelled' : 'pending');

  // Resolve total amount from totalAmount or quantity * unitPrice
  let total = Number(record.totalAmount);
  if (isNaN(total) || total <= 0) {
    const qty = Number(record.quantity) || 0;
    const price = Number(record.unitPrice) || 0;
    total = Math.max(0, qty * price);
  } else {
    total = Math.max(0, total);
  }

  const pending = Math.max(0, Number(record.pendingAmount) || 0);

  // Derive paid amount
  let paid = 0;
  if (record.amountPaid !== undefined && record.amountPaid !== null && !isNaN(Number(record.amountPaid))) {
    paid = Math.max(0, Number(record.amountPaid));
  } else if (total > 0) {
    paid = Math.max(0, Math.round((total - pending) * 100) / 100);
  }

  const isDeliveryComplete = deliveryStatus === 'delivered';
  const isDeliveryPending = deliveryStatus === 'pending';
  const isFullySettled = pending <= 0;
  const isPartiallyPaid = paid > 0 && pending > 0;

  // 4. Completed and fully settled: delivery is complete (or cancelled) and outstanding payment is zero.
  if ((isDeliveryComplete || deliveryStatus === 'cancelled') && isFullySettled) {
    return 4;
  }

  // 2. Partially completed / partially paid:
  // - Records that are in progress or have a remaining balance (partial payment recorded)
  // - Or delivery is pending but payment is already settled (prepaid delivery in progress)
  if (isPartiallyPaid || (isDeliveryPending && isFullySettled)) {
    return 2;
  }

  // 3. Delivered but payment pending: delivery is complete, but customer still owes full money (unpaid)
  if (isDeliveryComplete && pending > 0) {
    return 3;
  }

  // 1. Pending: records with incomplete delivery and unpaid balance
  return 1;
}

/**
 * Deterministic multi-tier comparator for business records:
 * 1. Primary order: Priority Group Rank (1 -> 2 -> 3 -> 4)
 * 2. Secondary order: Selected sort field (defaults to date descending, newest first)
 * 3. Tie-breaker: Newer date first, newer createdAt first, then id
 */
export function compareBusinessRecords<T extends RecordPriorityInput>(
  a: T,
  b: T,
  sortField: RecordSortField = 'date',
  sortDirection: RecordSortDirection = 'desc'
): number {
  // 1. Primary Sort: Priority Group Rank
  const rankA = getRecordPriority(a);
  const rankB = getRecordPriority(b);
  if (rankA !== rankB) {
    return rankA - rankB; // Lower rank = higher priority at top
  }

  // 2. Secondary Sort: Selected field within the same priority group
  let comparison = 0;
  switch (sortField) {
    case 'date':
      comparison = (b.date || '').localeCompare(a.date || '');
      if (comparison === 0) {
        comparison = (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return sortDirection === 'asc' ? -comparison : comparison;

    case 'shop':
      comparison = (a.shopName || '').localeCompare(b.shopName || '');
      break;

    case 'product':
      comparison = (a.productName || '').localeCompare(b.productName || '');
      break;

    case 'quantity':
      comparison = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      break;

    case 'unitPrice':
      comparison = (Number(a.unitPrice) || 0) - (Number(b.unitPrice) || 0);
      break;

    case 'pendingAmount':
      comparison = (Number(a.pendingAmount) || 0) - (Number(b.pendingAmount) || 0);
      break;

    default:
      comparison = (b.date || '').localeCompare(a.date || '');
  }

  if (comparison !== 0) {
    return sortDirection === 'asc' ? comparison : -comparison;
  }

  // Deterministic fallback tie-breaker: newest date first, then newest createdAt, then id
  const dateComp = (b.date || '').localeCompare(a.date || '');
  if (dateComp !== 0) return dateComp;

  const createdComp = (b.createdAt || '').localeCompare(a.createdAt || '');
  if (createdComp !== 0) return createdComp;

  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Sorts an array of business records according to required wholesale priority order.
 */
export function sortBusinessRecords<T extends RecordPriorityInput>(
  records: T[],
  sortField: RecordSortField = 'date',
  sortDirection: RecordSortDirection = 'desc'
): T[] {
  return [...records].sort((a, b) => compareBusinessRecords(a, b, sortField, sortDirection));
}


// Pending Work Model (Task List)
export const PendingReportTaskSchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string(),
  shop_code: z.string(),
  report_date: z.string(),
  status: z.enum(['missing', 'awaiting_review', 'rejected_needs_correction']),
  assigned_employees: z.array(z.string()),
  cutoff_time: z.string()
});
export type PendingReportTask = z.infer<typeof PendingReportTaskSchema>;

// Health & System Info
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

// ==========================================
// HISTORICAL SEARCH & SHOP-WISE ANALYTICS
// ==========================================
export type DateRangePreset = 
  | 'all_time' 
  | 'last_30_days' 
  | 'last_6_months' 
  | 'last_1_year' 
  | 'last_2_years' 
  | 'this_year' 
  | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset: DateRangePreset;
  label: string;
}

export function getDateRangeFromPreset(
  preset: DateRangePreset, 
  customStart?: string, 
  customEnd?: string,
  baseDate: Date = new Date()
): DateRange {
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const end = formatDate(baseDate);

  if (preset === 'custom') {
    const s = customStart || formatDate(new Date(baseDate.getTime() - 30 * 24 * 60 * 60 * 1000));
    const e = customEnd || end;
    return { startDate: s, endDate: e, preset, label: `Custom (${s} to ${e})` };
  }

  if (preset === 'all_time') {
    return { startDate: '2000-01-01', endDate: end, preset, label: 'All Time' };
  }

  if (preset === 'last_30_days') {
    const start = new Date(baseDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: formatDate(start), endDate: end, preset, label: 'Last 30 Days' };
  }

  if (preset === 'last_6_months') {
    const start = new Date(baseDate);
    start.setMonth(start.getMonth() - 6);
    return { startDate: formatDate(start), endDate: end, preset, label: 'Last 6 Months' };
  }

  if (preset === 'last_1_year') {
    const start = new Date(baseDate);
    start.setFullYear(start.getFullYear() - 1);
    return { startDate: formatDate(start), endDate: end, preset, label: 'Last 1 Year' };
  }

  if (preset === 'last_2_years') {
    const start = new Date(baseDate);
    start.setFullYear(start.getFullYear() - 2);
    return { startDate: formatDate(start), endDate: end, preset, label: 'Last 2 Years' };
  }

  if (preset === 'this_year') {
    const start = new Date(baseDate.getFullYear(), 0, 1);
    return { startDate: formatDate(start), endDate: end, preset, label: `This Year (${baseDate.getFullYear()})` };
  }

  return { startDate: '2000-01-01', endDate: end, preset: 'all_time', label: 'All Time' };
}

export interface ShopBusinessSummary {
  shopId: string;
  shopName: string;
  shopCode: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  deliveriesCount: number;
  totalDeliveredUnits: number;
  totalSoldUnits: number;
  expectedRemainingStock: number;
  totalDiscrepancy: number;
  salesRevenue: number;
  costOfGoodsSold: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;
  profitStatus: 'calculated' | 'missing_cost_data';
  profitStatusMessage: string;
  totalInvoiced: number;
  totalPayments: number;
  outstandingBalance: number;
  paymentStatus: PaymentStatus;
  returnsUnits: number;
  damagedUnits: number;
  transfersInUnits: number;
  transfersOutUnits: number;
}

export interface ProductHistoryItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  deliveredInPeriod: number;
  soldInPeriod: number;
  returnedInPeriod: number;
  damagedInPeriod: number;
  transferredInPeriod: number;
  transferredOutPeriod: number;
  currentRemainingStock: number;
  lastPhysicalCount: number | null;
  discrepancy: number | null;
  unitPrice: number;
  costPrice: number | null;
  salesRevenue: number;
  cogs: number | null;
  grossProfit: number | null;
  hasCostData: boolean;
}

export interface CategorySalesAnalytics {
  category: string;
  quantityDelivered: number;
  quantitySold: number;
  salesRevenue: number;
  cogs: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;
  returnsQuantity: number;
  damagedQuantity: number;
  remainingStock: number;
  productCount: number;
  products: ProductHistoryItem[];
  hasCompleteCostData: boolean;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'delivery' | 'sale_report' | 'payment' | 'transfer' | 'audit' | 'adjustment';
  title: string;
  reference: string;
  summary: string;
  quantity: number | null;
  amount: number | null;
  responsibleUser: string;
  notes?: string;
  badgeVariant: 'success' | 'warning' | 'info' | 'neutral';
  rawDetails: Record<string, unknown>;
}

/**
 * Gross Profit Calculation with Missing Cost Data Safeguard:
 * Formula: Gross Profit = Sales Revenue - Cost of Goods Sold
 * If cost of goods sold is null or incomplete, profit must NOT be fabricated.
 */
export function calculateGrossProfit(
  revenue: number, 
  cogs: number | null
): {
  grossProfit: number | null;
  marginPercent: number | null;
  status: 'calculated' | 'missing_cost_data';
  message: string;
} {
  if (cogs === null || cogs === undefined) {
    return {
      grossProfit: null,
      marginPercent: null,
      status: 'missing_cost_data',
      message: 'Profit unavailable — cost data missing'
    };
  }

  const profit = Math.round((revenue - cogs) * 100) / 100;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  return {
    grossProfit: profit,
    marginPercent: margin,
    status: 'calculated',
    message: `₹${profit.toLocaleString('en-IN')} (${margin}% margin)`
  };
}

// Confirmed Demo Entity Identifiers (Production Handover Exclusion)
export const CONFIRMED_DEMO_SHOP_ID = '4ab21b42-209a-4e16-ae77-8c869ab973ed';
export const CONFIRMED_DEMO_PRODUCT_ID = '0cea2553-1467-4443-b329-4caf997b56d2';

export function isDemoShop(shop?: { id?: string | null; code?: string | null; name?: string | null } | null): boolean {
  if (!shop) return false;
  if (shop.id === CONFIRMED_DEMO_SHOP_ID) return true;
  if (typeof shop.code === 'string' && shop.code.trim().toUpperCase().startsWith('DEMO')) return true;
  if (typeof shop.name === 'string') {
    const trimmed = shop.name.trim();
    if (/^(\[DEMO\]|DEMO\s*-)/i.test(trimmed)) return true;
  }
  return false;
}

export function isDemoProduct(prod?: { id?: string | null; sku?: string | null; name?: string | null } | null): boolean {
  if (!prod) return false;
  if (prod.id === CONFIRMED_DEMO_PRODUCT_ID) return true;
  if (typeof prod.sku === 'string' && prod.sku.trim().toUpperCase().startsWith('DEMO')) return true;
  if (typeof prod.name === 'string') {
    const trimmed = prod.name.trim();
    if (/^(\[DEMO\]|DEMO\s*-)/i.test(trimmed)) return true;
  }
  return false;
}

// Record & Payment Mutation Validation Schemas
export const BaseBusinessRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  shopName: z.string().min(1, 'Shop name is required').max(100),
  shopId: z.string().optional().nullable(),
  productName: z.string().min(1, 'Product name is required').max(150),
  productId: z.string().optional().nullable(),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than zero').default(1),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  totalAmount: z.number().nonnegative('Total amount cannot be negative').optional(),
  customerPrice: z.number().nonnegative('Customer price cannot be negative').optional().nullable(),
  deliveryStatus: z.enum(['delivered', 'pending', 'cancelled']).default('pending'),
  pendingAmount: z.number().nonnegative('Pending amount cannot be negative').optional(),
  paidAmount: z.number().nonnegative('Paid amount cannot be negative').optional(),
  notes: z.string().max(1000).optional().nullable()
});

export const SaveBusinessRecordSchema = BaseBusinessRecordSchema;
export type SaveBusinessRecordSchemaType = z.infer<typeof SaveBusinessRecordSchema>;

// Strict Production Schema with Demo Exclusion Enforced
export const ProductionSaveBusinessRecordSchema = BaseBusinessRecordSchema.refine(data => !isDemoShop({ id: data.shopId, name: data.shopName }), {
  message: 'Cannot create or record transactions for demo or excluded shops.',
  path: ['shopName']
}).refine(data => !isDemoProduct({ id: data.productId, name: data.productName }), {
  message: 'Cannot create or record transactions for demo or excluded products.',
  path: ['productName']
});
export type ProductionSaveBusinessRecordSchemaType = z.infer<typeof ProductionSaveBusinessRecordSchema>;

/**
 * Authoritative financial profit calculation for a wholesale record:
 * Profit = Customer Price - Amount
 * Returns null if Customer Price was not recorded (historical compatibility).
 */
export function calculateRecordProfit(amount: number, customerPrice?: number | null): number | null {
  if (customerPrice === undefined || customerPrice === null || isNaN(Number(customerPrice))) {
    return null;
  }
  return Math.round((Number(customerPrice) - Number(amount)) * 100) / 100;
}

export const UpdateBusinessRecordSchema = BaseBusinessRecordSchema.extend({
  deliveryId: z.string().min(1, 'Delivery ID is required')
});
export type UpdateBusinessRecordSchemaType = z.infer<typeof UpdateBusinessRecordSchema>;

export const SettlePaymentSchema = z.object({
  deliveryId: z.string().min(1, 'Delivery ID is required'),
  amountToPay: z.number().positive('Settlement amount must be positive').optional()
});
export type SettlePaymentSchemaType = z.infer<typeof SettlePaymentSchema>;

// Database Schema Types
export * from './database.types.js';

// Database Capacity and Storage Error Handling
export * from './storageErrors.js';
export {
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  isDatabaseCapacityError,
  DatabaseCapacityError,
  type DatabaseStorageHealth,
  type ErrorLike,
  evaluateStorageHealth
} from './storageErrors.js';


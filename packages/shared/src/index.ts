import { z } from 'zod';

// Roles & Permissions
export const UserRoleSchema = z.enum(['owner', 'employee']);
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
export const DeliveryStatusSchema = z.enum(['pending', 'delivered', 'cancelled']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const DeliveryItemSchema = z.object({
  id: z.string().uuid().optional(),
  delivery_id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  notes: z.string().max(255).optional().nullable()
});
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;

export const CreateDeliverySchema = z.object({
  business_id: z.string().uuid(),
  shop_id: z.string().uuid(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
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

// Inventory Ledger & Balances
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
  expected_stock: z.number().int(),
  last_physical_count: z.number().int().nullable().optional(),
  last_counted_at: z.string().nullable().optional(),
  min_stock_threshold: z.number().int()
});
export type StockBalance = z.infer<typeof StockBalanceSchema>;

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

-- ==============================================================================
-- RTR Wholesale Management — Safe Demo Data Cleanup Script
-- ==============================================================================
--
-- IMPORTANT SAFETY RULES:
-- 1. BACKUP FIRST: Export a database snapshot via Supabase Dashboard -> Database -> Backups,
--    or execute: pg_dump -h <db-host> -U postgres -d postgres > rtr_backup_$(date +%F).sql
-- 2. DRY-RUN FIRST: Step 1 below is a non-destructive SELECT query to preview the exact rows.
-- 3. CASCADING SAFETY: Deletes are sequenced in reverse foreign-key order.
-- 4. BUSINESS DATA PRESERVATION: Only rows explicitly matching demo prefixes ('DEMO%', '[DEMO]%')
--    or created by demo accounts are affected. Legitimate customer records are NEVER touched.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: DRY RUN — PREVIEW CONFIRMED DEMO RECORDS (NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------------
-- Run these SELECT queries first to inspect and confirm what will be removed:

-- 1.1. Demo Shops
SELECT id, name, code, created_at 
FROM public.shops 
WHERE code LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%';

-- 1.2. Demo Products
SELECT id, name, sku, category, created_at 
FROM public.products 
WHERE sku LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%';

-- 1.3. Demo Deliveries (Deliveries associated with demo shops or products)
SELECT d.id, d.delivery_date, d.status, s.name as shop_name, d.notes
FROM public.deliveries d
LEFT JOIN public.shops s ON d.shop_id = s.id
WHERE s.code LIKE 'DEMO%' OR s.name LIKE '[DEMO]%' OR d.notes LIKE '%demo%';

-- 1.4. Demo Invoices and Payments
SELECT i.id, i.invoice_number, i.total_amount, i.status 
FROM public.invoices i
JOIN public.shops s ON i.shop_id = s.id
WHERE s.code LIKE 'DEMO%' OR s.name LIKE '[DEMO]%';

-- ------------------------------------------------------------------------------
-- STEP 2: REVIEWED CLEANUP EXECUTION (REQUIRES OWNER APPROVAL)
-- ------------------------------------------------------------------------------
-- Only execute the block below in Supabase SQL Editor once you have reviewed Step 1 results:

BEGIN;

-- 2.1. Remove payments tied to demo invoices/deliveries
DELETE FROM public.payments
WHERE delivery_id IN (
    SELECT d.id FROM public.deliveries d
    JOIN public.shops s ON d.shop_id = s.id
    WHERE s.code LIKE 'DEMO%' OR s.name LIKE '[DEMO]%' OR s.name LIKE 'DEMO -%'
);

-- 2.2. Remove invoices tied to demo shops
DELETE FROM public.invoices
WHERE shop_id IN (
    SELECT id FROM public.shops 
    WHERE code LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%'
);

-- 2.3. Remove stock movements referencing demo deliveries
DELETE FROM public.stock_movements
WHERE reference_id IN (
    SELECT d.id FROM public.deliveries d
    JOIN public.shops s ON d.shop_id = s.id
    WHERE s.code LIKE 'DEMO%' OR s.name LIKE '[DEMO]%' OR s.name LIKE 'DEMO -%'
);

-- 2.4. Remove delivery items tied to demo deliveries
DELETE FROM public.delivery_items
WHERE delivery_id IN (
    SELECT d.id FROM public.deliveries d
    JOIN public.shops s ON d.shop_id = s.id
    WHERE s.code LIKE 'DEMO%' OR s.name LIKE '[DEMO]%' OR s.name LIKE 'DEMO -%'
);

-- 2.5. Remove demo deliveries
DELETE FROM public.deliveries
WHERE shop_id IN (
    SELECT id FROM public.shops 
    WHERE code LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%'
);

-- 2.6. Remove demo products (Strictly with DEMO SKU prefix)
DELETE FROM public.products
WHERE sku LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%';

-- 2.7. Remove demo shops (Strictly with DEMO code prefix)
DELETE FROM public.shops
WHERE code LIKE 'DEMO%' OR name LIKE '[DEMO]%' OR name LIKE 'DEMO -%';

-- Verify table counts before committing:
SELECT 
    (SELECT COUNT(*) FROM public.shops) as remaining_shops,
    (SELECT COUNT(*) FROM public.products) as remaining_products,
    (SELECT COUNT(*) FROM public.deliveries) as remaining_deliveries;

COMMIT;

-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT SYSTEM
-- SAFE LIVE DATABASE RECONCILIATION & UPGRADE SCRIPT
-- FILE: database/migration_existing_db.sql
-- ==============================================================================
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- to reconcile and upgrade an existing database without loss of legitimate data.
--
-- Actions performed safely:
-- 1. Adds unit_price & cost_price to products if missing.
-- 2. Adds financial tracking columns (total_amount, amount_paid, outstanding_amount,
--    payment_status) to deliveries if missing.
-- 3. Adds unit_price and computed total_price to delivery_items if missing.
-- 4. Creates invoices and payments tables if they do not exist yet.
-- 5. Backfills existing deliveries and delivery_items with price/quantity data
--    from existing notes metadata.
-- 6. Creates automatic triggers for delivery totals and payment balances.
-- 7. Creates canonical views (v_business_records, v_shop_payment_balances, v_shop_inventory_balances).
-- 8. Configures RLS policies and grants least-privilege access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: UPGRADE PRODUCTS TABLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0);

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT NULL CHECK (cost_price >= 0);

-- ------------------------------------------------------------------------------
-- STEP 2: UPGRADE DELIVERIES TABLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0);

ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0);

ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'fully_paid'));

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'outstanding_amount'
  ) THEN
    ALTER TABLE public.deliveries 
      ADD COLUMN outstanding_amount NUMERIC(12, 2) GENERATED ALWAYS AS (GREATEST(0.00, total_amount - amount_paid)) STORED;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 3: UPGRADE DELIVERY_ITEMS TABLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.delivery_items 
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0);

ALTER TABLE public.delivery_items 
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) DEFAULT NULL CHECK (unit_cost >= 0);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'delivery_items' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE public.delivery_items 
      ADD COLUMN total_price NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 4: CREATE INVOICES & PAYMENTS TABLES IF NOT EXISTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    outstanding_amount NUMERIC(12, 2) GENERATED ALWAYS AS (GREATEST(0.00, total_amount - amount_paid)) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'fully_paid')),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_invoice_number UNIQUE (business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN (
        'CASH',
        'UPI',
        'BANK_TRANSFER',
        'CHEQUE',
        'OTHER'
    )),
    payment_reference VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERSED', 'REFUNDED')),
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 5: BACKFILL HISTORICAL DATA FROM NOTES METADATA
-- ------------------------------------------------------------------------------

-- Backfill delivery_items.unit_price from notes column if notes was used as string price
UPDATE public.delivery_items
SET unit_price = notes::numeric
WHERE (unit_price = 0 OR unit_price IS NULL)
  AND notes ~ '^[0-9]+(\.[0-9]+)?$';

-- Backfill delivery_items.unit_price from deliveries.notes JSON metadata
UPDATE public.delivery_items di
SET unit_price = (item->>'unitPrice')::numeric
FROM public.deliveries d,
     jsonb_array_elements(
       CASE WHEN d.notes ~ '^\s*\{' THEN (d.notes::jsonb)->'items' ELSE '[]'::jsonb END
     ) AS item
WHERE di.delivery_id = d.id
  AND (item->>'productId')::uuid = di.product_id
  AND (di.unit_price = 0 OR di.unit_price IS NULL)
  AND (item->>'unitPrice') ~ '^[0-9]+(\.[0-9]+)?$';

-- Backfill deliveries total_amount from items sum
UPDATE public.deliveries d
SET total_amount = sub.sum_total
FROM (
  SELECT delivery_id, SUM(quantity * unit_price) AS sum_total
  FROM public.delivery_items
  GROUP BY delivery_id
) sub
WHERE d.id = sub.delivery_id
  AND (d.total_amount = 0 OR d.total_amount IS NULL)
  AND sub.sum_total > 0;

-- Backfill deliveries financial data from deliveries.notes JSON metadata if items was empty
UPDATE public.deliveries
SET total_amount = COALESCE(((notes::jsonb)->>'totalAmount')::numeric, total_amount),
    amount_paid = COALESCE(((notes::jsonb)->>'paidAmount')::numeric, amount_paid),
    payment_status = CASE 
      WHEN COALESCE(((notes::jsonb)->>'pendingAmount')::numeric, 0) = 0 THEN 'fully_paid'
      WHEN COALESCE(((notes::jsonb)->>'paidAmount')::numeric, 0) > 0 THEN 'partially_paid'
      ELSE 'unpaid'
    END
WHERE notes ~ '^\s*\{'
  AND (total_amount = 0 OR total_amount IS NULL);

-- ------------------------------------------------------------------------------
-- STEP 6: CREATE TRIGGERS & BUSINESS INTEGRITY FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_delivery_items_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deliv_id UUID;
  v_computed_total NUMERIC(12, 2);
BEGIN
  v_deliv_id := COALESCE(NEW.delivery_id, OLD.delivery_id);
  IF v_deliv_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(quantity * unit_price), 0.00)
  INTO v_computed_total
  FROM public.delivery_items
  WHERE delivery_id = v_deliv_id;

  UPDATE public.deliveries
  SET total_amount = v_computed_total,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_deliv_id AND (total_amount = 0 OR total_amount <> v_computed_total);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_items_sync_total ON public.delivery_items;
CREATE TRIGGER trg_delivery_items_sync_total
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_items_totals();

CREATE OR REPLACE FUNCTION public.sync_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deliv_id UUID;
  v_inv_id UUID;
  v_deliv_total NUMERIC(12, 2);
  v_deliv_paid NUMERIC(12, 2);
  v_deliv_status VARCHAR(20);
  v_inv_total NUMERIC(12, 2);
  v_inv_paid NUMERIC(12, 2);
  v_inv_status VARCHAR(20);
BEGIN
  v_deliv_id := COALESCE(NEW.delivery_id, OLD.delivery_id);
  v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF v_deliv_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_deliv_paid
    FROM public.payments
    WHERE delivery_id = v_deliv_id AND status = 'COMPLETED';

    SELECT total_amount
    INTO v_deliv_total
    FROM public.deliveries
    WHERE id = v_deliv_id;

    IF v_deliv_total IS NOT NULL THEN
      IF v_deliv_paid >= v_deliv_total AND v_deliv_total > 0 THEN
        v_deliv_status := 'fully_paid';
      ELSIF v_deliv_paid > 0 THEN
        v_deliv_status := 'partially_paid';
      ELSE
        v_deliv_status := 'unpaid';
      END IF;

      UPDATE public.deliveries
      SET amount_paid = LEAST(v_deliv_paid, v_deliv_total),
          payment_status = v_deliv_status,
          updated_at = timezone('utc'::text, now())
      WHERE id = v_deliv_id;
    END IF;
  END IF;

  IF v_inv_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_inv_paid
    FROM public.payments
    WHERE invoice_id = v_inv_id AND status = 'COMPLETED';

    SELECT total_amount
    INTO v_inv_total
    FROM public.invoices
    WHERE id = v_inv_id;

    IF v_inv_total IS NOT NULL THEN
      IF v_inv_paid >= v_inv_total AND v_inv_total > 0 THEN
        v_inv_status := 'fully_paid';
      ELSIF v_inv_paid > 0 THEN
        v_inv_status := 'partially_paid';
      ELSE
        v_inv_status := 'unpaid';
      END IF;

      UPDATE public.invoices
      SET amount_paid = LEAST(v_inv_paid, v_inv_total),
          status = v_inv_status,
          updated_at = timezone('utc'::text, now())
      WHERE id = v_inv_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sync_totals ON public.payments;
CREATE TRIGGER trg_payments_sync_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_totals();

-- ------------------------------------------------------------------------------
-- STEP 7: CREATE CANONICAL VIEWS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_business_records AS
SELECT
    di.id AS record_id,
    d.id AS delivery_id,
    d.business_id,
    d.delivery_date AS date,
    s.id AS shop_id,
    s.name AS shop_name,
    s.code AS shop_code,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    di.quantity,
    di.unit_price,
    di.total_price AS total_amount,
    d.status AS delivery_status,
    d.amount_paid,
    d.outstanding_amount AS pending_amount,
    d.payment_status,
    d.notes,
    d.created_at
FROM public.deliveries d
JOIN public.shops s ON s.id = d.shop_id
JOIN public.delivery_items di ON di.delivery_id = d.id
JOIN public.products p ON p.id = di.product_id;

CREATE OR REPLACE VIEW public.v_shop_payment_balances AS
SELECT
    s.id AS shop_id,
    s.name AS shop_name,
    s.code AS shop_code,
    COALESCE(SUM(d.total_amount), 0.00)::NUMERIC(12, 2) AS total_billed,
    COALESCE(SUM(d.amount_paid), 0.00)::NUMERIC(12, 2) AS total_paid,
    COALESCE(SUM(d.outstanding_amount), 0.00)::NUMERIC(12, 2) AS outstanding_balance,
    CASE
        WHEN COALESCE(SUM(d.total_amount), 0.00) = 0 THEN 'unpaid'
        WHEN COALESCE(SUM(d.amount_paid), 0.00) >= COALESCE(SUM(d.total_amount), 0.00) THEN 'fully_paid'
        WHEN COALESCE(SUM(d.amount_paid), 0.00) > 0 THEN 'partially_paid'
        ELSE 'unpaid'
    END AS status,
    MAX(p.payment_date) AS last_payment_date,
    COUNT(DISTINCT p.id)::INTEGER AS payment_count
FROM public.shops s
LEFT JOIN public.deliveries d ON d.shop_id = s.id AND d.status <> 'cancelled'
LEFT JOIN public.payments p ON p.shop_id = s.id AND p.status = 'COMPLETED'
WHERE s.is_active = true
GROUP BY s.id, s.name, s.code;

CREATE OR REPLACE VIEW public.v_shop_inventory_balances AS
SELECT
    s.id AS shop_id,
    s.name AS shop_name,
    s.code AS shop_code,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.category AS category,
    p.min_stock_threshold,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'DELIVERY_IN' THEN sm.quantity ELSE 0 END), 0)::INTEGER AS total_delivered,
    COALESCE(ABS(SUM(CASE WHEN sm.movement_type = 'SALE_OUT' AND sm.is_provisional = false THEN sm.quantity ELSE 0 END)), 0)::INTEGER AS confirmed_sold,
    COALESCE(ABS(SUM(CASE WHEN sm.movement_type = 'SALE_OUT' AND sm.is_provisional = true THEN sm.quantity ELSE 0 END)), 0)::INTEGER AS provisional_sold,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'TRANSFER_IN' THEN sm.quantity ELSE 0 END), 0)::INTEGER AS total_transferred_in,
    COALESCE(ABS(SUM(CASE WHEN sm.movement_type = 'TRANSFER_OUT' THEN sm.quantity ELSE 0 END)), 0)::INTEGER AS total_transferred_out,
    COALESCE(SUM(CASE WHEN sm.movement_type = 'RETURN_IN' THEN sm.quantity ELSE 0 END), 0)::INTEGER AS total_returned,
    COALESCE(ABS(SUM(CASE WHEN sm.movement_type = 'DAMAGED_OUT' THEN sm.quantity ELSE 0 END)), 0)::INTEGER AS total_damaged,
    COALESCE(SUM(sm.quantity), 0)::INTEGER AS expected_stock
FROM public.shops s
CROSS JOIN public.products p
LEFT JOIN public.stock_movements sm 
    ON sm.shop_id = s.id 
   AND sm.product_id = p.id 
   AND sm.is_provisional = false
WHERE s.is_active = true 
  AND p.is_active = true
GROUP BY s.id, s.name, s.code, p.id, p.name, p.sku, p.category, p.min_stock_threshold;

-- ------------------------------------------------------------------------------
-- STEP 8: GRANTS & RLS FOR UPGRADED/NEW TABLES
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT ON public.v_business_records TO authenticated, service_role;
GRANT SELECT ON public.v_shop_payment_balances TO authenticated, service_role;
GRANT SELECT ON public.v_shop_inventory_balances TO authenticated, service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_manage_owner" ON public.invoices;
CREATE POLICY "invoices_manage_owner"
  ON public.invoices FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_select_assigned_employee" ON public.invoices;

DROP POLICY IF EXISTS "payments_manage_owner" ON public.payments;
CREATE POLICY "payments_manage_owner"
  ON public.payments FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_select_assigned_employee" ON public.payments;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

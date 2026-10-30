-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0008: CUSTOMER PRICE & PROFIT
-- ==============================================================================
-- Description:
--   1. Adds nullable customer_price to public.deliveries for tracking customer selling price.
--   2. Adds stored generated profit column (Profit = customer_price - total_amount)
--      which guarantees database-level consistency between Amount, CP, and Profit.
--   3. Updates public.v_business_records view with backward-compatible NULL-safe columns.
--   4. Idempotent, non-destructive, and touches zero existing customer rows.
-- ==============================================================================

BEGIN;

-- 1. Add customer_price to deliveries (nullable for historical compatibility)
ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS customer_price NUMERIC(12, 2) DEFAULT NULL;

-- 2. Add generated profit column (guaranteed consistent with CP and Amount)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'profit'
  ) THEN
    ALTER TABLE public.deliveries 
      ADD COLUMN profit NUMERIC(12, 2) GENERATED ALWAYS AS (
        CASE 
          WHEN customer_price IS NOT NULL THEN customer_price - total_amount 
          ELSE NULL 
        END
      ) STORED;
  END IF;
END $$;

-- 3. Replace v_business_records view with customer_price and profit projected
CREATE OR REPLACE VIEW public.v_business_records WITH (security_invoker = true) AS
SELECT
    COALESCE(di.id, d.id) AS record_id,
    d.id AS delivery_id,
    d.business_id,
    d.delivery_date AS date,
    s.id AS shop_id,
    COALESCE(s.name, 'Direct Wholesale')::VARCHAR(150) AS shop_name,
    s.code::VARCHAR(30) AS shop_code,
    p.id AS product_id,
    COALESCE(p.name, 'Wholesale Product')::VARCHAR(200) AS product_name,
    p.sku::VARCHAR(50) AS product_sku,
    COALESCE(di.quantity, 1)::INTEGER AS quantity,
    COALESCE(di.unit_price, d.total_amount, 0.00)::NUMERIC(12, 2) AS unit_price,
    COALESCE(di.total_price, d.total_amount, 0.00)::NUMERIC(12, 2) AS total_amount,
    d.customer_price::NUMERIC(12, 2) AS customer_price,
    d.profit::NUMERIC(12, 2) AS profit,
    d.status::VARCHAR(20) AS delivery_status,
    d.amount_paid::NUMERIC(12, 2) AS amount_paid,
    d.outstanding_amount::NUMERIC(12, 2) AS pending_amount,
    d.payment_status::VARCHAR(20) AS payment_status,
    d.notes,
    d.created_at,
    CASE
        WHEN d.status IN ('delivered', 'cancelled') THEN 2
        ELSE 1
    END::INTEGER AS priority_rank
FROM public.deliveries d
LEFT JOIN public.shops s ON s.id = d.shop_id
LEFT JOIN public.delivery_items di ON di.delivery_id = d.id
LEFT JOIN public.products p ON p.id = di.product_id;

-- 4. Grant least-privilege view permissions
GRANT SELECT ON public.v_business_records TO authenticated, service_role;

COMMIT;

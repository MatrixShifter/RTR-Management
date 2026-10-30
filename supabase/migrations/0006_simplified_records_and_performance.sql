-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0006: SIMPLIFIED RECORDS & PERFORMANCE
-- ==============================================================================
-- Description:
--   1. Adds composite index on deliveries(business_id, status, delivery_date DESC)
--      to optimize the simplified Records page query pattern (pending first, newest dates).
--   2. Updates public.v_business_records with LEFT JOIN fallbacks to guarantee no
--      records are dropped if item lines are missing or simplified, preserving
--      monetary totals, delivery status separation, and strict tenant isolation.
-- ==============================================================================

-- 1. Optimized composite index for simplified records query
CREATE INDEX IF NOT EXISTS idx_deliveries_biz_status_date 
  ON public.deliveries(business_id, status, delivery_date DESC);

-- 2. Enhanced v_business_records view
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
    d.status::VARCHAR(20) AS delivery_status,
    d.amount_paid::NUMERIC(12, 2) AS amount_paid,
    d.outstanding_amount::NUMERIC(12, 2) AS pending_amount,
    d.payment_status::VARCHAR(20) AS payment_status,
    d.notes,
    d.created_at,
    CASE
        -- Delivered & cancelled items placed below pending
        WHEN d.status IN ('delivered', 'cancelled') THEN 2
        -- Pending (unchecked) deliveries first
        ELSE 1
    END::INTEGER AS priority_rank
FROM public.deliveries d
LEFT JOIN public.shops s ON s.id = d.shop_id
LEFT JOIN public.delivery_items di ON di.delivery_id = d.id
LEFT JOIN public.products p ON p.id = di.product_id;

-- 3. Maintain least-privilege view permissions
GRANT SELECT ON public.v_business_records TO authenticated, service_role;

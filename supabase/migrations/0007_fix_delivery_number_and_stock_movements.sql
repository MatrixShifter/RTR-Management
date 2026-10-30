-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0007: FIX VIEW TYPE MISMATCH & DELIVERY TRIGGER
-- ==============================================================================
-- Description:
--   1. Resolves Postgres error 42P16:
--      "cannot change data type of view column 'shop_name' from character varying(150) to character varying"
--      by adding explicit casts matching the existing view's column specifications:
--        - shop_name: VARCHAR(150)
--        - shop_code: VARCHAR(30)
--        - product_name: VARCHAR(200)
--        - product_sku: VARCHAR(50)
--        - delivery_status: VARCHAR(20)
--        - payment_status: VARCHAR(20)
--   2. Resolves Postgres error 42703:
--      "record 'new' has no field 'delivery_number'"
--      by replacing post_delivery_stock_movements() with a canonical reference to NEW.id::text.
--   3. Idempotent and transaction-safe. Touches zero existing data rows.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: COMPATIBLE v_business_records VIEW REPLACEMENT (Fixes 42P16)
-- ------------------------------------------------------------------------------
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
        WHEN d.status IN ('delivered', 'cancelled') THEN 2
        ELSE 1
    END::INTEGER AS priority_rank
FROM public.deliveries d
LEFT JOIN public.shops s ON s.id = d.shop_id
LEFT JOIN public.delivery_items di ON di.delivery_id = d.id
LEFT JOIN public.products p ON p.id = di.product_id;

GRANT SELECT ON public.v_business_records TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 2: NULL-SAFE post_delivery_stock_movements TRIGGER (Fixes 42703)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_delivery_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'delivered') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status <> 'delivered') THEN
    
    INSERT INTO public.stock_movements (
      business_id, 
      shop_id, 
      product_id, 
      movement_type, 
      quantity, 
      reference_id, 
      is_provisional, 
      reason, 
      actor_id
    )
    SELECT 
      NEW.business_id,
      NEW.shop_id,
      di.product_id,
      'DELIVERY_IN',
      di.quantity,
      NEW.id,
      false,
      'Wholesale Delivery ' || NEW.id::text,
      NEW.created_by
    FROM public.delivery_items di
    WHERE di.delivery_id = NEW.id;

  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0005: REMOVE EMPLOYEE AUTHENTICATION & ACCESS
-- ==============================================================================
-- Description:
--   Removes employee-scoped Row Level Security (RLS) policies and helper functions.
--   Enforces Business Owner access exclusively across all wholesale operations.
-- ==============================================================================

-- 1. Drop employee-specific RLS policies across all tables
DROP POLICY IF EXISTS "shops_select_assigned_employee" ON public.shops;
DROP POLICY IF EXISTS "shop_memberships_select_employee" ON public.shop_memberships;
DROP POLICY IF EXISTS "deliveries_select_assigned_employee" ON public.deliveries;
DROP POLICY IF EXISTS "payments_select_assigned_employee" ON public.payments;
DROP POLICY IF EXISTS "invoices_select_assigned_employee" ON public.invoices;
DROP POLICY IF EXISTS "daily_reports_select_assigned_employee" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert_employee" ON public.daily_reports;
DROP POLICY IF EXISTS "daily_report_items_insert_employee" ON public.daily_report_items;
DROP POLICY IF EXISTS "stock_movements_select_assigned_employee" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_counts_select_assigned_employee" ON public.stock_counts;
DROP POLICY IF EXISTS "stock_counts_insert_assigned_employee" ON public.stock_counts;
DROP POLICY IF EXISTS "stock_transfers_select_assigned_employee" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_adjustments_select_assigned_employee" ON public.stock_adjustments;

-- 2. Update multi-role policies to owner-only
DROP POLICY IF EXISTS "delivery_items_select" ON public.delivery_items;
CREATE POLICY "delivery_items_select"
  ON public.delivery_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

DROP POLICY IF EXISTS "daily_report_items_select" ON public.daily_report_items;
CREATE POLICY "daily_report_items_select"
  ON public.daily_report_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND public.is_business_owner(r.business_id)
    )
  );

DROP POLICY IF EXISTS "stock_movements_insert_authorized" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_owner" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_owner"
  ON public.stock_movements FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "products_select_member" ON public.products;
DROP POLICY IF EXISTS "products_select_owner" ON public.products;
CREATE POLICY "products_select_owner"
  ON public.products FOR SELECT
  USING (public.is_business_owner(business_id));

-- 3. Drop obsolete employee helper function
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_shop(UUID) FROM authenticated, service_role;
DROP FUNCTION IF EXISTS public.is_assigned_to_shop(UUID);

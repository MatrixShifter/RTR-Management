-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0009: SHOP EMPLOYEE ROLE & ACCESS CONTROL
-- ==============================================================================
-- Description:
--   1. Re-establishes and hardens public.is_assigned_to_shop(UUID) helper function
--      with strict tenant verification, active employee role check, and active shop check.
--   2. Adds public.get_employee_assigned_shop_id() helper function.
--   3. Re-establishes scoped Row Level Security (RLS) policies for assigned employees:
--      - shops: SELECT assigned shop only.
--      - deliveries: SELECT assigned shop records only (Zero INSERT/UPDATE/DELETE).
--      - delivery_items: SELECT items for assigned shop deliveries only.
--      - products: SELECT products for authorized business.
--      - shop_memberships: SELECT own assignment.
--      - business_memberships: SELECT own membership.
--   4. Fully idempotent and non-destructive to existing owner policies and genuine data.
-- ==============================================================================

BEGIN;

-- 1. Helper function: Check if authenticated user is an active employee assigned to target shop
CREATE OR REPLACE FUNCTION public.is_assigned_to_shop(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.shop_memberships sm
    JOIN public.shops s ON s.id = sm.shop_id
    JOIN public.business_memberships bm ON bm.user_id = sm.user_id AND bm.business_id = s.business_id
    WHERE sm.user_id = auth.uid() 
      AND sm.shop_id = target_shop_id
      AND s.is_active = true
      AND bm.is_active = true
      AND bm.role = 'employee'
  );
$$;

-- 2. Helper function: Retrieve authenticated employee's assigned shop ID
CREATE OR REPLACE FUNCTION public.get_employee_assigned_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT sm.shop_id 
  FROM public.shop_memberships sm
  JOIN public.shops s ON s.id = sm.shop_id
  JOIN public.business_memberships bm ON bm.user_id = sm.user_id AND bm.business_id = s.business_id
  WHERE sm.user_id = auth.uid()
    AND s.is_active = true
    AND bm.is_active = true
    AND bm.role = 'employee'
  LIMIT 1;
$$;

-- 3. Grant function execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.is_assigned_to_shop(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_assigned_shop_id() TO authenticated, service_role;

-- 4. Scoped SELECT policy for shops
DROP POLICY IF EXISTS "shops_select_assigned_employee" ON public.shops;
CREATE POLICY "shops_select_assigned_employee"
  ON public.shops FOR SELECT
  USING (public.is_assigned_to_shop(id));

-- 5. Scoped SELECT policy for deliveries (Read-only for employee)
DROP POLICY IF EXISTS "deliveries_select_assigned_employee" ON public.deliveries;
CREATE POLICY "deliveries_select_assigned_employee"
  ON public.deliveries FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 6. Scoped SELECT policy for delivery_items
DROP POLICY IF EXISTS "delivery_items_select" ON public.delivery_items;
CREATE POLICY "delivery_items_select"
  ON public.delivery_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND (public.is_business_owner(d.business_id) OR public.is_assigned_to_shop(d.shop_id))
    )
  );

-- 7. Scoped SELECT policy for products
DROP POLICY IF EXISTS "products_select_authorized" ON public.products;
CREATE POLICY "products_select_authorized"
  ON public.products FOR SELECT
  USING (
    public.is_business_owner(business_id) OR
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.user_id = auth.uid()
        AND bm.business_id = public.products.business_id
        AND bm.is_active = true
    )
  );

-- 8. Scoped SELECT policy for shop_memberships
DROP POLICY IF EXISTS "shop_memberships_select_employee" ON public.shop_memberships;
CREATE POLICY "shop_memberships_select_employee"
  ON public.shop_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 9. Scoped SELECT policy for business_memberships
DROP POLICY IF EXISTS "memberships_select_member" ON public.business_memberships;
CREATE POLICY "memberships_select_member"
  ON public.business_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_business_owner(business_id));

COMMIT;

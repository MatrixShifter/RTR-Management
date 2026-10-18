-- Row Level Security (RLS) & Access Policies

-- Helper Security Functions (fixed safe search path)
CREATE OR REPLACE FUNCTION public.get_auth_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT business_id 
  FROM public.business_memberships 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.business_memberships 
    WHERE user_id = auth.uid() 
      AND business_id = target_business_id 
      AND role = 'owner' 
      AND is_active = true
  );
$$;

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
    WHERE sm.user_id = auth.uid() 
      AND sm.shop_id = target_shop_id
      AND s.is_active = true
  );
$$;

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view profiles within their business"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.business_memberships bm1
      JOIN public.business_memberships bm2 ON bm1.business_id = bm2.business_id
      WHERE bm1.user_id = auth.uid() AND bm2.user_id = public.profiles.id
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- 2. Businesses Policies
CREATE POLICY "Members can view their business"
  ON public.businesses FOR SELECT
  USING (id = public.get_auth_business_id());

CREATE POLICY "Owners can update business settings"
  ON public.businesses FOR UPDATE
  USING (public.is_business_owner(id));

-- 3. Business Memberships Policies
CREATE POLICY "Members can view business memberships"
  ON public.business_memberships FOR SELECT
  USING (business_id = public.get_auth_business_id());

CREATE POLICY "Owners can manage business memberships"
  ON public.business_memberships FOR ALL
  USING (public.is_business_owner(business_id));

-- 4. Shops Policies
CREATE POLICY "Owners can view all business shops"
  ON public.shops FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Employees can view assigned shops only"
  ON public.shops FOR SELECT
  USING (public.is_assigned_to_shop(id));

CREATE POLICY "Owners can manage shops"
  ON public.shops FOR ALL
  USING (public.is_business_owner(business_id));

-- 5. Shop Memberships Policies
CREATE POLICY "Owners can view and manage shop memberships"
  ON public.shop_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

CREATE POLICY "Employees can view their own shop memberships"
  ON public.shop_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 6. Products Policies
CREATE POLICY "Business members can view active products"
  ON public.products FOR SELECT
  USING (business_id = public.get_auth_business_id());

CREATE POLICY "Owners can insert, update, or deactivate products"
  ON public.products FOR ALL
  USING (public.is_business_owner(business_id));

-- 7. Deliveries & Items Policies
CREATE POLICY "Owners can manage deliveries"
  ON public.deliveries FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "Employees can view deliveries for assigned shops"
  ON public.deliveries FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

CREATE POLICY "Users can view delivery items for visible deliveries"
  ON public.delivery_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND (public.is_business_owner(d.business_id) OR public.is_assigned_to_shop(d.shop_id))
    )
  );

CREATE POLICY "Owners can manage delivery items"
  ON public.delivery_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

-- 8. Daily Reports & Report Items
CREATE POLICY "Owners can view and update daily reports"
  ON public.daily_reports FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "Employees can view reports for assigned shops"
  ON public.daily_reports FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

CREATE POLICY "Employees can insert daily reports for assigned shops"
  ON public.daily_reports FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) 
    AND submitted_by = auth.uid()
    AND status = 'submitted'
  );

CREATE POLICY "Users can view report items for permitted reports"
  ON public.daily_report_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND (public.is_business_owner(r.business_id) OR public.is_assigned_to_shop(r.shop_id))
    )
  );

CREATE POLICY "Employees can insert report items for their submitted reports"
  ON public.daily_report_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND r.submitted_by = auth.uid()
        AND public.is_assigned_to_shop(r.shop_id)
    )
  );

-- 9. Stock Movements Policies (Append-only ledger)
CREATE POLICY "Owners can view all stock movements"
  ON public.stock_movements FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Employees can view stock movements for assigned shops"
  ON public.stock_movements FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- Prohibit direct client deletions or updates on stock movements (Immutable Ledger)
CREATE POLICY "Stock movements are immutable - no direct client modification"
  ON public.stock_movements FOR UPDATE
  USING (false);

CREATE POLICY "Stock movements are immutable - no direct client deletion"
  ON public.stock_movements FOR DELETE
  USING (false);

-- 10. Idempotency Records Policies
CREATE POLICY "System and users can manage idempotency records within their business"
  ON public.idempotency_records FOR ALL
  USING (business_id = public.get_auth_business_id());

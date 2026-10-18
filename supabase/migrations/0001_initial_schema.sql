-- ==============================================================================
-- CRIMPSTON WHOLESALE ACCESSORIES MANAGEMENT SYSTEM
-- MIGRATION: 0001_initial_schema.sql
-- DESCRIPTION: Comprehensive initial PostgreSQL schema migration defining all
--              tables, relationships, constraints, indexes, triggers, functions,
--              grants, and Row Level Security (RLS) policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. UTILITY & TRIGGER FUNCTIONS
-- ------------------------------------------------------------------------------
-- Function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Function to prevent destructive updates or deletes on immutable audit tables
CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Action rejected: Table % is append-only and immutable.', TG_TABLE_NAME
    USING ERRCODE = '23505';
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CORE TABLES & CONSTRAINTS
-- ------------------------------------------------------------------------------

-- 3.1. Businesses (Tenant isolation root)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    report_cutoff_time TIME NOT NULL DEFAULT '21:00:00',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.2. Profiles (Application user identities linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.3. Business Memberships (Defines owner vs employee role per tenant)
CREATE TABLE IF NOT EXISTS public.business_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'employee')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_user UNIQUE (business_id, user_id)
);

-- 3.4. Retail Partner Shops
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_shop_code UNIQUE (business_id, code)
);

-- 3.5. Shop Memberships (Associates employees with authorized stores)
CREATE TABLE IF NOT EXISTS public.shop_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_shop_user UNIQUE (shop_id, user_id)
);

-- 3.6. Products Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'piece',
    min_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_threshold >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_product_sku UNIQUE (business_id, sku)
);

-- 3.7. Wholesale Deliveries (Supply batches to retail shops)
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'delivered', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8. Delivery Items
CREATE TABLE IF NOT EXISTS public.delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes VARCHAR(255),
    CONSTRAINT uq_delivery_product UNIQUE (delivery_id, product_id)
);

-- 3.9. Daily Sales Reports
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    is_zero_sales BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
    notes TEXT,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_shop_report_date UNIQUE (shop_id, report_date)
);

-- 3.10. Daily Report Items
CREATE TABLE IF NOT EXISTS public.daily_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_sold INTEGER NOT NULL CHECK (quantity_sold >= 0),
    notes VARCHAR(255),
    CONSTRAINT uq_report_product UNIQUE (report_id, product_id)
);

-- 3.11. Immutable Stock Movements Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('DELIVERY_IN', 'SALE_OUT', 'AUDIT_ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT')),
    quantity INTEGER NOT NULL CHECK (quantity != 0), -- positive for additions, negative for deductions
    reference_id UUID, -- links to delivery_id, report_id, or adjustment_id
    is_provisional BOOLEAN NOT NULL DEFAULT false,
    reason TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.12. Stock Counts (In-store physical audit counts)
CREATE TABLE IF NOT EXISTS public.stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    counted_quantity INTEGER NOT NULL CHECK (counted_quantity >= 0),
    expected_quantity INTEGER NOT NULL,
    variance INTEGER NOT NULL GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
    counted_by UUID NOT NULL REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.13. Stock Adjustments (Authorized reconciliations)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    adjustment_quantity INTEGER NOT NULL CHECK (adjustment_quantity != 0),
    reason VARCHAR(100) NOT NULL CHECK (reason IN ('DAMAGE', 'COUNT_DISCREPANCY', 'RETURN_RESTOCK', 'EXPIRY', 'SUPPLIER_RECALL', 'OTHER')),
    notes TEXT,
    authorized_by UUID NOT NULL REFERENCES public.profiles(id),
    stock_count_id UUID REFERENCES public.stock_counts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.14. Audit Logs (Traceable administrative & security log)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.15. Idempotency Records (Deduplication boundary)
CREATE TABLE IF NOT EXISTS public.idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(100) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    response_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_idempotency UNIQUE (business_id, idempotency_key)
);

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE & QUERY INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_product ON public.stock_movements(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_shop_date ON public.daily_reports(shop_id, report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_date ON public.deliveries(shop_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_user ON public.shop_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_shop_product ON public.stock_counts(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_shop_product ON public.stock_adjustments(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_actor ON public.audit_logs(business_id, actor_id);

-- ------------------------------------------------------------------------------
-- 5. TRIGGERS
-- ------------------------------------------------------------------------------
-- Timestamps triggers
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable ledger protection triggers
CREATE TRIGGER trg_stock_movements_immutable BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

-- ------------------------------------------------------------------------------
-- 6. SECURITY FUNCTIONS (Safe Fixed search_path)
-- ------------------------------------------------------------------------------

-- Get current authenticated user's active business_id
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

-- Check if authenticated user is active owner of the target business
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

-- Check if authenticated user is assigned to the target retail shop
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

-- Stock Calculation Helper: Calculate confirmed recorded balance for a shop and product
CREATE OR REPLACE FUNCTION public.calculate_shop_stock(target_shop_id UUID, target_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(SUM(quantity), 0)::INTEGER
  FROM public.stock_movements
  WHERE shop_id = target_shop_id 
    AND product_id = target_product_id
    AND is_provisional = false;
$$;

-- ------------------------------------------------------------------------------
-- 7. PERMISSIONS & TABLE GRANTS (Least-Privilege)
-- ------------------------------------------------------------------------------
-- Revoke all public default privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant execution on security functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_auth_business_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_shop(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_shop_stock(UUID, UUID) TO authenticated, service_role;

-- Grant scoped table permissions to authenticated role (RLS policies govern row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_report_items TO authenticated;
GRANT SELECT, INSERT ON public.stock_movements TO authenticated; -- Append-only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated; -- Append-only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated;

-- Service role full access for administrative maintenance
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS across every table
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
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

-- 8.1. Businesses Policies
CREATE POLICY "businesses_select_member"
  ON public.businesses FOR SELECT
  USING (id = public.get_auth_business_id());

CREATE POLICY "businesses_update_owner"
  ON public.businesses FOR UPDATE
  USING (public.is_business_owner(id));

-- 8.2. Profiles Policies
CREATE POLICY "profiles_select_shared_business"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.business_memberships bm1
      JOIN public.business_memberships bm2 ON bm1.business_id = bm2.business_id
      WHERE bm1.user_id = auth.uid() AND bm2.user_id = public.profiles.id
    )
  );

CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- 8.3. Business Memberships Policies
CREATE POLICY "memberships_select_member"
  ON public.business_memberships FOR SELECT
  USING (business_id = public.get_auth_business_id());

CREATE POLICY "memberships_manage_owner"
  ON public.business_memberships FOR ALL
  USING (public.is_business_owner(business_id));

-- 8.4. Shops Policies
CREATE POLICY "shops_select_owner"
  ON public.shops FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "shops_select_assigned_employee"
  ON public.shops FOR SELECT
  USING (public.is_assigned_to_shop(id));

CREATE POLICY "shops_manage_owner"
  ON public.shops FOR ALL
  USING (public.is_business_owner(business_id));

-- 8.5. Shop Memberships Policies
CREATE POLICY "shop_memberships_manage_owner"
  ON public.shop_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

CREATE POLICY "shop_memberships_select_employee"
  ON public.shop_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 8.6. Products Policies
CREATE POLICY "products_select_member"
  ON public.products FOR SELECT
  USING (business_id = public.get_auth_business_id());

CREATE POLICY "products_manage_owner"
  ON public.products FOR ALL
  USING (public.is_business_owner(business_id));

-- 8.7. Deliveries Policies
CREATE POLICY "deliveries_manage_owner"
  ON public.deliveries FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "deliveries_select_assigned_employee"
  ON public.deliveries FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 8.8. Delivery Items Policies
CREATE POLICY "delivery_items_select"
  ON public.delivery_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND (public.is_business_owner(d.business_id) OR public.is_assigned_to_shop(d.shop_id))
    )
  );

CREATE POLICY "delivery_items_manage_owner"
  ON public.delivery_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

-- 8.9. Daily Reports Policies
CREATE POLICY "daily_reports_manage_owner"
  ON public.daily_reports FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "daily_reports_select_assigned_employee"
  ON public.daily_reports FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

CREATE POLICY "daily_reports_insert_employee"
  ON public.daily_reports FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) 
    AND submitted_by = auth.uid()
    AND status = 'submitted'
  );

-- 8.10. Daily Report Items Policies
CREATE POLICY "daily_report_items_select"
  ON public.daily_report_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND (public.is_business_owner(r.business_id) OR public.is_assigned_to_shop(r.shop_id))
    )
  );

CREATE POLICY "daily_report_items_insert_employee"
  ON public.daily_report_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND r.submitted_by = auth.uid()
        AND public.is_assigned_to_shop(r.shop_id)
    )
  );

-- 8.11. Stock Movements Policies (Append-only Ledger)
CREATE POLICY "stock_movements_select_owner"
  ON public.stock_movements FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "stock_movements_select_assigned_employee"
  ON public.stock_movements FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

CREATE POLICY "stock_movements_insert_authorized"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    public.is_business_owner(business_id) OR
    (public.is_assigned_to_shop(shop_id) AND actor_id = auth.uid())
  );

CREATE POLICY "stock_movements_deny_update"
  ON public.stock_movements FOR UPDATE
  USING (false);

CREATE POLICY "stock_movements_deny_delete"
  ON public.stock_movements FOR DELETE
  USING (false);

-- 8.12. Stock Counts Policies
CREATE POLICY "stock_counts_manage_owner"
  ON public.stock_counts FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "stock_counts_select_assigned_employee"
  ON public.stock_counts FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

CREATE POLICY "stock_counts_insert_assigned_employee"
  ON public.stock_counts FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) AND counted_by = auth.uid()
  );

-- 8.13. Stock Adjustments Policies
CREATE POLICY "stock_adjustments_manage_owner"
  ON public.stock_adjustments FOR ALL
  USING (public.is_business_owner(business_id));

CREATE POLICY "stock_adjustments_select_assigned_employee"
  ON public.stock_adjustments FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 8.14. Audit Logs Policies (Append-only)
CREATE POLICY "audit_logs_select_owner"
  ON public.audit_logs FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "audit_logs_deny_update"
  ON public.audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "audit_logs_deny_delete"
  ON public.audit_logs FOR DELETE
  USING (false);

-- 8.15. Idempotency Records Policies
CREATE POLICY "idempotency_records_manage"
  ON public.idempotency_records FOR ALL
  USING (business_id = public.get_auth_business_id());

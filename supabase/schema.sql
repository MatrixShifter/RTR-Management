-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT SYSTEM
-- MASTER CANONICAL DATABASE ARCHITECTURE & SECURITY SCHEMA
-- FILE: supabase/schema.sql
-- AGENCY: Crimpston | CLIENT: RTR Mobiles
-- ==============================================================================
-- CONSOLIDATED DATABASE DEFINITION & MASTER SETUP:
-- This file serves as the canonical single-file source of truth for the RTR
-- Wholesale Management PostgreSQL database on Supabase.
-- It is structured into 26 comprehensive logical sections covering extensions,
-- schemas, core tables, transactions, stock ledger, RLS policies, views,
-- triggers, and baseline configuration.
--
-- INSTRUCTIONS FOR SUPABASE SQL EDITOR:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard).
-- 2. Navigate to "SQL Editor" from the left navigation menu.
-- 3. Click "New query" and paste the contents of this file.
-- 4. Click "Run" (Ctrl+Enter / Cmd+Enter).
--
-- Note: Fully idempotent. Uses IF NOT EXISTS, CREATE OR REPLACE, and safe
-- non-destructive statements that preserve existing production tables and data.
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- SECTION 2: CUSTOM TYPES AND ENUMS
-- ==============================================================================
-- Domain value checks are maintained through standard SQL check constraints
-- for optimal compatibility across PostgreSQL versions and Supabase Studio:
-- 1. Membership Roles: 'owner', 'employee'
-- 2. Product Categories: 'Mobile Cases', 'Tempered Glass', 'Chargers & Adapters',
--    'USB Cables', 'Earphones & Audio', 'Holders & Mounts', 'Power Banks', 'Other Accessories'
-- 3. Delivery Status: 'pending', 'delivered', 'cancelled'
-- 4. Payment Status: 'unpaid', 'partially_paid', 'fully_paid'
-- 5. Payment Methods: 'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'
-- 6. Stock Movement Types: 'OPENING_STOCK', 'DELIVERY_IN', 'SALE_OUT',
--    'TRANSFER_IN', 'TRANSFER_OUT', 'AUDIT_ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT', 'DAMAGED_OUT'

-- ==============================================================================
-- SECTION 3: CORE BUSINESS TABLES (businesses, profiles)
-- ==============================================================================

-- 3.1. Tenant Business Entity (Tenant isolation root)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    report_cutoff_time TIME NOT NULL DEFAULT '21:00:00',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.2. User Profiles (Mirrors and extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(60) UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- SECTION 4: USER AND BUSINESS MEMBERSHIPS (business_memberships)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'employee')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_user UNIQUE (business_id, user_id)
);

-- ==============================================================================
-- SECTION 5: SHOP MEMBERSHIPS AND EMPLOYEE ASSIGNMENTS (shop_memberships)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shop_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_shop_user UNIQUE (shop_id, user_id)
);

-- ==============================================================================
-- SECTION 6: SHOP TABLES (shops)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_shop_code UNIQUE (business_id, code)
);

-- Add foreign key constraint for shop_memberships referencing shops
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_shop_memberships_shop' AND table_name = 'shop_memberships'
  ) THEN
    ALTER TABLE public.shop_memberships
      ADD CONSTRAINT fk_shop_memberships_shop
      FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==============================================================================
-- SECTION 7: PRODUCT TABLES (products)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'Mobile Cases',
        'Tempered Glass',
        'Chargers & Adapters',
        'USB Cables',
        'Earphones & Audio',
        'Holders & Mounts',
        'Power Banks',
        'Other Accessories'
    )),
    description TEXT,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'piece',
    min_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_threshold >= 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    cost_price NUMERIC(12, 2) DEFAULT NULL CHECK (cost_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_product_sku UNIQUE (business_id, sku)
);

-- ==============================================================================
-- SECTION 8: DELIVERY AND TRANSACTION TABLES (deliveries, delivery_items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    outstanding_amount NUMERIC(12, 2) GENERATED ALWAYS AS (GREATEST(0.00, total_amount - amount_paid)) STORED,
    customer_price NUMERIC(12, 2) DEFAULT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'fully_paid')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Stored generated profit column: customer_price - total_amount
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

CREATE TABLE IF NOT EXISTS public.delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    total_price NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    unit_cost NUMERIC(12, 2) DEFAULT NULL CHECK (unit_cost >= 0),
    notes VARCHAR(255),
    CONSTRAINT uq_delivery_product UNIQUE (delivery_id, product_id)
);

-- ==============================================================================
-- SECTION 9: PAYMENT AND INVOICE TABLES (payments, invoices)
-- ==============================================================================
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

-- ==============================================================================
-- SECTION 10: STOCK AND INVENTORY TABLES
-- (stock_movements, daily_reports, daily_report_items, stock_counts, stock_adjustments, stock_transfers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
        'OPENING_STOCK',
        'DELIVERY_IN',
        'SALE_OUT',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'AUDIT_ADJUSTMENT',
        'RETURN_IN',
        'RETURN_OUT',
        'DAMAGED_OUT'
    )),
    quantity INTEGER NOT NULL CHECK (quantity != 0),
    reference_id UUID,
    is_provisional BOOLEAN NOT NULL DEFAULT false,
    reason TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

CREATE TABLE IF NOT EXISTS public.daily_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_sold INTEGER NOT NULL CHECK (quantity_sold >= 0),
    unit_price NUMERIC(12, 2) DEFAULT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(12, 2) DEFAULT NULL CHECK (unit_cost >= 0),
    physical_count INTEGER CHECK (physical_count >= 0),
    notes VARCHAR(255),
    CONSTRAINT uq_report_product UNIQUE (report_id, product_id)
);

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

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    from_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    to_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_different_transfer_shops CHECK (from_shop_id <> to_shop_id)
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    adjustment_quantity INTEGER NOT NULL CHECK (adjustment_quantity != 0),
    reason VARCHAR(100) NOT NULL CHECK (reason IN (
        'DAMAGE',
        'COUNT_DISCREPANCY',
        'RETURN_RESTOCK',
        'EXPIRY',
        'SUPPLIER_RECALL',
        'OTHER'
    )),
    notes TEXT,
    authorized_by UUID NOT NULL REFERENCES public.profiles(id),
    stock_count_id UUID REFERENCES public.stock_counts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- SECTION 11: AUDIT-RELATED TABLES
-- (audit_logs, idempotency_records, maintenance_audit_ledger)
-- ==============================================================================
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

CREATE TABLE IF NOT EXISTS public.maintenance_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_name TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    details JSONB NOT NULL
);

-- ==============================================================================
-- SECTION 12: PRIMARY KEYS
-- ==============================================================================
-- Primary keys are declared inline in CREATE TABLE definitions above:
-- - businesses(id)
-- - profiles(id)
-- - business_memberships(id)
-- - shops(id)
-- - shop_memberships(id)
-- - products(id)
-- - deliveries(id)
-- - delivery_items(id)
-- - invoices(id)
-- - payments(id)
-- - daily_reports(id)
-- - daily_report_items(id)
-- - stock_movements(id)
-- - stock_counts(id)
-- - stock_transfers(id)
-- - stock_adjustments(id)
-- - audit_logs(id)
-- - idempotency_records(id)
-- - maintenance_audit_ledger(id)

-- ==============================================================================
-- SECTION 13: FOREIGN KEYS WITH APPROPRIATE DELETE ACTIONS
-- ==============================================================================
-- Referenced foreign key policies:
-- - Parent business deletion cascades to all tenant entities (ON DELETE CASCADE)
-- - Delivery line item products are protected against accidental catalog deletion (ON DELETE RESTRICT)
-- - Daily report items and stock movements enforce catalog referential integrity (ON DELETE RESTRICT)
-- - User deletion cascades to profile and active memberships (ON DELETE CASCADE)
-- - Invoices and payments cleanly cascade when deliveries are removed (ON DELETE CASCADE)

-- ==============================================================================
-- SECTION 14: UNIQUE CONSTRAINTS
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username
  ON public.profiles(LOWER(username)) WHERE username IS NOT NULL;

-- uq_business_user: business_memberships(business_id, user_id)
-- uq_shop_user: shop_memberships(shop_id, user_id)
-- uq_business_shop_code: shops(business_id, code)
-- uq_business_product_sku: products(business_id, sku)
-- uq_delivery_product: delivery_items(delivery_id, product_id)
-- uq_business_invoice_number: invoices(business_id, invoice_number)
-- uq_shop_report_date: daily_reports(shop_id, report_date)
-- uq_report_product: daily_report_items(report_id, product_id)
-- uq_business_idempotency: idempotency_records(business_id, idempotency_key)

-- ==============================================================================
-- SECTION 15: CHECK CONSTRAINTS
-- ==============================================================================
-- Numerical constraints defined on tables:
-- - products: unit_price >= 0, cost_price >= 0, min_stock_threshold >= 0
-- - deliveries: total_amount >= 0, amount_paid >= 0
-- - delivery_items: quantity > 0, unit_price >= 0, unit_cost >= 0
-- - invoices: total_amount >= 0, amount_paid >= 0
-- - payments: amount > 0
-- - stock_movements: quantity != 0
-- - stock_counts: counted_quantity >= 0
-- - stock_transfers: quantity > 0, from_shop_id <> to_shop_id
-- - stock_adjustments: adjustment_quantity != 0

-- ==============================================================================
-- SECTION 16: INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_shops_business ON public.shops(business_id);
CREATE INDEX IF NOT EXISTS idx_shops_code ON public.shops(code);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_user ON public.shop_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop ON public.shop_memberships(shop_id);

CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

CREATE INDEX IF NOT EXISTS idx_deliveries_shop_date ON public.deliveries(shop_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_business ON public.deliveries(business_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_payment_status ON public.deliveries(payment_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_date_desc ON public.deliveries(shop_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_biz_status_date ON public.deliveries(business_id, status, delivery_date DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product ON public.delivery_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_delivery ON public.payments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date ON public.payments(shop_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date_desc ON public.payments(shop_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_shop_date ON public.invoices(shop_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery ON public.invoices(delivery_id);

CREATE INDEX IF NOT EXISTS idx_daily_reports_shop_date ON public.daily_reports(shop_id, report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_shop_date_desc ON public.daily_reports(shop_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_product ON public.stock_movements(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_created_desc ON public.stock_movements(shop_id, created_at DESC);

-- ==============================================================================
-- SECTION 17: DATABASE HELPER FUNCTIONS
-- ==============================================================================

-- 17.1. Automatically updates 'updated_at' timestamp on record mutation
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 17.2. Prevents updates or deletes on append-only immutable audit ledgers
CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Action rejected: Table % is an append-only immutable audit ledger.', TG_TABLE_NAME
    USING ERRCODE = '23505';
END;
$$;

-- 17.3. Automatic profile generation upon Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- SECTION 18: FINANCIAL CALCULATION AND SECURITY DEFINER FUNCTIONS
-- ==============================================================================

-- 18.1. Get current authenticated user's active business_id
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

-- 18.2. Check if authenticated user is active owner of the target business
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

-- 18.3. Check if authenticated user is an active employee assigned to target shop
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

-- 18.4. Retrieve authenticated employee's assigned shop ID
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

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_auth_business_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_shop(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_employee_assigned_shop_id() TO authenticated, service_role;

-- ==============================================================================
-- SECTION 19: TRIGGERS
-- ==============================================================================

-- 19.1. Auth user profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 19.2. Standard updated_at triggers
DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_shops_updated_at ON public.shops;
CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 19.3. Immutable ledger protection triggers
DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_immutable BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

-- 19.4. Delivery Totals Calculation from Line Items
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

-- 19.5. Payment Synchronization & Outstanding Balance Auto-Recalculation
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

-- 19.6. Automatic Stock Movement Generation on Confirmed Deliveries
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

DROP TRIGGER IF EXISTS trg_deliveries_post_movements ON public.deliveries;
CREATE TRIGGER trg_deliveries_post_movements
  AFTER INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.post_delivery_stock_movements();

-- 19.7. Automatic Stock Movement Generation on Stock Transfers
CREATE OR REPLACE FUNCTION public.post_transfer_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
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
  ) VALUES (
    NEW.business_id,
    NEW.from_shop_id,
    NEW.product_id,
    'TRANSFER_OUT',
    -NEW.quantity,
    NEW.id,
    false,
    COALESCE(NEW.notes, 'Inter-shop transfer out'),
    NEW.created_by
  );

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
  ) VALUES (
    NEW.business_id,
    NEW.to_shop_id,
    NEW.product_id,
    'TRANSFER_IN',
    NEW.quantity,
    NEW.id,
    false,
    COALESCE(NEW.notes, 'Inter-shop transfer in'),
    NEW.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfers_post_movements ON public.stock_transfers;
CREATE TRIGGER trg_transfers_post_movements
  AFTER INSERT ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.post_transfer_stock_movements();

-- 19.8. Automatic Stock Movement Generation on Daily Report Approval
CREATE OR REPLACE FUNCTION public.post_report_approval_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' AND NOT NEW.is_zero_sales THEN
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
      dri.product_id,
      'SALE_OUT',
      -dri.quantity_sold,
      NEW.id,
      false,
      'Approved Daily Report (' || NEW.report_date::text || ')',
      COALESCE(NEW.reviewed_by, NEW.submitted_by)
    FROM public.daily_report_items dri
    WHERE dri.report_id = NEW.id AND dri.quantity_sold > 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_reports_approval_movements ON public.daily_reports;
CREATE TRIGGER trg_daily_reports_approval_movements
  AFTER UPDATE OF status ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.post_report_approval_stock_movements();

-- ==============================================================================
-- SECTION 20: ROW LEVEL SECURITY ENABLEMENT
-- ==============================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_audit_ledger ENABLE ROW LEVEL SECURITY;

-- Base Grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_report_items TO authenticated;
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- ==============================================================================
-- SECTION 21: OWNER RLS POLICIES
-- ==============================================================================

-- 21.1. Businesses (Owner Full Management)
DROP POLICY IF EXISTS "businesses_select_member" ON public.businesses;
CREATE POLICY "businesses_select_member"
  ON public.businesses FOR SELECT
  USING (id = public.get_auth_business_id());

DROP POLICY IF EXISTS "businesses_insert_owner" ON public.businesses;
CREATE POLICY "businesses_insert_owner"
  ON public.businesses FOR INSERT
  WITH CHECK (public.is_business_owner(id));

DROP POLICY IF EXISTS "businesses_update_owner" ON public.businesses;
CREATE POLICY "businesses_update_owner"
  ON public.businesses FOR UPDATE
  USING (public.is_business_owner(id))
  WITH CHECK (public.is_business_owner(id));

DROP POLICY IF EXISTS "businesses_delete_owner" ON public.businesses;
CREATE POLICY "businesses_delete_owner"
  ON public.businesses FOR DELETE
  USING (public.is_business_owner(id));

-- 21.2. Business Memberships (Owner Management)
DROP POLICY IF EXISTS "memberships_select_member" ON public.business_memberships;
CREATE POLICY "memberships_select_member"
  ON public.business_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_business_owner(business_id));

DROP POLICY IF EXISTS "memberships_insert_owner" ON public.business_memberships;
CREATE POLICY "memberships_insert_owner"
  ON public.business_memberships FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "memberships_update_owner" ON public.business_memberships;
CREATE POLICY "memberships_update_owner"
  ON public.business_memberships FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "memberships_delete_owner" ON public.business_memberships;
CREATE POLICY "memberships_delete_owner"
  ON public.business_memberships FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.3. Shops (Owner Management)
DROP POLICY IF EXISTS "shops_select_owner" ON public.shops;
CREATE POLICY "shops_select_owner"
  ON public.shops FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "shops_insert_owner" ON public.shops;
CREATE POLICY "shops_insert_owner"
  ON public.shops FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "shops_update_owner" ON public.shops;
CREATE POLICY "shops_update_owner"
  ON public.shops FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "shops_delete_owner" ON public.shops;
CREATE POLICY "shops_delete_owner"
  ON public.shops FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.4. Shop Memberships (Owner Management)
DROP POLICY IF EXISTS "shop_memberships_select_owner" ON public.shop_memberships;
CREATE POLICY "shop_memberships_select_owner"
  ON public.shop_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

DROP POLICY IF EXISTS "shop_memberships_insert_owner" ON public.shop_memberships;
CREATE POLICY "shop_memberships_insert_owner"
  ON public.shop_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

DROP POLICY IF EXISTS "shop_memberships_update_owner" ON public.shop_memberships;
CREATE POLICY "shop_memberships_update_owner"
  ON public.shop_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

DROP POLICY IF EXISTS "shop_memberships_delete_owner" ON public.shop_memberships;
CREATE POLICY "shop_memberships_delete_owner"
  ON public.shop_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

-- 21.5. Products (Owner Management)
DROP POLICY IF EXISTS "products_select_owner" ON public.products;
CREATE POLICY "products_select_owner"
  ON public.products FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "products_insert_owner" ON public.products;
CREATE POLICY "products_insert_owner"
  ON public.products FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "products_update_owner" ON public.products;
CREATE POLICY "products_update_owner"
  ON public.products FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
CREATE POLICY "products_delete_owner"
  ON public.products FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.6. Deliveries (Owner Management)
DROP POLICY IF EXISTS "deliveries_select_owner" ON public.deliveries;
CREATE POLICY "deliveries_select_owner"
  ON public.deliveries FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "deliveries_insert_owner" ON public.deliveries;
CREATE POLICY "deliveries_insert_owner"
  ON public.deliveries FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "deliveries_update_owner" ON public.deliveries;
CREATE POLICY "deliveries_update_owner"
  ON public.deliveries FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "deliveries_delete_owner" ON public.deliveries;
CREATE POLICY "deliveries_delete_owner"
  ON public.deliveries FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.7. Delivery Items (Owner Management)
DROP POLICY IF EXISTS "delivery_items_insert" ON public.delivery_items;
CREATE POLICY "delivery_items_insert"
  ON public.delivery_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

DROP POLICY IF EXISTS "delivery_items_update" ON public.delivery_items;
CREATE POLICY "delivery_items_update"
  ON public.delivery_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

DROP POLICY IF EXISTS "delivery_items_delete" ON public.delivery_items;
CREATE POLICY "delivery_items_delete"
  ON public.delivery_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

-- 21.8. Invoices (Owner Management)
DROP POLICY IF EXISTS "invoices_select_owner" ON public.invoices;
CREATE POLICY "invoices_select_owner"
  ON public.invoices FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_insert_owner" ON public.invoices;
CREATE POLICY "invoices_insert_owner"
  ON public.invoices FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_update_owner" ON public.invoices;
CREATE POLICY "invoices_update_owner"
  ON public.invoices FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_delete_owner" ON public.invoices;
CREATE POLICY "invoices_delete_owner"
  ON public.invoices FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.9. Payments (Owner Management)
DROP POLICY IF EXISTS "payments_select_owner" ON public.payments;
CREATE POLICY "payments_select_owner"
  ON public.payments FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_insert_owner" ON public.payments;
CREATE POLICY "payments_insert_owner"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_update_owner" ON public.payments;
CREATE POLICY "payments_update_owner"
  ON public.payments FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_delete_owner" ON public.payments;
CREATE POLICY "payments_delete_owner"
  ON public.payments FOR DELETE
  USING (public.is_business_owner(business_id));

-- 21.10. Daily Reports & Items (Owner Management)
DROP POLICY IF EXISTS "daily_reports_select_owner" ON public.daily_reports;
CREATE POLICY "daily_reports_select_owner"
  ON public.daily_reports FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "daily_reports_insert_owner" ON public.daily_reports;
CREATE POLICY "daily_reports_insert_owner"
  ON public.daily_reports FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "daily_reports_update_owner" ON public.daily_reports;
CREATE POLICY "daily_reports_update_owner"
  ON public.daily_reports FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "daily_reports_delete_owner" ON public.daily_reports;
CREATE POLICY "daily_reports_delete_owner"
  ON public.daily_reports FOR DELETE
  USING (public.is_business_owner(business_id));

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

DROP POLICY IF EXISTS "daily_report_items_insert" ON public.daily_report_items;
CREATE POLICY "daily_report_items_insert"
  ON public.daily_report_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND public.is_business_owner(r.business_id)
    )
  );

DROP POLICY IF EXISTS "daily_report_items_update" ON public.daily_report_items;
CREATE POLICY "daily_report_items_update"
  ON public.daily_report_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND public.is_business_owner(r.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND public.is_business_owner(r.business_id)
    )
  );

DROP POLICY IF EXISTS "daily_report_items_delete" ON public.daily_report_items;
CREATE POLICY "daily_report_items_delete"
  ON public.daily_report_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND public.is_business_owner(r.business_id)
    )
  );

-- 21.11. Stock Movement & Inventory Ledger (Owner Management)
DROP POLICY IF EXISTS "stock_movements_select_owner" ON public.stock_movements;
CREATE POLICY "stock_movements_select_owner"
  ON public.stock_movements FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_movements_insert_owner" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_owner"
  ON public.stock_movements FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_movements_deny_update" ON public.stock_movements;
CREATE POLICY "stock_movements_deny_update"
  ON public.stock_movements FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "stock_movements_deny_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_deny_delete"
  ON public.stock_movements FOR DELETE
  USING (false);

DROP POLICY IF EXISTS "stock_counts_select_owner" ON public.stock_counts;
CREATE POLICY "stock_counts_select_owner"
  ON public.stock_counts FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_counts_insert_owner" ON public.stock_counts;
CREATE POLICY "stock_counts_insert_owner"
  ON public.stock_counts FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_counts_update_owner" ON public.stock_counts;
CREATE POLICY "stock_counts_update_owner"
  ON public.stock_counts FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_counts_delete_owner" ON public.stock_counts;
CREATE POLICY "stock_counts_delete_owner"
  ON public.stock_counts FOR DELETE
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_transfers_select_owner" ON public.stock_transfers;
CREATE POLICY "stock_transfers_select_owner"
  ON public.stock_transfers FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_transfers_insert_owner" ON public.stock_transfers;
CREATE POLICY "stock_transfers_insert_owner"
  ON public.stock_transfers FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_transfers_update_owner" ON public.stock_transfers;
CREATE POLICY "stock_transfers_update_owner"
  ON public.stock_transfers FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_transfers_delete_owner" ON public.stock_transfers;
CREATE POLICY "stock_transfers_delete_owner"
  ON public.stock_transfers FOR DELETE
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_adjustments_select_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_select_owner"
  ON public.stock_adjustments FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_adjustments_insert_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_insert_owner"
  ON public.stock_adjustments FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_adjustments_update_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_update_owner"
  ON public.stock_adjustments FOR UPDATE
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_adjustments_delete_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_delete_owner"
  ON public.stock_adjustments FOR DELETE
  USING (public.is_business_owner(business_id));

-- ==============================================================================
-- SECTION 22: EMPLOYEE RLS POLICIES (Strict Read-Only Scoped Access)
-- ==============================================================================

-- 22.1. Scoped SELECT policy for shops: Employee can view only their assigned shop
DROP POLICY IF EXISTS "shops_select_assigned_employee" ON public.shops;
CREATE POLICY "shops_select_assigned_employee"
  ON public.shops FOR SELECT
  USING (public.is_assigned_to_shop(id));

-- 22.2. Scoped SELECT policy for deliveries: Employee views only records of their assigned shop
DROP POLICY IF EXISTS "deliveries_select_assigned_employee" ON public.deliveries;
CREATE POLICY "deliveries_select_assigned_employee"
  ON public.deliveries FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 22.3. Scoped SELECT policy for delivery_items: Employee views only items of assigned shop deliveries
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

-- 22.4. Scoped SELECT policy for products: Employee can read catalog items of active business
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

-- 22.5. Scoped SELECT policy for shop_memberships: Employee can view own assignment
DROP POLICY IF EXISTS "shop_memberships_select_employee" ON public.shop_memberships;
CREATE POLICY "shop_memberships_select_employee"
  ON public.shop_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 22.6. Strict Mutation Restriction: Zero INSERT, UPDATE, or DELETE policies exist for employees.
-- Attempted writes by employees are unconditionally rejected by RLS at the database engine level.

-- ==============================================================================
-- SECTION 23: OTHER REQUIRED SECURITY POLICIES
-- ==============================================================================

-- 23.1. Profiles (Self-access & Shared Business Members)
DROP POLICY IF EXISTS "profiles_select_shared_business" ON public.profiles;
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

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 23.2. Audit Logs (Append-only & Owner Visibility)
DROP POLICY IF EXISTS "audit_logs_select_owner" ON public.audit_logs;
CREATE POLICY "audit_logs_select_owner"
  ON public.audit_logs FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "audit_logs_deny_update" ON public.audit_logs;
CREATE POLICY "audit_logs_deny_update"
  ON public.audit_logs FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "audit_logs_deny_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_deny_delete"
  ON public.audit_logs FOR DELETE
  USING (false);

-- 23.3. Idempotency Records
DROP POLICY IF EXISTS "idempotency_records_select_owner" ON public.idempotency_records;
CREATE POLICY "idempotency_records_select_owner"
  ON public.idempotency_records FOR SELECT
  USING (business_id = public.get_auth_business_id());

DROP POLICY IF EXISTS "idempotency_records_insert_owner" ON public.idempotency_records;
CREATE POLICY "idempotency_records_insert_owner"
  ON public.idempotency_records FOR INSERT
  WITH CHECK (business_id = public.get_auth_business_id());

DROP POLICY IF EXISTS "idempotency_records_update_owner" ON public.idempotency_records;
CREATE POLICY "idempotency_records_update_owner"
  ON public.idempotency_records FOR UPDATE
  USING (business_id = public.get_auth_business_id())
  WITH CHECK (business_id = public.get_auth_business_id());

DROP POLICY IF EXISTS "idempotency_records_delete_owner" ON public.idempotency_records;
CREATE POLICY "idempotency_records_delete_owner"
  ON public.idempotency_records FOR DELETE
  USING (business_id = public.get_auth_business_id());

-- 23.4. Maintenance Audit Ledger (Service Role / Postgres only)
DROP POLICY IF EXISTS "maintenance_ledger_service_role" ON public.maintenance_audit_ledger;
CREATE POLICY "maintenance_ledger_service_role"
  ON public.maintenance_audit_ledger
  USING (auth.role() = 'service_role');

-- ==============================================================================
-- SECTION 24: VIEWS
-- ==============================================================================

-- 24.1. Unified Business Records View (Directly maps to the Records Page Ledger)
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

-- 24.2. Shop-wise Payment & Outstanding Balances View
CREATE OR REPLACE VIEW public.v_shop_payment_balances WITH (security_invoker = true) AS
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

-- 24.3. Shop-wise Live Inventory Ledger Balances View
CREATE OR REPLACE VIEW public.v_shop_inventory_balances WITH (security_invoker = true) AS
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

-- View grants
GRANT SELECT ON public.v_business_records TO authenticated, service_role;
GRANT SELECT ON public.v_shop_payment_balances TO authenticated, service_role;
GRANT SELECT ON public.v_shop_inventory_balances TO authenticated, service_role;

-- ==============================================================================
-- SECTION 25: STORAGE POLICIES
-- ==============================================================================
-- RTR Wholesale Management uses standard Supabase Storage buckets for invoice PDFs
-- and product assets (e.g. 'receipts', 'catalog-images').
-- Storage RLS principles:
-- 1. Objects in 'receipts' bucket: Restricted to authenticated users belonging to the tenant business.
-- 2. Objects in 'catalog-images' bucket: Publicly readable; writable only by authenticated business owners.
-- In default deployments without custom buckets configured, file storage routes are handled
-- directly through the Node API service role credentials.

-- ==============================================================================
-- SECTION 26: REQUIRED SEED CONFIGURATION NOTES
-- ==============================================================================
-- Baseline Business Entity:
-- Production tenant business UUID: '4fba6fb7-4e1b-4106-ac84-908f821d73c3'
-- To bootstrap a fresh development or staging environment:
--
-- 1. Ensure tenant business entity exists:
INSERT INTO public.businesses (id, name, timezone, report_cutoff_time)
VALUES ('4fba6fb7-4e1b-4106-ac84-908f821d73c3', 'RTR Wholesale Management', 'Asia/Kolkata', '21:00:00')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    report_cutoff_time = EXCLUDED.report_cutoff_time;

-- 2. Associate authenticated owner profile:
-- When an owner registers or signs in via Supabase Auth (e.g. owner@rtrmobiles.com or username 'owner'),
-- grant them owner role in business_memberships:
INSERT INTO public.business_memberships (business_id, user_id, role, is_active)
SELECT 
    b.id, 
    p.id, 
    'owner',
    true
FROM public.businesses b
JOIN public.profiles p ON (
    p.email = 'owner@rtrmobiles.com' 
    OR p.username IN ('owner', 'vino', 'rtrowner', 'rtrmobiles')
)
WHERE b.is_active = true
ON CONFLICT (business_id, user_id) DO UPDATE
SET role = 'owner', is_active = true;

-- 3. Shop Employee Setup:
-- To onboard a shop employee for a retail partner shop:
-- a. Create Supabase Auth user (e.g. employee_vasanth@rtrmobiles.com).
-- b. Insert membership into public.business_memberships with role = 'employee'.
-- c. Insert assignment into public.shop_memberships with shop_id = <TARGET_SHOP_UUID>.
-- The application automatically routes the user to the Employee Portal with strictly
-- read-only, shop-isolated visibility.

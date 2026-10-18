-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT SYSTEM
-- MASTER DATABASE INITIALIZATION & SECURITY SCHEMA
-- FILE: supabase/RTR_WHOLESALE_MANAGEMENT_SCHEMA.sql
-- ==============================================================================
-- INSTRUCTIONS FOR SUPABASE SQL EDITOR:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard).
-- 2. Navigate to "SQL Editor" from the left navigation menu.
-- 3. Click "New query" and clear the editor window.
-- 4. Copy the ENTIRE contents of this file and paste it into the editor.
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter).
--
-- This script is completely self-contained, dependency-safe, and idempotent.
-- It establishes the complete database architecture, strict relational constraints,
-- automated stock & payment triggers, analytical views, least-privilege grants,
-- and comprehensive Row-Level Security (RLS) policies for RTR Mobiles.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. UTILITY & SYSTEM TRIGGER FUNCTIONS
-- ==============================================================================

-- 2.1. Automatically updates 'updated_at' timestamp on record mutation
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 2.2. Prevents updates or deletes on append-only immutable audit ledgers
CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Action rejected: Table % is an append-only immutable audit ledger.', TG_TABLE_NAME
    USING ERRCODE = '23505';
END;
$$;

-- 2.3. Automatic profile generation upon Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
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
-- 3. CORE RELATIONAL TABLES
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
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.3. Business Memberships (Owner vs Employee role mapping)
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

-- 3.5. Shop Memberships (Scoped access for store employees)
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
    unit_price NUMERIC(10, 2) DEFAULT 0.00 CHECK (unit_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
    delivery_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'delivered', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8. Delivery Line Items
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
    -- Ensures each shop can only submit one report per date, while multiple shops report on the same date independently
    CONSTRAINT uq_shop_report_date UNIQUE (shop_id, report_date)
);

-- 3.10. Daily Report Line Items
CREATE TABLE IF NOT EXISTS public.daily_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_sold INTEGER NOT NULL CHECK (quantity_sold >= 0),
    physical_count INTEGER CHECK (physical_count >= 0),
    notes VARCHAR(255),
    CONSTRAINT uq_report_product UNIQUE (report_id, product_id)
);

-- 3.11. Immutable Stock Movement Ledger (Audit-ready inventory journal)
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
    quantity INTEGER NOT NULL CHECK (quantity != 0), -- Positive for additions, negative for deductions
    reference_id UUID, -- Links to delivery_id, report_id, transfer_id, or adjustment_id
    is_provisional BOOLEAN NOT NULL DEFAULT false, -- True for unapproved daily sales
    reason TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.12. Physical Stock Audit Counts
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

-- 3.13. Inter-Shop Stock Transfers
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

-- 3.14. Authorized Stock Adjustments
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

-- 3.15. Invoices & Supply Memos (Receivables Tracking)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    outstanding_amount NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'fully_paid')),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_invoice_number UNIQUE (business_id, invoice_number),
    CONSTRAINT chk_amount_paid_not_exceed_total CHECK (amount_paid <= total_amount)
);

-- 3.16. Payments Received (Cash, UPI, Bank Transfers)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
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
    payment_reference VARCHAR(150), -- e.g. "Notebook Pg 14", "UPI txn id", "Cheque #4021"
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERSED', 'REFUNDED')),
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.17. Security & Activity Audit Logs
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

-- 3.18. API Idempotency Records
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

-- ==============================================================================
-- 4. PERFORMANCE & LOOKUP INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_product ON public.stock_movements(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON public.stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_daily_reports_shop_date ON public.daily_reports(shop_id, report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.daily_reports(status);

CREATE INDEX IF NOT EXISTS idx_deliveries_shop_date ON public.deliveries(shop_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

CREATE INDEX IF NOT EXISTS idx_shops_business ON public.shops(business_id);
CREATE INDEX IF NOT EXISTS idx_shops_code ON public.shops(code);

CREATE INDEX IF NOT EXISTS idx_shop_memberships_user ON public.shop_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_memberships_shop ON public.shop_memberships(shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_counts_shop_product ON public.stock_counts(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_to ON public.stock_transfers(from_shop_id, to_shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_shop_product ON public.stock_adjustments(shop_id, product_id);

CREATE INDEX IF NOT EXISTS idx_invoices_shop_date ON public.invoices(shop_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date ON public.payments(shop_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_actor ON public.audit_logs(business_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(target_entity, target_id);

-- ==============================================================================
-- 5. AUTOMATION TRIGGERS & BUSINESS INTEGRITY LOGIC
-- ==============================================================================

-- 5.1. Auth user profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.2. Standard updated_at triggers
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

DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5.3. Immutable ledger protection triggers
DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_immutable BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

-- 5.4. Automatic Payment & Invoice Status Synchronization
-- When a payment is recorded or reversed, updates amount_paid and status on the target invoice
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid NUMERIC(12, 2);
  v_total_amount NUMERIC(12, 2);
  v_new_status VARCHAR(20);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sum all completed payments for this invoice
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = v_invoice_id AND status = 'COMPLETED';

  SELECT total_amount
  INTO v_total_amount
  FROM public.invoices
  WHERE id = v_invoice_id;

  IF v_total_paid >= v_total_amount AND v_total_amount > 0 THEN
    v_new_status := 'fully_paid';
  ELSIF v_total_paid > 0 AND v_total_paid < v_total_amount THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'unpaid';
  END IF;

  UPDATE public.invoices
  SET amount_paid = LEAST(v_total_paid, total_amount),
      status = v_new_status,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_sync_invoice ON public.payments;
CREATE TRIGGER trg_payments_sync_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_on_change();

-- 5.5. Automatic Stock Movement Generation on Confirmed Deliveries
CREATE OR REPLACE FUNCTION public.post_delivery_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert DELIVERY_IN movement for each item in the delivery batch
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
      COALESCE('Delivery batch ' || NEW.delivery_number, 'Delivery batch ' || NEW.id::text),
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

-- 5.6. Automatic Stock Movement Generation on Stock Transfers
CREATE OR REPLACE FUNCTION public.post_transfer_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Deduct from source shop
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

  -- 2. Add to destination shop
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

-- 5.7. Automatic Stock Movement Generation on Daily Report Approval
CREATE OR REPLACE FUNCTION public.post_report_approval_stock_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- When daily sales report is approved by owner, post confirmed SALE_OUT movements
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
-- 6. SECURITY HELPER FUNCTIONS
-- ==============================================================================

-- 6.1. Get current authenticated user's active business_id
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

-- 6.2. Check if authenticated user is active owner of the target business
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

-- 6.3. Check if authenticated user is assigned to the target retail shop
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

-- 6.4. Stock Calculation Helper: Confirmed recorded stock balance
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

-- ==============================================================================
-- 7. ANALYTICAL DATABASE VIEWS
-- ==============================================================================

-- 7.1. Shop-wise Live Inventory Ledger Balances View
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

-- 7.2. Shop-wise Payment & Outstanding Balances View
CREATE OR REPLACE VIEW public.v_shop_payment_balances AS
SELECT
    s.id AS shop_id,
    s.name AS shop_name,
    s.code AS shop_code,
    COALESCE(SUM(inv.total_amount), 0.00)::NUMERIC(12, 2) AS total_invoiced,
    COALESCE(SUM(inv.amount_paid), 0.00)::NUMERIC(12, 2) AS total_paid,
    COALESCE(SUM(inv.outstanding_amount), 0.00)::NUMERIC(12, 2) AS outstanding_balance,
    CASE
        WHEN COALESCE(SUM(inv.total_amount), 0.00) = 0 THEN 'unpaid'
        WHEN COALESCE(SUM(inv.amount_paid), 0.00) >= COALESCE(SUM(inv.total_amount), 0.00) THEN 'fully_paid'
        WHEN COALESCE(SUM(inv.amount_paid), 0.00) > 0 THEN 'partially_paid'
        ELSE 'unpaid'
    END AS status,
    CASE
        WHEN COALESCE(SUM(inv.total_amount), 0.00) = 0 THEN 'grey'
        WHEN COALESCE(SUM(inv.amount_paid), 0.00) >= COALESCE(SUM(inv.total_amount), 0.00) THEN 'green'
        WHEN COALESCE(SUM(inv.amount_paid), 0.00) > 0 THEN 'yellow'
        ELSE 'grey'
    END AS badge_color,
    MAX(p.payment_date) AS last_payment_date,
    COUNT(DISTINCT p.id)::INTEGER AS payment_count
FROM public.shops s
LEFT JOIN public.invoices inv ON inv.shop_id = s.id
LEFT JOIN public.payments p ON p.shop_id = s.id AND p.status = 'COMPLETED'
WHERE s.is_active = true
GROUP BY s.id, s.name, s.code;

-- ==============================================================================
-- 8. PERMISSIONS & TABLE GRANTS (Least-Privilege)
-- ==============================================================================

-- Revoke all public default privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant execution on security functions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_auth_business_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_shop(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_shop_stock(UUID, UUID) TO authenticated, service_role;

-- Grant scoped table permissions to authenticated role (Row-Level Security governs actual rows)
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated; -- Append-only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated;

-- Grant SELECT on views
GRANT SELECT ON public.v_shop_inventory_balances TO authenticated, service_role;
GRANT SELECT ON public.v_shop_payment_balances TO authenticated, service_role;

-- Ensure postgres, service_role, and supabase_admin retain administrative and studio dashboard access
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

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
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

-- 9.1. Businesses Policies
DROP POLICY IF EXISTS "businesses_select_member" ON public.businesses;
CREATE POLICY "businesses_select_member"
  ON public.businesses FOR SELECT
  USING (id = public.get_auth_business_id());

DROP POLICY IF EXISTS "businesses_update_owner" ON public.businesses;
CREATE POLICY "businesses_update_owner"
  ON public.businesses FOR UPDATE
  USING (public.is_business_owner(id));

-- 9.2. Profiles Policies
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

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- 9.3. Business Memberships Policies
DROP POLICY IF EXISTS "memberships_select_member" ON public.business_memberships;
CREATE POLICY "memberships_select_member"
  ON public.business_memberships FOR SELECT
  USING (business_id = public.get_auth_business_id());

DROP POLICY IF EXISTS "memberships_manage_owner" ON public.business_memberships;
CREATE POLICY "memberships_manage_owner"
  ON public.business_memberships FOR ALL
  USING (public.is_business_owner(business_id));

-- 9.4. Shops Policies
DROP POLICY IF EXISTS "shops_select_owner" ON public.shops;
CREATE POLICY "shops_select_owner"
  ON public.shops FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "shops_select_assigned_employee" ON public.shops;
CREATE POLICY "shops_select_assigned_employee"
  ON public.shops FOR SELECT
  USING (public.is_assigned_to_shop(id));

DROP POLICY IF EXISTS "shops_manage_owner" ON public.shops;
CREATE POLICY "shops_manage_owner"
  ON public.shops FOR ALL
  USING (public.is_business_owner(business_id));

-- 9.5. Shop Memberships Policies
DROP POLICY IF EXISTS "shop_memberships_manage_owner" ON public.shop_memberships;
CREATE POLICY "shop_memberships_manage_owner"
  ON public.shop_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = public.shop_memberships.shop_id
        AND public.is_business_owner(s.business_id)
    )
  );

DROP POLICY IF EXISTS "shop_memberships_select_employee" ON public.shop_memberships;
CREATE POLICY "shop_memberships_select_employee"
  ON public.shop_memberships FOR SELECT
  USING (user_id = auth.uid());

-- 9.6. Products Policies
DROP POLICY IF EXISTS "products_select_member" ON public.products;
CREATE POLICY "products_select_member"
  ON public.products FOR SELECT
  USING (business_id = public.get_auth_business_id());

DROP POLICY IF EXISTS "products_manage_owner" ON public.products;
CREATE POLICY "products_manage_owner"
  ON public.products FOR ALL
  USING (public.is_business_owner(business_id));

-- 9.7. Deliveries Policies
DROP POLICY IF EXISTS "deliveries_manage_owner" ON public.deliveries;
CREATE POLICY "deliveries_manage_owner"
  ON public.deliveries FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "deliveries_select_assigned_employee" ON public.deliveries;
CREATE POLICY "deliveries_select_assigned_employee"
  ON public.deliveries FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 9.8. Delivery Items Policies
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

DROP POLICY IF EXISTS "delivery_items_manage_owner" ON public.delivery_items;
CREATE POLICY "delivery_items_manage_owner"
  ON public.delivery_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = public.delivery_items.delivery_id
        AND public.is_business_owner(d.business_id)
    )
  );

-- 9.9. Daily Reports Policies
DROP POLICY IF EXISTS "daily_reports_manage_owner" ON public.daily_reports;
CREATE POLICY "daily_reports_manage_owner"
  ON public.daily_reports FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "daily_reports_select_assigned_employee" ON public.daily_reports;
CREATE POLICY "daily_reports_select_assigned_employee"
  ON public.daily_reports FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

DROP POLICY IF EXISTS "daily_reports_insert_employee" ON public.daily_reports;
CREATE POLICY "daily_reports_insert_employee"
  ON public.daily_reports FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) 
    AND submitted_by = auth.uid()
    AND status = 'submitted'
  );

-- 9.10. Daily Report Items Policies
DROP POLICY IF EXISTS "daily_report_items_select" ON public.daily_report_items;
CREATE POLICY "daily_report_items_select"
  ON public.daily_report_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = public.daily_report_items.report_id
        AND (public.is_business_owner(r.business_id) OR public.is_assigned_to_shop(r.shop_id))
    )
  );

DROP POLICY IF EXISTS "daily_report_items_insert_employee" ON public.daily_report_items;
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

-- 9.11. Stock Movements Policies (Append-only Ledger)
DROP POLICY IF EXISTS "stock_movements_select_owner" ON public.stock_movements;
CREATE POLICY "stock_movements_select_owner"
  ON public.stock_movements FOR SELECT
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_movements_select_assigned_employee" ON public.stock_movements;
CREATE POLICY "stock_movements_select_assigned_employee"
  ON public.stock_movements FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

DROP POLICY IF EXISTS "stock_movements_insert_authorized" ON public.stock_movements;
CREATE POLICY "stock_movements_insert_authorized"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    public.is_business_owner(business_id) OR
    (public.is_assigned_to_shop(shop_id) AND actor_id = auth.uid())
  );

DROP POLICY IF EXISTS "stock_movements_deny_update" ON public.stock_movements;
CREATE POLICY "stock_movements_deny_update"
  ON public.stock_movements FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "stock_movements_deny_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_deny_delete"
  ON public.stock_movements FOR DELETE
  USING (false);

-- 9.12. Stock Counts Policies
DROP POLICY IF EXISTS "stock_counts_manage_owner" ON public.stock_counts;
CREATE POLICY "stock_counts_manage_owner"
  ON public.stock_counts FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_counts_select_assigned_employee" ON public.stock_counts;
CREATE POLICY "stock_counts_select_assigned_employee"
  ON public.stock_counts FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

DROP POLICY IF EXISTS "stock_counts_insert_assigned_employee" ON public.stock_counts;
CREATE POLICY "stock_counts_insert_assigned_employee"
  ON public.stock_counts FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) AND counted_by = auth.uid()
  );

-- 9.13. Stock Transfers Policies
DROP POLICY IF EXISTS "stock_transfers_manage_owner" ON public.stock_transfers;
CREATE POLICY "stock_transfers_manage_owner"
  ON public.stock_transfers FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_transfers_select_assigned_employee" ON public.stock_transfers;
CREATE POLICY "stock_transfers_select_assigned_employee"
  ON public.stock_transfers FOR SELECT
  USING (public.is_assigned_to_shop(from_shop_id) OR public.is_assigned_to_shop(to_shop_id));

-- 9.14. Stock Adjustments Policies
DROP POLICY IF EXISTS "stock_adjustments_manage_owner" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_manage_owner"
  ON public.stock_adjustments FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "stock_adjustments_select_assigned_employee" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_select_assigned_employee"
  ON public.stock_adjustments FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 9.15. Invoices Policies
DROP POLICY IF EXISTS "invoices_manage_owner" ON public.invoices;
CREATE POLICY "invoices_manage_owner"
  ON public.invoices FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_select_assigned_employee" ON public.invoices;
CREATE POLICY "invoices_select_assigned_employee"
  ON public.invoices FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 9.16. Payments Policies
DROP POLICY IF EXISTS "payments_manage_owner" ON public.payments;
CREATE POLICY "payments_manage_owner"
  ON public.payments FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_select_assigned_employee" ON public.payments;
CREATE POLICY "payments_select_assigned_employee"
  ON public.payments FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 9.17. Audit Logs Policies (Append-only)
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

-- 9.18. Idempotency Records Policies
DROP POLICY IF EXISTS "idempotency_records_manage" ON public.idempotency_records;
CREATE POLICY "idempotency_records_manage"
  ON public.idempotency_records FOR ALL
  USING (business_id = public.get_auth_business_id());

-- ==============================================================================
-- 10. SAFE BASELINE BOOTSTRAP (Zero Demo Business Data)
-- ==============================================================================
-- Initializes the root business identity for RTR Wholesale Management.
-- In accordance with zero-demo data policies, NO sample retail shops, mock products,
-- fake deliveries, or dummy payment records are created. Real data is entered
-- directly through the application by the business owner.

INSERT INTO public.businesses (id, name, timezone, report_cutoff_time)
VALUES ('b0000000-0000-0000-0000-000000000001', 'RTR Wholesale Management', 'Asia/Kolkata', '21:00:00')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    report_cutoff_time = EXCLUDED.report_cutoff_time;

-- Optional Owner Profile Fixture for Local Testing (Safe ON CONFLICT)
-- Note: When an owner signs up via Supabase Auth with ID 'u0000000-0000-0000-0000-000000000001',
-- this grant assigns them the owner role immediately.
INSERT INTO public.business_memberships (business_id, user_id, role)
VALUES ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT DO NOTHING;

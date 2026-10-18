-- ==============================================================================
-- CRIMPSTON WHOLESALE ACCESSORIES MANAGEMENT SYSTEM
-- MIGRATION: 0002_shop_payments_and_transfers.sql
-- DESCRIPTION: Introduces shop-wise billing (invoices/receivables), cash & multi-method
--              payment tracking, balance auto-recalculation, and stock transfers.
-- NOTE: Fully idempotent. Safe to run directly in Supabase SQL Editor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE STOCK MOVEMENTS TO SUPPORT TRANSFERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_movements 
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements 
  ADD CONSTRAINT stock_movements_movement_type_check 
  CHECK (movement_type IN ('DELIVERY_IN', 'SALE_OUT', 'AUDIT_ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT'));

-- ------------------------------------------------------------------------------
-- 2. INVOICES / RECEIVABLES TABLE
-- ------------------------------------------------------------------------------
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
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_invoice_number UNIQUE (business_id, invoice_number)
);

-- ------------------------------------------------------------------------------
-- 3. PAYMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER')),
    payment_reference VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERSED', 'REFUNDED')),
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_shop_date ON public.invoices(shop_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date ON public.payments(shop_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);

-- ------------------------------------------------------------------------------
-- 5. PAYMENT RECALCULATION TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_inv_id UUID;
  new_total_paid NUMERIC(12, 2);
  inv_total NUMERIC(12, 2);
BEGIN
  target_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF target_inv_id IS NOT NULL THEN
    -- Calculate sum of valid completed payments for this invoice
    SELECT COALESCE(SUM(amount), 0.00)
    INTO new_total_paid
    FROM public.payments
    WHERE invoice_id = target_inv_id AND status = 'COMPLETED';

    -- Retrieve total billable amount
    SELECT total_amount
    INTO inv_total
    FROM public.invoices
    WHERE id = target_inv_id;

    -- Update invoice paid total and status
    UPDATE public.invoices
    SET amount_paid = new_total_paid,
        status = CASE 
          WHEN new_total_paid >= inv_total THEN 'fully_paid'
          WHEN new_total_paid > 0 THEN 'partially_paid'
          ELSE 'unpaid'
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_inv_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on payments insert, update, or delete
DROP TRIGGER IF EXISTS trg_sync_invoice_payments ON public.payments;
CREATE TRIGGER trg_sync_invoice_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_totals();

-- Timestamp trigger on invoices
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. PERMISSIONS & GRANTS
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7.1 Invoices Policies
DROP POLICY IF EXISTS "invoices_manage_owner" ON public.invoices;
CREATE POLICY "invoices_manage_owner"
  ON public.invoices FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "invoices_select_assigned_employee" ON public.invoices;
CREATE POLICY "invoices_select_assigned_employee"
  ON public.invoices FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

-- 7.2 Payments Policies
DROP POLICY IF EXISTS "payments_manage_owner" ON public.payments;
CREATE POLICY "payments_manage_owner"
  ON public.payments FOR ALL
  USING (public.is_business_owner(business_id));

DROP POLICY IF EXISTS "payments_select_assigned_employee" ON public.payments;
CREATE POLICY "payments_select_assigned_employee"
  ON public.payments FOR SELECT
  USING (public.is_assigned_to_shop(shop_id));

DROP POLICY IF EXISTS "payments_insert_employee" ON public.payments;
CREATE POLICY "payments_insert_employee"
  ON public.payments FOR INSERT
  WITH CHECK (
    public.is_assigned_to_shop(shop_id) AND recorded_by = auth.uid()
  );

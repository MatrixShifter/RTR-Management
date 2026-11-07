-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0012
-- Database Scalability, Foreign Key Indexes, Idempotency & Financial Guardrails
-- ==============================================================================

-- 1. FOREIGN KEY INDEXES TO ELIMINATE SEQUENTIAL SCANS DURING CASCADES & JOINS
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id 
  ON public.delivery_items(delivery_id);

CREATE INDEX IF NOT EXISTS idx_invoices_delivery_id 
  ON public.invoices(delivery_id);

CREATE INDEX IF NOT EXISTS idx_payments_delivery_id 
  ON public.payments(delivery_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
  ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id 
  ON public.stock_movements(reference_id);

-- 2. COMPOSITE INDEXES FOR FILTERING, SORTING, AND TIMELINE QUERIES
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_date 
  ON public.deliveries(shop_id, delivery_date DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_business_created 
  ON public.deliveries(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_shop_date 
  ON public.invoices(shop_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_shop_date 
  ON public.payments(shop_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_shops_business_active 
  ON public.shops(business_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_products_business_active 
  ON public.products(business_id, is_active, name);

-- 3. IDEMPOTENCY KEYS TABLE FOR DISTRIBUTED AT-MOST-ONCE MUTATION SAFETY
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID,
  endpoint VARCHAR(255) NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
  ON public.idempotency_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_business 
  ON public.idempotency_keys(business_id, key);

-- Enable Row Level Security on idempotency keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'idempotency_keys' AND policyname = 'idempotency_keys_manage_owner'
  ) THEN
    CREATE POLICY idempotency_keys_manage_owner ON public.idempotency_keys
      FOR ALL
      USING (auth.uid() = user_id OR auth.role() = 'service_role')
      WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- 4. FINANCIAL GUARDRAIL CONSTRAINTS (PREVENT NEGATIVE MONEY / INVENTORY CORRUPTION)
DO $$
BEGIN
  -- Ensure payments must be strictly positive amounts
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_positive_amount'
  ) THEN
    ALTER TABLE public.payments 
      ADD CONSTRAINT chk_payments_positive_amount CHECK (amount > 0);
  END IF;

  -- Ensure delivery total amount cannot be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deliveries_non_negative_total'
  ) THEN
    ALTER TABLE public.deliveries 
      ADD CONSTRAINT chk_deliveries_non_negative_total CHECK (total_amount >= 0);
  END IF;

  -- Ensure invoice total and paid amounts cannot be negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_non_negative_amounts'
  ) THEN
    ALTER TABLE public.invoices 
      ADD CONSTRAINT chk_invoices_non_negative_amounts 
      CHECK (total_amount >= 0 AND amount_paid >= 0 AND outstanding_amount >= 0);
  END IF;
END $$;

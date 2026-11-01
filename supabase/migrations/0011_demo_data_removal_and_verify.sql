-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MIGRATION 0011
-- COMBINED: PERMANENT DEMO DATA REMOVAL + SCHEMA VERIFICATION
-- ==============================================================================
-- This migration is the production-ready version of the planned migration 0010.
-- It is fully idempotent and safe to run in Supabase SQL Editor.
--
-- WHAT THIS DOES:
--   1. Verifies all safety conditions (no live deliveries/invoices/payments for demo shops)
--   2. Temporarily disables the immutable audit ledger trigger (admin maintenance only)
--   3. Permanently purges confirmed demo/test stock movements (77 rows)
--   4. Re-enables the immutable trigger immediately
--   5. Permanently deletes demo/test shop memberships, products, and shops
--   6. Reactivates genuine partner shops (vasanth, Shop A) and product (9a combo)
--   7. Logs operation to maintenance_audit_ledger table
--
-- CONFIRMED DEMO ENTITIES TO PURGE:
--   Shops:    DEMO - Mobile Shop A, shopa, 1dhope
--   Products: DEMO - Mobile Case, producta, rqwrert
--
-- GENUINE ENTITIES TO PRESERVE & REACTIVATE:
--   Shops:    vasanth, Shop A
--   Products: mobile, 9a outter butto, 9a combo, a02s combo
-- ==============================================================================

BEGIN;

-- 1. Create maintenance audit ledger if it doesn't exist
CREATE TABLE IF NOT EXISTS public.maintenance_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_name TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    details JSONB NOT NULL
);

-- 2. Execute the targeted purge
DO $$
DECLARE
    -- Confirmed demo/test shops
    v_demo_shop_id   UUID := '4ab21b42-209a-4e16-ae77-8c869ab973ed'; -- DEMO - Mobile Shop A
    v_test_shopa_id  UUID := '05c290af-4977-42fa-bda2-8d8da30f27bf'; -- shopa
    v_test_1dhope_id UUID := '24b1302b-3c7e-4766-8cdc-ac02a0f766af'; -- 1dhope

    -- Confirmed demo/test products
    v_demo_prod_id   UUID := '0cea2553-1467-4443-b329-4caf997b56d2'; -- DEMO - Mobile Case
    v_test_proda_id  UUID := 'bf97d62e-dcf3-4022-8290-e45986ea1623'; -- producta
    v_test_rqwr_id   UUID := '312cdb3b-98b8-4f30-9860-bd9ef55f5b77'; -- rqwrert

    -- Genuine entities to reactivate
    v_genuine_vasanth_id UUID := '5979fb8e-9326-4cfd-a358-9e7d7a1d2ee2'; -- vasanth
    v_genuine_shopa_id   UUID := '251f7abf-3c9d-44ba-9f12-b5edeac0aee3'; -- Shop A
    v_genuine_9acombo_id UUID := '84992aca-9128-45cd-82c8-38bcbd3557f7'; -- 9a combo

    v_found_sm_count     INTEGER;
    v_deleted_sm_count   INTEGER := 0;
    v_deleted_shops      INTEGER := 0;
    v_deleted_prods      INTEGER := 0;
    v_deleted_members    INTEGER := 0;
BEGIN
    RAISE NOTICE 'RTR Migration 0011: Starting permanent demo data removal...';

    -- Safety check: No live deliveries referencing demo shops
    IF EXISTS (
        SELECT 1 FROM public.deliveries
        WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
    ) THEN
        RAISE EXCEPTION 'Safety check FAILED: Active deliveries found referencing demo shops. Aborting.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.invoices
        WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
    ) THEN
        RAISE EXCEPTION 'Safety check FAILED: Active invoices found referencing demo shops. Aborting.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
    ) THEN
        RAISE EXCEPTION 'Safety check FAILED: Active payments found referencing demo shops. Aborting.';
    END IF;

    -- Count demo stock movements to be removed
    SELECT COUNT(*) INTO v_found_sm_count
    FROM public.stock_movements
    WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
       OR product_id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);

    RAISE NOTICE 'Found % stock movements referencing demo/test entities.', v_found_sm_count;

    IF v_found_sm_count > 0 THEN
        -- Temporarily disable immutable audit trigger for admin maintenance only
        ALTER TABLE public.stock_movements DISABLE TRIGGER trg_stock_movements_immutable;

        DELETE FROM public.stock_movements
        WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
           OR product_id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);
        GET DIAGNOSTICS v_deleted_sm_count = ROW_COUNT;

        -- Immediately re-enable the immutable trigger
        ALTER TABLE public.stock_movements ENABLE TRIGGER trg_stock_movements_immutable;
        RAISE NOTICE 'Purged % demo stock movements. Immutable trigger re-enabled.', v_deleted_sm_count;
    ELSE
        RAISE NOTICE 'No demo stock movements found — already purged or not present.';
    END IF;

    -- Remove demo shop memberships
    DELETE FROM public.shop_memberships
    WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id);
    GET DIAGNOSTICS v_deleted_members = ROW_COUNT;

    -- Remove demo products
    DELETE FROM public.products
    WHERE id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);
    GET DIAGNOSTICS v_deleted_prods = ROW_COUNT;

    -- Remove demo shops
    DELETE FROM public.shops
    WHERE id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id);
    GET DIAGNOSTICS v_deleted_shops = ROW_COUNT;

    -- Reactivate genuine partner shops (removing accidental archived badge)
    UPDATE public.shops
    SET is_active = true, updated_at = timezone('utc'::text, now())
    WHERE id IN (v_genuine_vasanth_id, v_genuine_shopa_id)
      AND is_active = false;

    -- Reactivate genuine product
    UPDATE public.products
    SET is_active = true, updated_at = timezone('utc'::text, now())
    WHERE id = v_genuine_9acombo_id
      AND is_active = false;

    -- Log operation
    INSERT INTO public.maintenance_audit_ledger (operation_name, details)
    VALUES (
        'PERMANENT_DEMO_DATA_REMOVAL_0011',
        jsonb_build_object(
            'deleted_stock_movements', v_deleted_sm_count,
            'deleted_shops',           v_deleted_shops,
            'deleted_products',        v_deleted_prods,
            'deleted_shop_memberships', v_deleted_members,
            'purged_shops',    jsonb_build_array('DEMO - Mobile Shop A', 'shopa', '1dhope'),
            'purged_products', jsonb_build_array('DEMO - Mobile Case', 'producta', 'rqwrert'),
            'reactivated_shops',    jsonb_build_array('vasanth', 'Shop A'),
            'reactivated_products', jsonb_build_array('9a combo'),
            'timestamp', timezone('utc'::text, now())
        )
    );

    RAISE NOTICE 'Migration 0011 complete: % shops, % products, % stock movements permanently purged.', v_deleted_shops, v_deleted_prods, v_deleted_sm_count;
    RAISE NOTICE 'Genuine shops (vasanth, Shop A) and product (9a combo) reactivated.';

END $$;

COMMIT;

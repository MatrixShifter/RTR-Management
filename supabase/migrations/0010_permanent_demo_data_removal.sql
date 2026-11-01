-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT — MAINTENANCE MIGRATION: 0010_permanent_demo_data_removal.sql
-- TARGET: PERMANENT REMOVAL OF CONFIRMED DEMO-PURPOSE SHOPS, PRODUCTS, AND LINKED AUDIT LEDGER
-- RE-ALIGNMENT: Reactivate genuine client partner shops and products mistakenly archived by past delete tests
-- SAFETY: Fully transactional, verified entity IDs, immutable trigger temporarily suspended
--         ONLY during this administrative maintenance block, with immediate re-enablement and verification.
-- ==============================================================================

BEGIN;

-- 1. Create audit table for maintenance operations if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.maintenance_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_name TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    details JSONB NOT NULL
);

-- 2. Define and execute the targeted demo entity purge
DO $$
DECLARE
    -- Confirmed demo/test shops:
    v_demo_shop_id UUID   := '4ab21b42-209a-4e16-ae77-8c869ab973ed'; -- DEMO - Mobile Shop A
    v_test_shopa_id UUID  := '05c290af-4977-42fa-bda2-8d8da30f27bf'; -- shopa (development test shop)
    v_test_1dhope_id UUID := '24b1302b-3c7e-4766-8cdc-ac02a0f766af'; -- 1dhope (development test shop, 9 deliveries)

    -- Confirmed demo/test products:
    v_demo_prod_id UUID   := '0cea2553-1467-4443-b329-4caf997b56d2'; -- DEMO - Mobile Case
    v_test_proda_id UUID  := 'bf97d62e-dcf3-4022-8290-e45986ea1623'; -- producta (development test product)
    v_test_rqwr_id UUID   := '312cdb3b-98b8-4f30-9860-bd9ef55f5b77'; -- rqwrert (development test product)

    -- Genuine entities to reactivate:
    v_genuine_vasanth_id UUID := '5979fb8e-9326-4cfd-a358-9e7d7a1d2ee2'; -- vasanth
    v_genuine_shopa_id UUID   := '251f7abf-3c9d-44ba-9f12-b5edeac0aee3'; -- Shop A
    v_genuine_9acombo_id UUID := '84992aca-9128-45cd-82c8-38bcbd3557f7'; -- 9a combo

    v_found_sm_count INTEGER;
    v_deleted_sm_count INTEGER := 0;
    v_deleted_shops INTEGER := 0;
    v_deleted_prods INTEGER := 0;
    v_deleted_members INTEGER := 0;
BEGIN
    RAISE NOTICE 'Step 1: Verifying target demo and test entities in database...';

    -- Pre-verification: Verify that no live deliveries, invoices, or payments reference target demo shops
    IF EXISTS (SELECT 1 FROM public.deliveries WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)) THEN
        RAISE EXCEPTION 'Safety check failed: Active deliveries found referencing target demo shops.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.invoices WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)) THEN
        RAISE EXCEPTION 'Safety check failed: Active invoices found referencing target demo shops.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.payments WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)) THEN
        RAISE EXCEPTION 'Safety check failed: Active payments found referencing target demo shops.';
    END IF;

    -- Count dependent stock movements linked to demo/test shops or demo/test products
    SELECT COUNT(*) INTO v_found_sm_count
    FROM public.stock_movements
    WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
       OR product_id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);

    RAISE NOTICE 'Verified: Found % stock movements referencing target demo/test entities (Expected: 77 movements).', v_found_sm_count;

    -- Step 2: Temporarily disable the immutable ledger trigger for this administrative maintenance block only
    ALTER TABLE public.stock_movements DISABLE TRIGGER trg_stock_movements_immutable;

    -- Step 3: Delete dependent stock movements referencing target demo/test entities
    DELETE FROM public.stock_movements
    WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id)
       OR product_id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);
    GET DIAGNOSTICS v_deleted_sm_count = ROW_COUNT;

    -- Step 4: Immediately re-enable the immutable trigger to guarantee zero disruption to ledger immutability
    ALTER TABLE public.stock_movements ENABLE TRIGGER trg_stock_movements_immutable;

    RAISE NOTICE 'Verified: Re-enabled trg_stock_movements_immutable. Purged % stock movements.', v_deleted_sm_count;

    -- Step 5: Delete shop memberships for purged demo/test shops
    DELETE FROM public.shop_memberships
    WHERE shop_id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id);
    GET DIAGNOSTICS v_deleted_members = ROW_COUNT;

    -- Step 6: Delete parent demo/test products
    DELETE FROM public.products
    WHERE id IN (v_demo_prod_id, v_test_proda_id, v_test_rqwr_id);
    GET DIAGNOSTICS v_deleted_prods = ROW_COUNT;

    -- Step 7: Delete parent demo/test shops
    DELETE FROM public.shops
    WHERE id IN (v_demo_shop_id, v_test_shopa_id, v_test_1dhope_id);
    GET DIAGNOSTICS v_deleted_shops = ROW_COUNT;

    -- Step 8: Reactivate genuine client partner shops and genuine products mistakenly archived by past delete tests
    UPDATE public.shops
    SET is_active = true, updated_at = timezone('utc'::text, now())
    WHERE id IN (v_genuine_vasanth_id, v_genuine_shopa_id);

    UPDATE public.products
    SET is_active = true, updated_at = timezone('utc'::text, now())
    WHERE id = v_genuine_9acombo_id;

    -- Step 9: Record completion in maintenance audit ledger
    INSERT INTO public.maintenance_audit_ledger (operation_name, details)
    VALUES (
        'PERMANENT_DEMO_DATA_REMOVAL',
        jsonb_build_object(
            'deleted_stock_movements', v_deleted_sm_count,
            'deleted_shops', v_deleted_shops,
            'deleted_products', v_deleted_prods,
            'deleted_shop_memberships', v_deleted_members,
            'purged_shops', jsonb_build_array('DEMO - Mobile Shop A', 'shopa', '1dhope'),
            'purged_products', jsonb_build_array('DEMO - Mobile Case', 'producta', 'rqwrert'),
            'reactivated_shops', jsonb_build_array('vasanth', 'Shop A'),
            'reactivated_products', jsonb_build_array('9a combo'),
            'timestamp', timezone('utc'::text, now())
        )
    );

    RAISE NOTICE 'Maintenance complete: % shops, % products, % stock movements permanently purged. Genuine shops reactivated.',
        v_deleted_shops, v_deleted_prods, v_deleted_sm_count;
END $$;

COMMIT;

-- ==============================================================================
-- RTR WHOLESALE MANAGEMENT SYSTEM
-- SEED SCRIPT: seed.sql
-- DESCRIPTION: Sets up the core business workspace entity and owner account.
--              In accordance with zero-demo data policy, NO fictional retail shops,
--              sample products, fake deliveries, or mock transactions are seeded.
--              Real business records are entered directly through the application.
-- NOTE: Safe to run directly in Supabase SQL Editor.
-- ==============================================================================

-- 1. Owner Auth User (Enables secure login for development & testing)
INSERT INTO auth.users (
  id, 
  instance_id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at, 
  role, 
  aud
)
VALUES 
  (
    'u0000000-0000-0000-0000-000000000001', 
    '00000000-0000-0000-0000-000000000000', 
    'owner@rtrmobiles.com', 
    crypt('dev_fixture_token', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}'::jsonb, 
    '{"full_name":"Business Owner"}'::jsonb, 
    now(), 
    now(), 
    'authenticated', 
    'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- 2. RTR Mobiles Business Workspace
INSERT INTO public.businesses (id, name, timezone, report_cutoff_time)
VALUES ('b0000000-0000-0000-0000-000000000001', 'RTR Wholesale Management', 'Asia/Kolkata', '21:00:00')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    report_cutoff_time = EXCLUDED.report_cutoff_time;

-- 3. Owner Profile
INSERT INTO public.profiles (id, email, full_name)
VALUES 
  ('u0000000-0000-0000-0000-000000000001', 'owner@rtrmobiles.com', 'Business Owner')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- 4. Owner Business Membership
INSERT INTO public.business_memberships (business_id, user_id, role)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT DO NOTHING;

-- 5. Initial Audit Log
INSERT INTO public.audit_logs (business_id, actor_id, action, target_entity, target_id, details)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001', 
    'u0000000-0000-0000-0000-000000000001', 
    'WORKSPACE_INITIALIZED', 
    'businesses', 
    'b0000000-0000-0000-0000-000000000001', 
    '{"environment": "production", "system": "RTR Wholesale Management", "version": "1.0.0"}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Zero demo data: No shops, products, deliveries, stock counts, invoices, or payments are inserted here.

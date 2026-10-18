-- Safe Local Development Fixtures (Non-production)
-- Business
INSERT INTO public.businesses (id, name, timezone, report_cutoff_time)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Crimpston Accessories Wholesale Ltd', 'Asia/Kolkata', '21:00:00')
ON CONFLICT (id) DO NOTHING;

-- Profiles (Fictional Dev Identities)
INSERT INTO public.profiles (id, email, full_name)
VALUES 
  ('u0000000-0000-0000-0000-000000000001', 'owner@crimpston.dev', 'Rajesh Crimpston (Owner)'),
  ('u0000000-0000-0000-0000-000000000002', 'emp.store1@crimpston.dev', 'Arun Kumar (Store 1 Employee)'),
  ('u0000000-0000-0000-0000-000000000003', 'emp.store2@crimpston.dev', 'Deepak Sharma (Store 2 Employee)')
ON CONFLICT (id) DO NOTHING;

-- Business Memberships
INSERT INTO public.business_memberships (business_id, user_id, role)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002', 'employee'),
  ('b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000003', 'employee')
ON CONFLICT DO NOTHING;

-- Retail Shops
INSERT INTO public.shops (id, business_id, name, code, address, phone)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Apex Mobiles & Telecom', 'SH-01', 'Shop 12, Commercial Complex, Sector 4', '+91 9876543210'),
  ('s0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'City Point Digital Hub', 'SH-02', 'Plot 45, Main Market Road', '+91 9876543211')
ON CONFLICT (id) DO NOTHING;

-- Shop Memberships (Employee Scoping)
INSERT INTO public.shop_memberships (shop_id, user_id)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002'), -- Arun -> Store 1
  ('s0000000-0000-0000-0000-000000000002', 'u0000000-0000-0000-0000-000000000003')  -- Deepak -> Store 2
ON CONFLICT DO NOTHING;

-- Products Catalog
INSERT INTO public.products (id, business_id, name, sku, category, unit_of_measure, min_stock_threshold)
VALUES
  ('p0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Shockproof Armor Case (iPhone 15)', 'CASE-IP15-ARM', 'Mobile Cases', 'piece', 5),
  ('p0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '9H 2.5D Tempered Glass (Galaxy S24)', 'TG-S24-9H', 'Tempered Glass', 'piece', 10),
  ('p0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '65W GaN Fast Charger Dual Port', 'CHG-65W-GAN', 'Chargers & Adapters', 'piece', 3),
  ('p0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Braided Type-C to Type-C 100W Cable 1.5m', 'CBL-CC-100W', 'USB Cables', 'piece', 8),
  ('p0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'BassPro Wireless Earbuds BT 5.3', 'AUD-TWS-BPRO', 'Earphones & Audio', 'piece', 4)
ON CONFLICT (id) DO NOTHING;

-- Deliveries
INSERT INTO public.deliveries (id, business_id, shop_id, delivery_date, status, notes, created_by)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'delivered', 'Morning batch supply to Apex Mobiles', 'u0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.delivery_items (delivery_id, product_id, quantity)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 10),
  ('d0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 15),
  ('d0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 5)
ON CONFLICT DO NOTHING;

-- Initial Stock Movements from Deliveries
INSERT INTO public.stock_movements (business_id, shop_id, product_id, movement_type, quantity, reference_id, is_provisional, reason, actor_id)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', 'DELIVERY_IN', 10, 'd0000000-0000-0000-0000-000000000001', false, 'Delivery Batch #1', 'u0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', 'DELIVERY_IN', 15, 'd0000000-0000-0000-0000-000000000001', false, 'Delivery Batch #1', 'u0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', 'DELIVERY_IN', 5, 'd0000000-0000-0000-0000-000000000001', false, 'Delivery Batch #1', 'u0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

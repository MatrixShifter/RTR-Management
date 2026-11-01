import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('Connecting to:', process.env.SUPABASE_URL);

  const { data: shops, error: sErr } = await supabase.from('shops').select('*');
  if (sErr) console.error('Shops error:', sErr);
  else {
    console.log('\n=== ALL SHOPS ===');
    console.table(shops.map(s => ({
      id: s.id,
      name: s.name,
      code: s.code,
      is_active: s.is_active,
      created_at: s.created_at
    })));
  }

  const { data: products, error: pErr } = await supabase.from('products').select('*');
  if (pErr) console.error('Products error:', pErr);
  else {
    console.log('\n=== ALL PRODUCTS ===');
    console.table(products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      is_active: p.is_active,
      created_at: p.created_at
    })));
  }

  // Check all deliveries
  const { data: deliveries, error: dErr } = await supabase.from('deliveries').select('id, shop_id, delivery_date, status, total_amount, created_at');
  console.log('\n=== DELIVERIES COUNT ===', deliveries ? deliveries.length : 0);
  if (deliveries && deliveries.length > 0) {
    console.table(deliveries);
  }

  // Check delivery_items
  const { data: delivItems } = await supabase.from('delivery_items').select('id, delivery_id, product_id, quantity, wholesale_price, customer_price');
  console.log('\n=== DELIVERY ITEMS COUNT ===', delivItems ? delivItems.length : 0);

  // Check stock_movements
  const { data: stockMovements, error: smErr } = await supabase.from('stock_movements').select('id, shop_id, product_id, movement_type, quantity, reason, created_at');
  console.log('\n=== STOCK MOVEMENTS COUNT ===', stockMovements ? stockMovements.length : 0);
  if (stockMovements && stockMovements.length > 0) {
    // Group by shop_id
    const byShop = {};
    for (const m of stockMovements) {
      byShop[m.shop_id] = (byShop[m.shop_id] || 0) + 1;
    }
    console.log('Stock movements by shop_id:');
    console.table(byShop);

    // Group by product_id
    const byProduct = {};
    for (const m of stockMovements) {
      byProduct[m.product_id] = (byProduct[m.product_id] || 0) + 1;
    }
    console.log('Stock movements by product_id:');
    console.table(byProduct);
  }

  // Check invoices
  const { data: invoices } = await supabase.from('invoices').select('id, shop_id, invoice_number, total_amount');
  console.log('\n=== INVOICES COUNT ===', invoices ? invoices.length : 0);

  // Check payments
  const { data: payments } = await supabase.from('payments').select('id, delivery_id, shop_id, amount_paid');
  console.log('\n=== PAYMENTS COUNT ===', payments ? payments.length : 0);

  // Check shop_memberships
  const { data: shopMembers } = await supabase.from('shop_memberships').select('*');
  console.log('\n=== SHOP MEMBERSHIPS COUNT ===', shopMembers ? shopMembers.length : 0);
  if (shopMembers) console.table(shopMembers);
}

run().catch(console.error);

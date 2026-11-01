import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('id, shop_id, product_id, movement_type, quantity, reason, created_at, shops(name, code, is_active), products(name, sku, is_active)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total stock movements: ${movements.length}`);

  // Summary by shop
  const shopSummary = {};
  for (const m of movements) {
    const sName = m.shops?.name || m.shop_id;
    if (!shopSummary[sName]) {
      shopSummary[sName] = {
        shopId: m.shop_id,
        shopName: sName,
        isActive: m.shops?.is_active,
        count: 0,
        reasons: new Set(),
        products: new Set()
      };
    }
    shopSummary[sName].count++;
    shopSummary[sName].reasons.add(m.reason);
    shopSummary[sName].products.add(m.products?.name || m.product_id);
  }

  for (const sName in shopSummary) {
    const s = shopSummary[sName];
    console.log(`\n========================================`);
    console.log(`SHOP: ${s.shopName} (ID: ${s.shopId}) [Active: ${s.isActive}]`);
    console.log(`Total stock movements: ${s.count}`);
    console.log(`Referenced Products (${s.products.size}):`, Array.from(s.products));
    console.log(`Distinct Reasons (${s.reasons.size}):`, Array.from(s.reasons).slice(0, 10));
  }
}

inspect();

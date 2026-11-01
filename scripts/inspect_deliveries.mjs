import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectDeliveries() {
  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('id, shop_id, product_id, reference_id, reason, created_at, shops(name), products(name)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const deliveryMap = new Map();
  for (const m of movements) {
    let delivId = m.reference_id;
    if (!delivId && m.reason.startsWith('Wholesale Delivery ')) {
      delivId = m.reason.replace('Wholesale Delivery ', '').trim();
    }
    const key = delivId || m.reason;
    if (!deliveryMap.has(key)) {
      deliveryMap.set(key, {
        deliveryKey: key,
        shopId: m.shop_id,
        shopName: m.shops?.name,
        reasons: new Set(),
        products: new Set(),
        movementCount: 0,
        dates: []
      });
    }
    const entry = deliveryMap.get(key);
    entry.reasons.add(m.reason);
    entry.products.add(m.products?.name);
    entry.movementCount++;
    entry.dates.push(m.created_at);
  }

  console.log(`\nTOTAL DISTINCT HISTORICAL DELIVERY TRANSACTIONS: ${deliveryMap.size}\n`);
  
  let idx = 1;
  for (const [key, val] of deliveryMap.entries()) {
    console.log(`[${idx++}] Key/DeliveryId: ${key}`);
    console.log(`    Shop: ${val.shopName} (${val.shopId})`);
    console.log(`    Products: ${Array.from(val.products).join(', ')}`);
    console.log(`    Movement count: ${val.movementCount}`);
    console.log(`    Date: ${val.dates[0]}`);
  }
}

inspectDeliveries();

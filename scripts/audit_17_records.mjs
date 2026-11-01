import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit17Records() {
  const shopIds = [
    '05c290af-4977-42fa-bda2-8d8da30f27bf', // shopa
    '24b1302b-3c7e-4766-8cdc-ac02a0f766af'  // 1dhope
  ];

  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('*, shops(name, code, is_active), products(name, sku, is_active)')
    .in('shop_id', shopIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  // Group by delivery transaction
  const transactions = new Map();
  for (const m of movements) {
    const key = m.reference_id || m.reason.replace('Wholesale Delivery ', '').trim();
    if (!transactions.has(key)) {
      transactions.set(key, {
        deliveryId: key,
        shopId: m.shop_id,
        shopName: m.shops?.name,
        shopCode: m.shops?.code,
        date: m.created_at,
        movements: [],
        products: new Set(),
        totalQuantity: 0
      });
    }
    const t = transactions.get(key);
    t.movements.push(m);
    t.products.add(`${m.products?.name} (${m.products?.sku})`);
    t.totalQuantity += m.quantity;
  }

  console.log(`\n========================================================================`);
  console.log(`AUDIT OF ALL 17 HISTORICAL RECORDS (ASSOCIATED WITH shopa & 1dhope)`);
  console.log(`Total Transactions Found: ${transactions.size}`);
  console.log(`========================================================================\n`);

  let i = 1;
  const auditReport = [];
  for (const [key, t] of transactions.entries()) {
    const isTestProduct = Array.from(t.products).some(p => p.includes('producta') || p.includes('rqwrert'));
    const classification = isTestProduct ? 'TEST / DEMO (Test product reference)' : 'DEVELOPMENT TEST TRANSACTION';

    const item = {
      index: i++,
      deliveryId: key,
      shop: `${t.shopName} [${t.shopCode}]`,
      products: Array.from(t.products).join('; '),
      movementCount: t.movements.length,
      totalQuantity: t.totalQuantity,
      createdAt: t.date,
      classification
    };
    auditReport.push(item);
  }

  console.table(auditReport);
}

audit17Records();

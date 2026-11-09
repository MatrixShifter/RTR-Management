import { 
  supabaseAdmin, 
  supabaseServiceRoleKey 
} from '../../_supabase.js';
import { authenticateOwner } from '../../_employees.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query || {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Shop ID is required.'
    });
  }

  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  if (owner.isDemo) {
    return res.status(200).json({ inUse: false, count: 0 });
  }

  const client = supabaseServiceRoleKey ? supabaseAdmin : owner.client;

  try {
    const [delivRes, invRes, repRes, movRes] = await Promise.all([
      client.from('deliveries').select('id', { count: 'exact', head: true }).eq('shop_id', id),
      client.from('invoices').select('id', { count: 'exact', head: true }).eq('shop_id', id),
      client.from('daily_reports').select('id', { count: 'exact', head: true }).eq('shop_id', id),
      client.from('stock_movements').select('id', { count: 'exact', head: true }).eq('shop_id', id)
    ]);

    const totalRecords = (delivRes.count || 0) +
                         (invRes.count || 0) +
                         (repRes.count || 0) +
                         (movRes.count || 0);

    return res.status(200).json({
      inUse: totalRecords > 0,
      count: totalRecords
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to check shop usage.'
    });
  }
}

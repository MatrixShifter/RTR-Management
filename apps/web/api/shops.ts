import { isDemoShop } from '@crimpston/shared';
import { 
  supabaseAdmin, 
  supabaseServiceRoleKey 
} from './_supabase.js';
import { authenticateOwner } from './_employees.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  let { id, action } = req.query || {};
  if (Array.isArray(id)) id = id[0];
  if (Array.isArray(action)) action = action[0];

  // URL fallback parsing if rewrites didn't inject query
  if ((!id || !action) && req.url) {
    const match = req.url.match(/\/api\/shops\/([^\/\?]+)(?:\/([^\/\?]+))?/);
    if (match) {
      if (!id) id = match[1];
      if (!action && match[2]) action = match[2];
    }
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Shop ID is required.'
    });
  }

  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  if (owner.isDemo) {
    if (action === 'usage') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      return res.status(200).json({ inUse: false, count: 0 });
    }
    if (req.method === 'DELETE') {
      return res.status(200).json({
        success: true,
        action: 'deleted',
        message: 'Demo shop deleted in sandbox.',
        shopId: id
      });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = supabaseServiceRoleKey ? supabaseAdmin : owner.client;

  // Handle /api/shops/:id/usage
  if (action === 'usage') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

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

  // Handle /api/shops/:id
  try {
    const { data: existingShop, error: fetchErr } = await client
      .from('shops')
      .select('id, name, business_id, is_active')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingShop) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop not found.'
      });
    }

    if (existingShop.business_id !== owner.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage this shop.'
      });
    }

    if (isDemoShop(existingShop)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Confirmed demo shop cannot be mutated or deleted. It is retained to preserve immutable audit history.'
      });
    }

    if (req.method === 'DELETE') {
      // Check historical records
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

      // Safe archival if historical records exist
      if (totalRecords > 0) {
        const { data: updatedRows, error: archErr } = await client
          .from('shops')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select('id, name');

        if (archErr) throw archErr;

        if (!updatedRows || updatedRows.length === 0) {
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Database rejected shop archival. No records were modified in Supabase.'
          });
        }

        return res.status(200).json({
          success: true,
          action: 'archived',
          message: `"${existingShop.name}" is referenced by ${totalRecords} historical records. It has been safely deactivated and archived.`,
          shopId: id,
          shopName: existingShop.name,
          inUse: true,
          recordsCount: totalRecords
        });
      }

      // Safe permanent deletion ONLY if ZERO historical records exist
      await client.from('shop_memberships').delete().eq('shop_id', id);

      const { data: deletedRows, error: delErr } = await client
        .from('shops')
        .delete()
        .eq('id', id)
        .select('id, name');

      if (delErr) throw delErr;

      if (!deletedRows || deletedRows.length === 0) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Database rejected shop deletion. No records were modified in Supabase.'
        });
      }

      return res.status(200).json({
        success: true,
        action: 'deleted',
        message: `"${existingShop.name}" deleted successfully.`,
        shopId: id,
        shopName: existingShop.name,
        recordsCount: 0
      });
    }

    return res.status(405).json({
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not supported.`
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to process shop request.'
    });
  }
}

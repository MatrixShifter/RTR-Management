import { isDemoProduct } from '@crimpston/shared';
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
    const match = req.url.match(/\/api\/products\/([^\/\?]+)(?:\/([^\/\?]+))?/);
    if (match) {
      if (!id) id = match[1];
      if (!action && match[2]) action = match[2];
    }
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Product ID is required.'
    });
  }

  // 1. Authenticate owner
  const owner = await authenticateOwner(req, res);
  if (!owner) return; // Response already sent

  // Handle Demo Mode
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
        message: 'Demo product deleted in sandbox.',
        productId: id
      });
    }
    if (req.method === 'GET') {
      return res.status(200).json({
        product: {
          id,
          name: 'Demo Product',
          sku: 'DEMO-SKU-01',
          category: 'Mobile Cases',
          min_stock_threshold: 5,
          unit_price: 150,
          cost_price: 90,
          is_active: true
        }
      });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = supabaseServiceRoleKey ? supabaseAdmin : owner.client;

  // Handle /api/products/:id/usage
  if (action === 'usage') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const [itemRes, moveRes, reportItemRes, countRes, transRes, adjRes] = await Promise.all([
        client.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_counts').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('product_id', id)
      ]);

      const totalRecords = (itemRes.count || 0) +
                           (moveRes.count || 0) +
                           (reportItemRes.count || 0) +
                           (countRes.count || 0) +
                           (transRes.count || 0) +
                           (adjRes.count || 0);

      return res.status(200).json({
        inUse: totalRecords > 0,
        count: totalRecords
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Failed to check product usage.'
      });
    }
  }

  // Handle /api/products/:id
  try {
    const { data: existingProduct, error: fetchErr } = await client
      .from('products')
      .select('id, name, business_id, is_active')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingProduct) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found.'
      });
    }

    if (existingProduct.business_id !== owner.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage this product.'
      });
    }

    if (isDemoProduct(existingProduct)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Confirmed demo product cannot be mutated or deleted. It is retained to preserve immutable audit history.'
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ product: existingProduct });
    }

    if (req.method === 'DELETE') {
      // Check historical and dependent records
      const [itemRes, moveRes, reportItemRes, countRes, transRes, adjRes] = await Promise.all([
        client.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_counts').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('product_id', id),
        client.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('product_id', id)
      ]);

      const totalRecords = (itemRes.count || 0) +
                           (moveRes.count || 0) +
                           (reportItemRes.count || 0) +
                           (countRes.count || 0) +
                           (transRes.count || 0) +
                           (adjRes.count || 0);

      // Safe archival if historical records exist
      if (totalRecords > 0) {
        const { data: updatedRows, error: archiveErr } = await client
          .from('products')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select('id, name, is_active');

        if (archiveErr) throw archiveErr;

        if (!updatedRows || updatedRows.length === 0) {
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Database rejected product archival. No records were modified in Supabase.'
          });
        }

        return res.status(200).json({
          success: true,
          action: 'archived',
          message: `"${existingProduct.name}" is referenced by ${totalRecords} historical records. It has been safely deactivated and archived.`,
          productId: id,
          productName: existingProduct.name,
          inUse: true,
          recordsCount: totalRecords
        });
      }

      // Safe permanent deletion ONLY if ZERO historical records exist
      const { data: deletedRows, error: delErr } = await client
        .from('products')
        .delete()
        .eq('id', id)
        .select('id, name');

      if (delErr) {
        // Fallback to archive if FK constraint blocks delete
        if (delErr.code === '23503' || delErr.code === '23505') {
          const { data: archRows, error: archErr } = await client
            .from('products')
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('id, name');

          if (archErr || !archRows || archRows.length === 0) {
            return res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to safely archive product after foreign-key conflict.'
            });
          }

          return res.status(200).json({
            success: true,
            action: 'archived',
            message: `"${existingProduct.name}" is referenced by existing history. It has been safely deactivated and archived.`,
            productId: id,
            productName: existingProduct.name,
            inUse: true,
            recordsCount: 1
          });
        }
        throw delErr;
      }

      // Assert that at least 1 record was genuinely deleted in Supabase
      if (!deletedRows || deletedRows.length === 0) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Database rejected product deletion. No records were modified in Supabase.'
        });
      }

      return res.status(200).json({
        success: true,
        action: 'deleted',
        message: `"${existingProduct.name}" deleted successfully.`,
        productId: id,
        productName: existingProduct.name,
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
      message: err.message || 'Failed to process product request.'
    });
  }
}

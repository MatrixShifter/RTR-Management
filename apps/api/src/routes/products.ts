import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../logger.js';
import { config } from '../config.js';

export const productsRouter = Router();

const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * GET /api/products
 * Returns products catalog for the authenticated business.
 */
productsRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(200).json({ products: [] });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, category, min_stock_threshold, unit_price, cost_price, is_active, created_at')
      .eq('business_id', user.businessId)
      .order('name');

    if (error) throw error;
    return res.status(200).json({ products: data || [] });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve products.'
    });
  }
});

/**
 * GET /api/products/:id/usage
 * Checks if a product is referenced in any delivery line items, inventory, or audit movements.
 */
productsRouter.get('/:id/usage', requireOwnerAuth, async (req: Request, res: Response) => {
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product ID is required.' });
  }

  try {
    const [itemRes, moveRes, reportItemRes, countRes, transRes, adjRes] = await Promise.all([
      supabaseAdmin.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_counts').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('product_id', productId)
    ]);

    const totalCount = (itemRes.count || 0) + 
                       (moveRes.count || 0) + 
                       (reportItemRes.count || 0) + 
                       (countRes.count || 0) + 
                       (transRes.count || 0) + 
                       (adjRes.count || 0);

    return res.status(200).json({
      inUse: totalCount > 0,
      count: totalCount,
      details: {
        deliveryItems: itemRes.count || 0,
        stockMovements: moveRes.count || 0,
        dailyReportItems: reportItemRes.count || 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check product usage.'
    });
  }
});

/**
 * DELETE /api/products/:id
 * Deletes or safely archives a wholesale product:
 * - If product is referenced in historical deliveries, inventory, or audit movements: soft-deletes (archives) with is_active = false.
 * - If product has ZERO historical records: permanently removes from products table.
 */
productsRouter.delete('/:id', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Product ID is required.'
    });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: 'Demo product deleted in sandbox.',
      productId
    });
  }

  try {
    // 1. Verify product exists and belongs to the business
    const { data: existingProduct, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('id, name, business_id')
      .eq('id', productId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingProduct) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found.'
      });
    }

    if (existingProduct.business_id !== user.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage this product.'
      });
    }

    // 2. Comprehensive check across all dependent business and audit records
    const [itemRes, moveRes, reportItemRes, countRes, transRes, adjRes] = await Promise.all([
      supabaseAdmin.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_counts').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('product_id', productId)
    ]);

    const totalRecords = (itemRes.count || 0) + 
                         (moveRes.count || 0) + 
                         (reportItemRes.count || 0) + 
                         (countRes.count || 0) + 
                         (transRes.count || 0) + 
                         (adjRes.count || 0);

    // 3. Safe archiving if ANY historical records exist (strictly preserving audit trail)
    if (totalRecords > 0) {
      const { error: archiveErr } = await supabaseAdmin
        .from('products')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (archiveErr) throw archiveErr;

      logSecurityEvent({
        action: 'ARCHIVE_PRODUCT',
        actorId: user.id,
        targetId: productId,
        status: 'SUCCESS',
        ip: req.ip,
        details: { productName: existingProduct.name, totalRecords }
      });

      return res.status(200).json({
        success: true,
        action: 'archived',
        message: `"${existingProduct.name}" is referenced by ${totalRecords} historical business/audit records. It has been safely deactivated and archived to preserve history.`,
        productId,
        productName: existingProduct.name,
        recordsCount: totalRecords
      });
    }

    // 4. Safe permanent deletion ONLY if ZERO historical records exist
    const { error: delErr } = await supabaseAdmin.from('products').delete().eq('id', productId);
    if (delErr) throw delErr;

    logSecurityEvent({
      action: 'DELETE_PRODUCT',
      actorId: user.id,
      targetId: productId,
      status: 'SUCCESS',
      ip: req.ip,
      details: { productName: existingProduct.name }
    });

    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: `"${existingProduct.name}" deleted successfully.`,
      productId,
      productName: existingProduct.name
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete product.'
    });
  }
});

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { isDemoShop } from '@crimpston/shared';
import { requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../logger.js';
import { config } from '../config.js';

export const shopsRouter = Router();

const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * GET /api/shops
 * Returns list of retail partner shops for the authenticated business.
 */
shopsRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(200).json({ shops: [] });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('shops')
      .select('id, name, code, address, phone, is_active, created_at')
      .eq('business_id', user.businessId)
      .order('name');

    if (error) throw error;
    const genuineShops = (data || []).filter((s: any) => !isDemoShop(s));
    return res.status(200).json({ shops: genuineShops });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve shops.'
    });
  }
});

/**
 * GET /api/shops/:id/usage
 * Checks if a shop is currently referenced in any delivery, inventory, or audit records.
 * Strictly verifies existence and business ownership to prevent cross-tenant enumeration.
 */
shopsRouter.get('/:id/usage', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const shopId = req.params.id;

  if (!shopId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop ID is required.' });
  }

  if (isDemoShop({ id: shopId })) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Usage check and management is prohibited for confirmed demo entities.'
    });
  }

  if (user.isDemo) {
    return res.status(200).json({
      inUse: false,
      count: 0,
      details: {
        deliveries: 0,
        stockMovements: 0,
        invoices: 0,
        dailyReports: 0,
        transfers: 0
      }
    });
  }

  try {
    // 1. Verify existence and cross-tenant ownership
    const { data: existingShop, error: shopErr } = await supabaseAdmin
      .from('shops')
      .select('id, business_id')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr) throw shopErr;

    // Cross-tenant IDOR protection: if shop exists but belongs to another business, reject with 403
    if (existingShop && existingShop.business_id !== user.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to check usage for this shop.'
      });
    }

    if (!existingShop) {
      return res.status(200).json({
        inUse: false,
        count: 0,
        details: {
          deliveries: 0,
          stockMovements: 0,
          invoices: 0,
          dailyReports: 0,
          transfers: 0
        }
      });
    }

    const [delivRes, moveRes, invRes, repRes, transFromRes, transToRes] = await Promise.all([
      supabaseAdmin.from('deliveries').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('business_id', user.businessId),
      supabaseAdmin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('business_id', user.businessId),
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('business_id', user.businessId),
      supabaseAdmin.from('daily_reports').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('business_id', user.businessId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('from_shop_id', shopId).eq('business_id', user.businessId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('to_shop_id', shopId).eq('business_id', user.businessId)
    ]);

    const totalCount = (delivRes.count || 0) + 
                       (moveRes.count || 0) + 
                       (invRes.count || 0) + 
                       (repRes.count || 0) + 
                       (transFromRes.count || 0) + 
                       (transToRes.count || 0);

    return res.status(200).json({
      inUse: totalCount > 0,
      count: totalCount,
      details: {
        deliveries: delivRes.count || 0,
        stockMovements: moveRes.count || 0,
        invoices: invRes.count || 0,
        dailyReports: repRes.count || 0,
        transfers: (transFromRes.count || 0) + (transToRes.count || 0)
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check shop usage.'
    });
  }
});

/**
 * DELETE /api/shops/:id
 * Deletes or safely archives a retail partner shop:
 * - If shop has deliveries, stock movements, invoices, reports, or transfers: soft-deletes (archives) with is_active = false.
 *   This strictly preserves PostgreSQL's append-only immutable stock_movements audit ledger without triggering conflict 409.
 * - If shop has ZERO historical business records: permanently removes from shops table.
 */
shopsRouter.delete('/:id', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const shopId = req.params.id;

  if (!shopId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Shop ID is required.'
    });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: 'Demo shop deleted in sandbox.',
      shopId
    });
  }

  try {
    // 1. Verify shop exists and belongs to the business
    const { data: existingShop, error: fetchErr } = await supabaseAdmin
      .from('shops')
      .select('id, name, business_id')
      .eq('id', shopId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingShop) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop not found.'
      });
    }

    if (existingShop.business_id !== user.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to manage this shop.'
      });
    }

    if (isDemoShop(existingShop)) {
      logSecurityEvent({
        action: 'DEMO_SHOP_MUTATION_BLOCKED',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId: (req.headers['x-correlation-id'] as string),
        details: { shopId, reason: 'Confirmed demo shop retained for immutable audit ledger' }
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Confirmed demo shop cannot be mutated or deleted. It is retained to preserve immutable audit history.'
      });
    }

    // 2. Comprehensive check across all dependent business and audit tables
    const [delivRes, moveRes, invRes, repRes, transFromRes, transToRes] = await Promise.all([
      supabaseAdmin.from('deliveries').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabaseAdmin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabaseAdmin.from('daily_reports').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('from_shop_id', shopId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('to_shop_id', shopId)
    ]);

    const totalRecords = (delivRes.count || 0) + 
                         (moveRes.count || 0) + 
                         (invRes.count || 0) + 
                         (repRes.count || 0) + 
                         (transFromRes.count || 0) + 
                         (transToRes.count || 0);

    // 3. Safe archiving if ANY historical records exist (strictly preserving immutable audit ledger)
    if (totalRecords > 0) {
      const { error: archiveErr } = await supabaseAdmin
        .from('shops')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', shopId);

      if (archiveErr) throw archiveErr;

      logSecurityEvent({
        action: 'ARCHIVE_SHOP',
        actorId: user.id,
        targetId: shopId,
        status: 'SUCCESS',
        ip: req.ip,
        details: { shopName: existingShop.name, totalRecords }
      });

      return res.status(200).json({
        success: true,
        action: 'archived',
        message: `"${existingShop.name}" is referenced by ${totalRecords} historical business/audit records. It has been safely deactivated and archived to preserve audit history.`,
        shopId,
        shopName: existingShop.name,
        recordsCount: totalRecords
      });
    }

    // 4. Safe permanent deletion ONLY if ZERO historical records exist
    await supabaseAdmin.from('shop_memberships').delete().eq('shop_id', shopId);
    const { error: delErr } = await supabaseAdmin.from('shops').delete().eq('id', shopId);
    if (delErr) throw delErr;

    logSecurityEvent({
      action: 'DELETE_SHOP',
      actorId: user.id,
      targetId: shopId,
      status: 'SUCCESS',
      ip: req.ip,
      details: { shopName: existingShop.name }
    });

    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: `"${existingShop.name}" deleted successfully.`,
      shopId,
      shopName: existingShop.name
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete shop.'
    });
  }
});

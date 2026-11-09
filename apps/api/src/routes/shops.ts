import { Router, Request, Response } from 'express';
import { isDemoShop } from '@crimpston/shared';
import { requireAuth, requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../logger.js';
import { supabaseAdmin } from '../supabase.js';
import { cacheService } from '../services/cache.js';

export const shopsRouter = Router();

/**
 * GET /api/shops
 * Returns list of retail partner shops for the authenticated business.
 */
shopsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(200).json({ shops: [] });
  }

  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;
  const hasPagination = rawLimit !== undefined || rawOffset !== undefined;
  const limit = typeof rawLimit === 'string' && !isNaN(parseInt(rawLimit, 10))
    ? Math.min(Math.max(1, parseInt(rawLimit, 10)), 500)
    : (hasPagination ? 50 : 1000);
  const offset = typeof rawOffset === 'string' && !isNaN(parseInt(rawOffset, 10))
    ? Math.max(0, parseInt(rawOffset, 10))
    : 0;

  const cacheKey = `shops:${user.businessId}:${user.role}:${user.assignedShopId || 'all'}:${limit}:${offset}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    let query = supabaseAdmin
      .from('shops')
      .select('id, name, code, address, phone, is_active, created_at')
      .eq('business_id', user.businessId)
      .order('name');

    // Strict Employee Scoping: Employee only sees their assigned shop
    if (user.role === 'employee') {
      if (!user.assignedShopId) {
        return res.status(403).json({ error: 'Forbidden', message: 'No active assigned shop.' });
      }
      query = query.eq('id', user.assignedShopId);
    }

    if (hasPagination) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    const genuineShops = (data || []).filter((s: any) => !isDemoShop(s));
    const responsePayload = hasPagination
      ? { shops: genuineShops, pagination: { limit, offset, count: genuineShops.length } }
      : { shops: genuineShops };

    await cacheService.set(cacheKey, responsePayload, 60000);
    return res.status(200).json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve shops.'
    });
  }
});

/**
 * GET /api/shops/:id
 * Retrieves details for a specific shop.
 */
shopsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const shopId = req.params.id;

  if (!shopId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop ID is required.' });
  }

  // Strict Employee Scoping: Employee can only access their assigned shop
  if (user.role === 'employee' && user.assignedShopId !== shopId) {
    return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this shop.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      shop: {
        id: shopId,
        name: 'Demo Shop',
        code: 'DEMO-01',
        address: '123 Demo St',
        phone: '9999999999',
        is_active: true,
        created_at: new Date().toISOString()
      }
    });
  }

  try {
    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .select('id, name, code, address, phone, is_active, business_id, created_at, updated_at')
      .eq('id', shopId)
      .maybeSingle();

    if (error) throw error;

    if (!shop || shop.business_id !== user.businessId) {
      return res.status(404).json({ error: 'Not Found', message: 'Shop not found.' });
    }

    if (isDemoShop(shop)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access to demo shop prohibited.' });
    }

    return res.status(200).json({ shop });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve shop details.'
    });
  }
});

/**
 * POST /api/shops
 * Registers a new retail partner shop with strict duplicate validation.
 */
shopsRouter.post('/', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const { name, code, address, phone, isActive } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop name cannot exceed 100 characters.' });
  }

  // Generate or sanitize shop code
  let shopCode = (typeof code === 'string' && code.trim()) ? code.trim().toUpperCase() : '';
  if (!shopCode) {
    const cleanPrefix = trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP';
    shopCode = `SH-${cleanPrefix}-${Date.now().toString().slice(-4)}`;
  }

  if (shopCode.length > 30) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop code cannot exceed 30 characters.' });
  }

  // Prevent creation of demo shops
  if (isDemoShop({ name: trimmedName, code: shopCode })) {
    return res.status(400).json({ error: 'Validation Error', message: 'Cannot create demo or reserved shop names.' });
  }

  if (user.isDemo) {
    const mockCreated = {
      id: `demo-shop-${Date.now()}`,
      name: trimmedName,
      code: shopCode,
      address: address || '',
      phone: phone || '',
      is_active: isActive ?? true,
      created_at: new Date().toISOString()
    };
    return res.status(201).json({ success: true, shop: mockCreated });
  }

  try {
    // 1. Check duplicate shop name (case-insensitive) within this business
    const { data: existingByName, error: nameErr } = await supabaseAdmin
      .from('shops')
      .select('id, name')
      .eq('business_id', user.businessId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (nameErr) throw nameErr;

    if (existingByName) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A shop with the name "${trimmedName}" already exists in your business.`
      });
    }

    // 2. Check duplicate shop code within this business
    const { data: existingByCode, error: codeErr } = await supabaseAdmin
      .from('shops')
      .select('id, code')
      .eq('business_id', user.businessId)
      .eq('code', shopCode)
      .maybeSingle();

    if (codeErr) throw codeErr;

    if (existingByCode) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A shop with code "${shopCode}" already exists in your business.`
      });
    }

    // 3. Insert new shop
    const { data: newShop, error: insertErr } = await supabaseAdmin
      .from('shops')
      .insert({
        business_id: user.businessId,
        name: trimmedName,
        code: shopCode,
        address: (typeof address === 'string') ? address.trim() : '',
        phone: (typeof phone === 'string') ? phone.trim() : '',
        is_active: isActive !== undefined ? Boolean(isActive) : true
      })
      .select('id, name, code, address, phone, is_active, created_at, updated_at')
      .single();

    if (insertErr) throw insertErr;

    // Associate creator in shop_memberships
    try {
      await supabaseAdmin.from('shop_memberships').insert({
        shop_id: newShop.id,
        user_id: user.id
      });
    } catch {
      // ignore if exists
    }

    logSecurityEvent({
      action: 'CREATE_SHOP',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 201,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'shop',
      details: { shopId: newShop.id, name: newShop.name, code: newShop.code }
    });

    await cacheService.invalidate(`shops:${user.businessId}`);

    return res.status(201).json({
      success: true,
      message: `Shop "${newShop.name}" created successfully.`,
      shop: newShop
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to create shop.'
    });
  }
});

/**
 * PUT /api/shops/:id
 * Updates retail shop details or toggles activation state with duplicate validation.
 */
shopsRouter.put('/:id', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const shopId = req.params.id;
  const { name, code, address, phone, isActive } = req.body;

  if (!shopId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop ID is required.' });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop name is required.' });
  }

  const trimmedName = name.trim();
  const shopCode = (typeof code === 'string' && code.trim()) ? code.trim().toUpperCase() : '';

  if (!shopCode) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop code is required.' });
  }

  if (isDemoShop({ id: shopId, name: trimmedName, code: shopCode })) {
    return res.status(403).json({ error: 'Forbidden', message: 'Demo shop cannot be mutated.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo shop updated.',
      shop: { id: shopId, name: trimmedName, code: shopCode, address, phone, is_active: isActive ?? true }
    });
  }

  try {
    // 1. Verify existence and ownership
    const { data: existingShop, error: fetchErr } = await supabaseAdmin
      .from('shops')
      .select('id, name, code, business_id')
      .eq('id', shopId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingShop) {
      return res.status(404).json({ error: 'Not Found', message: 'Shop not found.' });
    }

    if (existingShop.business_id !== user.businessId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to manage this shop.' });
    }

    // 2. Validate duplicate name against other shops
    const { data: dupName, error: nameErr } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('business_id', user.businessId)
      .ilike('name', trimmedName)
      .neq('id', shopId)
      .maybeSingle();

    if (nameErr) throw nameErr;

    if (dupName) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Another shop with the name "${trimmedName}" already exists in your business.`
      });
    }

    // 3. Validate duplicate code against other shops
    const { data: dupCode, error: codeErr } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('business_id', user.businessId)
      .eq('code', shopCode)
      .neq('id', shopId)
      .maybeSingle();

    if (codeErr) throw codeErr;

    if (dupCode) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Another shop with code "${shopCode}" already exists in your business.`
      });
    }

    // 4. Perform update
    const updatePayload: Record<string, any> = {
      name: trimmedName,
      code: shopCode,
      address: typeof address === 'string' ? address.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      updated_at: new Date().toISOString()
    };

    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive);
    }

    const { data: updatedShop, error: updateErr } = await supabaseAdmin
      .from('shops')
      .update(updatePayload)
      .eq('id', shopId)
      .select('id, name, code, address, phone, is_active, created_at, updated_at')
      .single();

    if (updateErr) throw updateErr;

    logSecurityEvent({
      action: 'UPDATE_SHOP',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'shop',
      details: { shopId, name: updatedShop.name, isActive: updatedShop.is_active }
    });

    await cacheService.invalidate(`shops:${user.businessId}`);

    return res.status(200).json({
      success: true,
      message: `Shop "${updatedShop.name}" updated successfully.`,
      shop: updatedShop
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to update shop.'
    });
  }
});

/**
 * GET /api/shops/:id/history
 * Returns shop-wise delivery, sales and payment history ledger.
 */
shopsRouter.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const shopId = req.params.id;

  if (!shopId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Shop ID is required.' });
  }

  // Employee scoping
  if (user.role === 'employee' && user.assignedShopId !== shopId) {
    return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      history: {
        shopId,
        totalDeliveries: 0,
        totalDeliveredUnits: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        deliveries: []
      }
    });
  }

  try {
    // 1. Verify existence and ownership
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from('shops')
      .select('id, name, code, business_id')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr) throw shopErr;
    if (!shop || shop.business_id !== user.businessId) {
      return res.status(404).json({ error: 'Not Found', message: 'Shop not found.' });
    }

    // 2. Query deliveries for this shop
    const { data: deliveries, error: delErr } = await supabaseAdmin
      .from('deliveries')
      .select(`
        id,
        delivery_date,
        status,
        total_amount,
        amount_paid,
        notes,
        created_at,
        delivery_items (
          id,
          product_id,
          quantity,
          unit_price,
          total_price,
          products (id, name, sku)
        )
      `)
      .eq('shop_id', shopId)
      .eq('business_id', user.businessId)
      .order('delivery_date', { ascending: false });

    if (delErr) throw delErr;

    let totalDeliveredUnits = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;

    const formattedDeliveries = (deliveries || []).map((d: any) => {
      const items = (d.delivery_items || []).map((it: any) => {
        const qty = Number(it.quantity) || 0;
        totalDeliveredUnits += qty;
        return {
          id: it.id,
          productId: it.product_id,
          productName: it.products?.name || 'Product',
          productSku: it.products?.sku || '',
          quantity: qty,
          unitPrice: Number(it.unit_price) || 0,
          totalPrice: Number(it.total_price) || 0
        };
      });

      const tot = Number(d.total_amount) || 0;
      const paid = Number(d.amount_paid) || 0;
      totalInvoiced += tot;
      totalPaid += paid;

      return {
        id: d.id,
        deliveryDate: d.delivery_date,
        status: d.status,
        totalAmount: tot,
        amountPaid: paid,
        pendingAmount: Math.max(0, tot - paid),
        notes: d.notes,
        items
      };
    });

    return res.status(200).json({
      history: {
        shopId: shop.id,
        shopName: shop.name,
        shopCode: shop.code,
        totalDeliveries: formattedDeliveries.length,
        totalDeliveredUnits,
        totalInvoiced,
        totalPaid,
        outstandingBalance: Math.max(0, totalInvoiced - totalPaid),
        deliveries: formattedDeliveries
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve shop history.'
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
        resourceType: 'shop',
        details: { reason: 'demo_shop_retained' }
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
        category: 'record_mutation',
        status: 'SUCCESS',
        statusCode: 200,
        correlationId: (req.headers['x-correlation-id'] as string),
        resourceType: 'shop',
        details: { reason: 'referenced_by_historical_records', isActive: false }
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
    const { data: deletedRows, error: delErr } = await supabaseAdmin.from('shops').delete().eq('id', shopId).select('id, name');
    if (delErr) throw delErr;
    if (!deletedRows || deletedRows.length === 0) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Database rejected shop deletion. No records were modified in Supabase.'
      });
    }

    logSecurityEvent({
      action: 'DELETE_SHOP',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'shop'
    });

    await cacheService.invalidate(`shops:${user.businessId}`);

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

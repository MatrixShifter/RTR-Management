import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { isDemoProduct } from '@crimpston/shared';
import { requireAuth, requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../logger.js';
import { cacheService } from '../services/cache.js';

export const productsRouter = Router();

/**
 * GET /api/products
 * Returns products catalog for the authenticated business.
 * Supports pagination via ?limit=50&offset=0.
 */
productsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(200).json({ products: [] });
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

  const cacheKey = `products:${user.businessId}:${limit}:${offset}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    let query = supabaseAdmin
      .from('products')
      .select('id, name, sku, category, min_stock_threshold, unit_price, cost_price, is_active, created_at')
      .eq('business_id', user.businessId)
      .order('name');

    if (hasPagination) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    const genuineProducts = (data || []).filter((p: any) => !isDemoProduct(p));
    const responsePayload = hasPagination
      ? { products: genuineProducts, pagination: { limit, offset, count: genuineProducts.length } }
      : { products: genuineProducts };

    await cacheService.set(cacheKey, responsePayload, 60000);
    return res.status(200).json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve products.'
    });
  }
});

/**
 * GET /api/products/:id
 * Retrieves details for a specific wholesale product.
 */
productsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product ID is required.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      product: {
        id: productId,
        name: 'Demo Product',
        sku: 'DEMO-SKU-01',
        category: 'Mobile Cases',
        min_stock_threshold: 5,
        unit_price: 150,
        cost_price: 90,
        is_active: true,
        created_at: new Date().toISOString()
      }
    });
  }

  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, category, min_stock_threshold, unit_price, cost_price, is_active, business_id, created_at, updated_at')
      .eq('id', productId)
      .maybeSingle();

    if (error) throw error;

    if (!product || product.business_id !== user.businessId) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
    }

    if (isDemoProduct(product)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access to demo product prohibited.' });
    }

    return res.status(200).json({ product });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve product details.'
    });
  }
});

/**
 * POST /api/products
 * Registers a new wholesale product in the catalog with duplicate validation.
 */
productsRouter.post('/', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const { name, sku, category, unitPrice, costPrice, minStock, isActive } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 150) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product name cannot exceed 150 characters.' });
  }

  let productSku = (typeof sku === 'string' && sku.trim()) ? sku.trim().toUpperCase() : '';
  if (!productSku) {
    const rawCode = trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PROD';
    productSku = `SKU-${rawCode}-${Date.now().toString().slice(-4)}`;
  }

  if (productSku.length > 50) {
    return res.status(400).json({ error: 'Validation Error', message: 'SKU cannot exceed 50 characters.' });
  }

  const chosenCategory = (typeof category === 'string' && category.trim()) ? category.trim() : 'Other Accessories';
  const numUnitPrice = typeof unitPrice === 'number' ? Math.max(0, unitPrice) : (parseFloat(unitPrice) || 0);
  const numCostPrice = (costPrice !== undefined && costPrice !== null && costPrice !== '') ? Math.max(0, parseFloat(costPrice) || 0) : null;
  const numMinStock = typeof minStock === 'number' ? Math.max(0, Math.floor(minStock)) : (parseInt(minStock, 10) || 5);

  if (isDemoProduct({ name: trimmedName, sku: productSku })) {
    return res.status(400).json({ error: 'Validation Error', message: 'Cannot create demo or reserved product names.' });
  }

  if (user.isDemo) {
    const mockCreated = {
      id: `demo-product-${Date.now()}`,
      name: trimmedName,
      sku: productSku,
      category: chosenCategory,
      unit_price: numUnitPrice,
      cost_price: numCostPrice,
      min_stock_threshold: numMinStock,
      is_active: isActive ?? true,
      created_at: new Date().toISOString()
    };
    return res.status(201).json({ success: true, product: mockCreated });
  }

  try {
    // 1. Check duplicate product name (case-insensitive) within this business
    const { data: existingByName, error: nameErr } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('business_id', user.businessId)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (nameErr) throw nameErr;

    if (existingByName) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A product with the name "${trimmedName}" already exists in your catalog.`
      });
    }

    // 2. Check duplicate product SKU (case-insensitive) within this business
    const { data: existingBySku, error: skuErr } = await supabaseAdmin
      .from('products')
      .select('id, sku')
      .eq('business_id', user.businessId)
      .ilike('sku', productSku)
      .maybeSingle();

    if (skuErr) throw skuErr;

    if (existingBySku) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A product with SKU "${productSku}" already exists in your catalog.`
      });
    }

    // 3. Insert product
    const { data: newProduct, error: insertErr } = await supabaseAdmin
      .from('products')
      .insert({
        business_id: user.businessId,
        name: trimmedName,
        sku: productSku,
        category: chosenCategory,
        unit_price: numUnitPrice,
        cost_price: numCostPrice,
        min_stock_threshold: numMinStock,
        is_active: isActive !== undefined ? Boolean(isActive) : true
      })
      .select('id, name, sku, category, min_stock_threshold, unit_price, cost_price, is_active, created_at, updated_at')
      .single();

    if (insertErr) throw insertErr;

    logSecurityEvent({
      action: 'CREATE_PRODUCT',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 201,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'product',
      details: { productId: newProduct.id, name: newProduct.name, sku: newProduct.sku }
    });

    await cacheService.invalidate(`products:${user.businessId}`);

    return res.status(201).json({
      success: true,
      message: `Product "${newProduct.name}" created successfully.`,
      product: newProduct
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to create product.'
    });
  }
});

/**
 * PUT /api/products/:id
 * Updates product details, pricing, threshold, or toggles active state with duplicate validation.
 */
productsRouter.put('/:id', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const productId = req.params.id;
  const { name, sku, category, unitPrice, costPrice, minStock, isActive } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product ID is required.' });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product name is required.' });
  }

  const trimmedName = name.trim();
  const productSku = (typeof sku === 'string' && sku.trim()) ? sku.trim().toUpperCase() : '';

  if (!productSku) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product SKU is required.' });
  }

  if (isDemoProduct({ id: productId, name: trimmedName, sku: productSku })) {
    return res.status(403).json({ error: 'Forbidden', message: 'Demo product cannot be mutated.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo product updated.',
      product: {
        id: productId,
        name: trimmedName,
        sku: productSku,
        category: category || 'Other Accessories',
        unit_price: parseFloat(unitPrice) || 0,
        cost_price: costPrice ? parseFloat(costPrice) : null,
        min_stock_threshold: parseInt(minStock, 10) || 5,
        is_active: isActive ?? true
      }
    });
  }

  try {
    // 1. Verify existence and ownership
    const { data: existingProduct, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, business_id')
      .eq('id', productId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingProduct) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
    }

    if (existingProduct.business_id !== user.businessId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to manage this product.' });
    }

    // 2. Validate duplicate name against other products
    const { data: dupName, error: nameErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('business_id', user.businessId)
      .ilike('name', trimmedName)
      .neq('id', productId)
      .maybeSingle();

    if (nameErr) throw nameErr;

    if (dupName) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Another product with the name "${trimmedName}" already exists in your catalog.`
      });
    }

    // 3. Validate duplicate SKU against other products
    const { data: dupSku, error: skuErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('business_id', user.businessId)
      .ilike('sku', productSku)
      .neq('id', productId)
      .maybeSingle();

    if (skuErr) throw skuErr;

    if (dupSku) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Another product with SKU "${productSku}" already exists in your catalog.`
      });
    }

    // 4. Perform update
    const updatePayload: Record<string, any> = {
      name: trimmedName,
      sku: productSku,
      updated_at: new Date().toISOString()
    };

    if (category) updatePayload.category = category.trim();
    if (unitPrice !== undefined) updatePayload.unit_price = Math.max(0, parseFloat(unitPrice) || 0);
    if (costPrice !== undefined) {
      updatePayload.cost_price = (costPrice !== null && costPrice !== '') ? Math.max(0, parseFloat(costPrice) || 0) : null;
    }
    if (minStock !== undefined) updatePayload.min_stock_threshold = Math.max(0, parseInt(minStock, 10) || 0);
    if (isActive !== undefined) updatePayload.is_active = Boolean(isActive);

    const { data: updatedProduct, error: updateErr } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .select('id, name, sku, category, min_stock_threshold, unit_price, cost_price, is_active, created_at, updated_at')
      .single();

    if (updateErr) throw updateErr;

    logSecurityEvent({
      action: 'UPDATE_PRODUCT',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'product',
      details: { productId, name: updatedProduct.name, isActive: updatedProduct.is_active }
    });

    await cacheService.invalidate(`products:${user.businessId}`);

    return res.status(200).json({
      success: true,
      message: `Product "${updatedProduct.name}" updated successfully.`,
      product: updatedProduct
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to update product.'
    });
  }
});

/**
 * GET /api/products/:id/history
 * Returns product-wise delivery and sales distribution history.
 */
productsRouter.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product ID is required.' });
  }

  if (user.isDemo) {
    return res.status(200).json({
      history: {
        productId,
        totalDeliveries: 0,
        totalDeliveredUnits: 0,
        totalRevenue: 0,
        activeShopsCount: 0,
        deliveries: []
      }
    });
  }

  try {
    // 1. Verify existence and ownership
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, business_id')
      .eq('id', productId)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!product || product.business_id !== user.businessId) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found.' });
    }

    // 2. Query delivery items for this product
    const { data: deliveryItems, error: itemsErr } = await supabaseAdmin
      .from('delivery_items')
      .select(`
        id,
        quantity,
        unit_price,
        total_price,
        deliveries!inner (
          id,
          delivery_date,
          status,
          business_id,
          shops!inner (
            id,
            name,
            code
          )
        )
      `)
      .eq('product_id', productId)
      .eq('deliveries.business_id', user.businessId);

    if (itemsErr) throw itemsErr;

    let totalDeliveredUnits = 0;
    let totalRevenue = 0;
    const distinctShops = new Set<string>();

    const formattedHistory = (deliveryItems || []).map((item: any) => {
      const del = item.deliveries;
      const sh = del?.shops;
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unit_price) || 0;
      const total = Number(item.total_price) || (qty * rate);

      totalDeliveredUnits += qty;
      totalRevenue += total;
      if (sh?.id) distinctShops.add(sh.id);

      return {
        id: item.id,
        deliveryId: del?.id,
        deliveryDate: del?.delivery_date,
        status: del?.status,
        shopId: sh?.id,
        shopName: sh?.name || 'Retail Shop',
        shopCode: sh?.code || '',
        quantity: qty,
        unitPrice: rate,
        totalPrice: total
      };
    }).sort((a: any, b: any) => (b.deliveryDate || '').localeCompare(a.deliveryDate || ''));

    return res.status(200).json({
      history: {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        totalDeliveries: formattedHistory.length,
        totalDeliveredUnits,
        totalRevenue,
        activeShopsCount: distinctShops.size,
        deliveries: formattedHistory
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve product history.'
    });
  }
});

/**
 * GET /api/products/:id/usage
 * Checks if a product is referenced in any delivery line items, inventory, or audit movements.
 * Strictly verifies existence and business ownership to prevent cross-tenant enumeration.
 */
productsRouter.get('/:id/usage', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const productId = req.params.id;

  if (!productId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Product ID is required.' });
  }

  if (isDemoProduct({ id: productId })) {
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
        deliveryItems: 0,
        stockMovements: 0,
        dailyReportItems: 0
      }
    });
  }

  try {
    // 1. Verify existence and cross-tenant ownership
    const { data: existingProduct, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, business_id')
      .eq('id', productId)
      .maybeSingle();

    if (prodErr) throw prodErr;

    // Cross-tenant IDOR protection: if product exists but belongs to another business, reject with 403
    if (existingProduct && existingProduct.business_id !== user.businessId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to check usage for this product.'
      });
    }

    if (!existingProduct) {
      return res.status(200).json({
        inUse: false,
        count: 0,
        details: {
          deliveryItems: 0,
          stockMovements: 0,
          dailyReportItems: 0
        }
      });
    }

    const [itemRes, moveRes, reportItemRes, countRes, transRes, adjRes] = await Promise.all([
      supabaseAdmin.from('delivery_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('business_id', user.businessId),
      supabaseAdmin.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
      supabaseAdmin.from('stock_counts').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('business_id', user.businessId),
      supabaseAdmin.from('stock_transfers').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('business_id', user.businessId),
      supabaseAdmin.from('stock_adjustments').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('business_id', user.businessId)
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

    if (isDemoProduct(existingProduct)) {
      logSecurityEvent({
        action: 'DEMO_PRODUCT_MUTATION_BLOCKED',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId: (req.headers['x-correlation-id'] as string),
        resourceType: 'product',
        details: { reason: 'demo_product_retained' }
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Confirmed demo product cannot be mutated or deleted. It is retained to preserve immutable audit history.'
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
        category: 'record_mutation',
        status: 'SUCCESS',
        statusCode: 200,
        correlationId: (req.headers['x-correlation-id'] as string),
        resourceType: 'product',
        details: { reason: 'referenced_by_historical_records', isActive: false }
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
    const { data: deletedRows, error: delErr } = await supabaseAdmin.from('products').delete().eq('id', productId).select('id, name');
    if (delErr) throw delErr;
    if (!deletedRows || deletedRows.length === 0) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Database rejected product deletion. No records were modified in Supabase.'
      });
    }

    logSecurityEvent({
      action: 'DELETE_PRODUCT',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'product'
    });

    await cacheService.invalidate(`products:${user.businessId}`);

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

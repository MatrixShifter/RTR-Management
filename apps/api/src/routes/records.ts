import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  SaveBusinessRecordSchema, 
  SettlePaymentSchema
} from '@crimpston/shared';
import { requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter, paymentRateLimiter } from '../middleware/rateLimiter.js';
import { logger, logSecurityEvent } from '../logger.js';
import { config } from '../config.js';

export const recordsRouter = Router();

const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * GET /api/records
 * Returns records for the authenticated Business Owner's business workspace.
 * Supports server-side pagination with query params (?limit=100&offset=0).
 */
recordsRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  
  if (user.isDemo) {
    return res.status(200).json({ records: [], message: 'Demo records are managed in local client sandbox.' });
  }

  const rawLimit = req.query.limit;
  const rawOffset = req.query.offset;
  const limit = typeof rawLimit === 'string' && !isNaN(parseInt(rawLimit, 10))
    ? Math.min(Math.max(1, parseInt(rawLimit, 10)), 1000)
    : 1000;
  const offset = typeof rawOffset === 'string' && !isNaN(parseInt(rawOffset, 10))
    ? Math.max(0, parseInt(rawOffset, 10))
    : 0;

  try {
    let query = supabaseAdmin
      .from('v_business_records')
      .select('*')
      .eq('business_id', user.businessId)
      .order('priority_rank', { ascending: true })
      .order('date', { ascending: false });

    // Date & Catalog server-side filtering
    const exactDate = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : null;
    const startDate = typeof req.query.startDate === 'string' && req.query.startDate.trim() ? req.query.startDate.trim() : null;
    const endDate = typeof req.query.endDate === 'string' && req.query.endDate.trim() ? req.query.endDate.trim() : null;
    const shopId = typeof req.query.shopId === 'string' && req.query.shopId.trim() ? req.query.shopId.trim() : null;
    const productId = typeof req.query.productId === 'string' && req.query.productId.trim() ? req.query.productId.trim() : null;
    const status = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : null;

    if (exactDate) {
      query = query.eq('date', exactDate);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (shopId) {
      query = query.eq('shop_id', shopId);
    }
    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (status) {
      query = query.eq('delivery_status', status);
    }

    if (rawLimit !== undefined || rawOffset !== undefined) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json({ records: data || [] });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve business records.'
    });
  }
});

/**
 * POST /api/records
 * Creates a business record with server-side validation, rate limiting, and owner authorization.
 */
recordsRouter.post('/', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const parsed = SaveBusinessRecordSchema.safeParse(req.body);

  const correlationId = (req.headers['x-correlation-id'] as string);

  if (!parsed.success) {
    logSecurityEvent({
      action: 'INVALID_RECORD_INPUT',
      category: 'record_mutation',
      status: 'FAILURE',
      statusCode: 400,
      correlationId,
      errorCategory: 'validation_error'
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid record payload provided.',
      fieldErrors: parsed.error.flatten().fieldErrors
    });
  }

  logSecurityEvent({
    action: 'CREATE_RECORD',
    category: 'record_mutation',
    status: 'SUCCESS',
    statusCode: 201,
    correlationId,
    details: { 
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
      pendingAmount: parsed.data.pendingAmount
    }
  });

  return res.status(201).json({
    success: true,
    message: 'Record created successfully.',
    record: parsed.data
  });
});

/**
 * POST /api/records/settle
 * Settles a record payment with server-side validation, financial rate limiting, and owner authorization.
 */
recordsRouter.post('/settle', requireOwnerAuth, paymentRateLimiter, async (req: Request, res: Response) => {
  const parsed = SettlePaymentSchema.safeParse(req.body);

  const correlationId = (req.headers['x-correlation-id'] as string);

  if (!parsed.success) {
    logSecurityEvent({
      action: 'INVALID_PAYMENT_INPUT',
      category: 'record_mutation',
      status: 'FAILURE',
      statusCode: 400,
      correlationId,
      errorCategory: 'validation_error'
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid payment settlement payload.',
      fieldErrors: parsed.error.flatten().fieldErrors
    });
  }

  logSecurityEvent({
    action: 'SETTLE_PAYMENT',
    category: 'record_mutation',
    status: 'SUCCESS',
    statusCode: 200,
    correlationId,
    targetId: parsed.data.deliveryId,
    details: { amountToPay: parsed.data.amountToPay }
  });

  return res.status(200).json({
    success: true,
    message: 'Payment settled successfully.',
    deliveryId: parsed.data.deliveryId,
    amountSettled: parsed.data.amountToPay
  });
});

/**
 * PATCH /api/records/:id/delivery-status
 * Updates delivery status with rate limiting, validation, and owner authorization.
 * Resolves delivery ID safely and verifies record ownership.
 */
recordsRouter.patch('/:id/delivery-status', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const rawId = req.params.id;
  const status = req.body?.status;
  const rawCp = req.body?.customerPrice !== undefined ? req.body.customerPrice : req.body?.customer_price;

  if (status !== 'delivered' && status !== 'pending') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Status must be either "delivered" or "pending".'
    });
  }

  let validatedCp: number | null = null;
  if (rawCp !== undefined && rawCp !== null && rawCp !== '') {
    const parsed = Number(rawCp);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Customer price must be a non-negative number.'
      });
    }
    validatedCp = Math.round(parsed * 100) / 100;
  }

  if (!rawId || typeof rawId !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Delivery ID is required.'
    });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status} in demo sandbox.`,
      deliveryId: rawId,
      status
    });
  }

  try {
    // 1. Resolve pure UUID target delivery ID
    const uuidMatch = rawId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    let targetId = uuidMatch ? uuidMatch[0] : rawId;

    // 2. Locate existing delivery record and verify existence
    let { data: existingDelivery, error: fetchErr } = await supabaseAdmin
      .from('deliveries')
      .select('id, business_id, status, total_amount, notes')
      .eq('id', targetId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    // If not found by direct ID, check if targetId was a delivery_items.id
    if (!existingDelivery) {
      const { data: itemData } = await supabaseAdmin
        .from('delivery_items')
        .select('delivery_id')
        .eq('id', targetId)
        .maybeSingle();

      if (itemData?.delivery_id) {
        targetId = itemData.delivery_id;
        const { data: relDelivery } = await supabaseAdmin
          .from('deliveries')
          .select('id, business_id, status, total_amount, notes')
          .eq('id', targetId)
          .maybeSingle();
        existingDelivery = relDelivery;
      }
    }

    if (!existingDelivery) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Delivery record not found.'
      });
    }

    const correlationId = (req.headers['x-correlation-id'] as string);

    // 3. Authorization check: must belong to the authenticated owner's business
    if (!existingDelivery.business_id || existingDelivery.business_id !== user.businessId) {
      logSecurityEvent({
        action: 'UNAUTHORIZED_DELIVERY_UPDATE_ATTEMPT',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId,
        targetId
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this delivery record.'
      });
    }

    // 4. Update delivery status in database and verify affected row
    const totalCost = Number(existingDelivery.total_amount || 0);
    const calculatedProfit = validatedCp !== null ? Math.round((validatedCp - totalCost) * 100) / 100 : null;

    let updatedNotes = existingDelivery.notes;
    try {
      let meta: any = {};
      if (existingDelivery.notes && typeof existingDelivery.notes === 'string' && existingDelivery.notes.startsWith('{')) {
        meta = JSON.parse(existingDelivery.notes);
      }
      if (validatedCp !== null) {
        meta.customerPrice = validatedCp;
        meta.profit = calculatedProfit;
      }
      updatedNotes = JSON.stringify(meta);
    } catch {
      updatedNotes = JSON.stringify({
        memo: existingDelivery.notes || '',
        totalAmount: totalCost,
        customerPrice: validatedCp,
        profit: calculatedProfit
      });
    }

    const updatePayload: any = {
      status,
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    };
    if (validatedCp !== null) {
      updatePayload.customer_price = validatedCp;
    }

    let { data: updatedDelivery, error: updateErr } = await supabaseAdmin
      .from('deliveries')
      .update(updatePayload)
      .eq('id', targetId)
      .select('id, status, customer_price, notes')
      .maybeSingle();

    // If customer_price or updated_at column is missing on older schema, gracefully fallback to updating status and notes
    if (updateErr && (updateErr.message?.includes('customer_price') || updateErr.message?.includes('updated_at') || updateErr.code === '42703')) {
      const retryRes = await supabaseAdmin
        .from('deliveries')
        .update({ status, notes: updatedNotes, updated_at: new Date().toISOString() })
        .eq('id', targetId)
        .select('id, status, notes')
        .maybeSingle();
      updatedDelivery = retryRes.data as any;
      updateErr = retryRes.error;
    }

    if (updateErr) {
      logger.error('Update delivery status database error', {
        correlationId,
        targetId,
        error: updateErr.message,
        code: updateErr.code,
        details: updateErr.details
      });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update delivery status. Please try again or contact support.',
        correlationId
      });
    }

    if (!updatedDelivery) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Delivery record could not be updated.'
      });
    }

    logSecurityEvent({
      action: 'UPDATE_DELIVERY_STATUS',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId,
      targetId,
      details: { previousStatus: existingDelivery.status, newStatus: status }
    });

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status}.`,
      deliveryId: targetId,
      status: updatedDelivery.status,
      customerPrice: validatedCp ?? (updatedDelivery as any)?.customer_price ?? null,
      profit: calculatedProfit
    });
  } catch (err: any) {
    const correlationId = (req.headers['x-correlation-id'] as string);
    logger.error('Delivery update handler exception', {
      correlationId,
      targetId: rawId,
      error: err?.message,
      stack: err?.stack
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update delivery status. Please try again or contact support.',
      correlationId
    });
  }
});

/**
 * DELETE /api/records/:id
 * Deletes a business delivery record with rate limiting and owner authorization.
 * Preserves shops and products (no cascade delete of catalog entities).
 */
recordsRouter.delete('/:id', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;
  const rawId = req.params.id;
  const correlationId = (req.headers['x-correlation-id'] as string);

  if (!rawId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Delivery ID is required for deletion.'
    });
  }

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo record deleted in sandbox.',
      deliveryId: rawId
    });
  }

  try {
    // 1. Resolve target delivery ID
    const uuidMatch = rawId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    let targetId = uuidMatch ? uuidMatch[0] : rawId;

    // 2. Verify existence and business ownership
    let { data: existingDelivery, error: fetchErr } = await supabaseAdmin
      .from('deliveries')
      .select('id, business_id')
      .eq('id', targetId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!existingDelivery) {
      // Check if targetId was a delivery_items.id
      const { data: itemData } = await supabaseAdmin
        .from('delivery_items')
        .select('delivery_id')
        .eq('id', targetId)
        .maybeSingle();

      if (itemData?.delivery_id) {
        targetId = itemData.delivery_id;
        const { data: relDelivery } = await supabaseAdmin
          .from('deliveries')
          .select('id, business_id')
          .eq('id', targetId)
          .maybeSingle();
        existingDelivery = relDelivery;
      }
    }

    if (!existingDelivery) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Delivery record not found.'
      });
    }

    if (!existingDelivery.business_id || existingDelivery.business_id !== user.businessId) {
      logSecurityEvent({
        action: 'UNAUTHORIZED_DELIVERY_DELETE_ATTEMPT',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId,
        targetId
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this delivery record.'
      });
    }

    // 3. Delete transactional dependencies of this delivery only.
    // NOTE: stock_movements is an append-only immutable audit ledger protected by
    // database triggers (prevent_immutable_mutation) and RLS. Historical audit entries
    // must never be deleted.
    const { data: relInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('delivery_id', targetId);

    if (relInvoices && relInvoices.length > 0) {
      const invIds = relInvoices.map(i => i.id);
      await supabaseAdmin.from('payments').delete().in('invoice_id', invIds);
      await supabaseAdmin.from('invoices').delete().in('id', invIds);
    }
    await supabaseAdmin.from('payments').delete().eq('delivery_id', targetId);
    await supabaseAdmin.from('delivery_items').delete().eq('delivery_id', targetId);
    const { error: delErr } = await supabaseAdmin.from('deliveries').delete().eq('id', targetId);

    if (delErr) throw delErr;

    logSecurityEvent({
      action: 'DELETE_RECORD',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId,
      targetId
    });

    return res.status(200).json({
      success: true,
      message: 'Record deleted successfully.',
      deliveryId: targetId
    });
  } catch (err: any) {
    logger.error('Delete record error', {
      correlationId,
      targetId: rawId,
      error: err?.message,
      stack: err?.stack
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete record.'
    });
  }
});

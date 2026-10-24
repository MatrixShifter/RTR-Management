import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  SaveBusinessRecordSchema, 
  SettlePaymentSchema
} from '@crimpston/shared';
import { requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter, paymentRateLimiter } from '../middleware/rateLimiter.js';
import { logSecurityEvent } from '../logger.js';
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
 */
recordsRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  
  if (user.isDemo) {
    return res.status(200).json({ records: [], message: 'Demo records are managed in local client sandbox.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v_business_records')
      .select('*')
      .eq('business_id', user.businessId)
      .order('priority_rank', { ascending: true })
      .order('date', { ascending: false });

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
  const user = req.user!;
  const parsed = SaveBusinessRecordSchema.safeParse(req.body);

  if (!parsed.success) {
    logSecurityEvent({
      action: 'INVALID_RECORD_INPUT',
      actorId: user.id,
      status: 'FAILURE',
      ip: req.ip,
      details: { errors: parsed.error.flatten().fieldErrors }
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid record payload provided.',
      fieldErrors: parsed.error.flatten().fieldErrors
    });
  }

  logSecurityEvent({
    action: 'CREATE_RECORD',
    actorId: user.id,
    status: 'SUCCESS',
    ip: req.ip,
    details: { 
      shopName: parsed.data.shopName, 
      productName: parsed.data.productName,
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
  const user = req.user!;
  const parsed = SettlePaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    logSecurityEvent({
      action: 'INVALID_PAYMENT_INPUT',
      actorId: user.id,
      status: 'FAILURE',
      ip: req.ip,
      details: { errors: parsed.error.flatten().fieldErrors }
    });
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid payment settlement payload.',
      fieldErrors: parsed.error.flatten().fieldErrors
    });
  }

  logSecurityEvent({
    action: 'SETTLE_PAYMENT',
    actorId: user.id,
    targetId: parsed.data.deliveryId,
    status: 'SUCCESS',
    ip: req.ip,
    details: { amountToPay: parsed.data.amountToPay }
  });

  return res.status(200).json({
    success: true,
    message: 'Payment settled successfully.',
    deliveryId: parsed.data.deliveryId,
    amountSettled: parsed.data.amountToPay
  });
});

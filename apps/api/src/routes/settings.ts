import { Router, Request, Response } from 'express';
import { requireOwnerAuth } from '../middleware/auth.js';
import { businessMutationRateLimiter } from '../middleware/rateLimiter.js';
import { supabaseAdmin } from '../supabase.js';
import { UpdateBusinessSettingsSchema } from '@crimpston/shared';
import { logSecurityEvent } from '../logger.js';

export const settingsRouter = Router();

/**
 * GET /api/settings
 * Retrieves authoritative business profile and operational settings.
 * Strictly restricted to Business Owners; returns 403 Forbidden for employees.
 */
settingsRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(200).json({
      success: true,
      data: {
        id: user.businessId,
        name: 'RTR Wholesale Management (Demo Sandbox)',
        timezone: 'Asia/Kolkata',
        reportCutoffTime: '21:00',
        isActive: true,
        isDemo: true,
        created_at: new Date().toISOString()
      }
    });
  }

  try {
    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('id, name, timezone, report_cutoff_time, is_active, created_at, updated_at')
      .eq('id', user.businessId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Business profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        timezone: business.timezone,
        reportCutoffTime: business.report_cutoff_time ? String(business.report_cutoff_time).substring(0, 5) : '21:00',
        isActive: business.is_active,
        createdAt: business.created_at,
        updatedAt: business.updated_at
      }
    });
  } catch (err: any) {
    logSecurityEvent({
      action: 'SETTINGS_FETCH_ERROR',
      category: 'access_control',
      status: 'FAILURE',
      statusCode: 500,
      correlationId: (req.headers['x-correlation-id'] as string),
      details: { error: err?.message || 'Database query failure' }
    });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve business settings.'
    });
  }
});

/**
 * PATCH /api/settings
 * Updates business profile and operational configurations.
 * Strictly restricted to Business Owners; demo mutation blocked.
 */
settingsRouter.patch('/', requireOwnerAuth, businessMutationRateLimiter, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Demo sessions cannot modify production business settings.'
    });
  }

  const parsed = UpdateBusinessSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid settings update payload.',
      details: parsed.error.issues
    });
  }

  const { name, timezone, reportCutoffTime } = parsed.data;
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (name !== undefined) updates.name = name.trim();
  if (timezone !== undefined) updates.timezone = timezone.trim();
  if (reportCutoffTime !== undefined) {
    // Ensure seconds format (HH:MM:SS) for SQL TIME type
    updates.report_cutoff_time = reportCutoffTime.length === 5 ? `${reportCutoffTime}:00` : reportCutoffTime;
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('businesses')
      .update(updates)
      .eq('id', user.businessId)
      .select('id, name, timezone, report_cutoff_time, is_active, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    logSecurityEvent({
      action: 'BUSINESS_SETTINGS_UPDATED',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      details: { businessId: user.businessId, updatedFields: Object.keys(updates) }
    });

    return res.status(200).json({
      success: true,
      message: 'Business settings updated successfully.',
      data: {
        id: updated.id,
        name: updated.name,
        timezone: updated.timezone,
        reportCutoffTime: updated.report_cutoff_time ? String(updated.report_cutoff_time).substring(0, 5) : '21:00',
        isActive: updated.is_active,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (err: any) {
    logSecurityEvent({
      action: 'SETTINGS_UPDATE_ERROR',
      category: 'record_mutation',
      status: 'FAILURE',
      statusCode: 500,
      correlationId: (req.headers['x-correlation-id'] as string),
      details: { error: err?.message || 'Database update failure' }
    });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update business settings.'
    });
  }
});

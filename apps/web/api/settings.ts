import { 
  supabaseAdmin, 
  supabaseServiceRoleKey,
  createScopedUserClient,
  configuredOwnerEmail 
} from './_supabase.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.'
    });
  }

  const token = authHeader.split(' ')[1];

  // 1. Demo account handling
  if (token && (token.startsWith('demo-session-') || token.startsWith('demo-access-token-') || token.startsWith('demo-'))) {
    if (req.method === 'PATCH') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Demo sessions cannot modify production business settings.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: 'demo-business-00000000-0000-0000-0000-000000000000',
        name: 'RTR Wholesale Management (Demo Sandbox)',
        timezone: 'Asia/Kolkata',
        reportCutoffTime: '21:00',
        isActive: true,
        isDemo: true,
        created_at: new Date().toISOString()
      }
    });
  }

  // 2. Real user session verification
  try {
    const callerClient = createScopedUserClient(token);
    const { data: { user }, error: authErr } = await callerClient.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.'
      });
    }

    // Role verification against business_memberships
    const verificationClient = supabaseServiceRoleKey ? supabaseAdmin : callerClient;
    let { data: membership, error: memErr } = await verificationClient
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    // Auto-link authoritative owner to tenant business if membership record is missing or error
    if ((!membership || memErr) && user.email?.toLowerCase() === configuredOwnerEmail) {
      const { data: biz } = await verificationClient
        .from('businesses')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (biz) {
        membership = {
          business_id: biz.id,
          role: 'owner',
          is_active: true
        };
        memErr = null;
      }
    }

    if (memErr || !membership || !membership.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated or unauthorized.'
      });
    }

    if (membership.role !== 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Business Owner privileges required.'
      });
    }

    if (req.method === 'GET') {
      const { data: business, error: bizErr } = await verificationClient
        .from('businesses')
        .select('id, name, timezone, report_cutoff_time, is_active, created_at, updated_at')
        .eq('id', membership.business_id)
        .maybeSingle();

      if (bizErr || !business) {
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
    }

    if (req.method === 'PATCH') {
      const { name, timezone, reportCutoffTime } = req.body || {};
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (name && typeof name === 'string') updates.name = name.trim();
      if (timezone && typeof timezone === 'string') updates.timezone = timezone.trim();
      if (reportCutoffTime && typeof reportCutoffTime === 'string') {
        updates.report_cutoff_time = reportCutoffTime.length === 5 ? `${reportCutoffTime}:00` : reportCutoffTime;
      }

      const { data: updated, error: updateErr } = await verificationClient
        .from('businesses')
        .update(updates)
        .eq('id', membership.business_id)
        .select('id, name, timezone, report_cutoff_time, is_active, created_at, updated_at')
        .single();

      if (updateErr) {
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to update business settings.'
        });
      }

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
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err?.message || 'Authentication or database query failed.'
    });
  }
}

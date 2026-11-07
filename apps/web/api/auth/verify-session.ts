import { 
  supabaseAnon, 
  supabaseAdmin, 
  supabaseServiceRoleKey,
  supabaseUrl, 
  supabaseAnonKey, 
  configuredOwnerEmail 
} from '../_supabase.js';
import { createClient } from '@supabase/supabase-js';
import { DEMO_USERNAME } from '@crimpston/shared';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  // 1. Handle Demo Token
  if (token.startsWith('demo-access-token-') || token.startsWith('demo-employee-token-')) {
    const isEmployee = token.startsWith('demo-employee-token-');
    if (isEmployee) {
      return res.status(200).json({
        user: {
          id: 'demo-employee-00000000-0000-0000-0000-000000000001',
          email: 'demo-employee@rtrmobiles.com',
          username: 'demo-employee',
          name: 'Demo Employee (Sandbox)',
          role: 'employee',
          isDemo: true,
          assignedShopId: 'demo-shop-00000000-0000-0000-0000-000000000001',
          assignedShopName: 'Demo Retail Outlet',
          assignedShopCode: 'SH-DEMO'
        }
      });
    }

    return res.status(200).json({
      user: {
        id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
        email: 'demo-owner@rtrmobiles.com',
        username: DEMO_USERNAME,
        name: 'Demo Owner (Sandbox)',
        role: 'demo',
        isDemo: true
      }
    });
  }

  // 2. Authoritative Supabase Token Verification
  try {
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const clientForRole = supabaseServiceRoleKey ? supabaseAdmin : userClient;

    let { data: membership } = await clientForRole
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    // Auto-link authoritative owner to tenant business if membership record is missing
    if (!membership && user.email?.toLowerCase() === configuredOwnerEmail) {
      const adminClient = supabaseServiceRoleKey ? supabaseAdmin : userClient;
      const { data: biz } = await adminClient
        .from('businesses')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (biz) {
        await adminClient
          .from('business_memberships')
          .upsert({
            business_id: biz.id,
            user_id: user.id,
            role: 'owner',
            is_active: true
          }, { onConflict: 'business_id,user_id' });

        membership = {
          business_id: biz.id,
          role: 'owner',
          is_active: true
        };
      }
    }

    if (!membership || !membership.is_active) {
      return res.status(403).json({ error: 'Account is deactivated or unauthorized.' });
    }

    if (membership.role === 'owner') {
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || 'Business Owner',
          role: 'owner',
          isDemo: false
        }
      });
    }

    if (membership.role === 'employee') {
      const { data: shopMember, error: shopErr } = await clientForRole
        .from('shop_memberships')
        .select('shop_id, shops!inner(id, name, code, is_active, business_id)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        shopErr || 
        !shopMember || 
        !(shopMember as any).shops?.is_active ||
        (shopMember as any).shops?.business_id !== membership.business_id
      ) {
        return res.status(403).json({ error: 'Your employee account is not currently assigned to an active shop.' });
      }

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || 'Shop Staff',
          role: 'employee',
          isDemo: false,
          assignedShopId: shopMember.shop_id,
          assignedShopName: (shopMember as any).shops?.name,
          assignedShopCode: (shopMember as any).shops?.code
        }
      });
    }

    return res.status(403).json({ error: 'Access restricted: unauthorized account role.' });
  } catch {
    return res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
}

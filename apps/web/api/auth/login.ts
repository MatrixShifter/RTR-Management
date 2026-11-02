import { 
  supabaseAnon, 
  supabaseAdmin, 
  resolveIdentifierToEmail,
  configuredOwnerEmail 
} from '../_supabase.js';
import { DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER } from '@crimpston/shared';

const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body || {};
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!cleanUsername || !cleanPassword) {
    return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
  }

  // 1. Isolated Demo Sandbox check
  const configuredDemoPass = process.env.DEMO_PASSWORD || DEMO_PASSWORD_PLACEHOLDER;
  if (cleanUsername.toLowerCase() === DEMO_USERNAME.toLowerCase() || cleanUsername.toLowerCase() === 'demo-owner@rtrmobiles.com') {
    if (cleanPassword === configuredDemoPass || cleanPassword === DEMO_PASSWORD_PLACEHOLDER) {
      return res.status(200).json({
        user: {
          id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
          email: 'demo-owner@rtrmobiles.com',
          username: DEMO_USERNAME,
          name: 'Demo Owner (Sandbox)',
          role: 'demo',
          isDemo: true
        },
        session: {
          access_token: 'demo-access-token-' + Date.now(),
          refresh_token: 'demo-refresh-token-' + Date.now(),
          expires_at: Math.floor(Date.now() / 1000) + 86400
        }
      });
    }
    return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
  }

  if (cleanUsername.toLowerCase() === 'demo-employee@rtrmobiles.com' || cleanUsername.toLowerCase() === 'employee@demo.com') {
    if (cleanPassword === 'password123' || cleanPassword === 'demo1234' || cleanPassword === 'demo-password' || cleanPassword === DEMO_PASSWORD_PLACEHOLDER) {
      return res.status(200).json({
        user: {
          id: 'demo-employee-00000000-0000-0000-0000-000000000001',
          email: cleanUsername.toLowerCase(),
          username: 'demo-employee',
          name: 'Demo Employee (Sandbox)',
          role: 'employee',
          isDemo: true,
          assignedShopId: 'demo-shop-00000000-0000-0000-0000-000000000001',
          assignedShopName: 'Demo Retail Outlet',
          assignedShopCode: 'SH-DEMO'
        },
        session: {
          access_token: 'demo-employee-token-' + Date.now(),
          refresh_token: 'demo-employee-refresh-' + Date.now(),
          expires_at: Math.floor(Date.now() / 1000) + 86400
        }
      });
    }
    return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
  }

  // 2. Resolve Identifier to Email
  const email = resolveIdentifierToEmail(cleanUsername) || (cleanUsername.includes('@') ? cleanUsername : null);
  if (!email) {
    return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
  }

  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password: cleanPassword
    });

    if (authError || !authData.user || !authData.session) {
      if (authError?.status === 429 || authError?.message?.toLowerCase().includes('rate limit')) {
        return res.status(429).json({ error: 'Too many login attempts. Please wait a moment and try again.' });
      }
      return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
    }

    // Verify User Role & Active Status via business_memberships
    const clientForRole = supabaseAdmin || supabaseAnon;
    let { data: membership, error: memErr } = await clientForRole
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    // Auto-link authoritative owner to tenant business if membership record is missing
    if ((!membership || memErr) && email.toLowerCase() === configuredOwnerEmail) {
      const adminClient = supabaseAdmin || supabaseAnon;
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
            user_id: authData.user.id,
            role: 'owner',
            is_active: true
          }, { onConflict: 'business_id,user_id' });

        membership = {
          business_id: biz.id,
          role: 'owner',
          is_active: true
        };
        memErr = null;
      }
    }

    if (memErr || !membership) {
      await supabaseAnon.auth.signOut().catch(() => {});
      const msg = 'Employee profile is not associated with an active business organization.';
      return res.status(403).json({ error: msg, message: msg });
    }

    if (!membership.is_active) {
      await supabaseAnon.auth.signOut().catch(() => {});
      const msg = 'Account is deactivated or unauthorized. Please contact your manager.';
      return res.status(403).json({ error: msg, message: msg });
    }

    if (membership.role === 'owner') {
      return res.status(200).json({
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
          username: cleanUsername,
          name: authData.user.user_metadata?.full_name || 'Business Owner',
          role: 'owner',
          isDemo: false
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      });
    }

    if (membership.role === 'employee') {
      const { data: shopMember, error: shopErr } = await clientForRole
        .from('shop_memberships')
        .select('shop_id, shops!inner(id, name, code, is_active, business_id)')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (shopErr || !shopMember || !(shopMember as any).shops) {
        await supabaseAnon.auth.signOut().catch(() => {});
        return res.status(403).json({
          error: 'Your employee account is not currently assigned to an active shop. Please contact your manager.'
        });
      }

      if (!(shopMember as any).shops?.is_active) {
        await supabaseAnon.auth.signOut().catch(() => {});
        return res.status(403).json({
          error: 'Your assigned retail shop is currently inactive. Please contact your manager.'
        });
      }

      if ((shopMember as any).shops?.business_id !== membership.business_id) {
        await supabaseAnon.auth.signOut().catch(() => {});
        return res.status(403).json({
          error: 'Store assignment authorization mismatch. Please contact your manager.'
        });
      }

      const { data: profile } = await clientForRole
        .from('profiles')
        .select('full_name, username')
        .eq('id', authData.user.id)
        .maybeSingle();

      return res.status(200).json({
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
          username: cleanUsername.includes('@') ? (profile?.username || authData.user.user_metadata?.username || cleanUsername.split('@')[0]) : cleanUsername,
          name: profile?.full_name || authData.user.user_metadata?.full_name || 'Shop Staff',
          role: 'employee',
          isDemo: false,
          assignedShopId: shopMember.shop_id,
          assignedShopName: (shopMember as any).shops?.name,
          assignedShopCode: (shopMember as any).shops?.code
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      });
    }

    await supabaseAnon.auth.signOut().catch(() => {});
    return res.status(403).json({ error: 'Unknown or unauthorized account role.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
}

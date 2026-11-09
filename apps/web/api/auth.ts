import { 
  supabaseAnon, 
  supabaseAdmin, 
  supabaseServiceRoleKey,
  supabaseUrl,
  supabaseAnonKey,
  createScopedUserClient,
  resolveIdentifierToEmail,
  configuredOwnerEmail 
} from './_supabase.js';
import { createClient } from '@supabase/supabase-js';
import { DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER } from '@crimpston/shared';

const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";
export const RECOVERY_CONFIRMATION_MSG = "If an account matches the information provided, password reset instructions will be sent to its registered email address.";

const ALLOWED_REDIRECT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'rtr-management.vercel.app',
  'rtr-management-cfn4.vercel.app'
]);

function sanitizeRedirectUrl(targetUrl?: string): string {
  const fallback = 'https://rtr-management.vercel.app/reset-password';
  if (!targetUrl) return fallback;

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();

    if (ALLOWED_REDIRECT_HOSTS.has(host) || host.endsWith('.vercel.app')) {
      parsed.pathname = '/reset-password';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    }
  } catch {
    // Malformed URL, use authoritative production fallback
  }

  return fallback;
}

export async function loginHandler(req: any, res: any) {
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
  let email = resolveIdentifierToEmail(cleanUsername) || (cleanUsername.includes('@') ? cleanUsername : null);
  if (!email) {
    try {
      const lookupClient = supabaseServiceRoleKey ? supabaseAdmin : supabaseAnon;
      const { data: profile } = await lookupClient
        .from('profiles')
        .select('email')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (profile?.email) {
        email = profile.email;
      }
    } catch {
      // profiles lookup fallback
    }
  }

  if (!email) {
    return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
  }

  try {
    let { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password: cleanPassword
    });

    if (authError || !authData.user || !authData.session) {
      if (authError?.status === 429 || authError?.message?.toLowerCase().includes('rate limit')) {
        return res.status(429).json({ error: 'Too many login attempts. Please wait a moment and try again.' });
      }
      if (authError && (((authError as any).status >= 500) || (authError as any).name === 'AuthRetryableFetchError')) {
        return res.status(503).json({ error: 'Authentication service temporarily unavailable. Please try again.' });
      }
      if (authError?.message?.toLowerCase().includes('email not confirmed')) {
        return res.status(403).json({ error: 'Please verify your email address before signing in.' });
      }
      return res.status(401).json({ error: INCORRECT_CREDENTIALS_MSG });
    }

    // Verify User Role & Active Status via business_memberships
    const userClient = createScopedUserClient(authData.session.access_token);
    const clientForRole = supabaseServiceRoleKey ? supabaseAdmin : userClient;
    let { data: membership, error: memErr } = await clientForRole
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    // Auto-link authoritative owner to tenant business if membership record is missing
    if ((!membership || memErr) && email.toLowerCase() === configuredOwnerEmail) {
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

export async function verifySessionHandler(req: any, res: any) {
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
      return res.status(403).json({ error: 'User is inactive or not assigned to an active business' });
    }

    if (membership.role === 'owner') {
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0],
          name: user.user_metadata?.full_name || 'Business Owner',
          role: 'owner',
          isDemo: false
        }
      });
    }

    if (membership.role === 'employee') {
      const { data: shopMember } = await clientForRole
        .from('shop_memberships')
        .select('shop_id, shops!inner(id, name, code, is_active, business_id)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!shopMember || !(shopMember as any).shops || !(shopMember as any).shops.is_active) {
        return res.status(403).json({ error: 'Employee is not assigned to an active shop' });
      }

      if ((shopMember as any).shops.business_id !== membership.business_id) {
        return res.status(403).json({ error: 'Store assignment authorization mismatch' });
      }

      const { data: profile } = await clientForRole
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle();

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          username: profile?.username || user.user_metadata?.username || user.email?.split('@')[0],
          name: profile?.full_name || user.user_metadata?.full_name || 'Shop Staff',
          role: 'employee',
          isDemo: false,
          assignedShopId: shopMember.shop_id,
          assignedShopName: (shopMember as any).shops.name,
          assignedShopCode: (shopMember as any).shops.code
        }
      });
    }

    return res.status(403).json({ error: 'Unknown or unauthorized account role' });
  } catch {
    return res.status(500).json({ error: 'Authentication service temporarily unavailable' });
  }
}

export async function forgotPasswordHandler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { identifier, redirectTo } = req.body || {};
  const clean = typeof identifier === 'string' ? identifier.trim() : '';

  if (!clean) {
    return res.status(200).json({ message: RECOVERY_CONFIRMATION_MSG });
  }

  const safeRedirectTo = sanitizeRedirectUrl(redirectTo);
  const email = resolveIdentifierToEmail(clean);

  if (!email || email.includes('demo-owner')) {
    // Return generic success to avoid username enumeration
    return res.status(200).json({ message: RECOVERY_CONFIRMATION_MSG });
  }

  try {
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo: safeRedirectTo
    });

    if (error) {
      if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        return res.status(429).json({ 
          error: 'Email rate limit exceeded. Please wait a minute before requesting another reset link.' 
        });
      }
      // Always return neutral confirmation to prevent leaking whether account exists
      return res.status(200).json({ message: RECOVERY_CONFIRMATION_MSG });
    }

    return res.status(200).json({ message: RECOVERY_CONFIRMATION_MSG });
  } catch {
    return res.status(200).json({ message: RECOVERY_CONFIRMATION_MSG });
  }
}

export async function resetPasswordHandler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing recovery session token.'
    });
  }

  const token = authHeader.split(' ')[1];
  const { password } = req.body || {};

  if (!password || typeof password !== 'string' || password.length < 12) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 12 characters long.'
    });
  }

  try {
    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired recovery session token.'
      });
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password
    });

    if (updateErr) {
      return res.status(500).json({
        success: false,
        message: updateErr.message || 'Failed to update password.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password successfully updated.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Internal server error while updating password.'
    });
  }
}

export default async function handler(req: any, res: any) {
  let action = req.query?.action;
  if (Array.isArray(action)) action = action[0];

  if (!action && req.url) {
    const match = req.url.match(/\/api\/auth\/([a-zA-Z0-9_-]+)/);
    if (match) {
      action = match[1];
    }
  }

  if (action === 'login') {
    return loginHandler(req, res);
  }
  if (action === 'verify-session') {
    return verifySessionHandler(req, res);
  }
  if (action === 'forgot-password') {
    return forgotPasswordHandler(req, res);
  }
  if (action === 'reset-password') {
    return resetPasswordHandler(req, res);
  }

  return res.status(404).json({
    error: 'Not Found',
    message: `Unknown auth action: ${action || 'none'}`
  });
}

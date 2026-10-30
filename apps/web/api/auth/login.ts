import { 
  supabaseAnon, 
  supabaseAdmin, 
  resolveIdentifierToEmail 
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
    if (cleanPassword === configuredDemoPass || cleanPassword === DEMO_PASSWORD_PLACEHOLDER || cleanPassword === 'demo-password-2026') {
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

  // 2. Authoritative Supabase Owner Login
  const email = resolveIdentifierToEmail(cleanUsername);
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

    // Verify Owner Role via business_memberships
    const clientForRole = supabaseAdmin || supabaseAnon;
    const { data: membership } = await clientForRole
      .from('business_memberships')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (membership && membership.role !== 'owner') {
      await supabaseAnon.auth.signOut().catch(() => {});
      return res.status(403).json({ error: 'Access restricted to Business Owner only.' });
    }

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
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
}

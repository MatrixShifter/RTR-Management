import { supabaseAnon, supabaseAdmin } from '../_supabase.js';
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
  if (token.startsWith('demo-access-token-')) {
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

    const clientForRole = supabaseAdmin || supabaseAnon;
    const { data: membership } = await clientForRole
      .from('business_memberships')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership && membership.role !== 'owner') {
      return res.status(403).json({ error: 'Access restricted to Business Owner only.' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || 'Business Owner',
        role: 'owner',
        isDemo: false
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
}

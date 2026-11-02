import { supabaseAnon, supabaseAdmin } from '../_supabase.js';

export const INVALID_OTP_MSG = "Invalid or expired verification code. Please request a new code.";

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, token } = req.body || {};
  if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Both email and verification code are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  // Demo employee sandbox
  if (
    (cleanEmail === 'demo-employee@rtrmobiles.com' || cleanEmail === 'employee@demo.com') &&
    (cleanToken === '123456' || cleanToken === '000000')
  ) {
    return res.status(200).json({
      success: true,
      session: {
        access_token: 'demo-employee-token-' + Date.now(),
        refresh_token: 'demo-employee-refresh-' + Date.now(),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        expires_in: 86400
      },
      user: {
        id: 'demo-employee-00000000-0000-0000-0000-000000000001',
        email: cleanEmail,
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

  try {
    const { data: verifyData, error: verifyError } = await supabaseAnon.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email'
    });

    if (verifyError || !verifyData.session || !verifyData.user) {
      return res.status(401).json({
        success: false,
        message: INVALID_OTP_MSG
      });
    }

    const clientForRole = supabaseAdmin || supabaseAnon;

    const { data: membership, error: memErr } = await clientForRole
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', verifyData.user.id)
      .maybeSingle();

    if (memErr || !membership || !membership.is_active || membership.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated or unauthorized. Please contact your manager.'
      });
    }

    const { data: shopMember, error: shopErr } = await clientForRole
      .from('shop_memberships')
      .select('shop_id, shops!inner(id, name, code, is_active, business_id)')
      .eq('user_id', verifyData.user.id)
      .maybeSingle();

    if (
      shopErr || 
      !shopMember || 
      !(shopMember as any).shops?.is_active ||
      (shopMember as any).shops?.business_id !== membership.business_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Your employee account is not currently assigned to an active shop. Please contact your manager.'
      });
    }

    return res.status(200).json({
      success: true,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        expires_at: verifyData.session.expires_at,
        expires_in: verifyData.session.expires_in
      },
      user: {
        id: verifyData.user.id,
        email: verifyData.user.email,
        username: verifyData.user.user_metadata?.username || cleanEmail.split('@')[0],
        name: verifyData.user.user_metadata?.full_name || 'Shop Staff',
        role: 'employee',
        isDemo: false,
        assignedShopId: shopMember.shop_id,
        assignedShopName: (shopMember as any).shops?.name,
        assignedShopCode: (shopMember as any).shops?.code
      }
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify verification code. Please try again.'
    });
  }
}

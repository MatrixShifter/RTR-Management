import { supabaseAnon, supabaseAdmin, supabaseServiceRoleKey } from '../_supabase.js';

export const EMPLOYEE_OTP_CONFIRMATION_MSG = "If an active employee account exists for this email, a verification code has been sent.";

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Please provide a valid employee email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email format.' });
  }

  const genericResponse = () => res.status(200).json({
    success: true,
    message: EMPLOYEE_OTP_CONFIRMATION_MSG
  });

  try {
    // 0. Demo employee sandbox check
    if (cleanEmail === 'demo-employee@rtrmobiles.com' || cleanEmail === 'employee@demo.com') {
      return genericResponse();
    }

    const hasAdminAccess = Boolean(supabaseServiceRoleKey && supabaseAdmin);

    // 1. Authoritative check if admin client is available
    if (hasAdminAccess) {
      let targetUserId: string | null = null;
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (profile?.id) {
          targetUserId = profile.id;
        }
      } catch {}

      if (!targetUserId) {
        try {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
          const matched = users?.find(u => u.email?.toLowerCase() === cleanEmail);
          if (matched?.id) {
            targetUserId = matched.id;
          }
        } catch {}
      }

      // Do not reveal non-existence; return generic response if user not found
      if (!targetUserId) {
        return genericResponse();
      }

      // Verify active employee membership
      const { data: membership } = await supabaseAdmin
        .from('business_memberships')
        .select('business_id, role, is_active')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!membership || !membership.is_active || membership.role !== 'employee') {
        return genericResponse();
      }

      // Verify active assigned retail shop
      const { data: shopMember, error: shopErr } = await supabaseAdmin
        .from('shop_memberships')
        .select('shop_id, shops!inner(id, is_active, business_id)')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (
        shopErr || 
        !shopMember || 
        !(shopMember as any).shops?.is_active ||
        (shopMember as any).shops?.business_id !== membership.business_id
      ) {
        return genericResponse();
      }
    }

    const canonicalRedirect = process.env.NODE_ENV === 'production'
      ? 'https://rtr-management-cfn4.vercel.app/login'
      : (process.env.APP_URL || 'http://localhost:5173/login');

    const targetRedirect = (typeof req.body?.redirectTo === 'string' && req.body.redirectTo.startsWith('http'))
      ? req.body.redirectTo
      : canonicalRedirect;

    // Dispatch Supabase OTP with shouldCreateUser: false
    // If user does not exist in auth.users, shouldCreateUser: false ensures no new user is created
    const { error: otpError } = await supabaseAnon.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: targetRedirect
      }
    });

    if (otpError) {
      const isRateLimit = otpError.status === 429 || 
        (otpError as any).code === 'over_email_send_rate_limit' || 
        otpError.message?.toLowerCase().includes('rate limit');

      if (isRateLimit) {
        return res.status(429).json({
          success: false,
          message: 'Supabase email delivery rate limit exceeded (default mail pool is limited to ~3-4 emails/hour). Please wait a few minutes before requesting another verification code.'
        });
      }

      return res.status(502).json({
        success: false,
        message: otpError.message || 'Unable to dispatch verification code at this time.'
      });
    }

    return genericResponse();
  } catch (err: any) {
    return genericResponse();
  }
}

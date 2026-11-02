import { supabaseAnon, supabaseAdmin } from '../_supabase.js';

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
    // Demo employee sandbox check
    if (cleanEmail === 'demo-employee@rtrmobiles.com' || cleanEmail === 'employee@demo.com') {
      return genericResponse();
    }

    const clientForRole = supabaseAdmin || supabaseAnon;

    // Check user in profiles or auth.users
    let targetUserId: string | null = null;
    try {
      const { data: profile } = await clientForRole
        .from('profiles')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (profile?.id) {
        targetUserId = profile.id;
      }
    } catch {}

    if (!targetUserId && supabaseAdmin) {
      try {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const matched = users?.find(u => u.email?.toLowerCase() === cleanEmail);
        if (matched?.id) {
          targetUserId = matched.id;
        }
      } catch {}
    }

    if (!targetUserId) {
      return genericResponse();
    }

    // Check membership
    const { data: membership } = await clientForRole
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!membership || !membership.is_active || membership.role !== 'employee') {
      return genericResponse();
    }

    // Check active shop assignment
    const { data: shopMember, error: shopErr } = await clientForRole
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

    // Dispatch Supabase OTP with shouldCreateUser: false
    const { error: otpError } = await supabaseAnon.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false
      }
    });

    if (otpError) {
      if (otpError.status === 429 || otpError.message.toLowerCase().includes('rate limit')) {
        return res.status(429).json({
          success: false,
          message: 'Too many verification code requests. Please wait a minute and try again.'
        });
      }
    }

    return genericResponse();
  } catch {
    return genericResponse();
  }
}

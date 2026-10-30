import { supabaseAnon, resolveIdentifierToEmail } from '../_supabase.js';

export const RECOVERY_CONFIRMATION_MSG = "If an account matches the information provided, password reset instructions will be sent to its registered email address.";

const ALLOWED_REDIRECT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'rtr-management-cfn4.vercel.app'
]);

function sanitizeRedirectUrl(targetUrl?: string): string {
  const fallback = 'https://rtr-management-cfn4.vercel.app/reset-password';
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

export default async function handler(req: any, res: any) {
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

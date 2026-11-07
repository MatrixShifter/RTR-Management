import { supabaseAdmin, supabaseAnon, configuredOwnerEmail } from './routes/auth.js';

let cachedOwnerToken: string | null = null;
let cachedOwnerTokenExpiresAt = 0;

/**
 * Generates an authoritative owner JWT access token directly via Supabase Auth Admin.
 * This eliminates all reliance on hardcoded passwords in test suites.
 */
export async function getTestOwnerToken(): Promise<string> {
  const now = Date.now();
  if (cachedOwnerToken && now < cachedOwnerTokenExpiresAt) {
    return cachedOwnerToken;
  }

  const { data: linkData, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: configuredOwnerEmail
  });

  if (lErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Failed to generate test magic link for ${configuredOwnerEmail}: ${lErr?.message}`);
  }

  const { data: sessData, error: sErr } = await supabaseAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });

  if (sErr || !sessData?.session?.access_token) {
    throw new Error(`Failed to verify test OTP token: ${sErr?.message}`);
  }

  cachedOwnerToken = sessData.session.access_token;
  cachedOwnerTokenExpiresAt = now + 180000; // cache for 3 minutes
  return cachedOwnerToken;
}

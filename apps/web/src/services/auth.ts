import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER } from '@crimpston/shared';
import { setDemoMode } from './demoMode.js';

export { DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER };

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'owner' | 'demo';
  isDemo?: boolean;
}

export const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";
export const RECOVERY_CONFIRMATION_MSG = "If an account matches the information provided, password reset instructions will be sent to its registered email address.";
export const NETWORK_ERROR_MSG = "Unable to connect to authentication service. Please check your connection and try again.";
export const OWNER_ONLY_ACCESS_MSG = "Access restricted to Business Owner only.";

export { getRememberedUsername, setRememberedUsername } from './rememberUsername.js';

const configuredOwnerEmail = (import.meta.env?.VITE_OWNER_EMAIL || 'vinov042007@gmail.com').trim().toLowerCase();

export const VERIFIED_USERNAME_MAP: Record<string, string> = {
  'owner': configuredOwnerEmail,
  'vino': configuredOwnerEmail,
  'rtrowner': configuredOwnerEmail,
  'rtrmobiles': configuredOwnerEmail,
  'owner@rtrmobiles.com': configuredOwnerEmail,
  'vinoth42007@gmail.com': configuredOwnerEmail,
  'vinov042007@gmail.com': configuredOwnerEmail,
  'demo-owner': 'demo-owner@rtrmobiles.com'
};

export function resolveLoginEmail(identifier: string): string | null {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;
  if (clean.includes('@')) return clean;
  return VERIFIED_USERNAME_MAP[clean] || null;
}

/**
 * Sign in with username (or email) and password
 */
export async function signIn(username: string, password: string): Promise<AuthUser> {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    throw new Error(INCORRECT_CREDENTIALS_MSG);
  }

  // 1. Try server-side authentication endpoint (/api/auth/login)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.session && isSupabaseConfigured && supabase) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
      }
      if (data.user?.role === 'demo' || data.user?.isDemo) {
        setDemoMode(true);
      } else {
        setDemoMode(false);
      }
      return data.user;
    }

    if (res.status === 401) {
      throw new Error(INCORRECT_CREDENTIALS_MSG);
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Access restricted. Please contact your system administrator.');
    }

    if (res.status === 429) {
      throw new Error('Too many login attempts. Please wait a moment and try again.');
    }

    // 5xx / 504 / gateway errors trigger the direct Supabase client fallback
    throw new Error(`API server status ${res.status}`);
  } catch (err: any) {
    // If it's an explicit 401, 403, or 429 response from the backend, bubble up immediately
    if (
      err.message === INCORRECT_CREDENTIALS_MSG || 
      err.message?.includes('restricted') ||
      err.message?.includes('Too many')
    ) {
      throw err;
    }

    // 2. Direct Supabase fallback if backend API server is offline or proxy failed
    if (isSupabaseConfigured && supabase) {
      const email = resolveLoginEmail(cleanUsername);

      if (!email) {
        throw new Error(INCORRECT_CREDENTIALS_MSG);
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        // Differentiate auth errors:
        if (authError?.status === 429 || authError?.message?.toLowerCase().includes('rate limit')) {
          throw new Error('Too many login attempts. Please wait a moment and try again.');
        }
        if (
          authError?.message === 'Failed to fetch' || 
          authError?.message?.toLowerCase().includes('network') ||
          (authError as any)?.name === 'AuthRetryableFetchError'
        ) {
          throw new Error(NETWORK_ERROR_MSG);
        }
        if (cleanUsername.toLowerCase() === DEMO_USERNAME.toLowerCase() || cleanUsername.toLowerCase() === 'demo-owner@rtrmobiles.com') {
          if (password === DEMO_PASSWORD_PLACEHOLDER) {
            setDemoMode(true);
            return {
              id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
              email: 'demo-owner@rtrmobiles.com',
              username: DEMO_USERNAME,
              name: 'Demo Owner (Sandbox)',
              role: 'demo',
              isDemo: true
            };
          }
        }
        throw new Error(INCORRECT_CREDENTIALS_MSG);
      }

      const isDemo = authData.user.email === 'demo-owner@rtrmobiles.com' || cleanUsername.toLowerCase() === 'demo-owner';
      if (isDemo) {
        setDemoMode(true);
        return {
          id: authData.user.id,
          email: authData.user.email || email,
          username: DEMO_USERNAME,
          name: authData.user.user_metadata?.full_name || 'Demo Owner (Sandbox)',
          role: 'demo',
          isDemo: true
        };
      }

      const { data: membership } = await supabase
        .from('business_memberships')
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (membership?.role !== 'owner') {
        await supabase.auth.signOut().catch(() => {});
        throw new Error(OWNER_ONLY_ACCESS_MSG);
      }

      setDemoMode(false);
      return {
        id: authData.user.id,
        email: authData.user.email || email,
        username: cleanUsername,
        name: authData.user.user_metadata?.full_name || 'Business Owner',
        role: 'owner',
        isDemo: false
      };
    }

    // Direct fallback for Demo account when Supabase is unconfigured / mock environment
    if (cleanUsername.toLowerCase() === DEMO_USERNAME.toLowerCase() || cleanUsername.toLowerCase() === 'demo-owner@rtrmobiles.com') {
      if (password === DEMO_PASSWORD_PLACEHOLDER) {
        setDemoMode(true);
        return {
          id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
          email: 'demo-owner@rtrmobiles.com',
          username: DEMO_USERNAME,
          name: 'Demo Owner (Sandbox)',
          role: 'demo',
          isDemo: true
        };
      }
      throw new Error(INCORRECT_CREDENTIALS_MSG);
    }

    throw new Error(NETWORK_ERROR_MSG);
  }

  throw new Error(INCORRECT_CREDENTIALS_MSG);
}

/**
 * Request password recovery instructions for a username or email
 */
export async function requestPasswordReset(identifier: string): Promise<string> {
  const clean = identifier.trim();
  if (!clean) {
    return RECOVERY_CONFIRMATION_MSG;
  }

  // 1. Primary: Send request through secure backend endpoint
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: clean,
        redirectTo: `${window.location.origin}/reset-password`
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.message || RECOVERY_CONFIRMATION_MSG;
    }

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Email rate limit exceeded. Please wait a minute before requesting another reset link.');
    }

    if (res.status >= 400) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to submit password recovery request.');
    }
  } catch (err: any) {
    if (err.message && (
      err.message.includes('rate limit') || 
      err.message.includes('wait') || 
      err.message.includes('Unable') ||
      err.message.includes('deliver') ||
      err.message.includes('exceeded')
    )) {
      throw err;
    }

    // 2. Direct Supabase fallback if backend API server is offline
    if (isSupabaseConfigured && supabase) {
      const email = resolveLoginEmail(clean) || (clean.includes('@') ? clean : null);
      if (email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) {
          if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
            throw new Error('Email rate limit exceeded. Please wait a minute before requesting another reset link.');
          }
          throw new Error(error.message || 'Failed to send password recovery email.');
        }
        return RECOVERY_CONFIRMATION_MSG;
      }
    }

    throw err;
  }

  return RECOVERY_CONFIRMATION_MSG;
}

/**
 * Update password using current active recovery session.
 * Safely signs out of the temporary recovery session upon completion to guarantee
 * that subsequent logins strictly authenticate with the new credentials.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Authentication service is not configured.');
  }

  // Retrieve current recovery access token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('No active recovery session found. Please request a new recovery link.');
  }

  // 1. Primary: Update password via secure backend API endpoint (verifies owner role and emits security audit event)
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (res.ok) {
      // 2. Sign out of recovery session so subsequent logins strictly require new credentials
      await supabase.auth.signOut().catch(() => {});
      try {
        localStorage.removeItem('rtr_current_user');
        localStorage.removeItem('rtr_session_expiry');
      } catch {}
      return;
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to update password. Recovery session may have expired.');
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('expired') || err.message.includes('at least 8 characters') || err.message.includes('restricted'))) {
      throw err;
    }
  }

  // 2. Fallback: Direct Supabase client update if API server is unreachable
  const { error: clientError } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (clientError) {
    throw new Error(clientError.message || 'Failed to update password. Recovery session expired.');
  }

  await supabase.auth.signOut().catch(() => {});
  try {
    localStorage.removeItem('rtr_current_user');
    localStorage.removeItem('rtr_session_expiry');
  } catch {}
}

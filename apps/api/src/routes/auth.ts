import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { config } from '../config.js';
import { authRateLimiter, passwordRecoveryRateLimiter } from '../middleware/rateLimiter.js';
import { logger, logSecurityEvent } from '../logger.js';
import { DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER } from '@crimpston/shared';

export const authRouter = Router();

// Supabase clients:
// - Anon client for password authentication and recovery requests
// - Service role client for server-side username resolution and session verification
const supabaseAnon = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const INCORRECT_CREDENTIALS_MSG = "Incorrect username or password. Please try again.";
export const RECOVERY_CONFIRMATION_MSG = "If an account matches the information provided, password reset instructions will be sent to its registered email address.";
export const OWNER_ONLY_ACCESS_MSG = "Access restricted to Business Owner only.";

// Verified system username mappings for the authorized business owner and demo account
const VERIFIED_USERNAME_MAP: Record<string, string> = {
  'owner': 'owner@rtrmobiles.com',
  'vino': 'owner@rtrmobiles.com',
  'rtrowner': 'owner@rtrmobiles.com',
  'rtrmobiles': 'owner@rtrmobiles.com',
  'demo-owner': 'demo-owner@rtrmobiles.com'
};

/**
 * Resolves a username or email identifier to a verified email address
 * entirely server-side without exposing private account details to the caller.
 */
export async function resolveIdentifierToEmail(identifier: string): Promise<string | null> {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }

  // 1. Check verified owner username map
  if (VERIFIED_USERNAME_MAP[clean]) {
    return VERIFIED_USERNAME_MAP[clean];
  }

  // 2. Query profiles table
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .ilike('username', clean)
      .maybeSingle();

    if (profile?.email) {
      return profile.email;
    }
  } catch {
    // profiles table might not have username column yet
  }

  // 3. Query auth.users metadata
  try {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const matched = users?.find(u => 
      u.user_metadata?.username && 
      String(u.user_metadata.username).toLowerCase() === clean
    );
    if (matched?.email) {
      return matched.email;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * POST /api/auth/login
 * Authenticates user via username or email against Supabase Auth.
 * Strictly restricts authorization to the Business Owner role.
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(401).json({
      success: false,
      message: INCORRECT_CREDENTIALS_MSG
    });
  }

  try {
    const cleanUser = username.trim().toLowerCase();

    // 0. Demo Account Authentication
    // Completely isolated from live owner accounts and Supabase database
    const configuredDemoUser = (process.env.DEMO_USERNAME || DEMO_USERNAME).trim().toLowerCase();
    const configuredDemoPass = process.env.DEMO_PASSWORD || DEMO_PASSWORD_PLACEHOLDER;
    const isDemoEnabled = process.env.DEMO_ENABLED !== 'false';

    if (cleanUser === configuredDemoUser || cleanUser === 'demo-owner@rtrmobiles.com') {
      if (!isDemoEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Demo access is currently disabled by administrator.'
        });
      }

      // 1. Authenticate with Supabase Auth for genuine demo session token
      try {
        const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
          email: 'demo-owner@rtrmobiles.com',
          password: password
        });

        if (!authError && authData.session && authData.user) {
          logSecurityEvent({
            action: 'DEMO_LOGIN',
            actorId: authData.user.id,
            status: 'SUCCESS',
            ip: req.ip
          });

          return res.status(200).json({
            success: true,
            session: {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
              expires_at: authData.session.expires_at,
              expires_in: authData.session.expires_in
            },
            user: {
              id: authData.user.id,
              email: authData.user.email || 'demo-owner@rtrmobiles.com',
              username: DEMO_USERNAME,
              name: authData.user.user_metadata?.full_name || 'Demo Owner (Sandbox)',
              role: 'demo',
              isDemo: true
            }
          });
        }
      } catch (err) {
        console.warn('[Demo Supabase Auth Error]', err);
      }

      // 2. If password does not match configured demo password, reject with 401
      if (password !== configuredDemoPass) {
        logSecurityEvent({
          action: 'DEMO_LOGIN',
          status: 'FAILURE',
          ip: req.ip,
          details: { reason: 'Incorrect credentials' }
        });
        return res.status(401).json({
          success: false,
          message: INCORRECT_CREDENTIALS_MSG
        });
      }

      // 3. Fallback isolated sandbox session if Supabase Auth is offline
      const demoToken = `demo-session-${crypto.randomUUID()}`;
      return res.status(200).json({
        success: true,
        session: {
          access_token: demoToken,
          refresh_token: `demo-refresh-${crypto.randomUUID()}`,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          expires_in: 86400
        },
        user: {
          id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
          email: 'demo-owner@rtrmobiles.com',
          username: process.env.DEMO_USERNAME || DEMO_USERNAME,
          name: 'Demo Owner (Sandbox)',
          role: 'demo',
          isDemo: true
        }
      });
    }

    const resolvedEmail = await resolveIdentifierToEmail(username);
    if (!resolvedEmail) {
      // Do not reveal whether account exists
      return res.status(401).json({
        success: false,
        message: INCORRECT_CREDENTIALS_MSG
      });
    }

    // Strictly deny employee or staff logins with 403
    if (resolvedEmail.includes('staff') || cleanUser.includes('staff') || cleanUser.includes('employee')) {
      return res.status(403).json({
        success: false,
        message: OWNER_ONLY_ACCESS_MSG
      });
    }

    // Check membership role for non-owner accounts
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', resolvedEmail)
      .maybeSingle();

    if (profile?.id) {
      const { data: mem } = await supabaseAdmin
        .from('business_memberships')
        .select('role, is_active')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (mem && mem.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: OWNER_ONLY_ACCESS_MSG
        });
      }
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: resolvedEmail,
      password: password
    });

    if (error || !data.user || !data.session) {
      logSecurityEvent({
        action: 'OWNER_LOGIN',
        status: 'FAILURE',
        ip: req.ip,
        details: { identifier: username }
      });
      return res.status(401).json({
        success: false,
        message: INCORRECT_CREDENTIALS_MSG
      });
    }

    // Server-side verification: Strictly verify user is an active Business Owner
    const { data: membership } = await supabaseAdmin
      .from('business_memberships')
      .select('role, is_active')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!membership || membership.role !== 'owner' || !membership.is_active) {
      logSecurityEvent({
        action: 'EMPLOYEE_LOGIN_BLOCKED',
        actorId: data.user.id,
        status: 'BLOCKED',
        ip: req.ip,
        details: { role: membership?.role || 'none' }
      });
      return res.status(403).json({
        success: false,
        message: OWNER_ONLY_ACCESS_MSG
      });
    }

    logSecurityEvent({
      action: 'OWNER_LOGIN',
      actorId: data.user.id,
      status: 'SUCCESS',
      ip: req.ip
    });

    return res.status(200).json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        username: username.includes('@') ? (data.user.user_metadata?.username || 'owner') : username.trim(),
        name: data.user.user_metadata?.full_name || 'Business Owner',
        role: 'owner'
      }
    });
  } catch (err: any) {
    console.error('[Auth Service Error]', err);
    return res.status(503).json({
      success: false,
      message: "Unable to connect to authentication service. Please check your connection and try again."
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Initiates secure password recovery link email via Supabase Auth for owner accounts.
 * Always returns a neutral message to prevent account enumeration.
 */
authRouter.post('/forgot-password', passwordRecoveryRateLimiter, async (req: Request, res: Response) => {
  const { identifier, redirectTo } = req.body || {};

  if (!identifier || typeof identifier !== 'string') {
    return res.status(200).json({
      success: true,
      message: RECOVERY_CONFIRMATION_MSG
    });
  }

  try {
    const cleanId = identifier.trim().toLowerCase();
    const configuredDemoUser = (process.env.DEMO_USERNAME || DEMO_USERNAME).trim().toLowerCase();

    // Demo account reset requests return neutral confirmation immediately without invoking Supabase
    if (cleanId === configuredDemoUser || cleanId === 'demo-owner@rtrmobiles.com') {
      return res.status(200).json({
        success: true,
        message: RECOVERY_CONFIRMATION_MSG
      });
    }

    const targetEmail = await resolveIdentifierToEmail(identifier);
    if (targetEmail) {
      let isOwner = false;

      // 1. Direct check against known owner emails
      if (
        cleanId === 'owner' || 
        cleanId === 'vino' || 
        targetEmail === 'owner@rtrmobiles.com' || 
        targetEmail === 'vinoth42007@gmail.com'
      ) {
        isOwner = true;
      }

      // 2. Database check via profiles and business_memberships
      if (!isOwner) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .ilike('email', targetEmail)
          .maybeSingle();

        if (profile?.id) {
          const { data: membership } = await supabaseAdmin
            .from('business_memberships')
            .select('role, is_active')
            .eq('user_id', profile.id)
            .maybeSingle();

          if (membership && membership.role === 'owner' && membership.is_active) {
            isOwner = true;
          }
        }
      }

      // 3. Fallback check via auth.users
      if (!isOwner) {
        try {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
          const user = users?.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
          if (user) {
            const { data: membership } = await supabaseAdmin
              .from('business_memberships')
              .select('role, is_active')
              .eq('user_id', user.id)
              .maybeSingle();

            if (membership && membership.role === 'owner' && membership.is_active) {
              isOwner = true;
            }
          }
        } catch {
          // ignore
        }
      }

      if (isOwner) {
        const defaultOrigin = config.CORS_ORIGIN || 'http://localhost:5173';
        const redirectUrl = redirectTo && (redirectTo.startsWith('http://') || redirectTo.startsWith('https://'))
          ? redirectTo
          : `${defaultOrigin}/reset-password`;

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: redirectUrl
        });

        let directLink: string | undefined;
        try {
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: targetEmail,
            options: { redirectTo: redirectUrl }
          });
          directLink = linkData?.properties?.action_link;
          if (directLink) {
            logger.info(`[Password Recovery Link Generated] Link for ${targetEmail}: ${directLink}`);
          }
        } catch {
          // ignore
        }

        if (error) {
          logger.warn(`[Password Recovery Info] Reset requested for ${targetEmail}: ${error.message}`);
        } else {
          logSecurityEvent({
            action: 'PASSWORD_RECOVERY_REQUESTED',
            status: 'SUCCESS',
            ip: req.ip,
            details: { targetEmail }
          });
        }

        if ((config.NODE_ENV === 'development' || config.NODE_ENV === 'test') && directLink) {
          return res.status(200).json({
            success: true,
            message: RECOVERY_CONFIRMATION_MSG,
            devRecoveryLink: directLink
          });
        }
      }
    }
  } catch (err) {
    console.error('[Password Recovery Error]', err);
  }

  // Never reveal whether a user or email exists
  return res.status(200).json({
    success: true,
    message: RECOVERY_CONFIRMATION_MSG
  });
});

/**
 * POST /api/auth/reset-password
 * Securely updates user password using authenticated recovery session token.
 * Validates session against Supabase Auth before modifying password.
 */
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing recovery session token.'
    });
  }

  const token = authHeader.split(' ')[1];
  const { password } = req.body || {};

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long.'
    });
  }

  try {
    // 1. Verify token belongs to a valid user in Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired recovery session. Please request a new recovery link.'
      });
    }

    // 2. Update user's password in Supabase Auth using Admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: password
    });

    if (updateError) {
      logSecurityEvent({
        action: 'PASSWORD_RESET',
        actorId: user.id,
        status: 'FAILURE',
        ip: req.ip,
        details: { error: updateError.message }
      });
      return res.status(500).json({
        success: false,
        message: updateError.message || 'Failed to update password.'
      });
    }

    logSecurityEvent({
      action: 'PASSWORD_RESET',
      actorId: user.id,
      status: 'SUCCESS',
      ip: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You may now sign in with your new password.'
    });
  } catch (err: any) {
    console.error('[Reset Password Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during password reset.'
    });
  }
});

/**
 * GET /api/auth/verify-session
 * Server-side token verification endpoint to ensure client sessions are valid,
 * active, and strictly authorized as Business Owner.
 */
authRouter.get('/verify-session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, message: 'Missing authorization token.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return res.status(401).json({ valid: false, message: 'Missing authorization token.' });
  }

  // Isolated demo token validation
  if (token.startsWith('demo-session-')) {
    return res.status(200).json({
      valid: true,
      user: {
        id: 'demo-user-00000000-0000-0000-0000-000000000000',
        email: 'demo-owner@rtrmobiles.com',
        username: process.env.DEMO_USERNAME || DEMO_USERNAME,
        name: 'Demo Owner (Sandbox)',
        role: 'demo',
        isDemo: true
      }
    });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ valid: false, message: 'Invalid or expired session.' });
    }

    // 1. Authorized demo account verification
    if (
      user.email === 'demo-owner@rtrmobiles.com' || 
      user.user_metadata?.username === 'demo-owner' || 
      user.user_metadata?.role === 'demo'
    ) {
      return res.status(200).json({
        valid: true,
        user: {
          id: user.id,
          email: user.email || 'demo-owner@rtrmobiles.com',
          username: DEMO_USERNAME,
          name: user.user_metadata?.full_name || 'Demo Owner (Sandbox)',
          role: 'demo',
          isDemo: true
        }
      });
    }

    const { data: membership, error: memberErr } = await supabaseAdmin
      .from('business_memberships')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !membership || membership.role !== 'owner' || !membership.is_active) {
      return res.status(403).json({ valid: false, message: OWNER_ONLY_ACCESS_MSG });
    }

    return res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || 'Business Owner',
        role: 'owner'
      }
    });
  } catch (err: any) {
    logger.warn('Session verification caught exception', { message: err?.message });
    return res.status(401).json({ valid: false, message: 'Session verification failed.' });
  }
});

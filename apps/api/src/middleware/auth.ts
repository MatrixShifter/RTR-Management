import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logSecurityEvent } from '../logger.js';

const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export interface AuthenticatedUser {
  id: string;
  email?: string;
  businessId: string;
  role: 'owner' | 'demo';
  isDemo?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logSecurityEvent({
      action: 'API_AUTH_ATTEMPT',
      category: 'auth_session',
      status: 'FAILURE',
      statusCode: 401,
      correlationId,
      errorCategory: 'missing_authorization_header'
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.'
    });
  }

  const token = authHeader.split(' ')[1];

  // Demo token handler
  if (token && token.startsWith('demo-session-')) {
    // If request attempts to write / mutate production data, reject with 403 Forbidden
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      logSecurityEvent({
        action: 'DEMO_MUTATION_BLOCKED',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId,
        details: { path: req.path, method: req.method }
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Demo sessions cannot modify production business data.'
      });
    }

    req.user = {
      id: 'demo-user-00000000-0000-0000-0000-000000000000',
      email: 'demo-owner@rtrmobiles.com',
      businessId: 'demo-business-00000000-0000-0000-0000-000000000000',
      role: 'demo',
      isDemo: true
    };
    return next();
  }

  // Live Supabase token verification
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      logSecurityEvent({
        action: 'API_AUTH_ATTEMPT',
        category: 'auth_session',
        status: 'FAILURE',
        statusCode: 401,
        correlationId,
        errorCategory: 'invalid_or_expired_token'
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.'
      });
    }

    // Live Supabase token: Handle demo account sessions
    if (
      user.email === 'demo-owner@rtrmobiles.com' || 
      user.user_metadata?.role === 'demo' || 
      user.user_metadata?.username === 'demo-owner'
    ) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        logSecurityEvent({
          action: 'DEMO_MUTATION_BLOCKED',
          category: 'access_control',
          status: 'BLOCKED',
          statusCode: 403,
          correlationId,
          details: { path: req.path, method: req.method }
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Demo sessions cannot modify production business data.'
        });
      }

      req.user = {
        id: user.id,
        email: user.email || 'demo-owner@rtrmobiles.com',
        businessId: 'demo-business-00000000-0000-0000-0000-000000000000',
        role: 'demo',
        isDemo: true
      };
      return next();
    }

    // Role verification against business_memberships
    const { data: membership, error: memError } = await supabaseAdmin
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memError || !membership || membership.role !== 'owner' || !membership.is_active) {
      logSecurityEvent({
        action: 'UNAUTHORIZED_ROLE_ACCESS',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId,
        errorCategory: 'unauthorized_role'
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Business Owner privileges required.'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      businessId: membership.business_id,
      role: 'owner',
      isDemo: false
    };

    return next();
  } catch {
    logSecurityEvent({
      action: 'API_AUTH_ERROR',
      category: 'auth_session',
      status: 'FAILURE',
      statusCode: 401,
      correlationId,
      errorCategory: 'verification_failed'
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication verification failed.'
    });
  }
}

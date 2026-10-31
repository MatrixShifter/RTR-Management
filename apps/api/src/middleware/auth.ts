import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from '../logger.js';
import { supabaseAdmin } from '../supabase.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  businessId: string;
  role: 'owner' | 'employee' | 'demo';
  isDemo?: boolean;
  assignedShopId?: string;
  assignedShopName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Universal authentication middleware verifying token and resolving role (owner or employee).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  // Demo token handler (active only when demo sandbox is enabled)
  if (token && token.startsWith('demo-session-')) {
    const isDemoEnabled = process.env.NODE_ENV !== 'production' && process.env.DEMO_ENABLED !== 'false';
    if (!isDemoEnabled) {
      logSecurityEvent({
        action: 'API_AUTH_ATTEMPT',
        category: 'auth_session',
        status: 'FAILURE',
        statusCode: 401,
        correlationId,
        errorCategory: 'demo_access_disabled'
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Demo access is disabled in production.'
      });
    }

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

    if (memError || !membership || !membership.is_active) {
      logSecurityEvent({
        action: 'UNAUTHORIZED_ROLE_ACCESS',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId,
        errorCategory: 'unauthorized_or_inactive'
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated or unauthorized. Please contact your manager.'
      });
    }

    if (membership.role === 'owner') {
      req.user = {
        id: user.id,
        email: user.email,
        businessId: membership.business_id,
        role: 'owner',
        isDemo: false
      };
      return next();
    }

    if (membership.role === 'employee') {
      // Resolve assigned shop
      const { data: shopMember, error: shopErr } = await supabaseAdmin
        .from('shop_memberships')
        .select('shop_id, shops!inner(id, name, code, is_active, business_id)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        shopErr || 
        !shopMember || 
        !(shopMember as any).shops?.is_active ||
        (shopMember as any).shops?.business_id !== membership.business_id
      ) {
        logSecurityEvent({
          action: 'EMPLOYEE_NO_ACTIVE_SHOP',
          category: 'access_control',
          status: 'BLOCKED',
          statusCode: 403,
          correlationId,
          errorCategory: 'no_assigned_shop'
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your employee account is not currently assigned to an active shop. Please contact your manager.'
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        businessId: membership.business_id,
        role: 'employee',
        isDemo: false,
        assignedShopId: shopMember.shop_id,
        assignedShopName: (shopMember as any).shops?.name
      };
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Unknown or invalid role.'
    });
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

/**
 * Strict owner authorization middleware ensuring only Business Owners or demo can proceed.
 */
export async function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if (req.user?.role !== 'owner' && req.user?.role !== 'demo') {
      logSecurityEvent({
        action: 'UNAUTHORIZED_ROLE_ACCESS',
        category: 'access_control',
        status: 'BLOCKED',
        statusCode: 403,
        correlationId: (req.headers['x-correlation-id'] as string),
        errorCategory: 'unauthorized_role'
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Business Owner privileges required.'
      });
    }
    return next();
  });
}

/**
 * Strict shop employee authorization middleware ensuring only active assigned employees can proceed.
 */
export async function requireShopEmployeeAuth(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if (req.user?.role !== 'employee') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Shop Employee privileges required.'
      });
    }
    return next();
  });
}

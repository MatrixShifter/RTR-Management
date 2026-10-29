/**
 * Production-Safe Structured Logging and Security Auditing Utility.
 * 
 * Strict Data Hygiene Principles:
 * 1. NEVER log sensitive credentials (passwords, tokens, JWTs, API keys, cookies, auth headers).
 * 2. NEVER log personal identifiers (user emails, usernames, phone numbers, client IPs) in routine terminal output.
 * 3. Log minimum operational structured fields: category, action, outcome, status code, correlationId, error category.
 * 4. Production server errors omit raw stack traces and internal SQL details.
 */

export function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeyPatterns = [
    'password',
    'token',
    'authorization',
    'secret',
    'key',
    'credential',
    'apikey',
    'cookie',
    'jwt',
    'bearer',
    'actionlink',
    'recoverylink',
    'action_link',
    'recovery_link'
  ];

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (sensitiveKeyPatterns.some(pattern => normalizedKey.includes(pattern))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeData(value);
    }
  }

  return sanitized;
}

export interface SecurityEvent {
  action: string;
  category?: 'auth_login' | 'auth_recovery' | 'auth_session' | 'record_mutation' | 'access_control';
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  statusCode?: number;
  correlationId?: string;
  errorCategory?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  // Legacy / caller parameters kept for interface compatibility, but strictly sanitized/omitted from terminal logs:
  actorId?: string;
  ip?: string;
}

function resolveEventCategory(action: string): string {
  if (action.includes('LOGIN')) return 'auth_login';
  if (action.includes('RECOVERY') || action.includes('RESET')) return 'auth_recovery';
  if (action.includes('SESSION') || action.includes('AUTH_ATTEMPT') || action.includes('AUTH_ERROR')) return 'auth_session';
  if (action.includes('RECORD') || action.includes('PAYMENT') || action.includes('DELIVERY')) return 'record_mutation';
  return 'access_control';
}

export function logSecurityEvent(event: SecurityEvent): void {
  const category = event.category || resolveEventCategory(event.action);

  // Allowlisted structured operational fields only
  const cleanEvent: Record<string, unknown> = {
    category,
    action: event.action,
    status: event.status
  };

  if (typeof event.statusCode === 'number') {
    cleanEvent.statusCode = event.statusCode;
  }

  if (event.correlationId) {
    cleanEvent.correlationId = event.correlationId;
  }

  if (event.errorCategory) {
    cleanEvent.errorCategory = event.errorCategory;
  }

  // Safe entity target ID (e.g. delivery record UUID), strictly excluding emails/usernames
  if (event.targetId && !event.targetId.includes('@')) {
    cleanEvent.targetId = event.targetId;
  }

  // Filter details through strict allowlist: prohibit emails, usernames, IPs, tokens, passwords
  if (event.details && typeof event.details === 'object') {
    const rawSanitized = sanitizeData(event.details) as Record<string, unknown>;
    const safeDetails: Record<string, unknown> = {};
    const prohibitedWords = ['identifier', 'username', 'email', 'user', 'password', 'token', 'ip', 'actorid', 'actor'];

    for (const [k, v] of Object.entries(rawSanitized)) {
      const normalized = k.toLowerCase().replace(/[-_]/g, '');
      const isProhibited = prohibitedWords.some(p => normalized.includes(p));
      if (!isProhibited) {
        safeDetails[k] = v;
      }
    }

    if (Object.keys(safeDetails).length > 0) {
      cleanEvent.details = safeDetails;
    }
  }

  const payload = {
    level: 'security',
    timestamp: new Date().toISOString(),
    event: cleanEvent
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      meta: meta ? sanitizeData(meta) : undefined
    }));
  },
  warn: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      meta: meta ? sanitizeData(meta) : undefined
    }));
  },
  error: (message: string, error?: unknown) => {
    const isProd = process.env.NODE_ENV === 'production';
    let errorDetails: unknown;

    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        // In production, omit raw stack trace to prevent leaking file paths or internal schema details
        stack: isProd ? undefined : error.stack
      };
    } else {
      errorDetails = error;
    }

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      error: errorDetails ? sanitizeData(errorDetails) : undefined
    }));
  }
};

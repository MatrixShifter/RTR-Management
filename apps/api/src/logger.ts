/**
 * Production-Safe Structured Logging and Security Auditing Utility.
 * 
 * Strict Data Hygiene Principles:
 * 1. NEVER log sensitive credentials (passwords, tokens, JWTs, API keys, cookies, auth headers).
 * 2. NEVER log personal identifiers (user emails, usernames, phone numbers, client IPs) in routine terminal output.
 * 3. NEVER log customer or shop names, product names, or financial values (amounts, prices, profits).
 * 4. NEVER log raw database UUIDs or record counts in routine terminal logs.
 * 5. Log minimum operational structured fields: category, action, outcome, status code, correlationId, error category, resourceType.
 * 6. Production server errors omit raw stack traces and internal SQL details.
 */

const SENSITIVE_KEY_PATTERNS = [
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
  'recovery_link',
  'customername',
  'shopname',
  'productname',
  'email',
  'phone',
  'amount',
  'price',
  'profit',
  'cost',
  'pendingamount',
  'customerprice',
  'totalrecords',
  'recordscount',
  'uuid',
  'shopid',
  'productid',
  'deliveryid',
  'employeeid',
  'businessid'
];

const UUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const EMAIL_PATTERN = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

/**
 * Sanitizes URLs to mask database UUIDs with `:id` and redact sensitive query params.
 */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const pathname = parsed.pathname.replace(new RegExp(UUID_PATTERN, 'g'), ':id');
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      for (const key of params.keys()) {
        if (/token|key|secret|code|password|auth|jwt|shop|product|user|email/i.test(key)) {
          params.set(key, '[REDACTED]');
        }
      }
      return `${pathname}?${params.toString()}`;
    }
    return pathname;
  } catch {
    const base = rawUrl.split('?')[0] || '';
    return base.replace(new RegExp(UUID_PATTERN, 'g'), ':id');
  }
}

export function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    let sanitized = data;
    if (EMAIL_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(new RegExp(EMAIL_PATTERN, 'g'), '[REDACTED_EMAIL]');
    }
    if (UUID_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(new RegExp(UUID_PATTERN, 'g'), '[REDACTED_UUID]');
    }
    if (PHONE_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(new RegExp(PHONE_PATTERN, 'g'), '[REDACTED_PHONE]');
    }
    return sanitized;
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEY_PATTERNS.some(pattern => normalizedKey.includes(pattern))) {
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
  resourceType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  // Legacy / caller parameters kept for interface compatibility, strictly sanitized/omitted from terminal logs:
  actorId?: string;
  ip?: string;
}

const ALLOWED_DETAIL_KEYS = new Set([
  'reason',
  'previousStatus',
  'newStatus',
  'isActive',
  'updatedFields',
  'resourceType',
  'method',
  'action'
]);

function resolveEventCategory(action: string): string {
  if (action.includes('LOGIN')) return 'auth_login';
  if (action.includes('RECOVERY') || action.includes('RESET')) return 'auth_recovery';
  if (action.includes('SESSION') || action.includes('AUTH_ATTEMPT') || action.includes('AUTH_ERROR')) return 'auth_session';
  if (action.includes('RECORD') || action.includes('PAYMENT') || action.includes('DELIVERY') || action.includes('PRODUCT') || action.includes('SHOP') || action.includes('SETTINGS')) return 'record_mutation';
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

  if (event.resourceType) {
    cleanEvent.resourceType = event.resourceType;
  }

  // Safe entity target ID: redact standard UUIDs and drop emails/usernames
  if (event.targetId) {
    if (event.targetId.includes('@')) {
      // Prohibit emails in targetId entirely
    } else if (UUID_PATTERN.test(event.targetId)) {
      cleanEvent.targetId = '[REDACTED_UUID]';
    } else {
      cleanEvent.targetId = event.targetId;
    }
  }

  // Filter details through strict allowlist: prohibit emails, usernames, IPs, tokens, passwords, financial values, record counts, and raw UUIDs
  if (event.details && typeof event.details === 'object') {
    const rawSanitized = sanitizeData(event.details) as Record<string, unknown>;
    const safeDetails: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(rawSanitized)) {
      if (ALLOWED_DETAIL_KEYS.has(k)) {
        safeDetails[k] = v;
      }
    }

    if (Object.keys(safeDetails).length > 0) {
      cleanEvent.details = safeDetails;
    }
  }

  const isTest = process.env.NODE_ENV === 'test';
  const isVerbose = process.env.VERBOSE_LOGS === 'true' || process.env.DEBUG_SECURITY === 'true';

  // Logging level enforcement:
  // - Critical security failures (status: 'FAILURE') and access denials (status: 'BLOCKED') are ALWAYS logged.
  // - Critical financial/data mutations and employee revocations are ALWAYS logged.
  // - Routine successful authentications (OWNER_LOGIN, EMPLOYEE_LOGIN, DEMO_LOGIN) are suppressed
  //   from terminal noise in production and standard development, unless verbose debugging or test verification is active.
  const isRoutineAuthSuccess = event.status === 'SUCCESS' && (category === 'auth_login' || category === 'auth_session');
  if (isRoutineAuthSuccess && !isTest && !isVerbose) {
    return;
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
    const isProd = process.env.NODE_ENV === 'production';
    const isVerbose = process.env.VERBOSE_LOGS === 'true';
    const isLifecycleMessage = message.includes('listening') || message.includes('ready') || message.includes('Shutting down') || message.includes('closed');

    // In production, omit routine debug info unless it is a primary lifecycle message or verbose mode is enabled
    if (isProd && !isVerbose && !isLifecycleMessage) {
      return;
    }

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

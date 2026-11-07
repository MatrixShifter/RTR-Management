/**
 * Client-Side Safe Production Logger.
 *
 * Strict Security Principles:
 * 1. NEVER print Supabase keys, tokens, session objects, passwords, or emails.
 * 2. In production, never dump raw Error objects, stack traces, or SQL schemas to the browser console.
 * 3. Log only non-sensitive event messages and safe error categories.
 */

const SENSITIVE_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWT / Bearer tokens
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, // UUIDs
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, // Emails
  /password\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi
];

function sanitizeMessage(message: string): string {
  let clean = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    clean = clean.replace(pattern, '[REDACTED]');
  }
  return clean;
}

function extractSafeErrorMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') {
    return sanitizeMessage(err);
  }
  if (err instanceof Error) {
    return sanitizeMessage(err.message || 'Operation error');
  }
  if (typeof err === 'object' && err !== null) {
    const maybeMessage = (err as any).message || (err as any).error_description || (err as any).code;
    if (typeof maybeMessage === 'string') {
      return sanitizeMessage(maybeMessage);
    }
  }
  return 'Operation error';
}

const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

export const safeLogger = {
  info: (message: string) => {
    if (isProduction) return;
    // eslint-disable-next-line no-console
    console.info(`[RTR] ${sanitizeMessage(message)}`);
  },

  warn: (message: string, err?: unknown) => {
    if (isProduction) {
      // In production, log only the message and safe error message string, never raw objects
      const safeErr = err ? `: ${extractSafeErrorMessage(err)}` : '';
      // eslint-disable-next-line no-console
      console.warn(`[RTR Warning] ${sanitizeMessage(message)}${safeErr}`);
      return;
    }
    const safeErr = err ? `: ${extractSafeErrorMessage(err)}` : '';
    // eslint-disable-next-line no-console
    console.warn(`[RTR Warning] ${sanitizeMessage(message)}${safeErr}`);
  },

  error: (message: string, err?: unknown) => {
    const safeErr = err ? `: ${extractSafeErrorMessage(err)}` : '';
    // eslint-disable-next-line no-console
    console.error(`[RTR Error] ${sanitizeMessage(message)}${safeErr}`);
  }
};

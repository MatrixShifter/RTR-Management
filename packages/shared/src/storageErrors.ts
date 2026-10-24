export const DATABASE_STORAGE_FULL_TITLE = 'Database Storage Full';

export const DATABASE_STORAGE_FULL_MESSAGE =
  'Your database has reached its storage limit. This record could not be saved. Please contact your administrator to free up storage or upgrade the database plan. Try again after the issue is resolved.';

/**
 * PostgreSQL / PostgREST / Supabase capacity error codes.
 * 53100: DISK_FULL
 * 53000: INSUFFICIENT_RESOURCES
 * 53200: OUT_OF_MEMORY
 * 53400: CONFIGURATION_LIMIT_EXCEEDED
 */
const CAPACITY_POSTGRES_CODES = new Set(['53100', '53000', '53200', '53400']);

/**
 * Regex patterns identifying storage, disk, or quota capacity exhaustion.
 */
const CAPACITY_MESSAGE_PATTERNS = [
  /disk[_\s\-]?full/i,
  /storage[_\s\-]?limit/i,
  /quota[_\s\-]?exceeded/i,
  /insufficient[_\s\-]?storage/i,
  /no space left on device/i,
  /exceeded.*(?:disk|storage|quota)\s*(?:budget|limit)?/i,
  /database.*capacity/i,
  /database is full/i,
  /database storage full/i,
  /project.*reached.*storage/i,
  /database.*out of storage/i,
  /postgres.*insufficient.*resources/i,
];

/**
 * Non-capacity negative filters: rate limits, auth, network, integrity constraints.
 */
const NON_CAPACITY_PATTERNS = [
  /rate[_\s\-]?limit/i,
  /too many requests/i,
  /permission denied/i,
  /violates foreign key/i,
  /violates unique constraint/i,
  /violates not-null constraint/i,
  /violates check constraint/i,
  /invalid input syntax/i,
  /jwt/i,
  /network error/i,
  /timeout/i,
];

const NON_CAPACITY_CODES = new Set([
  '429', // Too many requests
  '401', // Unauthorized
  '403', // Forbidden
  '42501', // insufficient_privilege
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '23502', // not_null_violation
  '23514', // check_violation
  '22P02', // invalid_text_representation
]);

export interface ErrorLike {
  name?: string;
  code?: string | number;
  status?: number;
  statusCode?: number;
  message?: string;
  details?: string;
  hint?: string;
  error?: unknown;
}

/**
 * Checks whether an error represents a database storage or capacity limit failure.
 * Distinguishes capacity errors from network, rate limit, permission, or constraint issues.
 */
export function isDatabaseCapacityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    if (typeof error === 'string') {
      const isNegative = NON_CAPACITY_PATTERNS.some((pat) => pat.test(error));
      if (isNegative) return false;
      return CAPACITY_MESSAGE_PATTERNS.some((pat) => pat.test(error));
    }
    return false;
  }

  const err = error as ErrorLike;

  // Explicit capacity error instance
  if (err.name === 'DatabaseCapacityError') {
    return true;
  }

  // Check code/status against non-capacity guard
  const codeStr = err.code != null ? String(err.code) : '';
  const statusStr = err.status != null ? String(err.status) : err.statusCode != null ? String(err.statusCode) : '';

  if (NON_CAPACITY_CODES.has(codeStr) || NON_CAPACITY_CODES.has(statusStr)) {
    return false;
  }

  // HTTP 507 Insufficient Storage
  if (err.status === 507 || err.statusCode === 507) {
    return true;
  }

  // Postgres capacity codes
  if (CAPACITY_POSTGRES_CODES.has(codeStr)) {
    return true;
  }

  // Inspect strings: message, details, hint
  const combinedText = [
    err.message || '',
    err.details || '',
    err.hint || '',
    typeof err.error === 'string' ? err.error : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!combinedText) {
    return false;
  }

  // Reject if it matches negative patterns (rate limit, constraints, permission, etc.)
  const isNegative = NON_CAPACITY_PATTERNS.some((pat) => pat.test(combinedText));
  if (isNegative) {
    return false;
  }

  return CAPACITY_MESSAGE_PATTERNS.some((pat) => pat.test(combinedText));
}

/**
 * Custom error class specifically representing database storage capacity limit errors.
 */
export class DatabaseCapacityError extends Error {
  public readonly code: string;
  public readonly isCapacityError = true;

  constructor(message: string = DATABASE_STORAGE_FULL_MESSAGE, code = '53100') {
    super(message);
    this.name = 'DatabaseCapacityError';
    this.code = code;
    Object.setPrototypeOf(this, DatabaseCapacityError.prototype);
  }
}

export interface DatabaseStorageHealth {
  verified: boolean;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  usedBytes?: number;
  totalBytes?: number;
  usagePercentage?: number;
  warningThresholdPercentage?: number;
  criticalThresholdPercentage?: number;
  message?: string;
  timestamp: string;
}

/**
 * Evaluates verified storage metrics.
 * Triggers a warning at 80% capacity and a critical alert at 95% capacity.
 * Never invents values.
 */
export function evaluateStorageHealth(usedBytes: number, totalBytes: number): DatabaseStorageHealth {
  if (typeof usedBytes !== 'number' || typeof totalBytes !== 'number' || totalBytes <= 0 || usedBytes < 0) {
    return {
      verified: false,
      status: 'unknown',
      message: 'Verified storage metrics unavailable.',
      timestamp: new Date().toISOString(),
    };
  }

  const usagePercentage = Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10);
  let status: DatabaseStorageHealth['status'] = 'healthy';
  let message = 'Database storage is within normal operating limits.';

  if (usagePercentage >= 95) {
    status = 'critical';
    message = `Critical: Database storage has reached ${usagePercentage}%. Immediate action required to prevent service disruption.`;
  } else if (usagePercentage >= 80) {
    status = 'warning';
    message = `Warning: Database storage usage is at ${usagePercentage}%. Consider upgrading plan or archiving old data.`;
  }

  return {
    verified: true,
    status,
    usedBytes,
    totalBytes,
    usagePercentage,
    warningThresholdPercentage: 80,
    criticalThresholdPercentage: 95,
    message,
    timestamp: new Date().toISOString(),
  };
}

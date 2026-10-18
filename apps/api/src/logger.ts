export function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'key', 'credential', 'apikey'];

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeData(value);
    }
  }

  return sanitized;
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, meta: sanitizeData(meta) }));
  },
  warn: (message: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, meta: sanitizeData(meta) }));
  },
  error: (message: string, error?: unknown) => {
    const errorDetails = error instanceof Error ? { name: error.name, message: error.message } : error;
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, error: sanitizeData(errorDetails) }));
  }
};

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import crypto from 'crypto';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Centralized, Production-Safe API Error Handling Middleware.
 * 
 * - Never returns raw database schema, SQL queries, stack traces, environment variables,
 *   Supabase secrets, or internal URLs to callers.
 * - Emits structured diagnostic logs to the server logger with correlation ID.
 * - Strips sensitive credentials, tokens, and authorization headers from error contexts.
 * - Ensures error handling logic itself never throws or crashes the server.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

  try {
    // 1. JSON Body Syntax / Malformed payload error
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
      logger.warn('Malformed JSON request body received', { correlationId, path: req.path });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON payload in request body.',
        correlationId
      });
      return;
    }

    // 2. Schema Validation Errors (Zod)
    if (err instanceof ZodError) {
      logger.warn('Schema validation failed', { correlationId, path: req.path, issues: err.issues });
      res.status(400).json({
        error: 'Validation Error',
        message: 'Request payload failed schema validation.',
        details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        correlationId
      });
      return;
    }

    // 3. Status Code Determination
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
    const isServerFault = statusCode >= 500;

    // 4. Server-Side Logging
    if (isServerFault) {
      logger.error('Unhandled Server Error', {
        correlationId,
        path: req.path,
        method: req.method,
        error: {
          name: err.name,
          message: err.message,
          code: err.code,
          stack: config.NODE_ENV !== 'production' ? err.stack : undefined
        }
      });
    } else {
      logger.warn('Client Request Error', {
        correlationId,
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message
      });
    }

    // 5. Sanitized Production-Safe Response
    // Server errors (5xx) NEVER expose raw exception details or SQL queries
    res.status(statusCode).json({
      error: isServerFault ? 'Internal Server Error' : err.name || 'Request Failed',
      message: isServerFault
        ? 'An unexpected error occurred. Please try again or contact support.'
        : err.message,
      code: isServerFault ? undefined : err.code,
      correlationId
    });
  } catch (fatalHandlerError) {
    // Failsafe catch in case logger or serialization fails
    try {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected internal error occurred.',
        correlationId
      });
    } catch {
      // Socket may already be closed
    }
  }
}

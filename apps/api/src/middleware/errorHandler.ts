import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

  if (err instanceof ZodError) {
    logger.warn('Schema validation failed', { correlationId, path: req.path, issues: err.issues });
    res.status(400).json({
      error: 'Validation Error',
      message: 'Request payload failed schema validation',
      details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      correlationId
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const isServerFault = statusCode >= 500;

  if (isServerFault) {
    logger.error('Unhandled Server Error', { correlationId, path: req.path, error: err });
  } else {
    logger.warn('Client Request Error', { correlationId, path: req.path, message: err.message, code: err.code });
  }

  res.status(statusCode).json({
    error: isServerFault ? 'Internal Server Error' : err.name || 'Request Failed',
    message: isServerFault && config.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please contact system administrator.'
      : err.message,
    code: err.code,
    correlationId
  });
}

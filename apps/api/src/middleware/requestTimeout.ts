import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';

declare global {
  namespace Express {
    interface Request {
      isAborted?: boolean;
    }
  }
}

/**
 * Centralized Request Timeout & Abandoned Request Protection Middleware.
 * 
 * - Prevents hung database operations or long-running computations from blocking Node event loops.
 * - Detects client disconnects early and marks `req.isAborted = true` to allow downstream
 *   handlers to skip redundant work.
 * - Enforces safe HTTP 504 Gateway Timeout responses if timeout threshold is exceeded.
 */
export function requestTimeout(timeoutMs = config.REQUEST_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip timeout tracking in unit test suite unless explicitly configured
    if (config.NODE_ENV === 'test' && !process.env.TEST_ENABLE_TIMEOUT) {
      return next();
    }

    let isFinished = false;

    // 1. Detect premature client disconnects (abandoned requests)
    req.on('close', () => {
      if (!res.writableEnded && !res.headersSent) {
        req.isAborted = true;
        logger.warn('Client connection closed prematurely before request completion', {
          method: req.method,
          path: req.path,
          correlationId: req.headers['x-correlation-id']
        });
      }
    });

    // 2. Set processing deadline timer
    const timer = setTimeout(() => {
      if (!isFinished && !res.headersSent) {
        isFinished = true;
        const correlationId = (req.headers['x-correlation-id'] as string);
        logger.error('Request processing exceeded allowable timeout window', {
          method: req.method,
          path: req.path,
          timeoutMs,
          correlationId
        });

        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'The server timed out while processing your request. Please try again.',
          correlationId
        });
      }
    }, timeoutMs);

    // Unref timer so it does not block Node process termination during shutdown
    if (timer.unref) {
      timer.unref();
    }

    const cleanup = () => {
      isFinished = true;
      clearTimeout(timer);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
}

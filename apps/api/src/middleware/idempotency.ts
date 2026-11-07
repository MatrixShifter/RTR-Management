import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { logger, logSecurityEvent } from '../logger.js';

interface CachedIdempotencyResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

// In-memory LRU-style sliding cache for sub-millisecond duplicate suppression
const memoryCache = new Map<string, CachedIdempotencyResponse>();
const IN_MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hour in memory

// Periodic cleanup of expired in-memory idempotency records every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryCache.entries()) {
    if (now - record.timestamp > IN_MEMORY_TTL_MS) {
      memoryCache.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

/**
 * Enterprise Idempotency Middleware.
 * 
 * Protects financial settlements, record deliveries, and status toggles against
 * duplicate processing caused by network retries, browser double-clicks, or mobile timeouts.
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only apply to state-modifying HTTP methods
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }

  const idempotencyKey = rawKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Idempotency-Key header must be between 8 and 255 characters.'
    });
    return;
  }

  const correlationId = (req.headers['x-correlation-id'] as string);

  // 1. Fast-Path Check in Local In-Memory Cache
  const memoryHit = memoryCache.get(idempotencyKey);
  if (memoryHit) {
    logSecurityEvent({
      action: 'IDEMPOTENCY_REPLAY_SERVED',
      category: 'record_mutation',
      status: 'SUCCESS',
      statusCode: memoryHit.statusCode,
      correlationId,
      details: { key: idempotencyKey, source: 'memory_cache' }
    });

    res.setHeader('x-idempotency-replayed', 'true');
    res.status(memoryHit.statusCode).json(memoryHit.body);
    return;
  }

  // 2. Persistent Database Check via Supabase Admin
  (async () => {
    try {
      const { data: existingRecord } = await supabaseAdmin
        .from('idempotency_keys')
        .select('status_code, response_body, expires_at')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (existingRecord && new Date(existingRecord.expires_at) > new Date()) {
        const cachedStatusCode = existingRecord.status_code || 200;
        const cachedBody = existingRecord.response_body;

        // Populate memory cache for future rapid replays
        memoryCache.set(idempotencyKey, {
          statusCode: cachedStatusCode,
          body: cachedBody,
          timestamp: Date.now()
        });

        logSecurityEvent({
          action: 'IDEMPOTENCY_REPLAY_SERVED',
          category: 'record_mutation',
          status: 'SUCCESS',
          statusCode: cachedStatusCode,
          correlationId,
          details: { key: idempotencyKey, source: 'database' }
        });

        res.setHeader('x-idempotency-replayed', 'true');
        res.status(cachedStatusCode).json(cachedBody);
        return;
      }
    } catch (lookupErr) {
      // Non-fatal: if DB table not yet present or temporary error, proceed with execution
      logger.warn('Idempotency persistence lookup skipped', { error: String(lookupErr) });
    }

    // 3. Intercept and Cache the Final Response on Successful Mutation
    const originalJson = res.json.bind(res);
    res.json = function (body: any): Response {
      // Restore original method
      res.json = originalJson;

      // Only cache successful or client validation responses (2xx, 4xx) - never server faults (5xx)
      if (res.statusCode < 500) {
        memoryCache.set(idempotencyKey, {
          statusCode: res.statusCode,
          body,
          timestamp: Date.now()
        });

        // Asynchronously persist to Supabase idempotency_keys table
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        const user = req.user;

        Promise.resolve(supabaseAdmin.from('idempotency_keys').upsert({
          key: idempotencyKey,
          business_id: user?.businessId || undefined,
          user_id: user?.id && !user.isDemo ? user.id : undefined,
          endpoint: `${req.method} ${req.baseUrl || ''}${req.path || ''}`.slice(0, 255),
          status_code: res.statusCode,
          response_body: body,
          expires_at: expiresAt
        })).then((res: any) => {
          if (res?.error) {
            logger.warn('Failed to persist idempotency key to database:', res.error);
          }
        }).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  })().catch(next);
}

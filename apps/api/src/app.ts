import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import { config } from './config.js';
import { standardRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { recordsRouter } from './routes/records.js';
import { shopsRouter } from './routes/shops.js';
import { productsRouter } from './routes/products.js';
import { type HealthResponse, type DatabaseStorageHealth, evaluateStorageHealth } from '@crimpston/shared';

export const app = express();

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", config.CORS_ORIGIN, config.SUPABASE_URL]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// CORS Configuration (Strict Allowed Origins)
app.use(cors({
  origin: (origin, callback) => {
    // Same-origin, mobile apps, or curl (no origin header)
    if (!origin) return callback(null, true);
    // Allow explicitly configured origin, Vercel deployments, or localhost
    if (
      origin === config.CORS_ORIGIN ||
      origin.endsWith('.vercel.app') ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'idempotency-key'],
  credentials: true
}));

// Correlation ID & Request Logging
app.use((req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  req.headers['x-correlation-id'] = correlationId;
  next();
});

// Production-Safe HTTP Access Logging:
// - Sanitizes query parameters containing sensitive tokens or credentials
// - Omits authorization headers, cookies, request bodies, and personal identifiers
// - Suppresses repetitive routine polls (GET /api/auth/verify-session) when successful
if (config.NODE_ENV !== 'test') {
  morgan.token('clean-url', (req: express.Request) => {
    const rawUrl = req.originalUrl || req.url || '';
    try {
      const parsed = new URL(rawUrl, 'http://localhost');
      if (parsed.search) {
        const params = new URLSearchParams(parsed.search);
        for (const key of params.keys()) {
          if (/token|key|secret|code|password|auth|jwt/i.test(key)) {
            params.set(key, '[REDACTED]');
          }
        }
        return `${parsed.pathname}?${params.toString()}`;
      }
      return parsed.pathname;
    } catch {
      return rawUrl.split('?')[0];
    }
  });

  app.use(
    morgan(':method :clean-url :status :res[content-length] - :response-time ms', {
      skip: (req, res) => {
        const url = req.originalUrl || req.url || '';
        // Skip routine successful session verification polls to avoid terminal clutter
        if ((url.startsWith('/api/auth/verify-session') || url.startsWith('/api/health')) && res.statusCode < 400) {
          return true;
        }
        return false;
      }
    })
  );
}

// Request parsers & rate limiting (100kb limit)
app.use(express.json({ limit: '100kb' }));
app.use(standardRateLimiter);

// Health Endpoint (Does not leak secrets or internal DB credentials)
app.get(['/api/health', '/health'], (_req, res) => {
  const health: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    version: '1.0.0'
  };
  res.status(200).json(health);
});

// Database Storage Health Endpoint (secure server-side telemetry)
// Does NOT leak service role keys, secrets, or internal DB credentials.
// Adheres strictly to safety policy: Never invent storage usage values.
app.get('/api/database/storage-health', (_req, res) => {
  const quotaBytes = process.env.DATABASE_STORAGE_QUOTA_BYTES ? parseInt(process.env.DATABASE_STORAGE_QUOTA_BYTES, 10) : undefined;
  const usedBytes = process.env.DATABASE_STORAGE_USED_BYTES ? parseInt(process.env.DATABASE_STORAGE_USED_BYTES, 10) : undefined;

  if (typeof quotaBytes === 'number' && typeof usedBytes === 'number' && !isNaN(quotaBytes) && !isNaN(usedBytes) && quotaBytes > 0) {
    const health = evaluateStorageHealth(usedBytes, quotaBytes);
    return res.status(200).json(health);
  }

  const unverified: DatabaseStorageHealth = {
    verified: false,
    status: 'healthy',
    message: 'Storage quota telemetry is unverified or managed at infrastructure level.',
    timestamp: new Date().toISOString()
  };
  return res.status(200).json(unverified);
});

// Authentication routes
app.use(['/api/auth', '/auth'], authRouter);

// Business Records routes (Protected Business Owner Ledger)
app.use(['/api/records', '/records'], recordsRouter);

// Catalog routes (Shops & Products management)
app.use(['/api/shops', '/shops'], shopsRouter);
app.use(['/api/products', '/products'], productsRouter);

// Centralized error handling
app.use(errorHandler);

export default app;

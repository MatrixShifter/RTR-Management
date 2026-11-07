import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const isTestEnv = process.env.NODE_ENV === 'test';

const createRateLimitHandler = (defaultMessage: string, windowSeconds = 900) => (_req: any, res: any) => {
  res.setHeader('Retry-After', String(windowSeconds));
  return res.status(429).json({
    error: 'Too Many Requests',
    message: defaultMessage,
    retryAfterSeconds: windowSeconds
  });
};

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config?.RATE_LIMIT_STANDARD_MAX ?? 300, // Configurable per-IP window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: createRateLimitHandler('Too many requests from this IP address, please try again after 15 minutes.')
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config?.RATE_LIMIT_AUTH_MAX ?? 30, // Stricter limit for login/auth operations
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: createRateLimitHandler('Too many authentication attempts, please try again later.')
});

export const passwordRecoveryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Strict limit on password recovery attempts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: createRateLimitHandler('Too many password reset requests. Please wait 15 minutes before trying again.')
});

export const businessMutationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config?.RATE_LIMIT_MUTATION_MAX ?? 60, // Limit record creation and updates
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: createRateLimitHandler('Too many record mutation requests. Please try again shortly.')
});

export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config?.RATE_LIMIT_PAYMENT_MAX ?? 30, // Strict rate limit on financial payment settlements
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: createRateLimitHandler('Too many payment settlement requests. Please try again shortly.')
});

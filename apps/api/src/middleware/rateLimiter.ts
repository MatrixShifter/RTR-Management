import rateLimit from 'express-rate-limit';

const isTestEnv = process.env.NODE_ENV === 'test';

export const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP address, please try again after 15 minutes.'
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Stricter limit for login/auth operations
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts, please try again later.'
  }
});

export const passwordRecoveryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Strict limit on password recovery attempts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: {
    error: 'Too Many Requests',
    message: 'Too many password reset requests. Please wait 15 minutes before trying again.'
  }
});

export const businessMutationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // Limit record creation and updates
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: {
    error: 'Too Many Requests',
    message: 'Too many record creation requests. Please try again shortly.'
  }
});

export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Strict rate limit on financial payment settlements
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: {
    error: 'Too Many Requests',
    message: 'Too many payment settlement requests. Please try again shortly.'
  }
});

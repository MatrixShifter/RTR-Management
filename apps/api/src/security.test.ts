import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { supabaseAdmin } from './routes/auth.js';

describe('Production Security Hardening Suite', () => {
  describe('Authentication & Role Authorization Middleware', () => {
    it('returns 401 Unauthorized when accessing protected records endpoint without token', async () => {
      const res = await request(app).get('/api/records');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Authentication token required');
    });

    it('returns 401 Unauthorized when accessing with malformed or fake Bearer token', async () => {
      const res = await request(app)
        .get('/api/records')
        .set('Authorization', 'Bearer invalid-token-12345');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('strictly forbids demo token from mutating production business records (403 Forbidden)', async () => {
      const demoToken = 'demo-session-1234567890-test';
      const payload = {
        date: '2026-10-24',
        shopName: 'Test Partner Shop',
        productName: 'Screen Protector',
        quantity: 10,
        unitPrice: 150,
        deliveryStatus: 'delivered',
        pendingAmount: 0
      };

      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${demoToken}`)
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.message).toContain('Demo sessions cannot modify production business data');
    });
  });

  describe('Strict Payload & Financial Input Validation', () => {
    const demoToken = 'demo-session-read-only-test';

    it('rejects record creation with zero or negative quantity (400 Bad Request)', async () => {
      // Mock authenticated session by testing validator directly on records route or mock user
      const invalidPayload = {
        date: '2026-10-24',
        shopName: 'Test Shop',
        productName: 'USB-C Cable',
        quantity: -5, // Negative quantity forbidden
        unitPrice: 100,
        deliveryStatus: 'delivered',
        pendingAmount: 0
      };

      // Direct validation check against the shared schema
      const { SaveBusinessRecordSchema } = await import('@crimpston/shared');
      const result = SaveBusinessRecordSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.quantity).toBeDefined();
      }
    });

    it('rejects record creation with negative unit price or negative pending amount', async () => {
      const invalidPayload = {
        date: '2026-10-24',
        shopName: 'Test Shop',
        productName: 'USB-C Cable',
        quantity: 10,
        unitPrice: -50, // Negative price forbidden
        deliveryStatus: 'delivered',
        pendingAmount: -100 // Negative pending amount forbidden
      };

      const { SaveBusinessRecordSchema } = await import('@crimpston/shared');
      const result = SaveBusinessRecordSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.unitPrice).toBeDefined();
        expect(result.error.flatten().fieldErrors.pendingAmount).toBeDefined();
      }
    });

    it('rejects payment settlement with negative or zero amount', async () => {
      const invalidSettlement = {
        deliveryId: 'valid-delivery-id',
        amountToPay: -200
      };

      const { SettlePaymentSchema } = await import('@crimpston/shared');
      const result = SettlePaymentSchema.safeParse(invalidSettlement);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.amountToPay).toBeDefined();
      }
    });
  });

  describe('Security Headers & CORS Hardening', () => {
    it('sets Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options: DENY, and CSP', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('allows CORS from authorized localhost and Vercel domains', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('blocks CORS requests from untrusted origins', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker.com');

      // Supertest receives error from cors middleware when origin rejected
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Sensitive Data Redaction in Audit Logging', () => {
    it('redacts sensitive fields (passwords, tokens, keys) from log outputs', async () => {
      const { sanitizeData } = await import('./logger.js');
      const rawLog = {
        username: 'owner',
        password: 'my-super-secret-password',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        apiKey: 'sk-secret-key-12345',
        details: {
          authorization: 'Bearer secret-token',
          safeField: 'normal value'
        }
      };

      const sanitized: any = sanitizeData(rawLog);
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.details.authorization).toBe('[REDACTED]');
      expect(sanitized.details.safeField).toBe('normal value');
      expect(sanitized.username).toBe('owner');
    });
  });

  describe('Secure API Error Responses & Sanitization', () => {
    it('returns 400 Bad Request on malformed JSON payload without stack trace', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"username": invalid json');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Invalid JSON payload');
      expect(res.body.correlationId).toBeDefined();
      expect(res.body.stack).toBeUndefined();
    });

    it('sanitizes server errors and attaches non-sensitive correlationId', async () => {
      const { errorHandler } = await import('./middleware/errorHandler.js');
      const req: any = { headers: {}, path: '/api/test', method: 'GET' };
      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (s: number) => { responseStatus = s; return res; },
        json: (b: any) => { responseBody = b; return res; }
      };

      const serverError: any = new Error('FATAL: pg_hba.conf rejects connection for user "postgres"');
      serverError.statusCode = 500;

      errorHandler(serverError, req, res, () => {});

      expect(responseStatus).toBe(500);
      expect(responseBody.error).toBe('Internal Server Error');
      expect(responseBody.correlationId).toBeDefined();
      expect(responseBody.stack).toBeUndefined();
      // Verifies database internals are not leaked in the HTTP response
      expect(JSON.stringify(responseBody)).not.toContain('pg_hba.conf');
      expect(JSON.stringify(responseBody)).not.toContain('postgres');
    });
  });

  describe('Comprehensive Log Sanitization & Security Event Auditing', () => {
    it('ensures successful login logs contain no email, actor ID, token, or password', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'demo-owner', password: 'Configure-a-unique-demo-password' });

        expect(res.status).toBe(200);
        const loggedText = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
        
        // Assert absence of sensitive parameters
        expect(loggedText).not.toContain('Configure-a-unique-demo-password');
        expect(loggedText).not.toContain('demo-owner@rtrmobiles.com');
        expect(loggedText).not.toContain('deae5634-055a-4045-a6ac-fc00ed9e247a');
        expect(loggedText).not.toContain('access_token');

        // Assert presence of safe operational tracking
        expect(loggedText).toContain('"category":"auth_login"');
        expect(loggedText).toContain('"status":"SUCCESS"');
        expect(loggedText).toContain('"statusCode":200');
        expect(loggedText).toContain('correlationId');
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('ensures failed login logs do not contain the submitted email or password', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const secretCandidatePass = 'UnleakedAttemptPassword99!';
        const victimEmail = 'target_user_probe@rtrmobiles.com';
        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: victimEmail, password: secretCandidatePass });

        expect(res.status).toBe(401);
        const loggedText = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');

        // Plain text identifier and password MUST NOT be exposed in logs
        expect(loggedText).not.toContain(victimEmail);
        expect(loggedText).not.toContain(secretCandidatePass);

        // Safe operational audit event should exist
        expect(loggedText).toContain('"status":"FAILURE"');
        expect(loggedText).toContain('"category":"auth_login"');
        expect(loggedText).toContain('"statusCode":401');
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('ensures session-verification logs do not expose session tokens', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const sensitiveToken = 'sensitive-jwt-token-probe-xyz12345';
        const res = await request(app)
          .get('/api/auth/verify-session')
          .set('Authorization', `Bearer ${sensitiveToken}`);

        expect(res.status).toBe(401);
        const allLogs = [
          ...consoleLogSpy.mock.calls.map(c => c.join(' ')),
          ...consoleWarnSpy.mock.calls.map(c => c.join(' '))
        ].join('\n');

        expect(allLogs).not.toContain(sensitiveToken);
      } finally {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      }
    });

    it('ensures password recovery logs do not expose reset links or recovery tokens', async () => {
      const resetSpy = vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: null,
        error: null
      } as any);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const res = await request(app)
          .post('/api/auth/forgot-password')
          .send({ identifier: 'owner' });

        expect(res.status).toBe(200);
        const allLogs = [
          ...consoleLogSpy.mock.calls.map(c => c.join(' ')),
          ...consoleInfoSpy.mock.calls.map(c => c.join(' ')),
          ...consoleWarnSpy.mock.calls.map(c => c.join(' '))
        ].join('\n');

        expect(allLogs).not.toContain('token=');
        expect(allLogs).not.toContain('action_link');
        expect(allLogs).not.toContain('owner@rtrmobiles.com');
      } finally {
        resetSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      }
    }, 15000);

    it('ensures logSecurityEvent preserves correlationId, category, and safe targetId without actorId or ip', async () => {
      const { logSecurityEvent } = await import('./logger.js');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        logSecurityEvent({
          action: 'SETTLE_PAYMENT',
          category: 'record_mutation',
          status: 'SUCCESS',
          statusCode: 200,
          correlationId: 'test-correlation-uuid-999',
          targetId: 'delivery-uuid-456',
          actorId: 'sensitive-actor-id',
          ip: '192.168.1.150',
          details: {
            amountToPay: 500,
            userEmail: 'sensitive_customer@example.com'
          }
        });

        expect(consoleSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.event.category).toBe('record_mutation');
        expect(output.event.status).toBe('SUCCESS');
        expect(output.event.statusCode).toBe(200);
        expect(output.event.correlationId).toBe('test-correlation-uuid-999');
        expect(output.event.targetId).toBe('delivery-uuid-456');

        // Strictly verify actorId, ip, and userEmail are omitted
        expect(output.event.actorId).toBeUndefined();
        expect(output.event.ip).toBeUndefined();
        expect(output.event.details?.userEmail).toBeUndefined();
        expect(output.event.details?.amountToPay).toBe(500);
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});

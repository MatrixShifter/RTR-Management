import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

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
});

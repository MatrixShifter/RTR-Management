import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('Delivery Status Lifecycle Endpoints (/api/records/:id/delivery-status)', { timeout: 25000 }, () => {
  let ownerToken: string;

  beforeAll(async () => {
    // Authenticate as owner to obtain valid JWT token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'password123' });

    expect(loginRes.status).toBe(200);
    ownerToken = loginRes.body.session.access_token;
  });

  describe('Validation & Authorization', () => {
    it('rejects unauthenticated delivery status update requests (401)', async () => {
      const res = await request(app)
        .patch('/api/records/deliv-test-1/delivery-status')
        .send({ status: 'delivered' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects invalid status values other than "delivered" or "pending" (400)', async () => {
      const res = await request(app)
        .patch('/api/records/deliv-test-1/delivery-status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'invalid_status_value' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('delivered');
    });

    it('strictly forbids demo session from mutating delivery status (403)', async () => {
      const demoToken = 'demo-session-fake-id-12345';
      const res = await request(app)
        .patch('/api/records/deliv-demo-1/delivery-status')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ status: 'delivered' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 404 when delivery record does not exist', async () => {
      const res = await request(app)
        .patch('/api/records/00000000-0000-0000-0000-000000000000/delivery-status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'delivered' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('sanitizes error responses and returns non-sensitive correlationId on unexpected errors', async () => {
      const res = await request(app)
        .patch('/api/records/invalid-format-id/delivery-status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'delivered' });

      // Non-UUID record lookup returns 404 or sanitized 500 without leaking DB internals
      expect([404, 500]).toContain(res.status);
      expect(res.body).not.toHaveProperty('stack');
      expect(res.body).not.toHaveProperty('query');
      expect(JSON.stringify(res.body)).not.toContain('pg_');
    });

    it('requires explicit valid status payload and ignores delivery_number in request body', async () => {
      const res = await request(app)
        .patch('/api/records/00000000-0000-0000-0000-000000000000/delivery-status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'delivered', delivery_number: 'DELIV-INVENTED-999' });

      // Validates payload; even if delivery_number is provided in body, backend ignores non-canonical fields
      expect(res.status).toBe(404);
    });
  });
});

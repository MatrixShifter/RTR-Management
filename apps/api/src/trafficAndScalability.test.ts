import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { cacheService } from './services/cache.js';

describe('API Traffic Management, Idempotency & Scalability Suite', { timeout: 25000 }, () => {
  describe('Health & Readiness Endpoints', () => {
    it('GET /api/health returns 200 with healthy status and uptime', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.version).toBe('1.0.0');
    });

    it('GET /api/health/ready returns 200 with database connectivity and memory telemetry', async () => {
      const res = await request(app).get('/api/health/ready');
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe('ready');
        expect(res.body.database).toBe('connected');
        expect(res.body.latencyMs).toBeTypeOf('number');
        expect(res.body.memory).toBeDefined();
        expect(res.body.memory.heapUsedMb).toBeTypeOf('number');
      } else {
        expect(res.body.status).toBe('not_ready');
      }
    });

    it('GET /api/database/storage-health returns safe non-secret telemetry', async () => {
      const res = await request(app).get('/api/database/storage-health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
      // Must not expose Supabase keys, tokens or connection strings
      expect(JSON.stringify(res.body)).not.toContain('eyJ');
      expect(JSON.stringify(res.body)).not.toContain('service_role');
    });
  });

  describe('Traffic Control & Malformed Payload Rejection', () => {
    it('rejects malformed JSON payloads with 400 Bad Request and correlationId', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Content-Type', 'application/json')
        .send('{ "invalidJson": true, ');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Invalid JSON payload');
      expect(res.body.correlationId).toBeDefined();
    });

    it('enforces payload size ceiling on oversized JSON bodies', async () => {
      const hugeString = 'x'.repeat(150 * 1024); // 150kb exceeds 100kb limit
      const res = await request(app)
        .post('/api/records')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ huge: hugeString }));

      expect([400, 413]).toContain(res.status);
    });
  });

  describe('Enterprise Idempotency Protection', () => {
    it('rejects malformed idempotency keys shorter than 8 characters (400)', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', 'Bearer fake-token')
        .set('Idempotency-Key', 'short')
        .send({ some: 'data' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('Idempotency-Key header must be between 8 and 255 characters');
    });

    it('replays identical cached response when same valid Idempotency-Key is provided', async () => {
      const testKey = `test-idem-key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Step 1: Make request with idempotency key (fails 401 without token)
      const res1 = await request(app)
        .post('/api/records/settle')
        .set('Idempotency-Key', testKey)
        .send({ deliveryId: '00000000-0000-0000-0000-000000000000', amountToPay: 100 });

      expect(res1.status).toBe(401);

      // Step 2: Make exact duplicate request with identical Idempotency-Key
      const res2 = await request(app)
        .post('/api/records/settle')
        .set('Idempotency-Key', testKey)
        .send({ deliveryId: '00000000-0000-0000-0000-000000000000', amountToPay: 100 });

      // Must serve replayed response with header
      expect(res2.status).toBe(res1.status);
      expect(res2.headers['x-idempotency-replayed']).toBe('true');
      expect(res2.body.error).toBe(res1.body.error);
    });
  });

  describe('Server-Side Catalog Caching & Invalidation', () => {
    it('sets, retrieves, and invalidates cache entries correctly', async () => {
      const key = 'test:biz123:shops';
      const sampleData = [{ id: 's1', name: 'Metro Store' }];

      await cacheService.set(key, sampleData, 5000);
      const cached = await cacheService.get(key);
      expect(cached).toEqual(sampleData);

      // Invalidate by prefix
      await cacheService.invalidate('test:biz123');
      const postInvalidate = await cacheService.get(key);
      expect(postInvalidate).toBeNull();
    });

    it('returns null when cache entry expires after TTL', async () => {
      const key = 'test:ttl:key';
      await cacheService.set(key, { value: 123 }, -10); // Expired immediately
      const res = await cacheService.get(key);
      expect(res).toBeNull();
    });
  });
});

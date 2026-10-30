import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('Catalog Management API Endpoints (/api/shops & /api/products)', { timeout: 25000 }, () => {
  let ownerToken: string;

  beforeAll(async () => {
    // Authenticate as owner to obtain valid JWT token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'password123' });

    expect(loginRes.status).toBe(200);
    ownerToken = loginRes.body.session.access_token;
  }, 35000);

  describe('Authorization Guards', () => {
    it('blocks unauthenticated requests to delete a shop (401)', async () => {
      const res = await request(app).delete('/api/shops/some-shop-id');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('blocks unauthenticated requests to delete a product (401)', async () => {
      const res = await request(app).delete('/api/products/some-product-id');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('strictly forbids demo sessions from deleting production shops (403)', async () => {
      const demoToken = 'demo-session-fake-id-12345';
      const res = await request(app)
        .delete('/api/shops/some-shop-id')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('strictly forbids demo sessions from deleting production products (403)', async () => {
      const demoToken = 'demo-session-fake-id-12345';
      const res = await request(app)
        .delete('/api/products/some-product-id')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Shop Usage & Management', () => {
    it('returns shop usage details for authenticated owner', async () => {
      const res = await request(app)
        .get('/api/shops/00000000-0000-0000-0000-000000000000/usage')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inUse');
      expect(res.body).toHaveProperty('count');
    });

    it('handles non-existent shop deletion gracefully (404)', async () => {
      const res = await request(app)
        .delete('/api/shops/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('Product Usage & Management', () => {
    it('returns product usage details for authenticated owner', async () => {
      const res = await request(app)
        .get('/api/products/00000000-0000-0000-0000-000000000000/usage')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inUse');
      expect(res.body).toHaveProperty('count');
    });

    it('handles non-existent product deletion gracefully (404)', async () => {
      const res = await request(app)
        .delete('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('Record Deletion & Authorization (/api/records/:id)', () => {
    it('blocks unauthenticated record deletion requests (401)', async () => {
      const res = await request(app).delete('/api/records/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 404 for non-existent delivery record deletion', async () => {
      const res = await request(app)
        .delete('/api/records/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});

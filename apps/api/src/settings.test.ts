import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('Business Settings & Usage API Endpoints (/api/settings & /api/shops/:id/usage)', { timeout: 35000 }, () => {
  let ownerToken: string;

  beforeAll(async () => {
    // Authenticate as owner to obtain valid JWT token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'password123' });

    expect(loginRes.status).toBe(200);
    ownerToken = loginRes.body.session.access_token;
  }, 35000);

  describe('Authorization & Access Controls on /api/settings', () => {
    it('blocks unauthenticated requests to /api/settings with 401', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns business settings for authenticated owner (200)', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('timezone');
      expect(res.body.data).toHaveProperty('reportCutoffTime');
    });

    it('returns isolated sandbox settings for demo account token (200)', async () => {
      const demoToken = 'demo-access-token-987654321';
      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDemo).toBe(true);
      expect(res.body.data.name).toContain('Demo Sandbox');
    });

    it('strictly forbids demo sessions from modifying business settings with 403', async () => {
      const demoToken = 'demo-session-fake-id-12345';
      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ name: 'Hacked Business Name' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Shop Usage with Demo & Owner Tokens', () => {
    it('returns 200 with inUse: false for demo token starting with demo-access-token-', async () => {
      const demoToken = 'demo-access-token-1234567890';
      const res = await request(app)
        .get('/api/shops/00000000-0000-0000-0000-000000000000/usage')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.inUse).toBe(false);
      expect(res.body.count).toBe(0);
    });

    it('blocks unauthenticated access to /api/shops/:id/usage with 401', async () => {
      const res = await request(app).get('/api/shops/00000000-0000-0000-0000-000000000000/usage');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });
});

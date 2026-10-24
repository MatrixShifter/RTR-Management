import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { INCORRECT_CREDENTIALS_MSG, RECOVERY_CONFIRMATION_MSG } from './routes/auth.js';

describe('Authentication API Endpoints (/api/auth)', { timeout: 25000 }, () => {
  describe('POST /api/auth/login', () => {
    it('returns exact error message on invalid password without exposing details', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'wrongpassword999' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });

    it('returns exact error message for unknown username without revealing non-existence', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'completely_unknown_user_9999', password: 'somepassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });

    it('rejects empty or missing credentials with exact standard message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });

    it('authenticates valid owner account using username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.access_token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.email).toBe('owner@rtrmobiles.com');
    });

    it('authenticates valid owner account using email address', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner@rtrmobiles.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('owner');
    });

    it('strictly denies non-owner / employee accounts from logging in', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'staff@rtrmobiles.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access restricted to Business Owner only.');
    });

    it('authenticates valid demo account with designated demo credentials into isolated sandbox', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'demo-owner', password: 'Configure-a-unique-demo-password' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.access_token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('demo');
      expect(res.body.user.isDemo).toBe(true);
      expect(res.body.user.username).toBe('demo-owner');
    });

    it('rejects demo login when given incorrect demo password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'demo-owner', password: 'wrong-demo-password-999' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns neutral confirmation for valid username without revealing email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'owner' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(RECOVERY_CONFIRMATION_MSG);
      expect(res.body.email).toBeUndefined();
    });

    it('returns identical neutral confirmation for non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'non_existent_user_12345' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(RECOVERY_CONFIRMATION_MSG);
    });

    it('returns identical neutral confirmation for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'unknown@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(RECOVERY_CONFIRMATION_MSG);
    });
  });

  describe('GET /api/auth/verify-session', () => {
    it('rejects unauthenticated requests without authorization header', async () => {
      const res = await request(app).get('/api/auth/verify-session');
      expect(res.status).toBe(401);
      expect(res.body.valid).toBe(false);
    });

    it('rejects requests with invalid or malformed bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-session')
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect(res.status).toBe(401);
      expect(res.body.valid).toBe(false);
    });

    it('validates authentic session token obtained from owner login', async () => {
      // 1. Login to get live session token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'password123' });

      const token = loginRes.body.session.access_token;
      expect(token).toBeDefined();

      // 2. Verify token
      const verifyRes = await request(app)
        .get('/api/auth/verify-session')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.user.role).toBe('owner');
      expect(verifyRes.body.user.email).toBe('owner@rtrmobiles.com');
    });

    it('validates authentic demo session token without Supabase dependency', async () => {
      const demoToken = 'demo-session-test-token-uuid-1234';
      const verifyRes = await request(app)
        .get('/api/auth/verify-session')
        .set('Authorization', `Bearer ${demoToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.user.role).toBe('demo');
      expect(verifyRes.body.user.isDemo).toBe(true);
      expect(verifyRes.body.user.username).toBe('demo-owner');
    });

    it('validates session token obtained from live demo login via Supabase', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'demo-owner', password: 'Configure-a-unique-demo-password' });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.session.access_token;
      expect(token).toBeDefined();

      const verifyRes = await request(app)
        .get('/api/auth/verify-session')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.user.role).toBe('demo');
      expect(verifyRes.body.user.isDemo).toBe(true);
    });
  });
});

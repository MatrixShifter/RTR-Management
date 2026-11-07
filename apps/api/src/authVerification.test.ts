import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { supabaseAdmin, supabaseAnon, RECOVERY_CONFIRMATION_MSG, INCORRECT_CREDENTIALS_MSG } from './routes/auth.js';

describe('Auth Verification & Recovery Suite (Owner & Employee)', { timeout: 25000, hookTimeout: 20000 }, () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('POST /api/auth/forgot-password for Employee & Owner', () => {
    it('sends recovery email for valid active employee username', async () => {
      const resetSpy = vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: {} as any,
        error: null
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'vinoth42007' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(RECOVERY_CONFIRMATION_MSG);
      expect(resetSpy).toHaveBeenCalledWith(
        'vinoth42007@gmail.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password')
        })
      );
      resetSpy.mockRestore();
    });

    it('sends recovery email for valid active employee email', async () => {
      const resetSpy = vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: {} as any,
        error: null
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'vinoth42007@gmail.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(resetSpy).toHaveBeenCalledWith('vinoth42007@gmail.com', expect.any(Object));
      resetSpy.mockRestore();
    });

    it('sends recovery email for owner alias', async () => {
      const resetSpy = vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: {} as any,
        error: null
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'owner' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(resetSpy).toHaveBeenCalledWith('rtrmobile92@gmail.com', expect.any(Object));
      resetSpy.mockRestore();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refreshes demo session with rotated tokens', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'demo-refresh-12345-uuid' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.access_token).toMatch(/^demo-session-/);
      expect(res.body.session.refresh_token).toMatch(/^demo-refresh-/);
      expect(res.body.user.role).toBe('demo');
    });

    it('rejects missing refresh token (400)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid or expired refresh token (401)', async () => {
      vi.spyOn(supabaseAnon.auth, 'refreshSession').mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error('Invalid refresh token') as any
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'invalid-refresh-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('successfully refreshes authentic Supabase session token', async () => {
      vi.spyOn(supabaseAnon.auth, 'refreshSession').mockResolvedValueOnce({
        data: {
          user: { id: 'ac088d6d-6aef-40b0-8388-51e5d74063a6', email: 'rtrmobile92@gmail.com', user_metadata: { full_name: 'Business Owner' } } as any,
          session: { access_token: 'new-refreshed-jwt', refresh_token: 'new-rotated-refresh-token', expires_at: 1799999999, expires_in: 3600 } as any
        },
        error: null
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.access_token).toBe('new-refreshed-jwt');
      expect(res.body.session.refresh_token).toBe('new-rotated-refresh-token');
      expect(res.body.user.role).toBe('owner');
    });
  });

  describe('Employee & Owner Login Verification', () => {
    it('authenticates valid employee with assigned shop', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'daf03ad9-77b9-4de4-ab71-0e4b32f48d5b', email: 'vinoth42007@gmail.com', user_metadata: { role: 'employee' } } as any,
          session: { access_token: 'valid-emp-token', refresh_token: 'refresh-token', expires_at: 1799999999, expires_in: 3600 } as any
        },
        error: null
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'vinoth42007', password: 'ValidEmployeePass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('employee');
      expect(res.body.user.assignedShopName).toBe('shop a');
      expect(res.body.session.access_token).toBeDefined();
    });

    it('rejects employee login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'vinoth42007', password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });

    it('authenticates valid owner', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'ac088d6d-6aef-40b0-8388-51e5d74063a6', email: 'rtrmobile92@gmail.com', user_metadata: { role: 'owner', full_name: 'Business Owner' } } as any,
          session: { access_token: 'valid-owner-jwt-token', refresh_token: 'refresh', expires_at: 1799999999, expires_in: 3600 } as any
        },
        error: null
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'ValidOwnerPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('owner');
      expect(res.body.session.access_token).toBeDefined();
    });

    it('rejects owner login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });
  });
});

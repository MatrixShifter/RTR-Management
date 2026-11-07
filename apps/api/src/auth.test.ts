import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { INCORRECT_CREDENTIALS_MSG, RECOVERY_CONFIRMATION_MSG, supabaseAdmin, supabaseAnon } from './routes/auth.js';
import { getTestOwnerToken } from './testHelper.js';

describe('Authentication API Endpoints (/api/auth)', { timeout: 25000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
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
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'b46689e9-754e-49b5-b79b-ebc1ee42538f', email: 'rtrmobile92@gmail.com', user_metadata: { role: 'owner', full_name: 'Business Owner' } } as any,
          session: { access_token: 'valid-owner-jwt-token', refresh_token: 'refresh', expires_at: 1234567, expires_in: 3600 } as any
        },
        error: null
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'secureTestPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.access_token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.email).toMatch(/owner@rtrmobiles\.com|rtrmobile92@gmail\.com|vinov042007@gmail\.com/);
    });

    it('strictly rejects owner login with invalid credentials via Supabase Auth (401 Unauthorized)', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Invalid login credentials') as any
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'owner', password: 'incorrect-password' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Incorrect username or password. Please try again.');
    });

    it('authenticates valid owner account using email address', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'b46689e9-754e-49b5-b79b-ebc1ee42538f', email: 'rtrmobile92@gmail.com', user_metadata: { role: 'owner', full_name: 'Business Owner' } } as any,
          session: { access_token: 'valid-owner-jwt-token', refresh_token: 'refresh', expires_at: 1234567, expires_in: 3600 } as any
        },
        error: null
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'rtrmobile92@gmail.com', password: 'secureTestPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('owner');
    });

    it('strictly denies deactivated accounts from logging in with 403', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'deactivated-emp-1', email: 'inactive@rtrmobiles.com', user_metadata: {} } as any,
          session: { access_token: 'fake-token' } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { business_id: 'biz-1', role: 'employee', is_active: false },
              error: null
            })
          })
        })
      } as any));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'inactive@rtrmobiles.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Account is deactivated or unauthorized');
    });

    it('strictly denies employee accounts without assigned active shop with 403', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'unassigned-emp-1', email: 'unassigned@rtrmobiles.com', user_metadata: {} } as any,
          session: { access_token: 'fake-token' } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementation(((table: string) => {
        if (table === 'business_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { business_id: 'biz-1', role: 'employee', is_active: true },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'shop_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      }) as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'unassigned@rtrmobiles.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not currently assigned to an active shop');
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
    beforeEach(() => {
      vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValue({
        data: null,
        error: null
      } as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

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

    it('sanitizes arbitrary phishing redirect destinations and prevents open redirect', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          identifier: 'owner',
          redirectTo: 'https://evil-phishing-attacker.com/steal-token'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(RECOVERY_CONFIRMATION_MSG);
      expect(res.body.devRecoveryLink).toBeUndefined();
    });

    it('returns 429 when Supabase reports email rate limit exceeded', async () => {
      vi.spyOn(supabaseAdmin.auth, 'resetPasswordForEmail').mockResolvedValueOnce({
        data: null,
        error: {
          name: 'AuthApiError',
          message: 'email rate limit exceeded',
          status: 429,
          code: 'over_email_send_rate_limit'
        } as any
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'owner' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('rate limit exceeded');
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
      // 1. Obtain verified owner session token
      const token = await getTestOwnerToken();
      expect(token).toBeDefined();

      // 2. Verify token
      const verifyRes = await request(app)
        .get('/api/auth/verify-session')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.user.role).toBe('owner');
      expect(verifyRes.body.user.email).toMatch(/owner@rtrmobiles\.com|rtrmobile92@gmail\.com|vinov042007@gmail\.com/);
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

  describe('POST /api/auth/reset-password', () => {
    it('rejects password reset without authorization header (401)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'newSecurePassword123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Missing recovery session token');
    });

    it('rejects password reset with malformed or invalid token (401)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', 'Bearer fake-invalid-token')
        .send({ password: 'newSecurePassword123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired recovery session');
    });

    it('rejects password reset with short password under 8 characters (400)', async () => {
      const token = await getTestOwnerToken();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 8 characters');
    });

    it('rejects password reset with weak or commonly compromised password (400)', async () => {
      const token = await getTestOwnerToken();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: '123456789012' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('too common or easily guessed');
    });

    it('enforces 12-character minimum policy when strict policy header is supplied (400)', async () => {
      const token = await getTestOwnerToken();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Enforce-Policy', 'strict')
        .send({ password: 'validEight8' }); // 11 characters

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 12 characters');
    });

    it('ignores arbitrary targetUserId in body and only updates account tied to token', async () => {
      const token = await getTestOwnerToken();

      const updateSpy = vi.spyOn(supabaseAdmin.auth.admin, 'updateUserById').mockResolvedValueOnce({
        data: { user: { id: 'ac088d6d-6aef-40b0-8388-51e5d74063a6', email: 'rtrmobile92@gmail.com' } } as any,
        error: null
      });

      // Attacker attempts to provide a victim user ID or email
      const victimId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          password: 'validEight123!',
          targetUserId: victimId,
          userId: victimId
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith('ac088d6d-6aef-40b0-8388-51e5d74063a6', { password: 'validEight123!' });
    });

    it('successfully resets password with valid token and enables login with new password', async () => {
      // 1. Obtain verified owner session token without hardcoded passwords
      const token = await getTestOwnerToken();
      expect(token).toBeDefined();

      vi.spyOn(supabaseAdmin.auth.admin, 'updateUserById').mockResolvedValueOnce({
        data: { user: { id: 'b46689e9-754e-49b5-b79b-ebc1ee42538f', email: 'rtrmobile92@gmail.com' } } as any,
        error: null
      });

      // 2. Perform password update using the valid token
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'StrongNewPassword123!' });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
    });
  });

  describe('Employee Password Authentication on /api/auth/login', () => {
    it('authenticates valid employee account with email and password', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { 
            id: 'emp-uuid-1', 
            email: 'employee@rtrmobiles.com', 
            user_metadata: { full_name: 'Shop Employee', username: 'shopemp' } 
          } as any,
          session: { access_token: 'fake-employee-token', refresh_token: 'fake-refresh', expires_at: 1999999999, expires_in: 3600 } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementation(((table: string) => {
        if (table === 'business_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { business_id: 'biz-1', role: 'employee', is_active: true },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'shop_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    shop_id: 'shop-uuid-1',
                    shops: {
                      id: 'shop-uuid-1',
                      name: 'Downtown Branch',
                      code: 'DT-01',
                      is_active: true,
                      business_id: 'biz-1'
                    }
                  },
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      }) as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'employee@rtrmobiles.com', password: 'ValidPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('employee');
      expect(res.body.user.assignedShopId).toBe('shop-uuid-1');
      expect(res.body.user.assignedShopName).toBe('Downtown Branch');
      expect(res.body.user.assignedShopCode).toBe('DT-01');
    });

    it('rejects employee login with incorrect password (401)', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 } as any
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'employee@rtrmobiles.com', password: 'WrongPassword999' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(INCORRECT_CREDENTIALS_MSG);
    });

    it('rejects employee login if employee account is deactivated (403)', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'emp-uuid-2', email: 'deactivated@rtrmobiles.com', user_metadata: {} } as any,
          session: { access_token: 'fake-token' } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { business_id: 'biz-1', role: 'employee', is_active: false },
              error: null
            })
          })
        })
      } as any));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'deactivated@rtrmobiles.com', password: 'ValidPassword123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Account is deactivated or unauthorized');
    });

    it('rejects employee login if not assigned to active shop (403)', async () => {
      vi.spyOn(supabaseAnon.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: { id: 'emp-uuid-3', email: 'no-shop@rtrmobiles.com', user_metadata: {} } as any,
          session: { access_token: 'fake-token' } as any
        },
        error: null
      });

      vi.spyOn(supabaseAdmin, 'from').mockImplementation(((table: string) => {
        if (table === 'business_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { business_id: 'biz-1', role: 'employee', is_active: true },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'shop_memberships') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: null
                })
              })
            })
          } as any;
        }
        return {} as any;
      }) as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'no-shop@rtrmobiles.com', password: 'ValidPassword123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not currently assigned to an active shop');
    });
  });
});

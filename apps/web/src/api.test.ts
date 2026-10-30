import { describe, it, expect } from 'vitest';
import healthHandler from '../api/health.js';
import loginHandler from '../api/auth/login.js';
import verifySessionHandler from '../api/auth/verify-session.js';
import forgotPasswordHandler from '../api/auth/forgot-password.js';

function createMockReqRes(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    body: options.body || {},
    headers: options.headers || {},
    query: options.query || {}
  };

  let statusCode = 200;
  let jsonBody: any = null;
  const headersSet: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headersSet[name.toLowerCase()] = value;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: any) {
      jsonBody = body;
      return res;
    },
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headersSet
  };

  return { req, res };
}

describe('Vercel Serverless API Endpoints Suite (/api/*)', () => {
  it('GET /api/health returns 200 with healthy status and no-cache headers', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await healthHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().status).toBe('healthy');
    expect(res.getBody().service).toBe('rtr-wholesale-api');
    expect(res.getHeaders()['cache-control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('POST /api/auth/login rejects non-POST requests with 405 Method Not Allowed', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(405);
    expect(res.getBody().error).toBe('Method Not Allowed');
  });

  it('POST /api/auth/login rejects empty credentials with 401', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { username: '', password: '' }
    });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toBe('Incorrect username or password. Please try again.');
  });

  it('POST /api/auth/login authenticates demo owner into isolated sandbox', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { username: 'demo-owner', password: 'demo-password-2026' }
    });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().user.role).toBe('demo');
    expect(res.getBody().user.isDemo).toBe(true);
    expect(res.getBody().session.access_token).toContain('demo-access-token-');
  });

  it('GET /api/auth/verify-session rejects missing Authorization header with 401', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await verifySessionHandler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toContain('Authorization');
  });

  it('GET /api/auth/verify-session validates demo session token', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { authorization: 'Bearer demo-access-token-12345678' }
    });
    await verifySessionHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().user.role).toBe('demo');
    expect(res.getBody().user.isDemo).toBe(true);
  });

  it('POST /api/auth/forgot-password returns neutral confirmation for unknown username', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { identifier: 'unknown-username' }
    });
    await forgotPasswordHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toBe('If an account matches the information provided, password reset instructions will be sent to its registered email address.');
  });
});

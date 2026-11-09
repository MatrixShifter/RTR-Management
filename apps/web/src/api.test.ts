import { describe, it, expect } from 'vitest';
import { DEMO_PASSWORD_PLACEHOLDER } from '@crimpston/shared';
import healthHandler from '../api/health.js';
import authHandler, { loginHandler, verifySessionHandler, forgotPasswordHandler } from '../api/auth.js';
import settingsHandler from '../api/settings.js';
import productsHandler from '../api/products.js';
import shopsHandler from '../api/shops.js';
import employeesHandler from '../api/employees.js';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/',
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
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/health' });
    await healthHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().status).toBe('healthy');
    expect(res.getBody().service).toBe('rtr-wholesale-api');
    expect(res.getHeaders()['cache-control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('POST /api/auth/login rejects non-POST requests with 405 Method Not Allowed', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/auth/login' });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(405);
    expect(res.getBody().error).toBe('Method Not Allowed');
  });

  it('POST /api/auth/login rejects empty credentials with 401', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: '', password: '' }
    });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toBe('Incorrect username or password. Please try again.');
  });

  it('POST /api/auth/login authenticates demo owner into isolated sandbox', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'demo-owner', password: DEMO_PASSWORD_PLACEHOLDER }
    });
    await loginHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().user.role).toBe('demo');
    expect(res.getBody().user.isDemo).toBe(true);
    expect(res.getBody().session.access_token).toContain('demo-access-token-');
  });

  it('GET /api/auth/verify-session rejects missing Authorization header with 401', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/auth/verify-session' });
    await verifySessionHandler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toContain('Authorization');
  });

  it('GET /api/auth/verify-session validates demo session token', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/auth/verify-session',
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
      url: '/api/auth/forgot-password',
      body: { identifier: 'unknown-username' }
    });
    await forgotPasswordHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toBe('If an account matches the information provided, password reset instructions will be sent to its registered email address.');
  });

  it('Consolidated auth router routes actions via URL or query parameters', async () => {
    // Via URL parsing
    const { req: reqUrl, res: resUrl } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { username: 'demo-owner', password: DEMO_PASSWORD_PLACEHOLDER }
    });
    await authHandler(reqUrl, resUrl);
    expect(resUrl.getStatus()).toBe(200);
    expect(resUrl.getBody().user.role).toBe('demo');

    // Via query rewrite parameter
    const { req: reqQuery, res: resQuery } = createMockReqRes({
      method: 'GET',
      url: '/api/auth?action=verify-session',
      query: { action: 'verify-session' },
      headers: { authorization: 'Bearer demo-access-token-12345678' }
    });
    await authHandler(reqQuery, resQuery);
    expect(resQuery.getStatus()).toBe(200);
    expect(resQuery.getBody().user.role).toBe('demo');

    // Unknown action returns 404
    const { req: reqUnknown, res: resUnknown } = createMockReqRes({
      method: 'GET',
      url: '/api/auth/unknown-endpoint'
    });
    await authHandler(reqUnknown, resUnknown);
    expect(resUnknown.getStatus()).toBe(404);
  });

  it('GET /api/settings rejects missing authorization with 401', async () => {
    const { req, res } = createMockReqRes({ method: 'GET', url: '/api/settings' });
    await settingsHandler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toBe('Unauthorized');
  });

  it('GET /api/settings returns isolated demo settings for demo token (200)', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: 'Bearer demo-access-token-12345678' }
    });
    await settingsHandler(req, res);

    expect(res.getStatus()).toBe(200);
    expect(res.getBody().success).toBe(true);
    expect(res.getBody().data.isDemo).toBe(true);
    expect(res.getBody().data.name).toContain('Demo Sandbox');
  });

  it('PATCH /api/settings blocks demo sessions from modifying settings with 403', async () => {
    const { req, res } = createMockReqRes({
      method: 'PATCH',
      url: '/api/settings',
      headers: { authorization: 'Bearer demo-access-token-12345678' },
      body: { name: 'Hacked Store' }
    });
    await settingsHandler(req, res);

    expect(res.getStatus()).toBe(403);
    expect(res.getBody().error).toBe('Forbidden');
  });

  it('POST /api/settings rejects unsupported HTTP method with 405', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', url: '/api/settings' });
    await settingsHandler(req, res);

    expect(res.getStatus()).toBe(405);
    expect(res.getBody().error).toBe('Method Not Allowed');
  });

  describe('Consolidated Products Handler (/api/products/*)', () => {
    it('rejects requests without product ID with 400', async () => {
      const { req, res } = createMockReqRes({ method: 'DELETE', url: '/api/products' });
      await productsHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('Validation Error');
    });

    it('rejects unauthorized requests with 401', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/products/test-prod-1',
        query: { id: 'test-prod-1' }
      });
      await productsHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('handles GET /api/products/:id for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/products/demo-p-1',
        query: { id: 'demo-p-1' },
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await productsHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody().product.id).toBe('demo-p-1');
    });

    it('handles DELETE /api/products/:id for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'DELETE',
        url: '/api/products/demo-p-1',
        query: { id: 'demo-p-1' },
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await productsHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody().action).toBe('deleted');
    });

    it('handles GET /api/products/:id/usage for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/products/demo-p-1/usage',
        query: { id: 'demo-p-1', action: 'usage' },
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await productsHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody().inUse).toBe(false);
      expect(res.getBody().count).toBe(0);
    });
  });

  describe('Consolidated Shops Handler (/api/shops/*)', () => {
    it('rejects requests without shop ID with 400', async () => {
      const { req, res } = createMockReqRes({ method: 'DELETE', url: '/api/shops' });
      await shopsHandler(req, res);
      expect(res.getStatus()).toBe(400);
      expect(res.getBody().error).toBe('Validation Error');
    });

    it('rejects unauthorized requests with 401', async () => {
      const { req, res } = createMockReqRes({
        method: 'DELETE',
        url: '/api/shops/test-shop-1',
        query: { id: 'test-shop-1' }
      });
      await shopsHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('handles DELETE /api/shops/:id for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'DELETE',
        url: '/api/shops/demo-s-1',
        query: { id: 'demo-s-1' },
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await shopsHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody().action).toBe('deleted');
    });

    it('handles GET /api/shops/:id/usage for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/shops/demo-s-1/usage',
        query: { id: 'demo-s-1', action: 'usage' },
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await shopsHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(res.getBody().inUse).toBe(false);
      expect(res.getBody().count).toBe(0);
    });
  });

  describe('Consolidated Employees Handler (/api/employees/*)', () => {
    it('rejects unauthorized requests with 401', async () => {
      const { req, res } = createMockReqRes({ method: 'GET', url: '/api/employees' });
      await employeesHandler(req, res);
      expect(res.getStatus()).toBe(401);
    });

    it('handles GET /api/employees for demo owner', async () => {
      const { req, res } = createMockReqRes({
        method: 'GET',
        url: '/api/employees',
        headers: { authorization: 'Bearer demo-access-token-12345' }
      });
      await employeesHandler(req, res);
      expect(res.getStatus()).toBe(200);
      expect(Array.isArray(res.getBody().employees)).toBe(true);
    });
  });
});

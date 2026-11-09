import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import employeesHandler, {
  employeeIdHandler,
  employeeShopHandler,
  employeeStatusHandler,
  employeeResetPasswordHandler
} from '../api/employees.js';
import { 
  getEmployees, 
  createEmployee, 
  reassignEmployeeShop, 
  toggleEmployeeStatus, 
  revokeEmployeeAccess,
  resetEmployeePassword
} from './services/db.js';
import { setDemoMode } from './services/demoMode.js';

function createMockReqRes(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  url?: string;
}) {
  const req = {
    method: options.method || 'GET',
    body: options.body || {},
    headers: options.headers || {},
    query: options.query || {},
    url: options.url || '/api/employees'
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

describe('Vercel Serverless Employee Endpoints Suite (/api/employees*)', () => {
  const demoOwnerToken = 'Bearer demo-session-token-owner';

  it('rejects unauthenticated requests with 401', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await employeesHandler(req, res);
    expect(res.getStatus()).toBe(401);
    expect(res.getBody().error).toBe('Unauthorized');
  });

  it('GET /api/employees returns 200 with demo employee list in demo mode', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { authorization: demoOwnerToken }
    });
    await employeesHandler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(Array.isArray(res.getBody().employees)).toBe(true);
    expect(res.getBody().employees.length).toBeGreaterThan(0);
  });

  it('POST /api/employees validates input schema and rejects invalid payload', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: demoOwnerToken },
      body: { name: '', email: 'not-an-email', password: 'short' }
    });
    await employeesHandler(req, res);
    expect(res.getStatus()).toBe(400);
    expect(res.getBody().error).toBe('Validation Error');
  });

  it('POST /api/employees provisions demo employee with valid payload', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: demoOwnerToken },
      body: {
        name: 'Jane Staff',
        email: 'jane.staff@example.com',
        username: 'janestaff',
        shopId: 'a0000000-0000-0000-0000-000000000001',
        password: 'password123'
      }
    });
    await employeesHandler(req, res);
    expect(res.getStatus()).toBe(201);
    expect(res.getBody().success).toBe(true);
    expect(res.getBody().employee.name).toBe('Jane Staff');
    expect(res.getBody().employee.email).toBe('jane.staff@example.com');
  });

  it('PATCH /api/employees/:id/shop reassigns shop in demo mode', async () => {
    const { req, res } = createMockReqRes({
      method: 'PATCH',
      headers: { authorization: demoOwnerToken },
      query: { id: 'demo-employee-1' },
      body: { shopId: 'a0000000-0000-0000-0000-000000000002' }
    });
    await employeeShopHandler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().success).toBe(true);
  });

  it('PATCH /api/employees/:id/status updates status in demo mode', async () => {
    const { req, res } = createMockReqRes({
      method: 'PATCH',
      headers: { authorization: demoOwnerToken },
      query: { id: 'demo-employee-1' },
      body: { isActive: false }
    });
    await employeeStatusHandler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().success).toBe(true);
    expect(res.getBody().message).toContain('deactivated');
  });

  it('DELETE /api/employees/:id revokes access in demo mode', async () => {
    const { req, res } = createMockReqRes({
      method: 'DELETE',
      headers: { authorization: demoOwnerToken },
      query: { id: 'demo-employee-1' }
    });
    await employeeIdHandler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().success).toBe(true);
  });

  it('POST /api/employees/:id/reset-password resets employee password in demo mode', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: demoOwnerToken },
      query: { id: 'demo-employee-1' },
      body: { password: 'new-secure-password' }
    });
    await employeeResetPasswordHandler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().success).toBe(true);
    expect(res.getBody().message).toMatch(/password reset successfully|Password updated successfully/i);
  });

  it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    const { req, res } = createMockReqRes({
      method: 'PUT',
      headers: { authorization: demoOwnerToken }
    });
    await employeesHandler(req, res);
    expect(res.getStatus()).toBe(405);
    expect(res.getBody().error).toBe('Method Not Allowed');
  });
});

describe('Frontend API Client Safe Response Handling (HTML & Error Resilience)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setDemoMode(true);
  });

  afterEach(() => {
    setDemoMode(false);
  });

  it('throws a helpful, clean error instead of JSON syntax error when server returns HTML', async () => {
    const htmlResponse = new Response('<!DOCTYPE html><html><head><title>Vercel SPA</title></head><body>App</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(htmlResponse);

    await expect(createEmployee({
      name: 'Test Staff',
      email: 'staff@example.com',
      shopId: 'a0000000-0000-0000-0000-000000000001',
      password: 'password123'
    })).rejects.toThrow(/Server returned an unexpected HTML response/);
  });

  it('handles empty server response cleanly without throwing invalid JSON', async () => {
    const emptyResponse = new Response('', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(emptyResponse);

    const result = await revokeEmployeeAccess('emp-123');
    expect(result).toEqual({});
  });

  it('extracts server error message when API returns JSON error status', async () => {
    const errorResponse = new Response(JSON.stringify({
      error: 'Conflict',
      message: 'An employee with this email is already registered for your business.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse);

    await expect(createEmployee({
      name: 'Existing Staff',
      email: 'existing@example.com',
      shopId: 'a0000000-0000-0000-0000-000000000001',
      password: 'password123'
    })).rejects.toThrow('An employee with this email is already registered for your business.');
  });

  it('safely calls getEmployees, reassignEmployeeShop, and toggleEmployeeStatus with JSON parsing', async () => {
    const listRes = new Response(JSON.stringify({ employees: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(listRes);
    const emps = await getEmployees();
    expect(emps).toEqual([]);

    const reassignRes = new Response(JSON.stringify({ success: true, message: 'Reassigned' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reassignRes);
    const reassignOutcome = await reassignEmployeeShop('emp-1', 'shop-2');
    expect(reassignOutcome.success).toBe(true);

    const toggleRes = new Response(JSON.stringify({ success: true, message: 'Updated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(toggleRes);
    const toggleOutcome = await toggleEmployeeStatus('emp-1', true);
    expect(toggleOutcome.success).toBe(true);

    const resetPwdRes = new Response(JSON.stringify({ success: true, message: 'Password reset' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(resetPwdRes);
    const resetOutcome = await resetEmployeePassword('emp-1', 'newpassword123');
    expect(resetOutcome.success).toBe(true);
  });
});

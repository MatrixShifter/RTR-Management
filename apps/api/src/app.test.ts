import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('API Foundation & Health Endpoints', () => {
  it('GET /api/health returns healthy status without secrets', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.environment).toBeDefined();
    // Security verification: ensure no database connection strings or keys leaked
    expect(res.body.supabase).toBeUndefined();
    expect(res.body.database).toBeUndefined();
    expect(res.body.secrets).toBeUndefined();
  });

  it('sets secure security headers via Helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('GET /api/database/storage-health returns storage status without leaking credentials', async () => {
    const res = await request(app).get('/api/database/storage-health');
    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeDefined();
    // When unverified or verified, never expose credentials
    expect(res.body.serviceKey).toBeUndefined();
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });
});

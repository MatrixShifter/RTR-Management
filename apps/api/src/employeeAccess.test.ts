import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { supabaseAdmin } from './supabase.js';

describe('Shop Employee Role & Strict Read-Only Access Control Suite', { timeout: 25000 }, () => {
  const shopAId = '251f7abf-3c9d-44ba-9f12-b5edeac0aee3'; // Shop A
  const shopBId = '24b1302b-3c7e-4766-8cdc-ac02a0f766af'; // 1dhope
  const employeeAId = 'emp-00000000-0000-0000-0000-000000000001';
  const businessId = '4fba6fb7-4e1b-4106-ac84-908f821d73c3';
  const employeeToken = 'employee-token-valid-mock-jwt';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to mock an authenticated employee session
  function mockEmployeeSession(isActive = true, assignedShop = shopAId) {
    vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: employeeAId,
          email: 'employee.a@rtrmobiles.com',
          user_metadata: { full_name: 'Employee A', username: 'employeea' }
        } as any
      },
      error: null
    });

    vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
      if (table === 'business_memberships') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  business_id: businessId,
                  role: 'employee',
                  is_active: isActive
                },
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
                data: assignedShop ? {
                  shop_id: assignedShop,
                  shops: {
                    id: assignedShop,
                    name: assignedShop === shopAId ? 'Shop A' : 'Shop B',
                    code: 'RTR-SHOP-01',
                    is_active: true,
                    business_id: businessId
                  }
                } : null,
                error: null
              })
            })
          })
        } as any;
      }

      if (table === 'v_business_records') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => ({
                order: () => ({
                  eq: (_col2: string, _val2: string) => ({
                    range: async () => ({
                      data: [
                        {
                          record_id: 'rec-1',
                          delivery_id: 'del-1',
                          business_id: businessId,
                          shop_id: assignedShop,
                          shop_name: 'Shop A',
                          product_id: 'prod-1',
                          product_name: 'Tempered Glass',
                          quantity: 5,
                          total_amount: 500,
                          customer_price: 750,
                          profit: 250,
                          delivery_status: 'delivered',
                          priority_rank: 2,
                          date: '2026-10-30'
                        }
                      ],
                      error: null
                    })
                  }),
                  range: async () => ({
                    data: [
                      {
                        record_id: 'rec-1',
                        delivery_id: 'del-1',
                        business_id: businessId,
                        shop_id: assignedShop,
                        shop_name: 'Shop A',
                        product_id: 'prod-1',
                        product_name: 'Tempered Glass',
                        quantity: 5,
                        total_amount: 500,
                        customer_price: 750,
                        profit: 250,
                        delivery_status: 'delivered',
                        priority_rank: 2,
                        date: '2026-10-30'
                      }
                    ],
                    error: null
                  })
                })
              })
            })
          })
        } as any;
      }

      if (table === 'shops') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                eq: async () => ({
                  data: [
                    { id: assignedShop, name: 'Shop A', code: 'RTR-01', is_active: true }
                  ],
                  error: null
                })
              })
            })
          })
        } as any;
      }

      return {} as any;
    });
  }

  // TEST A & C — EMPLOYEE SHOP ISOLATION & DIRECT API QUERY
  it('TEST A: allows employee to read records for assigned shop', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.records).toBeDefined();
    expect(Array.isArray(res.body.records)).toBe(true);
  });

  it('TEST C: blocks cross-shop access when employee submits a different shop ID (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    // Employee assigned to Shop A attempts to query Shop B
    const res = await request(app)
      .get(`/api/records?shopId=${shopBId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('You can only access records for your assigned shop');
  });

  // TEST D — INSERT ATTACK
  it('TEST D: strictly rejects employee direct API INSERT request (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    const payload = {
      date: '2026-10-31',
      shopId: shopAId,
      shopName: 'Shop A',
      productId: '00000000-0000-0000-0000-000000000001',
      productName: '9a combo',
      quantity: 2,
      unitPrice: 300,
      amount: 600,
      deliveryStatus: 'delivered'
    };

    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Business Owner privileges required');
  });

  // TEST E & G — UPDATE & DELIVERY STATUS ATTACK
  it('TEST E & G: strictly rejects employee delivery status change attack (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .patch('/api/records/deliv-12345/delivery-status')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'delivered', customerPrice: 800 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Business Owner privileges required');
  });

  // TEST F — DELETE ATTACK
  it('TEST F: strictly rejects employee record DELETE request (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .delete('/api/records/deliv-12345')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Business Owner privileges required');
  });

  // TEST H — FINANCIAL PAYMENT MODIFICATION
  it('TEST H: strictly rejects employee payment settlement attempt (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .post('/api/records/settle')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ recordId: 'deliv-12345', amountPaid: 200 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Business Owner privileges required');
  });

  // TEST I — ROLE ESCALATION ATTACK
  it('TEST I: strictly rejects employee attempt to provision or manage employees (403 Forbidden)', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Hacker', email: 'hack@test.com', shopId: shopAId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Business Owner privileges required');
  });

  // TEST J — DEACTIVATED EMPLOYEE
  it('TEST J: revokes access immediately when employee account is deactivated (403 Forbidden)', async () => {
    mockEmployeeSession(false, shopAId); // isActive = false

    const res = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Account is deactivated or unauthorized');
  });

  // TEST UNASSIGNED EMPLOYEE
  it('blocks employee access if no active shop is assigned', async () => {
    mockEmployeeSession(true, null as any); // No assigned shop

    const res = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('not currently assigned to an active shop');
  });

  // TEST CATALOG SCOPING FOR SHOPS
  it('restricts GET /api/shops to only the assigned shop for employees', async () => {
    mockEmployeeSession(true, shopAId);

    const res = await request(app)
      .get('/api/shops')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shops).toBeDefined();
    expect(res.body.shops.length).toBe(1);
    expect(res.body.shops[0].id).toBe(shopAId);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { getTestOwnerToken } from './testHelper.js';

describe('Shop & Product Management API Endpoints (/api/shops & /api/products)', { timeout: 35000 }, () => {
  let ownerToken: string;
  let createdShopId: string;
  let createdShopName: string;
  let createdShopCode: string;

  let createdProductId: string;
  let createdProductName: string;
  let createdProductSku: string;

  beforeAll(async () => {
    ownerToken = await getTestOwnerToken();
    expect(ownerToken).toBeDefined();
  }, 35000);

  describe('Shop Management Endpoints (/api/shops)', () => {
    it('blocks unauthenticated requests to POST /api/shops with 401', async () => {
      const res = await request(app)
        .post('/api/shops')
        .send({ name: 'Unauthorized Shop', code: 'UNAUTH-01' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('creates a new retail partner shop successfully with 201', async () => {
      const timestamp = Date.now().toString().slice(-5);
      createdShopName = `Test Shop ${timestamp}`;
      createdShopCode = `TS-${timestamp}`;

      const res = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdShopName,
          code: createdShopCode,
          phone: '9876543210',
          address: '42 MG Road, Bangalore',
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.shop).toBeDefined();
      expect(res.body.shop.id).toBeDefined();
      expect(res.body.shop.name).toBe(createdShopName);
      expect(res.body.shop.code).toBe(createdShopCode);
      expect(res.body.shop.is_active).toBe(true);

      createdShopId = res.body.shop.id;
    });

    it('rejects duplicate shop name with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdShopName.toLowerCase(), // case-insensitive duplicate
          code: `DIFF-${Date.now().toString().slice(-4)}`
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('already exists');
    });

    it('rejects duplicate shop code with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `Unique Shop ${Date.now()}`,
          code: createdShopCode
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('already exists');
    });

    it('retrieves details for an existing shop (200)', async () => {
      const res = await request(app)
        .get(`/api/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.shop).toBeDefined();
      expect(res.body.shop.id).toBe(createdShopId);
      expect(res.body.shop.name).toBe(createdShopName);
    });

    it('updates shop details and toggles active status (200)', async () => {
      const updatedName = `${createdShopName} Updated`;
      const res = await request(app)
        .put(`/api/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: updatedName,
          code: createdShopCode,
          phone: '9998887776',
          address: 'Updated Address 101',
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shop.name).toBe(updatedName);
      expect(res.body.shop.phone).toBe('9998887776');
      expect(res.body.shop.is_active).toBe(false);

      // Restore active state
      await request(app)
        .put(`/api/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdShopName,
          code: createdShopCode,
          phone: '9876543210',
          address: '42 MG Road, Bangalore',
          isActive: true
        });
    });

    it('retrieves shop history ledger (200)', async () => {
      const res = await request(app)
        .get(`/api/shops/${createdShopId}/history`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(res.body.history.shopId).toBe(createdShopId);
      expect(res.body.history.deliveries).toBeInstanceOf(Array);
    });

    it('checks shop usage and deletes zero-record test shop safely (200)', async () => {
      const usageRes = await request(app)
        .get(`/api/shops/${createdShopId}/usage`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.inUse).toBe(false);

      const delRes = await request(app)
        .delete(`/api/shops/${createdShopId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.action).toBe('deleted');
    });
  });

  describe('Product Management Endpoints (/api/products)', () => {
    it('blocks unauthenticated requests to POST /api/products with 401', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ name: 'Unauthorized Case', sku: 'UNAUTH-SKU-01' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('creates a new wholesale product successfully with 201', async () => {
      const timestamp = Date.now().toString().slice(-5);
      createdProductName = `Silicone Case Pro ${timestamp}`;
      createdProductSku = `CASE-PRO-${timestamp}`;

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdProductName,
          sku: createdProductSku,
          category: 'Mobile Cases',
          unitPrice: 199.5,
          costPrice: 95.0,
          minStock: 15,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.product).toBeDefined();
      expect(res.body.product.id).toBeDefined();
      expect(res.body.product.name).toBe(createdProductName);
      expect(res.body.product.sku).toBe(createdProductSku);
      expect(res.body.product.category).toBe('Mobile Cases');
      expect(Number(res.body.product.unit_price)).toBe(199.5);
      expect(res.body.product.is_active).toBe(true);

      createdProductId = res.body.product.id;
    });

    it('rejects duplicate product name with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdProductName.toLowerCase(), // case-insensitive duplicate
          sku: `DIFF-SKU-${Date.now().toString().slice(-4)}`,
          category: 'Mobile Cases'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('already exists');
    });

    it('rejects duplicate product SKU with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `Unique Product ${Date.now()}`,
          sku: createdProductSku.toLowerCase(),
          category: 'Mobile Cases'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      expect(res.body.message).toContain('already exists');
    });

    it('retrieves details for an existing product (200)', async () => {
      const res = await request(app)
        .get(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.product).toBeDefined();
      expect(res.body.product.id).toBe(createdProductId);
      expect(res.body.product.name).toBe(createdProductName);
    });

    it('updates product details, pricing, and toggles active status (200)', async () => {
      const updatedName = `${createdProductName} v2`;
      const res = await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: updatedName,
          sku: createdProductSku,
          category: 'Mobile Cases',
          unitPrice: 220,
          costPrice: 100,
          minStock: 25,
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.product.name).toBe(updatedName);
      expect(Number(res.body.product.unit_price)).toBe(220);
      expect(res.body.product.is_active).toBe(false);

      // Restore active state
      await request(app)
        .put(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: createdProductName,
          sku: createdProductSku,
          category: 'Mobile Cases',
          unitPrice: 199.5,
          costPrice: 95.0,
          minStock: 15,
          isActive: true
        });
    });

    it('retrieves product distribution history (200)', async () => {
      const res = await request(app)
        .get(`/api/products/${createdProductId}/history`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(res.body.history.productId).toBe(createdProductId);
      expect(res.body.history.deliveries).toBeInstanceOf(Array);
    });

    it('checks product usage and safely deletes zero-record test product (200)', async () => {
      const usageRes = await request(app)
        .get(`/api/products/${createdProductId}/usage`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.inUse).toBe(false);

      const delRes = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.action).toBe('deleted');
    });
  });
});

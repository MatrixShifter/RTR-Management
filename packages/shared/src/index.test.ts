import { describe, it, expect } from 'vitest';
import { CreateDailyReportSchema, CreateDeliverySchema } from './index.js';

describe('Shared Schemas & Business Rules', () => {
  it('validates a valid zero sales report', () => {
    const validZeroSales = {
      business_id: '123e4567-e89b-12d3-a456-426614174000',
      shop_id: '123e4567-e89b-12d3-a456-426614174001',
      report_date: '2026-10-18',
      is_zero_sales: true,
      notes: 'Shop was closed for renovation',
      items: []
    };
    const result = CreateDailyReportSchema.safeParse(validZeroSales);
    expect(result.success).toBe(true);
  });

  it('rejects a non-zero sales report with empty items', () => {
    const invalidReport = {
      business_id: '123e4567-e89b-12d3-a456-426614174000',
      shop_id: '123e4567-e89b-12d3-a456-426614174001',
      report_date: '2026-10-18',
      is_zero_sales: false,
      items: []
    };
    const result = CreateDailyReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });

  it('rejects delivery with zero quantity items', () => {
    const invalidDelivery = {
      business_id: '123e4567-e89b-12d3-a456-426614174000',
      shop_id: '123e4567-e89b-12d3-a456-426614174001',
      delivery_date: '2026-10-18',
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 0
        }
      ]
    };
    const result = CreateDeliverySchema.safeParse(invalidDelivery);
    expect(result.success).toBe(false);
  });
});

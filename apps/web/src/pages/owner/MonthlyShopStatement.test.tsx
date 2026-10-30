import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MonthlyShopStatement } from './MonthlyShopStatement.js';
import type { Shop, BusinessRecord } from '../../services/db.js';

describe('MonthlyShopStatement Component Suite', () => {
  const mockShops: Shop[] = [
    { id: 'shop-alpha', name: 'Alpha Cellular', code: 'RTR-ALPH', address: '1st Cross Rd', phone: '9876543210', isActive: true, assignedEmployees: [] },
    { id: 'shop-beta', name: 'Beta Telecom', code: 'RTR-BETA', address: '2nd Main Rd', phone: '9876543211', isActive: true, assignedEmployees: [] },
    { id: 'shop-gamma', name: 'Gamma Accessories', code: 'RTR-GAMM', address: '3rd Market', phone: '9876543212', isActive: true, assignedEmployees: [] }
  ];

  const mockRecords: BusinessRecord[] = [
    // Shop Alpha: 2 records for October 2026
    {
      id: 'rec-1',
      deliveryId: 'del-1',
      date: '2026-10-05',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular',
      productId: 'prod-glass',
      productName: 'Tempered Glass 9D',
      quantity: 10,
      unitPrice: 50,
      totalAmount: 500, // Wholesale cost: 500
      customerPrice: 800, // Customer price: 800
      profit: 300, // Profit: +300
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-05T10:00:00Z'
    },
    {
      id: 'rec-2',
      deliveryId: 'del-2',
      date: '2026-10-15',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular',
      productId: 'prod-charger',
      productName: 'Fast Charger 25W',
      quantity: 5,
      unitPrice: 200,
      totalAmount: 1000, // Wholesale cost: 1000
      customerPrice: 1400, // Customer price: 1400
      profit: 400, // Profit: +400
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-15T10:00:00Z'
    },
    // Shop Beta: 1 record with historical missing CP in October 2026
    {
      id: 'rec-3',
      deliveryId: 'del-3',
      date: '2026-10-20',
      shopId: 'shop-beta',
      shopName: 'Beta Telecom',
      productId: 'prod-glass',
      productName: 'Tempered Glass 9D',
      quantity: 20,
      unitPrice: 50,
      totalAmount: 1000,
      customerPrice: null, // Historical missing CP
      profit: null,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-20T10:00:00Z'
    },
    // Shop Gamma: 1 record with loss in October 2026 (CP < Amount)
    {
      id: 'rec-4',
      deliveryId: 'del-4',
      date: '2026-10-25',
      shopId: 'shop-gamma',
      shopName: 'Gamma Accessories',
      productId: 'prod-cable',
      productName: 'Type-C Braided Cable',
      quantity: 10,
      unitPrice: 100,
      totalAmount: 1000, // Wholesale cost: 1000
      customerPrice: 800, // Sold below cost: 800
      profit: -200, // Loss: -200
      deliveryStatus: 'pending',
      pendingAmount: 1000,
      createdAt: '2026-10-25T10:00:00Z'
    },
    // Record from September 2026 (must be excluded from October statement)
    {
      id: 'rec-sept',
      deliveryId: 'del-sept',
      date: '2026-09-10',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular',
      productId: 'prod-glass',
      productName: 'Tempered Glass 9D',
      quantity: 50,
      unitPrice: 50,
      totalAmount: 2500,
      customerPrice: 4000,
      profit: 1500,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-09-10T10:00:00Z'
    }
  ];

  it('renders header, month/year selector, and filter controls', () => {
    const html = renderToString(
      <MonthlyShopStatement
        initialShops={mockShops}
        initialRecords={mockRecords}
      />
    );

    expect(html).toContain('Monthly Purchase &amp; Profit Statement');
    expect(html).toContain('Statement Month');
    expect(html).toContain('Year');
    expect(html).toContain('Shop View Mode');
    expect(html).toContain('Delivery Status');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Print Statement');
  });

  it('renders Consolidated All Shops view with accurate grand totals across shops for October 2026', () => {
    const html = renderToString(
      <MonthlyShopStatement
        initialShops={mockShops}
        initialRecords={mockRecords}
      />
    );

    // Consolidated Wholesale Cost:
    // Alpha (500 + 1000 = 1500) + Beta (1000) + Gamma (1000) = 3500
    expect(html).toContain('₹3,500');

    // Consolidated Customer Price:
    // Alpha (800 + 1400 = 2200) + Beta (0, missing) + Gamma (800) = 3000
    expect(html).toContain('₹3,000');

    // Consolidated Net Profit:
    // Alpha (+700) + Gamma (-200) = +500
    expect(html).toContain('+₹500');

    // Missing CP counter
    expect(html).toContain('1 records missing CP');

    // All active shops listed in summary table
    expect(html).toContain('Alpha Cellular');
    expect(html).toContain('Beta Telecom');
    expect(html).toContain('Gamma Accessories');

    // September record must NOT be included in October total
    expect(html).not.toContain('₹6,000'); // 3500 + 2500
  });

  it('displays individual shop statement when shopId is selected', () => {
    const html = renderToString(
      <MonthlyShopStatement
        initialShops={mockShops}
        initialRecords={mockRecords}
        initialShopId="shop-alpha"
      />
    );

    // Alpha totals: Wholesale 1500, CP 2200, Profit +700
    expect(html).toContain('₹1,500');
    expect(html).toContain('₹2,200');
    expect(html).toContain('+₹700');
    expect(html).toContain('Alpha Cellular');

    // Section B Product breakdown for Alpha
    expect(html).toContain('Tempered Glass 9D');
    expect(html).toContain('Fast Charger 25W');

    // Section C Transaction ledger
    expect(html).toContain('Individual Transaction Ledger');
  });

  it('correctly handles historical records missing Customer Price (CP)', () => {
    const html = renderToString(
      <MonthlyShopStatement
        initialShops={mockShops}
        initialRecords={mockRecords}
        initialShopId="shop-beta"
      />
    );

    // Shows 1 record missing CP
    expect(html).toContain('1 records missing CP');
    expect(html).toContain('Beta Telecom');
    expect(html).toContain('Not Recorded');
    expect(html).toContain('Not Available');

    // Does not invent 0 profit or fake numbers
    expect(html).toContain('₹1,000'); // Wholesale cost
  });

  it('correctly displays negative profit / loss warning when selling below wholesale cost', () => {
    const html = renderToString(
      <MonthlyShopStatement
        initialShops={mockShops}
        initialRecords={mockRecords}
        initialShopId="shop-gamma"
      />
    );

    expect(html).toContain('-₹200');
    expect(html).toContain('Type-C Braided Cable');
    expect(html).toContain('Gamma Accessories');
  });
});

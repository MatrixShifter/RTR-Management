import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { IndividualShopStatement } from './IndividualShopStatement.js';
import { MonthlyShopStatement } from './MonthlyShopStatement.js';
import { type Shop, type BusinessRecord, setDemoMode } from '../../services/db.js';

describe('IndividualShopStatement Component Suite', () => {
  beforeEach(() => {
    setDemoMode(true);
  });

  const mockShops: Shop[] = [
    {
      id: 'shop-alpha',
      name: 'Alpha Cellular Hub',
      code: 'RTR-AL-01',
      address: '10 Main Road, Anna Nagar',
      phone: '9876543210',
      isActive: true,
      assignedEmployees: []
    },
    {
      id: 'shop-beta',
      name: 'Beta Telecom World',
      code: 'RTR-BT-02',
      address: '45 Cross St, T Nagar',
      phone: '9876543211',
      isActive: true,
      assignedEmployees: []
    }
  ];

  const mockRecords: BusinessRecord[] = [
    // Shop Alpha Record 1: 10 * 50 = 500, CP 800, Profit 300, Delivered
    {
      id: 'rec-a1',
      deliveryId: 'deliv-a1',
      date: '2026-10-05',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular Hub',
      productId: 'prod-glass',
      productName: 'Tempered Glass 9D',
      productSku: 'TG-9D',
      quantity: 10,
      unitPrice: 50,
      totalAmount: 500,
      customerPrice: 800,
      profit: 300,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-05T10:00:00Z'
    },
    // Shop Alpha Record 2: 4 * 250 = 1000, CP 1400, Profit 400, Delivered
    {
      id: 'rec-a2',
      deliveryId: 'deliv-a2',
      date: '2026-10-18',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular Hub',
      productId: 'prod-charger',
      productName: 'Fast Charger 25W',
      productSku: 'FC-25W',
      quantity: 4,
      unitPrice: 250,
      totalAmount: 1000,
      customerPrice: 1400,
      profit: 400,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-18T10:00:00Z'
    },
    // Shop Alpha Record 3: 2 * 250 = 500, CP null (missing), Pending
    {
      id: 'rec-a3',
      deliveryId: 'deliv-a3',
      date: '2026-10-22',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular Hub',
      productId: 'prod-charger',
      productName: 'Fast Charger 25W',
      productSku: 'FC-25W',
      quantity: 2,
      unitPrice: 250,
      totalAmount: 500,
      customerPrice: null,
      profit: null,
      deliveryStatus: 'pending',
      pendingAmount: 500,
      createdAt: '2026-10-22T10:00:00Z'
    },
    // Shop Alpha Record 4: September record (should be excluded from October statement)
    {
      id: 'rec-a-sept',
      deliveryId: 'deliv-a-sept',
      date: '2026-09-28',
      shopId: 'shop-alpha',
      shopName: 'Alpha Cellular Hub',
      productId: 'prod-glass',
      productName: 'Tempered Glass 9D',
      quantity: 20,
      unitPrice: 50,
      totalAmount: 1000,
      customerPrice: 1600,
      profit: 600,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-09-28T10:00:00Z'
    },
    // Shop Beta Record: Belongs to Shop Beta (must never leak into Shop Alpha statement)
    {
      id: 'rec-b1',
      deliveryId: 'deliv-b1',
      date: '2026-10-15',
      shopId: 'shop-beta',
      shopName: 'Beta Telecom World',
      productId: 'prod-case',
      productName: 'Silicone Shockproof Case',
      productSku: 'SC-PRO',
      quantity: 5,
      unitPrice: 200,
      totalAmount: 1000,
      customerPrice: 1600,
      profit: 600,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-15T10:00:00Z'
    }
  ];

  it('renders View Shop link with target="_blank" and rel="noopener noreferrer" in MonthlyShopStatement', () => {
    const html = renderToString(
      <MemoryRouter>
        <MonthlyShopStatement
          initialShops={mockShops}
          initialRecords={mockRecords}
        />
      </MemoryRouter>
    );

    // View Shop links exist
    expect(html).toContain('View Shop');
    // Open in new tab with opener protection
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    // Points to dedicated shop route with query params
    expect(html).toContain('/statements/shop/shop-alpha?month=10&amp;year=2026&amp;status=all');
    expect(html).toContain('/statements/shop/shop-beta?month=10&amp;year=2026&amp;status=all');
  });

  it('renders shop header with branding, shop name, shop code, and back navigation', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/shop-alpha?month=10&year=2026&status=all']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Branding & Header
    expect(html).toContain('Alpha Cellular Hub');
    expect(html).toContain('Shop ID: RTR-AL-01');
    expect(html).toContain('Monthly Purchase');
    expect(html).toContain('Profit Statement');
    expect(html).toContain('Back to Consolidated Statements');
    expect(html).toContain('October 2026');

    // Action buttons
    expect(html).toContain('Export CSV / Excel');
    expect(html).toContain('Print / PDF');
  });

  it('calculates accurate financial summary cards strictly for the selected shop in October 2026', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/shop-alpha?month=10&year=2026&status=all']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Wholesale Cost (Amount):
    // Record 1 (500) + Record 2 (1000) + Record 3 (500) = 2,000
    expect(html).toContain('₹2,000');

    // Customer Selling Price (CP):
    // Record 1 (800) + Record 2 (1400) = 2,200 (Record 3 is missing CP)
    expect(html).toContain('₹2,200');

    // Gross Profit:
    // Record 1 (300) + Record 2 (400) = +700
    expect(html).toContain('+₹700');

    // Missing CP Count: Record 3 is missing CP
    expect(html).toContain('1 records missing CP');

    // Orders Count: 3 orders, 16 total pcs (10 + 4 + 2)
    expect(html).toContain('3 Orders');
    expect(html).toContain('16 total pcs');
    expect(html).toContain('Del: 2 | Pend: 1');

    // Verify Shop Beta records are strictly excluded from Shop Alpha's financial cards
    expect(html).not.toContain('Silicone Shockproof Case');
    expect(html).not.toContain('Beta Telecom World');
  });

  it('renders Product-wise Purchase & Profit Breakdown grouped by actual product identity', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/shop-alpha?month=10&year=2026&status=all']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Section title
    expect(html).toContain('Product-wise Purchase');
    expect(html).toContain('Profit Breakdown');

    // Products supplied to Alpha:
    // 1. Fast Charger 25W (2 orders: qty 4 + 2 = 6 pcs, amount = 1500, CP = 1400, profit = 400)
    expect(html).toContain('Fast Charger 25W');
    expect(html).toContain('FC-25W');
    expect(html).toContain('6 pcs');

    // 2. Tempered Glass 9D (1 order: qty 10 pcs, amount = 500, CP = 800, profit = 300)
    expect(html).toContain('Tempered Glass 9D');
    expect(html).toContain('TG-9D');
    expect(html).toContain('10 pcs');

    // Table Headers
    expect(html).toContain('Total Qty');
    expect(html).toContain('Orders');
    expect(html).toContain('Wholesale Cost (₹)');
    expect(html).toContain('Customer Price (₹)');
    expect(html).toContain('Profit (₹)');
    expect(html).toContain('Margin');
  });

  it('renders Complete Transaction History with individual transaction details', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/shop-alpha?month=10&year=2026&status=all']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Title
    expect(html).toContain('Complete Transaction History');

    // Transaction rows
    expect(html).toContain('2026-10-05');
    expect(html).toContain('2026-10-18');
    expect(html).toContain('2026-10-22');

    // Pending record shows Not Recorded for CP and Not Available for Profit
    expect(html).toContain('Not Recorded');
    expect(html).toContain('Not Available');

    // Status badges
    expect(html).toContain('Delivered');
    expect(html).toContain('Pending');
  });

  it('respects Delivery Status filter (Delivered Only excludes Pending records)', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/shop-alpha?month=10&year=2026&status=delivered']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Delivered only Wholesale Cost: 500 + 1000 = 1500 (Record 3 is pending, excluded)
    expect(html).toContain('₹1,500');

    // Orders Count: 2 orders (Record 3 is pending, excluded)
    expect(html).toContain('2 Orders');
    expect(html).toContain('14 total pcs'); // 10 + 4

    // 0 missing CP because pending record with null CP is filtered out
    expect(html).toContain('All customer prices recorded');
  });

  it('renders clean error state when an invalid or non-existent shop ID is accessed', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/statements/shop/invalid-shop-999']}>
        <Routes>
          <Route 
            path="/statements/shop/:shopId" 
            element={<IndividualShopStatement initialShops={mockShops} initialRecords={mockRecords} />} 
          />
        </Routes>
      </MemoryRouter>
    );

    // Friendly error screen
    expect(html).toContain('Shop Not Found');
    expect(html).toContain('invalid-shop-999');
    expect(html).toContain('Back to Statements');
  });
});

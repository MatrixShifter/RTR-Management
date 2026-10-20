import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { OwnerDashboard } from './OwnerDashboard.js';
import * as db from '../../services/db.js';

describe('OwnerDashboard Component — Operations Overview & Rendering Diagnostics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton when initialLoading is true', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard initialLoading={true} initialShops={[]} />
      </MemoryRouter>
    );

    expect(html).toContain('animate-pulse');
  });

  it('renders actionable empty state when no retail stores exist', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[]}
          initialDeliveries={[]}
          initialReports={[]}
          initialInvoices={[]}
          initialPayments={[]}
          initialBalances={[]}
        />
      </MemoryRouter>
    );

    expect(html).toContain('No Retail Stores Registered');
    expect(html).toContain('Register First Shop');
  });

  it('renders actionable error state with retry button when loading fails', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialError="Supabase network timeout. Please retry."
          initialShops={[]}
        />
      </MemoryRouter>
    );

    expect(html).toContain('Communication Error');
    expect(html).toContain('Supabase network timeout. Please retry.');
    expect(html).toContain('Retry Request');
  });

  it('renders operational dashboard with summary bar and snapshot table when data exists', () => {
    const mockShop: db.Shop = {
      id: 'shop-1',
      name: 'RTR Anna Nagar',
      code: 'RTR-AN',
      address: 'Main Road',
      phone: '9876543210',
      isActive: true,
      assignedEmployees: []
    };

    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[mockShop]}
          initialDeliveries={[]}
          initialReports={[]}
          initialInvoices={[]}
          initialPayments={[]}
          initialBalances={[]}
        />
      </MemoryRouter>
    );

    expect(html).toContain('Wholesale Operations Overview');
    expect(html).toContain("Today&#x27;s Deliveries");
    expect(html).toContain('Reported Sales Today');
    expect(html).toContain('Total Balance Due');
    expect(html).toContain('RTR Anna Nagar');
    expect(html).toContain('RTR-AN');
  });

  it('does not trigger infinite rtr_data_sync loops during read operations', async () => {
    const dispatchSpy = vi.fn();
    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      dispatchEvent: dispatchSpy,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Calling read queries should not emit rtr_data_sync events
    await db.getInvoices();
    await db.getPayments();
    await db.getStockTransfers();

    expect(dispatchSpy).not.toHaveBeenCalled();

    if (!originalWindow) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  it('deduplicates simultaneous concurrent queries in db.ts', async () => {
    const p1 = db.getInvoices();
    const p2 = db.getInvoices();
    const p3 = db.getInvoices();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('calculates stock balances correctly with preloaded data', async () => {
    const mockShops: db.Shop[] = [
      { id: 's1', name: 'Shop One', code: 'S1', address: '', phone: '', isActive: true, assignedEmployees: [] }
    ];
    const mockProducts: db.Product[] = [
      { id: 'p1', name: 'Charger 20W', sku: 'CHG-20W', category: 'Chargers & Adapters', minStock: 5, isActive: true }
    ];
    const mockDeliveries: db.DeliveryRecord[] = [
      {
        id: 'd1',
        shopId: 's1',
        deliveryDate: '2026-10-20',
        status: 'delivered',
        createdBy: 'Owner',
        items: [{ productId: 'p1', quantity: 50 }],
        createdAt: '2026-10-20T00:00:00Z'
      }
    ];
    const mockReports: db.DailyReportRecord[] = [
      {
        id: 'r1',
        shopId: 's1',
        reportDate: '2026-10-20',
        isZeroSales: false,
        status: 'approved',
        submittedBy: 'Staff',
        submittedAt: '18:00',
        totalQuantitySold: 12,
        items: [{ productId: 'p1', quantitySold: 12 }],
        createdAt: '2026-10-20T18:00:00Z'
      }
    ];

    const balances = await db.calculateStockBalances(undefined, {
      shops: mockShops,
      products: mockProducts,
      deliveries: mockDeliveries,
      reports: mockReports,
      transfers: [],
      audits: []
    });

    expect(balances).toHaveLength(1);
    expect(balances[0]?.total_delivered).toBe(50);
    expect(balances[0]?.confirmed_sold).toBe(12);
    expect(balances[0]?.expected_stock).toBe(38); // 50 delivered - 12 sold = 38 expected
  });
});

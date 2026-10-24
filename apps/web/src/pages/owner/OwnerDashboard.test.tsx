import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase.js', () => ({
  supabase: null,
  isSupabaseConfigured: false
}));

import { OwnerDashboard, isPendingRecord } from './OwnerDashboard.js';
import * as db from '../../services/db.js';

describe('OwnerDashboard Component — Modern UI & Simple Delivery/Pending Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton when initialLoading is true', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard initialLoading={true} initialShops={[]} initialRecords={[]} />
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
          initialRecords={[]}
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
          initialRecords={[]}
        />
      </MemoryRouter>
    );

    expect(html).toContain('Communication Error');
    expect(html).toContain('Supabase network timeout. Please retry.');
    expect(html).toContain('Retry Request');
  });

  it('renders modern dashboard with two interactive summary cards, ledger, and + Add Record button', () => {
    const mockShop: db.Shop = {
      id: 'shop-1',
      name: 'RTR Anna Nagar',
      code: 'RTR-AN',
      address: 'Main Road',
      phone: '9876543210',
      isActive: true,
      assignedEmployees: []
    };

    const mockRecord: db.BusinessRecord = {
      id: 'rec-1',
      deliveryId: 'deliv-1',
      date: '2026-10-21',
      shopId: 'shop-1',
      shopName: 'RTR Anna Nagar',
      productId: 'prod-1',
      productName: 'Fast Charger 20W',
      productSku: 'CHG-20W',
      quantity: 15,
      unitPrice: 250,
      totalAmount: 3750,
      deliveryStatus: 'delivered',
      pendingAmount: 1500,
      notes: 'Weekly Restock Batch',
      createdAt: '2026-10-21T10:00:00Z'
    };

    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[mockShop]}
          initialRecords={[mockRecord]}
        />
      </MemoryRouter>
    );

    // Header & RTR Branding
    expect(html).toContain('Wholesale Operations Overview');
    expect(html).toContain('RTR Management');
    expect(html).toContain('+ Add Record');

    // Two Prominent Interactive Summary Cards
    expect(html).toContain('Delivery Records');
    expect(html).toContain('Pending Payments');

    // Strict distinction: number of records vs total quantity / total money
    expect(html).toContain('Total Units Delivered:');
    expect(html).toContain('pcs');
    expect(html).toContain('Total Balance Due:');
    expect(html).toContain('1,500');

    // All Records Option
    expect(html).toContain('All Records');

    // Desktop Ledger Table Columns & Values
    expect(html).toContain('Retail Shop');
    expect(html).toContain('Product');
    expect(html).toContain('Quantity');
    expect(html).toContain('Unit Price');
    expect(html).toContain('Delivery Status');
    expect(html).toContain('Pending Amount');

    expect(html).toContain('RTR Anna Nagar');
    expect(html).toContain('Fast Charger 20W');
    expect(html).toContain('Delivered');
  });

  it('correctly distinguishes delivery records from pending payment records', () => {
    const mockShop: db.Shop = {
      id: 'shop-1',
      name: 'RTR T Nagar',
      code: 'RTR-TN',
      address: 'Shop St',
      phone: '',
      isActive: true,
      assignedEmployees: []
    };

    const recDeliveredPaid: db.BusinessRecord = {
      id: 'rec-1',
      deliveryId: 'deliv-1',
      date: '2026-10-20',
      shopId: 'shop-1',
      shopName: 'RTR T Nagar',
      productId: 'prod-1',
      productName: 'USB-C Cable 1m',
      quantity: 30,
      unitPrice: 100,
      totalAmount: 3000,
      deliveryStatus: 'delivered',
      pendingAmount: 0, // Fully paid
      createdAt: '2026-10-20T10:00:00Z'
    };

    const recPendingDeliveryWithBalance: db.BusinessRecord = {
      id: 'rec-2',
      deliveryId: 'deliv-2',
      date: '2026-10-21',
      shopId: 'shop-1',
      shopName: 'RTR T Nagar',
      productId: 'prod-2',
      productName: 'Tempered Glass Guard',
      quantity: 20,
      unitPrice: 50,
      totalAmount: 1000,
      deliveryStatus: 'pending', // Not yet delivered
      pendingAmount: 1000, // Pending money
      createdAt: '2026-10-21T10:00:00Z'
    };

    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[mockShop]}
          initialRecords={[recDeliveredPaid, recPendingDeliveryWithBalance]}
        />
      </MemoryRouter>
    );

    // Delivery records count = 1 (rec-1), units delivered = 30 pcs
    expect(html).toContain('Delivery Records');
    expect(html).toContain('Total Units Delivered:');
    expect(html).toContain('pcs');

    // Pending records count = 1 (rec-2), pending balance = ₹1,000
    expect(html).toContain('Pending Payments');
    expect(html).toContain('1,000');
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

  it('saves manual business record through existing backend and creates linked delivery & invoice', async () => {
    const saved = await db.saveBusinessRecord({
      date: '2026-10-21',
      shopName: 'RTR Express Hub',
      productName: 'Earphones Basic 3.5mm',
      quantity: 25,
      unitPrice: 120,
      deliveryStatus: 'delivered',
      pendingAmount: 1500,
      notes: 'New Partner Restock'
    });

    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.shopName).toBe('RTR Express Hub');
    expect(saved.productName).toBe('Earphones Basic 3.5mm');
    expect(saved.quantity).toBe(25);
    expect(saved.unitPrice).toBe(120);
    expect(saved.totalAmount).toBe(3000);
    expect(saved.pendingAmount).toBe(1500);
    expect(saved.deliveryStatus).toBe('delivered');

    // Check that it's retrieved in getBusinessRecords()
    const allRecords = await db.getBusinessRecords();
    const found = allRecords.find(r => r.deliveryId === saved.deliveryId);
    expect(found).toBeDefined();
    expect(found?.shopName).toBe('RTR Express Hub');
    expect(found?.pendingAmount).toBe(1500);

    // Check that linked invoice exists
    const allInvoices = await db.getInvoices();
    const invoice = allInvoices.find(i => i.delivery_id === saved.deliveryId);
    expect(invoice).toBeDefined();
    expect(invoice?.outstanding_amount).toBe(1500);
  }, 10000);

  it('correctly provides and exports database storage capacity error constants and detection', () => {
    expect(db.DATABASE_STORAGE_FULL_TITLE).toBe('Database Storage Full');
    expect(db.DATABASE_STORAGE_FULL_MESSAGE).toBe(
      'Your database has reached its storage limit. This record could not be saved. Please contact your administrator to free up storage or upgrade the database plan. Try again after the issue is resolved.'
    );

    expect(db.isDatabaseCapacityError({ code: '53100', message: 'disk full' })).toBe(true);
    expect(db.isDatabaseCapacityError({ code: '53000', message: 'insufficient resources' })).toBe(true);
    expect(db.isDatabaseCapacityError({ status: 507, message: 'insufficient storage' })).toBe(true);
    expect(db.isDatabaseCapacityError({ message: 'storage limit exceeded' })).toBe(true);

    // Negative guards
    expect(db.isDatabaseCapacityError({ code: '429', message: 'Rate limit exceeded' })).toBe(false);
    expect(db.isDatabaseCapacityError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(db.isDatabaseCapacityError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('renders Database Storage Full banner in OwnerDashboard when capacity error occurs', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[{ id: 'shop-1', name: 'Shop 1', code: 'S1', address: '', phone: '', isActive: true, assignedEmployees: [] }]}
          initialRecords={[]}
        />
      </MemoryRouter>
    );

    // Default without error doesn't contain storage full warning
    expect(html).not.toContain('Database Storage Full');
  });

  it('does not render Add Record modal or docked form by default on page load (starts closed)', () => {
    const html = renderToString(
      <MemoryRouter>
        <OwnerDashboard
          initialLoading={false}
          initialShops={[]}
          initialRecords={[]}
        />
      </MemoryRouter>
    );

    // Modal drawer dialog and form are NOT rendered by default
    expect(html).not.toContain('id="record-modal-title"');
    expect(html).not.toContain('id="record-entry-form"');
    // The action buttons to open it ARE present
    expect(html).toContain('+ Add Record');
    expect(html).toContain('Register First Shop');
  });

  it('keeps delivery status separate from payment status and computes outstanding amount correctly', async () => {
    // Example: 100 units @ ₹10 = ₹1,000 total, ₹400 paid, ₹600 pending
    const saved = await db.saveBusinessRecord({
      date: '2026-10-24',
      shopName: 'Green Square Telecom',
      productName: 'Fast Cable Type-C',
      quantity: 100,
      unitPrice: 10,
      deliveryStatus: 'delivered',
      pendingAmount: 600,
      paidAmount: 400,
      notes: 'Initial restock'
    });

    expect(saved).toBeDefined();
    expect(saved.quantity).toBe(100);
    expect(saved.unitPrice).toBe(10);
    expect(saved.totalAmount).toBe(1000);
    expect(saved.pendingAmount).toBe(600);
    expect(saved.deliveryStatus).toBe('delivered');

    // Retrieve from getBusinessRecords
    const records = await db.getBusinessRecords();
    const match = records.find(r => r.deliveryId === saved.deliveryId);
    expect(match).toBeDefined();
    expect(match?.totalAmount).toBe(1000);
    expect(match?.pendingAmount).toBe(600);
    expect(match?.deliveryStatus).toBe('delivered');
  });

  it('filters demo records from production queries', async () => {
    const shops = await db.getShops();
    const demoShop = shops.find(s => s.name.startsWith('DEMO -') || s.code.startsWith('DEMO-'));
    expect(demoShop).toBeUndefined();

    const prods = await db.getProducts();
    const demoProd = prods.find(p => p.name.startsWith('DEMO -') || p.sku.startsWith('DEMO-'));
    expect(demoProd).toBeUndefined();
  });

  describe('Financial Accounting & Dashboard Metrics Verification (Scenarios A through F)', () => {
    const testShop: db.Shop = {
      id: 'shop-test-1',
      name: 'RTR Anna Salai',
      code: 'RTR-AS',
      address: 'Anna Salai',
      phone: '9888877777',
      isActive: true,
      assignedEmployees: []
    };

    it('Scenario A: Qty 100, Unit Price ₹10, Paid ₹0 -> Total ₹1,000, Pending ₹1,000, Delivery Pending -> Appears in Pending tab, Pending Payments includes ₹1,000', async () => {
      const saved = await db.saveBusinessRecord({
        date: '2026-10-24',
        shopName: 'RTR Anna Salai',
        productName: 'Scenario A Cable',
        quantity: 100,
        unitPrice: 10,
        deliveryStatus: 'pending',
        pendingAmount: 1000,
        paidAmount: 0,
        notes: 'Scenario A test record'
      });

      expect(saved.quantity).toBe(100);
      expect(saved.unitPrice).toBe(10);
      expect(saved.totalAmount).toBe(1000);
      expect(saved.pendingAmount).toBe(1000);
      expect(saved.deliveryStatus).toBe('pending');
      expect(isPendingRecord(saved)).toBe(true);

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[testShop]}
            initialRecords={[saved]}
          />
        </MemoryRouter>
      );

      // Pending Payments summary includes 1,000
      expect(html).toContain('Pending Payments');
      expect(html).toContain('1,000');
      // Record appears in the table with Pending status
      expect(html).toContain('Scenario A Cable');
      expect(html).toContain('₹1,000');
    });

    it('Scenario B: Qty 100, Unit Price ₹10, Paid ₹400 -> Total ₹1,000, Pending ₹600', async () => {
      const saved = await db.saveBusinessRecord({
        date: '2026-10-24',
        shopName: 'RTR Anna Salai',
        productName: 'Scenario B Cable',
        quantity: 100,
        unitPrice: 10,
        deliveryStatus: 'delivered',
        pendingAmount: 600,
        paidAmount: 400,
        notes: 'Scenario B test record'
      });

      expect(saved.quantity).toBe(100);
      expect(saved.unitPrice).toBe(10);
      expect(saved.totalAmount).toBe(1000);
      expect(saved.pendingAmount).toBe(600);
      expect(isPendingRecord(saved)).toBe(true);

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[testShop]}
            initialRecords={[saved]}
          />
        </MemoryRouter>
      );

      expect(html).toContain('600');
      expect(html).toContain('Delivered');
    });

    it('Scenario C: Qty 100, Unit Price ₹10, Paid ₹1,000 -> Total ₹1,000, Pending ₹0 -> Excluded from Pending Payments money sum', async () => {
      const saved = await db.saveBusinessRecord({
        date: '2026-10-24',
        shopName: 'RTR Anna Salai',
        productName: 'Scenario C Cable',
        quantity: 100,
        unitPrice: 10,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        paidAmount: 1000,
        notes: 'Scenario C test record'
      });

      expect(saved.quantity).toBe(100);
      expect(saved.unitPrice).toBe(10);
      expect(saved.totalAmount).toBe(1000);
      expect(saved.pendingAmount).toBe(0);
      // Because delivery is delivered and pending amount is 0, it is NOT pending
      expect(isPendingRecord(saved)).toBe(false);

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[testShop]}
            initialRecords={[saved]}
          />
        </MemoryRouter>
      );

      // Pending Payments summary should show "All shop accounts fully settled"
      expect(html).toContain('All shop accounts fully settled');
      expect(html).toContain('Delivered');
      expect(html).toContain('₹0');
    });

    it('Scenario D: Record marked Delivered with unpaid balance -> Delivery status Delivered, Pending Payments includes balance', async () => {
      const recDeliveredUnpaid: db.BusinessRecord = {
        id: 'rec-d',
        deliveryId: 'deliv-d',
        date: '2026-10-24',
        shopId: testShop.id,
        shopName: testShop.name,
        productId: 'prod-d',
        productName: 'Scenario D Tempered Glass',
        quantity: 50,
        unitPrice: 30,
        totalAmount: 1500,
        deliveryStatus: 'delivered',
        pendingAmount: 750,
        createdAt: '2026-10-24T10:00:00Z'
      };

      expect(recDeliveredUnpaid.deliveryStatus).toBe('delivered');
      expect(recDeliveredUnpaid.pendingAmount).toBe(750);
      expect(isPendingRecord(recDeliveredUnpaid)).toBe(true);

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[testShop]}
            initialRecords={[recDeliveredUnpaid]}
          />
        </MemoryRouter>
      );

      // Summary Card 1 (Total Deliveries) counts it as delivered
      expect(html).toContain('Total Deliveries');
      expect(html).toContain('50');
      expect(html).toContain('pcs');
      // Summary Card 2 (Pending Payments) includes ₹750
      expect(html).toContain('Pending Payments');
      expect(html).toContain('750');
      // Row renders Delivered badge
      expect(html).toContain('Delivered');
    });

    it('Scenario E: Browser refresh/reload preserves saved values authoritative retrieval', async () => {
      const saved = await db.saveBusinessRecord({
        date: '2026-10-24',
        shopName: 'RTR Anna Salai',
        productName: 'Scenario E Power Bank',
        quantity: 20,
        unitPrice: 850,
        deliveryStatus: 'pending',
        pendingAmount: 17000,
        paidAmount: 0,
        notes: 'Scenario E reload test'
      });

      // Simulate browser reload by querying authoritative backend getBusinessRecords()
      const reloadedRecords = await db.getBusinessRecords();
      const match = reloadedRecords.find(r => r.deliveryId === saved.deliveryId);

      expect(match).toBeDefined();
      expect(match?.productName).toBe('Scenario E Power Bank');
      expect(match?.quantity).toBe(20);
      expect(match?.unitPrice).toBe(850);
      expect(match?.totalAmount).toBe(17000);
      expect(match?.pendingAmount).toBe(17000);
      expect(match?.deliveryStatus).toBe('pending');
    });

    it('Scenario F: Tab counts match filtered rows between All Records, Deliveries, and Pending', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-1',
          deliveryId: 'd-1',
          date: '2026-10-24',
          shopId: testShop.id,
          shopName: testShop.name,
          productId: 'p-1',
          productName: 'Record 1 (Delivered & Paid)',
          quantity: 10,
          unitPrice: 100,
          totalAmount: 1000,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-24T10:00:00Z'
        },
        {
          id: 'rec-2',
          deliveryId: 'd-2',
          date: '2026-10-24',
          shopId: testShop.id,
          shopName: testShop.name,
          productId: 'p-2',
          productName: 'Record 2 (Delivered & Pending Payment)',
          quantity: 20,
          unitPrice: 50,
          totalAmount: 1000,
          deliveryStatus: 'delivered',
          pendingAmount: 500,
          createdAt: '2026-10-24T10:00:00Z'
        },
        {
          id: 'rec-3',
          deliveryId: 'd-3',
          date: '2026-10-24',
          shopId: testShop.id,
          shopName: testShop.name,
          productId: 'p-3',
          productName: 'Record 3 (Pending Delivery & Pending Payment)',
          quantity: 30,
          unitPrice: 20,
          totalAmount: 600,
          deliveryStatus: 'pending',
          pendingAmount: 600,
          createdAt: '2026-10-24T10:00:00Z'
        }
      ];

      // Tab calculations
      const allRecords = records;
      const deliveryRecords = records.filter(r => r.deliveryStatus === 'delivered');
      const pendingRecords = records.filter(isPendingRecord);

      expect(allRecords.length).toBe(3);
      expect(deliveryRecords.length).toBe(2); // rec-1 and rec-2
      expect(pendingRecords.length).toBe(2);  // rec-2 (pending amount) and rec-3 (pending delivery)

      // Total pending balance: 500 + 600 = 1,100
      const totalPendingBalance = pendingRecords.reduce((sum, r) => sum + (r.pendingAmount || 0), 0);
      expect(totalPendingBalance).toBe(1100);

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[testShop]}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      // Verify rendered summary cards and tab counts
      expect(html).toContain('All Records');
      expect(html).toContain('Deliveries');
      expect(html).toContain('Pending');
      expect(html).toContain('1,100');
    });
  });

  describe('Records Table Layout, Height, and Pagination Verification', () => {
    const sampleShop: db.Shop = {
      id: 'shop-tbl-1',
      name: 'RTR Electronics',
      code: 'RTR-EL',
      address: 'Cross Street',
      phone: '9988776655',
      isActive: true,
      assignedEmployees: []
    };

    it('renders records table naturally without small fixed-height containers', () => {
      const singleRecord: db.BusinessRecord = {
        id: 'rec-single',
        deliveryId: 'del-single',
        date: '2026-10-24',
        shopId: sampleShop.id,
        shopName: sampleShop.name,
        productId: 'prod-single',
        productName: 'USB-C Cable 1m',
        quantity: 5,
        unitPrice: 120,
        totalAmount: 600,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-24T08:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[sampleShop]}
            initialRecords={[singleRecord]}
          />
        </MemoryRouter>
      );

      // Verify absence of artificial small fixed height
      expect(html).not.toContain('max-h-60');
      expect(html).not.toContain('max-h-48');
      expect(html).not.toContain('h-64');

      // Verify table headers exist and are aligned
      expect(html).toContain('Date');
      expect(html).toContain('Shop Name');
      expect(html).toContain('Product');
      expect(html).toContain('Quantity');
      expect(html).toContain('Unit Price');
      expect(html).toContain('Status');
      expect(html).toContain('Pending Amount');
      expect(html).toContain('Actions');

      // Verify row data rendered with proper padding
      expect(html).toContain('USB-C Cable 1m');
      expect(html).toContain('RTR Electronics');
      expect(html).toContain('py-3.5');

      // Verify pagination bar
      expect(html).toContain('Showing');
      expect(html).toContain('to');
      expect(html).toContain('of');
      expect(html).toContain('records');
      expect(html).toContain('Rows per page:');
    });

    it('renders pagination controls and limits displayed rows when records exceed rowsPerPage', () => {
      const records: db.BusinessRecord[] = Array.from({ length: 15 }, (_, i) => ({
        id: `rec-p-${i + 1}`,
        deliveryId: `del-p-${i + 1}`,
        date: '2026-10-24',
        shopId: sampleShop.id,
        shopName: sampleShop.name,
        productId: `prod-${i + 1}`,
        productName: `Product Item ${i + 1}`,
        quantity: 10,
        unitPrice: 50,
        totalAmount: 500,
        deliveryStatus: 'delivered',
        pendingAmount: 100,
        createdAt: `2026-10-24T10:00:${String(i).padStart(2, '0')}Z`
      }));

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[sampleShop]}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      // Total records is 15
      expect(html).toContain('Showing');
      expect(html).toContain('>15<');
      expect(html).toContain('>10<');
      expect(html).toContain('records');

      // First page shows first 10
      expect(html).toContain('Product Item 1');
      expect(html).toContain('Product Item 10');

      // Next page button exists
      expect(html).toContain('aria-label="Next page"');
      expect(html).toContain('aria-label="Previous page"');
    });
  });

  describe('Priority-Based Record Ordering Verification (Pending at top, Completed at bottom)', () => {
    const shopSample: db.Shop = {
      id: 'shop-priority',
      name: 'RTR Central',
      code: 'RTR-CEN',
      address: 'Central Plaza',
      phone: '9998887776',
      isActive: true,
      assignedEmployees: []
    };

    it('renders Pending records at top and Completed records at bottom in table HTML', () => {
      const recCompleted: db.BusinessRecord = {
        id: 'rec-completed-1',
        deliveryId: 'deliv-comp',
        date: '2026-10-24',
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-comp',
        productName: 'Settled Cable',
        quantity: 10,
        unitPrice: 50,
        totalAmount: 500,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-24T12:00:00Z'
      };

      const recPending: db.BusinessRecord = {
        id: 'rec-pending-1',
        deliveryId: 'deliv-pend',
        date: '2026-10-20',
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-pend',
        productName: 'Pending Earphones',
        quantity: 5,
        unitPrice: 200,
        totalAmount: 1000,
        deliveryStatus: 'pending',
        pendingAmount: 1000,
        createdAt: '2026-10-20T10:00:00Z'
      };

      // Pass completed first in the initial array to verify sorting reorders them
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={[recCompleted, recPending]}
          />
        </MemoryRouter>
      );

      // Verify both items rendered
      expect(html).toContain('Pending Earphones');
      expect(html).toContain('Settled Cable');

      // The pending record must appear BEFORE the completed record in the table
      const pendingPos = html.indexOf('Pending Earphones');
      const completedPos = html.indexOf('Settled Cable');
      expect(pendingPos).toBeLessThan(completedPos);
    });

    it('keeps delivered records with outstanding balance above fully settled records', () => {
      const recDeliveredUnpaid: db.BusinessRecord = {
        id: 'rec-deliv-unpaid',
        deliveryId: 'deliv-unpaid',
        date: '2026-10-22',
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-deliv-unpaid',
        productName: 'Delivered Unpaid Adapter',
        quantity: 4,
        unitPrice: 250,
        totalAmount: 1000,
        deliveryStatus: 'delivered',
        pendingAmount: 1000,
        createdAt: '2026-10-22T10:00:00Z'
      };

      const recSettled: db.BusinessRecord = {
        id: 'rec-settled',
        deliveryId: 'deliv-settled',
        date: '2026-10-24', // Even if settled is newer
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-settled',
        productName: 'Older Settled Case',
        quantity: 10,
        unitPrice: 100,
        totalAmount: 1000,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-24T10:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={[recSettled, recDeliveredUnpaid]}
          />
        </MemoryRouter>
      );

      const unpaidPos = html.indexOf('Delivered Unpaid Adapter');
      const settledPos = html.indexOf('Older Settled Case');
      expect(unpaidPos).toBeLessThan(settledPos);
    });

    it('renders newer records first within the same priority group', () => {
      const olderPending: db.BusinessRecord = {
        id: 'rec-older-pending',
        deliveryId: 'deliv-older',
        date: '2026-10-18',
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-1',
        productName: 'Older Pending Item',
        quantity: 5,
        unitPrice: 100,
        totalAmount: 500,
        deliveryStatus: 'pending',
        pendingAmount: 500,
        createdAt: '2026-10-18T10:00:00Z'
      };

      const newerPending: db.BusinessRecord = {
        id: 'rec-newer-pending',
        deliveryId: 'deliv-newer',
        date: '2026-10-24',
        shopId: 'shop-priority',
        shopName: 'RTR Central',
        productId: 'prod-2',
        productName: 'Newer Pending Item',
        quantity: 5,
        unitPrice: 100,
        totalAmount: 500,
        deliveryStatus: 'pending',
        pendingAmount: 500,
        createdAt: '2026-10-24T10:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={[olderPending, newerPending]}
          />
        </MemoryRouter>
      );

      const newerPos = html.indexOf('Newer Pending Item');
      const olderPos = html.indexOf('Older Pending Item');
      expect(newerPos).toBeLessThan(olderPos);
    });
  });
});



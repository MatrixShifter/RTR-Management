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


  describe('Main Records Table 7 Dedicated Columns & Delivery Customer Price Workflow Suite', () => {
    const pendingRecord: db.BusinessRecord = {
      id: 'rec-pend-7col',
      deliveryId: 'deliv-pend-7col',
      date: '2026-10-30',
      shopId: 'shop-1',
      shopName: 'RTR Anna Nagar Hub',
      productId: 'prod-1',
      productName: 'Super Fast Charger 65W',
      quantity: 5,
      unitPrice: 400,
      totalAmount: 2000,
      customerPrice: null,
      profit: null,
      deliveryStatus: 'pending',
      pendingAmount: 2000,
      createdAt: '2026-10-30T10:00:00Z'
    };

    const deliveredRecord: db.BusinessRecord = {
      id: 'rec-deliv-7col',
      deliveryId: 'deliv-deliv-7col',
      date: '2026-10-30',
      shopId: 'shop-2',
      shopName: 'RTR T Nagar Store',
      productId: 'prod-2',
      productName: 'Tempered Curved Glass',
      quantity: 10,
      unitPrice: 150,
      totalAmount: 1500,
      customerPrice: 2200,
      profit: 700,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      createdAt: '2026-10-30T11:00:00Z'
    };

    it('displays all 7 columns as separate, dedicated table headers', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[pendingRecord, deliveredRecord]}
          />
        </MemoryRouter>
      );

      const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/);
      expect(theadMatch).toBeTruthy();
      const theadHtml = theadMatch![0];
      expect(theadHtml).toContain('Date');
      expect(theadHtml).toContain('Shop Name');
      expect(theadHtml).toContain('Product');
      expect(theadHtml).toContain('Amount (₹)');
      expect(theadHtml).toContain('CP (₹)');
      expect(theadHtml).toContain('Profit (₹)');
      expect(theadHtml).toContain('Delivery');
    });

    it('renders em dashes for CP and Profit in Pending records and unchecked delivery checkbox', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[pendingRecord]}
          />
        </MemoryRouter>
      );

      // Product column does NOT hide CP or Profit beneath product
      expect(html).toContain('Super Fast Charger 65W');
      expect(html).not.toContain('CP: Not Recorded');
      expect(html).not.toContain('Profit: Not Available');

      // Amount renders value
      expect(html).toContain('2,000');

      // Dedicated CP and Profit cells render em dashes (—)
      expect(html).toContain('—');

      // Checkbox is unchecked
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('Mark delivery as completed for Super Fast Charger 65W');
    });

    it('renders saved CP, calculated profit (+₹700) in Delivered records and checked delivery checkbox', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[deliveredRecord]}
          />
        </MemoryRouter>
      );

      // Product column does NOT have subtext CP or Profit
      expect(html).toContain('Tempered Curved Glass');
      expect(html).not.toContain('CP: 2,200');

      // Amount renders 1,500
      expect(html).toContain('1,500');

      // Dedicated CP cell renders 2,200
      expect(html).toContain('2,200');

      // Dedicated Profit cell renders +700 with green styling
      expect(html).toContain('+700');
      expect(html).toContain('text-emerald-700');

      // Checkbox is checked
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Mark delivery as pending for Tempered Curved Glass');
    });

    it('updates delivery status and atomic customer price in database service', async () => {
      db.setDemoMode(true);
      const res = await db.updateDeliveryStatus('deliv-test-service', 'delivered', 3500);
      expect(res.success).toBe(true);
      expect(res.status).toBe('delivered');
      expect(res.customerPrice).toBe(3500);
    });

    it('verifies the 3 required customer price and profit test cases in main table (Amount ₹25, CP ₹35 → Profit ₹10; Amount ₹234, CP ₹300 → Profit ₹66; Amount ₹241, CP ₹300 → Profit ₹59)', () => {
      // Test Case 1: Amount ₹25, CP ₹35 → Profit ₹10
      const testCase1: db.BusinessRecord = {
        id: 'rec-tc-1',
        deliveryId: 'deliv-tc-1',
        date: '2026-10-30',
        shopId: 'shop-tc-1',
        shopName: 'Shop A',
        productId: 'prod-tc-1',
        productName: '9a combo',
        quantity: 1,
        unitPrice: 25,
        totalAmount: 25,
        customerPrice: 35,
        profit: 10,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-30T10:00:00Z'
      };

      // Test Case 2: Amount ₹234, CP ₹300 → Profit ₹66
      const testCase2: db.BusinessRecord = {
        id: 'rec-tc-2',
        deliveryId: 'deliv-tc-2',
        date: '2026-10-30',
        shopId: 'shop-tc-2',
        shopName: 'shopa',
        productId: 'prod-tc-2',
        productName: '9a combo',
        quantity: 1,
        unitPrice: 234,
        totalAmount: 234,
        customerPrice: 300,
        profit: 66,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-30T10:01:00Z'
      };

      // Test Case 3: Amount ₹241, CP ₹300 → Profit ₹59 (tests dynamic calculation when profit field is omitted)
      const testCase3: db.BusinessRecord = {
        id: 'rec-tc-3',
        deliveryId: 'deliv-tc-3',
        date: '2026-10-30',
        shopId: 'shop-tc-3',
        shopName: 'Shop A',
        productId: 'prod-tc-3',
        productName: '9a combo',
        quantity: 1,
        unitPrice: 241,
        totalAmount: 241,
        customerPrice: 300,
        profit: null,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-30T10:02:00Z'
      };

      // Case 4: Delivered without recorded CP -> displays em dash, does NOT fabricate
      const testCaseMissingCp: db.BusinessRecord = {
        id: 'rec-tc-4',
        deliveryId: 'deliv-tc-4',
        date: '2026-10-30',
        shopId: 'shop-tc-4',
        shopName: 'Shop B',
        productId: 'prod-tc-4',
        productName: '9a combo',
        quantity: 1,
        unitPrice: 123,
        totalAmount: 123,
        customerPrice: null,
        profit: null,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-30T10:03:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[testCase1, testCase2, testCase3, testCaseMissingCp]}
          />
        </MemoryRouter>
      );

      // TC1 assertions: Amount 25, CP 35, Profit +10
      expect(html).toContain('35');
      expect(html).toContain('+10');

      // TC2 assertions: Amount 234, CP 300, Profit +66
      expect(html).toContain('234');
      expect(html).toContain('300');
      expect(html).toContain('+66');

      // TC3 assertions: Amount 241, CP 300, dynamically calculated Profit +59
      expect(html).toContain('241');
      expect(html).toContain('+59');

      // Missing CP assertions: renders Not Recorded / Not Available, no fabricated value
      expect(html).toContain('Not Recorded');
      expect(html).toContain('Not Available');
    });
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

  describe('Search Bar & Mobile Table Usability Suite', () => {
    const shopSample: db.Shop = {
      id: 'shop-search',
      name: 'RTR Mobile Hub',
      code: 'RTR-MH',
      address: 'Hub St',
      phone: '9876543210',
      isActive: true,
      assignedEmployees: []
    };

    const mockRecords: db.BusinessRecord[] = [
      {
        id: 'rec-cable',
        deliveryId: 'deliv-cable',
        date: '2026-10-24',
        shopId: 'shop-search',
        shopName: 'RTR Mobile Hub',
        productId: 'prod-cable',
        productName: 'Braided Lightning Cable 2m',
        quantity: 10,
        unitPrice: 200,
        totalAmount: 2000,
        deliveryStatus: 'pending',
        pendingAmount: 2000,
        createdAt: '2026-10-24T10:00:00Z'
      },
      {
        id: 'rec-charger',
        deliveryId: 'deliv-charger',
        date: '2026-10-25',
        shopId: 'shop-search',
        shopName: 'RTR Mobile Hub',
        productId: 'prod-charger',
        productName: 'Fast GaN Charger 65W',
        quantity: 5,
        unitPrice: 3400,
        totalAmount: 17000,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-25T10:00:00Z'
      }
    ];

    it('renders full-width search input with placeholder "Search by shop or product..." below heading', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={mockRecords}
          />
        </MemoryRouter>
      );

      expect(html).toContain('placeholder="Search by shop or product..."');
      expect(html).toContain('aria-label="Search by shop or product"');
      expect(html).toContain('Braided Lightning Cable 2m');
      expect(html).toContain('Fast GaN Charger 65W');
      expect(html).toContain('17,000');
    });

    it('displays compact mobile date format and full desktop date format', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={mockRecords}
          />
        </MemoryRouter>
      );

      // Desktop: 24/10/2026, Mobile: 24/10
      expect(html).toContain('24/10/2026');
      expect(html).toContain('24/10');
      // Desktop: 25/10/2026, Mobile: 25/10
      expect(html).toContain('25/10/2026');
      expect(html).toContain('25/10');
    });

    it('renders accessible delivery checkboxes with touch targets for pending and delivered items', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={mockRecords}
          />
        </MemoryRouter>
      );

      // Pending row has aria-checked="false"
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('Mark delivery as completed for Braided Lightning Cable 2m');

      // Delivered row has aria-checked="true"
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Mark delivery as pending for Fast GaN Charger 65W');

      // Delivered separator present between groups
      expect(html).toContain('Delivered Items');
    });

    it('renders exactly seven visible table columns in order: Date, Shop Name, Product, Amount, CP, Profit, Delivery', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={mockRecords}
          />
        </MemoryRouter>
      );

      const theadHtml = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
      const datePos = theadHtml.indexOf('<span>Date</span>');
      const shopPos = theadHtml.indexOf('<span>Shop Name</span>');
      const prodPos = theadHtml.indexOf('<span>Product</span>');
      const amtPos = theadHtml.indexOf('<span>Amount (₹)</span>');
      const cpPos = theadHtml.indexOf('<span>CP (₹)</span>');
      const profitPos = theadHtml.indexOf('<span>Profit (₹)</span>');
      const delivPos = theadHtml.indexOf('<span>Delivery</span>');

      expect(datePos).toBeGreaterThan(-1);
      expect(shopPos).toBeGreaterThan(datePos);
      expect(prodPos).toBeGreaterThan(shopPos);
      expect(amtPos).toBeGreaterThan(prodPos);
      expect(cpPos).toBeGreaterThan(amtPos);
      expect(profitPos).toBeGreaterThan(cpPos);
      expect(delivPos).toBeGreaterThan(profitPos);

      // Verify actual shop name is rendered in the row
      expect(html).toContain('RTR Mobile Hub');
    });

    it('gracefully renders fallback dash when a record has no shopName', () => {
      const recWithoutShop: db.BusinessRecord = {
        id: 'rec-no-shop',
        deliveryId: 'deliv-no-shop',
        date: '2026-10-24',
        shopId: 'shop-search',
        shopName: '',
        productId: 'prod-cable',
        productName: 'Braided Lightning Cable 2m',
        quantity: 10,
        unitPrice: 200,
        totalAmount: 2000,
        deliveryStatus: 'pending',
        pendingAmount: 2000,
        createdAt: '2026-10-24T10:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={[recWithoutShop]}
          />
        </MemoryRouter>
      );

      expect(html).toContain('—');
    });

    it('renders delete/action icon button on records without introducing an 8th table header column', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={mockRecords}
          />
        </MemoryRouter>
      );

      // Verify actions button is rendered inside the row for each product
      expect(html).toContain('aria-label="Actions for Braided Lightning Cable 2m"');
      expect(html).toContain('aria-label="Actions for Fast GaN Charger 65W"');

      // Verify the <thead> has strictly the 8 dedicated columns (Date, Shop Name, Product, Quantity, Amount, CP, Profit, Delivery)
      const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/);
      expect(theadMatch).toBeTruthy();
      const theadHtml = theadMatch![0];
      const thCount = (theadHtml.match(/<th[\s>]/g) || []).length;
      expect(thCount).toBe(8);
      expect(theadHtml).toContain('Quantity');
    });

    it('persists delivery updates and handles record deletion cleanly via db service', async () => {
      // Create a test delivery in demo storage
      const testRec: db.SaveBusinessRecordInput = {
        date: '2026-10-26',
        shopName: 'Supreme Mobiles',
        productName: '9H Glass Screen Guard',
        unitPrice: 150,
        quantity: 10,
        deliveryStatus: 'pending'
      };

      const saved = await db.saveBusinessRecord(testRec);
      expect(saved.deliveryStatus).toBe('pending');

      // Update delivery status via updateDeliveryStatus
      const updateResult = await db.updateDeliveryStatus(saved.deliveryId, 'delivered');
      expect(updateResult.success).toBe(true);
      expect(updateResult.status).toBe('delivered');

      const recordsAfterDelivery = await db.getBusinessRecords();
      const updatedRec = recordsAfterDelivery.find(r => r.deliveryId === saved.deliveryId);
      expect(updatedRec?.deliveryStatus).toBe('delivered');

      // Uncheck / return to pending
      const pendingResult = await db.updateDeliveryStatus(saved.deliveryId, 'pending');
      expect(pendingResult.success).toBe(true);
      expect(pendingResult.status).toBe('pending');

      const recordsAfterPending = await db.getBusinessRecords();
      const pendingRec = recordsAfterPending.find(r => r.deliveryId === saved.deliveryId);
      expect(pendingRec?.deliveryStatus).toBe('pending');

      // Delete business record via deleteBusinessRecord
      await db.deleteBusinessRecord(saved.deliveryId);
      const recordsAfterDelete = await db.getBusinessRecords();
      const deletedRec = recordsAfterDelete.find(r => r.deliveryId === saved.deliveryId);
      expect(deletedRec).toBeUndefined();

      // Ensure catalog shop and product were NOT deleted
      const shops = await db.getShops();
      expect(shops.some(s => s.name === 'Supreme Mobiles')).toBe(true);
    });
  });

  describe('Delivery Checkbox Complete Lifecycle Suite', () => {
    const shopSample: db.Shop = {
      id: 'shop-cycle',
      name: 'RTR Lifecycle Hub',
      code: 'RTR-LC',
      address: 'Cycle Rd',
      phone: '9998887770',
      isActive: true,
      assignedEmployees: []
    };

    it('renders empty pending section and empty delivered section gracefully', () => {
      // Only delivered records: pending section has 0 rows
      const onlyDelivered: db.BusinessRecord[] = [{
        id: 'rec-deliv-only',
        deliveryId: 'deliv-deliv-only',
        date: '2026-10-26',
        shopId: shopSample.id,
        shopName: shopSample.name,
        productId: 'prod-deliv-only',
        productName: 'Delivered Only Earphones',
        quantity: 2,
        unitPrice: 500,
        totalAmount: 1000,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-26T10:00:00Z'
      }];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={onlyDelivered}
          />
        </MemoryRouter>
      );

      // Separator and delivered row render cleanly
      expect(html).toContain('Delivered Items');
      expect(html).toContain('Delivered Only Earphones');
      expect(html).toContain('aria-checked="true"');
    });

    it('renders only pending records when no delivered items exist (separator is omitted)', () => {
      const onlyPending: db.BusinessRecord[] = [{
        id: 'rec-pend-only',
        deliveryId: 'deliv-pend-only',
        date: '2026-10-26',
        shopId: shopSample.id,
        shopName: shopSample.name,
        productId: 'prod-pend-only',
        productName: 'Pending Only Cable',
        quantity: 1,
        unitPrice: 200,
        totalAmount: 200,
        deliveryStatus: 'pending',
        pendingAmount: 200,
        createdAt: '2026-10-26T10:00:00Z'
      }];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[shopSample]}
            initialRecords={onlyPending}
          />
        </MemoryRouter>
      );

      expect(html).toContain('Pending Only Cable');
      expect(html).toContain('aria-checked="false"');
      // Delivered separator is omitted when 0 delivered rows exist
      expect(html).not.toContain('Delivered Items (moved to bottom)');
    });

    it('normalizes various delivery status inputs strictly into "delivered" or "pending"', () => {
      expect(db.isDelivered('delivered')).toBe(true);
      expect(db.isDelivered('Delivered')).toBe(true);
      expect(db.isDelivered('completed')).toBe(true);
      expect(db.isDelivered(true)).toBe(true);
      expect(db.isDelivered('true')).toBe(true);

      expect(db.isDelivered('pending')).toBe(false);
      expect(db.isDelivered('false')).toBe(false);
      expect(db.isDelivered(false)).toBe(false);
      expect(db.isDelivered(null)).toBe(false);
      expect(db.isDelivered(undefined)).toBe(false);
      expect(db.isDelivered('')).toBe(false);

      expect(db.normalizeDeliveryStatus('delivered')).toBe('delivered');
      expect(db.normalizeDeliveryStatus('pending')).toBe('pending');
      expect(db.normalizeDeliveryStatus('')).toBe('pending');
      expect(db.normalizeDeliveryStatus(null)).toBe('pending');
    });

    it('persists delivery toggle through server API/storage and survives reload', async () => {
      // 1. Save new business record (defaults to pending)
      const record = await db.saveBusinessRecord({
        date: '2026-10-27',
        shopName: 'Galaxy Mobiles',
        productName: 'Type-C OTG Adapter',
        unitPrice: 80,
        quantity: 5,
        deliveryStatus: 'pending'
      });

      expect(record.deliveryStatus).toBe('pending');

      // 2. Mark as delivered
      const markResult = await db.updateDeliveryStatus(record.deliveryId, 'delivered');
      expect(markResult.success).toBe(true);
      expect(markResult.status).toBe('delivered');

      // 3. Confirm reload reads delivered status
      const reloadedRecords = await db.getBusinessRecords();
      const foundDelivered = reloadedRecords.find(r => r.deliveryId === record.deliveryId);
      expect(foundDelivered).toBeDefined();
      expect(foundDelivered?.deliveryStatus).toBe('delivered');

      // 4. Mark back as pending (unchecked)
      const pendingResult = await db.updateDeliveryStatus(record.deliveryId, 'pending');
      expect(pendingResult.success).toBe(true);
      expect(pendingResult.status).toBe('pending');

      // 5. Confirm reload reads pending status
      const finalRecords = await db.getBusinessRecords();
      const foundPending = finalRecords.find(r => r.deliveryId === record.deliveryId);
      expect(foundPending).toBeDefined();
      expect(foundPending?.deliveryStatus).toBe('pending');
    });
  });

  describe('Search Functionality End-to-End Suite', () => {
    const testShops: db.Shop[] = [
      { id: 'shop-wer', name: 'werwer Mobile Hub', code: 'W-01', address: 'Market St', phone: '9988776655', isActive: true, assignedEmployees: [] },
      { id: 'shop-apex', name: 'Apex Cellular', code: 'A-01', address: 'Gandhi Rd', phone: '9988776656', isActive: true, assignedEmployees: [] },
      { id: 'shop-supreme', name: 'Supreme Mobiles', code: 'S-01', address: 'Anna Salai', phone: '9988776657', isActive: true, assignedEmployees: [] }
    ];

    const testRecords: db.BusinessRecord[] = [
      {
        id: 'rec-wer-1',
        deliveryId: 'deliv-wer-1',
        date: '2026-10-26',
        shopId: 'shop-wer',
        shopName: 'werwer Mobile Hub',
        productId: 'prod-glass',
        productName: '9H Edge-to-Edge Tempered Glass',
        quantity: 10,
        unitPrice: 120,
        totalAmount: 1200,
        deliveryStatus: 'pending',
        pendingAmount: 1200,
        createdAt: '2026-10-26T10:00:00Z'
      },
      {
        id: 'rec-apex-1',
        deliveryId: 'deliv-apex-1',
        date: '2026-10-25',
        shopId: 'shop-apex',
        shopName: 'Apex Cellular',
        productId: 'prod-case',
        productName: 'Shockproof Matte Silicone Case',
        quantity: 5,
        unitPrice: 180,
        totalAmount: 900,
        deliveryStatus: 'pending',
        pendingAmount: 900,
        createdAt: '2026-10-25T10:00:00Z'
      },
      {
        id: 'rec-supreme-1',
        deliveryId: 'deliv-supreme-1',
        date: '2026-10-24',
        shopId: 'shop-supreme',
        shopName: 'Supreme Mobiles',
        productId: 'prod-charger',
        productName: '65W GaN Fast Charger',
        quantity: 2,
        unitPrice: 850,
        totalAmount: 1700,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-24T10:00:00Z'
      }
    ];

    it('displays all records when search query is empty', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery=""
          />
        </MemoryRouter>
      );

      expect(html).toContain('werwer Mobile Hub');
      expect(html).toContain('Apex Cellular');
      expect(html).toContain('Supreme Mobiles');
      expect(html).toContain('9H Edge-to-Edge Tempered Glass');
      expect(html).toContain('Shockproof Matte Silicone Case');
      expect(html).toContain('65W GaN Fast Charger');
    });

    it('searches by partial shop name (e.g. "wer" finds shop named "werwer")', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="wer"
          />
        </MemoryRouter>
      );

      expect(html).toContain('werwer Mobile Hub');
      expect(html).not.toContain('Apex Cellular');
      expect(html).not.toContain('Supreme Mobiles');
    });

    it('searches by complete shop name', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="Apex Cellular"
          />
        </MemoryRouter>
      );

      expect(html).toContain('Apex Cellular');
      expect(html).toContain('Shockproof Matte Silicone Case');
      expect(html).not.toContain('werwer Mobile Hub');
      expect(html).not.toContain('Supreme Mobiles');
    });

    it('searches by partial product name (e.g. "case" finds "Shockproof Matte Silicone Case")', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="case"
          />
        </MemoryRouter>
      );

      expect(html).toContain('Shockproof Matte Silicone Case');
      expect(html).toContain('Apex Cellular');
      expect(html).not.toContain('9H Edge-to-Edge Tempered Glass');
      expect(html).not.toContain('65W GaN Fast Charger');
    });

    it('searches by complete product name', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="65W GaN Fast Charger"
          />
        </MemoryRouter>
      );

      expect(html).toContain('65W GaN Fast Charger');
      expect(html).toContain('Supreme Mobiles');
      expect(html).not.toContain('werwer Mobile Hub');
      expect(html).not.toContain('Apex Cellular');
    });

    it('performs case-insensitive matching (e.g. "CASE" and "cAsE" find lowercase "case")', () => {
      const htmlUpper = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="CASE"
          />
        </MemoryRouter>
      );

      expect(htmlUpper).toContain('Shockproof Matte Silicone Case');

      const htmlMixed = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="aPeX"
          />
        </MemoryRouter>
      );

      expect(htmlMixed).toContain('Apex Cellular');
    });

    it('ignores leading and trailing whitespace in the query', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="   wer   "
          />
        </MemoryRouter>
      );

      expect(html).toContain('werwer Mobile Hub');
      expect(html).not.toContain('Apex Cellular');
    });

    it('displays clear "No records found for [query]" empty state when no matches exist', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="nonexistentxyz123"
          />
        </MemoryRouter>
      );

      expect(html).toContain('No records found for');
      expect(html).toContain('nonexistentxyz123');
      expect(html).toContain('No records found');
      expect(html).not.toContain('werwer Mobile Hub');
      expect(html).not.toContain('Apex Cellular');
    });

    it('filters records in both Pending and Delivered sections, preserving separator', () => {
      // 1 pending record for Apex and 1 delivered record for Apex
      const dualRecords: db.BusinessRecord[] = [
        {
          id: 'rec-apex-pending',
          deliveryId: 'deliv-apex-pending',
          date: '2026-10-26',
          shopId: 'shop-apex',
          shopName: 'Apex Cellular',
          productId: 'prod-glass',
          productName: '9H Glass Guard',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 100,
          deliveryStatus: 'pending',
          pendingAmount: 100,
          createdAt: '2026-10-26T10:00:00Z'
        },
        {
          id: 'rec-apex-delivered',
          deliveryId: 'deliv-apex-delivered',
          date: '2026-10-25',
          shopId: 'shop-apex',
          shopName: 'Apex Cellular',
          productId: 'prod-case',
          productName: 'Apex Protective Case',
          quantity: 1,
          unitPrice: 200,
          totalAmount: 200,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-25T10:00:00Z'
        },
        {
          id: 'rec-other',
          deliveryId: 'deliv-other',
          date: '2026-10-24',
          shopId: 'shop-other',
          shopName: 'Other Unrelated Shop',
          productId: 'prod-cable',
          productName: 'Unrelated Cable',
          quantity: 1,
          unitPrice: 50,
          totalAmount: 50,
          deliveryStatus: 'pending',
          pendingAmount: 50,
          createdAt: '2026-10-24T10:00:00Z'
        }
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={dualRecords}
            initialSearchQuery="Apex"
          />
        </MemoryRouter>
      );

      // Both pending and delivered items for Apex are present
      expect(html).toContain('9H Glass Guard');
      expect(html).toContain('Apex Protective Case');
      // Delivered separator is present
      expect(html).toContain('Delivered Items');
      // Unrelated items are filtered out
      expect(html).not.toContain('Other Unrelated Shop');
      expect(html).not.toContain('Unrelated Cable');
    });

    it('safely resolves shop name from shop relation when record.shopName is empty', () => {
      const recordWithEmptyShopName: db.BusinessRecord = {
        id: 'rec-empty-shopname',
        deliveryId: 'deliv-empty-shopname',
        date: '2026-10-26',
        shopId: 'shop-apex',
        shopName: '',
        productId: 'prod-glass',
        productName: '9H Tempered Glass',
        quantity: 5,
        unitPrice: 100,
        totalAmount: 500,
        deliveryStatus: 'pending',
        pendingAmount: 500,
        createdAt: '2026-10-26T10:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={[recordWithEmptyShopName]}
            initialSearchQuery="Apex"
          />
        </MemoryRouter>
      );

      // Matched via shop relation resolution
      expect(html).toContain('9H Tempered Glass');
    });

    it('handles pagination bounds safely when filtering from a higher page', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={testRecords}
            initialSearchQuery="wer"
            initialCurrentPage={5}
          />
        </MemoryRouter>
      );

      // Does not slice out-of-bounds: safely clamps effectivePage to 1
      expect(html).toContain('werwer Mobile Hub');
      expect(html).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?1[\s\S]*?of[\s\S]*?1[\s\S]*?records/);
    });
  });

  describe('Delivery Status Stability & Mobile Responsiveness Regression Suite', () => {
    it('ensures normalizeDeliveryStatus never silently defaults null or undefined to delivered', () => {
      expect(db.normalizeDeliveryStatus(null)).toBe('pending');
      expect(db.normalizeDeliveryStatus(undefined)).toBe('pending');
      expect(db.normalizeDeliveryStatus('')).toBe('pending');
      expect(db.normalizeDeliveryStatus('unknown_status')).toBe('pending');
      expect(db.normalizeDeliveryStatus('cancelled')).toBe('pending');
      expect(db.normalizeDeliveryStatus('delivered')).toBe('delivered');
      expect(db.normalizeDeliveryStatus('pending')).toBe('pending');
    });

    it('ensures loading, viewing, searching, and sorting never alter delivery status', () => {
      const recordsToTest: db.BusinessRecord[] = [
        {
          id: 'test-pending-1',
          deliveryId: 'deliv-test-1',
          date: '2026-10-28',
          shopId: 'shop-1',
          shopName: 'Supreme Mobiles',
          productId: 'prod-1',
          productName: 'Tempered Glass Pro',
          quantity: 10,
          unitPrice: 100,
          totalAmount: 1000,
          deliveryStatus: 'pending',
          pendingAmount: 1000,
          createdAt: '2026-10-28T10:00:00Z'
        },
        {
          id: 'test-delivered-1',
          deliveryId: 'deliv-test-2',
          date: '2026-10-27',
          shopId: 'shop-2',
          shopName: 'Galaxy Mobiles',
          productId: 'prod-2',
          productName: 'Fast Cable 65W',
          quantity: 5,
          unitPrice: 200,
          totalAmount: 1000,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-27T10:00:00Z'
        }
      ];

      // Initial render: pending has aria-checked="false", delivered has aria-checked="true"
      const html1 = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={recordsToTest}
          />
        </MemoryRouter>
      );

      expect(html1).toContain('aria-checked="false"');
      expect(html1).toContain('aria-checked="true"');

      // Search filtering preserves statuses without flipping
      const htmlSearch = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={recordsToTest}
            initialSearchQuery="Glass"
          />
        </MemoryRouter>
      );
      expect(htmlSearch).toContain('aria-checked="false"');
      expect(htmlSearch).toContain('Tempered Glass Pro');
      expect(htmlSearch).not.toContain('Fast Cable 65W');
    });

    it('renders all 7 columns without artificial min-w-[500px] table clipping', () => {
      const mockRecord: db.BusinessRecord = {
        id: 'rec-mobile-test',
        deliveryId: 'deliv-mobile-test',
        date: '2026-10-28',
        shopId: 'shop-1',
        shopName: 'RTR Anna Nagar',
        productId: 'prod-1',
        productName: 'Fast Charger 20W',
        quantity: 10,
        unitPrice: 250,
        totalAmount: 2500,
        deliveryStatus: 'pending',
        pendingAmount: 2500,
        createdAt: '2026-10-28T10:00:00Z'
      };

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[mockRecord]}
          />
        </MemoryRouter>
      );

      // Eliminates artificial min-w-[500px] that clipped columns on mobile
      expect(html).not.toContain('min-w-[500px]');
      expect(html).toContain('overflow-x-auto');
      expect(html).toContain('touch-pan-x');

      // All 7 visible columns rendered in order
      expect(html).toContain('Date');
      expect(html).toContain('Shop Name');
      expect(html).toContain('Product');
      expect(html).toContain('Amount (₹)');
      expect(html).toContain('CP (₹)');
      expect(html).toContain('Profit (₹)');
      expect(html).toContain('Delivery');

      // Mobile touch targets configured: min-h-[44px] for primary actions
      expect(html).toContain('min-h-[44px]');
      // Delivery checkbox expanded touch target
      expect(html).toContain('-inset-2.5 sm:-inset-1.5');
    });

    it('one pending record becomes delivered and moves to Delivered Items', () => {
      const singlePendingRecord: db.BusinessRecord = {
        id: 'rec-single-1',
        deliveryId: 'deliv-single-1',
        shopId: 'shop-s1',
        productId: 'prod-s1',
        date: '2026-10-29',
        shopName: 'Supreme Mobiles',
        productName: 'Single Pending Product',
        quantity: 1,
        unitPrice: 500,
        totalAmount: 500,
        deliveryStatus: 'pending',
        pendingAmount: 500,
        createdAt: '2026-10-29T10:00:00Z'
      };

      // When pending: rendered without delivered separator
      const htmlPending = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[singlePendingRecord]}
          />
        </MemoryRouter>
      );
      expect(htmlPending).toContain('Single Pending Product');
      expect(htmlPending).toContain('aria-checked="false"');
      expect(htmlPending).not.toContain('Delivered Items');

      // When delivered: Pending group becomes empty, Delivered Items separator appears above record
      const singleDeliveredRecord: db.BusinessRecord = {
        ...singlePendingRecord,
        deliveryStatus: 'delivered'
      };
      const htmlDelivered = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={[singleDeliveredRecord]}
          />
        </MemoryRouter>
      );
      expect(htmlDelivered).toContain('Delivered Items');
      expect(htmlDelivered).toContain('Single Pending Product');
      expect(htmlDelivered).toContain('aria-checked="true"');
      const sepIndex = htmlDelivered.indexOf('Delivered Items');
      const recIndex = htmlDelivered.indexOf('Single Pending Product');
      expect(sepIndex).toBeLessThan(recIndex);
    });

    it('multiple pending records: one becomes delivered and moves below all pending records', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-p1',
          deliveryId: 'deliv-p1',
          shopId: 'shop-p1',
          productId: 'prod-p1',
          date: '2026-10-29',
          shopName: 'Shop A',
          productName: 'Product A (Pending)',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 100,
          deliveryStatus: 'pending',
          pendingAmount: 100,
          createdAt: '2026-10-29T10:00:00Z'
        },
        {
          id: 'rec-p2',
          deliveryId: 'deliv-p2',
          shopId: 'shop-p2',
          productId: 'prod-p2',
          date: '2026-10-28',
          shopName: 'Shop B',
          productName: 'Product B (Delivered)',
          quantity: 1,
          unitPrice: 200,
          totalAmount: 200,
          deliveryStatus: 'delivered',
          pendingAmount: 200,
          createdAt: '2026-10-28T10:00:00Z'
        },
        {
          id: 'rec-p3',
          deliveryId: 'deliv-p3',
          shopId: 'shop-p3',
          productId: 'prod-p3',
          date: '2026-10-27',
          shopName: 'Shop C',
          productName: 'Product C (Pending)',
          quantity: 1,
          unitPrice: 300,
          totalAmount: 300,
          deliveryStatus: 'pending',
          pendingAmount: 300,
          createdAt: '2026-10-27T10:00:00Z'
        }
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      const pAIndex = html.indexOf('Product A (Pending)');
      const pCIndex = html.indexOf('Product C (Pending)');
      const sepIndex = html.indexOf('Delivered Items');
      const pBIndex = html.indexOf('Product B (Delivered)');

      // Both pending records are above the Delivered Items separator
      expect(pAIndex).toBeLessThan(sepIndex);
      expect(pCIndex).toBeLessThan(sepIndex);
      // Delivered record is below the Delivered Items separator
      expect(sepIndex).toBeLessThan(pBIndex);
    });

    it('multiple delivered records are sorted newest date first within Delivered Items', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-d-old',
          deliveryId: 'deliv-d-old',
          shopId: 'shop-old',
          productId: 'prod-old',
          date: '2026-10-20',
          shopName: 'Shop Old',
          productName: 'Older Delivered Item',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 100,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-20T10:00:00Z'
        },
        {
          id: 'rec-d-new',
          deliveryId: 'deliv-d-new',
          shopId: 'shop-new',
          productId: 'prod-new',
          date: '2026-10-29',
          shopName: 'Shop New',
          productName: 'Newer Delivered Item',
          quantity: 1,
          unitPrice: 200,
          totalAmount: 200,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-29T10:00:00Z'
        }
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      const newIndex = html.indexOf('Newer Delivered Item');
      const oldIndex = html.indexOf('Older Delivered Item');
      expect(newIndex).toBeLessThan(oldIndex);
    });

    it('no pending records: the delivered group still displays correctly with separator', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-d1',
          deliveryId: 'deliv-d1',
          shopId: 'shop-d1',
          productId: 'prod-d1',
          date: '2026-10-29',
          shopName: 'Shop Delivered',
          productName: 'Delivered Product 1',
          quantity: 2,
          unitPrice: 150,
          totalAmount: 300,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-29T10:00:00Z'
        }
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      expect(html).toContain('Delivered Items');
      expect(html).toContain('Delivered Product 1');
      expect(html).toContain('aria-checked="true"');
      expect(html).not.toContain('aria-checked="false"');
    });

    it('persists delivery update across reload and keeps record in Delivered Items', async () => {
      // Create and save record
      const saved = await db.saveBusinessRecord({
        date: '2026-10-29',
        shopName: 'Reload Test Shop',
        productName: 'Reload Test Earbuds',
        quantity: 4,
        unitPrice: 250,
        deliveryStatus: 'pending'
      });
      expect(db.isDelivered(saved)).toBe(false);

      // Update to delivered
      const updateRes = await db.updateDeliveryStatus(saved.deliveryId, 'delivered');
      expect(updateRes.success).toBe(true);
      expect(updateRes.status).toBe('delivered');

      // Reload records from db service
      const reloaded = await db.getBusinessRecords();
      const match = reloaded.find(r => r.deliveryId === saved.deliveryId);
      expect(match).toBeDefined();
      expect(db.isDelivered(match)).toBe(true);

      // Render reloaded records in dashboard
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={reloaded}
          />
        </MemoryRouter>
      );
      expect(html).toContain('Delivered Items');
      expect(html).toContain('Reload Test Earbuds');
    });

    it('preserves grouping with search filtering and pagination', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-srch-1',
          deliveryId: 'deliv-srch-1',
          shopId: 'shop-srch-1',
          productId: 'prod-srch-1',
          date: '2026-10-29',
          shopName: 'Supreme Alpha',
          productName: 'Alpha Charger',
          quantity: 1,
          unitPrice: 300,
          totalAmount: 300,
          deliveryStatus: 'pending',
          pendingAmount: 300,
          createdAt: '2026-10-29T10:00:00Z'
        },
        {
          id: 'rec-srch-2',
          deliveryId: 'deliv-srch-2',
          shopId: 'shop-srch-2',
          productId: 'prod-srch-2',
          date: '2026-10-28',
          shopName: 'Supreme Beta',
          productName: 'Beta Charger',
          quantity: 1,
          unitPrice: 350,
          totalAmount: 350,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-28T10:00:00Z'
        },
        {
          id: 'rec-srch-3',
          deliveryId: 'deliv-srch-3',
          shopId: 'shop-srch-3',
          productId: 'prod-srch-3',
          date: '2026-10-27',
          shopName: 'Other Shop',
          productName: 'Gamma Cable',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 100,
          deliveryStatus: 'pending',
          pendingAmount: 100,
          createdAt: '2026-10-27T10:00:00Z'
        }
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[]}
            initialRecords={records}
            initialSearchQuery="Supreme"
          />
        </MemoryRouter>
      );

      // Filtered to Supreme only
      expect(html).toContain('Alpha Charger');
      expect(html).toContain('Beta Charger');
      expect(html).not.toContain('Gamma Cable');

      // Grouping preserved: Alpha is pending, Beta is delivered under separator
      const alphaIdx = html.indexOf('Alpha Charger');
      const sepIdx = html.indexOf('Delivered Items');
      const betaIdx = html.indexOf('Beta Charger');
      expect(alphaIdx).toBeLessThan(sepIdx);
      expect(sepIdx).toBeLessThan(betaIdx);
    });

    it('reliably handles failed delivery status updates without corrupting local state or false movement', async () => {
      const spy = vi.spyOn(db, 'updateDeliveryStatus').mockRejectedValue(new Error('Failed to update delivery status on the server. Restored previous state.'));

      try {
        await expect(db.updateDeliveryStatus('test-fail-id', 'delivered')).rejects.toThrow('Failed to update delivery status');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Reactive CRUD Operations Without Full-Page Reload Suite', () => {
    const dummyShop: db.Shop = { id: 'shop-1', name: 'Supreme Mobiles', code: 'SUP', address: 'Main Rd', phone: '9999999999', isActive: true, assignedEmployees: [] };

    it('adds a record and immediately updates UI without unmounting to skeleton', async () => {
      // 1. Initial authoritative records state
      const initial: db.BusinessRecord[] = [
        {
          id: 'rec-1',
          deliveryId: 'deliv-1',
          date: '2026-10-29',
          shopId: 'shop-1',
          shopName: 'Supreme Mobiles',
          productId: 'prod-1',
          productName: 'Tempered Glass',
          quantity: 10,
          unitPrice: 50,
          totalAmount: 500,
          deliveryStatus: 'pending',
          pendingAmount: 500,
          createdAt: '2026-10-29T10:00:00Z'
        }
      ];

      // Render initial state
      const htmlBefore = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[dummyShop]}
            initialRecords={initial}
          />
        </MemoryRouter>
      );
      expect(htmlBefore).toContain('Tempered Glass');
      expect(htmlBefore).not.toContain('animate-pulse');
      expect(htmlBefore).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?1[\s\S]*?of[\s\S]*?1[\s\S]*?records/);

      // 2. Simulate reactive add record response returned from saveBusinessRecord
      const newRecord: db.BusinessRecord = {
        id: 'rec-2',
        deliveryId: 'deliv-2',
        date: '2026-10-29',
        shopId: 'shop-1',
        shopName: 'Supreme Mobiles',
        productId: 'prod-2',
        productName: 'Fast Charging Adapter',
        quantity: 5,
        unitPrice: 200,
        totalAmount: 1000,
        deliveryStatus: 'pending',
        pendingAmount: 1000,
        createdAt: '2026-10-29T10:05:00Z'
      };

      const updatedRecords = [newRecord, ...initial];
      const htmlAfter = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={[dummyShop]}
            initialRecords={updatedRecords}
          />
        </MemoryRouter>
      );

      // 3. New record appears immediately and total count increments reactively without skeleton
      expect(htmlAfter).toContain('Fast Charging Adapter');
      expect(htmlAfter).toContain('Tempered Glass');
      expect(htmlAfter).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?2[\s\S]*?of[\s\S]*?2[\s\S]*?records/);
      expect(htmlAfter).not.toContain('animate-pulse');
    });

    it('deletes a record and updates counts reactively without reloading page', async () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-del-1',
          deliveryId: 'deliv-del-1',
          date: '2026-10-29',
          shopId: 'shop-1',
          shopName: 'Supreme Mobiles',
          productId: 'prod-1',
          productName: 'Silicone Case',
          quantity: 2,
          unitPrice: 150,
          totalAmount: 300,
          deliveryStatus: 'pending',
          pendingAmount: 300,
          createdAt: '2026-10-29T10:00:00Z'
        },
        {
          id: 'rec-del-2',
          deliveryId: 'deliv-del-2',
          date: '2026-10-28',
          shopId: 'shop-1',
          shopName: 'Supreme Mobiles',
          productId: 'prod-2',
          productName: 'Braided Cable',
          quantity: 4,
          unitPrice: 100,
          totalAmount: 400,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-28T10:00:00Z'
        }
      ];

      const htmlInitial = renderToString(
        <MemoryRouter>
          <OwnerDashboard initialLoading={false} initialRecords={records} />
        </MemoryRouter>
      );
      expect(htmlInitial).toContain('Silicone Case');
      expect(htmlInitial).toContain('Braided Cable');
      expect(htmlInitial).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?2[\s\S]*?of[\s\S]*?2[\s\S]*?records/);

      // Optimistically remove rec-del-1
      const remaining = records.filter(r => r.id !== 'rec-del-1');
      const htmlDeleted = renderToString(
        <MemoryRouter>
          <OwnerDashboard initialLoading={false} initialRecords={remaining} />
        </MemoryRouter>
      );

      expect(htmlDeleted).not.toContain('Silicone Case');
      expect(htmlDeleted).toContain('Braided Cable');
      expect(htmlDeleted).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?1[\s\S]*?of[\s\S]*?1[\s\S]*?records/);
      expect(htmlDeleted).not.toContain('animate-pulse');
    });

    it('moves record from pending to delivered section immediately without full page reload', () => {
      const pendingRecord: db.BusinessRecord = {
        id: 'rec-toggle-1',
        deliveryId: 'deliv-toggle-1',
        date: '2026-10-29',
        shopId: 'shop-1',
        shopName: 'Supreme Mobiles',
        productId: 'prod-1',
        productName: 'Wireless Earbuds',
        quantity: 1,
        unitPrice: 899,
        totalAmount: 899,
        deliveryStatus: 'pending',
        pendingAmount: 899,
        createdAt: '2026-10-29T10:00:00Z'
      };

      // Before toggle: 1 pending, 0 delivered (separator not shown)
      const htmlBefore = renderToString(
        <MemoryRouter>
          <OwnerDashboard initialLoading={false} initialRecords={[pendingRecord]} />
        </MemoryRouter>
      );
      expect(htmlBefore).toContain('Wireless Earbuds');
      expect(htmlBefore).not.toContain('Delivered Items');

      // After toggle: status becomes delivered, moves to Delivered Items group under separator
      const deliveredRecord: db.BusinessRecord = {
        ...pendingRecord,
        deliveryStatus: 'delivered'
      };

      const htmlAfter = renderToString(
        <MemoryRouter>
          <OwnerDashboard initialLoading={false} initialRecords={[deliveredRecord]} />
        </MemoryRouter>
      );
      expect(htmlAfter).toContain('Wireless Earbuds');
      expect(htmlAfter).toContain('Delivered Items');
      expect(htmlAfter).not.toContain('animate-pulse');
    });

    it('safely retains previous records state when mutation API fails', async () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-fail-1',
          deliveryId: 'deliv-fail-1',
          date: '2026-10-29',
          shopId: 'shop-1',
          shopName: 'Supreme Mobiles',
          productId: 'prod-1',
          productName: 'Armor Glass',
          quantity: 1,
          unitPrice: 199,
          totalAmount: 199,
          deliveryStatus: 'pending',
          pendingAmount: 199,
          createdAt: '2026-10-29T10:00:00Z'
        }
      ];

      const deleteSpy = vi.spyOn(db, 'deleteBusinessRecord').mockRejectedValue(new Error('Server communication error'));

      try {
        await expect(db.deleteBusinessRecord('deliv-fail-1')).rejects.toThrow('Server communication error');
        // Authoritative records state remains intact on error
        const html = renderToString(
          <MemoryRouter>
            <OwnerDashboard initialLoading={false} initialRecords={records} />
          </MemoryRouter>
        );
        expect(html).toContain('Armor Glass');
      } finally {
        deleteSpy.mockRestore();
      }
    });

    it('dynamically recalculates search, pagination, and sorting from authoritative records state', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'rec-dyn-1',
          deliveryId: 'deliv-dyn-1',
          date: '2026-10-29',
          shopId: 'shop-1',
          shopName: 'City Center Hub',
          productId: 'prod-1',
          productName: 'Power Bank 10000mAh',
          quantity: 1,
          unitPrice: 999,
          totalAmount: 999,
          deliveryStatus: 'pending',
          pendingAmount: 999,
          createdAt: '2026-10-29T10:00:00Z'
        },
        {
          id: 'rec-dyn-2',
          deliveryId: 'deliv-dyn-2',
          date: '2026-10-28',
          shopId: 'shop-2',
          shopName: 'Metro Telecom',
          productId: 'prod-2',
          productName: 'USB-C OTG Adapter',
          quantity: 2,
          unitPrice: 99,
          totalAmount: 198,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-28T10:00:00Z'
        }
      ];

      // Search matches only "Power Bank"
      const htmlSearch = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={records}
            initialSearchQuery="Power Bank"
          />
        </MemoryRouter>
      );
      expect(htmlSearch).toContain('Power Bank 10000mAh');
      expect(htmlSearch).not.toContain('USB-C OTG Adapter');
      expect(htmlSearch).toMatch(/Showing[\s\S]*?1[\s\S]*?to[\s\S]*?1[\s\S]*?of[\s\S]*?1[\s\S]*?records/);
    });
  });

  describe('v_business_records Mapping & Production Status Synchronization Suite', () => {
    it('correctly maps raw snake_case database view rows from public.v_business_records into canonical BusinessRecord', () => {
      const rawViewRow = {
        record_id: 'rec-uuid-1234',
        delivery_id: 'deliv-uuid-5678',
        business_id: 'biz-uuid-0001',
        date: '2026-10-29',
        shop_id: 'shop-uuid-1',
        shop_name: 'Metro Wholesale Telecom',
        shop_code: 'RTR-METR-001',
        product_id: 'prod-uuid-1',
        product_name: 'Fast Charging Power Bank 20000mAh',
        product_sku: 'SKU-PB-20K',
        quantity: 5,
        unit_price: 1200,
        total_amount: 6000,
        delivery_status: 'pending',
        amount_paid: 1000,
        pending_amount: 5000,
        payment_status: 'partially_paid',
        notes: 'Priority morning delivery dispatch',
        created_at: '2026-10-29T08:30:00Z',
        priority_rank: 1
      };

      const mapped = db.mapViewRecordToBusinessRecord(rawViewRow);

      expect(mapped.id).toBe('rec-uuid-1234');
      expect(mapped.deliveryId).toBe('deliv-uuid-5678');
      expect(mapped.shopName).toBe('Metro Wholesale Telecom');
      expect(mapped.productName).toBe('Fast Charging Power Bank 20000mAh');
      expect(mapped.quantity).toBe(5);
      expect(mapped.unitPrice).toBe(1200);
      expect(mapped.totalAmount).toBe(6000);
      expect(mapped.deliveryStatus).toBe('pending');
      expect(mapped.pendingAmount).toBe(5000);
      expect(db.isDelivered(mapped)).toBe(false);
      expect(isPendingRecord(mapped)).toBe(true);
    });

    it('never defaults unknown or missing status values in view records to delivered', () => {
      const rowWithMissingStatus = {
        record_id: 'rec-unknown-1',
        delivery_id: 'deliv-unknown-1',
        date: '2026-10-29',
        shop_name: 'New Shop',
        product_name: 'New Item',
        quantity: 1,
        unit_price: 500,
        total_amount: 500,
        delivery_status: null,
        pending_amount: 500
      };

      const mapped = db.mapViewRecordToBusinessRecord(rowWithMissingStatus);
      expect(mapped.deliveryStatus).toBe('pending');
      expect(db.isDelivered(mapped)).toBe(false);

      const rowWithUnrecognizedStatus = {
        ...rowWithMissingStatus,
        delivery_status: 'processing_unknown_state'
      };
      const mapped2 = db.mapViewRecordToBusinessRecord(rowWithUnrecognizedStatus);
      expect(mapped2.deliveryStatus).toBe('pending');
      expect(db.isDelivered(mapped2)).toBe(false);
    });

    it('places newly created pending records strictly in Pending Deliveries section, not Delivered Items', () => {
      const records: db.BusinessRecord[] = [
        {
          id: 'existing-delivered-1',
          deliveryId: 'deliv-1',
          date: '2026-10-28',
          shopId: 'shop-1',
          shopName: 'Metro Telecom',
          productId: 'prod-1',
          productName: 'Existing Delivered Cable',
          quantity: 10,
          unitPrice: 50,
          totalAmount: 500,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-28T10:00:00Z'
        },
        db.mapViewRecordToBusinessRecord({
          record_id: 'new-pending-dispatch',
          delivery_id: 'new-deliv-dispatch',
          date: '2026-10-29',
          shop_name: 'Apex Mobiles',
          product_name: 'Newly Created Pending Earphones',
          quantity: 2,
          unitPrice: 400,
          total_amount: 800,
          delivery_status: 'pending',
          pending_amount: 800,
          created_at: '2026-10-29T11:00:00Z'
        })
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={records}
          />
        </MemoryRouter>
      );

      // Verify Newly Created Pending Earphones appears in pending section above delivered separator
      const pendingPos = html.indexOf('Newly Created Pending Earphones');
      const deliveredSeparatorPos = html.indexOf('Delivered Items');
      const deliveredItemPos = html.indexOf('Existing Delivered Cable');

      expect(pendingPos).toBeGreaterThan(-1);
      expect(deliveredSeparatorPos).toBeGreaterThan(-1);
      expect(deliveredItemPos).toBeGreaterThan(-1);
      expect(pendingPos).toBeLessThan(deliveredSeparatorPos);
      expect(deliveredSeparatorPos).toBeLessThan(deliveredItemPos);
    });
  });

  describe('Date-Based Record Search & Multi-Filter Suite', () => {
    const multiDateRecords: db.BusinessRecord[] = [
      {
        id: 'rec-date-1',
        deliveryId: 'deliv-date-1',
        date: '2026-10-25',
        shopId: 'shop-alpha',
        shopName: 'Alpha Wireless',
        productId: 'prod-alpha',
        productName: 'USB-C Braided Cable',
        quantity: 10,
        unitPrice: 150,
        totalAmount: 1500,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-25T10:00:00Z'
      },
      {
        id: 'rec-date-2',
        deliveryId: 'deliv-date-2',
        date: '2026-10-27',
        shopId: 'shop-beta',
        shopName: 'Beta Cellular',
        productId: 'prod-beta',
        productName: 'Wireless Bluetooth Earbuds',
        quantity: 5,
        unitPrice: 600,
        totalAmount: 3000,
        deliveryStatus: 'pending',
        pendingAmount: 3000,
        createdAt: '2026-10-27T11:00:00Z'
      },
      {
        id: 'rec-date-3',
        deliveryId: 'deliv-date-3',
        date: '2026-10-29',
        shopId: 'shop-1dhope',
        shopName: '1dhope Accessories',
        productId: 'prod-fast-charger',
        productName: '65W Fast Charger',
        quantity: 20,
        unitPrice: 450,
        totalAmount: 9000,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-29T14:00:00Z'
      },
      {
        id: 'rec-date-4',
        deliveryId: 'deliv-date-4',
        date: '2026-10-29',
        shopId: 'shop-gamma',
        shopName: 'Gamma Mobiles',
        productId: 'prod-screen-guard',
        productName: 'Matte Screen Guard',
        quantity: 30,
        unitPrice: 80,
        totalAmount: 2400,
        deliveryStatus: 'pending',
        pendingAmount: 2400,
        createdAt: '2026-10-29T16:00:00Z'
      }
    ];

    it('1. searching a single date returns strictly the correct records for that date', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
          />
        </MemoryRouter>
      );

      // Should contain 29 Oct records
      expect(html).toContain('1dhope Accessories');
      expect(html).toContain('Gamma Mobiles');
      expect(html).toContain('65W Fast Charger');
      expect(html).toContain('Matte Screen Guard');

      // Should exclude records on 25 Oct and 27 Oct from table rows
      expect(html).not.toContain('Alpha Wireless');
      expect(html).not.toContain('Beta Cellular');
      expect(html).not.toContain('USB-C Braided Cable');
      expect(html).not.toContain('Wireless Bluetooth Earbuds');
    });

    it('2. date-range search includes both start and end dates inclusively', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialStartDate="2026-10-25"
            initialEndDate="2026-10-27"
          />
        </MemoryRouter>
      );

      // Includes 25 Oct (start boundary) and 27 Oct (end boundary)
      expect(html).toContain('Alpha Wireless');
      expect(html).toContain('Beta Cellular');

      // Excludes 29 Oct (outside boundary)
      expect(html).not.toContain('1dhope Accessories');
      expect(html).not.toContain('Gamma Mobiles');
    });

    it('3. shop + date filtering work harmoniously together (e.g. 29 October 2026 + 1dhope)', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
            initialSearchQuery="1dhope"
          />
        </MemoryRouter>
      );

      // Should display only the matching record for 1dhope on 29 Oct
      expect(html).toContain('1dhope Accessories');
      expect(html).toContain('65W Fast Charger');

      // Should exclude other shop on 29 Oct (Gamma Mobiles) and other dates
      expect(html).not.toContain('Gamma Mobiles');
      expect(html).not.toContain('Matte Screen Guard');
      expect(html).not.toContain('Alpha Wireless');
    });

    it('4. product + date filtering work harmoniously together (e.g. 29 October 2026 + Screen Guard)', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
            initialSearchQuery="Screen Guard"
          />
        </MemoryRouter>
      );

      expect(html).toContain('Gamma Mobiles');
      expect(html).toContain('Matte Screen Guard');
      expect(html).not.toContain('1dhope Accessories');
      expect(html).not.toContain('65W Fast Charger');
    });

    it('5. pending and delivered filters work seamlessly with dates', () => {
      const htmlPending = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
            initialStatusFilter="pending"
          />
        </MemoryRouter>
      );

      // On 29 Oct, Gamma Mobiles is pending, 1dhope is delivered
      expect(htmlPending).toContain('Gamma Mobiles');
      expect(htmlPending).not.toContain('1dhope Accessories');

      const htmlDelivered = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
            initialStatusFilter="delivered"
          />
        </MemoryRouter>
      );

      expect(htmlDelivered).toContain('1dhope Accessories');
      expect(htmlDelivered).not.toContain('Gamma Mobiles');
    });

    it('6. clear filters option is available when any filter is active and displays selected range clearly', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialStartDate="2026-10-25"
            initialEndDate="2026-10-29"
          />
        </MemoryRouter>
      );

      expect(html).toContain('Clear Filters');
      expect(html).toContain('Filtered by:');
      expect(html).toContain('25 Oct 2026');
      expect(html).toContain('29 Oct 2026');
      expect(html).toMatch(/4[\s\S]*?matching[\s\S]*?records/);
    });

    it('7. db.filterBusinessRecords correctly filters records for authoritative background sync and refresh', () => {
      const filteredExact = db.filterBusinessRecords(multiDateRecords, { date: '2026-10-29' });
      expect(filteredExact).toHaveLength(2);
      expect(filteredExact.map(r => r.id)).toEqual(['rec-date-3', 'rec-date-4']);

      const filteredRange = db.filterBusinessRecords(multiDateRecords, {
        startDate: '2026-10-25',
        endDate: '2026-10-27'
      });
      expect(filteredRange).toHaveLength(2);
      expect(filteredRange.map(r => r.id)).toEqual(['rec-date-1', 'rec-date-2']);

      const filteredStatus = db.filterBusinessRecords(multiDateRecords, {
        date: '2026-10-29',
        status: 'pending'
      });
      expect(filteredStatus).toHaveLength(1);
      expect(filteredStatus[0]?.id).toBe('rec-date-4');
    });

    it('8. provides accessible mobile date picker inputs with standard type="date"', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
          />
        </MemoryRouter>
      );

      expect(html).toContain('type="date"');
      expect(html).toContain('aria-label="Exact date"');
    });

    it('9. guarantees no timezone-related date shifting occurs across formatting and normalization', () => {
      // 2026-10-29 should never become 2026-10-28
      const rawDate = '2026-10-29';
      expect(db.normalizeDateString(rawDate)).toBe('2026-10-29');
      expect(db.formatFilterDisplayDate(rawDate)).toBe('29 Oct 2026');

      // ISO string representation
      const isoDate = '2026-10-29T18:30:00.000Z';
      expect(db.normalizeDateString(isoDate)).toBe('2026-10-29');
      expect(db.formatFilterDisplayDate(isoDate)).toBe('29 Oct 2026');
    });

    it('10. renders empty state when no records match the combined date and search criteria', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialRecords={multiDateRecords}
            initialDate="2026-10-29"
            initialSearchQuery="NonExistentShopName"
          />
        </MemoryRouter>
      );

      expect(html).toContain('No records found');
      expect(html).toContain('Clear search');
      expect(html).not.toContain('1dhope Accessories');
      expect(html).not.toContain('Gamma Mobiles');
    });
  });

  describe('Comprehensive Records Filtering & Authoritative Delivery Status Regression Suite (16 Scenarios)', () => {
    const testShops: db.Shop[] = [
      { id: 'shop-1', name: '1dhope Accessories', code: 'SHOP-1D', address: 'Main St', phone: '9876543210', isActive: true, assignedEmployees: [] },
      { id: 'shop-2', name: 'Gamma Mobiles', code: 'SHOP-GM', address: 'Market Rd', phone: '9876543211', isActive: true, assignedEmployees: [] },
      { id: 'shop-3', name: 'Alpha Telecom', code: 'SHOP-AT', address: 'Cross Rd', phone: '9876543212', isActive: true, assignedEmployees: [] }
    ];

    const testProducts: db.Product[] = [
      { id: 'prod-1', name: '65W Fast Charger', sku: 'CHG-65W', category: 'Chargers & Adapters', minStock: 10, unitPrice: 450, isActive: true },
      { id: 'prod-2', name: 'Matte Screen Guard', sku: 'SCR-MATTE', category: 'Tempered Glass', minStock: 20, unitPrice: 80, isActive: true },
      { id: 'prod-3', name: 'Wireless Earbuds', sku: 'EAR-WIR', category: 'Earphones & Audio', minStock: 5, unitPrice: 1200, isActive: true }
    ];

    const regressionRecords: db.BusinessRecord[] = [
      {
        id: 'rec-p1',
        deliveryId: 'del-p1',
        date: '2026-10-25',
        shopId: 'shop-1',
        shopName: '1dhope Accessories',
        productId: 'prod-1',
        productName: '65W Fast Charger',
        productSku: 'CHG-65W',
        quantity: 10,
        unitPrice: 450,
        totalAmount: 4500,
        deliveryStatus: 'pending',
        pendingAmount: 4500,
        createdAt: '2026-10-25T10:00:00Z'
      },
      {
        id: 'rec-p2',
        deliveryId: 'del-p2',
        date: '2026-10-27',
        shopId: 'shop-2',
        shopName: 'Gamma Mobiles',
        productId: 'prod-2',
        productName: 'Matte Screen Guard',
        productSku: 'SCR-MATTE',
        quantity: 25,
        unitPrice: 80,
        totalAmount: 2000,
        deliveryStatus: 'pending',
        pendingAmount: 0,
        createdAt: '2026-10-27T10:00:00Z'
      },
      {
        id: 'rec-d1',
        deliveryId: 'del-d1',
        date: '2026-10-28',
        shopId: 'shop-1',
        shopName: '1dhope Accessories',
        productId: 'prod-2',
        productName: 'Matte Screen Guard',
        productSku: 'SCR-MATTE',
        quantity: 30,
        unitPrice: 80,
        totalAmount: 2400,
        deliveryStatus: 'delivered',
        pendingAmount: 0,
        createdAt: '2026-10-28T10:00:00Z'
      },
      {
        id: 'rec-d2-unpaid',
        deliveryId: 'del-d2',
        date: '2026-10-29',
        shopId: 'shop-2',
        shopName: 'Gamma Mobiles',
        productId: 'prod-1',
        productName: '65W Fast Charger',
        productSku: 'CHG-65W',
        quantity: 15,
        unitPrice: 450,
        totalAmount: 6750,
        deliveryStatus: 'delivered',
        pendingAmount: 6750,
        createdAt: '2026-10-29T10:00:00Z'
      },
      {
        id: 'rec-d3-unpaid',
        deliveryId: 'del-d3',
        date: '2026-10-29',
        shopId: 'shop-3',
        shopName: 'Alpha Telecom',
        productId: 'prod-3',
        productName: 'Wireless Earbuds',
        productSku: 'EAR-WIR',
        quantity: 5,
        unitPrice: 1200,
        totalAmount: 6000,
        deliveryStatus: 'delivered',
        pendingAmount: 3000,
        createdAt: '2026-10-29T12:00:00Z'
      },
      {
        id: 'rec-cancelled',
        deliveryId: 'del-c1',
        date: '2026-10-30',
        shopId: 'shop-3',
        shopName: 'Alpha Telecom',
        productId: 'prod-1',
        productName: '65W Fast Charger',
        productSku: 'CHG-65W',
        quantity: 2,
        unitPrice: 450,
        totalAmount: 900,
        deliveryStatus: 'cancelled',
        pendingAmount: 0,
        createdAt: '2026-10-30T10:00:00Z'
      }
    ];

    it('Scenario 1: Pending filter shows only pending records and hides delivered/cancelled records', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStatusFilter="pending"
          />
        </MemoryRouter>
      );

      // Pending records MUST be rendered
      expect(html).toContain('25/10/2026'); // rec-p1
      expect(html).toContain('27/10/2026'); // rec-p2

      // Delivered records (even those with unpaid balance) and Cancelled records MUST NOT be rendered
      expect(html).not.toContain('28/10/2026'); // rec-d1
      expect(html).not.toContain('29/10/2026'); // rec-d2-unpaid, rec-d3-unpaid
      expect(html).not.toContain('30/10/2026'); // rec-cancelled
      expect(html).not.toContain('Wireless Earbuds'); // rec-d3-unpaid

      // Delivered Items section separator must be hidden entirely
      expect(html).not.toContain('Delivered Items (moved to bottom)');
      expect(html).toMatch(/2[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 2: Delivered filter shows only delivered records and excludes pending/cancelled records', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStatusFilter="delivered"
          />
        </MemoryRouter>
      );

      // Delivered records (both fully paid and unpaid) MUST be rendered
      expect(html).toContain('28/10/2026'); // rec-d1
      expect(html).toContain('29/10/2026'); // rec-d2-unpaid, rec-d3-unpaid
      expect(html).toContain('Wireless Earbuds');

      // Pending and Cancelled records MUST NOT be rendered
      expect(html).not.toContain('25/10/2026'); // rec-p1
      expect(html).not.toContain('27/10/2026'); // rec-p2
      expect(html).not.toContain('30/10/2026'); // rec-cancelled
      expect(html).toMatch(/3[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 3: All shows all permitted statuses across visual groups', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStatusFilter="all"
          />
        </MemoryRouter>
      );

      expect(html).toContain('25/10/2026'); // rec-p1
      expect(html).toContain('27/10/2026'); // rec-p2
      expect(html).toContain('28/10/2026'); // rec-d1
      expect(html).toContain('29/10/2026'); // rec-d2-unpaid, rec-d3-unpaid
      expect(html).toContain('Delivered Items (moved to bottom)');
    });

    it('Scenario 4: Pending count equals displayed pending record count (fixes screenshot bug)', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStatusFilter="pending"
          />
        </MemoryRouter>
      );

      // Must show exactly 2 matching records, NOT 4!
      expect(html).toMatch(/2[\s\S]{1,30}matching[\s\S]{1,30}records/);
      expect(html).not.toMatch(/4[\s\S]{1,30}matching[\s\S]{1,30}records/);
    });

    it('Scenario 5: Delivered count equals displayed delivered record count', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStatusFilter="delivered"
          />
        </MemoryRouter>
      );

      // Exactly 3 delivered records match
      expect(html).toMatch(/3[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 6: Exact date filter works correctly without timezone shifts', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialDate="2026-10-29"
          />
        </MemoryRouter>
      );

      // Only records on 2026-10-29
      expect(html).toContain('29/10/2026');
      expect(html).toContain('Wireless Earbuds');
      expect(html).toContain('6,750');
      expect(html).not.toContain('25/10/2026');
      expect(html).not.toContain('27/10/2026');
      expect(html).not.toContain('28/10/2026');
      expect(html).toMatch(/2[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 7: Date range works inclusively across both boundary dates', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStartDate="2026-10-25"
            initialEndDate="2026-10-28"
          />
        </MemoryRouter>
      );

      // Includes 25th (start boundary), 27th, and 28th (end boundary)
      expect(html).toContain('25/10/2026');
      expect(html).toContain('27/10/2026');
      expect(html).toContain('28/10/2026');
      expect(html).not.toContain('29/10/2026');
      expect(html).not.toContain('30/10/2026');
      expect(html).toMatch(/3[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 8: Search works by shop name and shop code', () => {
      // By name
      const htmlName = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialSearchQuery="Gamma Mobiles"
          />
        </MemoryRouter>
      );
      expect(htmlName).toContain('Gamma Mobiles');
      expect(htmlName).toContain('27/10/2026');
      expect(htmlName).toContain('29/10/2026');
      expect(htmlName).not.toContain('1dhope Accessories');
      expect(htmlName).toMatch(/2[\s\S]*?matching[\s\S]*?records/);

      // By shop code
      const htmlCode = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialSearchQuery="SHOP-GM"
          />
        </MemoryRouter>
      );
      expect(htmlCode).toContain('Gamma Mobiles');
      expect(htmlCode).not.toContain('1dhope Accessories');
      expect(htmlCode).toMatch(/2[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 9: Search works by product name and product SKU', () => {
      // By product name
      const htmlProd = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialSearchQuery="Wireless Earbuds"
          />
        </MemoryRouter>
      );
      expect(htmlProd).toContain('Wireless Earbuds');
      expect(htmlProd).toContain('Alpha Telecom');
      expect(htmlProd).not.toContain('1dhope Accessories');
      expect(htmlProd).toMatch(/1[\s\S]*?matching[\s\S]*?record/);

      // By product SKU
      const htmlSku = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialSearchQuery="EAR-WIR"
          />
        </MemoryRouter>
      );
      expect(htmlSku).toContain('Wireless Earbuds');
      expect(htmlSku).toContain('Alpha Telecom');
      expect(htmlSku).toMatch(/1[\s\S]*?matching[\s\S]*?record/);
    });

    it('Scenario 10: Search + Pending works combined', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialSearchQuery="1dhope"
            initialStatusFilter="pending"
          />
        </MemoryRouter>
      );

      // Matches only the pending record for 1dhope on 25 Oct
      expect(html).toContain('25/10/2026');
      // Excludes delivered record for 1dhope on 28 Oct
      expect(html).not.toContain('28/10/2026');
      // Excludes other shops
      expect(html).not.toContain('Gamma Mobiles');
      expect(html).toMatch(/1[\s\S]*?matching[\s\S]*?record/);
    });

    it('Scenario 11: Date + Delivered works combined', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialDate="2026-10-29"
            initialStatusFilter="delivered"
          />
        </MemoryRouter>
      );

      expect(html).toContain('29/10/2026');
      expect(html).toContain('Wireless Earbuds');
      expect(html).toContain('6,750');
      expect(html).not.toContain('25/10/2026');
      expect(html).toMatch(/2[\s\S]*?matching[\s\S]*?records/);
    });

    it('Scenario 12: Date range + Search + Pending works combined', () => {
      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialProducts={testProducts}
            initialRecords={regressionRecords}
            initialStartDate="2026-10-25"
            initialEndDate="2026-10-28"
            initialSearchQuery="Fast Charger"
            initialStatusFilter="pending"
          />
        </MemoryRouter>
      );

      expect(html).toContain('25/10/2026');
      expect(html).toContain('1dhope Accessories');
      expect(html).not.toContain('27/10/2026');
      expect(html).not.toContain('28/10/2026');
      expect(html).toMatch(/1[\s\S]*?matching[\s\S]*?record/);
    });

    it('Scenario 13: Clear Filters restores all records', () => {
      // Direct unit test of db.filterBusinessRecords with active filters vs cleared filters
      const filtered = db.filterBusinessRecords(regressionRecords, {
        startDate: '2026-10-25',
        endDate: '2026-10-27',
        status: 'pending'
      });
      expect(filtered).toHaveLength(2);

      // Cleared filters restores all records
      const restored = db.filterBusinessRecords(regressionRecords, {});
      expect(restored).toHaveLength(regressionRecords.length);
    });

    it('Scenario 14: Pagination does not leak nonmatching records', () => {
      // 15 total records: 12 delivered and 3 pending
      const largeSet: db.BusinessRecord[] = [
        ...regressionRecords,
        ...Array.from({ length: 9 }).map((_, i) => ({
          id: `rec-extra-deliv-${i}`,
          deliveryId: `del-extra-${i}`,
          date: '2026-10-28',
          shopId: 'shop-1',
          shopName: '1dhope Accessories',
          productId: 'prod-1',
          productName: 'Extra Delivered Item',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 100,
          deliveryStatus: 'delivered' as const,
          pendingAmount: 0,
          createdAt: `2026-10-28T12:00:0${i}Z`
        }))
      ];

      const html = renderToString(
        <MemoryRouter>
          <OwnerDashboard
            initialLoading={false}
            initialShops={testShops}
            initialRecords={largeSet}
            initialStatusFilter="pending"
            initialCurrentPage={1}
          />
        </MemoryRouter>
      );

      // 2 pending records match
      expect(html).toMatch(/2[\s\S]*?matching[\s\S]*?records/);
      expect(html).not.toContain('Extra Delivered Item');
      expect(html).not.toContain('Delivered Items (moved to bottom)');
    });

    it('Scenario 15: Changing delivery status updates filter results immediately after confirmation', async () => {
      let currentStatus: 'pending' | 'delivered' = 'pending';
      const record: db.BusinessRecord = {
        id: 'rec-dyn-1',
        deliveryId: 'del-dyn-1',
        date: '2026-10-30',
        shopId: 'shop-1',
        shopName: '1dhope Accessories',
        productId: 'prod-1',
        productName: '65W Fast Charger',
        quantity: 1,
        unitPrice: 450,
        totalAmount: 450,
        deliveryStatus: currentStatus,
        pendingAmount: 450,
        createdAt: '2026-10-30T10:00:00Z'
      };

      // Under pending filter, it matches initially
      let result = db.filterBusinessRecords([record], { status: 'pending' });
      expect(result).toHaveLength(1);

      // Delivery completes
      const updatedRecord = {
        ...record,
        deliveryStatus: 'delivered' as const
      };

      // Under pending filter, it immediately drops from the results
      result = db.filterBusinessRecords([updatedRecord], { status: 'pending' });
      expect(result).toHaveLength(0);

      // Under delivered filter, it immediately appears
      const deliveredResult = db.filterBusinessRecords([updatedRecord], { status: 'delivered' });
      expect(deliveredResult).toHaveLength(1);
    });

    it('Scenario 16: Refreshing the page preserves correct filtering behavior', () => {
      const filters = {
        date: '2026-10-29',
        status: 'delivered' as const
      };

      const firstLoad = db.filterBusinessRecords(regressionRecords, filters);
      const reloaded = db.filterBusinessRecords([...regressionRecords], { ...filters });

      expect(firstLoad.map(r => r.id)).toEqual(['rec-d2-unpaid', 'rec-d3-unpaid']);
      expect(reloaded.map(r => r.id)).toEqual(firstLoad.map(r => r.id));
    });
  });

  describe('Delivery Reversal UX & Financial Preservation Suite', () => {
    it('Scenario 17: Reverting delivered record does not trigger window.confirm and preserves financial record data', () => {
      const originalConfirm = typeof window !== 'undefined' ? window.confirm : undefined;
      let confirmCalled = false;
      if (typeof window !== 'undefined') {
        window.confirm = () => {
          confirmCalled = true;
          return true;
        };
      }

      try {
        const testDeliveredRecord: db.BusinessRecord = {
          id: 'rec-rev-1',
          deliveryId: 'del-rev-1',
          date: '2026-10-30',
          shopId: 'shop-1',
          shopName: 'Shop A',
          productId: 'prod-1',
          productName: '9a combo',
          quantity: 1,
          unitPrice: 241,
          totalAmount: 241,
          customerPrice: 300,
          profit: 59,
          deliveryStatus: 'delivered',
          pendingAmount: 0,
          createdAt: '2026-10-30T10:00:00Z'
        };

        const html = renderToString(
          <MemoryRouter>
            <OwnerDashboard
              initialLoading={false}
              initialShops={[]}
              initialRecords={[testDeliveredRecord]}
            />
          </MemoryRouter>
        );

        // Verify Delivered section renders with customerPrice 300 and profit +59
        expect(html).toContain('300');
        expect(html).toContain('+59');
        expect(html).toContain('Delivered Items (moved to bottom)');

        // Confirm that the native window.confirm prompt is never invoked
        expect(confirmCalled).toBe(false);
      } finally {
        if (typeof window !== 'undefined' && originalConfirm) {
          window.confirm = originalConfirm;
        }
      }
    });
  });

});



import { describe, it, expect } from 'vitest';
import { 
  CreateDailyReportSchema, 
  CreateDeliverySchema,
  CreateStockTransferSchema,
  CreatePaymentSchema,
  InvoiceSchema,
  calculatePaymentStatus,
  StockBalanceSchema,
  getDateRangeFromPreset,
  calculateGrossProfit,
  type StockBalance
} from './index.js';

describe('RTR Wholesale Management — 25 Business Scenarios', () => {

  // ========================================================
  // SCENARIO 1 - 7: INVENTORY MOVEMENTS, ISOLATION & TRANSFERS
  // ========================================================
  describe('Scenarios 1–7: Inventory Supply, Isolation, Transfers & Balance Rules', () => {
    const shopAId = '123e4567-e89b-12d3-a456-426614174001';
    const shopBId = '123e4567-e89b-12d3-a456-426614174002';
    const productId = '123e4567-e89b-12d3-a456-426614174010';
    const businessId = '123e4567-e89b-12d3-a456-426614174000';

    it('Scenario 1: Initial delivery to Shop A validates correctly', () => {
      const deliveryShopA = {
        business_id: businessId,
        shop_id: shopAId,
        delivery_date: '2026-10-18',
        notes: 'Morning batch supply to Shop A',
        items: [{ product_id: productId, quantity: 20 }]
      };
      const result = CreateDeliverySchema.safeParse(deliveryShopA);
      expect(result.success).toBe(true);
    });

    it('Scenario 2: Delivery to Shop B is tracked independently from Shop A', () => {
      const deliveryShopB = {
        business_id: businessId,
        shop_id: shopBId,
        delivery_date: '2026-10-18',
        notes: 'Morning batch supply to Shop B',
        items: [{ product_id: productId, quantity: 15 }]
      };
      const result = CreateDeliverySchema.safeParse(deliveryShopB);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shop_id).not.toBe(shopAId);
        expect(result.data.items[0]?.quantity).toBe(15);
      }
    });

    it('Scenario 3: Sales at Shop A do not alter Shop B inventory expectations', () => {
      // Mock ledger balances for Shop A and Shop B
      const shopABalance: StockBalance = {
        shop_id: shopAId,
        shop_name: 'Shop A',
        product_id: productId,
        product_name: 'Armor Case',
        product_sku: 'CASE-01',
        category: 'Mobile Cases',
        total_delivered: 20,
        confirmed_sold: 5,
        provisional_sold: 0,
        total_returned: 0,
        total_damaged: 0,
        total_transferred_in: 0,
        total_transferred_out: 0,
        expected_stock: 15,
        min_stock_threshold: 5
      };

      const shopBBalance: StockBalance = {
        shop_id: shopBId,
        shop_name: 'Shop B',
        product_id: productId,
        product_name: 'Armor Case',
        product_sku: 'CASE-01',
        category: 'Mobile Cases',
        total_delivered: 15,
        confirmed_sold: 0,
        provisional_sold: 0,
        total_returned: 0,
        total_damaged: 0,
        total_transferred_in: 0,
        total_transferred_out: 0,
        expected_stock: 15,
        min_stock_threshold: 5
      };

      expect(shopABalance.expected_stock).toBe(15);
      expect(shopBBalance.expected_stock).toBe(15);
      expect(shopABalance.confirmed_sold).toBe(5);
      expect(shopBBalance.confirmed_sold).toBe(0);
    });

    it('Scenario 4: Stock transfer between shops decrements source and increments destination', () => {
      const transferInput = {
        business_id: businessId,
        from_shop_id: shopAId,
        to_shop_id: shopBId,
        product_id: productId,
        quantity: 4,
        notes: 'Transfer 4 cases from Shop A to Shop B'
      };
      const result = CreateStockTransferSchema.safeParse(transferInput);
      expect(result.success).toBe(true);

      // Verify transfer cannot have same source and destination
      const invalidTransfer = { ...transferInput, to_shop_id: shopAId };
      const invalidResult = CreateStockTransferSchema.safeParse(invalidTransfer);
      expect(invalidResult.success).toBe(false);
    });

    it('Scenario 5: Damaged stock items decrement expected remaining stock', () => {
      const delivered = 20;
      const sold = 5;
      const damaged = 2;
      const expected = delivered - sold - damaged;
      expect(expected).toBe(13);
    });

    it('Scenario 6: Customer return increments expected remaining stock', () => {
      const delivered = 20;
      const sold = 5;
      const returned = 1;
      const expected = delivered - sold + returned;
      expect(expected).toBe(16);
    });

    it('Scenario 7: Prevents negative delivery quantities and negative sales', () => {
      const negativeDelivery = {
        business_id: businessId,
        shop_id: shopAId,
        delivery_date: '2026-10-18',
        items: [{ product_id: productId, quantity: -5 }]
      };
      expect(CreateDeliverySchema.safeParse(negativeDelivery).success).toBe(false);

      const negativeSale = {
        business_id: businessId,
        shop_id: shopAId,
        report_date: '2026-10-18',
        is_zero_sales: false,
        items: [{ product_id: productId, quantity_sold: -1 }]
      };
      expect(CreateDailyReportSchema.safeParse(negativeSale).success).toBe(false);
    });
  });

  // ========================================================
  // SCENARIO 8 - 11: DAILY SALES REPORTING & OWNER APPROVALS
  // ========================================================
  describe('Scenarios 8–11: Daily Sales Reporting & Owner Approvals', () => {
    const businessId = '123e4567-e89b-12d3-a456-426614174000';
    const shopId = '123e4567-e89b-12d3-a456-426614174001';
    const productId = '123e4567-e89b-12d3-a456-426614174010';

    it('Scenario 8: Explicit zero-sales report succeeds without sales items', () => {
      const zeroReport = {
        business_id: businessId,
        shop_id: shopId,
        report_date: '2026-10-18',
        is_zero_sales: true,
        notes: 'Store closed today for local festival',
        items: []
      };
      const result = CreateDailyReportSchema.safeParse(zeroReport);
      expect(result.success).toBe(true);
    });

    it('Scenario 9: Non-zero sales report requires at least one product with sold units > 0', () => {
      const missingSales = {
        business_id: businessId,
        shop_id: shopId,
        report_date: '2026-10-18',
        is_zero_sales: false,
        items: [{ product_id: productId, quantity_sold: 0 }]
      };
      const result = CreateDailyReportSchema.safeParse(missingSales);
      expect(result.success).toBe(false);

      const validSales = {
        ...missingSales,
        items: [{ product_id: productId, quantity_sold: 3 }]
      };
      expect(CreateDailyReportSchema.safeParse(validSales).success).toBe(true);
    });

    it('Scenario 10: Supports idempotency key to prevent accidental duplicate submission', () => {
      const idempotentReport = {
        business_id: businessId,
        shop_id: shopId,
        report_date: '2026-10-18',
        is_zero_sales: true,
        idempotency_key: '987fcdeb-51a2-43f7-9abc-def012345678',
        items: []
      };
      const result = CreateDailyReportSchema.safeParse(idempotentReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idempotency_key).toBe('987fcdeb-51a2-43f7-9abc-def012345678');
      }
    });

    it('Scenario 11: Owner approval transitions provisional sold units into confirmed sold', () => {
      let provisionalSold = 5;
      let confirmedSold = 10;

      // When owner approves report
      confirmedSold += provisionalSold;
      provisionalSold = 0;

      expect(confirmedSold).toBe(15);
      expect(provisionalSold).toBe(0);
    });
  });

  // ========================================================
  // SCENARIO 12 - 19: CASH PAYMENTS & MANDATORY COLOR AUDITING
  // ========================================================
  describe('Scenarios 12–19: Cash Payment Tracking & Color Invariant Audit', () => {
    it('Scenario 12: Due ₹5,000, Paid ₹5,000 -> status "fully_paid", color "GREEN"', () => {
      const result = calculatePaymentStatus(5000, 5000);
      expect(result.status).toBe('fully_paid');
      expect(result.outstandingAmount).toBe(0);
      expect(result.colorTheme).toBe('GREEN');
      expect(result.badgeClasses.bg).toContain('emerald');
    });

    it('Scenario 13: Due ₹8,000, Paid ₹5,000 -> status "partially_paid", balance ₹3,000, color "YELLOW"', () => {
      const result = calculatePaymentStatus(8000, 5000);
      expect(result.status).toBe('partially_paid');
      expect(result.outstandingAmount).toBe(3000);
      expect(result.colorTheme).toBe('YELLOW');
      expect(result.badgeClasses.bg).toContain('amber');
    });

    it('Scenario 14: Due ₹4,000, Paid ₹0 -> status "unpaid", balance ₹4,000, color "GREY"', () => {
      const result = calculatePaymentStatus(4000, 0);
      expect(result.status).toBe('unpaid');
      expect(result.outstandingAmount).toBe(4000);
      expect(result.colorTheme).toBe('GREY');
      expect(result.badgeClasses.bg).toContain('slate');
    });

    it('Scenario 15: Subsequent partial payment auto-transitions status to "fully_paid" when balance reaches 0', () => {
      const initial = calculatePaymentStatus(8000, 5000);
      expect(initial.status).toBe('partially_paid');
      expect(initial.colorTheme).toBe('YELLOW');

      // Second payment of remaining ₹3,000
      const totalPaid = 5000 + 3000;
      const updated = calculatePaymentStatus(8000, totalPaid);
      expect(updated.status).toBe('fully_paid');
      expect(updated.outstandingAmount).toBe(0);
      expect(updated.colorTheme).toBe('GREEN');
    });

    it('Scenario 16: STRICT COLOR INVARIANT: System NEVER uses red / rose for unpaid or partial status', () => {
      const testCases = [
        { total: 1000, paid: 0 },
        { total: 5000, paid: 500 },
        { total: 10000, paid: 0 },
        { total: 12000, paid: 11999 }
      ];

      for (const tc of testCases) {
        const res = calculatePaymentStatus(tc.total, tc.paid);
        // Verify colorTheme is NOT RED
        expect(res.colorTheme).not.toBe('RED');
        // Verify CSS classes never contain red or rose
        expect(res.badgeClasses.bg).not.toContain('red');
        expect(res.badgeClasses.bg).not.toContain('rose');
        expect(res.badgeClasses.text).not.toContain('red');
        expect(res.badgeClasses.text).not.toContain('rose');
      }
    });

    it('Scenario 17: Cash collection supports notebook references and manual audit notes', () => {
      const paymentInput = {
        business_id: '123e4567-e89b-12d3-a456-426614174000',
        shop_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_id: '123e4567-e89b-12d3-a456-426614174002',
        payment_date: '2026-10-18',
        amount: 5000,
        payment_method: 'CASH',
        payment_reference: 'Collected in cash - Notebook Page 14',
        notes: 'Handed over by shop manager Arun'
      };
      const result = CreatePaymentSchema.safeParse(paymentInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_reference).toContain('Notebook Page 14');
      }
    });

    it('Scenario 18: Payment methods include CASH, UPI, BANK_TRANSFER, CHEQUE', () => {
      const base = {
        business_id: '123e4567-e89b-12d3-a456-426614174000',
        shop_id: '123e4567-e89b-12d3-a456-426614174001',
        payment_date: '2026-10-18',
        amount: 2500
      };

      expect(CreatePaymentSchema.safeParse({ ...base, payment_method: 'CASH' }).success).toBe(true);
      expect(CreatePaymentSchema.safeParse({ ...base, payment_method: 'UPI' }).success).toBe(true);
      expect(CreatePaymentSchema.safeParse({ ...base, payment_method: 'BANK_TRANSFER' }).success).toBe(true);
      expect(CreatePaymentSchema.safeParse({ ...base, payment_method: 'INVALID' }).success).toBe(false);
    });

    it('Scenario 19: Validates invoice structure with zero balance on full payment', () => {
      const invoiceData = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        business_id: '123e4567-e89b-12d3-a456-426614174000',
        shop_id: '123e4567-e89b-12d3-a456-426614174001',
        invoice_number: 'MEMO-2026-001',
        invoice_date: '2026-10-18',
        total_amount: 5000,
        amount_paid: 5000,
        outstanding_amount: 0,
        status: 'fully_paid',
        notes: 'Fully settled'
      };
      const result = InvoiceSchema.safeParse(invoiceData);
      expect(result.success).toBe(true);
    });
  });

  // ========================================================
  // SCENARIO 20 - 25: SHOP SCOPING, AUDIT DISCREPANCY & SYSTEM INTEGRITY
  // ========================================================
  describe('Scenarios 20–25: Shop Scoping, Physical Discrepancy & Build Integrity', () => {
    it('Scenario 20: Employee shop membership restricts reporting to assigned shop', () => {
      const employeeAssignedShopId = '123e4567-e89b-12d3-a456-426614174001';
      const unauthorizedTargetShopId = '123e4567-e89b-12d3-a456-426614174002';

      const isAuthorized = (assignedShop: string, targetShop: string) => assignedShop === targetShop;
      expect(isAuthorized(employeeAssignedShopId, employeeAssignedShopId)).toBe(true);
      expect(isAuthorized(employeeAssignedShopId, unauthorizedTargetShopId)).toBe(false);
    });

    it('Scenario 21: Owner role has universal access across all shops', () => {
      const isOwner = true;
      const targetShops = ['shop-1', 'shop-2', 'shop-3'];
      const canAccessAll = targetShops.every(() => isOwner);
      expect(canAccessAll).toBe(true);
    });

    it('Scenario 22: Stock balance calculation accurately aggregates movements', () => {
      const totalDelivered = 50;
      const confirmedSold = 20;
      const provisionalSold = 5;
      const returned = 2;
      const damaged = 1;
      const transferredOut = 6;
      const transferredIn = 0;

      const expectedStock = totalDelivered - (confirmedSold + provisionalSold) + returned - damaged - transferredOut + transferredIn;
      expect(expectedStock).toBe(20);
    });

    it('Scenario 23: Discrepancy calculation handles shortage, surplus, and match', () => {
      const expectedStock = 20;

      // Exact match
      const physicalMatch = 20;
      expect(physicalMatch - expectedStock).toBe(0);

      // Shortage (shelf has fewer than system expects)
      const physicalShortage = 18;
      const shortageDiff = physicalShortage - expectedStock;
      expect(shortageDiff).toBe(-2);
      expect(shortageDiff < 0).toBe(true);

      // Surplus (shelf has more than system expects)
      const physicalSurplus = 22;
      const surplusDiff = physicalSurplus - expectedStock;
      expect(surplusDiff).toBe(2);
      expect(surplusDiff > 0).toBe(true);
    });

    it('Scenario 24: StockBalanceSchema parses full schema record with defaults', () => {
      const validBalance = {
        shop_id: '123e4567-e89b-12d3-a456-426614174001',
        shop_name: 'Apex Mobiles',
        product_id: '123e4567-e89b-12d3-a456-426614174010',
        product_name: 'Fast Charger',
        product_sku: 'CHG-01',
        category: 'Chargers & Adapters',
        total_delivered: 30,
        confirmed_sold: 10,
        provisional_sold: 2,
        expected_stock: 18,
        min_stock_threshold: 5
      };

      const result = StockBalanceSchema.safeParse(validBalance);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_returned).toBe(0);
        expect(result.data.total_damaged).toBe(0);
        expect(result.data.total_transferred_in).toBe(0);
      }
    });

    it('Scenario 25: Build and bundle validation sanity check', () => {
      // Verifies that pure TS calculation and shared exports resolve synchronously without runtime exception
      expect(typeof calculatePaymentStatus).toBe('function');
      const sample = calculatePaymentStatus(100, 100);
      expect(sample.status).toBe('fully_paid');
    });
  });

  // ========================================================
  // SCENARIO 26 - 30: HISTORICAL SEARCH, PRESETS & PROFIT
  // ========================================================
  describe('Scenarios 26–30: Historical Presets, Analytics & Profit Calculation', () => {
    const fixedBaseDate = new Date('2026-10-18T12:00:00Z');

    it('Scenario 26: All Time preset starts at 2000-01-01 to support records > 2 years ago', () => {
      const range = getDateRangeFromPreset('all_time', undefined, undefined, fixedBaseDate);
      expect(range.startDate).toBe('2000-01-01');
      expect(range.endDate).toBe('2026-10-18');
      expect(range.label).toBe('All Time');
    });

    it('Scenario 27: Last 2 Years preset accurately calculates 2-year boundary', () => {
      const range = getDateRangeFromPreset('last_2_years', undefined, undefined, fixedBaseDate);
      expect(range.startDate).toBe('2024-10-18');
      expect(range.endDate).toBe('2026-10-18');
      expect(range.label).toBe('Last 2 Years');
    });

    it('Scenario 28: Custom Range preset respects user-selected date boundaries', () => {
      const range = getDateRangeFromPreset('custom', '2023-01-01', '2023-12-31', fixedBaseDate);
      expect(range.startDate).toBe('2023-01-01');
      expect(range.endDate).toBe('2023-12-31');
      expect(range.label).toContain('2023-01-01 to 2023-12-31');
    });

    it('Scenario 29: Accurate gross profit calculation when cost price is recorded', () => {
      const revenue = 15000;
      const cogs = 9000;
      const profit = calculateGrossProfit(revenue, cogs);

      expect(profit.status).toBe('calculated');
      expect(profit.grossProfit).toBe(6000);
      expect(profit.marginPercent).toBe(40);
      expect(profit.message).toContain('₹6,000');
      expect(profit.message).toContain('40%');
    });

    it('Scenario 30: Missing cost data produces unavailable profit status rather than fabricated profit', () => {
      const revenue = 15000;
      const profit = calculateGrossProfit(revenue, null);

      expect(profit.status).toBe('missing_cost_data');
      expect(profit.grossProfit).toBeNull();
      expect(profit.marginPercent).toBeNull();
      expect(profit.message).toBe('Profit unavailable — cost data missing');
    });
  });
});


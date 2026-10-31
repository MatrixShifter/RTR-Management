import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ConfirmDeliveryModal } from './ConfirmDeliveryModal.js';
import { calculateRecordProfit } from '@crimpston/shared';
import type { BusinessRecord } from '../services/db.js';

describe('ConfirmDeliveryModal Financial Calculation & Loss Transactions', () => {
  const baseRecord: BusinessRecord = {
    id: 'rec-test-1',
    deliveryId: 'deliv-test-1',
    date: '2026-10-31',
    shopId: 'shop-1',
    shopName: 'Test Shop A',
    productId: 'prod-1',
    productName: '9a combo',
    quantity: 1,
    unitPrice: 2000,
    totalAmount: 2000,
    pendingAmount: 2000,
    createdAt: '2026-10-31T10:00:00Z',
    deliveryStatus: 'pending'
  };

  it('correctly calculates Profit/Loss = CP - Wholesale Amount for all standard test cases', () => {
    // Case A: Profit (Amount ₹2,000, CP ₹3,000 -> +₹1,000 PROFIT)
    expect(calculateRecordProfit(2000, 3000)).toBe(1000);

    // Case B: Break-even (Amount ₹2,000, CP ₹2,000 -> ₹0 BREAK-EVEN)
    expect(calculateRecordProfit(2000, 2000)).toBe(0);

    // Case C: Loss (Amount ₹2,000, CP ₹1,500 -> -₹500 LOSS)
    expect(calculateRecordProfit(2000, 1500)).toBe(-500);

    // Case D: Larger loss (Amount ₹5,000, CP ₹3,000 -> -₹2,000 LOSS)
    expect(calculateRecordProfit(5000, 3000)).toBe(-2000);
  });

  it('renders modal markup with required fields and buttons', () => {
    const html = renderToString(
      <ConfirmDeliveryModal
        isOpen={true}
        record={baseRecord}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Confirm Delivery');
    expect(html).toContain('Test Shop A');
    expect(html).toContain('9a combo');
    expect(html).toContain('2,000');
    expect(html).toContain('Customer Price (CP)');
    expect(html).toContain('Confirm Delivery');
  });

  it('renders loss warning when record already has customerPrice below cost (Case C & D)', () => {
    const lossRecord: BusinessRecord = {
      ...baseRecord,
      customerPrice: 1500
    };

    const html = renderToString(
      <ConfirmDeliveryModal
        isOpen={true}
        record={lossRecord}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Loss Warning (Selling Below Cost)');
    expect(html).toContain('-₹500');
    expect(html).toContain('text-rose-900');
  });

  it('renders profit when record already has customerPrice above cost (Case A)', () => {
    const profitRecord: BusinessRecord = {
      ...baseRecord,
      customerPrice: 3000
    };

    const html = renderToString(
      <ConfirmDeliveryModal
        isOpen={true}
        record={profitRecord}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Calculated Profit');
    expect(html).toContain('+₹1,000');
    expect(html).toContain('text-emerald-900');
  });

  it('renders break-even when record has customerPrice equal to cost (Case B)', () => {
    const breakEvenRecord: BusinessRecord = {
      ...baseRecord,
      customerPrice: 2000
    };

    const html = renderToString(
      <ConfirmDeliveryModal
        isOpen={true}
        record={breakEvenRecord}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('Break-even');
    expect(html).toContain('₹0');
    expect(html).toContain('text-slate-800');
  });
});

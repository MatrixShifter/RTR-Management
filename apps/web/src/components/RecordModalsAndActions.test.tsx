import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RecordActionsMenu } from './RecordActionsMenu.js';
import { RecordDetailsModal } from './RecordDetailsModal.js';
import { SettlePaymentModal } from './SettlePaymentModal.js';
import type { BusinessRecord } from '../services/db.js';

describe('Record Action Components (Menu & Modals)', () => {
  const mockRecord: BusinessRecord = {
    id: 'rec-test-100',
    deliveryId: 'del-test-100',
    date: '2026-10-24',
    shopId: 'shop-100',
    shopName: 'Metro Telecom',
    productId: 'prod-100',
    productName: 'Tempered Glass 9H',
    productSku: 'TG-9H',
    quantity: 50,
    unitPrice: 40,
    totalAmount: 2000,
    deliveryStatus: 'delivered',
    pendingAmount: 800,
    notes: 'Fragile shipment',
    createdAt: '2026-10-24T09:00:00Z'
  };

  describe('RecordActionsMenu', () => {
    it('renders exactly the 3 required actions: View Details, Edit Record, Delete Record', () => {
      const html = renderToString(
        <RecordActionsMenu
          record={mockRecord}
          anchorRect={{
            top: 200,
            bottom: 232,
            left: 500,
            right: 532,
            width: 32,
            height: 32,
            x: 500,
            y: 200,
            toJSON: () => {}
          }}
          onClose={() => {}}
          onViewDetails={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      );

      // Verify the 3 required actions
      expect(html).toContain('View Details');
      expect(html).toContain('Edit Record');
      expect(html).toContain('Delete Record');

      // Strictly verify Record Payment is NOT present
      expect(html).not.toContain('Record Payment');
    });

    it('does not render Record Payment even when pending balance is positive or zero', () => {
      const settledRecord: BusinessRecord = {
        ...mockRecord,
        pendingAmount: 0
      };

      const htmlSettled = renderToString(
        <RecordActionsMenu
          record={settledRecord}
          anchorRect={{
            top: 200,
            bottom: 232,
            left: 500,
            right: 532,
            width: 32,
            height: 32,
            x: 500,
            y: 200,
            toJSON: () => {}
          }}
          onClose={() => {}}
          onViewDetails={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      );

      expect(htmlSettled).not.toContain('Record Payment');
      expect(htmlSettled).toContain('View Details');
      expect(htmlSettled).toContain('Edit Record');
      expect(htmlSettled).toContain('Delete Record');
    });
  });

  describe('RecordDetailsModal', () => {
    it('renders only the 4 simplified workflow fields: Date, Product, Amount, and Delivery', () => {
      const html = renderToString(
        <RecordDetailsModal
          isOpen={true}
          record={mockRecord}
          onClose={() => {}}
        />
      );

      // Header
      expect(html).toContain('Record Details');
      expect(html).toContain('Delivered');

      // 4 Clean Workflow Fields
      expect(html).toContain('Date');
      expect(html).toContain('24/10/2026');

      expect(html).toContain('Product');
      expect(html).toContain('Tempered Glass 9H');

      expect(html).toContain('Amount (₹)');
      expect(html).toContain('₹2,000');

      expect(html).toContain('Delivery');

      // Close button
      expect(html).toContain('Close');

      // Strictly verifies removed fields and buttons do NOT appear
      expect(html).not.toContain('Metro Telecom'); // No Shop Name
      expect(html).not.toContain('TG-9H'); // No SKU
      expect(html).toContain('Quantity');
      expect(html).toContain('50 pcs');
      expect(html).not.toContain('Unit Price'); // No Unit Price
      expect(html).not.toContain('Outstanding Balance'); // No Financial Breakdown
      expect(html).not.toContain('Amount Paid'); // No Paid Amount
      expect(html).not.toContain('Fragile shipment'); // No Notes
      expect(html).not.toContain('Record Payment'); // No Record Payment Button
      expect(html).not.toContain('Edit Record'); // No Edit Record Button
    });

    it('renders Pending status badge when delivery status is pending', () => {
      const pendingRecord: BusinessRecord = {
        ...mockRecord,
        deliveryStatus: 'pending'
      };

      const html = renderToString(
        <RecordDetailsModal
          isOpen={true}
          record={pendingRecord}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Pending');
      expect(html).not.toContain('Delivered');
    });

    it('does not render when isOpen is false', () => {
      const html = renderToString(
        <RecordDetailsModal
          isOpen={false}
          record={mockRecord}
          onClose={() => {}}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('SettlePaymentModal', () => {
    it('renders settlement form with payment options and pending amount', () => {
      const html = renderToString(
        <SettlePaymentModal
          isOpen={true}
          record={mockRecord}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      expect(html).toContain('Record Payment');
      expect(html).toContain('Metro Telecom');
      expect(html).toContain('800');
      expect(html).toContain('Payment Method');
      expect(html).toContain('Cash');
      expect(html).toContain('UPI / QR');
      expect(html).toContain('Bank / NEFT');
      expect(html).toContain('Confirm Payment');
    });
  });
});

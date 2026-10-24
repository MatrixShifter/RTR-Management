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
    it('renders all 4 actions when pending balance is positive', () => {
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
          onRecordPayment={() => {}}
          onDelete={() => {}}
        />
      );

      expect(html).toContain('View Details');
      expect(html).toContain('Edit Record');
      expect(html).toContain('Record Payment');
      expect(html).toContain('Delete Record');
    });

    it('hides Record Payment when pending amount is 0', () => {
      const settledRecord: BusinessRecord = {
        ...mockRecord,
        pendingAmount: 0
      };

      const html = renderToString(
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
          onRecordPayment={() => {}}
          onDelete={() => {}}
        />
      );

      expect(html).toContain('View Details');
      expect(html).toContain('Edit Record');
      expect(html).not.toContain('Record Payment');
      expect(html).toContain('Delete Record');
    });
  });

  describe('RecordDetailsModal', () => {
    it('renders comprehensive delivery and financial details', () => {
      const html = renderToString(
        <RecordDetailsModal
          isOpen={true}
          record={mockRecord}
          onClose={() => {}}
          onEdit={() => {}}
          onRecordPayment={() => {}}
        />
      );

      expect(html).toContain('Metro Telecom');
      expect(html).toContain('Tempered Glass 9H');
      expect(html).toContain('TG-9H');
      expect(html).toContain('50');
      expect(html).toContain('pcs');
      expect(html).toContain('40');
      expect(html).toContain('2,000');
      expect(html).toContain('800');
      expect(html).toContain('Fragile shipment');
      expect(html).toContain('Delivered');
      expect(html).toContain('Record Payment');
      expect(html).toContain('Edit Record');
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

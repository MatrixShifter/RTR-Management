import { describe, it, expect } from 'vitest';
import { 
  getRecordPriority, 
  compareBusinessRecords, 
  sortBusinessRecords,
  type RecordPriorityInput 
} from './index.js';

describe('Feature: Prioritize Pending Records — RTR Wholesale Management', () => {
  // Sample fixtures
  const pendingRecord: RecordPriorityInput = {
    id: 'rec-pending-1',
    deliveryStatus: 'pending',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1000,
    pendingAmount: 1000,
    date: '2026-10-20',
    createdAt: '2026-10-20T10:00:00Z',
    shopName: 'Shop Alpha'
  };

  const partiallyPaidRecord: RecordPriorityInput = {
    id: 'rec-partially-paid-1',
    deliveryStatus: 'delivered',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1000,
    pendingAmount: 400,
    amountPaid: 600,
    date: '2026-10-21',
    createdAt: '2026-10-21T10:00:00Z',
    shopName: 'Shop Beta'
  };

  const deliveredUnpaidRecord: RecordPriorityInput = {
    id: 'rec-delivered-unpaid-1',
    deliveryStatus: 'delivered',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1000,
    pendingAmount: 1000,
    amountPaid: 0,
    date: '2026-10-22',
    createdAt: '2026-10-22T10:00:00Z',
    shopName: 'Shop Gamma'
  };

  const fullySettledRecord: RecordPriorityInput = {
    id: 'rec-completed-1',
    deliveryStatus: 'delivered',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1000,
    pendingAmount: 0,
    amountPaid: 1000,
    date: '2026-10-23',
    createdAt: '2026-10-23T10:00:00Z',
    shopName: 'Shop Delta'
  };

  describe('1. Priority Rank Calculation (getRecordPriority)', () => {
    it('assigns Rank 1 to Pending records with incomplete delivery and unpaid balance', () => {
      expect(getRecordPriority(pendingRecord)).toBe(1);
    });

    it('assigns Rank 2 to Partially completed / partially paid records with remaining balance', () => {
      expect(getRecordPriority(partiallyPaidRecord)).toBe(2);

      // Pending delivery but prepaid (in progress) is also Rank 2
      const prepaidPendingDelivery: RecordPriorityInput = {
        deliveryStatus: 'pending',
        totalAmount: 500,
        pendingAmount: 0,
        amountPaid: 500
      };
      expect(getRecordPriority(prepaidPendingDelivery)).toBe(2);
    });

    it('assigns Rank 3 to Delivered but payment pending records where full payment is owed', () => {
      expect(getRecordPriority(deliveredUnpaidRecord)).toBe(3);
    });

    it('assigns Rank 4 to Completed and fully settled records where delivery is complete and outstanding payment is zero', () => {
      expect(getRecordPriority(fullySettledRecord)).toBe(4);

      // Cancelled with 0 balance is also non-pending (Rank 4)
      const cancelledSettled: RecordPriorityInput = {
        deliveryStatus: 'cancelled',
        totalAmount: 500,
        pendingAmount: 0
      };
      expect(getRecordPriority(cancelledSettled)).toBe(4);
    });
  });

  describe('2. Test Cases from Specification', () => {
    it('Case 1: A pending record appears above a delivered and fully settled record', () => {
      const records = [fullySettledRecord, pendingRecord];
      const sorted = sortBusinessRecords(records);

      expect(sorted[0].id).toBe(pendingRecord.id);
      expect(sorted[1].id).toBe(fullySettledRecord.id);
    });

    it('Case 2: A delivered record with an outstanding balance stays near the top', () => {
      const records = [fullySettledRecord, deliveredUnpaidRecord, partiallyPaidRecord];
      const sorted = sortBusinessRecords(records);

      // Both delivered records with outstanding balance (ranks 2 and 3) must appear above fully settled (rank 4)
      expect(sorted[0].id).toBe(partiallyPaidRecord.id);
      expect(sorted[1].id).toBe(deliveredUnpaidRecord.id);
      expect(sorted[2].id).toBe(fullySettledRecord.id);
    });

    it('Case 3: Recording a partial payment updates its priority if necessary', () => {
      // Delivered unpaid starts at Priority 3
      expect(getRecordPriority(deliveredUnpaidRecord)).toBe(3);

      // After partial payment of ₹300, remaining balance is ₹700 -> moves to Priority 2
      const updatedAfterPartialPayment: RecordPriorityInput = {
        ...deliveredUnpaidRecord,
        pendingAmount: 700,
        amountPaid: 300
      };
      expect(getRecordPriority(updatedAfterPartialPayment)).toBe(2);

      // In a mixed list, it moves above remaining rank 3 records
      const list = [deliveredUnpaidRecord, updatedAfterPartialPayment];
      const sorted = sortBusinessRecords(list);
      expect(sorted[0].id).toBe(updatedAfterPartialPayment.id);
    });

    it('Case 4: Fully settling a payment moves the record toward the bottom', () => {
      // Record starts with remaining balance (Priority 2)
      expect(getRecordPriority(partiallyPaidRecord)).toBe(2);

      // Fully settling payment sets pendingAmount to 0
      const settledRecord: RecordPriorityInput = {
        ...partiallyPaidRecord,
        pendingAmount: 0,
        amountPaid: 1000
      };
      expect(getRecordPriority(settledRecord)).toBe(4);

      const list = [settledRecord, deliveredUnpaidRecord, pendingRecord];
      const sorted = sortBusinessRecords(list);

      // Settled record moves to the bottom
      expect(sorted[0].id).toBe(pendingRecord.id);
      expect(sorted[1].id).toBe(deliveredUnpaidRecord.id);
      expect(sorted[2].id).toBe(settledRecord.id);
    });

    it('Case 5: Newer records appear first within the same priority group', () => {
      const olderPending: RecordPriorityInput = {
        id: 'older-pending',
        deliveryStatus: 'pending',
        totalAmount: 1000,
        pendingAmount: 1000,
        date: '2026-10-18',
        createdAt: '2026-10-18T08:00:00Z'
      };

      const newerPending: RecordPriorityInput = {
        id: 'newer-pending',
        deliveryStatus: 'pending',
        totalAmount: 1000,
        pendingAmount: 1000,
        date: '2026-10-24',
        createdAt: '2026-10-24T09:00:00Z'
      };

      const sorted = sortBusinessRecords([olderPending, newerPending]);
      expect(sorted[0].id).toBe('newer-pending');
      expect(sorted[1].id).toBe('older-pending');
    });

    it('Case 6: Retains priority order across full 4-tier lifecycle', () => {
      const allFour = [
        fullySettledRecord,
        deliveredUnpaidRecord,
        partiallyPaidRecord,
        pendingRecord
      ];

      const sorted = sortBusinessRecords(allFour);
      expect(sorted.map(r => r.id)).toEqual([
        pendingRecord.id,         // Priority 1
        partiallyPaidRecord.id,   // Priority 2
        deliveredUnpaidRecord.id, // Priority 3
        fullySettledRecord.id     // Priority 4
      ]);
    });

    it('Case 7: Secondary sort by column retains priority groups', () => {
      // Within each priority group, sorting by shop name works alphabetically
      const pendingZ: RecordPriorityInput = {
        id: 'pending-z',
        deliveryStatus: 'pending',
        totalAmount: 100,
        pendingAmount: 100,
        shopName: 'Zebra Mobiles',
        date: '2026-10-20'
      };
      const pendingA: RecordPriorityInput = {
        id: 'pending-a',
        deliveryStatus: 'pending',
        totalAmount: 100,
        pendingAmount: 100,
        shopName: 'Alpha Mobiles',
        date: '2026-10-20'
      };
      const settledA: RecordPriorityInput = {
        id: 'settled-a',
        deliveryStatus: 'delivered',
        totalAmount: 100,
        pendingAmount: 0,
        shopName: 'Alpha Mobiles',
        date: '2026-10-20'
      };

      const sorted = sortBusinessRecords([settledA, pendingZ, pendingA], 'shop', 'asc');

      // Pending group (Priority 1) stays at the top with Alpha before Zebra
      expect(sorted[0].id).toBe('pending-a');
      expect(sorted[1].id).toBe('pending-z');
      // Settled group (Priority 4) stays at the bottom
      expect(sorted[2].id).toBe('settled-a');
    });
  });
});

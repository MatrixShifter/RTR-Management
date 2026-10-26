import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RecordEntryDrawer } from './RecordEntryDrawer.js';
import type { Shop, Product, BusinessRecord } from '../services/db.js';

describe('Simplified RecordEntryDrawer Component', () => {
  const mockShops: Shop[] = [
    { id: 'shop-1', name: 'RTR Anna Nagar', code: 'RTR-AN', address: 'Main St', phone: '9876543210', isActive: true, assignedEmployees: [] },
    { id: 'shop-2', name: 'RTR T Nagar', code: 'RTR-TN', address: 'South Rd', phone: '9876543211', isActive: true, assignedEmployees: [] }
  ];

  const mockProducts: Product[] = [
    { id: 'prod-1', name: 'Tempered Glass 9D', sku: 'TG-9D', category: 'Tempered Glass', unitPrice: 45, minStock: 10, isActive: true },
    { id: 'prod-2', name: 'Fast Charger 25W', sku: 'FC-25W', category: 'Chargers & Adapters', unitPrice: 250, minStock: 5, isActive: true }
  ];

  it('renders only the 4 allowed fields in order: Date, Shop Name, Product, Unit Price (₹)', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    // Visible required fields & buttons
    expect(html).toContain('Add Record');
    expect(html).toContain('Date');
    expect(html).toContain('Shop Name');
    expect(html).toContain('+ New Shop');
    expect(html).toContain('Product');
    expect(html).toContain('+ New Product');
    expect(html).toContain('Unit Price (₹)');
    expect(html).toContain('Cancel');
    expect(html).toContain('Save Record');

    // Confirms removed fields are completely absent from visible DOM
    expect(html).not.toContain('Quantity');
    expect(html).not.toContain('Delivery Status');
    expect(html).not.toContain('Payment Status &amp; Outstanding');
    expect(html).not.toContain('Payment Status & Outstanding');
    expect(html).not.toContain('Amount Paid');
    expect(html).not.toContain('Pending Balance');
    expect(html).not.toContain('Notes / Memo');
    expect(html).not.toContain('Total Billed Value');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={false}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    expect(html).toBe('');
  });

  it('renders shop and product options properly', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    expect(html).toContain('RTR Anna Nagar');
    expect(html).toContain('RTR T Nagar');
    expect(html).toContain('Tempered Glass 9D');
    expect(html).toContain('Fast Charger 25W');
  });

  it('renders in Edit mode with "Edit Record" title and pre-filled unit price', () => {
    const editingRecord: BusinessRecord = {
      id: 'rec-1',
      deliveryId: 'del-1',
      date: '2026-10-25',
      shopId: 'shop-1',
      shopName: 'RTR Anna Nagar',
      productId: 'prod-1',
      productName: 'Tempered Glass 9D',
      quantity: 1,
      unitPrice: 55,
      totalAmount: 55,
      deliveryStatus: 'pending' as const,
      pendingAmount: 55,
      notes: '',
      createdAt: '2026-10-25T10:00:00Z'
    };

    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
        editingRecord={editingRecord}
      />
    );

    expect(html).toContain('Edit Record');
    expect(html).toContain('value="55"');
    expect(html).toContain('Update Record');
    // Ensure removed fields still not present in edit mode
    expect(html).not.toContain('Quantity');
    expect(html).not.toContain('Total Billed Value');
  });
});

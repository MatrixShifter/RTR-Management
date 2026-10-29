import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RecordEntryDrawer } from './RecordEntryDrawer.js';
import { 
  type Shop, 
  type Product, 
  type BusinessRecord,
  saveShop,
  saveProduct,
  deleteShop,
  deleteProduct,
  getShops,
  getProducts,
  checkShopUsage,
  checkProductUsage,
  saveBusinessRecord,
  getBusinessRecords,
  setDemoMode
} from '../services/db.js';

describe('RecordEntryDrawer Component & Catalog Management Suite', () => {
  beforeEach(() => {
    setDemoMode(true);
  });

  const mockShops: Shop[] = [
    { id: 'shop-1', name: 'RTR Anna Nagar', code: 'RTR-AN', address: 'Main St', phone: '9876543210', isActive: true, assignedEmployees: [] },
    { id: 'shop-2', name: 'RTR T Nagar', code: 'RTR-TN', address: 'South Rd', phone: '9876543211', isActive: true, assignedEmployees: [] },
    { id: 'shop-archived', name: 'Old Closed Shop', code: 'RTR-OLD', address: 'Old St', phone: '0000000000', isActive: false, assignedEmployees: [] }
  ];

  const mockProducts: Product[] = [
    { id: 'prod-1', name: 'Tempered Glass 9D', sku: 'TG-9D', category: 'Tempered Glass', unitPrice: 45, minStock: 10, isActive: true },
    { id: 'prod-2', name: 'Fast Charger 25W', sku: 'FC-25W', category: 'Chargers & Adapters', unitPrice: 250, minStock: 5, isActive: true },
    { id: 'prod-archived', name: 'Legacy Phone Cover', sku: 'CVR-OLD', category: 'Mobile Cases', unitPrice: 99, minStock: 0, isActive: false }
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
    expect(html).toContain('New Shop');
    expect(html).toContain('Product');
    expect(html).toContain('New Product');
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

  it('renders "Manage Shops" and "Manage Products" options near their respective fields', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    // Near Shop Name field
    expect(html).toContain('Manage Shops');
    expect(html).toContain('Manage Shops...');

    // Near Product field
    expect(html).toContain('Manage Products');
    expect(html).toContain('Manage Products...');
  });

  it('filters out archived shops and products from active dropdown selections', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    // Active items appear
    expect(html).toContain('RTR Anna Nagar');
    expect(html).toContain('RTR T Nagar');
    expect(html).toContain('Tempered Glass 9D');
    expect(html).toContain('Fast Charger 25W');

    // Archived items are hidden from new record selections
    expect(html).not.toContain('Old Closed Shop');
    expect(html).not.toContain('Legacy Phone Cover');
  });

  it('preserves archived shop/product in dropdown when editing a historical record that used it', () => {
    const editingRecord: BusinessRecord = {
      id: 'rec-historical',
      deliveryId: 'del-historical',
      date: '2026-10-20',
      shopId: 'shop-archived',
      shopName: 'Old Closed Shop',
      productId: 'prod-archived',
      productName: 'Legacy Phone Cover',
      quantity: 1,
      unitPrice: 99,
      totalAmount: 99,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      notes: '',
      createdAt: '2026-10-20T10:00:00Z'
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

    // In edit mode for historical record, the selected archived item is retained
    expect(html).toContain('Old Closed Shop');
    expect(html).toContain('Legacy Phone Cover');
  });

  describe('Responsive Mobile Modal & Custom Dropdown Suite', () => {
    it('renders centered responsive modal with safe mobile constraints and flex-column layout', () => {
      const html = renderToString(
        <RecordEntryDrawer
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          shops={mockShops}
          products={mockProducts}
        />
      );

      // Verify modal dialog accessibility and responsive constraints
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('max-h-[calc(100dvh-1.5rem)]');
      expect(html).toContain('max-w-md');
      expect(html).toContain('rounded-2xl');

      // Verify custom accessible dropdown triggers
      expect(html).toContain('role="combobox"');
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain('Select a retail shop...');
      expect(html).toContain('Select a product...');
    });

    it('renders scrollable form content and fixed header/footer structure', () => {
      const html = renderToString(
        <RecordEntryDrawer
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
          shops={mockShops}
          products={mockProducts}
        />
      );

      // Fixed header with close button
      expect(html).toContain('id="record-modal-title"');
      expect(html).toContain('aria-label="Close modal"');

      // Scrollable form container
      expect(html).toContain('id="record-entry-form"');
      expect(html).toContain('overflow-y-auto');

      // Fixed footer with Cancel & Save Record
      expect(html).toContain('Cancel');
      expect(html).toContain('Save Record');
    });
  });

  describe('Catalog Lifecycle & Safe Deletion Business Logic', () => {
    it('creates a new shop and product and confirms they appear in active catalog', async () => {
      const newShop = await saveShop({
        name: 'Alpha Cellular Hub',
        code: 'ALPHA-HUB',
        address: '123 Market Rd',
        phone: '9876500001',
        isActive: true,
        assignedEmployees: []
      });

      const newProd = await saveProduct({
        name: 'Braided Type-C Fast Cable',
        sku: 'BTC-100',
        category: 'USB Cables',
        minStock: 20,
        unitPrice: 199,
        isActive: true
      });

      const allShops = await getShops();
      expect(allShops.some(s => s.id === newShop.id && s.name === 'Alpha Cellular Hub')).toBe(true);

      const allProducts = await getProducts();
      expect(allProducts.some(p => p.id === newProd.id && p.name === 'Braided Type-C Fast Cable')).toBe(true);
    });

    it('permanently deletes an unused shop and product from catalog', async () => {
      const unusedShop = await saveShop({
        name: 'Temporary Unused Shop',
        code: 'TEMP-S',
        address: 'Temp St',
        phone: '111',
        isActive: true,
        assignedEmployees: []
      });

      const unusedProd = await saveProduct({
        name: 'Temporary Unused Accessory',
        sku: 'TEMP-P',
        category: 'Other Accessories',
        minStock: 0,
        unitPrice: 50,
        isActive: true
      });

      // Verify usage is 0
      const shopUsage = await checkShopUsage(unusedShop.id);
      expect(shopUsage.inUse).toBe(false);
      expect(shopUsage.count).toBe(0);

      const prodUsage = await checkProductUsage(unusedProd.id);
      expect(prodUsage.inUse).toBe(false);
      expect(prodUsage.count).toBe(0);

      // Delete unused items
      const shopDelRes = await deleteShop(unusedShop.id);
      expect(shopDelRes.success).toBe(true);
      expect(shopDelRes.action).toBe('deleted');

      const prodDelRes = await deleteProduct(unusedProd.id);
      expect(prodDelRes.success).toBe(true);
      expect(prodDelRes.action).toBe('deleted');

      // Confirm removed from lists
      const shopsAfter = await getShops();
      expect(shopsAfter.some(s => s.id === unusedShop.id)).toBe(false);

      const prodsAfter = await getProducts();
      expect(prodsAfter.some(p => p.id === unusedProd.id)).toBe(false);
    });

    it('safely archives (soft-deletes) shop and product referenced by historical delivery records', async () => {
      // 1. Create a shop and product
      const activeShop = await saveShop({
        name: 'Partner Shop with History',
        code: 'PSH-1',
        address: 'History Rd',
        phone: '222',
        isActive: true,
        assignedEmployees: []
      });

      const activeProd = await saveProduct({
        name: 'Best Seller Wireless Earbuds',
        sku: 'BS-EARBUDS',
        category: 'Earphones & Audio',
        minStock: 10,
        unitPrice: 899,
        isActive: true
      });

      // 2. Create historical delivery record using them
      const savedRecord = await saveBusinessRecord({
        date: '2026-10-26',
        shopId: activeShop.id,
        shopName: activeShop.name,
        productId: activeProd.id,
        productName: activeProd.name,
        quantity: 5,
        unitPrice: 899,
        deliveryStatus: 'delivered',
        pendingAmount: 0
      });

      expect(savedRecord).toBeDefined();

      // 3. Verify usage detection correctly detects historical link
      const shopUsage = await checkShopUsage(activeShop.id);
      expect(shopUsage.inUse).toBe(true);
      expect(shopUsage.count).toBeGreaterThan(0);

      const prodUsage = await checkProductUsage(activeProd.id);
      expect(prodUsage.inUse).toBe(true);
      expect(prodUsage.count).toBeGreaterThan(0);

      // 4. Trigger deleteShop and deleteProduct -> MUST safe-archive, NOT cascade delete
      const shopRes = await deleteShop(activeShop.id);
      expect(shopRes.success).toBe(true);
      expect(shopRes.action).toBe('archived');
      expect(shopRes.inUse).toBe(true);

      const prodRes = await deleteProduct(activeProd.id);
      expect(prodRes.success).toBe(true);
      expect(prodRes.action).toBe('archived');
      expect(prodRes.inUse).toBe(true);

      // 5. Historical records MUST remain completely intact!
      const recordsAfter = await getBusinessRecords();
      const historicalRec = recordsAfter.find(r => r.id === savedRecord.id || r.deliveryId === savedRecord.deliveryId);
      expect(historicalRec).toBeDefined();
      expect(historicalRec?.shopName).toBe('Partner Shop with History');
      expect(historicalRec?.productName).toBe('Best Seller Wireless Earbuds');

      // 6. Archived items must have isActive === false so they are hidden from new record selections
      const allShops = await getShops();
      const archivedShop = allShops.find(s => s.id === activeShop.id);
      expect(archivedShop?.isActive).toBe(false);

      const allProducts = await getProducts();
      const archivedProd = allProducts.find(p => p.id === activeProd.id);
      expect(archivedProd?.isActive).toBe(false);
    }, 15000);
  });
});

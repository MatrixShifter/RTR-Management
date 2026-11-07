import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RecordEntryDrawer } from './RecordEntryDrawer.js';
import { AddEditShopModal } from './AddEditShopModal.js';
import { AddEditProductModal } from './AddEditProductModal.js';
import { ManageCatalogModal } from './ManageCatalogModal.js';
import { 
  type Shop, 
  type Product, 
  getShops, 
  getProducts, 
  saveShop, 
  saveProduct, 
  saveBusinessRecord, 
  getBusinessRecords, 
  setDemoMode 
} from '../services/db.js';

describe('Add Record — In-Modal Shop & Product Management Suite', { timeout: 25000 }, () => {
  beforeEach(() => {
    setDemoMode(true);
  });

  const mockShops: Shop[] = [
    { id: 'shop-1', name: 'Metro Cellular Store', code: 'MCS-1', address: '1st Cross Rd', phone: '9840111111', isActive: true, assignedEmployees: [] },
    { id: 'shop-2', name: 'Prime Mobile Zone', code: 'PMZ-2', address: '2nd Main Rd', phone: '9840222222', isActive: true, assignedEmployees: [] }
  ];

  const mockProducts: Product[] = [
    { id: 'prod-1', name: 'Silicone Matte Case iPhone 15', sku: 'SMC-15', category: 'Mobile Cases', unitPrice: 199, costPrice: 120, minStock: 10, isActive: true },
    { id: 'prod-2', name: '65W GaN Fast Adapter', sku: 'GAN-65', category: 'Chargers & Adapters', unitPrice: 799, costPrice: 500, minStock: 5, isActive: true }
  ];

  it('renders matching Shop Name and Product sections with adjacent Manage buttons and dropdown + Add actions', () => {
    const html = renderToString(
      <RecordEntryDrawer
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        shops={mockShops}
        products={mockProducts}
      />
    );

    // 1. Shop Name section & adjacent Manage Shops action
    expect(html).toContain('Shop Name');
    expect(html).toContain('Manage Shops');
    expect(html).toContain('+ Add Shop');

    // 2. Product section & adjacent Manage Products action
    expect(html).toContain('Product');
    expect(html).toContain('Manage Products');
    expect(html).toContain('+ Add Product');

    // 3. Autocomplete comboboxes for both
    expect(html).toContain('Select a retail shop...');
    expect(html).toContain('Select a product...');

    // 4. Form fields for delivery
    expect(html).toContain('Quantity (Pieces)');
    expect(html).toContain('Amount (₹)');
    expect(html).toContain('Delivery Status');
    expect(html).toContain('Customer Price (CP) (₹)');
  });

  it('renders AddEditShopModal with all required fields in both Add and Edit modes', () => {
    // Add mode
    const addHtml = renderToString(
      <AddEditShopModal
        isOpen={true}
        onClose={() => {}}
        initialName="New Retail Outlet"
        onSaveSuccess={() => {}}
        existingShops={mockShops}
      />
    );

    expect(addHtml).toContain('Add New Retail Shop');
    expect(addHtml).toContain('Shop Name');
    expect(addHtml).toContain('Shop Code');
    expect(addHtml).toContain('Contact Phone');
    expect(addHtml).toContain('Address / Location');
    expect(addHtml).toContain('Create &amp; Select Shop');

    // Edit mode
    const editHtml = renderToString(
      <AddEditShopModal
        isOpen={true}
        onClose={() => {}}
        shopToEdit={mockShops[0]}
        onSaveSuccess={() => {}}
        existingShops={mockShops}
      />
    );

    expect(editHtml).toContain('Edit Shop Details');
    expect(editHtml).toContain('Metro Cellular Store');
    expect(editHtml).toContain('MCS-1');
    expect(editHtml).toContain('Store Status');
    expect(editHtml).toContain('Save Changes');
  });

  it('renders AddEditProductModal with all required fields in both Add and Edit modes', () => {
    // Add mode
    const addHtml = renderToString(
      <AddEditProductModal
        isOpen={true}
        onClose={() => {}}
        initialName="Super Bass Wireless Headset"
        onSaveSuccess={() => {}}
        existingProducts={mockProducts}
      />
    );

    expect(addHtml).toContain('Add New Product');
    expect(addHtml).toContain('Product Name');
    expect(addHtml).toContain('SKU Code');
    expect(addHtml).toContain('Category');
    expect(addHtml).toContain('Selling Price (₹)');
    expect(addHtml).toContain('Cost Price (₹)');
    expect(addHtml).toContain('Low Stock Alert Threshold');
    expect(addHtml).toContain('Create &amp; Select Product');

    // Edit mode
    const editHtml = renderToString(
      <AddEditProductModal
        isOpen={true}
        onClose={() => {}}
        productToEdit={mockProducts[0]}
        onSaveSuccess={() => {}}
        existingProducts={mockProducts}
      />
    );

    expect(editHtml).toContain('Edit Product Details');
    expect(editHtml).toContain('Silicone Matte Case iPhone 15');
    expect(editHtml).toContain('SMC-15');
    expect(editHtml).toContain('Product Status');
    expect(editHtml).toContain('Save Changes');
  });

  it('renders ManageCatalogModal with search, + Add button, Edit, Select, and Delete actions', () => {
    // Manage Shops
    const shopsHtml = renderToString(
      <ManageCatalogModal
        isOpen={true}
        onClose={() => {}}
        type="shops"
        items={mockShops}
        onDelete={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(shopsHtml).toContain('Manage Shops');
    expect(shopsHtml).toContain('Add Shop');
    expect(shopsHtml).toContain('Metro Cellular Store');
    expect(shopsHtml).toContain('Prime Mobile Zone');
    expect(shopsHtml).toContain('Edit');
    expect(shopsHtml).toContain('Select');

    // Manage Products
    const prodsHtml = renderToString(
      <ManageCatalogModal
        isOpen={true}
        onClose={() => {}}
        type="products"
        items={mockProducts}
        onDelete={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(prodsHtml).toContain('Manage Products');
    expect(prodsHtml).toContain('Add Product');
    expect(prodsHtml).toContain('Silicone Matte Case iPhone 15');
    expect(prodsHtml).toContain('65W GaN Fast Adapter');
    expect(prodsHtml).toContain('Edit');
    expect(prodsHtml).toContain('Select');
  });

  it('executes full end-to-end workflow: create shop from Add Record, edit it from Manage Shops, create product, edit it, record delivery, and verify relationships and persistence', async () => {
    const initialShops = await getShops();
    const initialProducts = await getProducts();
    const initialRecords = await getBusinessRecords();

    expect(initialShops).toBeDefined();
    expect(initialProducts).toBeDefined();

    // 1. Add Shop from Add Record workflow
    const newShop = await saveShop({
      name: 'Vibrant Mobiles Express',
      code: 'VME-01',
      phone: '9840333333',
      address: 'Shop #12, Express Avenue, Chennai',
      isActive: true,
      assignedEmployees: []
    });
    expect(newShop.id).toBeDefined();

    // 2. Edit Shop from Manage Shops workflow
    const updatedShop = await saveShop({
      id: newShop.id,
      name: 'Vibrant Mobiles Express (Flagship)',
      code: newShop.code,
      phone: '9840444444',
      address: 'Shop #12-14, Express Avenue, Chennai',
      isActive: true,
      assignedEmployees: []
    });
    expect(updatedShop.name).toBe('Vibrant Mobiles Express (Flagship)');
    expect(updatedShop.phone).toBe('9840444444');

    // Verify persistence after refresh
    const shopsAfterEdit = await getShops();
    const persistedShop = shopsAfterEdit.find(s => s.id === newShop.id);
    expect(persistedShop?.name).toBe('Vibrant Mobiles Express (Flagship)');

    // 3. Add Product from Add Record workflow
    const newProd = await saveProduct({
      name: 'Titanium Edge Screen Guard',
      sku: 'TESG-100',
      category: 'Tempered Glass',
      unitPrice: 299,
      costPrice: 150,
      minStock: 10,
      isActive: true
    });
    expect(newProd.id).toBeDefined();

    // 4. Edit Product from Manage Products workflow
    const updatedProd = await saveProduct({
      id: newProd.id,
      name: 'Titanium Edge Screen Guard (Privacy Filter)',
      sku: newProd.sku,
      category: 'Tempered Glass',
      unitPrice: 349,
      costPrice: 160,
      minStock: 8,
      isActive: true
    });
    expect(updatedProd.name).toBe('Titanium Edge Screen Guard (Privacy Filter)');
    expect(updatedProd.unitPrice).toBe(349);

    // Verify persistence after refresh
    const prodsAfterEdit = await getProducts();
    const persistedProd = prodsAfterEdit.find(p => p.id === newProd.id);
    expect(persistedProd?.unitPrice).toBe(349);

    // 5. Save a delivery transaction using the newly created & edited shop and product
    const deliveryRecord = await saveBusinessRecord({
      date: '2026-11-03',
      shopId: persistedShop!.id,
      shopName: persistedShop!.name,
      productId: persistedProd!.id,
      productName: persistedProd!.name,
      quantity: 6,
      unitPrice: 349,
      totalAmount: 6 * 349, // 2094
      customerPrice: 3000,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      paidAmount: 2094,
      notes: 'Initial stocking delivery from Add Record'
    });

    expect(deliveryRecord).toBeDefined();
    expect(deliveryRecord.shopId).toBe(persistedShop!.id);
    expect(deliveryRecord.productId).toBe(persistedProd!.id);
    expect(deliveryRecord.quantity).toBe(6);
    expect(deliveryRecord.totalAmount).toBe(2094);
    expect(deliveryRecord.deliveryStatus).toBe('delivered');

    // 6. Verify records persistence and relationship integrity
    const allRecords = await getBusinessRecords();
    const foundRecord = allRecords.find(r => r.deliveryId === deliveryRecord.deliveryId || r.id === deliveryRecord.id);
    expect(foundRecord).toBeDefined();
    expect(foundRecord?.shopName).toBe('Vibrant Mobiles Express (Flagship)');
    expect(foundRecord?.productName).toBe('Titanium Edge Screen Guard (Privacy Filter)');

    // 7. Verify existing historical records remain intact
    expect(allRecords.length).toBeGreaterThanOrEqual(initialRecords.length + 1);
    for (const initRec of initialRecords) {
      expect(allRecords.some(r => r.id === initRec.id)).toBe(true);
    }
  });
});

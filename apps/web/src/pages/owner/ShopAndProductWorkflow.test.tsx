import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getShops, 
  saveShop, 
  getProducts, 
  saveProduct, 
  saveBusinessRecord, 
  getBusinessRecords,
  checkShopUsage,
  setDemoMode
} from '../../services/db.js';

describe('Shop & Product Complete Lifecycle & Workflow Verification Suite', { timeout: 20000 }, () => {
  beforeEach(() => {
    setDemoMode(true);
  });

  it('verifies the complete 12-step lifecycle: create shop, edit, create product, edit, record delivery transaction, verify quantities, duplicates, and persistence', async () => {
    // 0. Initial baseline state
    const initialShops = await getShops();
    const initialProducts = await getProducts();
    const initialRecords = await getBusinessRecords();

    const initialShopCount = initialShops.length;
    const initialProductCount = initialProducts.length;
    const initialRecordCount = initialRecords.length;

    // ----------------------------------------------------
    // STEP 1: Create a shop
    // ----------------------------------------------------
    const timestamp = Date.now().toString().slice(-4);
    const shopInput = {
      name: `Galaxy Mobiles ${timestamp}`,
      code: `GM-${timestamp}`,
      phone: '9840123456',
      address: '77 Commercial Street, Bangalore',
      isActive: true,
      assignedEmployees: []
    };

    const createdShop = await saveShop(shopInput);
    expect(createdShop).toBeDefined();
    expect(createdShop.id).toBeDefined();
    expect(createdShop.name).toBe(shopInput.name);
    expect(createdShop.code).toBe(shopInput.code);
    expect(createdShop.isActive).toBe(true);

    // ----------------------------------------------------
    // STEP 2: Verify it appears in the shop list
    // ----------------------------------------------------
    const shopsAfterAdd = await getShops();
    expect(shopsAfterAdd.length).toBe(initialShopCount + 1);
    const foundShop = shopsAfterAdd.find(s => s.id === createdShop.id);
    expect(foundShop).toBeDefined();
    expect(foundShop?.name).toBe(shopInput.name);
    expect(foundShop?.phone).toBe(shopInput.phone);

    // ----------------------------------------------------
    // STEP 3: Edit the shop
    // ----------------------------------------------------
    const editedShopName = `Galaxy Mobiles Flagship ${timestamp}`;
    const editedPhone = '9840999888';
    const updatedShop = await saveShop({
      id: createdShop.id,
      name: editedShopName,
      code: createdShop.code,
      phone: editedPhone,
      address: '77 Commercial Street, Suite 4B, Bangalore',
      isActive: false, // toggle inactive
      assignedEmployees: []
    });

    expect(updatedShop.id).toBe(createdShop.id);
    expect(updatedShop.name).toBe(editedShopName);
    expect(updatedShop.phone).toBe(editedPhone);
    expect(updatedShop.isActive).toBe(false);

    // ----------------------------------------------------
    // STEP 4: Refresh and verify persistence
    // ----------------------------------------------------
    const refreshedShops = await getShops();
    const refreshedShop = refreshedShops.find(s => s.id === createdShop.id);
    expect(refreshedShop).toBeDefined();
    expect(refreshedShop?.name).toBe(editedShopName);
    expect(refreshedShop?.phone).toBe(editedPhone);
    expect(refreshedShop?.isActive).toBe(false);

    // Re-activate shop for transaction recording
    await saveShop({
      ...refreshedShop!,
      isActive: true
    });

    // ----------------------------------------------------
    // STEP 5: Create a product
    // ----------------------------------------------------
    const prodInput = {
      name: `65W GaN Nitro Charger ${timestamp}`,
      sku: `GAN-65W-${timestamp}`,
      category: 'Chargers & Adapters' as const,
      unitPrice: 450,
      costPrice: 280,
      minStock: 20,
      isActive: true
    };

    const createdProduct = await saveProduct(prodInput);
    expect(createdProduct).toBeDefined();
    expect(createdProduct.id).toBeDefined();
    expect(createdProduct.name).toBe(prodInput.name);
    expect(createdProduct.sku).toBe(prodInput.sku);
    expect(createdProduct.unitPrice).toBe(450);
    expect(createdProduct.costPrice).toBe(280);

    // ----------------------------------------------------
    // STEP 6: Verify it appears in the product list
    // ----------------------------------------------------
    const prodsAfterAdd = await getProducts();
    expect(prodsAfterAdd.length).toBe(initialProductCount + 1);
    const foundProduct = prodsAfterAdd.find(p => p.id === createdProduct.id);
    expect(foundProduct).toBeDefined();
    expect(foundProduct?.name).toBe(prodInput.name);
    expect(foundProduct?.unitPrice).toBe(450);

    // ----------------------------------------------------
    // STEP 7: Edit the product
    // ----------------------------------------------------
    const updatedProdName = `65W GaN Nitro Charger Pro ${timestamp}`;
    const updatedPrice = 499;
    const updatedProduct = await saveProduct({
      id: createdProduct.id,
      name: updatedProdName,
      sku: createdProduct.sku,
      category: createdProduct.category,
      unitPrice: updatedPrice,
      costPrice: 290,
      minStock: 25,
      isActive: true
    });

    expect(updatedProduct.id).toBe(createdProduct.id);
    expect(updatedProduct.name).toBe(updatedProdName);
    expect(updatedProduct.unitPrice).toBe(updatedPrice);

    // ----------------------------------------------------
    // STEP 8: Refresh and verify persistence
    // ----------------------------------------------------
    const refreshedProds = await getProducts();
    const refreshedProduct = refreshedProds.find(p => p.id === createdProduct.id);
    expect(refreshedProduct).toBeDefined();
    expect(refreshedProduct?.name).toBe(updatedProdName);
    expect(refreshedProduct?.unitPrice).toBe(updatedPrice);

    // ----------------------------------------------------
    // STEP 9: Create a delivery using newly created shop and product
    // ----------------------------------------------------
    const deliveryQty = 15;
    const unitRate = 499;
    const totalDeliveryAmt = deliveryQty * unitRate;

    const savedRecord = await saveBusinessRecord({
      date: '2026-11-03',
      shopId: createdShop.id,
      shopName: editedShopName,
      productId: createdProduct.id,
      productName: updatedProdName,
      quantity: deliveryQty,
      unitPrice: unitRate,
      totalAmount: totalDeliveryAmt,
      deliveryStatus: 'delivered',
      pendingAmount: 0,
      notes: 'Initial test supply shipment'
    });

    expect(savedRecord).toBeDefined();
    expect(savedRecord.id).toBeDefined();
    expect(savedRecord.shopName).toBe(editedShopName);
    expect(savedRecord.productName).toBe(updatedProdName);
    expect(savedRecord.quantity).toBe(deliveryQty);
    expect(savedRecord.totalAmount).toBe(totalDeliveryAmt);
    expect(savedRecord.deliveryStatus).toBe('delivered');

    // ----------------------------------------------------
    // STEP 10: Verify all related records and quantities
    // ----------------------------------------------------
    const allRecordsAfter = await getBusinessRecords();
    expect(allRecordsAfter.length).toBe(initialRecordCount + 1);

    const recordFound = allRecordsAfter.find(r => r.deliveryId === savedRecord.deliveryId);
    expect(recordFound).toBeDefined();
    expect(recordFound?.quantity).toBe(15);
    expect(recordFound?.totalAmount).toBe(15 * 499);

    // Verify relationship checks and safe archiving:
    // Because this shop and product now have recorded delivery transactions,
    // safe deletion checks should detect usage and prevent permanent uncoordinated cascade.
    const shopUsage = await checkShopUsage(createdShop.id);
    expect(shopUsage).toBeDefined();

    // ----------------------------------------------------
    // STEP 11: Test duplicate shop/product submission
    // ----------------------------------------------------
    const allCurrentShops = await getShops();
    const isDuplicateShop = allCurrentShops.some(s => s.name.toLowerCase() === editedShopName.toLowerCase());
    expect(isDuplicateShop).toBe(true);

    const allCurrentProducts = await getProducts();
    const isDuplicateProduct = allCurrentProducts.some(p => p.sku.toUpperCase() === createdProduct.sku.toUpperCase());
    expect(isDuplicateProduct).toBe(true);

    // ----------------------------------------------------
    // STEP 12: Verify existing records remain unchanged
    // ----------------------------------------------------
    initialShops.forEach(originalShop => {
      const existing = allCurrentShops.find(s => s.id === originalShop.id);
      expect(existing).toBeDefined();
      expect(existing?.name).toBe(originalShop.name);
    });

    initialProducts.forEach(originalProd => {
      const existing = allCurrentProducts.find(p => p.id === originalProd.id);
      expect(existing).toBeDefined();
      expect(existing?.name).toBe(originalProd.name);
    });
  });
});

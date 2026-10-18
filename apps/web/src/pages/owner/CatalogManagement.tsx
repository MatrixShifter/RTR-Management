import React, { useState, useEffect } from 'react';
import { Store, Package, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import type { ProductCategory } from '@crimpston/shared';
import { 
  getShops, 
  saveShop, 
  deleteShop, 
  getProducts, 
  saveProduct, 
  deleteProduct,
  resetWorkspaceToCleanEmptyState,
  type Shop, 
  type Product 
} from '../../services/db.js';

export const CatalogManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shops' | 'products'>('shops');
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal form states
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Mobile Cases');
  const [prodMinStock, setProdMinStock] = useState(5);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedShops, loadedProducts] = await Promise.all([
        getShops(),
        getProducts()
      ]);
      setShops(loadedShops);
      setProducts(loadedProducts);
    } catch (err) {
      console.error('Failed to load catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('rtr_data_sync', handleSync);
    return () => window.removeEventListener('rtr_data_sync', handleSync);
  }, []);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !shopCode.trim()) return;

    await saveShop({
      name: shopName.trim(),
      code: shopCode.trim().toUpperCase(),
      address: shopAddress.trim(),
      phone: shopPhone.trim(),
      isActive: true,
      assignedEmployees: []
    });

    setIsShopModalOpen(false);
    setShopName('');
    setShopCode('');
    setShopAddress('');
    setShopPhone('');
    await loadData();
  };

  const handleDeleteShop = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteShop(id);
      await loadData();
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodSku.trim()) return;

    await saveProduct({
      name: prodName.trim(),
      sku: prodSku.trim().toUpperCase(),
      category: prodCategory,
      minStock: prodMinStock,
      isActive: true
    });

    setIsProductModalOpen(false);
    setProdName('');
    setProdSku('');
    setProdMinStock(5);
    await loadData();
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteProduct(id);
      await loadData();
    }
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to clear all business data and return to a fresh empty state?')) {
      resetWorkspaceToCleanEmptyState();
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Catalog & Retail Stores</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure partner retail store locations and your wholesale accessories product catalog.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === 'shops' ? (
            <Button variant="primary" size="sm" onClick={() => setIsShopModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Shop
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsProductModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Product
            </Button>
          )}
          {(shops.length > 0 || products.length > 0) && (
            <Button variant="outline" size="sm" onClick={handleResetData} title="Reset all data to clean empty state">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Clear Workspace
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('shops')}
          className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-semibold text-xs transition-colors ${
            activeTab === 'shops'
              ? 'border-crimpston-electric text-crimpston-electric'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Retail Stores ({shops.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-semibold text-xs transition-colors ${
            activeTab === 'products'
              ? 'border-crimpston-electric text-crimpston-electric'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Catalog ({products.length})</span>
        </button>
      </div>

      {/* Tab 1: Shops */}
      {activeTab === 'shops' && (
        <Card title="Active Retail Shops">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading shops...</div>
          ) : shops.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No shops added yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Get started by adding your first retail partner shop to track accessories delivery and sales.
              </p>
              <Button variant="primary" size="sm" onClick={() => setIsShopModalOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add First Shop
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Shop Code</th>
                    <th className="py-2.5 px-3">Store Name</th>
                    <th className="py-2.5 px-3">Address</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shops.map(shop => (
                    <tr key={shop.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{shop.code}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{shop.name}</td>
                      <td className="py-3 px-3 text-slate-500">{shop.address || '-'}</td>
                      <td className="py-3 px-3 text-slate-500">{shop.phone || '-'}</td>
                      <td className="py-3 px-3">
                        <Badge variant={shop.isActive ? 'success' : 'neutral'}>
                          {shop.isActive ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteShop(shop.id, shop.name)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete Shop"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Products */}
      {activeTab === 'products' && (
        <Card title="Catalog Products & Thresholds">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No products added yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Add accessory items (cases, tempered glass, chargers, cables) to your catalog.
              </p>
              <Button variant="primary" size="sm" onClick={() => setIsProductModalOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add First Product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Min Threshold</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{prod.sku}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{prod.name}</td>
                      <td className="py-3 px-3 text-slate-600">{prod.category}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">{prod.minStock} pcs</td>
                      <td className="py-3 px-3">
                        <Badge variant={prod.isActive ? 'success' : 'neutral'}>
                          {prod.isActive ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="text-slate-400 hover:text-rose-600"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Add Shop Modal */}
      <Modal isOpen={isShopModalOpen} onClose={() => setIsShopModalOpen(false)} title="Add Retail Partner Shop">
        <form onSubmit={handleAddShop} className="space-y-4">
          <Input
            label="Shop Name"
            placeholder="e.g. Metro Mobile Care"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Shop Code"
              placeholder="e.g. SH-01"
              value={shopCode}
              onChange={(e) => setShopCode(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              placeholder="e.g. +91 9876543210"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Store Address</label>
            <textarea
              rows={2}
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="e.g. Shop 12, Commercial Complex, Sector 4"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsShopModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Shop
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Product Modal */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title="Add Catalog Product">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <Input
            label="Product Name"
            placeholder="e.g. 65W GaN Fast Charger"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU"
              placeholder="e.g. CHG-65W-GAN"
              value={prodSku}
              onChange={(e) => setProdSku(e.target.value)}
              required
            />
            <Input
              label="Min Alert Threshold (pcs)"
              type="number"
              min={1}
              value={prodMinStock}
              onChange={(e) => setProdMinStock(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Category</label>
            <select
              value={prodCategory}
              onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
            >
              <option value="Mobile Cases">Mobile Cases</option>
              <option value="Tempered Glass">Tempered Glass</option>
              <option value="Chargers & Adapters">Chargers & Adapters</option>
              <option value="USB Cables">USB Cables</option>
              <option value="Earphones & Audio">Earphones & Audio</option>
              <option value="Other Accessories">Other Accessories</option>
            </select>
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsProductModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

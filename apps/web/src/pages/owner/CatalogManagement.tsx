import React, { useState } from 'react';
import { Store, Package, Plus, Edit2 } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import type { ProductCategory } from '@crimpston/shared';

export const CatalogManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shops' | 'products'>('shops');
  
  // Shops state
  const [shops, setShops] = useState([
    { id: 's1', name: 'Apex Mobiles & Telecom', code: 'SH-01', address: 'Sector 4 Complex', phone: '+91 9876543210', isActive: true, assignedEmployees: ['Arun Kumar'] },
    { id: 's2', name: 'City Point Digital Hub', code: 'SH-02', address: 'Main Market Road', phone: '+91 9876543211', isActive: true, assignedEmployees: ['Deepak Sharma'] }
  ]);
  
  // Products state
  const [products, setProducts] = useState([
    { id: 'p1', name: 'Shockproof Armor Case (iPhone 15)', sku: 'CASE-IP15-ARM', category: 'Mobile Cases', minStock: 5, isActive: true },
    { id: 'p2', name: '9H 2.5D Tempered Glass (Galaxy S24)', sku: 'TG-S24-9H', category: 'Tempered Glass', minStock: 10, isActive: true },
    { id: 'p3', name: '65W GaN Fast Charger Dual Port', sku: 'CHG-65W-GAN', category: 'Chargers & Adapters', minStock: 3, isActive: true }
  ]);

  // Modal form states
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [shopAddress, setShopAddress] = useState('');

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Mobile Cases');
  const [prodMinStock, setProdMinStock] = useState(5);

  const handleAddShop = (e: React.FormEvent) => {
    e.preventDefault();
    setShops(prev => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        name: shopName,
        code: shopCode,
        address: shopAddress,
        phone: '',
        isActive: true,
        assignedEmployees: []
      }
    ]);
    setIsShopModalOpen(false);
    setShopName('');
    setShopCode('');
    setShopAddress('');
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setProducts(prev => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        name: prodName,
        sku: prodSku,
        category: prodCategory,
        minStock: prodMinStock,
        isActive: true
      }
    ]);
    setIsProductModalOpen(false);
    setProdName('');
    setProdSku('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Retail Shops & Products Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure partner shops, employee assignments, and catalog SKUs with threshold alerts.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === 'shops' ? (
            <Button variant="primary" size="sm" onClick={() => setIsShopModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Retail Shop
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsProductModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product SKU
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('shops')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'shops'
              ? 'border-crimpston-electric text-crimpston-electric'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Retail Shops ({shops.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-crimpston-electric text-crimpston-electric'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Catalog ({products.length})</span>
        </button>
      </div>

      {/* Tab 1: Shops */}
      {activeTab === 'shops' && (
        <Card title="Active Retail Shops">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Shop Code</th>
                  <th className="py-2.5 px-3">Store Name</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3">Assigned Employees</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.map(shop => (
                  <tr key={shop.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">{shop.code}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{shop.name}</td>
                    <td className="py-3 px-3 text-slate-500">{shop.address}</td>
                    <td className="py-3 px-3">
                      {shop.assignedEmployees.length > 0 ? (
                        <span className="text-slate-700">{shop.assignedEmployees.join(', ')}</span>
                      ) : (
                        <span className="text-amber-600 italic">No Employee Assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={shop.isActive ? 'success' : 'neutral'}>
                        {shop.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Products */}
      {activeTab === 'products' && (
        <Card title="Catalog Products & Thresholds">
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
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Add Shop */}
      <Modal isOpen={isShopModalOpen} onClose={() => setIsShopModalOpen(false)} title="Create New Retail Shop">
        <form onSubmit={handleAddShop} className="space-y-4">
          <Input label="Shop Name" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Metro Mobile Zone" required />
          <Input label="Shop Code" value={shopCode} onChange={e => setShopCode(e.target.value)} placeholder="e.g. SH-03" required />
          <Input label="Store Address" value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="e.g. Unit 14, City Mall" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsShopModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Shop</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Product */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title="Add Product to Catalog">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <Input label="Product Name" value={prodName} onChange={e => setProdName(e.target.value)} placeholder="e.g. MagSafe Wireless Stand" required />
          <Input label="SKU / Barcode" value={prodSku} onChange={e => setProdSku(e.target.value)} placeholder="e.g. ACC-MAG-STND" required />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Category</label>
            <select
              value={prodCategory}
              onChange={e => setProdCategory(e.target.value as ProductCategory)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            >
              <option value="Mobile Cases">Mobile Cases</option>
              <option value="Tempered Glass">Tempered Glass</option>
              <option value="Chargers & Adapters">Chargers & Adapters</option>
              <option value="USB Cables">USB Cables</option>
              <option value="Earphones & Audio">Earphones & Audio</option>
              <option value="Holders & Mounts">Holders & Mounts</option>
              <option value="Power Banks">Power Banks</option>
              <option value="Other Accessories">Other Accessories</option>
            </select>
          </div>
          <Input label="Low-Stock Alert Threshold" type="number" min={0} value={prodMinStock} onChange={e => setProdMinStock(parseInt(e.target.value, 10) || 0)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsProductModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Product</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

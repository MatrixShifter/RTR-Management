import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Search, 
  Store 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import type { ProductCategory } from '@crimpston/shared';
import { 
  getProducts, 
  saveProduct, 
  deleteProduct,
  getShops,
  type Product,
  type Shop 
} from '../../services/db.js';

const CATEGORIES: ProductCategory[] = [
  'Mobile Cases',
  'Tempered Glass',
  'Chargers & Adapters',
  'USB Cables',
  'Earphones & Audio',
  'Other Accessories'
];

export const CatalogManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Add/Edit Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Mobile Cases');
  const [prodMinStock, setProdMinStock] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedProducts, loadedShops] = await Promise.all([
        getProducts(),
        getShops()
      ]);
      setProducts(loadedProducts);
      setShops(loadedShops);
    } catch (err) {
      console.error('Failed to load product catalog data:', err);
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

  const openAddModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdCategory('Mobile Cases');
    setProdMinStock(10);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCategory((p.category as ProductCategory) || 'Mobile Cases');
    setProdMinStock(p.minStock ?? 10);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodSku.trim()) return;

    setIsSaving(true);
    try {
      await saveProduct({
        id: editingProduct?.id,
        name: prodName.trim(),
        sku: prodSku.trim().toUpperCase(),
        category: prodCategory,
        minStock: Number(prodMinStock) || 5,
        isActive: true
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save product:', err);
      alert('Error saving product to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from the catalog?`)) {
      try {
        await deleteProduct(id);
        await loadData();
      } catch (err) {
        console.error('Failed to delete product:', err);
      }
    }
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
            <Badge variant="neutral" size="sm">
              {products.length} SKUs
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Master SKU catalog, product categories, and reorder threshold levels across all partner shops.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link to="/shops">
            <Button variant="outline" size="sm">
              <Store className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Shop Workspace ({shops.length})</span>
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={openAddModal}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Add New Product</span>
          </Button>
        </div>
      </div>

      {/* KPI / Metric Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Total SKUs</span>
          <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">{products.length}</span>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Categories</span>
          <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">{Object.keys(categoryCounts).length}</span>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Active Products</span>
          <span className="text-lg font-bold font-mono text-emerald-600 tabular-nums">
            {products.filter(p => p.isActive).length}
          </span>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Partner Shops</span>
          <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">{shops.length}</span>
        </div>
      </div>

      {/* Filter and Category Ribbon */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-3">
        {/* Search & Category Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800 tabular-nums">{filteredProducts.length}</strong> of {products.length} items
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories ({products.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md font-medium text-xs whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Product Table */}
      <Card title={`Wholesale Product Catalog (${filteredProducts.length})`}>
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading catalog from database...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No matching products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || selectedCategory !== 'all'
                ? 'No items match your active search or category filters. Try clearing them.'
                : 'Get started by creating your wholesale accessories catalog items.'}
            </p>
            {searchQuery || selectedCategory !== 'all' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={openAddModal}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add First Product
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Min Threshold</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 tabular-nums">
                      {prod.sku}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {prod.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums">
                      {prod.minStock ?? 5} pcs
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={prod.isActive ? 'success' : 'neutral'} size="sm">
                        {prod.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditModal(prod)}
                          className="text-slate-600 hover:text-slate-900 px-2 py-1 h-auto text-xs"
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="text-slate-400 hover:text-rose-600 px-2 py-1 h-auto text-xs"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Product Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? "Edit Catalog Product" : "Add New Catalog Product"}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input
            label="Product Name"
            placeholder="e.g. 65W GaN Fast Charger"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU Code"
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
              className="w-full text-xs p-2.5 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
              {editingProduct ? "Update Product" : "Save Product"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

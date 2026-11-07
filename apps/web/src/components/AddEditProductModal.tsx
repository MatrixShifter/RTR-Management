import React, { useState, useEffect } from 'react';
import { X, Package, Loader2, AlertCircle, Check } from 'lucide-react';
import { type Product, saveProduct } from '../services/db.js';
import { type ProductCategory } from '@crimpston/shared';

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Mobile Cases',
  'Tempered Glass',
  'Chargers & Adapters',
  'USB Cables',
  'Earphones & Audio',
  'Holders & Mounts',
  'Power Banks',
  'Other Accessories'
];

export interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialName?: string;
  onSaveSuccess: (savedProduct: Product) => void;
  existingProducts?: Product[];
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit = null,
  initialName = '',
  onSaveSuccess,
  existingProducts = []
}) => {
  const isEditing = Boolean(productToEdit);

  const [name, setName] = useState(productToEdit?.name || initialName || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [category, setCategory] = useState<ProductCategory>((productToEdit?.category as ProductCategory) || 'Other Accessories');
  const [unitPrice, setUnitPrice] = useState<number | ''>(productToEdit?.unitPrice !== undefined ? productToEdit.unitPrice : '');
  const [costPrice, setCostPrice] = useState<number | ''>(productToEdit?.costPrice !== undefined && productToEdit.costPrice !== null ? productToEdit.costPrice : '');
  const [minStock, setMinStock] = useState<number>(productToEdit?.minStock ?? 5);
  const [isActive, setIsActive] = useState(productToEdit ? productToEdit.isActive !== false : true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form fields
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (productToEdit) {
        setName(productToEdit.name || '');
        setSku(productToEdit.sku || '');
        setCategory((productToEdit.category as ProductCategory) || 'Other Accessories');
        setUnitPrice(productToEdit.unitPrice !== undefined ? productToEdit.unitPrice : '');
        setCostPrice(productToEdit.costPrice !== undefined && productToEdit.costPrice !== null ? productToEdit.costPrice : '');
        setMinStock(productToEdit.minStock ?? 5);
        setIsActive(productToEdit.isActive !== false);
      } else {
        setName(initialName || '');
        const rawSku = initialName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
        setSku(rawSku ? `SKU-${rawSku}` : '');
        setCategory('Other Accessories');
        setUnitPrice('');
        setCostPrice('');
        setMinStock(5);
        setIsActive(true);
      }
    }
  }, [isOpen, productToEdit, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }

    // Check for duplicate product name (case-insensitive) against other products
    const duplicateName = existingProducts.find(
      p => p.id !== productToEdit?.id && p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      setError(`A product with the name "${duplicateName.name}" already exists.`);
      return;
    }

    // Auto-generate SKU if blank
    const rawSku = trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'ACC';
    const finalSku = (sku.trim() || `SKU-${rawSku}-${Date.now().toString().slice(-4)}`).toUpperCase();

    // Check for duplicate SKU
    const duplicateSku = existingProducts.find(
      p => p.id !== productToEdit?.id && p.sku?.trim().toUpperCase() === finalSku
    );
    if (duplicateSku) {
      setError(`Product SKU "${finalSku}" is already in use by "${duplicateSku.name}".`);
      return;
    }

    const priceNum = unitPrice === '' ? 0 : Number(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Selling price must be a valid non-negative number.');
      return;
    }

    const costNum = costPrice === '' ? null : Number(costPrice);
    if (costNum !== null && (isNaN(costNum) || costNum < 0)) {
      setError('Cost price must be a valid non-negative number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await saveProduct({
        id: productToEdit?.id,
        name: trimmedName,
        sku: finalSku,
        category,
        unitPrice: priceNum,
        costPrice: costNum,
        minStock: Number(minStock) || 0,
        isActive
      });

      // Dispatch real-time sync event across application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr_data_sync'));
      }

      onSaveSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setError(err?.message || 'Failed to save product. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-edit-product-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#168BFF] rounded-xl border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 id="add-edit-product-title" className="text-sm sm:text-base font-bold text-slate-900">
                {isEditing ? 'Edit Product Details' : 'Add New Product'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update catalog pricing and SKU specifications' : 'Register a new item without leaving Add Record'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="flex-1 leading-snug">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Product Name */}
          <div className="space-y-1">
            <label htmlFor="prod-modal-name" className="block text-xs font-semibold text-slate-700">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="prod-modal-name"
              type="text"
              required
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError(null);
                if (!isEditing && !sku) {
                  const raw = e.target.value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                  if (raw) setSku(`SKU-${raw}`);
                }
              }}
              placeholder="e.g. iPhone 15 Pro Max Silicone Case"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
            />
          </div>

          {/* SKU & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="prod-modal-sku" className="block text-xs font-semibold text-slate-700">
                SKU Code
              </label>
              <input
                id="prod-modal-sku"
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value.toUpperCase())}
                placeholder="Auto-suggested"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent font-mono transition-all uppercase"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="prod-modal-category" className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                id="prod-modal-category"
                value={category}
                onChange={e => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all cursor-pointer"
              >
                {PRODUCT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Grid (Selling Price & Cost Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="prod-modal-price" className="block text-xs font-semibold text-slate-700">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                id="prod-modal-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={unitPrice}
                onChange={e => {
                  const val = e.target.value;
                  setUnitPrice(val === '' ? '' : parseFloat(val));
                }}
                placeholder="e.g. 250"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="prod-modal-cost" className="block text-xs font-semibold text-slate-700">
                Cost Price (₹) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="prod-modal-cost"
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={e => {
                  const val = e.target.value;
                  setCostPrice(val === '' ? '' : parseFloat(val));
                }}
                placeholder="e.g. 180"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Min Stock Alert */}
          <div className="space-y-1">
            <label htmlFor="prod-modal-minstock" className="block text-xs font-semibold text-slate-700">
              Low Stock Alert Threshold
            </label>
            <input
              id="prod-modal-minstock"
              type="number"
              min="0"
              value={minStock}
              onChange={e => setMinStock(parseInt(e.target.value, 10) || 0)}
              placeholder="e.g. 5"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
            />
          </div>

          {/* Active Status Toggle (Edit mode) */}
          {isEditing && (
            <div className="pt-1 flex items-center justify-between border-t border-slate-100">
              <div>
                <label className="text-xs font-semibold text-slate-800 block">Product Status</label>
                <span className="text-[11px] text-slate-500">
                  {isActive ? 'Active — Available in catalog' : 'Archived — Hidden from new selections'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isActive ? 'bg-[#168BFF]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#168BFF] hover:bg-[#0876E8] active:bg-[#0663C4] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Save Changes' : 'Create & Select Product'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

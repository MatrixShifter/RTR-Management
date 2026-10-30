import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Save, 
  Calendar, 
  ChevronDown, 
  Check, 
  Plus, 
  Settings, 
  AlertCircle, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';
import { 
  type Shop, 
  type Product, 
  type BusinessRecord,
  saveBusinessRecord,
  updateBusinessRecord,
  getShops,
  getProducts,
  deleteShop,
  deleteProduct,
  isDatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE
} from '../services/db.js';
import { ManageCatalogModal } from './ManageCatalogModal.js';

export interface RecordEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedRecord: BusinessRecord) => void;
  shops: Shop[];
  products: Product[];
  editingRecord?: BusinessRecord | null;
  className?: string;
  onRefreshCatalog?: () => Promise<void> | void;
}

export const RecordEntryDrawer: React.FC<RecordEntryDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shops = [],
  products = [],
  editingRecord = null,
  className = '',
  onRefreshCatalog
}) => {
  const todayStr = new Date().toISOString().split('T')[0] || '';

  // Local synced lists for immediate catalog refresh
  const [localShops, setLocalShops] = useState<Shop[]>(shops);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [isManageShopsOpen, setIsManageShopsOpen] = useState<boolean>(false);
  const [isManageProductsOpen, setIsManageProductsOpen] = useState<boolean>(false);

  // Custom dropdown open states and container refs
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState<boolean>(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);
  const shopDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalShops(shops);
  }, [shops]);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Form State: strictly Date, Shop, Product, Unit Price
  const [date, setDate] = useState<string>(editingRecord?.date || todayStr);

  // Shop selection or inline creation
  const [selectedShopId, setSelectedShopId] = useState<string>(editingRecord?.shopId || '');
  const [isNewShop, setIsNewShop] = useState<boolean>(!editingRecord?.shopId && shops.length === 0);
  const [customShopName, setCustomShopName] = useState<string>(editingRecord?.shopName || '');

  // Product selection or inline creation
  const [selectedProductId, setSelectedProductId] = useState<string>(editingRecord?.productId || '');
  const [isNewProduct, setIsNewProduct] = useState<boolean>(!editingRecord?.productId && products.length === 0);
  const [customProductName, setCustomProductName] = useState<string>(editingRecord?.productName || '');

  // Unit Price (₹)
  const [unitPrice, setUnitPrice] = useState<number | ''>(editingRecord?.unitPrice ?? '');

  // Customer Price (CP) (₹)
  const [customerPrice, setCustomerPrice] = useState<number | ''>(editingRecord?.customerPrice !== undefined && editingRecord?.customerPrice !== null ? editingRecord.customerPrice : '');

  // UI / Error state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<{ title: string; message: string } | null>(null);

  // Filter active shops & products (hide archived ones from dropdown unless editing record that used them)
  const activeShops = useMemo(() => {
    return localShops.filter(s => s.isActive !== false || s.id === selectedShopId);
  }, [localShops, selectedShopId]);

  const activeProducts = useMemo(() => {
    return localProducts.filter(p => p.isActive !== false || p.id === selectedProductId);
  }, [localProducts, selectedProductId]);

  // Find currently selected entities for trigger labels
  const selectedShop = useMemo(() => {
    return localShops.find(s => s.id === selectedShopId);
  }, [localShops, selectedShopId]);

  const selectedProduct = useMemo(() => {
    return localProducts.find(p => p.id === selectedProductId);
  }, [localProducts, selectedProductId]);

  // Reset form to pristine defaults
  const resetForm = () => {
    setDate(todayStr);
    setSelectedShopId('');
    setIsNewShop(shops.length === 0);
    setCustomShopName('');

    setSelectedProductId('');
    setIsNewProduct(products.length === 0);
    setCustomProductName('');

    setUnitPrice('');
    setCustomerPrice('');
    setValidationErrors({});
    setSubmitError(null);
    setCapacityError(null);
    setIsShopDropdownOpen(false);
    setIsProductDropdownOpen(false);
  };

  // Hydrate form on load or editingRecord change
  useEffect(() => {
    setSubmitError(null);
    setCapacityError(null);
    setValidationErrors({});

    if (editingRecord) {
      setDate(editingRecord.date || todayStr);
      setSelectedShopId(editingRecord.shopId || '');
      setIsNewShop(!editingRecord.shopId);
      setCustomShopName(editingRecord.shopName || '');

      setSelectedProductId(editingRecord.productId || '');
      setIsNewProduct(!editingRecord.productId);
      setCustomProductName(editingRecord.productName || '');

      setUnitPrice(editingRecord.unitPrice ?? 0);
      setCustomerPrice(editingRecord.customerPrice !== undefined && editingRecord.customerPrice !== null ? editingRecord.customerPrice : '');
    } else {
      resetForm();
    }
  }, [editingRecord, shops.length, products.length, todayStr]);

  // Close dropdowns on outside click or touch
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(target)) {
        setIsShopDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setIsProductDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Check if user has entered unsaved data
  const isFormDirty = (): boolean => {
    if (editingRecord) {
      return (
        date !== (editingRecord.date || todayStr) ||
        (selectedShopId || customShopName) !== (editingRecord.shopId || editingRecord.shopName || '') ||
        (selectedProductId || customProductName) !== (editingRecord.productId || editingRecord.productName || '') ||
        String(unitPrice) !== String(editingRecord.unitPrice ?? '') ||
        String(customerPrice) !== String(editingRecord.customerPrice ?? '')
      );
    }
    return Boolean(
      customShopName.trim() ||
      selectedShopId ||
      customProductName.trim() ||
      selectedProductId ||
      unitPrice !== '' ||
      customerPrice !== ''
    );
  };

  // Safe close handler that warns on unsaved changes
  const handleAttemptClose = () => {
    if (isSubmitting) return;
    if (isFormDirty()) {
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmDiscard) return;
    }
    resetForm();
    onClose();
  };

  // Lock body scroll and listen for ESC while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isShopDropdownOpen) {
          setIsShopDropdownOpen(false);
          return;
        }
        if (isProductDropdownOpen) {
          setIsProductDropdownOpen(false);
          return;
        }
        handleAttemptClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, isShopDropdownOpen, isProductDropdownOpen, customShopName, selectedShopId, customProductName, selectedProductId, unitPrice]);

  // Handle product selection & unit price autofill
  const handleProductChange = (prodId: string) => {
    setIsProductDropdownOpen(false);
    if (prodId === '__manage__') {
      setIsManageProductsOpen(true);
      return;
    }
    if (prodId === '__new__') {
      setIsNewProduct(true);
      setSelectedProductId('');
    } else {
      setIsNewProduct(false);
      setSelectedProductId(prodId);
      const prod = localProducts.find(p => p.id === prodId);
      if (prod && prod.unitPrice !== undefined && prod.unitPrice > 0) {
        setUnitPrice(prod.unitPrice);
      }
    }
  };

  // Handle shop selection
  const handleShopChange = (sId: string) => {
    setIsShopDropdownOpen(false);
    if (sId === '__manage__') {
      setIsManageShopsOpen(true);
      return;
    }
    if (sId === '__new__') {
      setIsNewShop(true);
      setSelectedShopId('');
    } else {
      setIsNewShop(false);
      setSelectedShopId(sId);
    }
  };

  const handleUnitPriceChange = (valStr: string) => {
    if (valStr === '') {
      setUnitPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setUnitPrice(isNaN(val) ? '' : Math.max(0, val));
  };

  const handleCustomerPriceChange = (valStr: string) => {
    if (valStr === '') {
      setCustomerPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCustomerPrice(isNaN(val) ? '' : Math.max(0, val));
  };

  const currentAmount = useMemo(() => {
    const rate = Number(unitPrice) || 0;
    const qty = editingRecord?.quantity && editingRecord.quantity > 0 ? editingRecord.quantity : 1;
    return qty * rate;
  }, [unitPrice, editingRecord?.quantity]);

  const liveProfit = useMemo(() => {
    if (customerPrice === '' || unitPrice === '') return null;
    const cp = Number(customerPrice) || 0;
    return Math.round((cp - currentAmount) * 100) / 100;
  }, [customerPrice, currentAmount, unitPrice]);

  // Validation strictly for Date, Shop Name, Product, Unit Price
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.date = 'A valid date (YYYY-MM-DD) is required.';
    }

    if (isNewShop) {
      if (!customShopName.trim()) {
        errors.shop = 'Please enter a shop name.';
      }
    } else {
      if (!selectedShopId) {
        errors.shop = 'Please select a retail shop or register a new one.';
      }
    }

    if (isNewProduct) {
      if (!customProductName.trim()) {
        errors.product = 'Please enter a product name.';
      }
    } else {
      if (!selectedProductId) {
        errors.product = 'Please select a product or enter a new one.';
      }
    }

    if (unitPrice === '' || Number(unitPrice) < 0 || isNaN(Number(unitPrice))) {
      errors.unitPrice = 'Unit price must be 0 or greater.';
    }

    if (customerPrice !== '' && (Number(customerPrice) < 0 || isNaN(Number(customerPrice)))) {
      errors.customerPrice = 'Customer price cannot be negative.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    setCapacityError(null);
    if (!validate()) return;

    const chosenShop = isNewShop ? undefined : localShops.find(s => s.id === selectedShopId);
    const shopName = chosenShop ? chosenShop.name : customShopName.trim();

    const chosenProduct = isNewProduct ? undefined : localProducts.find(p => p.id === selectedProductId);
    const productName = chosenProduct ? chosenProduct.name : customProductName.trim();

    const rate = Number(unitPrice) || 0;
    const cpVal = customerPrice === '' ? null : Number(customerPrice);
    // Single ledger item record: 1 unit where total amount = unit price
    const qty = editingRecord?.quantity && editingRecord.quantity > 0 ? editingRecord.quantity : 1;
    const total = qty * rate;

    // Delivery workflow: initial state for new dispatches is pending (unchecked)
    const status = editingRecord?.deliveryStatus || 'pending';

    // Financial balance: pending amount reflects the total billed value of the item
    const pending = editingRecord !== null && editingRecord !== undefined && editingRecord.pendingAmount !== undefined 
      ? Math.min(total, editingRecord.pendingAmount) 
      : total;
    const paid = Math.max(0, total - pending);
    const memo = editingRecord?.notes || '';

    setIsSubmitting(true);
    try {
      if (editingRecord && editingRecord.deliveryId) {
        const updated = await updateBusinessRecord({
          deliveryId: editingRecord.deliveryId,
          date,
          shopId: chosenShop?.id,
          shopName,
          productId: chosenProduct?.id,
          productName,
          quantity: qty,
          unitPrice: rate,
          customerPrice: cpVal,
          deliveryStatus: status,
          pendingAmount: pending,
          notes: memo
        });
        onSuccess(updated);
        resetForm();
      } else {
        const saved = await saveBusinessRecord({
          date,
          shopId: chosenShop?.id,
          shopName,
          productId: chosenProduct?.id,
          productName,
          quantity: qty,
          unitPrice: rate,
          customerPrice: cpVal,
          deliveryStatus: status,
          pendingAmount: pending,
          paidAmount: paid,
          notes: memo
        });
        onSuccess(saved);
        resetForm();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to save manual record:', err);
      if (isDatabaseCapacityError(err)) {
        setCapacityError({
          title: DATABASE_STORAGE_FULL_TITLE,
          message: DATABASE_STORAGE_FULL_MESSAGE
        });
        setSubmitError(null);
      } else {
        setCapacityError(null);
        setSubmitError(err?.message || 'Failed to save record. Please check your connection and values.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in ${className}`} 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="record-modal-title"
      onClick={handleAttemptClose}
    >
      {/* Centered Modal Card: Constrained width, mobile-safe dynamic height, no unnecessary blank space */}
      <div 
        className="relative w-full max-w-md sm:max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] my-auto transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* 1. FIXED HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white flex-shrink-0 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <div className="min-w-0 pr-2">
            <h2 id="record-modal-title" className="text-base sm:text-lg font-bold text-[#102A4C] tracking-tight truncate">
              {editingRecord ? 'Edit Record' : 'Add Record'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {editingRecord ? 'Update wholesale record details' : 'Enter wholesale delivery for a partner shop'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. SCROLLABLE FORM BODY */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 min-h-0 overscroll-contain">
          <form id="record-entry-form" onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 pb-2">
            {/* Database Storage Capacity Alert */}
            {capacityError && (
              <div 
                role="alert"
                aria-live="assertive"
                className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 shadow-xs"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-amber-900 leading-snug">
                      {capacityError.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                      {capacityError.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                        <span>{isSubmitting ? 'Retrying...' : 'Retry Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapacityError(null)}
                        disabled={isSubmitting}
                        className="px-2 py-1 text-xs font-medium text-amber-800 hover:text-amber-950 hover:bg-amber-100/70 rounded-lg transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Submission Error */}
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* 1. Date */}
            <div>
              <label htmlFor="record-date-input" className="block text-xs font-semibold text-slate-800 mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  id="record-date-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] transition-colors ${
                    validationErrors.date ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {validationErrors.date && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.date}</p>
              )}
            </div>

            {/* 2. Shop Name (Custom Responsive Dropdown + "+ New Shop" toggle + "Manage Shops") */}
            <div 
              ref={shopDropdownRef} 
              className={`relative ${isShopDropdownOpen ? 'z-30' : 'z-20'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <label id="shop-name-label" className="block text-xs font-semibold text-slate-800">
                    Shop Name
                  </label>
                  {localShops.length === 0 && (
                    <span className="text-[10px] text-slate-500 font-normal italic">
                      (New shop registration)
                    </span>
                  )}
                </div>
                {localShops.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManageShopsOpen(true)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      title="Manage and delete shops"
                    >
                      Manage Shops
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewShop;
                        setIsNewShop(nextState);
                        setIsShopDropdownOpen(false);
                        if (nextState) setSelectedShopId('');
                        else setCustomShopName('');
                      }}
                      className="text-[11px] text-[#168BFF] hover:text-[#0876E8] font-medium cursor-pointer"
                    >
                      {isNewShop ? "← Choose existing" : "+ New Shop"}
                    </button>
                  </div>
                )}
              </div>

              {!isNewShop && localShops.length > 0 ? (
                <div className="relative">
                  {/* Custom Accessible Trigger matching exact trigger width */}
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={isShopDropdownOpen}
                    aria-haspopup="listbox"
                    aria-labelledby="shop-name-label"
                    onClick={() => {
                      setIsProductDropdownOpen(false);
                      setIsShopDropdownOpen(prev => !prev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setIsProductDropdownOpen(false);
                        setIsShopDropdownOpen(prev => !prev);
                      }
                    }}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm text-left bg-white flex items-center justify-between transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                      validationErrors.shop ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`truncate mr-2 ${selectedShop ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                      {selectedShop ? selectedShop.name : 'Select a retail shop...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                      isShopDropdownOpen ? 'rotate-180 text-[#168BFF]' : ''
                    }`} />
                  </button>

                  {/* Hidden Synchronized Native Select for test compatibility & form accessibility */}
                  <select
                    value={selectedShopId}
                    onChange={e => handleShopChange(e.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="">Select a retail shop...</option>
                    {activeShops.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="__new__">+ Register New Shop...</option>
                    <option value="__manage__">⚙ Manage Shops...</option>
                  </select>

                  {/* Custom Constrained Dropdown Menu: exactly matches trigger width, max 220px height, scrollable */}
                  {isShopDropdownOpen && (
                    <div 
                      role="listbox"
                      aria-labelledby="shop-name-label"
                      className="absolute left-0 right-0 top-full mt-1.5 z-40 w-full max-w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden py-1 animate-fade-in"
                    >
                      <div className="max-h-[220px] sm:max-h-[240px] overflow-y-auto overscroll-contain divide-y divide-slate-50">
                        {/* Empty/default unselect option */}
                        <button
                          type="button"
                          role="option"
                          aria-selected={!selectedShopId}
                          onClick={() => {
                            handleShopChange('');
                            setIsShopDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                            !selectedShopId ? 'bg-slate-50 text-slate-500 font-medium' : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <span>Select a retail shop...</span>
                          {!selectedShopId && <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-2" />}
                        </button>

                        {/* Active Shop Options */}
                        {activeShops.map(s => {
                          const isSelected = s.id === selectedShopId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                handleShopChange(s.id);
                                setIsShopDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' 
                                  : 'text-slate-700 hover:bg-[#F4F9FF] hover:text-[#168BFF]'
                              }`}
                            >
                              <span className="truncate">{s.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#168BFF] flex-shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Dropdown Action Controls */}
                      <div className="border-t border-slate-100 pt-1 mt-1 bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => {
                            handleShopChange('__new__');
                            setIsShopDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm text-left font-medium text-[#168BFF] hover:bg-[#EAF4FF] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>+ Register New Shop...</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleShopChange('__manage__');
                            setIsShopDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm text-left font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          <span>⚙ Manage Shops...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={localShops.length === 0 ? "Enter shop name to register..." : "Enter shop name..."}
                  value={customShopName}
                  onChange={e => setCustomShopName(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                    validationErrors.shop ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
              )}
              {validationErrors.shop && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.shop}</p>
              )}
            </div>

            {/* 3. Product (Custom Responsive Dropdown + "+ New Product" toggle + "Manage Products") */}
            <div 
              ref={productDropdownRef} 
              className={`relative ${isProductDropdownOpen ? 'z-30' : 'z-10'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <label id="product-name-label" className="block text-xs font-semibold text-slate-800">
                    Product
                  </label>
                  {localProducts.length === 0 && (
                    <span className="text-[10px] text-slate-500 font-normal italic">
                      (New item registration)
                    </span>
                  )}
                </div>
                {localProducts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManageProductsOpen(true)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      title="Manage and delete products"
                    >
                      Manage Products
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewProduct;
                        setIsNewProduct(nextState);
                        setIsProductDropdownOpen(false);
                        if (nextState) setSelectedProductId('');
                        else setCustomProductName('');
                      }}
                      className="text-[11px] text-[#168BFF] hover:text-[#0876E8] font-medium cursor-pointer"
                    >
                      {isNewProduct ? "← Choose existing" : "+ New Product"}
                    </button>
                  </div>
                )}
              </div>

              {!isNewProduct && localProducts.length > 0 ? (
                <div className="relative">
                  {/* Custom Accessible Trigger matching exact trigger width */}
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={isProductDropdownOpen}
                    aria-haspopup="listbox"
                    aria-labelledby="product-name-label"
                    onClick={() => {
                      setIsShopDropdownOpen(false);
                      setIsProductDropdownOpen(prev => !prev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setIsShopDropdownOpen(false);
                        setIsProductDropdownOpen(prev => !prev);
                      }
                    }}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm text-left bg-white flex items-center justify-between transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                      validationErrors.product ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`truncate mr-2 ${selectedProduct ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                      {selectedProduct ? selectedProduct.name : 'Select a product...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                      isProductDropdownOpen ? 'rotate-180 text-[#168BFF]' : ''
                    }`} />
                  </button>

                  {/* Hidden Synchronized Native Select for test compatibility & form accessibility */}
                  <select
                    value={selectedProductId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="">Select a product...</option>
                    {activeProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="__new__">+ Enter New Product...</option>
                    <option value="__manage__">⚙ Manage Products...</option>
                  </select>

                  {/* Custom Constrained Dropdown Menu: exactly matches trigger width, max 220px height, scrollable */}
                  {isProductDropdownOpen && (
                    <div 
                      role="listbox"
                      aria-labelledby="product-name-label"
                      className="absolute left-0 right-0 top-full mt-1.5 z-40 w-full max-w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden py-1 animate-fade-in"
                    >
                      <div className="max-h-[220px] sm:max-h-[240px] overflow-y-auto overscroll-contain divide-y divide-slate-50">
                        {/* Empty/default unselect option */}
                        <button
                          type="button"
                          role="option"
                          aria-selected={!selectedProductId}
                          onClick={() => {
                            handleProductChange('');
                            setIsProductDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                            !selectedProductId ? 'bg-slate-50 text-slate-500 font-medium' : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <span>Select a product...</span>
                          {!selectedProductId && <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-2" />}
                        </button>

                        {/* Active Product Options */}
                        {activeProducts.map(p => {
                          const isSelected = p.id === selectedProductId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                handleProductChange(p.id);
                                setIsProductDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 text-xs sm:text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' 
                                  : 'text-slate-700 hover:bg-[#F4F9FF] hover:text-[#168BFF]'
                              }`}
                            >
                              <span className="truncate">{p.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#168BFF] flex-shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Dropdown Action Controls */}
                      <div className="border-t border-slate-100 pt-1 mt-1 bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => {
                            handleProductChange('__new__');
                            setIsProductDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm text-left font-medium text-[#168BFF] hover:bg-[#EAF4FF] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>+ Enter New Product...</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleProductChange('__manage__');
                            setIsProductDropdownOpen(false);
                          }}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm text-left font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          <span>⚙ Manage Products...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={localProducts.length === 0 ? "Enter product name (e.g. Tempered Glass 9D)..." : "Enter product name..."}
                  value={customProductName}
                  onChange={e => setCustomProductName(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                    validationErrors.product ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
              )}
              {validationErrors.product && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.product}</p>
              )}
            </div>

            {/* 4. Unit Price & Customer Price with Live Profit Calculation */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="record-unit-price-input" className="block text-xs font-semibold text-slate-800 mb-1">
                    Unit Price / Cost (₹)
                  </label>
                  <input
                    id="record-unit-price-input"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="e.g. 25.00"
                    value={unitPrice}
                    onChange={e => handleUnitPriceChange(e.target.value)}
                    required
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                      validationErrors.unitPrice ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.unitPrice && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.unitPrice}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="record-customer-price-input" className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                    <span>Customer Price (CP) (₹)</span>
                    <span className="text-[11px] font-normal text-slate-400">Total Selling</span>
                  </label>
                  <input
                    id="record-customer-price-input"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="e.g. 35.00"
                    value={customerPrice}
                    onChange={e => handleCustomerPriceChange(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] ${
                      validationErrors.customerPrice ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.customerPrice && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.customerPrice}</p>
                  )}
                </div>
              </div>

              {/* Live Profit / Loss Calculation Indicator */}
              {liveProfit !== null && (
                <div 
                  data-testid="live-profit-indicator"
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition-all ${
                    liveProfit >= 0 
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50/90 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {liveProfit >= 0 ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{liveProfit >= 0 ? 'Estimated Profit' : 'Loss Warning (Selling Below Cost)'}</span>
                  </div>
                  <div className="font-bold tracking-tight text-xs sm:text-sm">
                    {liveProfit >= 0 ? `+₹${liveProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(liveProfit).toLocaleString('en-IN')}`}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* 3. FIXED FOOTER: Cancel and Save Record fit on narrow screens */}
        <div className="flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 bg-slate-50/95 flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-entry-form"
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 sm:flex-initial bg-[#168BFF] hover:bg-[#0876E8] active:bg-[#065EC2] text-white font-semibold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-white" />
                <span>{editingRecord ? 'Update Record' : 'Save Record'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Manage Shops Dialog */}
      <ManageCatalogModal
        isOpen={isManageShopsOpen}
        onClose={() => setIsManageShopsOpen(false)}
        type="shops"
        items={localShops}
        selectedId={selectedShopId}
        onDelete={async (id) => {
          const res = await deleteShop(id);
          const updated = await getShops();
          setLocalShops(updated);
          if (onRefreshCatalog) onRefreshCatalog();
          return res;
        }}
        onItemsUpdated={async () => {
          const updated = await getShops();
          setLocalShops(updated);
          if (onRefreshCatalog) onRefreshCatalog();
        }}
      />

      {/* Manage Products Dialog */}
      <ManageCatalogModal
        isOpen={isManageProductsOpen}
        onClose={() => setIsManageProductsOpen(false)}
        type="products"
        items={localProducts}
        selectedId={selectedProductId}
        onDelete={async (id) => {
          const res = await deleteProduct(id);
          const updated = await getProducts();
          setLocalProducts(updated);
          if (onRefreshCatalog) onRefreshCatalog();
          return res;
        }}
        onItemsUpdated={async () => {
          const updated = await getProducts();
          setLocalProducts(updated);
          if (onRefreshCatalog) onRefreshCatalog();
        }}
      />
    </div>
  );
};

// Backwards-compatibility alias if imported anywhere
export const RecordEntryFormCard = RecordEntryDrawer;

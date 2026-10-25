import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, ChevronDown, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  type Shop, 
  type Product, 
  type BusinessRecord,
  saveBusinessRecord,
  updateBusinessRecord,
  isDatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE
} from '../services/db.js';

export interface RecordEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedRecord: BusinessRecord) => void;
  shops: Shop[];
  products: Product[];
  editingRecord?: BusinessRecord | null;
  className?: string;
}

export const RecordEntryDrawer: React.FC<RecordEntryDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shops = [],
  products = [],
  editingRecord = null,
  className = ''
}) => {
  const todayStr = new Date().toISOString().split('T')[0] || '';

  // Form State
  const [date, setDate] = useState<string>(todayStr);

  // Shop selection or inline creation
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [isNewShop, setIsNewShop] = useState<boolean>(shops.length === 0);
  const [customShopName, setCustomShopName] = useState<string>('');

  // Product selection or inline creation
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isNewProduct, setIsNewProduct] = useState<boolean>(products.length === 0);
  const [customProductName, setCustomProductName] = useState<string>('');

  // Core metrics
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [deliveryStatus, setDeliveryStatus] = useState<'delivered' | 'pending'>('delivered');

  // Payment Status & Accounting
  const [paymentMode, setPaymentMode] = useState<'unpaid' | 'paid' | 'custom'>('unpaid');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [pendingAmount, setPendingAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');

  // UI / Error state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<{ title: string; message: string } | null>(null);

  // Derived Total Billed Value
  const calculatedTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  // Reset form to pristine defaults
  const resetForm = () => {
    setDate(todayStr);
    setSelectedShopId('');
    setIsNewShop(shops.length === 0);
    setCustomShopName('');

    setSelectedProductId('');
    setIsNewProduct(products.length === 0);
    setCustomProductName('');

    setQuantity('');
    setUnitPrice('');
    setDeliveryStatus('delivered');
    setPaymentMode('unpaid');
    setAmountPaid('');
    setPendingAmount('');
    setNotes('');
    setValidationErrors({});
    setSubmitError(null);
    setCapacityError(null);
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

      setQuantity(editingRecord.quantity || 1);
      setUnitPrice(editingRecord.unitPrice ?? 0);
      setDeliveryStatus(editingRecord.deliveryStatus === 'pending' ? 'pending' : 'delivered');

      const total = (Number(editingRecord.quantity) || 0) * (Number(editingRecord.unitPrice) || 0);
      const pending = Number(editingRecord.pendingAmount) || 0;
      setPendingAmount(pending);
      setAmountPaid(Math.max(0, total - pending));
      setPaymentMode(pending === 0 ? 'paid' : (pending === total ? 'unpaid' : 'custom'));
      setNotes(editingRecord.notes || '');
    } else {
      resetForm();
    }
  }, [editingRecord, shops.length, products.length, todayStr]);

  // Check if user has entered unsaved data
  const isFormDirty = (): boolean => {
    if (editingRecord) {
      return (
        date !== (editingRecord.date || todayStr) ||
        (selectedShopId || customShopName) !== (editingRecord.shopId || editingRecord.shopName || '') ||
        (selectedProductId || customProductName) !== (editingRecord.productId || editingRecord.productName || '') ||
        String(quantity) !== String(editingRecord.quantity || '') ||
        String(unitPrice) !== String(editingRecord.unitPrice ?? '') ||
        deliveryStatus !== (editingRecord.deliveryStatus || 'delivered') ||
        String(pendingAmount) !== String(editingRecord.pendingAmount ?? '') ||
        notes !== (editingRecord.notes || '')
      );
    }
    return Boolean(
      customShopName.trim() ||
      selectedShopId ||
      customProductName.trim() ||
      selectedProductId ||
      quantity !== '' ||
      unitPrice !== '' ||
      amountPaid !== '' ||
      notes.trim()
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

  // Lock body scroll and listen for ESC while modal/drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleAttemptClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, customShopName, selectedShopId, customProductName, selectedProductId, quantity, unitPrice, amountPaid, notes]);

  // Handle product selection & unit price autofill
  const handleProductChange = (prodId: string) => {
    if (prodId === '__new__') {
      setIsNewProduct(true);
      setSelectedProductId('');
    } else {
      setIsNewProduct(false);
      setSelectedProductId(prodId);
      const prod = products.find(p => p.id === prodId);
      if (prod && prod.unitPrice !== undefined && prod.unitPrice > 0) {
        setUnitPrice(prod.unitPrice);
        if (quantity !== '') {
          const total = (Number(quantity) || 0) * prod.unitPrice;
          if (paymentMode === 'unpaid') setPendingAmount(total);
          else if (paymentMode === 'paid') setAmountPaid(total);
        }
      }
    }
  };

  // Handle shop selection
  const handleShopChange = (sId: string) => {
    if (sId === '__new__') {
      setIsNewShop(true);
      setSelectedShopId('');
    } else {
      setIsNewShop(false);
      setSelectedShopId(sId);
    }
  };

  // Keep payment amounts synchronized whenever quantity, unitPrice, or paymentMode changes
  useEffect(() => {
    if (paymentMode === 'unpaid') {
      setAmountPaid(0);
      setPendingAmount(calculatedTotal);
    } else if (paymentMode === 'paid') {
      setAmountPaid(calculatedTotal);
      setPendingAmount(0);
    } else if (paymentMode === 'custom') {
      if (amountPaid !== '') {
        const paid = Math.min(calculatedTotal, Math.max(0, Number(amountPaid) || 0));
        setPendingAmount(Math.max(0, calculatedTotal - paid));
      } else if (pendingAmount !== '') {
        const pend = Math.min(calculatedTotal, Math.max(0, Number(pendingAmount) || 0));
        setAmountPaid(Math.max(0, calculatedTotal - pend));
      }
    }
  }, [quantity, unitPrice, paymentMode, calculatedTotal]);

  // Keep payment information synchronized when quantity/price change
  const handleQuantityChange = (valStr: string) => {
    if (valStr === '') {
      setQuantity('');
      return;
    }
    const val = parseInt(valStr, 10);
    setQuantity(isNaN(val) ? '' : Math.max(1, val));
  };

  const handleUnitPriceChange = (valStr: string) => {
    if (valStr === '') {
      setUnitPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setUnitPrice(isNaN(val) ? '' : Math.max(0, val));
  };

  // Payment quick selection
  const handleSetPaymentMode = (mode: 'unpaid' | 'paid' | 'custom') => {
    setPaymentMode(mode);
    if (mode === 'unpaid') {
      setPendingAmount(calculatedTotal);
      setAmountPaid(0);
    } else if (mode === 'paid') {
      setPendingAmount(0);
      setAmountPaid(calculatedTotal);
    }
  };

  const handleAmountPaidChange = (valStr: string) => {
    setPaymentMode('custom');
    if (valStr === '') {
      setAmountPaid('');
      setPendingAmount(calculatedTotal);
      return;
    }
    const paid = Math.max(0, parseFloat(valStr) || 0);
    setAmountPaid(paid);
    setPendingAmount(Math.max(0, calculatedTotal - paid));
  };

  const handlePendingAmountChange = (valStr: string) => {
    setPaymentMode('custom');
    if (valStr === '') {
      setPendingAmount('');
      setAmountPaid(calculatedTotal);
      return;
    }
    const pending = Math.max(0, parseFloat(valStr) || 0);
    setPendingAmount(pending);
    setAmountPaid(Math.max(0, calculatedTotal - pending));
  };

  // Comprehensive validation
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

    if (quantity === '' || Number(quantity) <= 0 || !Number.isInteger(Number(quantity))) {
      errors.quantity = 'Quantity must be a positive whole number (e.g. 10).';
    }

    if (unitPrice === '' || Number(unitPrice) < 0 || isNaN(Number(unitPrice))) {
      errors.unitPrice = 'Unit price must be 0 or greater.';
    }

    const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
    const pendingNum = pendingAmount === '' ? (paymentMode === 'paid' ? 0 : total) : Number(pendingAmount);

    if (pendingNum < 0 || isNaN(pendingNum)) {
      errors.pendingAmount = 'Pending amount cannot be negative.';
    } else if (total > 0 && pendingNum > total) {
      errors.pendingAmount = `Pending amount (₹${pendingNum}) cannot exceed total billed value (₹${total}).`;
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

    const chosenShop = isNewShop ? undefined : shops.find(s => s.id === selectedShopId);
    const shopName = chosenShop ? chosenShop.name : customShopName.trim();

    const chosenProduct = isNewProduct ? undefined : products.find(p => p.id === selectedProductId);
    const productName = chosenProduct ? chosenProduct.name : customProductName.trim();

    const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
    let finalPaid = 0;
    let finalPending = total;

    if (paymentMode === 'paid') {
      finalPaid = total;
      finalPending = 0;
    } else if (paymentMode === 'custom') {
      finalPaid = Math.min(total, Math.max(0, Number(amountPaid) || 0));
      finalPending = Math.max(0, total - finalPaid);
    } else {
      // unpaid default: full amount pending
      finalPaid = 0;
      finalPending = total;
    }

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
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          deliveryStatus,
          pendingAmount: finalPending,
          notes: notes.trim()
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
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          deliveryStatus,
          pendingAmount: finalPending,
          paidAmount: finalPaid,
          notes: notes.trim()
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
    <div className={`fixed inset-0 z-50 overflow-hidden ${className}`} role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
      {/* Dimmed backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={handleAttemptClose}
        aria-hidden="true"
      />

      {/* Drawer Container: Sliding in from right */}
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full transform transition-transform duration-200 ease-out">
          
          {/* 1. FIXED HEADER */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white flex-shrink-0 pt-[max(0.875rem,env(safe-area-inset-top))]">
            <div className="min-w-0 pr-2">
              <h2 id="record-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {editingRecord ? 'Edit Record' : 'Add Record'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {editingRecord ? 'Update delivery & payment details' : 'Enter wholesale delivery for a partner shop'}
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <form id="record-entry-form" onSubmit={handleSubmit} className="space-y-4">
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
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      validationErrors.date ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {validationErrors.date && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.date}</p>
                )}
              </div>

              {/* 2. Shop Selection / Registration */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Shop Name
                    </label>
                    {shops.length === 0 && (
                      <span className="text-[10px] text-slate-500 font-normal italic">
                        (New shop registration)
                      </span>
                    )}
                  </div>
                  {shops.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewShop;
                        setIsNewShop(nextState);
                        if (nextState) setSelectedShopId('');
                        else setCustomShopName('');
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      {isNewShop ? "← Choose existing" : "+ New Shop"}
                    </button>
                  )}
                </div>

                {!isNewShop && shops.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedShopId}
                      onChange={e => handleShopChange(e.target.value)}
                      className={`w-full appearance-none rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9 cursor-pointer ${
                        validationErrors.shop ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    >
                      <option value="">Select a retail shop...</option>
                      {shops.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="__new__">+ Register New Shop...</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={shops.length === 0 ? "Enter shop name to register..." : "Enter shop name..."}
                    value={customShopName}
                    onChange={e => setCustomShopName(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.shop ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                )}
                {validationErrors.shop && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.shop}</p>
                )}
              </div>

              {/* 3. Product Selection / Creation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Product
                    </label>
                    {products.length === 0 && (
                      <span className="text-[10px] text-slate-500 font-normal italic">
                        (New item registration)
                      </span>
                    )}
                  </div>
                  {products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isNewProduct;
                        setIsNewProduct(nextState);
                        if (nextState) setSelectedProductId('');
                        else setCustomProductName('');
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      {isNewProduct ? "← Choose existing" : "+ New Product"}
                    </button>
                  )}
                </div>

                {!isNewProduct && products.length > 0 ? (
                  <div className="relative">
                    <select
                      value={selectedProductId}
                      onChange={e => handleProductChange(e.target.value)}
                      className={`w-full appearance-none rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9 cursor-pointer ${
                        validationErrors.product ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    >
                      <option value="">Select a product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="__new__">+ Enter New Product...</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={products.length === 0 ? "Enter product name (e.g. Tempered Glass 9D)..." : "Enter product name..."}
                    value={customProductName}
                    onChange={e => setCustomProductName(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.product ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                )}
                {validationErrors.product && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.product}</p>
                )}
              </div>

              {/* 4 & 5. Quantity & Unit Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 50"
                    value={quantity}
                    onChange={e => handleQuantityChange(e.target.value)}
                    required
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.quantity ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.quantity && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.quantity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="e.g. 25.00"
                    value={unitPrice}
                    onChange={e => handleUnitPriceChange(e.target.value)}
                    required
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.unitPrice ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.unitPrice && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{validationErrors.unitPrice}</p>
                  )}
                </div>
              </div>

              {/* Total Billed Display */}
              <div className="px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Total Billed Value:</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900">
                  ₹{calculatedTotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* 6. Delivery Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Delivery Status
                </label>
                <div className="relative">
                  <select
                    value={deliveryStatus}
                    onChange={e => setDeliveryStatus(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9 cursor-pointer"
                  >
                    <option value="delivered">Delivered</option>
                    <option value="pending">Pending Delivery</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* 7. Payment Accounting: Paid vs Outstanding */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-800">
                    Payment Status &amp; Outstanding
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetPaymentMode('unpaid')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        paymentMode === 'unpaid'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPaymentMode('paid')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        paymentMode === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Fully Paid
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Amount Paid (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={paymentMode === 'unpaid' ? 0 : (paymentMode === 'paid' ? calculatedTotal : amountPaid)}
                      onChange={e => handleAmountPaidChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Pending Balance (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={paymentMode === 'unpaid' ? calculatedTotal : (paymentMode === 'paid' ? 0 : pendingAmount)}
                      onChange={e => handlePendingAmountChange(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        validationErrors.pendingAmount ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    />
                  </div>
                </div>
                {validationErrors.pendingAmount && (
                  <p className="text-xs text-rose-600 font-medium">{validationErrors.pendingAmount}</p>
                )}
              </div>

              {/* 8. Notes / Memo */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Notes / Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Batch restock / payment terms"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
          </div>

          {/* 3. FIXED FOOTER */}
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
              className="min-h-[44px] flex-1 sm:flex-initial bg-[#168BFF] hover:bg-[#0876E8] active:bg-[#065EC2] text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
      </div>
    </div>
  );
};

// Backwards-compatibility alias if imported anywhere
export const RecordEntryFormCard = RecordEntryDrawer;

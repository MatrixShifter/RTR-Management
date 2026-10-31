import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  AlertTriangle, 
  Store, 
  Package, 
  IndianRupee, 
  RefreshCw 
} from 'lucide-react';
import type { BusinessRecord } from '../services/db.js';
import { calculateRecordProfit } from '@crimpston/shared';

export interface ConfirmDeliveryModalProps {
  isOpen: boolean;
  record: BusinessRecord | null;
  onClose: () => void;
  onConfirm: (record: BusinessRecord, customerPrice: number) => Promise<void>;
  isSubmitting?: boolean;
}

export const ConfirmDeliveryModal: React.FC<ConfirmDeliveryModalProps> = ({
  isOpen,
  record,
  onClose,
  onConfirm,
  isSubmitting = false
}) => {
  const [customerPrice, setCustomerPrice] = useState<number | ''>(() => (
    record?.customerPrice !== undefined && record?.customerPrice !== null ? record.customerPrice : ''
  ));
  const [error, setError] = useState<string | null>(null);

  // Hydrate or reset when record changes
  useEffect(() => {
    if (record) {
      if (record.customerPrice !== undefined && record.customerPrice !== null) {
        setCustomerPrice(record.customerPrice);
      } else {
        setCustomerPrice('');
      }
      setError(null);
    }
  }, [record, isOpen]);

  // Lock scroll & ESC key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !record) return null;

  const totalCost = Number(record.totalAmount) || (Number(record.quantity || 1) * Number(record.unitPrice || 0));
  const qty = Number(record.quantity) || 1;

  // Real-time Profit Calculation: Profit = CP - Amount
  const liveProfit = useMemo(() => {
    if (customerPrice === '' || isNaN(Number(customerPrice))) return null;
    return calculateRecordProfit(totalCost, Number(customerPrice));
  }, [customerPrice, totalCost]);

  const handlePriceChange = (valStr: string) => {
    setError(null);
    if (valStr === '') {
      setCustomerPrice('');
      return;
    }
    const val = parseFloat(valStr);
    setCustomerPrice(isNaN(val) ? '' : Math.max(0, val));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (customerPrice === '' || isNaN(Number(customerPrice))) {
      setError('Please enter the Customer Price (CP).');
      return;
    }

    const numericCp = Number(customerPrice);
    if (numericCp < 0) {
      setError('Customer Price cannot be negative.');
      return;
    }

    try {
      setError(null);
      await onConfirm(record, numericCp);
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm delivery. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delivery-modal-title"
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#DCE4EC] overflow-hidden text-left flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#168BFF]/10 text-[#168BFF] flex items-center justify-center font-bold">
              <Check className="w-4 h-4 text-[#168BFF]" />
            </div>
            <div>
              <h2 id="confirm-delivery-modal-title" className="text-base sm:text-lg font-bold text-[#102A4C]">
                Confirm Delivery
              </h2>
              <p className="text-xs text-slate-500">Record customer price to complete delivery</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form id="confirm-delivery-form" onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Order Details Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <span>Retail Shop:</span>
              </span>
              <span className="font-bold text-[#102A4C] text-right truncate max-w-[200px]">
                {record.shopName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                <span>Product & Quantity:</span>
              </span>
              <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">
                {record.productName} ({qty} pcs)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-600 flex items-center gap-1.5 font-bold">
                <IndianRupee className="w-3.5 h-3.5 text-[#168BFF]" />
                <span>Wholesale Amount (Cost):</span>
              </span>
              <span className="font-extrabold text-[#102A4C] tabular-nums text-sm">
                ₹{totalCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Customer Price (CP) Input Field */}
          <div>
            <label htmlFor="delivery-customer-price-input" className="block text-xs font-bold text-slate-800 mb-1">
              Customer Price (CP) (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                ₹
              </div>
              <input
                id="delivery-customer-price-input"
                type="number"
                min={0}
                step="any"
                autoFocus
                placeholder="Enter total customer selling price..."
                value={customerPrice}
                onChange={e => handlePriceChange(e.target.value)}
                required
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Enter the TOTAL selling price charged to the customer for this order.
            </p>
          </div>

          {/* Real-time Profit Indicator */}
          {liveProfit !== null && (
            <div 
              data-testid="delivery-live-profit"
              className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition-all ${
                liveProfit > 0 
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' 
                  : liveProfit === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-rose-50/90 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {liveProfit > 0 ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                ) : liveProfit === 0 ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>
                  {liveProfit > 0 
                    ? 'Calculated Profit' 
                    : liveProfit === 0 
                      ? 'Break-even' 
                      : 'Loss Warning (Selling Below Cost)'}
                </span>
              </div>
              <div className="font-extrabold text-sm sm:text-base tabular-nums">
                {liveProfit > 0 ? `+₹${liveProfit.toLocaleString('en-IN')}` : liveProfit === 0 ? '₹0' : `-₹${Math.abs(liveProfit).toLocaleString('en-IN')}`}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 border-t border-[#E2E8F0] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="confirm-delivery-form"
            disabled={isSubmitting || customerPrice === ''}
            className="min-h-[42px] px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Confirm Delivery</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

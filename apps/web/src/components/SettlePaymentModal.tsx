import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Check, 
  AlertCircle, 
  Loader2,
  Wallet,
  Building2,
  QrCode
} from 'lucide-react';
import { 
  settleRecordPayment, 
  isDatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  type BusinessRecord 
} from '../services/db.js';

export interface SettlePaymentModalProps {
  isOpen?: boolean;
  onClose: () => void;
  record: BusinessRecord | null;
  onSuccess: (amountPaid: number, shopName: string) => void;
}

export const SettlePaymentModal: React.FC<SettlePaymentModalProps> = ({
  isOpen = true,
  onClose,
  record,
  onSuccess
}) => {
  const pendingAmt = record ? (Number(record.pendingAmount) || 0) : 0;
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'>('CASH');
  const [reference, setReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize amount with pending balance whenever record changes
  useEffect(() => {
    if (record) {
      const p = Number(record.pendingAmount) || 0;
      setAmount(p > 0 ? String(p) : '');
      setMethod('CASH');
      setReference('');
      setError(null);
    }
  }, [record]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !record) return null;

  const enteredVal = parseFloat(amount) || 0;
  const remainingAfterPayment = Math.max(0, pendingAmt - enteredVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isNaN(enteredVal) || enteredVal <= 0) {
      setError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (enteredVal > pendingAmt) {
      setError(`Payment cannot exceed the outstanding balance of ₹${pendingAmt.toLocaleString('en-IN')}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await settleRecordPayment(record.deliveryId || record.id, enteredVal);
      onSuccess(enteredVal, record.shopName);
      onClose();
    } catch (err: any) {
      if (isDatabaseCapacityError(err)) {
        setError(`${DATABASE_STORAGE_FULL_TITLE}: ${DATABASE_STORAGE_FULL_MESSAGE}`);
      } else {
        setError(err?.message || 'Failed to record payment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-payment-title"
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="min-w-0 pr-2">
            <h2 id="settle-payment-title" className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Record Payment</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px] sm:max-w-[340px]">
              {record.shopName} • {record.productName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs max-h-[calc(90vh-120px)] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {/* Balance Banner */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Outstanding Balance
              </span>
              <p className="text-lg font-extrabold text-amber-950 mt-0.5 tabular-nums">
                ₹{pendingAmt.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">After this payment:</span>
              <span className={`text-xs font-bold tabular-nums ${remainingAfterPayment === 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                ₹{remainingAfterPayment.toLocaleString('en-IN')} remaining
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="payment-amount" className="font-semibold text-slate-800">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAmount(String(pendingAmt))}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Pay Full (₹{pendingAmt.toLocaleString('en-IN')})
                </button>
                {pendingAmt > 1 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.round(pendingAmt / 2)))}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      50%
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none">
                ₹
              </span>
              <input
                id="payment-amount"
                type="number"
                step="any"
                min="1"
                max={pendingAmt}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                disabled={isSubmitting}
                className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs tabular-nums"
                autoFocus
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 block">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  method === 'CASH'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-1 ring-emerald-500/30'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('UPI')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  method === 'UPI'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-1 ring-emerald-500/30'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('BANK_TRANSFER')}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  method === 'BANK_TRANSFER'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-1 ring-emerald-500/30'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">Bank / NEFT</span>
              </button>
            </div>
          </div>

          {/* Reference / Note */}
          <div className="space-y-1.5">
            <label htmlFor="payment-ref" className="font-semibold text-slate-800 block">
              Reference / Transaction ID <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="payment-ref"
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. GPay ref, Cheque #, or Cash note"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || enteredVal <= 0}
              className="min-h-[44px] flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Confirm Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

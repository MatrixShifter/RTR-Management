import React, { useEffect } from 'react';
import { 
  X, 
  Store, 
  Package, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Edit2, 
  CreditCard,
  Coins
} from 'lucide-react';
import type { BusinessRecord } from '../services/db.js';

export interface RecordDetailsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  record: BusinessRecord | null;
  onEdit?: (record: BusinessRecord) => void;
  onSettlePayment?: (record: BusinessRecord) => void;
  onRecordPayment?: (record: BusinessRecord) => void;
}

export const RecordDetailsModal: React.FC<RecordDetailsModalProps> = ({
  isOpen = true,
  onClose,
  record,
  onEdit,
  onSettlePayment,
  onRecordPayment
}) => {
  const handleRecordPayment = onRecordPayment || onSettlePayment;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const isDelivered = record.deliveryStatus === 'delivered';
  const pendingAmt = Number(record.pendingAmount) || 0;
  const totalAmt = Number(record.totalAmount) || (Number(record.quantity) * Number(record.unitPrice));
  const paidAmt = Math.max(0, totalAmt - pendingAmt);

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const [y, m, d] = iso.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return iso;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-details-title"
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="record-details-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Record Details
              </h2>
              {isDelivered ? (
                <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/60 px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                  <span>Delivered</span>
                </span>
              ) : (
                <span className="bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]/60 px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#D97706]" />
                  <span>Pending Delivery</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Wholesale ledger delivery &amp; settlement overview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Shop & Date Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <span>Retail Shop</span>
              </span>
              <p className="mt-1 font-bold text-slate-900 text-sm">
                {record.shopName}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Delivery Date</span>
              </span>
              <p className="mt-1 font-medium text-slate-800 text-sm">
                {formatDate(record.date)}
              </p>
            </div>
          </div>

          {/* Product & Quantity Grid */}
          <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-2xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Product Line</span>
                </span>
                <p className="mt-1 font-bold text-slate-900 text-sm">
                  {record.productName}
                </p>
                {record.productSku && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    SKU: {record.productSku}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Quantity</span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5 tabular-nums">
                  {record.quantity} pcs
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Unit Price</span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5 tabular-nums">
                  ₹{Number(record.unitPrice || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-blue-50/60 p-2 rounded-lg">
                <span className="text-[10px] text-blue-600 font-semibold uppercase">Total Amount</span>
                <p className="text-sm font-extrabold text-blue-700 mt-0.5 tabular-nums">
                  ₹{totalAmt.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-2xs space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Payment &amp; Outstanding Balance</span>
            </span>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 font-medium">Amount Paid</span>
                <p className="text-base font-extrabold text-emerald-700 mt-0.5 tabular-nums">
                  ₹{paidAmt.toLocaleString('en-IN')}
                </p>
              </div>

              <div className={`p-3 rounded-lg ${pendingAmt > 0 ? 'bg-red-50/70' : 'bg-emerald-50/70'}`}>
                <span className={`text-[11px] font-medium ${pendingAmt > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  Outstanding Balance
                </span>
                <p className={`text-base font-extrabold mt-0.5 tabular-nums ${pendingAmt > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  ₹{pendingAmt.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Notes / Delivery Memo
              </span>
              <p className="mt-1 text-slate-700 leading-relaxed text-xs">
                {record.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-100 flex-wrap sm:flex-nowrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center flex-1 sm:flex-initial"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            {pendingAmt > 0 && handleRecordPayment && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  handleRecordPayment(record);
                }}
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer flex-1 sm:flex-initial"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="min-h-[44px] bg-[#168BFF] hover:bg-[#0876E8] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer flex-1 sm:flex-initial"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

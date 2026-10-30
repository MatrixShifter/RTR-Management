import React, { useEffect } from 'react';
import { 
  X, 
  Package,
  Layers, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  IndianRupee,
  Trash2 
} from 'lucide-react';
import type { BusinessRecord } from '../services/db.js';

export interface RecordDetailsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  record: BusinessRecord | null;
  onToggleDelivery?: (record: BusinessRecord) => void;
  onDelete?: (record: BusinessRecord) => void;
  // Preserved for backwards compatibility with existing caller interfaces
  onEdit?: (record: BusinessRecord) => void;
  onSettlePayment?: (record: BusinessRecord) => void;
  onRecordPayment?: (record: BusinessRecord) => void;
}

export const RecordDetailsModal: React.FC<RecordDetailsModalProps> = ({
  isOpen = true,
  onClose,
  record,
  onToggleDelivery,
  onDelete
}) => {
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
  const totalAmt = Number(record.totalAmount) || (Number(record.quantity || 1) * Number(record.unitPrice || 0));

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const parts = iso.slice(0, 10).split('-');
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return iso;
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
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#DCE4EC] overflow-hidden text-left flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 id="record-details-title" className="text-base sm:text-lg font-bold text-[#102A4C] truncate">
              Record Details
            </h2>
            {isDelivered ? (
              <span className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/70 px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                <span>Delivered</span>
              </span>
            ) : (
              <span className="bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]/70 px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Pending</span>
              </span>
            )}
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

        {/* Record Information: Exactly the 4 simplified workflow fields */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden bg-white shadow-2xs">
            {/* Field 1: Date */}
            <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC]">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#168BFF]" />
                <span>Date</span>
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#102A4C]">
                {formatDate(record.date)}
              </span>
            </div>

            {/* Field 2: Product */}
            <div className="flex items-start justify-between p-3.5 bg-white gap-3">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5 pt-0.5">
                <Package className="w-4 h-4 text-[#168BFF]" />
                <span>Product</span>
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#102A4C] text-right break-words max-w-[240px]">
                {record.productName || 'Accessory Item'}
              </span>
            </div>

            {/* Field 2b: Quantity */}
            <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC]">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#168BFF]" />
                <span>Quantity</span>
              </span>
              <span className={`text-xs sm:text-sm font-bold tabular-nums ${
                record.quantity !== undefined && record.quantity !== null && Number(record.quantity) > 0
                  ? 'text-[#102A4C]'
                  : 'text-slate-400 font-normal italic'
              }`}>
                {record.quantity !== undefined && record.quantity !== null && Number(record.quantity) > 0
                  ? `${record.quantity} pcs`
                  : 'Not Recorded'}
              </span>
            </div>

            {/* Field 3: Amount (₹) */}
            <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC]">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-[#168BFF]" />
                <span>Amount (₹)</span>
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#102A4C] tabular-nums">
                {`₹${totalAmt.toLocaleString('en-IN')}`}
              </span>
            </div>

            {/* Field 3b: Customer Price (CP) */}
            <div className="flex items-center justify-between p-3.5 bg-white">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-[#102A4C]" />
                <span>Customer Price (CP)</span>
              </span>
              <span className={`text-xs sm:text-sm font-bold tabular-nums ${
                record.customerPrice !== undefined && record.customerPrice !== null ? 'text-[#102A4C]' : 'text-slate-400 font-normal italic'
              }`}>
                {record.customerPrice !== undefined && record.customerPrice !== null
                  ? `₹${Number(record.customerPrice).toLocaleString('en-IN')}`
                  : 'Not Recorded'}
              </span>
            </div>

            {/* Field 3c: Calculated Profit */}
            <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC]">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span>Calculated Profit</span>
              </span>
              <span className={`text-xs sm:text-sm font-bold tabular-nums ${
                record.profit !== undefined && record.profit !== null
                  ? (record.profit >= 0 ? 'text-emerald-700' : 'text-rose-600')
                  : 'text-slate-400 font-normal italic'
              }`}>
                {record.profit !== undefined && record.profit !== null
                  ? (record.profit >= 0 ? `+₹${record.profit.toLocaleString('en-IN')}` : `-₹${Math.abs(record.profit).toLocaleString('en-IN')}`)
                  : 'Not Available'}
              </span>
            </div>

            {/* Field 4: Delivery */}
            <div className="flex items-center justify-between p-3.5 bg-white">
              <span className="text-xs font-semibold text-[#556982] flex items-center gap-1.5">
                {isDelivered ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                ) : (
                  <Clock className="w-4 h-4 text-[#D97706]" />
                )}
                <span>Delivery</span>
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isDelivered
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/70'
                    : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/70'
                }`}>
                  {isDelivered ? 'Delivered' : 'Pending'}
                </span>
                {onToggleDelivery && (
                  <button
                    type="button"
                    onClick={() => onToggleDelivery(record)}
                    className="text-xs font-medium text-[#168BFF] hover:underline cursor-pointer ml-1"
                  >
                    {isDelivered ? 'Mark Pending' : 'Mark Delivered'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-[#E2E8F0] flex-shrink-0">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(record);
              }}
              className="min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Record</span>
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#168BFF] hover:bg-[#0E7BE5] active:bg-[#0766C2] rounded-xl shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

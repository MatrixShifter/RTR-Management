import React, { useState, useEffect } from 'react';
import { X, Store, Loader2, AlertCircle, Check } from 'lucide-react';
import { type Shop, saveShop } from '../services/db.js';

export interface AddEditShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopToEdit?: Shop | null;
  initialName?: string;
  onSaveSuccess: (savedShop: Shop) => void;
  existingShops?: Shop[];
}

export const AddEditShopModal: React.FC<AddEditShopModalProps> = ({
  isOpen,
  onClose,
  shopToEdit = null,
  initialName = '',
  onSaveSuccess,
  existingShops = []
}) => {
  const isEditing = Boolean(shopToEdit);

  const [name, setName] = useState(shopToEdit?.name || initialName || '');
  const [code, setCode] = useState(shopToEdit?.code || '');
  const [phone, setPhone] = useState(shopToEdit?.phone || '');
  const [address, setAddress] = useState(shopToEdit?.address || '');
  const [isActive, setIsActive] = useState(shopToEdit ? shopToEdit.isActive !== false : true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form fields
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (shopToEdit) {
        setName(shopToEdit.name || '');
        setCode(shopToEdit.code || '');
        setPhone(shopToEdit.phone || '');
        setAddress(shopToEdit.address || '');
        setIsActive(shopToEdit.isActive !== false);
      } else {
        setName(initialName || '');
        // Auto-suggest shop code based on name if provided
        const rawCode = initialName.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
        setCode(rawCode ? `RTR-${rawCode}` : '');
        setPhone('');
        setAddress('');
        setIsActive(true);
      }
    }
  }, [isOpen, shopToEdit, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Shop name is required.');
      return;
    }

    // Check for duplicate shop name (case-insensitive) against existing active shops
    const duplicateName = existingShops.find(
      s => s.id !== shopToEdit?.id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateName) {
      setError(`A shop with the name "${duplicateName.name}" already exists.`);
      return;
    }

    // Suggest code if empty
    const rawCode = trimmedName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SHOP';
    const finalCode = (code.trim() || `RTR-${rawCode}-${Date.now().toString().slice(-4)}`).toUpperCase();

    // Check for duplicate code
    const duplicateCode = existingShops.find(
      s => s.id !== shopToEdit?.id && s.code?.trim().toUpperCase() === finalCode
    );
    if (duplicateCode) {
      setError(`Shop code "${finalCode}" is already in use by "${duplicateCode.name}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await saveShop({
        id: shopToEdit?.id,
        name: trimmedName,
        code: finalCode,
        phone: phone.trim() || '',
        address: address.trim() || '',
        isActive,
        assignedEmployees: shopToEdit?.assignedEmployees || []
      });

      // Dispatch real-time sync event across application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr_data_sync'));
      }

      onSaveSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save shop:', err);
      setError(err?.message || 'Failed to save shop. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-edit-shop-title"
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
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 id="add-edit-shop-title" className="text-sm sm:text-base font-bold text-slate-900">
                {isEditing ? 'Edit Shop Details' : 'Add New Retail Shop'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update partner shop information' : 'Register a new store without leaving Add Record'}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Shop Name */}
          <div className="space-y-1">
            <label htmlFor="shop-modal-name" className="block text-xs font-semibold text-slate-700">
              Shop Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="shop-modal-name"
              type="text"
              required
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError(null);
                if (!isEditing && !code) {
                  const raw = e.target.value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                  if (raw) setCode(`RTR-${raw}`);
                }
              }}
              placeholder="e.g. Supreme Mobiles Anna Nagar"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
            />
          </div>

          {/* Shop Code */}
          <div className="space-y-1">
            <label htmlFor="shop-modal-code" className="block text-xs font-semibold text-slate-700">
              Shop Code <span className="text-slate-400 font-normal">(e.g. RTR-SUPM)</span>
            </label>
            <input
              id="shop-modal-code"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Auto-generated if left empty"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent font-mono transition-all uppercase"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label htmlFor="shop-modal-phone" className="block text-xs font-semibold text-slate-700">
              Contact Phone <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="shop-modal-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label htmlFor="shop-modal-address" className="block text-xs font-semibold text-slate-700">
              Address / Location <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="shop-modal-address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 100 Feet Rd, Gandhipuram"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#168BFF] focus:border-transparent transition-all"
            />
          </div>

          {/* Active Status Toggle (Edit mode) */}
          {isEditing && (
            <div className="pt-1 flex items-center justify-between border-t border-slate-100">
              <div>
                <label className="text-xs font-semibold text-slate-800 block">Store Status</label>
                <span className="text-[11px] text-slate-500">
                  {isActive ? 'Active — Available for new deliveries' : 'Inactive / Archived — Hidden from new selections'}
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
                  <span>{isEditing ? 'Save Changes' : 'Create & Select Shop'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

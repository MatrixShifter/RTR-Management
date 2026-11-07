import React, { useState, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Plus, 
  Pencil, 
  Check, 
  Store, 
  Package 
} from 'lucide-react';
import { isDemoShop, isDemoProduct } from '@crimpston/shared';
import { 
  type Shop, 
  type Product, 
  checkShopUsage, 
  checkProductUsage, 
  type DeleteCatalogResult 
} from '../services/db.js';
import { AddEditShopModal } from './AddEditShopModal.js';
import { AddEditProductModal } from './AddEditProductModal.js';

export interface ManageCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'shops' | 'products';
  items: (Shop | Product)[];
  selectedId?: string;
  onDelete: (id: string) => Promise<DeleteCatalogResult>;
  onItemsUpdated?: () => Promise<void> | void;
  onSelect?: (item: Shop | Product) => void;
}

export const ManageCatalogModal: React.FC<ManageCatalogModalProps> = ({
  isOpen,
  onClose,
  type,
  items = [],
  selectedId,
  onDelete,
  onItemsUpdated,
  onSelect
}) => {
  const isShop = type === 'shops';
  const entityTitle = isShop ? 'Shop' : 'Product';
  const entityPlural = isShop ? 'Shops' : 'Products';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [itemToEdit, setItemToEdit] = useState<Shop | Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [usageInfo, setUsageInfo] = useState<{ inUse: boolean; count: number } | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Filter items by search query and category (Strictly excluding confirmed demo entities)
  const filteredItems = useMemo(() => {
    const nonDemo = items.filter(item => isShop ? !isDemoShop(item as Shop) : !isDemoProduct(item as Product));
    const q = searchQuery.trim().toLowerCase();

    return nonDemo.filter(item => {
      // Category filter for products
      if (!isShop && selectedCategory !== 'all') {
        const prod = item as Product;
        if (prod.category !== selectedCategory) return false;
      }

      if (!q) return true;

      const nameMatch = item.name?.toLowerCase().includes(q);
      const codeOrSkuMatch = isShop 
        ? (item as Shop).code?.toLowerCase().includes(q)
        : (item as Product).sku?.toLowerCase().includes(q);
      const phoneOrAddressMatch = isShop
        ? (item as Shop).phone?.toLowerCase().includes(q) || (item as Shop).address?.toLowerCase().includes(q)
        : false;

      return nameMatch || codeOrSkuMatch || phoneOrAddressMatch;
    });
  }, [items, searchQuery, isShop, selectedCategory]);

  if (!isOpen) return null;

  const handleInitiateDelete = async (item: Shop | Product) => {
    setFeedback(null);

    // Rule: Prevent deletion of item currently selected in unsaved record
    if (selectedId && item.id === selectedId) {
      setFeedback({
        type: 'warning',
        message: `This ${entityTitle.toLowerCase()} is currently selected in your record form. Please choose a different ${entityTitle.toLowerCase()} or clear your selection before deleting.`
      });
      return;
    }

    setItemToDelete({ id: item.id, name: item.name });
    setIsCheckingUsage(true);
    setUsageInfo(null);

    try {
      const usage = isShop 
        ? await checkShopUsage(item.id) 
        : await checkProductUsage(item.id);
      setUsageInfo(usage);
    } catch {
      setUsageInfo({ inUse: false, count: 0 });
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setFeedback(null);

    try {
      const result = await onDelete(itemToDelete.id);
      if (!result || !result.success) {
        throw new Error(result?.message || `Failed to delete ${entityTitle.toLowerCase()}.`);
      }
      setFeedback({
        type: 'success',
        message: result.message || `${entityTitle} updated successfully.`
      });
      setItemToDelete(null);
      setUsageInfo(null);
      if (onItemsUpdated) {
        await onItemsUpdated();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Failed to delete ${entityTitle.toLowerCase()}. Please try again.`
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavedEntity = async (saved: Shop | Product) => {
    setFeedback({
      type: 'success',
      message: `${entityTitle} "${saved.name}" saved successfully.`
    });
    setItemToEdit(null);
    setIsAddModalOpen(false);
    if (onItemsUpdated) {
      await onItemsUpdated();
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-catalog-title"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
      >
        <div 
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-[#168BFF] rounded-xl border border-blue-100">
                {isShop ? <Store className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <h3 id="manage-catalog-title" className="text-base font-bold text-slate-900">
                  {`Manage ${entityPlural}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {`View, add, edit details, or safely archive existing ${entityPlural.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1.5 bg-[#168BFF] hover:bg-[#0876E8] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{`Add ${entityTitle}`}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div className={`px-5 py-3 border-b text-xs flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : feedback.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search Bar & Optional Category Filter */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${entityPlural.toLowerCase()} by name, ${isShop ? 'code, or phone' : 'SKU'}...`}
                aria-label={`Search ${entityPlural.toLowerCase()}`}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#168BFF] transition-colors"
              />
            </div>

            {/* Category Filter Pills (Products only) */}
            {!isShop && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {['all', 'Mobile Cases', 'Tempered Glass', 'Chargers & Adapters', 'USB Cables', 'Earphones & Audio'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer text-[11px] ${
                      selectedCategory === cat
                        ? 'bg-[#168BFF] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <p>No {entityPlural.toLowerCase()} found matching your criteria.</p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-[#168BFF] hover:underline font-semibold"
                >
                  + Add New {entityTitle}
                </button>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedId === item.id;
                const isInactive = item.isActive === false;
                const shopItem = isShop ? (item as Shop) : null;
                const prodItem = !isShop ? (item as Product) : null;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                          {item.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                        {isInactive ? (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            Archived
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Detail row */}
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                        {isShop ? (
                          <>
                            <span className="font-mono text-slate-600">{`Code: ${shopItem?.code || '—'}`}</span>
                            {shopItem?.phone && <span>{`📞 ${shopItem.phone}`}</span>}
                            {shopItem?.address && <span className="truncate max-w-[200px]">{`📍 ${shopItem.address}`}</span>}
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-slate-600">{`SKU: ${prodItem?.sku || '—'}`}</span>
                            <span className="text-blue-600 font-medium">{`₹${prodItem?.unitPrice ?? 0}`}</span>
                            {prodItem?.category && <span className="text-slate-400">{`(${prodItem.category})`}</span>}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {onSelect && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(item);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title={`Select ${item.name} for current record`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Select</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setItemToEdit(item)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title={`Edit ${item.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateDelete(item)}
                        disabled={isDeleting}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={`Delete / Archive ${item.name}`}
                        aria-label={`Delete ${entityTitle.toLowerCase()} ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Delete Confirmation Overlay / Drawer */}
          {itemToDelete && (
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 animate-fade-in">
              {isCheckingUsage ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin text-[#168BFF]" />
                  <span>Checking records usage...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Delete or Archive {entityTitle}?
                      </h4>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">
                        {entityTitle}: <span className="font-normal text-slate-600">{itemToDelete.name}</span>
                      </p>
                      {usageInfo?.inUse ? (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1.5 leading-relaxed">
                          This {entityTitle.toLowerCase()} is linked to {usageInfo.count} transaction{usageInfo.count === 1 ? '' : 's'}. It will be safely archived without affecting existing deliveries, sales, or payments.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          This unused {entityTitle.toLowerCase()} has zero historical transactions and can be safely deleted.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => {
                        setItemToDelete(null);
                        setUsageInfo(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs bg-rose-600 hover:bg-rose-700"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Confirm {usageInfo?.inUse ? 'Archive' : 'Delete'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Add / Edit Shop Modal */}
      {isShop && (isAddModalOpen || Boolean(itemToEdit)) && (
        <AddEditShopModal
          isOpen={isAddModalOpen || Boolean(itemToEdit)}
          onClose={() => {
            setIsAddModalOpen(false);
            setItemToEdit(null);
          }}
          shopToEdit={itemToEdit as Shop | null}
          existingShops={items as Shop[]}
          onSaveSuccess={handleSavedEntity}
        />
      )}

      {/* Embedded Add / Edit Product Modal */}
      {!isShop && (isAddModalOpen || Boolean(itemToEdit)) && (
        <AddEditProductModal
          isOpen={isAddModalOpen || Boolean(itemToEdit)}
          onClose={() => {
            setIsAddModalOpen(false);
            setItemToEdit(null);
          }}
          productToEdit={itemToEdit as Product | null}
          existingProducts={items as Product[]}
          onSaveSuccess={handleSavedEntity}
        />
      )}
    </>
  );
};

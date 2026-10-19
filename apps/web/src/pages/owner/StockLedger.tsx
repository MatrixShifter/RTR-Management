import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowRightLeft, 
  PackageOpen, 
  CheckCircle2, 
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import type { StockBalance } from '@crimpston/shared';
import { 
  getShops, 
  getProducts,
  calculateStockBalances, 
  recordStockTransfer, 
  recordStockAudit, 
  type Shop,
  type Product 
} from '../../services/db.js';

export const StockLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [discrepancyOnly, setDiscrepancyOnly] = useState<boolean>(false);
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromShop, setTransferFromShop] = useState('');
  const [transferToShop, setTransferToShop] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Physical Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<StockBalance | null>(null);
  const [auditPhysicalCount, setAuditPhysicalCount] = useState<number>(0);
  const [auditNotes, setAuditNotes] = useState('');
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shopList, prodList, balanceList] = await Promise.all([
        getShops(),
        getProducts(),
        calculateStockBalances(selectedShopId)
      ]);
      setShops(shopList);
      setProducts(prodList);
      setBalances(balanceList);

      if (shopList.length >= 2) {
        if (!transferFromShop) setTransferFromShop(shopList[0]?.id || '');
        if (!transferToShop) setTransferToShop(shopList[1]?.id || '');
      }
      if (prodList.length > 0 && !transferProductId) {
        setTransferProductId(prodList[0]?.id || '');
      }
    } catch (err) {
      console.error('Failed to load stock ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('rtr_data_sync', handleSync);
    return () => window.removeEventListener('rtr_data_sync', handleSync);
  }, [selectedShopId]);

  // Filtered dataset
  const filtered = balances.filter(b => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = b.product_name.toLowerCase().includes(q) ||
                          b.product_sku.toLowerCase().includes(q) ||
                          b.shop_name.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || b.category === selectedCategory;
    const matchesDiscrepancy = !discrepancyOnly || (b.discrepancy !== null && b.discrepancy !== 0);

    return matchesSearch && matchesCategory && matchesDiscrepancy;
  });

  // Aggregates for current view
  const totalDelivered = filtered.reduce((acc, curr) => acc + curr.total_delivered, 0);
  const totalSold = filtered.reduce((acc, curr) => acc + curr.confirmed_sold + curr.provisional_sold, 0);
  const totalExpectedStock = filtered.reduce((acc, curr) => acc + curr.expected_stock, 0);
  const itemsWithDiscrepancy = filtered.filter(b => b.discrepancy !== null && b.discrepancy !== 0).length;

  const categories = Array.from(new Set(products.map(p => p.category)));

  // Handle Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFromShop || !transferToShop) {
      alert('Please select both source and destination shops.');
      return;
    }
    if (transferFromShop === transferToShop) {
      alert('Source and destination shops must be different.');
      return;
    }
    if (transferQty <= 0) {
      alert('Transfer quantity must be greater than 0.');
      return;
    }

    const fromShop = shops.find(s => s.id === transferFromShop);
    const toShop = shops.find(s => s.id === transferToShop);
    const prod = products.find(p => p.id === transferProductId);

    setIsSubmittingTransfer(true);
    try {
      await recordStockTransfer({
        fromShopId: transferFromShop,
        fromShopName: fromShop ? fromShop.name : 'Unknown Shop',
        toShopId: transferToShop,
        toShopName: toShop ? toShop.name : 'Unknown Shop',
        productId: transferProductId,
        productName: prod ? prod.name : 'Unknown Product',
        quantity: transferQty,
        notes: transferNote
      });

      setSuccessNotice(`Transferred ${transferQty} units of ${prod?.name || 'product'} from ${fromShop?.name} to ${toShop?.name}.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setIsTransferModalOpen(false);
      setTransferQty(1);
      setTransferNote('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error recording transfer');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Handle Audit Count Submit
  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditItem) return;

    setIsSubmittingAudit(true);
    try {
      const disc = auditPhysicalCount - selectedAuditItem.expected_stock;
      await recordStockAudit({
        shopId: selectedAuditItem.shop_id,
        productId: selectedAuditItem.product_id,
        physicalCount: auditPhysicalCount,
        expectedCount: selectedAuditItem.expected_stock,
        discrepancy: disc,
        countedAt: new Date().toISOString().slice(0, 10),
        notes: auditNotes
      });

      setSuccessNotice(`Physical shelf count of ${auditPhysicalCount} pcs recorded for ${selectedAuditItem.product_name}.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setIsAuditModalOpen(false);
      setSelectedAuditItem(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error recording audit count');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  const openAuditModal = (item: StockBalance) => {
    setSelectedAuditItem(item);
    setAuditPhysicalCount(item.last_physical_count ?? item.expected_stock);
    setAuditNotes('');
    setIsAuditModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Multi-Shop Stock Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time accessory balances calculated from verified deliveries, reported daily sales, and shelf audits.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          {shops.length >= 2 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsTransferModalOpen(true)}
              className="text-xs font-medium"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-slate-500" />
              <span>Stock Transfer</span>
            </Button>
          )}
          <Link to="/deliveries">
            <Button variant="primary" size="sm" className="text-xs font-semibold shadow-sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Record Delivery</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Unified Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Total Delivered (In)</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">
            {totalDelivered} pcs
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Cumulative supplies</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Total Sold (Out)</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">
            {totalSold} pcs
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Approved & confirmed</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Expected Stock</span>
          <span className="text-lg font-bold text-blue-600 tabular-nums">
            {totalExpectedStock} pcs
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">On partner shelves</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Audit Discrepancies</span>
          <span className={`text-lg font-bold tabular-nums ${itemsWithDiscrepancy > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {itemsWithDiscrepancy}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {itemsWithDiscrepancy === 0 ? "Physical shelves match" : "Variances logged"}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          
          {/* Shop Selector (4 cols) */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Retail Shop</label>
            <select
              value={selectedShopId}
              onChange={e => setSelectedShopId(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Retail Stores ({shops.length})</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Category Filter (3 cols) */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Search Term (5 cols) */}
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Products</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by product name, SKU, or store..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Discrepancy Toggle Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={e => setDiscrepancyOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span className="font-medium">Show only items with physical audit discrepancies</span>
          </label>
          <span className="text-[11px] text-slate-400 font-mono">
            Showing {filtered.length} of {balances.length} records
          </span>
        </div>
      </div>

      {/* Main Stock Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : balances.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No Inventory Balances Found"
            description="Add retail shops and record deliveries to begin tracking physical inventory on partner shelves."
            action={
              <Button variant="primary" size="sm" onClick={() => window.location.href = '/deliveries'}>
                Record Delivery
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No stock records match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Retail Shop</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 font-mono">SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-2.5 text-right">Delivered</th>
                  <th className="py-2.5 px-2.5 text-right">Sold</th>
                  <th className="py-2.5 px-2.5 text-right">Transferred</th>
                  <th className="py-2.5 px-3 text-right font-bold">Expected Stock</th>
                  <th className="py-2.5 px-3 text-right">Shelf Count</th>
                  <th className="py-2.5 px-2.5 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => {
                  const netTransfer = b.total_transferred_in - b.total_transferred_out;

                  return (
                    <tr key={`${b.shop_id}-${b.product_id}`} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                        <Link to="/shops" className="hover:text-blue-600">
                          {b.shop_name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {b.product_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                        {b.product_sku}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {b.category}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums text-slate-700">
                        {b.total_delivered}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums text-slate-700">
                        {b.confirmed_sold + b.provisional_sold}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums font-mono text-slate-500">
                        {netTransfer > 0 ? `+${netTransfer}` : netTransfer < 0 ? netTransfer : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-600">
                        {b.expected_stock} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                        {b.last_physical_count !== null ? `${b.last_physical_count} pcs` : '—'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums font-mono">
                        {b.discrepancy !== null && b.discrepancy !== undefined ? (
                          b.discrepancy === 0 ? (
                            <span className="text-emerald-700 font-semibold">0</span>
                          ) : (
                            <span className="text-amber-700 font-bold">
                              {b.discrepancy > 0 ? `+${b.discrepancy}` : b.discrepancy}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => openAuditModal(b)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                          title="Record physical count check"
                        >
                          Count Check
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Transfer Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Inter-Shop Stock Transfer"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Shop (Send From) *
              </label>
              <select
                value={transferFromShop}
                onChange={e => setTransferFromShop(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
                required
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Shop (Receive At) *
              </label>
              <select
                value={transferToShop}
                onChange={e => setTransferToShop(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
                required
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Item *
              </label>
              <select
                value={transferProductId}
                onChange={e => setTransferProductId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
                required
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <Input
              label="Transfer Quantity (pcs) *"
              type="number"
              min={1}
              value={transferQty}
              onChange={e => setTransferQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
            />
          </div>

          <Input
            label="Transfer Reason / Note"
            placeholder="e.g. Stock rebalancing, high demand"
            value={transferNote}
            onChange={e => setTransferNote(e.target.value)}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmittingTransfer}
            >
              Confirm Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Physical Audit Check Modal */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="Physical Shelf Count Verification"
      >
        {selectedAuditItem && (
          <form onSubmit={handleAuditSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
              <div><strong>Shop:</strong> {selectedAuditItem.shop_name}</div>
              <div><strong>Product:</strong> {selectedAuditItem.product_name} ({selectedAuditItem.product_sku})</div>
              <div><strong>Expected Ledger Stock:</strong> <span className="font-bold text-blue-600">{selectedAuditItem.expected_stock} pcs</span></div>
            </div>

            <Input
              label="Physical Quantity Counted on Shelf *"
              type="number"
              min={0}
              value={auditPhysicalCount}
              onChange={e => setAuditPhysicalCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              required
            />

            <div className="text-xs text-slate-600">
              Calculated Discrepancy:{' '}
              <strong className={auditPhysicalCount === selectedAuditItem.expected_stock ? 'text-emerald-700' : 'text-amber-700 font-mono'}>
                {auditPhysicalCount - selectedAuditItem.expected_stock > 0 ? `+${auditPhysicalCount - selectedAuditItem.expected_stock}` : auditPhysicalCount - selectedAuditItem.expected_stock} pcs
              </strong>
            </div>

            <Input
              label="Audit Notes"
              placeholder="e.g. Shelf audit conducted by owner"
              value={auditNotes}
              onChange={e => setAuditNotes(e.target.value)}
            />

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsAuditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmittingAudit}
              >
                Save Physical Count
              </Button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  ClipboardCheck,
  PackageOpen,
  Store
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
import type { StockBalance } from '@crimpston/shared';
import { 
  getShops, 
  calculateStockBalances, 
  recordStockTransfer, 
  recordStockAudit, 
  type Shop 
} from '../../services/db.js';

export const StockLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [shops, setShops] = useState<Shop[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromShop, setTransferFromShop] = useState('');
  const [transferToShop, setTransferToShop] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState('');

  // Physical Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<StockBalance | null>(null);
  const [auditPhysicalCount, setAuditPhysicalCount] = useState<number>(0);
  const [auditNotes, setAuditNotes] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shopList, balanceList] = await Promise.all([
        getShops(),
        calculateStockBalances(selectedShopId)
      ]);
      setShops(shopList);
      setBalances(balanceList);

      if (shopList.length >= 2) {
        if (!transferFromShop) setTransferFromShop(shopList[0]?.id || '');
        if (!transferToShop) setTransferToShop(shopList[1]?.id || '');
      }
      if (balanceList.length > 0 && !transferProductId) {
        setTransferProductId(balanceList[0]?.product_id || '');
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

  const filtered = balances.filter(b => {
    const matchesSearch = b.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.product_sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate Aggregates for Selected Scope
  const totalDelivered = filtered.reduce((acc, curr) => acc + curr.total_delivered, 0);
  const totalSold = filtered.reduce((acc, curr) => acc + curr.confirmed_sold + curr.provisional_sold, 0);
  const totalExpectedStock = filtered.reduce((acc, curr) => acc + curr.expected_stock, 0);
  const itemsWithDiscrepancy = filtered.filter(b => b.discrepancy !== null && b.discrepancy !== 0).length;

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

    const sourceRecord = balances.find(b => b.shop_id === transferFromShop && b.product_id === transferProductId);
    if (!sourceRecord || sourceRecord.expected_stock < transferQty) {
      alert(`Source shop only has ${sourceRecord ? sourceRecord.expected_stock : 0} units available.`);
      return;
    }

    const fromShop = shops.find(s => s.id === transferFromShop);
    const toShop = shops.find(s => s.id === transferToShop);

    await recordStockTransfer({
      fromShopId: transferFromShop,
      fromShopName: fromShop ? fromShop.name : '',
      toShopId: transferToShop,
      toShopName: toShop ? toShop.name : '',
      productId: transferProductId,
      productName: sourceRecord ? sourceRecord.product_name : '',
      quantity: transferQty,
      notes: transferNote
    });

    setIsTransferModalOpen(false);
    setTransferQty(1);
    setTransferNote('');
    await loadData();
  };

  const openAuditModal = (item: StockBalance) => {
    setSelectedAuditItem(item);
    setAuditPhysicalCount(item.last_physical_count ?? item.expected_stock);
    setAuditNotes('');
    setIsAuditModalOpen(true);
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditItem) return;

    const diff = auditPhysicalCount - selectedAuditItem.expected_stock;
    const today = new Date().toISOString().slice(0, 10);

    await recordStockAudit({
      shopId: selectedAuditItem.shop_id,
      productId: selectedAuditItem.product_id,
      physicalCount: auditPhysicalCount,
      expectedCount: selectedAuditItem.expected_stock,
      discrepancy: diff,
      countedAt: today,
      notes: auditNotes
    });

    setIsAuditModalOpen(false);
    setSelectedAuditItem(null);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shop-Wise Inventory Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock accounting calculated dynamically from recorded deliveries, sales, and verified audits.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {shops.length >= 2 && balances.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
              Transfer Stock
            </Button>
          )}
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Export Ledger CSV
          </Button>
        </div>
      </div>

      {/* Prominent Shop Selector / Filter Strip */}
      {shops.length > 0 && (
        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedShopId('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              selectedShopId === 'all'
                ? 'bg-crimpston-navy text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Stores Overview
          </button>
          {shops.map(shop => {
            const shopItemCount = balances.filter(b => b.shop_id === shop.id).length;
            return (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  selectedShopId === shop.id
                    ? 'bg-crimpston-navy text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📍 {shop.name} ({shopItemCount})
              </button>
            );
          })}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Delivered"
          value={`${totalDelivered} pcs`}
          subtext="Cumulative supply batches"
        />
        <MetricCard
          label="Total Sold"
          value={`${totalSold} pcs`}
          subtext="Confirmed + provisional reports"
        />
        <MetricCard
          label="Expected In Stock"
          value={`${totalExpectedStock} pcs`}
          subtext="Calculated remaining balance"
        />
        <MetricCard
          label="Physical Discrepancies"
          value={itemsWithDiscrepancy}
          subtext={itemsWithDiscrepancy === 0 ? "All verified stores balanced" : "Requires owner physical audit"}
        />
      </div>

      {/* Search and Table Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by product name, category or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>
        </div>

        {/* Stock Ledger Detailed Table or Empty State */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Calculating inventory ledger...</div>
        ) : balances.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <PackageOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No inventory records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Add shops and record deliveries to begin tracking inventory across retail locations.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/management">
                <Button variant="outline" size="sm">
                  <Store className="w-3.5 h-3.5 mr-1" />
                  Add Shop / Product
                </Button>
              </Link>
              <Link to="/deliveries">
                <Button variant="primary" size="sm">
                  Record Delivery
                </Button>
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            No transactions found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Product / SKU</th>
                  <th className="py-2.5 px-2 text-right">Delivered</th>
                  <th className="py-2.5 px-2 text-right">Sold</th>
                  <th className="py-2.5 px-2 text-right">Transferred</th>
                  <th className="py-2.5 px-2 text-right">Damage/Return</th>
                  <th className="py-2.5 px-2 text-right font-bold text-slate-900">Expected Stock</th>
                  <th className="py-2.5 px-2 text-right">Physical Count</th>
                  <th className="py-2.5 px-2 text-right">Discrepancy</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item, idx) => {
                  const isLowStock = item.expected_stock <= item.min_stock_threshold;
                  const netTransfer = item.total_transferred_in - item.total_transferred_out;
                  const netDamaged = item.total_returned + item.total_damaged;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {item.shop_name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{item.product_sku} • {item.category}</span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-slate-700">
                        +{item.total_delivered}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-600">
                        -{item.confirmed_sold + item.provisional_sold}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-600">
                        {netTransfer === 0 ? '0' : netTransfer > 0 ? `+${netTransfer}` : `${netTransfer}`}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-600">
                        {netDamaged > 0 ? `-${netDamaged}` : '0'}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-slate-900 bg-slate-50/50">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span>{item.expected_stock} pcs</span>
                          {isLowStock && (
                            <span title="Below minimum stock threshold" className="text-amber-500 font-bold text-xs">⚠️</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {item.last_physical_count !== null ? (
                          <div>
                            <span className="font-semibold text-slate-800">{item.last_physical_count} pcs</span>
                            <span className="block text-[10px] text-slate-400">{item.last_counted_at}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Audited</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold">
                        {item.discrepancy === null || item.discrepancy === undefined ? (
                          <span className="text-slate-400">-</span>
                        ) : item.discrepancy === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">Match</span>
                        ) : item.discrepancy > 0 ? (
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">+{item.discrepancy} Surplus</span>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">{item.discrepancy} Shortage</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAuditModal(item)}
                          className="text-[11px] py-1 px-2.5 h-auto"
                        >
                          <ClipboardCheck className="w-3 h-3 mr-1" />
                          Audit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Stock Transfer Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Stock Between Shops"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Record inventory relocated from one retail store to another. Automatically logs atomic movements.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source Shop (From)</label>
              <select
                value={transferFromShop}
                onChange={(e) => setTransferFromShop(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Shop (To)</label>
              <select
                value={transferToShop}
                onChange={(e) => setTransferToShop(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Item</label>
            <select
              value={transferProductId}
              onChange={(e) => setTransferProductId(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
            >
              {balances.filter(b => b.shop_id === transferFromShop).map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.product_sku}) - In Stock: {p.expected_stock} pcs
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity to Relocate"
              type="number"
              min={1}
              value={transferQty}
              onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
              required
            />
            <Input
              label="Transfer Memo / Ref"
              placeholder="e.g. Relocated for urgent customer demand"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Confirm Stock Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Physical Audit Modal */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="Record Physical Stock Audit"
      >
        {selectedAuditItem && (
          <form onSubmit={handleAuditSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <p><strong>Shop:</strong> {selectedAuditItem.shop_name}</p>
              <p><strong>Product:</strong> {selectedAuditItem.product_name} ({selectedAuditItem.product_sku})</p>
              <p><strong>System Expected Stock:</strong> <span className="font-bold">{selectedAuditItem.expected_stock} pcs</span></p>
            </div>

            <div>
              <Input
                label="Physical Hand-Counted Quantity"
                type="number"
                min={0}
                value={auditPhysicalCount}
                onChange={(e) => setAuditPhysicalCount(parseInt(e.target.value, 10) || 0)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Discrepancy: {auditPhysicalCount - selectedAuditItem.expected_stock === 0 ? (
                  <span className="text-emerald-600 font-semibold">Perfect Match (0)</span>
                ) : auditPhysicalCount - selectedAuditItem.expected_stock > 0 ? (
                  <span className="text-blue-600 font-semibold">+{auditPhysicalCount - selectedAuditItem.expected_stock} Surplus</span>
                ) : (
                  <span className="text-amber-700 font-semibold">{auditPhysicalCount - selectedAuditItem.expected_stock} Shortage</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes / Explanations</label>
              <textarea
                rows={2}
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="e.g. Physically counted on shelf during store visit"
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsAuditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save Physical Audit
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

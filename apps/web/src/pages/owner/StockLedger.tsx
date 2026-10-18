import React, { useState } from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  ClipboardCheck
} from 'lucide-react';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
import type { StockBalance } from '@crimpston/shared';

interface ShopOption {
  id: string;
  name: string;
}

const shops: ShopOption[] = [
  { id: 's0000000-0000-0000-0000-000000000001', name: 'Apex Mobiles & Telecom' },
  { id: 's0000000-0000-0000-0000-000000000002', name: 'City Point Digital Hub' }
];

const initialBalances: StockBalance[] = [
  {
    shop_id: 's0000000-0000-0000-0000-000000000001',
    shop_name: 'Apex Mobiles & Telecom',
    product_id: 'p0000000-0000-0000-0000-000000000001',
    product_name: 'Shockproof Armor Case (iPhone 15)',
    product_sku: 'CASE-IP15-ARM',
    category: 'Mobile Cases',
    total_delivered: 20,
    confirmed_sold: 5,
    provisional_sold: 2,
    total_returned: 0,
    total_damaged: 0,
    total_transferred_in: 0,
    total_transferred_out: 0,
    expected_stock: 13,
    last_physical_count: 14,
    last_counted_at: '2026-10-15',
    discrepancy: 1,
    min_stock_threshold: 5
  },
  {
    shop_id: 's0000000-0000-0000-0000-000000000001',
    shop_name: 'Apex Mobiles & Telecom',
    product_id: 'p0000000-0000-0000-0000-000000000002',
    product_name: '9H 2.5D Tempered Glass (Galaxy S24)',
    product_sku: 'TG-S24-9H',
    category: 'Tempered Glass',
    total_delivered: 30,
    confirmed_sold: 15,
    provisional_sold: 4,
    total_returned: 1,
    total_damaged: 1,
    total_transferred_in: 0,
    total_transferred_out: 0,
    expected_stock: 9,
    last_physical_count: 9,
    last_counted_at: '2026-10-17',
    discrepancy: 0,
    min_stock_threshold: 10
  },
  {
    shop_id: 's0000000-0000-0000-0000-000000000002',
    shop_name: 'City Point Digital Hub',
    product_id: 'p0000000-0000-0000-0000-000000000001',
    product_name: 'Shockproof Armor Case (iPhone 15)',
    product_sku: 'CASE-IP15-ARM',
    category: 'Mobile Cases',
    total_delivered: 15,
    confirmed_sold: 10,
    provisional_sold: 0,
    total_returned: 0,
    total_damaged: 0,
    total_transferred_in: 0,
    total_transferred_out: 0,
    expected_stock: 5,
    last_physical_count: 5,
    last_counted_at: '2026-10-16',
    discrepancy: 0,
    min_stock_threshold: 4
  },
  {
    shop_id: 's0000000-0000-0000-0000-000000000002',
    shop_name: 'City Point Digital Hub',
    product_id: 'p0000000-0000-0000-0000-000000000003',
    product_name: '65W GaN Fast Charger Dual Port',
    product_sku: 'CHG-65W-GAN',
    category: 'Chargers & Adapters',
    total_delivered: 10,
    confirmed_sold: 8,
    provisional_sold: 0,
    total_returned: 0,
    total_damaged: 0,
    total_transferred_in: 0,
    total_transferred_out: 0,
    expected_stock: 2,
    last_physical_count: 2,
    last_counted_at: '2026-10-17',
    discrepancy: 0,
    min_stock_threshold: 3
  }
];

export const StockLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [balances, setBalances] = useState<StockBalance[]>(initialBalances);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromShop, setTransferFromShop] = useState(shops[0]?.id || '');
  const [transferToShop, setTransferToShop] = useState(shops[1]?.id || '');
  const [transferProductId, setTransferProductId] = useState(initialBalances[0]?.product_id || '');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState('');

  // Physical Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedAuditItem, setSelectedAuditItem] = useState<StockBalance | null>(null);
  const [auditPhysicalCount, setAuditPhysicalCount] = useState<number>(0);
  const [auditNotes, setAuditNotes] = useState('');

  const filtered = balances.filter(b => {
    const matchesSearch = b.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.product_sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShop = selectedShopId === 'all' || b.shop_id === selectedShopId;
    return matchesSearch && matchesShop;
  });

  // Calculate Aggregates for Selected Scope
  const totalDelivered = filtered.reduce((acc, curr) => acc + curr.total_delivered, 0);
  const totalSold = filtered.reduce((acc, curr) => acc + curr.confirmed_sold + curr.provisional_sold, 0);
  const totalExpectedStock = filtered.reduce((acc, curr) => acc + curr.expected_stock, 0);
  const itemsWithDiscrepancy = filtered.filter(b => b.discrepancy !== null && b.discrepancy !== 0).length;

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferFromShop === transferToShop) {
      alert('Source and destination shops must be different.');
      return;
    }
    if (transferQty <= 0) {
      alert('Transfer quantity must be greater than 0.');
      return;
    }

    // Verify source shop has enough expected stock
    const sourceRecord = balances.find(b => b.shop_id === transferFromShop && b.product_id === transferProductId);
    if (!sourceRecord || sourceRecord.expected_stock < transferQty) {
      alert(`Source shop only has ${sourceRecord ? sourceRecord.expected_stock : 0} units available.`);
      return;
    }

    setBalances(prev => {
      return prev.map(item => {
        if (item.shop_id === transferFromShop && item.product_id === transferProductId) {
          const newTransferredOut = item.total_transferred_out + transferQty;
          const newExpected = item.expected_stock - transferQty;
          return {
            ...item,
            total_transferred_out: newTransferredOut,
            expected_stock: newExpected
          };
        }
        if (item.shop_id === transferToShop && item.product_id === transferProductId) {
          const newTransferredIn = item.total_transferred_in + transferQty;
          const newExpected = item.expected_stock + transferQty;
          return {
            ...item,
            total_transferred_in: newTransferredIn,
            expected_stock: newExpected
          };
        }
        return item;
      });
    });

    setIsTransferModalOpen(false);
    setTransferQty(1);
    setTransferNote('');
  };

  const openAuditModal = (item: StockBalance) => {
    setSelectedAuditItem(item);
    setAuditPhysicalCount(item.last_physical_count ?? item.expected_stock);
    setAuditNotes('');
    setIsAuditModalOpen(true);
  };

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditItem) return;

    const diff = auditPhysicalCount - selectedAuditItem.expected_stock;
    const today = new Date().toISOString().split('T')[0];

    setBalances(prev => prev.map(item => {
      if (item.shop_id === selectedAuditItem.shop_id && item.product_id === selectedAuditItem.product_id) {
        return {
          ...item,
          last_physical_count: auditPhysicalCount,
          last_counted_at: today,
          discrepancy: diff
        };
      }
      return item;
    }));

    setIsAuditModalOpen(false);
    setSelectedAuditItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shop-Wise Inventory Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-shop stock accounting calculating Delivered, Sold, Transferred, and Physical Audits.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsTransferModalOpen(true)}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            Transfer Stock
          </Button>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Export Ledger CSV
          </Button>
        </div>
      </div>

      {/* Prominent Shop Selector / Filter Strip */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedShopId('all')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            selectedShopId === 'all'
              ? 'bg-crimpston-navy text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Shops Overview ({balances.length} items)
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

        {/* Stock Ledger Detailed Table */}
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
      </Card>

      {/* Stock Transfer Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Stock Between Shops"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Record inventory relocated from one retail store to another. Automatically logs atomic <code>TRANSFER_OUT</code> and <code>TRANSFER_IN</code> movements.
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
              {initialBalances.filter(b => b.shop_id === transferFromShop).map(p => (
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
              placeholder="e.g. Relocated for urgent demand"
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
                placeholder="e.g. Physically counted on shelf during evening visit"
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

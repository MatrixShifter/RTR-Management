import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Package,
  Search,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { 
  getShops, 
  getProducts, 
  getDeliveries, 
  recordDelivery, 
  type Shop, 
  type Product, 
  type DeliveryRecord 
} from '../../services/db.js';

interface DeliveryLine {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export const DeliveryManagement: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [selectedShop, setSelectedShop] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DeliveryLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Filter for history
  const [historySearch, setHistorySearch] = useState('');

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [sList, pList, dList] = await Promise.all([
        getShops(),
        getProducts(),
        getDeliveries()
      ]);
      setShops(sList);
      setProducts(pList);
      setRecentDeliveries(dList);

      if (sList.length > 0 && !selectedShop) {
        setSelectedShop(sList[0]?.id || '');
      }
      if (pList.length > 0 && lines.length === 0) {
        setLines([{ productId: pList[0]?.id || '', quantity: 10, unitPrice: pList[0]?.unitPrice || 0 }]);
      }
    } catch (err) {
      console.error('Failed to load delivery references:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const handleSync = () => loadAll();
    window.addEventListener('rtr_data_sync', handleSync);
    return () => window.removeEventListener('rtr_data_sync', handleSync);
  }, []);

  const addLine = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    setLines(prev => [...prev, { 
      productId: defaultProd?.id || '', 
      quantity: 10,
      unitPrice: defaultProd?.unitPrice || 0 
    }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof DeliveryLine, val: string | number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        return { 
          ...l, 
          productId: String(val),
          unitPrice: prod?.unitPrice || l.unitPrice 
        };
      }
      return { ...l, [field]: val };
    }));
  };

  const totalQuantity = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const totalCommercialValue = lines.reduce((sum, l) => sum + ((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedShop) {
      setFormError('Please select a target retail shop.');
      return;
    }
    if (lines.length === 0) {
      setFormError('Please add at least one product item to the delivery.');
      return;
    }

    const invalidLine = lines.find(l => !l.productId || l.quantity <= 0);
    if (invalidLine) {
      setFormError('All lines must have a valid product and quantity greater than 0.');
      return;
    }

    const targetShop = shops.find(s => s.id === selectedShop);

    setIsSubmitting(true);
    try {
      await recordDelivery({
        shopId: selectedShop,
        shopName: targetShop ? targetShop.name : 'Unknown Shop',
        deliveryDate,
        status: 'delivered',
        notes: notes.trim(),
        createdBy: 'Business Owner',
        items: lines.map(l => {
          const prod = products.find(p => p.id === l.productId);
          return {
            productId: l.productId,
            productName: prod ? prod.name : 'Unknown Product',
            productSku: prod ? prod.sku : '',
            quantity: Number(l.quantity)
          };
        })
      });

      setSuccessNotice(`Successfully delivered ${totalQuantity} units to ${targetShop?.name || 'store'}. Stock ledger updated.`);
      setTimeout(() => setSuccessNotice(null), 5000);
      setNotes('');
      if (products.length > 0) {
        setLines([{ productId: products[0]?.id || '', quantity: 10, unitPrice: products[0]?.unitPrice || 0 }]);
      }
      await loadAll();
    } catch (err: any) {
      console.error('Failed to record delivery:', err);
      setFormError(err?.message || 'Failed to record delivery supply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && (shops.length === 0 || products.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Record Wholesale Supply Delivery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log wholesale accessory deliveries directly into the persistent stock movements ledger.
          </p>
        </div>

        <EmptyState
          icon={AlertCircle}
          title="Prerequisites Required"
          description={
            shops.length === 0 
              ? "You must register at least one partner retail shop before recording supply deliveries."
              : "You must add at least one accessory product to the catalog before recording deliveries."
          }
          action={
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => window.location.href = shops.length === 0 ? '/shops' : '/catalog'}
            >
              {shops.length === 0 ? "Add Retail Shop" : "Add Product to Catalog"}
            </Button>
          }
        />
      </div>
    );
  }

  // Filtered recent deliveries
  const filteredHistory = recentDeliveries.filter(d => {
    const q = historySearch.toLowerCase();
    return (d.shopName && d.shopName.toLowerCase().includes(q)) ||
           (d.notes && d.notes.toLowerCase().includes(q)) ||
           d.deliveryDate.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Record Wholesale Supply Delivery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fast manual entry for wholesale accessories supplied to partner retail shops.
          </p>
        </div>
        <Link to="/stock-ledger" className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center">
          <span>Inspect Stock Ledger</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
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

      {/* Manual Delivery Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-medium">
            {formError}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>1. Dispatch Header</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Retail Shop *
              </label>
              <select
                value={selectedShop}
                onChange={e => setSelectedShop(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                required
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Delivery Date *"
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Input
                label="Batch Reference / Notes"
                placeholder="e.g. Weekly Restock, Case Batch #4"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Product Lines Table */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>2. Product Line Items ({lines.length})</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Line</span>
            </Button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Accessory Product</th>
                  <th className="py-2.5 px-3 w-32 text-right">Quantity (pcs) *</th>
                  <th className="py-2.5 px-3 w-36 text-right">Selling Rate (₹)</th>
                  <th className="py-2.5 px-3 w-36 text-right">Line Total (₹)</th>
                  <th className="py-2.5 px-2 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={line.productId}
                          onChange={e => updateLine(idx, 'productId', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.sku} ({p.category})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e => updateLine(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-right rounded border border-slate-200 px-2.5 py-1.5 text-xs font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.unitPrice}
                          onChange={e => updateLine(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-right rounded border border-slate-200 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ₹{lineTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 font-semibold border-t border-slate-200 text-slate-800">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-right font-bold">
                    Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-blue-600">
                    {totalQuantity} pcs
                  </td>
                  <td></td>
                  <td className="py-2.5 px-3 text-right font-bold font-mono tabular-nums text-slate-900">
                    ₹{totalCommercialValue.toLocaleString('en-IN')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Deliveries automatically create confirmed <code className="text-blue-600 font-mono">DELIVERY_IN</code> stock movement records in PostgreSQL.
            </span>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="shadow-sm font-semibold"
            >
              <Truck className="w-4 h-4 mr-1.5" />
              <span>Confirm & Post Delivery ({totalQuantity} pcs)</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Recent Deliveries Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Supply Deliveries History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified shipments recorded across all partner stores.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by shop or note..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>
        </div>

        {recentDeliveries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No delivery records yet. Use the form above to log your first supply batch.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3">Retail Shop</th>
                  <th className="py-2.5 px-3">Items Delivered</th>
                  <th className="py-2.5 px-3 text-right">Units</th>
                  <th className="py-2.5 px-3">Batch Note</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(deliv => {
                  const units = deliv.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <tr key={deliv.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5 font-mono text-slate-700">{deliv.deliveryDate}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{deliv.shopName}</td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate" title={deliv.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}>
                        {deliv.items.map(i => `${i.productName || 'Product'} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                        {units} pcs
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 italic truncate max-w-[160px]">
                        {deliv.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="success" size="sm">Delivered</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

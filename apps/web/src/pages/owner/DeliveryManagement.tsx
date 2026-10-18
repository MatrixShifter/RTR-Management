import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, CheckCircle, AlertCircle, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
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
}

export const DeliveryManagement: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedShop, setSelectedShop] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DeliveryLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

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
        setLines([{ productId: pList[0]?.id || '', quantity: 10 }]);
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
    setLines(prev => [...prev, { productId: products[0]?.id || '', quantity: 5 }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof DeliveryLine, val: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) {
      alert('Please select a target retail shop.');
      return;
    }
    if (lines.length === 0) {
      alert('Please add at least one product item to the delivery.');
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
        notes,
        createdBy: 'Business Owner',
        items: lines.map(l => {
          const prod = products.find(p => p.id === l.productId);
          return {
            productId: l.productId,
            productName: prod ? prod.name : 'Unknown Product',
            productSku: prod ? prod.sku : '',
            quantity: l.quantity
          };
        })
      });

      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 4000);
      setNotes('');
      if (products.length > 0) {
        setLines([{ productId: products[0]?.id || '', quantity: 10 }]);
      }
      await loadAll();
    } catch (err) {
      console.error('Failed to record delivery:', err);
      alert('Error recording delivery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && (shops.length === 0 || products.length === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Record Wholesale Supply Delivery</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logs wholesale stock transfers directly into the immutable stock movements ledger.
          </p>
        </div>

        <Card>
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Prerequisites Required</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              You must add at least one retail shop and one product item before recording deliveries.
            </p>
            <Link to="/management">
              <Button variant="primary" size="sm">
                <Store className="w-3.5 h-3.5 mr-1.5" />
                Go to Catalog & Shops
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Record Wholesale Supply Delivery</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logs wholesale stock transfers directly into the immutable stock movements ledger.
          </p>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-800 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Delivery Logged Successfully!</strong>
            <p className="mt-0.5">Stock has been added to the target retail shop's recorded balance.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Delivery Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Retail Shop
              </label>
              <select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
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
                label="Delivery Date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>
          </div>
        </Card>

        <Card
          title="Product Line Items"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product Line
            </Button>
          }
        >
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                    className="text-right text-xs"
                    required
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Notes or Transport Memo">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Driver name, van vehicle number, or delivery memo notes..."
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            <Truck className="w-4 h-4 mr-2" />
            Confirm & Log Delivery
          </Button>
        </div>
      </form>

      {/* Recent Deliveries Audit Trail */}
      <Card title={`Recent Recorded Deliveries (${recentDeliveries.length})`}>
        {recentDeliveries.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No deliveries recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDeliveries.slice(0, 5).map(deliv => (
              <div key={deliv.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 block">{deliv.shopName}</span>
                  <span className="text-slate-500">{deliv.deliveryDate} • {deliv.items.reduce((s, i) => s + i.quantity, 0)} items delivered</span>
                  {deliv.notes && <span className="text-[11px] text-slate-400 block italic">{deliv.notes}</span>}
                </div>
                <div className="text-right">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium text-[11px]">
                    Delivered
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

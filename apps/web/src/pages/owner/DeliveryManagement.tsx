import React, { useState } from 'react';
import { Truck, Plus, Trash2, CheckCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

interface DeliveryLine {
  productId: string;
  quantity: number;
}

const mockShops = [
  { id: 's1', name: 'Apex Mobiles & Telecom', code: 'SH-01' },
  { id: 's2', name: 'City Point Digital Hub', code: 'SH-02' }
];

const mockCatalog = [
  { id: 'p1', name: 'Shockproof Armor Case (iPhone 15)', sku: 'CASE-IP15-ARM' },
  { id: 'p2', name: '9H 2.5D Tempered Glass (Galaxy S24)', sku: 'TG-S24-9H' },
  { id: 'p3', name: '65W GaN Fast Charger Dual Port', sku: 'CHG-65W-GAN' },
  { id: 'p4', name: 'Braided Type-C to Type-C 100W Cable 1.5m', sku: 'CBL-CC-100W' },
  { id: 'p5', name: 'BassPro Wireless Earbuds BT 5.3', sku: 'AUD-TWS-BPRO' }
];

export const DeliveryManagement: React.FC = () => {
  const [selectedShop, setSelectedShop] = useState(mockShops[0]?.id || '');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DeliveryLine[]>([
    { productId: mockCatalog[0]?.id || '', quantity: 10 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const addLine = () => {
    setLines(prev => [...prev, { productId: mockCatalog[0]?.id || '', quantity: 5 }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof DeliveryLine, val: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      alert('Please add at least one product item to the delivery.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 4000);
      setLines([{ productId: mockCatalog[0]?.id || '', quantity: 10 }]);
      setNotes('');
    }, 600);
  };

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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-800">
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
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              >
                {mockShops.map(s => (
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
                  >
                    {mockCatalog.map(p => (
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
            placeholder="Driver name, van vehicle number, or special delivery instructions..."
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            <Truck className="w-4 h-4 mr-2" />
            Confirm & Log Delivery
          </Button>
        </div>
      </form>
    </div>
  );
};

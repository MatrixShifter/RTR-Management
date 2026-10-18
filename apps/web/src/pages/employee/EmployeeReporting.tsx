import React, { useState } from 'react';
import { 
  Send, 
  History, 
  FileCheck2
} from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';

interface ProductEntry {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantitySold: number;
  physicalCount: number | '';
  availableStock: number;
}

const mockShopProducts: ProductEntry[] = [
  { id: 'p1', name: 'Shockproof Armor Case (iPhone 15)', category: 'Mobile Cases', sku: 'CASE-IP15-ARM', quantitySold: 0, physicalCount: '', availableStock: 10 },
  { id: 'p2', name: '9H 2.5D Tempered Glass (Galaxy S24)', category: 'Tempered Glass', sku: 'TG-S24-9H', quantitySold: 0, physicalCount: '', availableStock: 15 },
  { id: 'p3', name: '65W GaN Fast Charger Dual Port', category: 'Chargers & Adapters', sku: 'CHG-65W-GAN', quantitySold: 0, physicalCount: '', availableStock: 5 },
  { id: 'p4', name: 'Braided Type-C to Type-C 100W Cable 1.5m', category: 'USB Cables', sku: 'CBL-CC-100W', quantitySold: 0, physicalCount: '', availableStock: 8 },
  { id: 'p5', name: 'BassPro Wireless Earbuds BT 5.3', category: 'Earphones & Audio', sku: 'AUD-TWS-BPRO', quantitySold: 0, physicalCount: '', availableStock: 4 }
];

export const EmployeeReporting: React.FC = () => {
  const [products, setProducts] = useState<ProductEntry[]>(mockShopProducts);
  const [isZeroSales, setIsZeroSales] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleQuantityChange = (id: string, qty: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, quantitySold: Math.max(0, qty) };
      }
      return p;
    }));
  };

  const handlePhysicalCountChange = (id: string, countStr: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, physicalCount: countStr === '' ? '' : Math.max(0, parseInt(countStr, 10) || 0) };
      }
      return p;
    }));
  };

  const totalSoldUnits = isZeroSales ? 0 : products.reduce((sum, p) => sum + p.quantitySold, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isZeroSales && totalSoldUnits === 0) {
      alert('Please enter quantity sold for at least one item, or select "Zero Sales Today".');
      return;
    }

    setIsSubmitting(true);
    // Simulate API submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedSuccess(true);
    }, 800);
  };

  if (submittedSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileCheck2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Daily Sales Report Submitted</h2>
        <p className="text-xs text-slate-600 mt-2">
          Your update for <span className="font-semibold text-slate-800">Apex Mobiles & Telecom</span> on {todayStr} has been securely registered.
        </p>
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block text-left text-xs text-slate-700">
          <p><strong>Report Status:</strong> Submitted (Awaiting Owner Review)</p>
          <p><strong>Total Items Sold:</strong> {totalSoldUnits} pcs</p>
          <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSubmittedSuccess(false)}>
            Review Submitted Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-crimpston-electric">
            Today's Shop Update
          </span>
          <h1 className="text-lg font-bold text-slate-900">Apex Mobiles & Telecom (SH-01)</h1>
          <p className="text-xs text-slate-500 mt-0.5">Date: {todayStr} • Daily submission deadline: 21:00</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="warning">Report Due</Badge>
        </div>
      </div>

      {/* Main Reporting Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zero Sales Toggle */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isZeroSales}
              onChange={(e) => setIsZeroSales(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-crimpston-electric focus:ring-crimpston-electric"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Report Zero Sales for Today
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Check this box if no accessories were sold today (e.g. store closed, slow footfall). This explicitly fulfills your reporting duty.
              </span>
            </div>
          </label>
        </div>

        {/* Product Sales & Stock Confirmation */}
        {!isZeroSales && (
          <Card title="Enter Quantities Sold & Confirm Physical Stock">
            <p className="text-xs text-slate-500 mb-4">
              Enter the units sold today. You may optionally enter the remaining physical count on the shelf to confirm stock accuracy.
            </p>
            <div className="divide-y divide-slate-100">
              {products.map(product => {
                const expectedRemaining = product.availableStock - product.quantitySold;
                const hasCount = product.physicalCount !== '';
                const countMatches = hasCount && product.physicalCount === expectedRemaining;

                return (
                  <div key={product.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800">{product.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{product.sku}</span>
                        <span>•</span>
                        <span>Available: <strong className="text-slate-700">{product.availableStock} pcs</strong></span>
                        <span>•</span>
                        <span>Expected after sales: <strong className="text-slate-800">{expectedRemaining} pcs</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Sold Input */}
                      <div className="w-28">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Units Sold <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={product.availableStock}
                          value={product.quantitySold === 0 ? '' : product.quantitySold}
                          placeholder="0"
                          onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value, 10) || 0)}
                          className="text-right font-bold text-slate-900"
                        />
                      </div>

                      {/* Optional Physical Count on Shelf */}
                      <div className="w-28">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Shelf Count
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={product.physicalCount}
                          placeholder={String(expectedRemaining)}
                          onChange={(e) => handlePhysicalCountChange(product.id, e.target.value)}
                          className="text-right text-slate-700"
                        />
                        {hasCount && (
                          <span className={`text-[10px] block mt-0.5 text-right font-semibold ${countMatches ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {countMatches ? '✓ Matches' : `Diff: ${Number(product.physicalCount) - expectedRemaining}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Optional Notes */}
        <Card title="Notes or Discrepancy Remarks (Optional)">
          <textarea
            rows={3}
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Add any specific observations (e.g., customer returns, damaged items on shelf, cash handover details)..."
            className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
          />
        </Card>

        {/* Submission Summary & Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 block">Total Units Sold to Report:</span>
            <span className="text-xl font-bold text-slate-900">
              {isZeroSales ? '0 Units (Zero Sales Declared)' : `${totalSoldUnits} Units`}
            </span>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Daily Report
          </Button>
        </div>
      </form>

      {/* Submission History Section */}
      <Card
        title="Recent Submissions for this Shop"
        action={
          <div className="flex items-center text-xs text-slate-400 gap-1">
            <History className="w-3.5 h-3.5" />
            <span>Traceable History</span>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800">Yesterday (2026-10-17)</span>
              <span className="text-slate-500 block">Reported: 6 units • Reviewed by Rajesh</span>
            </div>
            <Badge variant="success">Approved</Badge>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800">2026-10-16</span>
              <span className="text-slate-500 block">Reported: 0 units (Zero Sales)</span>
            </div>
            <Badge variant="success">Approved</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};

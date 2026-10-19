import React, { useState, useEffect } from 'react';
import { 
  Send, 
  History, 
  FileCheck2,
  PackageOpen,
  Store
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { 
  getShops, 
  calculateStockBalances, 
  getDailyReports, 
  submitDailyReport, 
  type Shop, 
  type DailyReportRecord 
} from '../../services/db.js';

interface ProductEntry {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantitySold: number;
  physicalCount: number | '';
  availableStock: number;
}

export const EmployeeReporting: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [recentReports, setRecentReports] = useState<DailyReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isZeroSales, setIsZeroSales] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const shopList = await getShops();
      setShops(shopList);

      const targetShopId = selectedShopId || (shopList.length > 0 ? (shopList[0]?.id || '') : '');
      if (targetShopId && targetShopId !== selectedShopId) {
        setSelectedShopId(targetShopId);
      }

      if (targetShopId) {
        const balances = await calculateStockBalances(targetShopId);
        setProducts(balances.map(b => ({
          id: b.product_id,
          name: b.product_name,
          category: b.category,
          sku: b.product_sku,
          quantitySold: 0,
          physicalCount: '',
          availableStock: Math.max(0, b.expected_stock)
        })));

        const allReports = await getDailyReports();
        setRecentReports(allReports.filter(r => r.shopId === targetShopId));
      } else {
        setProducts([]);
        setRecentReports([]);
      }
    } catch (err) {
      console.error('Failed to load employee reporting data:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) {
      alert('Please select a retail shop.');
      return;
    }
    if (!isZeroSales && totalSoldUnits === 0) {
      alert('Please enter quantity sold for at least one item, or select "Zero Sales Today".');
      return;
    }

    const currentShop = shops.find(s => s.id === selectedShopId);

    setIsSubmitting(true);
    try {
      await submitDailyReport({
        shopId: selectedShopId,
        shopName: currentShop ? currentShop.name : '',
        reportDate: todayStr,
        isZeroSales,
        status: 'submitted',
        submittedBy: 'Shop Staff',
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: reportNote,
        items: isZeroSales ? [] : products.filter(p => p.quantitySold > 0 || p.physicalCount !== '').map(p => ({
          productId: p.id,
          productName: p.name,
          quantitySold: p.quantitySold,
          physicalCount: p.physicalCount === '' ? null : Number(p.physicalCount)
        })),
        totalQuantitySold: totalSoldUnits
      });

      setSubmittedSuccess(true);
      await loadData();
    } catch (err) {
      console.error('Failed to submit daily report:', err);
      alert('Error submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentShop = shops.find(s => s.id === selectedShopId);

  if (!isLoading && shops.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs text-center py-12 px-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">No Retail Stores Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No retail partner shops are currently configured in the system.
          </p>
          <Link to="/shops">
            <Button variant="primary" size="sm">
              Add Store in Shop Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submittedSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileCheck2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Daily Sales Report Submitted</h2>
        <p className="text-xs text-slate-600 mt-2">
          Your update for <span className="font-semibold text-slate-800">{currentShop?.name || 'Selected Store'}</span> on {todayStr} has been securely registered.
        </p>
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg inline-block text-left text-xs text-slate-700">
          <p><strong>Report Status:</strong> Submitted (Awaiting Owner Review)</p>
          <p><strong>Total Items Sold:</strong> <span className="font-mono tabular-nums">{totalSoldUnits}</span> pcs</p>
          <p><strong>Timestamp:</strong> <span className="font-mono tabular-nums">{new Date().toLocaleTimeString()}</span></p>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSubmittedSuccess(false)}>
            Submit Another Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Info & Shop Selector */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-crimpston-electric">
            Daily Shop Reporting
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="font-bold text-base text-slate-900 bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">Date: {todayStr} • Daily deadline: 21:00</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="warning">Report Due</Badge>
        </div>
      </div>

      {/* Main Reporting Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zero Sales Toggle */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isZeroSales}
              onChange={(e) => setIsZeroSales(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
            {products.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                <PackageOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No products recorded for this store yet</p>
                <p className="text-slate-400 mt-1">Once deliveries are logged for this location, they will appear here for sales tracking.</p>
              </div>
            ) : (
              <>
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
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] tabular-nums">{product.sku}</span>
                            <span>•</span>
                            <span>Available: <strong className="text-slate-700 font-mono tabular-nums">{product.availableStock} pcs</strong></span>
                            <span>•</span>
                            <span>Expected after sales: <strong className="text-slate-800 font-mono tabular-nums">{expectedRemaining} pcs</strong></span>
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
                              className="text-right font-bold font-mono text-slate-900 tabular-nums"
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
                              className="text-right font-mono text-slate-700 tabular-nums"
                            />
                            {hasCount && (
                              <span className={`text-[10px] block mt-0.5 text-right font-semibold font-mono tabular-nums ${countMatches ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {countMatches ? '✓ Matches' : `Diff: ${Number(product.physicalCount) - expectedRemaining}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        )}

        {/* Optional Notes */}
        <Card title="Notes or Discrepancy Remarks (Optional)">
          <textarea
            rows={3}
            value={reportNote}
            onChange={(e) => setReportNote(e.target.value)}
            placeholder="Add any specific observations (e.g., customer returns, damaged items on shelf, cash handover details)..."
            className="w-full text-xs p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </Card>

        {/* Submission Summary & Actions */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 block">Total Units Sold to Report:</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
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
        {recentReports.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No sales reports recorded yet for this shop.
          </div>
        ) : (
          <div className="space-y-3">
            {recentReports.slice(0, 5).map(rep => (
              <div key={rep.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold font-mono text-slate-800 tabular-nums">{rep.reportDate}</span>
                  <span className="text-slate-500 block">
                    Reported: <strong className="font-mono tabular-nums text-slate-700">{rep.isZeroSales ? '0 units (Zero Sales)' : `${rep.totalQuantitySold} units`}</strong> • {rep.submittedBy}
                  </span>
                </div>
                <Badge variant={rep.status === 'approved' ? 'success' : 'warning'}>
                  {rep.status === 'approved' ? 'Approved' : 'Awaiting Review'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

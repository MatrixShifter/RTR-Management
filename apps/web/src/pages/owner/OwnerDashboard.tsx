import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Store, 
  ChevronRight, 
  FileCheck2, 
  Banknote
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import { 
  calculatePaymentStatus, 
  type StockBalance,
  type Invoice, 
  type PaymentRecord 
} from '@crimpston/shared';
import { 
  getShops, 
  getDeliveries, 
  getDailyReports, 
  getInvoices, 
  getPayments, 
  calculateStockBalances, 
  approveDailyReport, 
  type Shop, 
  type DeliveryRecord, 
  type DailyReportRecord 
} from '../../services/db.js';

interface ShopRowSnapshot {
  shop: Shop;
  stockUnits: number;
  totalSupplied: number;
  totalSold: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  paymentStatus: 'fully_paid' | 'partially_paid' | 'unpaid';
  statusLabel: string;
  badgeClasses: { bg: string; text: string; border: string };
  reportedToday: boolean;
}

export const OwnerDashboard: React.FC = () => {
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [shops, setShops] = useState<Shop[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [reports, setReports] = useState<DailyReportRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, dList, rList, iList, pList, bList] = await Promise.all([
        getShops(),
        getDeliveries(),
        getDailyReports(),
        getInvoices(),
        getPayments(),
        calculateStockBalances()
      ]);
      setShops(sList);
      setDeliveries(dList);
      setReports(rList);
      setInvoices(iList);
      setPayments(pList);
      setBalances(bList);
    } catch (err) {
      console.error('Failed to load dashboard operational data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('rtr_data_sync', handleSync);
    return () => window.removeEventListener('rtr_data_sync', handleSync);
  }, []);

  const handleApprove = async (id: string, shopName: string) => {
    await approveDailyReport(id);
    setApprovedNotice(`Report for ${shopName} approved and confirmed into stock ledger.`);
    setTimeout(() => setApprovedNotice(null), 4000);
    await loadData();
  };

  // Filtered dataset
  const filteredDeliveries = selectedShopId === 'all'
    ? deliveries
    : deliveries.filter(d => d.shopId === selectedShopId);

  const filteredReports = selectedShopId === 'all'
    ? reports
    : reports.filter(r => r.shopId === selectedShopId);

  // Operational metrics
  const todayDeliveriesUnits = filteredDeliveries
    .filter(d => d.deliveryDate === todayStr)
    .reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);

  const totalDeliveredUnits = filteredDeliveries
    .reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);

  const todaySalesUnits = filteredReports
    .filter(r => r.reportDate === todayStr && !r.isZeroSales)
    .reduce((sum, r) => sum + r.totalQuantitySold, 0);

  // Pending Actions
  const awaitingReviewList = reports.filter(r => r.status === 'submitted');
  const pendingShops = shops.filter(shop => {
    return !reports.some(r => r.shopId === shop.id && r.reportDate === todayStr);
  });

  // Calculate per-shop snapshot
  const shopSnapshots: ShopRowSnapshot[] = shops.map(shop => {
    const shopBals = balances.filter(b => b.shop_id === shop.id);
    const stockUnits = shopBals.reduce((sum, b) => sum + Math.max(0, b.expected_stock), 0);
    const totalSupplied = shopBals.reduce((sum, b) => sum + b.total_delivered, 0);
    const totalSold = shopBals.reduce((sum, b) => sum + b.confirmed_sold + b.provisional_sold, 0);

    const shopInvoices = invoices.filter(i => i.shop_id === shop.id);
    const shopPayments = payments.filter(p => p.shop_id === shop.id && p.status === 'COMPLETED');
    const totalBilled = shopInvoices.reduce((sum, i) => sum + i.total_amount, 0);
    const totalPaid = shopPayments.reduce((sum, p) => sum + p.amount, 0);
    const statusCalc = calculatePaymentStatus(totalBilled, totalPaid);
    const reportedToday = reports.some(r => r.shopId === shop.id && r.reportDate === todayStr);

    return {
      shop,
      stockUnits,
      totalSupplied,
      totalSold,
      totalBilled,
      totalPaid,
      outstandingBalance: statusCalc.outstandingBalance,
      paymentStatus: statusCalc.status,
      statusLabel: statusCalc.statusLabel,
      badgeClasses: statusCalc.badgeClasses,
      reportedToday
    };
  });

  const totalOutstandingAllShops = shopSnapshots.reduce((sum, s) => sum + s.outstandingBalance, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-slate-200 animate-pulse rounded-md w-1/3"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-24 bg-slate-200 animate-pulse rounded-md"></div>
          <div className="h-24 bg-slate-200 animate-pulse rounded-md"></div>
          <div className="h-24 bg-slate-200 animate-pulse rounded-md"></div>
          <div className="h-24 bg-slate-200 animate-pulse rounded-md"></div>
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Notice upon Approval */}
      {approvedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{approvedNotice}</span>
          </div>
          <button 
            onClick={() => setApprovedNotice(null)} 
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Fast Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Wholesale Operations Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor accessory distribution, missing daily reports, and outstanding shop balances.
          </p>
        </div>

        {/* Quick Action Bar & Shop Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">All Retail Shops</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Link to="/deliveries">
            <Button variant="primary" size="sm" className="shadow-xs font-medium">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Record Delivery</span>
            </Button>
          </Link>
          <Link to="/employee">
            <Button variant="outline" size="sm" className="font-medium">
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Enter Sales</span>
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="outline" size="sm" className="font-medium">
              <Banknote className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Record Payment</span>
            </Button>
          </Link>
          <Link to="/shops">
            <Button variant="outline" size="sm" className="font-medium">
              <Store className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Add Shop</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 1. Concise Operational Summary Bar (No floating cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Today's Deliveries</span>
            <Truck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {todayDeliveriesUnits} pcs
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {todayDeliveriesUnits > 0 ? "Supplied today" : `${totalDeliveredUnits} units all-time`}
          </span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Reported Sales Today</span>
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {todaySalesUnits} pcs
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {todaySalesUnits > 0 ? "Units sold across stores" : "No sales reported yet"}
          </span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Action Required</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {pendingShops.length + awaitingReviewList.length}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {pendingShops.length} missing • {awaitingReviewList.length} to review
          </span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Balance Due</span>
            <Banknote className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums font-mono">
            ₹{totalOutstandingAllShops.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Across {shops.length} partner stores
          </span>
        </div>
      </div>

      {/* 2. Priority Action Center: Review Queue & Missing Daily Reports */}
      {(awaitingReviewList.length > 0 || pendingShops.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Review Queue: Reports Awaiting Approval */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-amber-50/40 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Reports Awaiting Owner Review ({awaitingReviewList.length})
                </h3>
              </div>
              <Badge variant="warning" size="sm">Requires Confirmation</Badge>
            </div>
            
            <div className="divide-y divide-slate-100 flex-1">
              {awaitingReviewList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Review queue is clear. No reports pending confirmation.
                </div>
              ) : (
                awaitingReviewList.map(item => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">{item.shopName}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{item.reportDate}</span>
                      </div>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        Sold: <strong className="text-slate-800">{item.isZeroSales ? '0 (Zero Sales)' : `${item.totalQuantitySold} pcs`}</strong> • Staff: {item.submittedBy}
                      </span>
                    </div>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleApprove(item.id, item.shopName || 'Shop')}
                    >
                      Approve & Post
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missing Daily Reports */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Missing Daily Reports Today ({pendingShops.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Cutoff: 21:00 IST</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto flex-1">
              {pendingShops.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  All active shops have submitted reports for today!
                </div>
              ) : (
                pendingShops.map(shop => (
                  <div key={shop.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{shop.name}</span>
                      <span className="text-slate-400 font-mono text-[11px] ml-1.5">({shop.code})</span>
                    </div>
                    <Link to="/employee">
                      <Button variant="outline" size="sm">
                        Enter Report
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* 3. Core Shop Ledger & Payment Balance Snapshot Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Retail Stores Ledger & Payment Balances
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live stock on-site, total billed, collections, and payment statuses across partner shops.
            </p>
          </div>
          <Link to="/shops" className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center">
            <span>Manage All Shops</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>

        {shops.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No retail stores found. <Link to="/shops" className="text-blue-600 underline font-semibold">Add your first shop</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Shop Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-right">On-Hand Stock</th>
                  <th className="py-2.5 px-3 text-right">Supplied</th>
                  <th className="py-2.5 px-3 text-right">Sold</th>
                  <th className="py-2.5 px-3 text-right font-mono">Billed</th>
                  <th className="py-2.5 px-3 text-right font-mono">Collected</th>
                  <th className="py-2.5 px-3 text-right font-mono font-bold">Outstanding</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shopSnapshots.map(row => (
                  <tr key={row.shop.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3.5 font-semibold text-slate-900">
                      <Link to="/shops" className="hover:text-blue-600 transition-colors">
                        {row.shop.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {row.shop.code}
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-blue-600">
                      {row.stockUnits} pcs
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                      {row.totalSupplied}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                      {row.totalSold}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-mono text-slate-600">
                      ₹{row.totalBilled.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-mono text-emerald-700">
                      ₹{row.totalPaid.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-slate-900">
                      ₹{row.outstandingBalance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${row.badgeClasses.bg} ${row.badgeClasses.text} ${row.badgeClasses.border}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link to="/shops">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Workspace
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Recent Delivery Activity Log */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Supply Deliveries
            </h3>
          </div>
          <Link to="/deliveries" className="text-xs text-blue-600 hover:underline font-medium">
            View All Deliveries →
          </Link>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No supply deliveries recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3">Target Retail Shop</th>
                  <th className="py-2.5 px-3">Batch Reference</th>
                  <th className="py-2.5 px-3 text-right">Quantity Delivered</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.slice(0, 5).map(deliv => (
                  <tr key={deliv.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3.5 font-mono text-slate-700">{deliv.deliveryDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{deliv.shopName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{deliv.notes || `Supply Batch #${deliv.id.slice(-6)}`}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                      {deliv.items.reduce((s, i) => s + i.quantity, 0)} units
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="success" size="sm">Delivered</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

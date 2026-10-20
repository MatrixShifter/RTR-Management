import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ErrorState } from '../../components/ui/StateViews.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
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
  getProducts,
  getStockAudits,
  getStockTransfers,
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

export interface OwnerDashboardProps {
  initialLoading?: boolean;
  initialError?: string | null;
  initialShops?: Shop[];
  initialDeliveries?: DeliveryRecord[];
  initialReports?: DailyReportRecord[];
  initialInvoices?: Invoice[];
  initialPayments?: PaymentRecord[];
  initialBalances?: StockBalance[];
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  initialLoading,
  initialError = null,
  initialShops,
  initialDeliveries,
  initialReports,
  initialInvoices,
  initialPayments,
  initialBalances
}) => {
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [shops, setShops] = useState<Shop[]>(initialShops ?? []);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(initialDeliveries ?? []);
  const [reports, setReports] = useState<DailyReportRecord[]>(initialReports ?? []);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices ?? []);
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments ?? []);
  const [balances, setBalances] = useState<StockBalance[]>(initialBalances ?? []);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(initialLoading ?? (initialShops === undefined));
  const [error, setError] = useState<string | null>(initialError);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sList, dList, rList, iList, pList, aList, tList, prodList] = await Promise.all([
        getShops(),
        getDeliveries(),
        getDailyReports(),
        getInvoices(),
        getPayments(),
        getStockAudits(),
        getStockTransfers(),
        getProducts()
      ]);

      const bList = await calculateStockBalances(undefined, {
        shops: sList,
        products: prodList,
        deliveries: dList,
        reports: rList,
        transfers: tList,
        audits: aList
      });

      setShops(sList || []);
      setDeliveries(dList || []);
      setReports(rList || []);
      setInvoices(iList || []);
      setPayments(pList || []);
      setBalances(bList || []);
    } catch (err: any) {
      console.error('Failed to load dashboard operational data:', err);
      setError(err?.message || 'Failed to load wholesale operations overview. Please check network connectivity and retry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialShops !== undefined) return;
    loadData();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 300);
    };

    window.addEventListener('rtr_data_sync', handleSync);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('rtr_data_sync', handleSync);
    };
  }, [loadData, initialShops]);

  const handleApprove = async (id: string, shopName: string) => {
    try {
      await approveDailyReport(id);
      setApprovedNotice(`Report for ${shopName} approved and confirmed into stock ledger.`);
      setTimeout(() => setApprovedNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error('Failed to approve report:', err);
    }
  };

  // Filtered dataset
  const filteredDeliveries = useMemo(() => {
    if (selectedShopId === 'all') return deliveries;
    return deliveries.filter(d => d.shopId === selectedShopId);
  }, [deliveries, selectedShopId]);

  const filteredReports = useMemo(() => {
    if (selectedShopId === 'all') return reports;
    return reports.filter(r => r.shopId === selectedShopId);
  }, [reports, selectedShopId]);

  // Operational metrics
  const todayDeliveriesUnits = useMemo(() => {
    return filteredDeliveries
      .filter(d => d && d.deliveryDate === todayStr)
      .reduce((sum, d) => sum + (Array.isArray(d.items) ? d.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0), 0);
  }, [filteredDeliveries, todayStr]);

  const totalDeliveredUnits = useMemo(() => {
    return filteredDeliveries
      .reduce((sum, d) => sum + (Array.isArray(d.items) ? d.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0), 0);
  }, [filteredDeliveries]);

  const todaySalesUnits = useMemo(() => {
    return filteredReports
      .filter(r => r && r.reportDate === todayStr && !r.isZeroSales)
      .reduce((sum, r) => sum + (Number(r.totalQuantitySold) || 0), 0);
  }, [filteredReports, todayStr]);

  // Pending Actions
  const awaitingReviewList = useMemo(() => {
    return (reports || []).filter(r => r && r.status === 'submitted');
  }, [reports]);

  const pendingShops = useMemo(() => {
    return (shops || []).filter(shop => {
      return !(reports || []).some(r => r && r.shopId === shop.id && r.reportDate === todayStr);
    });
  }, [shops, reports, todayStr]);

  // Calculate per-shop snapshot
  const shopSnapshots = useMemo<ShopRowSnapshot[]>(() => {
    const targetShops = selectedShopId === 'all'
      ? (shops || [])
      : (shops || []).filter(s => s.id === selectedShopId);

    return targetShops.map(shop => {
      const shopBals = (balances || []).filter(b => b && b.shop_id === shop.id);
      const stockUnits = shopBals.reduce((sum, b) => sum + Math.max(0, Number(b.expected_stock) || 0), 0);
      const totalSupplied = shopBals.reduce((sum, b) => sum + (Number(b.total_delivered) || 0), 0);
      const totalSold = shopBals.reduce((sum, b) => sum + ((Number(b.confirmed_sold) || 0) + (Number(b.provisional_sold) || 0)), 0);

      const shopInvoices = (invoices || []).filter(i => i && i.shop_id === shop.id);
      const shopPayments = (payments || []).filter(p => p && p.shop_id === shop.id && p.status === 'COMPLETED');
      const totalBilled = shopInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
      const totalPaid = shopPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const statusCalc = calculatePaymentStatus(totalBilled, totalPaid);
      const reportedToday = (reports || []).some(r => r && r.shopId === shop.id && r.reportDate === todayStr);

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
  }, [shops, balances, invoices, payments, reports, selectedShopId, todayStr]);

  const totalOutstandingAllShops = useMemo(() => {
    return shopSnapshots.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);
  }, [shopSnapshots]);

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

  if (error && shops.length === 0) {
    return (
      <div className="py-8">
        <ErrorState
          message={error}
          onRetry={() => loadData()}
        />
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

      {/* Complete Empty State when no shops exist */}
      {shops.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <EmptyState
            icon={Store}
            title="No Retail Stores Registered"
            description="Your wholesale workspace is active. Register your partner retail shops to start tracking stock ledger, accessories deliveries, and daily revenue collection."
            actionText="Register First Shop"
            onAction={() => window.location.assign('/shops')}
          />
        </div>
      ) : (
        <>
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${row.badgeClasses?.bg || 'bg-slate-100'} ${row.badgeClasses?.text || 'text-slate-700'} ${row.badgeClasses?.border || 'border-slate-200'}`}>
                          {row.statusLabel || 'Unpaid'}
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
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{deliv.shopName || 'Retail Store'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{deliv.notes || (deliv.id ? `Supply Batch #${deliv.id.slice(-6)}` : 'Supply Batch')}</td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                          {(deliv.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} units
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
        </>
      )}

    </div>
  );
};

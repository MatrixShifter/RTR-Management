import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Store,
  ChevronRight,
  Filter,
  FileCheck2,
  Banknote,
  Boxes
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton.js';
import { 
  getShops, 
  getDeliveries, 
  getDailyReports, 
  approveDailyReport, 
  type Shop, 
  type DeliveryRecord, 
  type DailyReportRecord 
} from '../../services/db.js';

export const OwnerDashboard: React.FC = () => {
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [shops, setShops] = useState<Shop[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [reports, setReports] = useState<DailyReportRecord[]>([]);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, dList, rList] = await Promise.all([
        getShops(),
        getDeliveries(),
        getDailyReports()
      ]);
      setShops(sList);
      setDeliveries(dList);
      setReports(rList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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
    setApprovedNotice(`Report for ${shopName} approved and confirmed in inventory ledger.`);
    setTimeout(() => setApprovedNotice(null), 4000);
    await loadData();
  };

  // Filtered dataset
  const filteredShops = selectedShopId === 'all'
    ? shops
    : shops.filter(s => s.id === selectedShopId);

  const filteredDeliveries = selectedShopId === 'all'
    ? deliveries
    : deliveries.filter(d => d.shopId === selectedShopId);

  const filteredReports = selectedShopId === 'all'
    ? reports
    : reports.filter(r => r.shopId === selectedShopId);

  // Dynamic Calculations
  const todayDeliveriesUnits = filteredDeliveries
    .filter(d => d.deliveryDate === todayStr)
    .reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);

  const totalDeliveredUnits = filteredDeliveries
    .reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);

  const todaySalesUnits = filteredReports
    .filter(r => r.reportDate === todayStr && !r.isZeroSales)
    .reduce((sum, r) => sum + r.totalQuantitySold, 0);

  // Awaiting review
  const awaitingReviewList = filteredReports.filter(r => r.status === 'submitted');

  // Shops pending report submission today
  const pendingShops = filteredShops.filter(shop => {
    const hasReportToday = reports.some(r => r.shopId === shop.id && r.reportDate === todayStr);
    return !hasReportToday;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Notice upon Approval */}
      {approvedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{approvedNotice}</span>
          </div>
          <button 
            onClick={() => setApprovedNotice(null)} 
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-crimpston-electric mb-1">
            <Store className="w-3.5 h-3.5" />
            <span>Operational Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Business Overview & Control</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time accessory distribution, reporting cutoffs, and verified stock movements.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Shop Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="bg-transparent focus:outline-none font-semibold cursor-pointer text-slate-800"
              aria-label="Filter by Retail Shop"
            >
              <option value="all">All Retail Stores ({shops.length})</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Record Delivery CTA */}
          <Link to="/deliveries">
            <Button 
              variant="primary" 
              size="md" 
              className="shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Record Delivery
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Primary KPI Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Deliveries"
          value={`${todayDeliveriesUnits} Units`}
          subtext={todayDeliveriesUnits > 0 ? "Supplied today" : `${totalDeliveredUnits} units all-time`}
          icon={<Truck className="w-4 h-4 text-crimpston-electric" />}
          variant="highlight"
        />
        <MetricCard
          label="Reported Sales Today"
          value={`${todaySalesUnits} Units`}
          subtext={todaySalesUnits > 0 ? "Units sold across stores" : "No sales reported yet today"}
          icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Reports Pending"
          value={pendingShops.length}
          subtext={pendingShops.length > 0 ? `${pendingShops.length} shops due by 21:00` : "All shops submitted today"}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          variant={pendingShops.length > 0 ? 'alert' : 'default'}
        />
        <MetricCard
          label="Awaiting Approval"
          value={awaitingReviewList.length}
          subtext={awaitingReviewList.length > 0 ? "Requires owner stock confirmation" : "Review queue clear"}
          icon={<FileCheck2 className="w-4 h-4 text-crimpston-electric" />}
          variant={awaitingReviewList.length > 0 ? 'highlight' : 'default'}
        />
      </div>

      {/* Section 1: Pending Work & Missing Daily Reports */}
      <Card
        title="Pending Reports & Duty Monitoring"
        action={
          <Badge variant={pendingShops.length > 0 ? 'warning' : 'success'}>
            {pendingShops.length > 0 ? `${pendingShops.length} Stores Due` : 'All Reports Current'}
          </Badge>
        }
      >
        {pendingShops.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {shops.length === 0 ? (
              <div>
                <span>No shops configured yet. </span>
                <Link to="/management" className="text-crimpston-electric underline font-semibold">
                  Add retail stores
                </Link>
              </div>
            ) : (
              'All retail shops have submitted their updates for today.'
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingShops.map(shop => (
              <div key={shop.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800">{shop.name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({shop.code})</span>
                    <Badge variant="warning">Missing Today</Badge>
                  </div>
                  <span className="text-slate-500 mt-1 block">
                    Daily cutoff: 21:00 IST • Date: {todayStr}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Link to="/employee">
                    <Button variant="outline" size="sm">
                      Submit for Shop
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Section 2: Review Queue — Reports Awaiting Approval */}
      <Card
        title="Review Queue — Reports Awaiting Owner Approval"
        action={
          <Badge variant={awaitingReviewList.length > 0 ? 'info' : 'neutral'}>
            {awaitingReviewList.length} Pending Approval
          </Badge>
        }
      >
        {awaitingReviewList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No sales reports currently awaiting review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Submitted By</th>
                  <th className="py-2.5 px-3 text-right">Items Sold</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {awaitingReviewList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {item.shopName}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.reportDate} <span className="text-slate-400 text-[10px]">({item.submittedAt})</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.submittedBy}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {item.isZeroSales ? (
                        <span className="text-slate-500 font-normal italic">0 (Zero Sales)</span>
                      ) : (
                        `${item.totalQuantitySold} pcs`
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant="warning">Awaiting Approval</Badge>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => handleApprove(item.id, item.shopName || 'Shop')}
                      >
                        Approve & Post
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/stock-ledger"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-crimpston-electric border border-blue-100 flex items-center justify-center transition-colors group-hover:bg-crimpston-electric group-hover:text-white">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Stock Ledger
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Multi-shop balance reconciliation</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/payments"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Cash Payments
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Record collections & audit balances</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/management"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors group-hover:bg-crimpston-navy group-hover:text-white">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Shops & Catalog
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Configure locations & products</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
};

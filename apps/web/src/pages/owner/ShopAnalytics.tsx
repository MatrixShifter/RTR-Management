import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Store, 
  TrendingUp, 
  Boxes, 
  Truck, 
  Banknote, 
  Printer, 
  Download, 
  AlertTriangle, 
  ChevronRight, 
  Package, 
  Filter
} from 'lucide-react';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton.js';
import { 
  type DateRangePreset,
  type ShopBusinessSummary,
  type ProductHistoryItem,
  type CategorySalesAnalytics,
  type TimelineEvent,
  getDateRangeFromPreset
} from '@crimpston/shared';
import { 
  getShops, 
  getShopHistoricalSummary, 
  getShopProductHistory, 
  getShopCategoryAnalytics, 
  getShopTimelineEvents,
  type Shop 
} from '../../services/db.js';

export const ShopAnalytics: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [shopSearch, setShopSearch] = useState('');
  
  // Date Range Presets
  const [preset, setPreset] = useState<DateRangePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'categories' | 'timeline' | 'payments'>('overview');

  // Loaded Data States
  const [summary, setSummary] = useState<ShopBusinessSummary | null>(null);
  const [products, setProducts] = useState<ProductHistoryItem[]>([]);
  const [categories, setCategories] = useState<CategorySalesAnalytics[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters within views
  const [productSearch, setProductSearch] = useState('');
  const [categorySortBy, setCategorySortBy] = useState<'sold' | 'revenue' | 'profit'>('revenue');
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [timelinePage, setTimelinePage] = useState(1);
  const pageSize = 10;

  // Modals for Drilldown
  const [selectedProductDetails, setSelectedProductDetails] = useState<ProductHistoryItem | null>(null);
  const [selectedEventDetails, setSelectedEventDetails] = useState<TimelineEvent | null>(null);

  // Computed Date Range
  const dateRange = useMemo(() => {
    return getDateRangeFromPreset(preset, customStart, customEnd);
  }, [preset, customStart, customEnd]);

  // Load shops on mount
  useEffect(() => {
    const initShops = async () => {
      const sList = await getShops();
      setShops(sList);
      if (sList.length > 0 && !selectedShopId) {
        setSelectedShopId(sList[0]?.id || '');
      }
    };
    initShops();
  }, []);

  // Load Shop Analytics Data whenever selectedShopId or dateRange changes
  useEffect(() => {
    if (!selectedShopId) {
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const [sum, prodList, catList, timeEvents] = await Promise.all([
          getShopHistoricalSummary(selectedShopId, dateRange.startDate, dateRange.endDate),
          getShopProductHistory(selectedShopId, dateRange.startDate, dateRange.endDate),
          getShopCategoryAnalytics(selectedShopId, dateRange.startDate, dateRange.endDate),
          getShopTimelineEvents(selectedShopId, dateRange.startDate, dateRange.endDate)
        ]);
        setSummary(sum);
        setProducts(prodList);
        setCategories(catList);
        setTimeline(timeEvents);
        setTimelinePage(1);
      } catch (err) {
        console.error('Failed to load shop analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [selectedShopId, dateRange]);

  // Filtered Shops for Selector Autocomplete
  const filteredShops = useMemo(() => {
    if (!shopSearch.trim()) return shops;
    const q = shopSearch.toLowerCase();
    return shops.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [shops, shopSearch]);

  const currentShop = shops.find(s => s.id === selectedShopId);

  // Filtered Products Table
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, productSearch]);

  // Sorted Categories
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (categorySortBy === 'sold') return b.quantitySold - a.quantitySold;
      if (categorySortBy === 'profit') return (b.grossProfit || 0) - (a.grossProfit || 0);
      return b.salesRevenue - a.salesRevenue;
    });
  }, [categories, categorySortBy]);

  // Filtered & Paginated Timeline
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'all') return timeline;
    return timeline.filter(t => t.type === timelineFilter);
  }, [timeline, timelineFilter]);

  const paginatedTimeline = useMemo(() => {
    const start = (timelinePage - 1) * pageSize;
    return filteredTimeline.slice(start, start + pageSize);
  }, [filteredTimeline, timelinePage]);

  const totalTimelinePages = Math.ceil(filteredTimeline.length / pageSize) || 1;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!summary || !currentShop) return;

    let csv = `RTR WHOLESALE MANAGEMENT - SHOP BUSINESS REPORT\n`;
    csv += `Shop Name:,${currentShop.name} (${currentShop.code})\n`;
    csv += `Reporting Period:,${dateRange.label} (${dateRange.startDate} to ${dateRange.endDate})\n`;
    csv += `Generated At:,${new Date().toLocaleString()}\n\n`;

    csv += `KEY PERFORMANCE SUMMARY\n`;
    csv += `Total Deliveries:,${summary.deliveriesCount}\n`;
    csv += `Total Units Delivered:,${summary.totalDeliveredUnits}\n`;
    csv += `Total Units Sold:,${summary.totalSoldUnits}\n`;
    csv += `Current Expected Shelf Stock:,${summary.expectedRemainingStock}\n`;
    csv += `Stock Discrepancy:,${summary.totalDiscrepancy}\n`;
    csv += `Total Sales Revenue:,Rs. ${summary.salesRevenue}\n`;
    csv += `Cost of Goods Sold:,${summary.costOfGoodsSold !== null ? `Rs. ${summary.costOfGoodsSold}` : 'Missing Cost Data'}\n`;
    csv += `Gross Profit:,${summary.grossProfit !== null ? `Rs. ${summary.grossProfit}` : 'Missing Cost Data'}\n`;
    csv += `Total Invoiced Due:,Rs. ${summary.totalInvoiced}\n`;
    csv += `Total Payments Received:,Rs. ${summary.totalPayments}\n`;
    csv += `Outstanding Balance:,Rs. ${summary.outstandingBalance}\n`;
    csv += `Payment Status:,${summary.paymentStatus.toUpperCase()}\n\n`;

    csv += `PRODUCT WISE PERFORMANCE\n`;
    csv += `SKU,Product Name,Category,Delivered,Sold,Remaining,Unit Price,Cost Price,Revenue,COGS,Gross Profit\n`;
    products.forEach(p => {
      csv += `"${p.sku}","${p.productName}","${p.category}",${p.deliveredInPeriod},${p.soldInPeriod},${p.currentRemainingStock},${p.unitPrice},${p.costPrice !== null ? p.costPrice : 'N/A'},${p.salesRevenue},${p.cogs !== null ? p.cogs : 'N/A'},${p.grossProfit !== null ? p.grossProfit : 'N/A'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RTR_${currentShop.code}_History_${dateRange.startDate}_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (shops.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={Store}
        title="No retail partner shops available"
        description="Add shops in Catalog & Shops management before analyzing historical performance."
        action={
          <Button onClick={() => window.location.href = '/management'}>
            Manage Shops
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Shop Selection Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-crimpston-electric mb-1">
              <Store className="w-3.5 h-3.5" />
              <span>Historical Reporting & Profit Analytics</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {currentShop ? `${currentShop.name} History & Analytics` : 'Shop History & Analytics'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete historical records without time limits. Search sales, categories, cash collections, and real profits.
            </p>
          </div>

          {/* Export & Print Actions */}
          <div className="flex items-center space-x-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!summary}>
              <Download className="w-4 h-4 mr-1.5 text-slate-500" />
              <span>Export CSV</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint} disabled={!summary}>
              <Printer className="w-4 h-4 mr-1.5" />
              <span>Print / PDF</span>
            </Button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100 print:hidden">
          {/* Shop Selector with Autocomplete Search */}
          <div className="md:col-span-5 relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-600">Select Retail Shop</label>
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  placeholder="Filter shops..."
                  className="text-[11px] pl-6 pr-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-crimpston-electric w-32"
                />
              </div>
            </div>
            <div className="relative">
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-crimpston-electric text-slate-800"
              >
                {filteredShops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {s.isActive ? '' : '• Inactive'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Preset Selector */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Historical Period</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as DateRangePreset)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-crimpston-electric text-slate-800"
            >
              <option value="all_time">All Time (Complete History)</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="last_1_year">Last 1 Year</option>
              <option value="last_2_years">Last 2 Years</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Active Period Label */}
          <div className="md:col-span-3 flex items-end">
            <div className="w-full py-2 px-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-center justify-between">
              <span className="font-semibold">{dateRange.label}</span>
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Custom Date Pickers (Shown only when preset === 'custom') */}
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 print:hidden animate-fade-in">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full text-xs p-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full text-xs p-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        {[
          { id: 'overview', label: 'Business Summary' },
          { id: 'products', label: `Product History (${products.length})` },
          { id: 'categories', label: `Category Sales (${categories.length})` },
          { id: 'timeline', label: `Transaction Timeline (${timeline.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-crimpston-navy text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={5} />
        </div>
      ) : !summary ? (
        <EmptyState
          icon={Store}
          title="No records found for this shop"
          description="There are no supply deliveries, daily sales, or payments recorded for this store."
        />
      ) : (
        <>
          {/* TAB 1: OVERVIEW & BUSINESS SUMMARY */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Primary Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Total Delivered Units"
                  value={`${summary.totalDeliveredUnits} pcs`}
                  subtext={`Across ${summary.deliveriesCount} supply batches`}
                  icon={<Truck className="w-5 h-5 text-slate-500" />}
                />
                <MetricCard
                  label="Total Sold Units"
                  value={`${summary.totalSoldUnits} pcs`}
                  subtext="Recorded in daily sales reports"
                  icon={<Boxes className="w-5 h-5 text-slate-500" />}
                />
                <MetricCard
                  label="Expected Shelf Stock"
                  value={`${summary.expectedRemainingStock} pcs`}
                  subtext={summary.totalDiscrepancy !== 0 ? `Audit discrepancy: ${summary.totalDiscrepancy > 0 ? '+' : ''}${summary.totalDiscrepancy} pcs` : 'Physical count matches ledger'}
                  icon={<Package className="w-5 h-5 text-slate-500" />}
                />
                <MetricCard
                  label="Outstanding Balance"
                  value={`₹${summary.outstandingBalance.toLocaleString('en-IN')}`}
                  subtext={`Total Invoiced: ₹${summary.totalInvoiced.toLocaleString('en-IN')}`}
                  icon={<Banknote className="w-5 h-5 text-slate-500" />}
                  trend={summary.paymentStatus === 'fully_paid' ? 'Fully Paid' : summary.paymentStatus === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                />
              </div>

              {/* Financial Health & Accurate Profit Analytics Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Profit & Revenue Recognition</h2>
                        <p className="text-xs text-slate-500">Gross profit = Sales Revenue − Cost of Goods Sold</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Recognized Sales Revenue</span>
                      <span className="text-lg font-bold text-slate-900 block mt-1">
                        ₹{summary.salesRevenue.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400">From verified sold units</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Cost of Goods Sold (COGS)</span>
                      <span className="text-lg font-bold text-slate-900 block mt-1">
                        {summary.costOfGoodsSold !== null ? `₹${summary.costOfGoodsSold.toLocaleString('en-IN')}` : 'Missing'}
                      </span>
                      <span className="text-[10px] text-slate-400">Based on catalog purchase cost</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Gross Profit</span>
                      <span className="text-lg font-bold text-emerald-700 block mt-1">
                        {summary.grossProfit !== null ? `₹${summary.grossProfit.toLocaleString('en-IN')}` : 'Unavailable'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {summary.grossMarginPercent !== null ? `${summary.grossMarginPercent}% profit margin` : 'Missing cost basis'}
                      </span>
                    </div>
                  </div>

                  {summary.profitStatus === 'missing_cost_data' && (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start space-x-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">Profit unavailable — cost data missing.</span> One or more products sold in this period do not have a purchase cost price recorded in the catalog. To maintain accounting integrity, profit figures are not fabricated.
                      </div>
                    </div>
                  )}
                </div>

                {/* Cash Collections & Payment Tracking Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Payment Accounting</h2>
                      <p className="text-xs text-slate-500">Cash & digital collections</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Total Billed / Invoiced:</span>
                      <span className="font-bold text-slate-900">₹{summary.totalInvoiced.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Total Payments Received:</span>
                      <span className="font-bold text-emerald-600">₹{summary.totalPayments.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Remaining Outstanding:</span>
                      <span className="font-bold text-slate-900">₹{summary.outstandingBalance.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-500">Settlement Status:</span>
                      <Badge variant={summary.paymentStatus === 'fully_paid' ? 'success' : summary.paymentStatus === 'partially_paid' ? 'warning' : 'neutral'}>
                        {summary.paymentStatus === 'fully_paid' ? 'Fully Paid' : summary.paymentStatus === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT-WISE HISTORY */}
          {activeTab === 'products' && (
            <Card title="Product-Wise Sales & Remaining Shelf Inventory">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="relative max-w-sm w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search product name, SKU, or category..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
                  />
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Showing {filteredProducts.length} catalog items
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No products matched the search query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                      <tr>
                        <th className="py-3 px-3">SKU & Item</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Delivered</th>
                        <th className="py-3 px-3 text-right">Sold</th>
                        <th className="py-3 px-3 text-right">Remaining</th>
                        <th className="py-3 px-3 text-right">Audit Var</th>
                        <th className="py-3 px-3 text-right">Revenue</th>
                        <th className="py-3 px-3 text-right">Gross Profit</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(p => (
                        <tr key={p.productId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-700 block text-[11px]">{p.sku}</span>
                            <span className="font-semibold text-slate-900 block">{p.productName}</span>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="neutral" size="sm">{p.category}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-700">{p.deliveredInPeriod} pcs</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">{p.soldInPeriod} pcs</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-bold ${p.currentRemainingStock <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                              {p.currentRemainingStock} pcs
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {p.discrepancy !== null ? (
                              <span className={`font-semibold ${p.discrepancy < 0 ? 'text-rose-600' : p.discrepancy > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {p.discrepancy >= 0 ? `+${p.discrepancy}` : p.discrepancy}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900">
                            ₹{p.salesRevenue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {p.grossProfit !== null ? (
                              <span className="font-bold text-emerald-700">₹{p.grossProfit.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-[10px] text-amber-700 italic">No cost</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedProductDetails(p)}
                              title="Inspect Product History"
                            >
                              <ChevronRight className="w-4 h-4 text-slate-400 hover:text-slate-700" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: CATEGORY-WISE ANALYTICS */}
          {activeTab === 'categories' && (
            <Card title="Category Performance Breakdown">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <p className="text-xs text-slate-500">
                  Aggregated distribution, sales volume, revenue, and gross profit by product category.
                </p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-medium">Sort by:</span>
                  <select
                    value={categorySortBy}
                    onChange={(e) => setCategorySortBy(e.target.value as typeof categorySortBy)}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="revenue">Sales Revenue</option>
                    <option value="sold">Units Sold</option>
                    <option value="profit">Gross Profit</option>
                  </select>
                </div>
              </div>

              {sortedCategories.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No category records available for this store.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedCategories.map(cat => (
                    <div key={cat.category} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {cat.category.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{cat.category}</h3>
                            <span className="text-[11px] text-slate-400">{cat.productCount} catalog products</span>
                          </div>
                        </div>
                        <Badge variant="neutral">{cat.remainingStock} pcs in stock</Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">Delivered</span>
                          <span className="text-xs font-bold text-slate-800">{cat.quantityDelivered} pcs</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">Sold</span>
                          <span className="text-xs font-bold text-slate-900">{cat.quantitySold} pcs</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">Revenue</span>
                          <span className="text-xs font-bold text-slate-900">₹{cat.salesRevenue.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                        <span className="text-emerald-900 font-medium">Gross Profit:</span>
                        <span className="font-bold text-emerald-800">
                          {cat.grossProfit !== null ? `₹${cat.grossProfit.toLocaleString('en-IN')} (${cat.grossMarginPercent}% margin)` : 'Missing cost basis'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB 4: TRANSACTION TIMELINE */}
          {activeTab === 'timeline' && (
            <Card title="Shop Historical Transaction Timeline">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <p className="text-xs text-slate-500">
                  Chronological journal of deliveries, daily reports, payments, transfers, and physical audits.
                </p>
                <div className="flex items-center space-x-2 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={timelineFilter}
                    onChange={(e) => {
                      setTimelineFilter(e.target.value);
                      setTimelinePage(1);
                    }}
                    className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="all">All Event Types</option>
                    <option value="delivery">Deliveries Only</option>
                    <option value="sale_report">Sales Reports Only</option>
                    <option value="payment">Payments Only</option>
                    <option value="transfer">Stock Transfers</option>
                    <option value="audit">Stock Audits</option>
                  </select>
                </div>
              </div>

              {paginatedTimeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No transaction events match the selected filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedTimeline.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventDetails(evt)}
                      className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 mt-0.5">
                          {evt.type === 'delivery' && '🚚'}
                          {evt.type === 'sale_report' && '📋'}
                          {evt.type === 'payment' && '💵'}
                          {evt.type === 'transfer' && '🔄'}
                          {evt.type === 'audit' && '🔍'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                            <Badge variant={evt.badgeVariant} size="sm">{evt.type.replace('_', ' ').toUpperCase()}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{evt.summary}</p>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            📅 {evt.date} • By {evt.responsibleUser}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {evt.amount !== null && (
                          <span className="text-xs font-bold text-emerald-600 block">
                            ₹{evt.amount.toLocaleString('en-IN')}
                          </span>
                        )}
                        {evt.quantity !== null && (
                          <span className="text-xs font-semibold text-slate-700 block">
                            {evt.quantity > 0 ? `+${evt.quantity}` : evt.quantity} pcs
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 inline mt-1" />
                      </div>
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {totalTimelinePages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <span>Page {timelinePage} of {totalTimelinePages}</span>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={timelinePage <= 1}
                          onClick={() => setTimelinePage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={timelinePage >= totalTimelinePages}
                          onClick={() => setTimelinePage(p => Math.min(totalTimelinePages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Drilldown Modal: Product Detail History */}
      {selectedProductDetails && (
        <Modal
          isOpen={Boolean(selectedProductDetails)}
          onClose={() => setSelectedProductDetails(null)}
          title={`Product History: ${selectedProductDetails.productName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">SKU:</span>
                <span className="font-mono font-bold text-slate-800">{selectedProductDetails.sku}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Category:</span>
                <span className="font-semibold text-slate-800">{selectedProductDetails.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Catalog Selling Price:</span>
                <span className="font-bold text-slate-800">₹{selectedProductDetails.unitPrice}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Catalog Cost Price:</span>
                <span className="font-bold text-slate-800">
                  {selectedProductDetails.costPrice !== null ? `₹${selectedProductDetails.costPrice}` : 'Missing cost basis'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Period Movement Totals</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Delivered</span>
                  <span className="font-bold text-slate-800">{selectedProductDetails.deliveredInPeriod} pcs</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Sold</span>
                  <span className="font-bold text-slate-900">{selectedProductDetails.soldInPeriod} pcs</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Expected Shelf</span>
                  <span className="font-bold text-emerald-700">{selectedProductDetails.currentRemainingStock} pcs</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 space-y-1">
              <div className="flex justify-between font-medium text-blue-900">
                <span>Revenue from this item:</span>
                <span className="font-bold">₹{selectedProductDetails.salesRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-blue-800">
                <span>Cost of Goods Sold (COGS):</span>
                <span>{selectedProductDetails.cogs !== null ? `₹${selectedProductDetails.cogs.toLocaleString('en-IN')}` : 'Unavailable'}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-950 pt-1 border-t border-blue-200">
                <span>Gross Profit:</span>
                <span>{selectedProductDetails.grossProfit !== null ? `₹${selectedProductDetails.grossProfit.toLocaleString('en-IN')}` : 'Profit unavailable — cost data missing'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedProductDetails(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Drilldown Modal: Transaction Event Details */}
      {selectedEventDetails && (
        <Modal
          isOpen={Boolean(selectedEventDetails)}
          onClose={() => setSelectedEventDetails(null)}
          title={selectedEventDetails.title}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Date:</span>
                <span className="font-bold text-slate-800">{selectedEventDetails.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Event Type:</span>
                <span className="font-semibold text-slate-800">{selectedEventDetails.type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsible User:</span>
                <span className="font-medium text-slate-800">{selectedEventDetails.responsibleUser}</span>
              </div>
              {selectedEventDetails.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-1">Audit Notes / Reference:</span>
                  <p className="text-slate-800 font-mono bg-white p-2 rounded border border-slate-200">{selectedEventDetails.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedEventDetails(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

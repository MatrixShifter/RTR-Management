import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Truck, 
  ClipboardList, 
  Banknote, 
  CheckCircle2, 
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import { 
  calculatePaymentStatus, 
  type StockBalance,
  type ShopBusinessSummary,
  type CategorySalesAnalytics,
  type TimelineEvent
} from '@crimpston/shared';
import { 
  getShops, 
  saveShop, 
  getDeliveries, 
  getDailyReports, 
  calculateStockBalances,
  getShopHistoricalSummary,
  getShopCategoryAnalytics,
  getShopTimelineEvents,
  type Shop, 
  type DeliveryRecord, 
  type DailyReportRecord 
} from '../../services/db.js';

type ShopTab = 'overview' | 'stock' | 'deliveries' | 'sales' | 'payments' | 'history' | 'categories';

export const ShopWorkspace: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ShopTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);

  // Shop Data for Selected Shop
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [shopDeliveries, setShopDeliveries] = useState<DeliveryRecord[]>([]);
  const [shopReports, setShopReports] = useState<DailyReportRecord[]>([]);
  const [shopSummary, setShopSummary] = useState<ShopBusinessSummary | null>(null);
  const [shopTimeline, setShopTimeline] = useState<TimelineEvent[]>([]);
  const [shopCategories, setShopCategories] = useState<CategorySalesAnalytics[]>([]);

  // Add Shop Modal State
  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopCode, setNewShopCode] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [isSubmittingShop, setIsSubmittingShop] = useState(false);
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load initial shops
  const loadShops = async () => {
    setIsLoading(true);
    try {
      const list = await getShops();
      setShops(list);
      if (list.length > 0 && !selectedShopId) {
        setSelectedShopId(list[0]?.id || '');
      }
    } catch (err) {
      console.error('Failed to load retail shops:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
    const handleSync = () => loadShops();
    window.addEventListener('rtr_data_sync', handleSync);
    return () => window.removeEventListener('rtr_data_sync', handleSync);
  }, []);

  // Load Selected Shop's Workspace Data
  useEffect(() => {
    if (!selectedShopId) {
      setStockBalances([]);
      setShopDeliveries([]);
      setShopReports([]);
      setShopSummary(null);
      setShopTimeline([]);
      setShopCategories([]);
      return;
    }

    const loadShopDetails = async () => {
      setIsWorkspaceLoading(true);
      try {
        const [balances, allDelivs, allReps, summary, timeline, categories] = await Promise.all([
          calculateStockBalances(selectedShopId),
          getDeliveries(),
          getDailyReports(),
          getShopHistoricalSummary(selectedShopId),
          getShopTimelineEvents(selectedShopId),
          getShopCategoryAnalytics(selectedShopId)
        ]);

        setStockBalances(balances.filter((b: StockBalance) => b.shop_id === selectedShopId));
        setShopDeliveries(allDelivs.filter((d: DeliveryRecord) => d.shopId === selectedShopId));
        setShopReports(allReps.filter((r: DailyReportRecord) => r.shopId === selectedShopId));
        setShopSummary(summary);
        setShopTimeline(timeline);
        setShopCategories(categories);
      } catch (err) {
        console.error('Failed to load shop workspace data:', err);
      } finally {
        setIsWorkspaceLoading(false);
      }
    };

    loadShopDetails();
  }, [selectedShopId]);

  // Handle Add New Shop
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newShopName.trim()) {
      setFormError('Shop name is required.');
      return;
    }
    if (!newShopCode.trim()) {
      setFormError('Shop code is required (e.g. SHOP-01).');
      return;
    }

    setIsSubmittingShop(true);
    try {
      const created = await saveShop({
        name: newShopName.trim(),
        code: newShopCode.trim().toUpperCase(),
        phone: newShopPhone.trim(),
        address: newShopAddress.trim(),
        isActive: true,
        assignedEmployees: []
      });

      setSuccessNotice(`Retail shop "${created.name}" created successfully and ready for deliveries.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setIsAddShopModalOpen(false);
      setNewShopName('');
      setNewShopCode('');
      setNewShopPhone('');
      setNewShopAddress('');
      
      const updatedList = await getShops();
      setShops(updatedList);
      setSelectedShopId(created.id);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create shop.');
    } finally {
      setIsSubmittingShop(false);
    }
  };

  // Filtered Shops List
  const filteredShops = shops.filter(s => {
    const q = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
  });

  const selectedShop = shops.find(s => s.id === selectedShopId) || null;

  // Stock Aggregates
  const totalStockUnits = stockBalances.reduce((sum, b) => sum + Math.max(0, b.expected_stock), 0);

  // Payment Status calculation
  const totalInvoiced = shopSummary?.totalInvoiced ?? 0;
  const totalPaid = shopSummary?.totalPayments ?? 0;
  const paymentCalc = calculatePaymentStatus(totalInvoiced, totalPaid);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-slate-200 animate-pulse rounded-md w-1/4"></div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Retail Shops Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage partner retail stores, monitor on-site stock balances, supply batches, and payment collections.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => setIsAddShopModalOpen(true)}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Retail Shop</span>
          </Button>
        </div>
      </div>

      {shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No Retail Stores Registered"
          description="Register your first partner shop to begin recording accessory deliveries, tracking daily sales, and reconciling cash."
          action={
            <Button variant="primary" size="sm" onClick={() => setIsAddShopModalOpen(true)}>
              Add First Retail Shop
            </Button>
          }
        />
      ) : (
        /* 2-Column Master-Detail Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Column 1: Searchable Shop Selector (4 cols on desktop) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, code, phone..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-0.5 font-medium">
                <span>{filteredShops.length} of {shops.length} Shops</span>
                <span>Click to open workspace</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {filteredShops.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No shops matching "{searchTerm}"
                </div>
              ) : (
                filteredShops.map(shop => {
                  const isSelected = shop.id === selectedShopId;
                  return (
                    <button
                      key={shop.id}
                      onClick={() => setSelectedShopId(shop.id)}
                      className={`w-full text-left p-3.5 transition-colors flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-blue-50/70 border-l-3 border-blue-600 pl-3' 
                          : 'hover:bg-slate-50/80 border-l-3 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {shop.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200/80">
                            {shop.code}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-3 text-[11px] text-slate-500">
                          {shop.phone ? (
                            <span className="flex items-center space-x-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{shop.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                          {shop.address && (
                            <span className="truncate max-w-[120px]" title={shop.address}>
                              • {shop.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Selected Shop Workspace (8 cols on desktop) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedShop ? (
              <>
                {/* Shop Banner Header */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                          {selectedShop.name}
                        </h2>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {selectedShop.code}
                        </span>
                        <Badge variant={selectedShop.isActive ? 'success' : 'neutral'} size="sm">
                          {selectedShop.isActive ? 'Active Store' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                        {selectedShop.phone && (
                          <span className="flex items-center space-x-1 font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{selectedShop.phone}</span>
                          </span>
                        )}
                        {selectedShop.address && (
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{selectedShop.address}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fast Direct Action Links */}
                    <div className="flex items-center space-x-2">
                      <Link to="/deliveries">
                        <Button variant="outline" size="sm">
                          <Truck className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          <span>Deliver</span>
                        </Button>
                      </Link>
                      <Link to="/payments">
                        <Button variant="outline" size="sm">
                          <Banknote className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          <span>Payment</span>
                        </Button>
                      </Link>
                      <Link to="/records">
                        <Button variant="outline" size="sm">
                          <ClipboardList className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          <span>Records</span>
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Restrained Operational Metrics Strip */}
                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50/70 rounded-md border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">On-Hand Stock</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                        {totalStockUnits} pcs
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-md border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Total Supplied</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                        {shopSummary?.totalDeliveredUnits ?? 0} pcs
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-md border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Reported Sold</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                        {shopSummary?.totalSoldUnits ?? 0} pcs
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-md border border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500 block">Balance Due</span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums font-mono">
                          ₹{(shopSummary?.outstandingBalance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${paymentCalc.badgeClasses.bg} ${paymentCalc.badgeClasses.text} ${paymentCalc.badgeClasses.border}`}>
                          {paymentCalc.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workspace Tabs */}
                <div className="border-b border-slate-200 flex items-center space-x-1 overflow-x-auto text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('stock')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'stock'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Stock ({stockBalances.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('deliveries')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'deliveries'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Deliveries ({shopDeliveries.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'sales'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sales Reports ({shopReports.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'history'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    History Ledger
                  </button>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-3.5 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'categories'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Categories
                  </button>
                </div>

                {/* Workspace Tab Contents */}
                {isWorkspaceLoading ? (
                  <TableSkeleton rows={4} />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 sm:p-5">
                    
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50/60 rounded-md border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Accessory Distribution Summary
                            </h3>
                            <dl className="space-y-1.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Total Accessories Delivered</dt>
                                <dd className="font-semibold text-slate-900 tabular-nums">{shopSummary?.totalDeliveredUnits ?? 0} units</dd>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Confirmed Sales Reported</dt>
                                <dd className="font-semibold text-slate-900 tabular-nums">{shopSummary?.totalSoldUnits ?? 0} units</dd>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Net Stock Transfers</dt>
                                <dd className="font-semibold text-slate-900 tabular-nums font-mono">
                                  +{(shopSummary?.transfersInUnits ?? 0) - (shopSummary?.transfersOutUnits ?? 0)} units
                                </dd>
                              </div>
                              <div className="flex justify-between py-1 pt-2 font-bold text-slate-900">
                                <dt>Active Physical Stock Expected</dt>
                                <dd className="tabular-nums text-blue-600">{totalStockUnits} units</dd>
                              </div>
                            </dl>
                          </div>

                          <div className="p-4 bg-slate-50/60 rounded-md border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Financial Balance & Collections
                            </h3>
                            <dl className="space-y-1.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Total Billed / Memo Amount</dt>
                                <dd className="font-semibold text-slate-900 tabular-nums font-mono">₹{totalInvoiced.toLocaleString('en-IN')}</dd>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Collected Cash & Digital Payments</dt>
                                <dd className="font-semibold text-emerald-700 tabular-nums font-mono">₹{totalPaid.toLocaleString('en-IN')}</dd>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-100">
                                <dt className="text-slate-500">Payment Status</dt>
                                <dd>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${paymentCalc.badgeClasses.bg} ${paymentCalc.badgeClasses.text} ${paymentCalc.badgeClasses.border}`}>
                                    {paymentCalc.statusLabel}
                                  </span>
                                </dd>
                              </div>
                              <div className="flex justify-between py-1 pt-2 font-bold text-slate-900">
                                <dt>Outstanding Balance</dt>
                                <dd className="tabular-nums font-mono text-slate-900">
                                  ₹{(shopSummary?.outstandingBalance ?? 0).toLocaleString('en-IN')}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        {/* Recent Activity Mini-Ledger */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Recent Deliveries to this Shop
                            </h3>
                            <Link to="/deliveries" className="text-xs text-blue-600 hover:underline font-medium">
                              View all deliveries →
                            </Link>
                          </div>
                          {shopDeliveries.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 italic">No deliveries recorded yet for this shop.</p>
                          ) : (
                            <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Date</th>
                                    <th className="py-2 px-3">Batch Reference</th>
                                    <th className="py-2 px-3 text-right">Delivered Units</th>
                                    <th className="py-2 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {shopDeliveries.slice(0, 4).map(d => (
                                    <tr key={d.id} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-3 font-mono text-slate-600">{d.deliveryDate}</td>
                                      <td className="py-2.5 px-3 text-slate-800 font-medium">
                                        {d.notes || `Delivery #${d.id.slice(-6)}`}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                                        {d.items.reduce((s, i) => s + i.quantity, 0)} pcs
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
                    )}

                    {/* TAB 2: STOCK ON-HAND */}
                    {activeTab === 'stock' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Live accessory balances currently held at {selectedShop.name}.</span>
                          <Link to="/stock-ledger" className="text-blue-600 hover:underline font-medium">
                            Full Stock Ledger →
                          </Link>
                        </div>
                        {stockBalances.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 italic">No stock records yet for this shop.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-md overflow-x-auto text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Product Name</th>
                                  <th className="py-2.5 px-3">SKU</th>
                                  <th className="py-2.5 px-3">Category</th>
                                  <th className="py-2.5 px-3 text-right">Delivered</th>
                                  <th className="py-2.5 px-3 text-right">Sold</th>
                                  <th className="py-2.5 px-3 text-right font-bold">On-Hand Stock</th>
                                  <th className="py-2.5 px-3 text-right">Physical Count</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {stockBalances.map(b => (
                                  <tr key={b.product_id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">{b.product_name}</td>
                                    <td className="py-2.5 px-3 font-mono text-slate-500">{b.product_sku}</td>
                                    <td className="py-2.5 px-3 text-slate-600">{b.category}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{b.total_delivered}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{b.confirmed_sold + b.provisional_sold}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-600">
                                      {b.expected_stock} pcs
                                    </td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                                      {b.last_physical_count !== null ? `${b.last_physical_count} pcs` : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: DELIVERIES */}
                    {activeTab === 'deliveries' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Complete delivery shipments sent to {selectedShop.name}.</span>
                          <Link to="/deliveries" className="text-blue-600 hover:underline font-medium">
                            + New Supply Delivery
                          </Link>
                        </div>
                        {shopDeliveries.length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 italic text-center">No deliveries recorded for this shop.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-md overflow-x-auto text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Date</th>
                                  <th className="py-2.5 px-3">Batch ID</th>
                                  <th className="py-2.5 px-3">Items Included</th>
                                  <th className="py-2.5 px-3 text-right">Total Units</th>
                                  <th className="py-2.5 px-3 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {shopDeliveries.map(d => (
                                  <tr key={d.id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-mono text-slate-700">{d.deliveryDate}</td>
                                    <td className="py-2.5 px-3 font-mono text-slate-500">#{d.id.slice(-6).toUpperCase()}</td>
                                    <td className="py-2.5 px-3 text-slate-800">
                                      {d.items.map(i => `${i.productName || 'Item'} (${i.quantity})`).join(', ')}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                                      {d.items.reduce((s, i) => s + i.quantity, 0)} pcs
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
                    )}

                    {/* TAB 4: SALES REPORTS */}
                    {activeTab === 'sales' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Daily reports filed by retail shop staff.</span>
                          <Link to="/records" className="text-blue-600 hover:underline font-medium">
                            View Records →
                          </Link>
                        </div>
                        {shopReports.length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 italic text-center">No daily sales reports recorded for this shop.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-md overflow-x-auto text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Date</th>
                                  <th className="py-2.5 px-3">Submitted By</th>
                                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                                  <th className="py-2.5 px-3 text-center">Status</th>
                                  <th className="py-2.5 px-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {shopReports.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-mono text-slate-700">{r.reportDate}</td>
                                    <td className="py-2.5 px-3 text-slate-600">{r.submittedBy}</td>
                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                                      {r.isZeroSales ? (
                                        <span className="text-slate-400 font-normal italic">0 (Zero Sales)</span>
                                      ) : (
                                        `${r.totalQuantitySold} pcs`
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <Badge variant={r.status === 'approved' ? 'success' : 'warning'} size="sm">
                                        {r.status === 'approved' ? 'Approved' : 'Pending Review'}
                                      </Badge>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 italic truncate max-w-[150px]">
                                      {r.notes || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 5: HISTORY & TIMELINE */}
                    {activeTab === 'history' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Chronological business event trail for {selectedShop.name}.</span>
                          <Link to="/analytics" className="text-blue-600 hover:underline font-medium">
                            Advanced Analytics & Export →
                          </Link>
                        </div>
                        {shopTimeline.length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 italic text-center">No recorded timeline events for this shop.</p>
                        ) : (
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden text-xs">
                            {shopTimeline.slice(0, 15).map(event => (
                              <div key={event.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/60">
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-slate-900">{event.title}</span>
                                    <Badge variant={event.badgeVariant} size="sm">{event.type.toUpperCase()}</Badge>
                                  </div>
                                  <p className="text-slate-500">{event.summary}</p>
                                </div>
                                <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                                  {event.date}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 6: CATEGORIES */}
                    {activeTab === 'categories' && (
                      <div className="space-y-3">
                        <span className="text-xs text-slate-500 block">Performance breakdown by accessory category.</span>
                        {shopCategories.length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 italic text-center">No category data available yet.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-md overflow-x-auto text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Category</th>
                                  <th className="py-2.5 px-3 text-right">Units Supplied</th>
                                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                                  <th className="py-2.5 px-3 text-right font-bold">On-Hand Stock</th>
                                  <th className="py-2.5 px-3 text-right font-mono">Sales Revenue</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {shopCategories.map(cat => (
                                  <tr key={cat.category} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">{cat.category}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{cat.quantityDelivered}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{cat.quantitySold}</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-blue-600">{cat.remainingStock} pcs</td>
                                    <td className="py-2.5 px-3 text-right tabular-nums font-mono text-slate-900">₹{cat.salesRevenue.toLocaleString('en-IN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-lg">
                Please select a retail shop from the left list.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Shop Modal */}
      <Modal
        isOpen={isAddShopModalOpen}
        onClose={() => setIsAddShopModalOpen(false)}
        title="Add New Retail Partner Shop"
      >
        <form onSubmit={handleCreateShop} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs">
              {formError}
            </div>
          )}

          <Input
            label="Shop Name *"
            value={newShopName}
            onChange={e => setNewShopName(e.target.value)}
            placeholder="e.g. Star Mobiles & Accessories"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Shop Code *"
              value={newShopCode}
              onChange={e => setNewShopCode(e.target.value.toUpperCase())}
              placeholder="e.g. STAR-01"
              required
            />
            <Input
              label="Contact Phone"
              value={newShopPhone}
              onChange={e => setNewShopPhone(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>

          <Input
            label="Shop Address / Location"
            value={newShopAddress}
            onChange={e => setNewShopAddress(e.target.value)}
            placeholder="e.g. Shop 12, Main Market Road"
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAddShopModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmittingShop}
            >
              Create Shop
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

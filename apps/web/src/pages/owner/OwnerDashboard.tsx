import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Truck, 
  Wallet,
  Plus, 
  Search, 
  Filter,
  CheckCircle2, 
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  Store,
  Settings,
  LogOut,
  AlertTriangle,
  RotateCcw,
  Bell,
  Package,
  Calendar
} from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import { ErrorState } from '../../components/ui/StateViews.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { RecordEntryDrawer } from '../../components/RecordEntryDrawer.js';
import { RecordActionsMenu } from '../../components/RecordActionsMenu.js';
import { RecordDetailsModal } from '../../components/RecordDetailsModal.js';
import { SettlePaymentModal } from '../../components/SettlePaymentModal.js';
import { 
  getShops, 
  getProducts, 
  getBusinessRecords, 
  deleteBusinessRecord,
  compareBusinessRecords,
  sortBusinessRecords,
  isDatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  isDemoMode,
  resetDemoData,
  type Shop, 
  type Product, 
  type BusinessRecord,
  type DeliveryRecord,
  type DailyReportRecord
} from '../../services/db.js';
import type { Invoice, PaymentRecord, StockBalance, DatabaseStorageHealth } from '@crimpston/shared';

export type FilterMode = 'all' | 'delivery' | 'pending';
export type SortField = 'date' | 'shop' | 'product' | 'quantity' | 'unitPrice' | 'pendingAmount';
export type SortDirection = 'asc' | 'desc';

/**
 * Unified predicate for pending records:
 * A record is pending if either:
 * 1) It has an outstanding pending payment balance (> 0), OR
 * 2) Its delivery is still pending.
 * 
 * Using this exact shared predicate ensures the "Pending" tab count,
 * the Pending Payments summary card, and the filtered table rows never disagree.
 */
export const isPendingRecord = (r: BusinessRecord): boolean => {
  const pendingAmt = Number(r.pendingAmount) || 0;
  return pendingAmt > 0 || r.deliveryStatus === 'pending';
};

export interface OwnerDashboardProps {
  initialLoading?: boolean;
  initialError?: string | null;
  initialShops?: Shop[];
  initialDeliveries?: DeliveryRecord[];
  initialReports?: DailyReportRecord[];
  initialInvoices?: Invoice[];
  initialPayments?: PaymentRecord[];
  initialBalances?: StockBalance[];
  initialRecords?: BusinessRecord[];
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  initialLoading,
  initialError = null,
  initialShops,
  initialDeliveries,
  initialInvoices,
  initialRecords
}) => {
  // Primary Data States
  const [records, setRecords] = useState<BusinessRecord[]>(() => {
    if (initialRecords) return sortBusinessRecords([...initialRecords]);
    if (initialDeliveries) {
      const invMap = new Map<string, Invoice>();
      if (initialInvoices) {
        initialInvoices.forEach(i => {
          if (i.delivery_id) invMap.set(i.delivery_id, i);
        });
      }
      const built = initialDeliveries.flatMap(d => {
        const inv = invMap.get(d.id);
        const pending = d.pendingAmount !== undefined ? d.pendingAmount : (inv ? inv.outstanding_amount : 0);
        if (d.items && d.items.length > 0) {
          return d.items.map((item, idx) => ({
            id: `${d.id}-${item.productId || idx}`,
            deliveryId: d.id,
            date: d.deliveryDate,
            shopId: d.shopId,
            shopName: d.shopName || 'Retail Shop',
            productId: item.productId,
            productName: item.productName || 'Accessory Item',
            productSku: item.productSku || '',
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            totalAmount: (item.quantity || 0) * (item.unitPrice || 0),
            deliveryStatus: d.status,
            pendingAmount: idx === 0 ? pending : 0,
            notes: d.notes,
            createdAt: d.createdAt
          }));
        }
        return [{
          id: d.id,
          deliveryId: d.id,
          date: d.deliveryDate,
          shopId: d.shopId,
          shopName: d.shopName || 'Retail Shop',
          productId: '',
          productName: 'Accessory Delivery',
          quantity: 0,
          unitPrice: 0,
          totalAmount: 0,
          deliveryStatus: d.status,
          pendingAmount: pending,
          notes: d.notes,
          createdAt: d.createdAt
        }];
      });
      return sortBusinessRecords(built);
    }
    return [];
  });

  const [shops, setShops] = useState<Shop[]>(initialShops ?? []);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(initialLoading ?? (initialShops === undefined && initialRecords === undefined));
  const [error, setError] = useState<string | null>(initialError);

  // Filter, Search & Sort States
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Form & Action States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Modal/drawer closed by default
  const [editingRecord, setEditingRecord] = useState<BusinessRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<BusinessRecord | null>(null);
  const [settlingRecord, setSettlingRecord] = useState<BusinessRecord | null>(null);
  const [activeMenu, setActiveMenu] = useState<{ record: BusinessRecord; rect: DOMRect } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [capacityAlert, setCapacityAlert] = useState<{ title: string; message: string } | null>(null);
  const [storageHealth, setStorageHealth] = useState<DatabaseStorageHealth | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  // Dropdown menus
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // User state
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('rtr_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const userName = currentUser?.name || 'Vino';
  const userInitials = useMemo(() => {
    if (!userName) return 'VN';
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return userName.slice(0, 2).toUpperCase();
  }, [userName]);

  // Load live data from db
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [recs, sList, pList] = await Promise.all([
        getBusinessRecords(),
        getShops(),
        getProducts()
      ]);
      setRecords(recs || []);
      setShops(sList || []);
      setProducts(pList || []);
    } catch (err: any) {
      console.error('Failed to load RTR wholesale records:', err);
      setError(err?.message || 'Failed to load wholesale records. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialShops !== undefined || initialRecords !== undefined) return;
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
  }, [loadData, initialShops, initialRecords]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.profile-dropdown-container')) {
        setIsProfileDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('.filter-dropdown-container')) {
        setIsFilterDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('.date-dropdown-container')) {
        setIsDateDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Handle successful record addition / edit
  const handleRecordSaved = (newRecord: BusinessRecord) => {
    setRecords(prev => [newRecord, ...prev.filter(r => r.id !== newRecord.id && r.deliveryId !== newRecord.deliveryId)]);
    setToastMessage(`Record saved successfully for ${newRecord.shopName}!`);
    setTimeout(() => setToastMessage(null), 4000);
    setEditingRecord(null);
    loadData();
  };

  // Actions
  const handleViewRecord = (record: BusinessRecord) => {
    setActiveMenu(null);
    setViewingRecord(record);
  };

  const handleEditRecord = (record: BusinessRecord) => {
    setActiveMenu(null);
    setEditingRecord(record);
    setIsDrawerOpen(true);
  };

  const handleOpenSettleModal = (record: BusinessRecord) => {
    setActiveMenu(null);
    setSettlingRecord(record);
  };

  const handlePaymentSettled = (amount: number, shopName: string) => {
    setToastMessage(`Payment of ₹${amount.toLocaleString('en-IN')} recorded for ${shopName}!`);
    setTimeout(() => setToastMessage(null), 4000);
    setSettlingRecord(null);
    loadData();
  };

  const handleDeleteRecord = async (record: BusinessRecord) => {
    setActiveMenu(null);
    if (!window.confirm(`Are you sure you want to delete this record for ${record.shopName}?`)) return;

    try {
      await deleteBusinessRecord(record.deliveryId || record.id);
      setRecords(prev => prev.filter(r => r.id !== record.id && r.deliveryId !== record.deliveryId));
      setToastMessage('Record deleted successfully.');
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err: any) {
      if (isDatabaseCapacityError(err)) {
        setCapacityAlert({
          title: DATABASE_STORAGE_FULL_TITLE,
          message: DATABASE_STORAGE_FULL_MESSAGE
        });
      } else {
        alert(`Could not delete record: ${err?.message}`);
      }
    }
  };

  // --------------------------------------------------------------------------
  // CORE BUSINESS METRICS
  // --------------------------------------------------------------------------
  const deliveryRecords = useMemo(() => {
    return records.filter(r => r.deliveryStatus === 'delivered');
  }, [records]);

  const deliveryRecordsCount = deliveryRecords.length;
  const totalDeliveredUnits = useMemo(() => {
    return deliveryRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [deliveryRecords]);

  const pendingRecords = useMemo(() => {
    return records.filter(isPendingRecord);
  }, [records]);

  const pendingRecordsCount = pendingRecords.length;

  // Currency outstanding balance: only actual positive pending money, never inflated by prepaid/₹0 pending
  const totalPendingMoney = useMemo(() => {
    return records.reduce((sum, r) => sum + Math.max(0, Number(r.pendingAmount) || 0), 0);
  }, [records]);

  const allRecordsCount = records.length;

  const totalUniqueProducts = useMemo(() => {
    const fromRecords = new Set(records.map(r => r.productName).filter(Boolean)).size;
    return fromRecords || products.length || 0;
  }, [records, products]);

  const activeShopsCount = useMemo(() => {
    return shops.length || new Set(records.map(r => r.shopName).filter(Boolean)).size || 0;
  }, [shops, records]);

  const todayFormattedString = useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Tuesday, 24 Oct 2026';
    }
  }, []);

  // --------------------------------------------------------------------------
  // FILTERING, SEARCH & SORTING
  // --------------------------------------------------------------------------
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    // Filter Mode
    if (filterMode === 'delivery') {
      result = result.filter(r => r.deliveryStatus === 'delivered');
    } else if (filterMode === 'pending') {
      result = result.filter(isPendingRecord);
    }

    // Filter by Shop
    if (selectedShopFilter !== 'all') {
      result = result.filter(r => r.shopId === selectedShopFilter);
    }

    // Search Query (Shop Name or Product Name or SKU)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.shopName && r.shopName.toLowerCase().includes(q)) ||
        (r.productName && r.productName.toLowerCase().includes(q)) ||
        (r.productSku && r.productSku.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    // Sorting: Deterministic wholesale priority (Pending at top, Completed at bottom)
    result.sort((a, b) => compareBusinessRecords(a, b, sortField, sortDirection));

    return result;
  }, [records, filterMode, selectedShopFilter, searchQuery, sortField, sortDirection]);

  // Reset pagination when search, filter, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, selectedShopFilter, searchQuery, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredAndSortedRecords.slice(start, start + rowsPerPage);
  }, [filteredAndSortedRecords, currentPage, rowsPerPage]);

  // Checkbox Selection
  const toggleSelectAll = () => {
    if (selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(paginatedRecords.map(r => r.id)));
    }
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'shop' || field === 'product' ? 'asc' : 'desc');
    }
  };

  const handleResetFilters = () => {
    setFilterMode('all');
    setSelectedShopFilter('all');
    setSearchQuery('');
    setSortField('date');
    setSortDirection('desc');
  };

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '-';
    try {
      const [year, month, day] = isoDate.slice(0, 10).split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  };

  // --------------------------------------------------------------------------
  // RENDER STATES
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 animate-pulse rounded-md w-64" />
            <div className="h-4 bg-slate-200 animate-pulse rounded-md w-96" />
          </div>
          <div className="h-10 bg-slate-200 animate-pulse rounded-lg w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-32 bg-slate-200 animate-pulse rounded-2xl" />
          <div className="h-32 bg-slate-200 animate-pulse rounded-2xl" />
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error && records.length === 0 && shops.length === 0) {
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
      {/* Database Storage Capacity Warning Alert */}
      {capacityAlert && (
        <div 
          role="alert"
          aria-live="assertive"
          className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 shadow-xs flex items-start justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900 leading-snug">
                {capacityAlert.title}
              </h3>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                {capacityAlert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCapacityAlert(null)}
            className="text-amber-600 hover:text-amber-900 font-bold p-1 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
            aria-label="Dismiss storage warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Verified Proactive Storage Health Warning (Only when verified, never guessed) */}
      {storageHealth && storageHealth.verified && (storageHealth.status === 'warning' || storageHealth.status === 'critical') && (
        <div 
          role="alert"
          className={`p-4 rounded-xl shadow-xs flex items-start justify-between gap-3 animate-fade-in ${
            storageHealth.status === 'critical'
              ? 'bg-red-50 border border-red-300 text-red-950'
              : 'bg-amber-50 border border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              storageHealth.status === 'critical' ? 'text-red-600' : 'text-amber-600'
            }`} />
            <div>
              <h3 className="text-sm font-bold leading-snug">
                {storageHealth.status === 'critical' ? 'Database Storage Critical' : 'Database Storage Notice'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed">
                {storageHealth.message}
                {storageHealth.usagePercentage !== undefined && (
                  <span className="block mt-0.5 font-medium">
                    Verified Capacity Usage: {storageHealth.usagePercentage}%
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStorageHealth(null)}
            className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg cursor-pointer"
            aria-label="Dismiss proactive warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 shadow-2xs animate-fade-in font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => setToastMessage(null)} 
            className="text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold cursor-pointer"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================
          0. TOP BAR (Search field, Notifications, Account Profile)
         ======================================================== */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        {/* Left / Center: Search bar */}
        <div className="relative w-full sm:max-w-md lg:max-w-xl">
          <Search className="w-4 h-4 text-[#637A98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search shop name, product, or anything..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#EAF2FA] border border-[#D8E7F7] rounded-xl pl-10 pr-8 py-2 text-xs text-[#102A4C] placeholder:text-[#637A98] focus:outline-none focus:ring-1 focus:ring-[#168BFF] focus:border-[#168BFF] focus:bg-white shadow-2xs transition-all min-h-[40px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Notifications & User Avatar */}
        <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto">
          <button
            type="button"
            className="relative p-2 text-[#637A98] hover:text-[#102A4C] rounded-xl hover:bg-white/70 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* Account Pill Dropdown */}
          <div className="relative profile-dropdown-container">
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 pl-1 pr-2 rounded-full hover:bg-white/80 transition-colors focus:outline-none cursor-pointer min-h-[44px]"
            >
              <div className="w-8 h-8 rounded-full bg-[#168BFF] text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-xs flex-shrink-0">
                {userInitials}
              </div>
              <span className="text-xs font-semibold text-[#102A4C] max-w-[130px] sm:max-w-[150px] truncate">
                {isDemoMode() ? 'Demo Owner (Sandbox)' : userName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#637A98]" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#D8E7F7] py-1.5 z-50 animate-fade-in text-xs text-[#102A4C]">
                <div className="px-3.5 py-2.5 border-b border-slate-100">
                  <p className="font-semibold text-[#102A4C] truncate">{userName}</p>
                  <p className="text-[11px] text-[#637A98] truncate">{currentUser?.email || (isDemoMode() ? 'demo-owner@rtrmobiles.com' : 'owner@rtrmobiles.com')}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF4FF] text-[#168BFF]">
                    {isDemoMode() ? 'DEMO SANDBOX' : 'BUSINESS OWNER'}
                  </span>
                </div>
                <div className="py-1">
                  <a 
                    href="/settings" 
                    className="flex items-center gap-2 px-3.5 py-2 hover:bg-[#F4F9FF] text-[#102A4C] transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#637A98]" />
                    <span>Settings &amp; Account</span>
                  </a>
                </div>
                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={() => {
                      localStorage.removeItem('rtr_current_user');
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          1. PAGE HEADING (Records Title + Subtitle + Date Badge)
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#102A4C]">
              Records
            </h1>
            <span className="sr-only">Wholesale Operations Overview RTR Management</span>
          </div>
          <p className="text-xs text-[#637A98] mt-0.5">
            Manage shop deliveries, stock and payments
          </p>
        </div>

        {/* Date pill on the right */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#D8E7F7] rounded-xl text-xs font-medium text-[#102A4C] shadow-2xs self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-[#168BFF]" />
          <span>{todayFormattedString}</span>
        </div>
      </div>

      {/* ========================================================
          2. DEMO SANDBOX BANNER (Slim Pale Blue Strip)
         ======================================================== */}
      {isDemoMode() && (
        <div 
          role="region"
          aria-label="Demo Sandbox Notification"
          className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#CDE3FE] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in"
        >
          <div className="flex items-center gap-2.5 text-[#102A4C] min-w-0">
            <div className="w-4 h-4 rounded-full bg-[#168BFF] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">
              i
            </div>
            <span className="font-bold text-[#102A4C] flex-shrink-0">Demo Mode</span>
            <span className="text-slate-300">|</span>
            <span className="text-[#637A98] truncate">
              You are viewing sample data only. Real customer databases, shops, and payments are protected and isolated.
            </span>
            <span className="sr-only">Interactive Demo Sandbox Isolated Mode</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={async () => {
                resetDemoData();
                await loadData();
              }}
              className="w-full sm:w-auto justify-center px-3 py-2 bg-white hover:bg-slate-50 border border-[#D8E7F7] text-[#102A4C] rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[38px]"
              title="Reset sample demo data back to pristine default state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#168BFF]" />
              <span>Reset Demo Data</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          3. SUMMARY METRICS (4 Horizontal Sky-Blue Metric Cards)
         ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Deliveries */}
        <div 
          onClick={() => setFilterMode(filterMode === 'delivery' ? 'all' : 'delivery')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative bg-[#EAF4FF] border-[#D2E6FD] hover:border-[#168BFF]/40 shadow-2xs ${
            filterMode === 'delivery' ? 'ring-2 ring-[#168BFF]' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#D6EAFE] flex items-center justify-center text-[#168BFF] flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform text-[#168BFF] ${filterMode === 'delivery' ? 'rotate-90' : ''}`} />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#102A4C]">
                Total Deliveries
              </span>
              <span className="sr-only">Delivery Records</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#102A4C] mt-1 tabular-nums tracking-tight">
              {deliveryRecordsCount}
            </div>
            <div className="text-xs text-[#637A98] mt-1">
              <span className="sr-only">Total Units Delivered: </span>
              {totalDeliveredUnits.toLocaleString('en-IN')} units delivered
              <span className="sr-only"> pcs</span>
            </div>
          </div>
          <div className="sr-only">
            Delivery Records Total Units Delivered: {totalDeliveredUnits} pcs
          </div>
        </div>

        {/* Card 2: Total Products */}
        <div className="p-4 rounded-2xl border bg-[#EBF9F1] border-[#D0F0DB] shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#D3F5E0] flex items-center justify-center text-[#10B981] flex-shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#102A4C]">
              Total Products
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#102A4C] mt-1 tabular-nums tracking-tight">
              {totalUniqueProducts}
            </div>
            <div className="text-xs text-[#637A98] mt-1">
              In this record list
            </div>
          </div>
        </div>

        {/* Card 3: Shops */}
        <div 
          onClick={() => {
            if (selectedShopFilter !== 'all') setSelectedShopFilter('all');
            else setIsFilterDropdownOpen(true);
          }}
          className="p-4 rounded-2xl border bg-[#F2F0FF] border-[#DEDAFE] hover:border-[#8B5CF6]/40 shadow-2xs cursor-pointer transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#E4DEFE] flex items-center justify-center text-[#8B5CF6] flex-shrink-0">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#102A4C]">
              Shops
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#102A4C] mt-1 tabular-nums tracking-tight">
              {activeShopsCount}
            </div>
            <div className="text-xs text-[#637A98] mt-1">
              Active shops
            </div>
          </div>
        </div>

        {/* Card 4: Pending Payments */}
        <div 
          onClick={() => setFilterMode(filterMode === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative bg-[#FFF6ED] border-[#FEDDC2] hover:border-[#F97316]/40 shadow-2xs ${
            filterMode === 'pending' ? 'ring-2 ring-[#F97316]' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#FFE8D1] flex items-center justify-center text-[#F97316] flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-[#102A4C]">
              Pending Payments
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#102A4C] mt-1 tabular-nums tracking-tight break-words">
              {`₹${totalPendingMoney.toLocaleString('en-IN')}`}
            </div>
            <div className="text-xs text-[#637A98] mt-1 truncate">
              {totalPendingMoney > 0 ? (
                `${pendingRecordsCount} records with balance`
              ) : (
                <span className="text-emerald-700 font-medium">All shop accounts fully settled</span>
              )}
            </div>
          </div>
          <div className="sr-only">
            {`Total Balance Due: ₹${totalPendingMoney.toLocaleString('en-IN')}`}
          </div>
        </div>
      </div>

      {/* ========================================================
          4. FILTERS & ACTIONS TOOLBAR (One-Row Compact Layout)
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Left: Clean Segmented View Tabs */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 text-xs select-none w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-h-[40px] text-[11px] sm:text-xs ${
              filterMode === 'all'
                ? 'bg-[#168BFF] text-white shadow-xs font-semibold'
                : 'bg-white border border-[#D8E7F7] text-[#637A98] hover:text-[#102A4C]'
            }`}
          >
            <span>All Records</span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono ${
              filterMode === 'all' ? 'bg-white/25 text-white' : 'bg-slate-100 text-[#637A98]'
            }`}>
              {allRecordsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('delivery')}
            className={`px-2 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-h-[40px] text-[11px] sm:text-xs ${
              filterMode === 'delivery'
                ? 'bg-[#168BFF] text-white shadow-xs font-semibold'
                : 'bg-white border border-[#D8E7F7] text-[#637A98] hover:text-[#102A4C]'
            }`}
          >
            <span>Deliveries</span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono ${
              filterMode === 'delivery' ? 'bg-white/25 text-white' : 'bg-slate-100 text-[#637A98]'
            }`}>
              {deliveryRecordsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-2 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-h-[40px] text-[11px] sm:text-xs ${
              filterMode === 'pending'
                ? 'bg-[#168BFF] text-white shadow-xs font-semibold'
                : 'bg-white border border-[#D8E7F7] text-[#637A98] hover:text-[#102A4C]'
            }`}
          >
            <span>Pending</span>
            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono ${
              filterMode === 'pending' ? 'bg-white/25 text-white' : 'bg-slate-100 text-[#637A98]'
            }`}>
              {pendingRecordsCount}
            </span>
          </button>
        </div>

        {/* Right: Shop Filter, Dates, Filters & Add Record Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Filter Pills container - horizontally scrollable on mobile without wrapping */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto flex-nowrap">
            {/* Shop Filter Button */}
            <div className="relative filter-dropdown-container flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`border px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                  selectedShopFilter !== 'all' || isFilterDropdownOpen
                    ? 'bg-[#EAF4FF] border-[#168BFF] text-[#168BFF] font-semibold'
                    : 'bg-white border-[#D8E7F7] hover:bg-slate-50 text-[#102A4C]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[160px]">
                  <Store className="w-3.5 h-3.5 text-[#637A98] flex-shrink-0" />
                  <span className="truncate">
                    {selectedShopFilter === 'all' 
                      ? 'All Shops' 
                      : (shops.find(s => s.id === selectedShopFilter)?.name || 'Filtered Shop')}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-[#637A98] flex-shrink-0" />
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-[#D8E7F7] p-2.5 z-50 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                    <span className="font-semibold text-[#637A98] text-[10px] uppercase tracking-wider">
                      Filter by Shop
                    </span>
                    {(selectedShopFilter !== 'all' || filterMode !== 'all' || searchQuery) && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[#168BFF] text-[11px] font-medium hover:underline cursor-pointer"
                      >
                        Reset All
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopFilter('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                        selectedShopFilter === 'all' ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      All Shops ({records.length})
                    </button>
                    {shops.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedShopFilter(s.id);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md font-medium transition-colors truncate ${
                          selectedShopFilter === s.id ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dates Filter Button */}
            <div className="relative date-dropdown-container flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="bg-white border border-[#D8E7F7] hover:bg-slate-50 text-[#102A4C] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 text-[#637A98] flex-shrink-0" />
                <span>{selectedDateFilter === 'today' ? 'Today' : 'All Dates'}</span>
                <ChevronDown className="w-3 h-3 text-[#637A98] flex-shrink-0" />
              </button>

              {isDateDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-[#D8E7F7] p-1.5 z-50 animate-fade-in text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter('all');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                      selectedDateFilter === 'all' ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter('today');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                      selectedDateFilter === 'today' ? 'bg-[#EAF4FF] text-[#168BFF] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Today Only
                  </button>
                </div>
              )}
            </div>

            {/* Filters Toggle Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="bg-white border border-[#D8E7F7] hover:bg-slate-50 text-[#102A4C] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer min-h-[40px] whitespace-nowrap flex-shrink-0"
              title="Reset active filters"
            >
              <Filter className="w-3.5 h-3.5 text-[#637A98] flex-shrink-0" />
              <span>Filters</span>
            </button>
          </div>

          {/* Primary CTA: + Add Record */}
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setIsDrawerOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-[#168BFF] hover:bg-[#0876E8] active:bg-[#065EC2] text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[46px] h-[46px] flex-shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" aria-hidden="true" />
            <span aria-hidden="true">Add Record</span>
            <span className="sr-only">+ Add Record</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          5. MAIN CONTENT AREA (Full-Width Records Table)
         ======================================================== */}
      <div className="w-full">
        {records.length === 0 ? (
          <div className="bg-white border border-[#D8E7F7] rounded-2xl p-8 shadow-2xs text-center">
            <EmptyState
              icon={Store}
              title={shops.length === 0 ? "No Retail Stores Registered" : "No Business Records Entered"}
              description={
                shops.length === 0
                  ? "Your wholesale workspace is active. Register your partner retail shops to start tracking stock ledger, accessories deliveries, and daily revenue collection."
                  : "Your business records ledger is ready. Log your first wholesale accessory delivery and customer payment."
              }
              actionText={shops.length === 0 ? "Register First Shop" : "+ Add First Record"}
              onAction={() => {
                setEditingRecord(null);
                setIsDrawerOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="bg-transparent md:bg-white rounded-2xl md:border md:border-[#D8E7F7] md:shadow-2xs overflow-visible md:overflow-hidden space-y-3.5 md:space-y-0">
            {/* Desktop Table View (Hidden on mobile / visible on tablet & desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F4F9FF] text-[#637A98] font-semibold text-[11px] uppercase tracking-wider border-b border-[#D8E7F7] select-none">
                  <tr>
                    {/* Checkbox */}
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-[#D8E7F7] text-[#168BFF] focus:ring-[#168BFF] cursor-pointer"
                        aria-label="Select all records"
                      />
                    </th>

                    {/* Date */}
                    <th 
                      onClick={() => handleSort('date')}
                      className="py-3.5 px-3 cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Date</span>
                        {sortField === 'date' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Shop Name */}
                    <th 
                      onClick={() => handleSort('shop')}
                      className="py-3.5 px-3 cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Shop Name</span>
                        <span className="sr-only">Retail Shop</span>
                        {sortField === 'shop' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Product */}
                    <th 
                      onClick={() => handleSort('product')}
                      className="py-3.5 px-3 cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Product</span>
                        {sortField === 'product' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Quantity */}
                    <th 
                      onClick={() => handleSort('quantity')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Quantity</span>
                        {sortField === 'quantity' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Unit Price */}
                    <th 
                      onClick={() => handleSort('unitPrice')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Unit Price</span>
                        {sortField === 'unitPrice' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Status */}
                    <th className="py-3.5 px-3 whitespace-nowrap">
                      <span>Delivery Status</span>
                      <span className="sr-only">Status</span>
                    </th>

                    {/* Pending Amount */}
                    <th 
                      onClick={() => handleSort('pendingAmount')}
                      className="py-3.5 px-3 text-right cursor-pointer hover:text-[#102A4C] transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Pending Amount</span>
                        {sortField === 'pendingAmount' && (
                          <span className="text-[#168BFF] text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="py-3.5 px-3 text-right whitespace-nowrap w-12">
                      <span>Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EAF2FA]">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-[#637A98]">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map(rec => {
                      const isDelivered = rec.deliveryStatus === 'delivered';
                      const pendingAmt = Number(rec.pendingAmount) || 0;
                      const isSelected = selectedRecordIds.has(rec.id);
                      const shopSubtitle = rec.shopName.includes(' - ') ? rec.shopName.split(' - ')[1] : '';

                      return (
                        <tr 
                          key={rec.id} 
                          className={`hover:bg-[#F4F9FF]/80 transition-colors ${
                            isSelected ? 'bg-[#EAF4FF]/50' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRecord(rec.id)}
                              className="rounded border-[#D8E7F7] text-[#168BFF] focus:ring-[#168BFF] cursor-pointer"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 text-[#637A98] font-mono text-xs whitespace-nowrap">
                            {formatDateDisplay(rec.date)}
                          </td>

                          {/* Shop Name */}
                          <td className="py-3.5 px-3 font-semibold text-[#102A4C] whitespace-nowrap max-w-[200px]" title={rec.shopName}>
                            <div className="truncate">{rec.shopName}</div>
                            {shopSubtitle && (
                              <div className="text-[11px] font-normal text-[#637A98] truncate">{shopSubtitle}</div>
                            )}
                          </td>

                          {/* Product */}
                          <td className="py-3.5 px-3 text-[#102A4C] font-medium whitespace-nowrap max-w-[220px] truncate" title={rec.productName}>
                            {rec.productName}
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-3 text-right text-[#102A4C] tabular-nums whitespace-nowrap">
                            <span className="font-semibold">{rec.quantity}</span>
                            <span className="text-[11px] text-[#637A98] ml-1">pcs</span>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3.5 px-3 text-right text-[#102A4C] tabular-nums whitespace-nowrap font-medium">
                            {`₹${Number(rec.unitPrice || 0).toLocaleString('en-IN')}`}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isDelivered ? (
                              <span className="bg-[#E8F8EE] text-[#0E8345] border border-[#BDEBD0] px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E8345] flex-shrink-0" />
                                <span>Delivered</span>
                              </span>
                            ) : (
                              <span className="bg-[#FFF6E5] text-[#B56704] border border-[#FFE4B5] px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#B56704] flex-shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Pending Amount */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {pendingAmt > 0 ? (
                              <span className="text-[#D9381E] font-bold text-xs">
                                {`₹${pendingAmt.toLocaleString('en-IN')}`}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-normal">
                                {'₹0'}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                if (activeMenu?.record.id === rec.id) {
                                  setActiveMenu(null);
                                } else {
                                  setActiveMenu({ record: rec, rect });
                                }
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 text-[#637A98] hover:text-[#102A4C] transition-colors cursor-pointer"
                              aria-label="Record actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Record Cards View (Shown on screens < 768px) */}
            <div className="md:hidden space-y-3.5">
              {paginatedRecords.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#DCE8F6] p-8 text-center text-[#637A98] text-xs shadow-2xs">
                  No matching records found.
                </div>
              ) : (
                paginatedRecords.map(rec => {
                  const isDelivered = rec.deliveryStatus === 'delivered';
                  const pendingAmt = Number(rec.pendingAmount) || 0;
                  const isSelected = selectedRecordIds.has(rec.id);
                  const totalBilled = Number(rec.totalAmount) || (Number(rec.quantity || 0) * Number(rec.unitPrice || 0));

                  return (
                    <div
                      key={rec.id}
                      className={`bg-white rounded-2xl border border-[#DCE8F6] p-3.5 sm:p-4 space-y-3 shadow-2xs transition-all ${
                        isSelected ? 'ring-2 ring-[#168BFF] bg-[#F4F9FF]' : 'hover:border-[#B8D7F9]'
                      }`}
                    >
                      {/* Row 1: Checkbox, Shop Name, Date/Location & 3-Dot Action Menu */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRecord(rec.id)}
                            className="w-4 h-4 mt-0.5 rounded border-[#D8E7F7] text-[#168BFF] focus:ring-[#168BFF] cursor-pointer flex-shrink-0"
                            aria-label={`Select record for ${rec.shopName}`}
                          />
                          <div 
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => setViewingRecord(rec)}
                          >
                            <div className="font-bold text-[#102A4C] text-[15px] leading-snug line-clamp-2">
                              {rec.shopName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-[#637A98]">
                              <span className="font-mono text-xs">{formatDateDisplay(rec.date)}</span>
                              {rec.shopName.includes(' - ') && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate text-xs">{rec.shopName.split(' - ')[1]}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Three-dot Action Menu (min 40px touch target) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (activeMenu?.record.id === rec.id) {
                              setActiveMenu(null);
                            } else {
                              setActiveMenu({ record: rec, rect });
                            }
                          }}
                          className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl text-[#637A98] hover:text-[#102A4C] hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0 -mr-1 -mt-1"
                          aria-label="Record actions"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Row 2: Subtle Light-Blue Product Panel */}
                      <div 
                        className="bg-[#F0F7FF] border border-[#D5E7FA] rounded-xl p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-[#E9F3FE] transition-colors"
                        onClick={() => setViewingRecord(rec)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[#102A4C] text-[13px] sm:text-sm truncate">
                            {rec.productName}
                          </div>
                          <div className="text-xs text-[#637A98] font-mono mt-0.5">
                            {`${rec.quantity} pcs × ₹${Number(rec.unitPrice || 0).toLocaleString('en-IN')}`}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#637A98] block">Total</span>
                          <span className="font-bold text-[#102A4C] text-sm tabular-nums whitespace-nowrap">
                            {`₹${totalBilled.toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Status Badges & Pay Button */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {isDelivered ? (
                            <span className="bg-[#E8F8EE] text-[#0E8345] border border-[#BDEBD0] px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-[#0E8345] flex-shrink-0" />
                              <span>Delivered</span>
                            </span>
                          ) : (
                            <span className="bg-[#FFF6E5] text-[#B56704] border border-[#FFE4B5] px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3 text-[#B56704] flex-shrink-0" />
                              <span>Pending</span>
                            </span>
                          )}

                          {pendingAmt > 0 ? (
                            <span className="bg-rose-50 text-[#D9381E] border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0">
                              {`₹${pendingAmt.toLocaleString('en-IN')} Due`}
                            </span>
                          ) : (
                            <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0">
                              Settled
                            </span>
                          )}
                        </div>

                        {/* Pay Button (Single line, min-w 68px, h 40px, emerald green) */}
                        {pendingAmt > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettlingRecord(rec);
                            }}
                            className="h-[40px] min-h-[40px] min-w-[68px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer flex-shrink-0"
                          >
                            <span>Pay</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            {filteredAndSortedRecords.length > 0 && (
              <div className="bg-white rounded-2xl md:rounded-none border border-[#D8E7F7] md:border-0 md:border-t md:border-[#D8E7F7] shadow-2xs md:shadow-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3.5 sm:px-4 py-3 text-xs text-[#637A98]">
                {/* Mobile Row 1 / Desktop Left: Showing X to Y of Z records */}
                <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                  <span className="text-xs">
                    Showing <span className="font-semibold text-[#102A4C]">{Math.min((currentPage - 1) * rowsPerPage + 1, filteredAndSortedRecords.length)}</span> to{' '}
                    <span className="font-semibold text-[#102A4C]">{Math.min(currentPage * rowsPerPage, filteredAndSortedRecords.length)}</span> of{' '}
                    <span className="font-semibold text-[#102A4C]">{filteredAndSortedRecords.length}</span> records
                  </span>
                  
                  {/* Desktop inline rows per page */}
                  <div className="hidden sm:flex items-center gap-1.5 ml-3">
                    <label htmlFor="rows-per-page" className="text-[#637A98] text-xs">Rows per page:</label>
                    <select
                      id="rows-per-page"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-[#D8E7F7] rounded-lg px-2 py-1 bg-white text-[#102A4C] text-xs focus:ring-1 focus:ring-[#168BFF] focus:outline-none cursor-pointer min-h-[36px]"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                {/* Mobile Row 2: Rows per page selector + pagination buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  {/* Mobile visible rows per page */}
                  <div className="flex sm:hidden items-center gap-1.5">
                    <label htmlFor="rows-per-page-mobile" className="text-[#637A98] text-xs">Rows:</label>
                    <select
                      id="rows-per-page-mobile"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-[#D8E7F7] rounded-lg px-2 py-1 bg-white text-[#102A4C] text-xs focus:ring-1 focus:ring-[#168BFF] focus:outline-none cursor-pointer min-h-[36px]"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 self-center sm:self-auto ml-auto sm:ml-0">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg border border-[#D8E7F7] bg-white text-[#637A98] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) => (
                          typeof item === 'string' ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-[#637A98] text-xs">...</span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setCurrentPage(item)}
                              className={`min-w-[36px] min-h-[36px] sm:min-w-[28px] sm:h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                                currentPage === item
                                  ? 'bg-[#168BFF] text-white shadow-2xs'
                                  : 'bg-white border border-[#D8E7F7] text-[#102A4C] hover:bg-slate-50'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        ))}
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg border border-[#D8E7F7] bg-white text-[#637A98] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Menu (Rendered via React Portal into document.body to avoid table overflow clipping) */}
      {activeMenu && (
        <RecordActionsMenu
          record={activeMenu.record}
          anchorRect={activeMenu.rect}
          onClose={() => setActiveMenu(null)}
          onViewDetails={handleViewRecord}
          onEdit={handleEditRecord}
          onRecordPayment={handleOpenSettleModal}
          onDelete={handleDeleteRecord}
        />
      )}

      {/* Record Details Modal */}
      {viewingRecord && (
        <RecordDetailsModal
          isOpen={true}
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
          onEdit={handleEditRecord}
          onRecordPayment={handleOpenSettleModal}
        />
      )}

      {/* Settle Payment Modal */}
      {settlingRecord && (
        <SettlePaymentModal
          isOpen={true}
          record={settlingRecord}
          onClose={() => setSettlingRecord(null)}
          onSuccess={handlePaymentSettled}
        />
      )}

      {/* Responsive Add / Edit Record Modal/Drawer (Opened only when clicked) */}
      <RecordEntryDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingRecord(null);
        }}
        onSuccess={handleRecordSaved}
        shops={shops}
        products={products}
        editingRecord={editingRecord}
      />
    </div>
  );
};

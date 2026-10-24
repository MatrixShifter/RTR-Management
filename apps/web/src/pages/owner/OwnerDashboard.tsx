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
  ShieldCheck
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
          1. HEADER (Compact, Calm, Professional)
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Records
            </h1>
            <span className="sr-only">Wholesale Operations Overview RTR Management</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your shop deliveries and pending payments
          </p>
        </div>

        {/* Right Controls: Search & Account */}
        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search shop or product..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 shadow-2xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* User Profile Dropdown Button */}
          <div className="relative profile-dropdown-container">
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-1 pr-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
            >
              <div className="w-6 h-6 rounded-md bg-[#0F172A] text-white flex items-center justify-center font-bold text-[10px] tracking-tight">
                {userInitials}
              </div>
              <span className="text-xs font-medium text-slate-700 hidden sm:inline max-w-[100px] truncate">
                {userName}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fade-in text-xs text-slate-700">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || 'owner@rtrmobiles.com'}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {currentUser?.role ? currentUser.role.toUpperCase() : 'BUSINESS OWNER'}
                  </span>
                </div>
                <div className="py-1">
                  <a 
                    href="/settings" 
                    className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings &amp; Account</span>
                  </a>
                </div>
                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={() => {
                      localStorage.removeItem('rtr_current_user');
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-1.5 text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
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
          1.5 DEMO SANDBOX BANNER (Compact informational strip)
         ======================================================== */}
      {isDemoMode() && (
        <div 
          role="region"
          aria-label="Demo Sandbox Notification"
          className="px-3.5 py-2 rounded-lg bg-amber-50/70 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-fade-in"
        >
          <div className="flex items-center gap-2 text-amber-950 min-w-0">
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-200/80 text-amber-900 uppercase tracking-wide flex items-center gap-1 flex-shrink-0">
              <ShieldCheck className="w-3 h-3 text-amber-800" />
              <span>Isolated Mode</span>
            </span>
            <span className="font-semibold text-amber-900 hidden sm:inline">
              Interactive Demo Sandbox:
            </span>
            <span className="text-amber-800/90 truncate">
              Displaying pre-loaded sample records. Real customer databases, shops, and payments are protected and isolated.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={async () => {
                resetDemoData();
                await loadData();
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Reset sample demo data back to pristine default state"
            >
              <RotateCcw className="w-3 h-3 text-amber-700" />
              <span>Reset Demo Data</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          2. SUMMARY METRICS (Compact, High Information-Density)
         ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Card 1: Total Deliveries */}
        <div 
          onClick={() => setFilterMode(filterMode === 'delivery' ? 'all' : 'delivery')}
          className={`p-3.5 sm:p-4 rounded-lg border transition-all cursor-pointer relative bg-white ${
            filterMode === 'delivery' 
              ? 'border-blue-500 ring-2 ring-blue-500/15 shadow-2xs' 
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">
                  Total Deliveries
                </span>
                <span className="sr-only">Delivery Records</span>
              </div>
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                  {deliveryRecordsCount}
                </span>
                {totalDeliveredUnits > 0 && (
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {totalDeliveredUnits.toLocaleString('en-IN')} pcs
                  </span>
                )}
              </div>
            </div>
            <div className="text-slate-400 pt-0.5">
              <ChevronRight className={`w-4 h-4 transition-transform ${filterMode === 'delivery' ? 'rotate-90 text-blue-600' : ''}`} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>
              {totalDeliveredUnits > 0
                ? `${totalDeliveredUnits.toLocaleString('en-IN')} total units delivered`
                : 'Records delivered to shops'
              }
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              {filterMode === 'delivery' ? 'Filter Active' : 'Click to filter'}
            </span>
          </p>
          <div className="sr-only">
            Delivery Records Total Units Delivered: {totalDeliveredUnits} pcs
          </div>
        </div>

        {/* Card 2: Pending Payments */}
        <div 
          onClick={() => setFilterMode(filterMode === 'pending' ? 'all' : 'pending')}
          className={`p-3.5 sm:p-4 rounded-lg border transition-all cursor-pointer relative bg-white ${
            filterMode === 'pending' 
              ? 'border-amber-500 ring-2 ring-amber-500/15 shadow-2xs' 
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-slate-600">
                  Pending Payments
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                  {pendingRecordsCount}
                </span>
                {totalPendingMoney > 0 && (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded tabular-nums">
                    ₹{totalPendingMoney.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-slate-400 pt-0.5">
              <ChevronRight className={`w-4 h-4 transition-transform ${filterMode === 'pending' ? 'rotate-90 text-amber-600' : ''}`} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>
              {totalPendingMoney > 0 
                ? `₹${totalPendingMoney.toLocaleString('en-IN')} total outstanding balance`
                : 'All shop accounts fully settled'
              }
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              {filterMode === 'pending' ? 'Filter Active' : 'Click to filter'}
            </span>
          </p>
          <div className="sr-only">
            Total Balance Due: ₹{totalPendingMoney.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* ========================================================
          3. FILTERS & ACTIONS TOOLBAR (One-Row Aligned)
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-0.5">
        {/* Left: Clean Segmented View Tabs */}
        <div className="inline-flex bg-slate-100/90 p-0.5 rounded-lg border border-slate-200 text-xs select-none">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Records</span>
            <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-medium ${
              filterMode === 'all' ? 'bg-slate-100 text-slate-700' : 'text-slate-500'
            }`}>
              {allRecordsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('delivery')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterMode === 'delivery'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Deliveries</span>
            <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-medium ${
              filterMode === 'delivery' ? 'bg-slate-100 text-slate-700' : 'text-slate-500'
            }`}>
              {deliveryRecordsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterMode === 'pending'
                ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending</span>
            <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-medium ${
              filterMode === 'pending' ? 'bg-amber-100 text-amber-800' : 'text-amber-700'
            }`}>
              {pendingRecordsCount}
            </span>
          </button>
        </div>

        {/* Right: Shop Filter & Add Record Action */}
        <div className="flex items-center gap-2">
          {/* Shop Filters Dropdown */}
          <div className="relative filter-dropdown-container">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`border px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer ${
                selectedShopFilter !== 'all' || isFilterDropdownOpen
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {selectedShopFilter === 'all' 
                  ? 'Filters' 
                  : (shops.find(s => s.id === selectedShopFilter)?.name || 'Filtered Shop')}
              </span>
              {selectedShopFilter !== 'all' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 z-50 animate-fade-in text-xs">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                  <span className="font-semibold text-slate-600 text-[10px] uppercase tracking-wider">
                    Filter by Shop
                  </span>
                  {(selectedShopFilter !== 'all' || filterMode !== 'all' || searchQuery) && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-blue-600 text-[11px] font-medium hover:underline cursor-pointer"
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
                      selectedShopFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
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
                        selectedShopFilter === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA: + Add Record */}
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setIsDrawerOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" aria-hidden="true" />
            <span aria-hidden="true">Add Record</span>
            <span className="sr-only">+ Add Record</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          4. MAIN CONTENT AREA (Full-Width Records Table)
         ======================================================== */}
      <div className="w-full">
        {records.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-2xs text-center">
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
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    {/* Checkbox */}
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label="Select all records"
                      />
                    </th>

                    {/* Date */}
                    <th 
                      onClick={() => handleSort('date')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Date</span>
                        {sortField === 'date' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Shop Name */}
                    <th 
                      onClick={() => handleSort('shop')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Shop Name</span>
                        <span className="sr-only">Retail Shop</span>
                        {sortField === 'shop' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Product */}
                    <th 
                      onClick={() => handleSort('product')}
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Product</span>
                        {sortField === 'product' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Quantity */}
                    <th 
                      onClick={() => handleSort('quantity')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Quantity</span>
                        {sortField === 'quantity' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Unit Price */}
                    <th 
                      onClick={() => handleSort('unitPrice')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Unit Price</span>
                        {sortField === 'unitPrice' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Status */}
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      <span>Status</span>
                      <span className="sr-only">Delivery Status</span>
                    </th>

                    {/* Pending Amount */}
                    <th 
                      onClick={() => handleSort('pendingAmount')}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <div className="inline-flex items-center gap-1 justify-end w-full">
                        <span>Pending Amount</span>
                        {sortField === 'pendingAmount' && (
                          <span className="text-blue-600 text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="py-2.5 px-3 text-right whitespace-nowrap w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map(rec => {
                      const isDelivered = rec.deliveryStatus === 'delivered';
                      const pendingAmt = Number(rec.pendingAmount) || 0;
                      const isSelected = selectedRecordIds.has(rec.id);

                      return (
                        <tr 
                          key={rec.id} 
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRecord(rec.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {formatDateDisplay(rec.date)}
                          </td>

                          {/* Shop Name */}
                          <td className="py-3.5 px-3 font-medium text-slate-900 whitespace-nowrap max-w-[200px] truncate" title={rec.shopName}>
                            {rec.shopName}
                          </td>

                          {/* Product */}
                          <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap max-w-[220px] truncate" title={rec.productName}>
                            {rec.productName}
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-3 text-right text-slate-800 tabular-nums whitespace-nowrap">
                            <span className="font-medium">{rec.quantity}</span>
                            <span className="text-[10px] text-slate-400 ml-1">pcs</span>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3.5 px-3 text-right text-slate-800 tabular-nums whitespace-nowrap">
                            ₹{Number(rec.unitPrice || 0).toLocaleString('en-IN')}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isDelivered ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                <span>Delivered</span>
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Pending Amount */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap tabular-nums">
                            {pendingAmt > 0 ? (
                              <span className="text-amber-800 font-semibold bg-amber-50/80 border border-amber-200/60 px-2 py-0.5 rounded text-[11px]">
                                ₹{pendingAmt.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-normal">
                                ₹0
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
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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

            {/* Pagination Footer */}
            {filteredAndSortedRecords.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3.5 py-2.5 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>
                    Showing <span className="font-semibold text-slate-800">{Math.min((currentPage - 1) * rowsPerPage + 1, filteredAndSortedRecords.length)}</span> to{' '}
                    <span className="font-semibold text-slate-800">{Math.min(currentPage * rowsPerPage, filteredAndSortedRecords.length)}</span> of{' '}
                    <span className="font-semibold text-slate-800">{filteredAndSortedRecords.length}</span> records
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <label htmlFor="rows-per-page" className="text-slate-500 hidden sm:inline text-[11px]">Rows per page:</label>
                    <select
                      id="rows-per-page"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
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
                          <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">...</span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className={`min-w-[24px] h-6 rounded text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                              currentPage === item
                                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
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
                      className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
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

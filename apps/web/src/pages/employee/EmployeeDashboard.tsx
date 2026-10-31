import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Store, 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Shield, 
  AlertCircle,
  Eye,
  RefreshCw
} from 'lucide-react';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import { ErrorState } from '../../components/ui/StateViews.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { RecordDetailsModal } from '../../components/RecordDetailsModal.js';
import { 
  getBusinessRecords, 
  getAuthoritativeDeliveryStatus,
  type BusinessRecord 
} from '../../services/db.js';
import { calculateRecordProfit } from '@crimpston/shared';

export interface EmployeeDashboardProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    assignedShopId?: string;
    assignedShopName?: string;
    assignedShopCode?: string;
  };
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ currentUser }) => {
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'pending'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Selected record for read-only inspection
  const [selectedRecord, setSelectedRecord] = useState<BusinessRecord | null>(null);

  const assignedShopId = currentUser.assignedShopId;
  const assignedShopName = currentUser.assignedShopName || 'Assigned Retail Shop';
  const assignedShopCode = currentUser.assignedShopCode || '—';

  const loadShopRecords = useCallback(async () => {
    if (!assignedShopId) {
      setError('Your account is not currently assigned to an active shop. Please contact your manager.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Backend & database strictly enforce assignedShopId
      const data = await getBusinessRecords({ shopId: assignedShopId });
      setRecords(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load shop records. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [assignedShopId]);

  useEffect(() => {
    loadShopRecords();
  }, [loadShopRecords]);

  // Client-side filtering & search (Strictly scoped to assigned shop)
  const filteredRecords = useMemo(() => {
    let result = records;

    // Delivery Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => {
        const s = getAuthoritativeDeliveryStatus(r);
        return s === statusFilter;
      });
    }

    // Exact Date filter
    if (dateFilter) {
      result = result.filter(r => {
        const rawDate = r.date || (r as any).delivery_date || '';
        return rawDate.startsWith(dateFilter);
      });
    }

    // Free-text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const prod = (r.productName || (r as any).product_name || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        const date = (r.date || (r as any).delivery_date || '').toLowerCase();
        return prod.includes(q) || notes.includes(q) || date.includes(q);
      });
    }

    return result;
  }, [records, statusFilter, dateFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  if (!assignedShopId) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-amber-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">No Assigned Shop Found</h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Your employee account is currently active, but you have not been assigned to a retail store. Please notify your business owner to assign your shop.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ========================================================
          1. HEADER WITH ASSIGNED SHOP BANNER
         ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              My Shop Records
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold uppercase tracking-wider">
              <Shield className="w-3 h-3 text-blue-600" />
              Shop Employee (Read-Only)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{currentUser.name}</span> &bull; {currentUser.email}
          </p>
        </div>

        {/* Assigned Shop Identity Card */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 self-start md:self-auto">
          <div className="w-9 h-9 rounded-lg bg-[#168BFF]/10 text-[#168BFF] flex items-center justify-center font-bold flex-shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              {assignedShopName}
            </p>
            <p className="text-[11px] text-slate-500">
              Code: <span className="font-mono font-medium text-slate-700">{assignedShopCode}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. SEARCH & FILTER CONTROLS (Read-only scoping)
         ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Free-text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name, date, or notes..."
              aria-label="Search records"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadShopRecords}
            disabled={isLoading}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 flex-shrink-0"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex-shrink-0">Status:</span>
          {(['all', 'delivered', 'pending'] as const).map(st => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap text-xs ${
                  isActive
                    ? 'bg-[#168BFF] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {st === 'all' ? 'All Deliveries' : st === 'delivered' ? 'Delivered' : 'Pending'}
              </button>
            );
          })}

          {(statusFilter !== 'all' || dateFilter || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('');
                setSearchQuery('');
              }}
              className="ml-auto text-xs font-medium text-rose-600 hover:underline cursor-pointer flex-shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          3. RECORDS TABLE (Strict 8 Columns, Pure Read-Only)
         ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={loadShopRecords} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No Records Found"
              description={
                searchQuery || statusFilter !== 'all' || dateFilter
                  ? "No shop records match the selected filter criteria."
                  : `No records currently exist for ${assignedShopName}.`
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#0C1E38] text-white text-[11px] sm:text-xs uppercase font-bold tracking-wider select-none">
                  <th className="py-3 px-3 sm:px-4">Date</th>
                  <th className="py-3 px-3 sm:px-4">Shop Name</th>
                  <th className="py-3 px-3 sm:px-4">Product</th>
                  <th className="py-3 px-2 sm:px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Amount</th>
                  <th className="py-3 px-3 sm:px-4 text-right">CP</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Profit / Loss</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Delivery</th>
                  <th className="py-3 px-2 text-center w-10">
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map(record => {
                  const isDeliv = getAuthoritativeDeliveryStatus(record) === 'delivered';
                  const totalAmt = Number(record.totalAmount ?? (record as any).total_amount) || 0;
                  const rawCp = record.customerPrice ?? (record as any).customer_price ?? null;
                  const parsedCp = rawCp !== null && rawCp !== undefined && rawCp !== '' && !isNaN(Number(rawCp)) ? Number(rawCp) : null;
                  
                  const rawProfit = record.profit ?? (record as any).profit ?? null;
                  const resolvedProfit = (rawProfit !== null && rawProfit !== undefined && rawProfit !== '' && !isNaN(Number(rawProfit)))
                    ? Number(rawProfit)
                    : (parsedCp !== null ? calculateRecordProfit(totalAmt, parsedCp) : null);

                  return (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      {/* 1. Date */}
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap font-medium text-slate-800">
                        {record.date || '—'}
                      </td>

                      {/* 2. Shop Name */}
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-none">
                        {record.shopName || assignedShopName}
                      </td>

                      {/* 3. Product */}
                      <td className="py-3 px-3 sm:px-4 text-slate-700 truncate max-w-[150px] sm:max-w-none">
                        {record.productName || 'Wholesale Item'}
                      </td>

                      {/* 4. Quantity */}
                      <td className="py-3 px-2 sm:px-3 text-right font-semibold text-slate-800 tabular-nums">
                        {record.quantity || 1}
                      </td>

                      {/* 5. Amount */}
                      <td className="py-3 px-3 sm:px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        ₹{totalAmt.toLocaleString('en-IN')}
                      </td>

                      {/* 6. CP (Customer Price) */}
                      <td className="py-3 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap font-medium">
                        {parsedCp !== null ? (
                          <span className="text-slate-900 font-semibold">₹{parsedCp.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Not Recorded</span>
                        )}
                      </td>

                      {/* 7. Profit / Loss */}
                      <td className="py-3 px-3 sm:px-4 text-right tabular-nums whitespace-nowrap">
                        {resolvedProfit !== null ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs ${
                              resolvedProfit > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : resolvedProfit === 0
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {resolvedProfit > 0
                              ? `+₹${resolvedProfit.toLocaleString('en-IN')}`
                              : resolvedProfit === 0
                              ? '₹0'
                              : `-₹${Math.abs(resolvedProfit).toLocaleString('en-IN')}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Not Recorded</span>
                        )}
                      </td>

                      {/* 8. Delivery Status (Strictly Read-Only Badge) */}
                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            isDeliv
                              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/70'
                              : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/70'
                          }`}
                        >
                          {isDeliv ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Delivered</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Eye inspect icon */}
                      <td className="py-3 px-2 text-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <Eye className="w-4 h-4 mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================
            4. PAGINATION FOOTER
           ======================================================== */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, filteredRecords.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{filteredRecords.length}</span> shop records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-semibold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          5. PURE READ-ONLY RECORD DETAILS MODAL
         ======================================================== */}
      {selectedRecord && (
        <RecordDetailsModal
          isOpen={true}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          // Omit onToggleDelivery and onDelete for strict 100% read-only interaction
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;

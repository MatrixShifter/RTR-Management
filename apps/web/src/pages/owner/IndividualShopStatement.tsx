import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  Download, 
  Printer, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  ArrowUpDown, 
  Package, 
  Store,
  RefreshCw,
  Calendar,
  ChevronLeft,
  X
} from 'lucide-react';
import { 
  type Shop, 
  type BusinessRecord,
  getShops, 
  getBusinessRecords, 
  normalizeDateString 
} from '../../services/db.js';
import { RecordDetailsModal } from '../../components/RecordDetailsModal.js';
import { TableSkeleton } from '../../components/ui/Skeleton.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface IndividualShopStatementProps {
  initialShops?: Shop[];
  initialRecords?: BusinessRecord[];
  shopIdOverride?: string;
}

export interface IndividualProductBreakdownItem {
  productId: string;
  productName: string;
  productSku: string;
  totalQuantity: number;
  transactionCount: number;
  totalAmount: number;
  totalCustomerPrice: number;
  totalProfit: number;
  recordsWithCpCount: number;
  missingCpCount: number;
  profitMarginPercent: number | null;
  records: BusinessRecord[];
}

export const IndividualShopStatement: React.FC<IndividualShopStatementProps> = ({
  initialShops,
  initialRecords,
  shopIdOverride
}) => {
  const params = useParams<{ shopId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const targetShopId = shopIdOverride || params.shopId || '';

  // Extract query parameters with fallbacks
  const currentDate = new Date();
  const defaultYear = currentDate.getFullYear();
  const defaultMonth = currentDate.getMonth() + 1;

  const urlMonth = parseInt(searchParams.get('month') || '', 10);
  const urlYear = parseInt(searchParams.get('year') || '', 10);
  const urlStatus = searchParams.get('status');

  const initialMonth = !isNaN(urlMonth) && urlMonth >= 1 && urlMonth <= 12 ? urlMonth : defaultMonth;
  const initialYear = !isNaN(urlYear) && urlYear >= 2020 && urlYear <= 2040 ? urlYear : defaultYear;
  const initialStatus: 'all' | 'delivered' | 'pending' = 
    urlStatus === 'delivered' || urlStatus === 'pending' ? urlStatus : 'all';

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'pending'>(initialStatus);

  // Search & Sorting & Pagination for Transaction History
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('__all__');
  const [historySortField, setHistorySortField] = useState<'date' | 'amount' | 'profit' | 'quantity'>('date');
  const [historySortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Product-wise sorting & accordion expansion state
  const [productSortField, setProductSortField] = useState<'profit' | 'amount' | 'quantity'>('profit');
  const [productSortAsc, setProductSortAsc] = useState<boolean>(false);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Data Loading State
  const [shops, setShops] = useState<Shop[]>(initialShops || []);
  const [records, setRecords] = useState<BusinessRecord[]>(initialRecords || []);
  const [loading, setLoading] = useState<boolean>(!initialShops || !initialRecords);
  const [, setError] = useState<string | null>(null);

  // Record Inspection Modal
  const [inspectRecord, setInspectRecord] = useState<BusinessRecord | null>(null);

  // Synchronize URL query params whenever filters change
  const updateFilters = useCallback((newMonth: number, newYear: number, newStatus: 'all' | 'delivered' | 'pending') => {
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setStatusFilter(newStatus);
    setCurrentPage(1);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', String(newMonth));
    nextParams.set('year', String(newYear));
    nextParams.set('status', newStatus);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load authorized catalog and business records
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedShops, fetchedRecords] = await Promise.all([
        getShops(),
        getBusinessRecords()
      ]);
      setShops(fetchedShops);
      setRecords(fetchedRecords);
    } catch (err: any) {
      console.error('Failed to load statement data:', err);
      setError(err?.message || 'Failed to load shop statement data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialShops || !initialRecords) {
      loadData();
    }
  }, [loadData, initialShops, initialRecords]);

  // Resolve target shop entity
  const shop = useMemo(() => {
    if (!targetShopId) return null;
    return shops.find(s => 
      s.id === targetShopId || 
      (s.code && s.code.toLowerCase() === targetShopId.toLowerCase()) ||
      s.name.trim().toLowerCase() === targetShopId.trim().toLowerCase()
    ) || null;
  }, [shops, targetShopId]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(defaultYear);
    years.add(defaultYear - 1);
    records.forEach(r => {
      const norm = normalizeDateString(r.date);
      if (norm.length >= 4) {
        const y = parseInt(norm.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records, defaultYear]);

  // Filter records strictly belonging to this authorized shop
  const shopRecords = useMemo(() => {
    if (!shop && !loading) {
      // If shop object not matched yet, attempt matching by ID or name in records
      return records.filter(r => 
        r.shopId === targetShopId || 
        (r.shopName && r.shopName.trim().toLowerCase() === targetShopId.trim().toLowerCase())
      );
    }
    if (!shop) return [];
    return records.filter(r => 
      r.shopId === shop.id || 
      (r.shopName && r.shopName.trim().toLowerCase() === shop.name.trim().toLowerCase())
    );
  }, [records, shop, targetShopId, loading]);

  // Filter shop records by selected Month, Year, and Delivery Status
  const periodFilteredRecords = useMemo(() => {
    const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return shopRecords.filter(r => {
      const norm = normalizeDateString(r.date);
      if (!norm.startsWith(targetMonthStr)) return false;
      if (statusFilter !== 'all' && r.deliveryStatus !== statusFilter) return false;
      return true;
    });
  }, [shopRecords, selectedYear, selectedMonth, statusFilter]);

  // Available products for filter dropdown
  const availableProducts = useMemo(() => {
    const prodMap = new Map<string, string>();
    periodFilteredRecords.forEach(r => {
      const pId = r.productId || r.productName;
      if (!prodMap.has(pId)) {
        prodMap.set(pId, r.productName);
      }
    });
    return Array.from(prodMap.entries()).map(([id, name]) => ({ id, name }));
  }, [periodFilteredRecords]);

  // Financial Summary Cards Metrics
  const summaryMetrics = useMemo(() => {
    let transCount = 0;
    let qtyCount = 0;
    let totalAmt = 0;
    let totalCp = 0;
    let totalProfit = 0;
    let withCpCount = 0;
    let missingCpCount = 0;
    let deliveredCount = 0;
    let pendingCount = 0;

    periodFilteredRecords.forEach(r => {
      transCount += 1;
      qtyCount += (Number(r.quantity) || 1);
      totalAmt += (Number(r.totalAmount) || 0);

      if (r.deliveryStatus === 'delivered') {
        deliveredCount += 1;
      } else {
        pendingCount += 1;
      }

      if (r.customerPrice !== undefined && r.customerPrice !== null && !isNaN(Number(r.customerPrice))) {
        const cpVal = Number(r.customerPrice);
        totalCp += cpVal;
        withCpCount += 1;
        if (r.profit !== undefined && r.profit !== null && !isNaN(Number(r.profit))) {
          totalProfit += Number(r.profit);
        } else {
          totalProfit += (cpVal - Number(r.totalAmount || 0));
        }
      } else {
        missingCpCount += 1;
      }
    });

    const marginPercent = withCpCount > 0 && totalAmt > 0
      ? Math.round((totalProfit / totalAmt) * 1000) / 10
      : null;

    return {
      transactionCount: transCount,
      totalQuantity: qtyCount,
      totalAmount: Math.round(totalAmt * 100) / 100,
      totalCustomerPrice: Math.round(totalCp * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      recordsWithCpCount: withCpCount,
      missingCpCount,
      deliveredCount,
      pendingCount,
      profitMarginPercent: marginPercent
    };
  }, [periodFilteredRecords]);

  // Product-wise Purchase & Profit Breakdown (Grouped by actual product identity)
  const productBreakdownList: IndividualProductBreakdownItem[] = useMemo(() => {
    const prodMap = new Map<string, {
      productId: string;
      productName: string;
      productSku: string;
      totalQuantity: number;
      transactionCount: number;
      totalAmount: number;
      totalCustomerPrice: number;
      totalProfit: number;
      recordsWithCpCount: number;
      missingCpCount: number;
      records: BusinessRecord[];
    }>();

    for (const r of periodFilteredRecords) {
      const key = r.productId || r.productName;
      let existing = prodMap.get(key);
      if (!existing) {
        existing = {
          productId: r.productId || '',
          productName: r.productName,
          productSku: r.productSku || '',
          totalQuantity: 0,
          transactionCount: 0,
          totalAmount: 0,
          totalCustomerPrice: 0,
          totalProfit: 0,
          recordsWithCpCount: 0,
          missingCpCount: 0,
          records: []
        };
        prodMap.set(key, existing);
      }

      existing.totalQuantity += (Number(r.quantity) || 1);
      existing.transactionCount += 1;
      existing.totalAmount += (Number(r.totalAmount) || 0);
      existing.records.push(r);

      if (r.customerPrice !== undefined && r.customerPrice !== null && !isNaN(Number(r.customerPrice))) {
        const cpVal = Number(r.customerPrice);
        existing.totalCustomerPrice += cpVal;
        existing.recordsWithCpCount += 1;
        if (r.profit !== undefined && r.profit !== null && !isNaN(Number(r.profit))) {
          existing.totalProfit += Number(r.profit);
        } else {
          existing.totalProfit += (cpVal - Number(r.totalAmount || 0));
        }
      } else {
        existing.missingCpCount += 1;
      }
    }

    const items: IndividualProductBreakdownItem[] = Array.from(prodMap.values()).map(p => {
      const margin = p.recordsWithCpCount > 0 && p.totalAmount > 0
        ? Math.round((p.totalProfit / p.totalAmount) * 1000) / 10
        : null;

      return {
        ...p,
        totalAmount: Math.round(p.totalAmount * 100) / 100,
        totalCustomerPrice: Math.round(p.totalCustomerPrice * 100) / 100,
        totalProfit: Math.round(p.totalProfit * 100) / 100,
        profitMarginPercent: margin,
        // Sort individual transactions within product newest date first
        records: [...p.records].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      };
    });

    items.sort((a, b) => {
      if (productSortField === 'profit') {
        return productSortAsc ? a.totalProfit - b.totalProfit : b.totalProfit - a.totalProfit;
      }
      if (productSortField === 'amount') {
        return productSortAsc ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
      }
      return productSortAsc ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
    });

    return items;
  }, [periodFilteredRecords, productSortField, productSortAsc]);

  // Toggle Accordion Expansion for a Product
  const toggleExpandProduct = (productId: string) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Complete Transaction History (with Search, Product Filter, Sorting, Pagination)
  const filteredTransactions = useMemo(() => {
    let list = [...periodFilteredRecords];

    // Filter by specific product if selected
    if (selectedProductFilter !== '__all__') {
      list = list.filter(r => (r.productId || r.productName) === selectedProductFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(r => 
        r.productName.toLowerCase().includes(term) ||
        (r.productSku && r.productSku.toLowerCase().includes(term)) ||
        r.date.includes(term)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (historySortField === 'amount') {
        const amtA = Number(a.totalAmount) || 0;
        const amtB = Number(b.totalAmount) || 0;
        return historySortAsc ? amtA - amtB : amtB - amtA;
      }
      if (historySortField === 'profit') {
        const profA = a.profit !== undefined && a.profit !== null ? Number(a.profit) : -Infinity;
        const profB = b.profit !== undefined && b.profit !== null ? Number(b.profit) : -Infinity;
        return historySortAsc ? profA - profB : profB - profA;
      }
      if (historySortField === 'quantity') {
        const qA = Number(a.quantity) || 0;
        const qB = Number(b.quantity) || 0;
        return historySortAsc ? qA - qB : qB - qA;
      }
      // Default: date descending
      const comp = (b.date || '').localeCompare(a.date || '');
      return historySortAsc ? -comp : comp;
    });

    return list;
  }, [periodFilteredRecords, selectedProductFilter, searchTerm, historySortField, historySortAsc]);

  // Paginated Transaction History
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredTransactions.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredTransactions, currentPage, rowsPerPage]);

  // Export to CSV / Excel
  const handleExportCSV = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    const sName = shop?.name || targetShopId;
    const sCode = shop?.code || targetShopId;
    let csv = '';

    csv += `RTR MOBILES — INDIVIDUAL SHOP PURCHASE & PROFIT STATEMENT\n`;
    csv += `Shop Name: "${sName}"\n`;
    csv += `Shop Code / ID: "${sCode}"\n`;
    csv += `Statement Period: ${monthName} ${selectedYear}\n`;
    csv += `Delivery Status Scope: ${statusFilter.toUpperCase()}\n`;
    csv += `Generated Date: ${new Date().toLocaleString('en-IN')}\n\n`;

    csv += `1. FINANCIAL OVERVIEW SUMMARY\n`;
    csv += `Total Wholesale Cost (Amount),Total Customer Selling Price (CP),Gross Profit,Profit Margin %,Orders Count,Total Quantity (pcs),Delivered Count,Pending Count,Missing CP Records\n`;
    csv += `₹${summaryMetrics.totalAmount},₹${summaryMetrics.totalCustomerPrice},₹${summaryMetrics.totalProfit},${summaryMetrics.profitMarginPercent !== null ? `${summaryMetrics.profitMarginPercent}%` : 'N/A'},${summaryMetrics.transactionCount},${summaryMetrics.totalQuantity},${summaryMetrics.deliveredCount},${summaryMetrics.pendingCount},${summaryMetrics.missingCpCount}\n\n`;

    csv += `2. PRODUCT-WISE BREAKDOWN\n`;
    csv += `Product Name,Product SKU,Quantity (pcs),Orders Count,Wholesale Cost (₹),Customer Price (₹),Gross Profit (₹),Profit Margin %,Missing CP Records\n`;
    productBreakdownList.forEach(p => {
      csv += `"${p.productName}","${p.productSku}",${p.totalQuantity},${p.transactionCount},${p.totalAmount},${p.totalCustomerPrice},${p.totalProfit},${p.profitMarginPercent !== null ? `${p.profitMarginPercent}%` : 'N/A'},${p.missingCpCount}\n`;
    });

    csv += `\n3. COMPLETE TRANSACTION HISTORY\n`;
    csv += `Date,Product Name,Quantity (pcs),Unit Price (₹),Wholesale Amount (₹),Customer Selling Price (₹),Gross Profit (₹),Delivery Status\n`;
    filteredTransactions.forEach(r => {
      const cpStr = r.customerPrice !== undefined && r.customerPrice !== null ? `₹${r.customerPrice}` : 'Not Recorded';
      const profitStr = r.profit !== undefined && r.profit !== null 
        ? `${Number(r.profit) >= 0 ? '+' : '-'}₹${Math.abs(Number(r.profit))}` 
        : 'Not Available';
      csv += `"${r.date}","${r.productName}",${r.quantity},${r.unitPrice},${r.totalAmount},"${cpStr}","${profitStr}","${r.deliveryStatus}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeShopStr = sName.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `RTR_Statement_${safeShopStr}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Statement / Export PDF
  const handlePrint = () => {
    window.print();
  };

  // Render Skeleton while initial loading
  if (loading && records.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in p-4 sm:p-6 max-w-[1400px] mx-auto">
        <div className="h-10 bg-slate-200 rounded-xl w-64 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  // Render Error State if Shop ID is invalid or cannot be found
  if (!loading && !shop && shopRecords.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 sm:p-12 text-center max-w-lg mx-auto my-12 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#102A4C]">Shop Not Found</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          The requested retail shop <strong className="text-slate-800 font-semibold font-mono">"{targetShopId}"</strong> was not found in your business catalog, or you do not have permission to view its statement.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/statements"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#168BFF] hover:bg-[#0E7BE5] text-white text-sm font-semibold transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Statements</span>
          </Link>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const shopDisplayName = shop?.name || targetShopId;
  const shopDisplayCode = shop?.code || shop?.id || targetShopId;

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4 max-w-[1400px] mx-auto pb-12">
      {/* 1. Header & Actions Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#DCE4EC] pb-5 print:border-none print:pb-0">
        <div>
          {/* Navigation link back to consolidated Statements page */}
          <div className="mb-2 print:hidden">
            <Link
              to={`/statements?month=${selectedMonth}&year=${selectedYear}&status=${statusFilter}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#168BFF] hover:text-[#0E7BE5] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Consolidated Statements</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#168BFF]/10 text-[#168BFF] flex items-center justify-center flex-shrink-0">
              <Store className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#102A4C] tracking-tight">
                  {shopDisplayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {`Shop ID: ${shopDisplayCode}`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Monthly Purchase & Profit Statement</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">
                  {`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh shop statement"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || periodFilteredRecords.length === 0}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#102A4C] hover:bg-[#152744] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 print:hidden">
        {/* Month Selector */}
        <div>
          <label htmlFor="shop-statement-month-select" className="block text-xs font-semibold text-slate-700 mb-1">
            Statement Month
          </label>
          <div className="relative">
            <select
              id="shop-statement-month-select"
              value={selectedMonth}
              onChange={e => updateFilters(Number(e.target.value), selectedYear, statusFilter)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Year Selector */}
        <div>
          <label htmlFor="shop-statement-year-select" className="block text-xs font-semibold text-slate-700 mb-1">
            Year
          </label>
          <div className="relative">
            <select
              id="shop-statement-year-select"
              value={selectedYear}
              onChange={e => updateFilters(selectedMonth, Number(e.target.value), statusFilter)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delivery Status Selector */}
        <div>
          <label htmlFor="shop-statement-status-select" className="block text-xs font-semibold text-slate-700 mb-1">
            Delivery Status
          </label>
          <div className="relative">
            <select
              id="shop-statement-status-select"
              value={statusFilter}
              onChange={e => updateFilters(selectedMonth, selectedYear, e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
            >
              <option value="all">All Deliveries (Delivered & Pending)</option>
              <option value="delivered">Delivered Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Printable Header Details (Visible only on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">RTR MOBILES — WHOLESALE MANAGEMENT</h1>
            <h2 className="text-sm font-semibold text-slate-800 mt-0.5">
              Individual Shop Statement: {shopDisplayName} ({shopDisplayCode})
            </h2>
            <p className="text-xs text-slate-600">
              Period: {MONTH_NAMES[selectedMonth - 1]} {selectedYear} | Status: {statusFilter.toUpperCase()}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* 3. Financial Overview Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Wholesale Cost (Amount) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Wholesale Cost (Amount)
          </span>
          <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
            {`₹${summaryMetrics.totalAmount.toLocaleString('en-IN')}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium truncate">
            {shopDisplayName}
          </div>
        </div>

        {/* Card 2: Customer Selling Price (CP) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Customer Selling Price (CP)
          </span>
          <div className="text-lg sm:text-2xl font-black text-[#168BFF] mt-1 tabular-nums">
            {`₹${summaryMetrics.totalCustomerPrice.toLocaleString('en-IN')}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            {summaryMetrics.missingCpCount > 0 ? (
              <span className="text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>{`${summaryMetrics.missingCpCount} records missing CP`}</span>
              </span>
            ) : (
              <span className="text-emerald-600 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>All customer prices recorded</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Gross Profit / Loss */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Gross Profit / Loss
          </span>
          <div className={`text-lg sm:text-2xl font-black mt-1 tabular-nums ${
            summaryMetrics.totalProfit > 0 
              ? 'text-emerald-600' 
              : summaryMetrics.totalProfit === 0 
                ? 'text-slate-700' 
                : 'text-rose-600'
          }`}>
            {summaryMetrics.totalProfit > 0 
              ? `+₹${summaryMetrics.totalProfit.toLocaleString('en-IN')}` 
              : summaryMetrics.totalProfit === 0 
                ? '₹0' 
                : `-₹${Math.abs(summaryMetrics.totalProfit).toLocaleString('en-IN')}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">
            {summaryMetrics.profitMarginPercent !== null ? (
              <span className={
                summaryMetrics.profitMarginPercent > 0 
                  ? 'text-emerald-700' 
                  : summaryMetrics.profitMarginPercent === 0 
                    ? 'text-slate-600' 
                    : 'text-rose-600'
              }>
                {`${summaryMetrics.profitMarginPercent}% Margin on Cost`}
              </span>
            ) : (
              <span className="text-slate-400 italic">Profit N/A</span>
            )}
          </div>
        </div>

        {/* Card 4: Orders & Quantity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Orders & Quantity
          </span>
          <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
            {`${summaryMetrics.transactionCount} Orders`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center justify-between">
            <span>{`${summaryMetrics.totalQuantity} total pcs`}</span>
            <span className="text-slate-400">
              {`Del: ${summaryMetrics.deliveredCount} | Pend: ${summaryMetrics.pendingCount}`}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Product-wise Purchase & Profit Breakdown (Critical Section) */}
      <div className="bg-white rounded-2xl border border-[#DCE4EC] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#102A4C] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#168BFF]" />
              <span>Product-wise Purchase & Profit Breakdown</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated by actual product identity. Click on any product row to inspect its contributing transactions.
            </p>
          </div>

          {/* Product Sorting Controls */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto print:hidden">
            <span className="text-xs font-semibold text-slate-400">Sort by:</span>
            <button
              type="button"
              onClick={() => {
                if (productSortField === 'profit') setProductSortAsc(!productSortAsc);
                else { setProductSortField('profit'); setProductSortAsc(false); }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                productSortField === 'profit' ? 'bg-[#102A4C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Profit</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (productSortField === 'amount') setProductSortAsc(!productSortAsc);
                else { setProductSortField('amount'); setProductSortAsc(false); }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                productSortField === 'amount' ? 'bg-[#102A4C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Amount</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (productSortField === 'quantity') setProductSortAsc(!productSortAsc);
                else { setProductSortField('quantity'); setProductSortAsc(false); }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                productSortField === 'quantity' ? 'bg-[#102A4C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Quantity</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {productBreakdownList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">
              No products supplied to {shopDisplayName} during {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-smooth touch-pan-x">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-[#F8FAFC] text-[#334155] font-semibold border-b border-[#CBD5E1] select-none">
                <tr>
                  <th className="py-3 px-3 sm:px-4 w-10 text-center print:hidden">#</th>
                  <th className="py-3 px-3 sm:px-4 text-left min-w-[140px]">Product Name</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Total Qty</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Orders</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Wholesale Cost (₹)</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Customer Price (₹)</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Profit (₹)</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {productBreakdownList.map((prod) => {
                  const isExpanded = expandedProductIds.has(prod.productId || prod.productName);
                  const hasMissingCp = prod.missingCpCount > 0;

                  return (
                    <React.Fragment key={prod.productId || prod.productName}>
                      <tr 
                        onClick={() => toggleExpandProduct(prod.productId || prod.productName)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Expand Accordion Trigger */}
                        <td className="py-3 px-3 sm:px-4 text-center text-slate-400 print:hidden">
                          <button
                            type="button"
                            aria-label={`Toggle breakdown for ${prod.productName}`}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#168BFF]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 group-hover:text-slate-700" />
                            )}
                          </button>
                        </td>

                        {/* Product Name & SKU */}
                        <td className="py-3 px-3 sm:px-4 font-semibold text-[#102A4C]">
                          <div className="flex items-center gap-1.5">
                            <span>{prod.productName}</span>
                            {hasMissingCp && (
                              <span 
                                title={`${prod.missingCpCount} transaction(s) missing Customer Price`}
                                className="inline-flex items-center text-amber-500"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          {prod.productSku && (
                            <span className="text-[11px] font-mono text-slate-400 font-normal block mt-0.5">
                              {prod.productSku}
                            </span>
                          )}
                        </td>

                        {/* Total Quantity */}
                        <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-700 tabular-nums">
                          {`${prod.totalQuantity.toLocaleString('en-IN')} pcs`}
                        </td>

                        {/* Transactions Count */}
                        <td className="py-3 px-3 sm:px-4 text-center text-slate-600 font-medium tabular-nums">
                          {prod.transactionCount}
                        </td>

                        {/* Wholesale Cost (Amount) */}
                        <td className="py-3 px-3 sm:px-4 text-right font-medium text-[#102A4C] tabular-nums">
                          {`₹${prod.totalAmount.toLocaleString('en-IN')}`}
                        </td>

                        {/* Customer Price (CP) */}
                        <td className="py-3 px-3 sm:px-4 text-right font-medium text-[#168BFF] tabular-nums">
                          {prod.recordsWithCpCount > 0 ? (
                            <span>{`₹${prod.totalCustomerPrice.toLocaleString('en-IN')}`}</span>
                          ) : (
                            <span className="text-slate-400 italic">Not Recorded</span>
                          )}
                        </td>

                        {/* Gross Profit */}
                        <td className={`py-3 px-3 sm:px-4 text-right font-bold tabular-nums ${
                          prod.recordsWithCpCount === 0 
                            ? 'text-slate-400' 
                            : (prod.totalProfit > 0 ? 'text-emerald-700' : prod.totalProfit === 0 ? 'text-slate-600' : 'text-rose-600')
                        }`}>
                          {prod.recordsWithCpCount > 0 ? (
                            prod.totalProfit > 0 
                              ? `+₹${prod.totalProfit.toLocaleString('en-IN')}` 
                              : prod.totalProfit === 0 
                                ? '₹0' 
                                : `-₹${Math.abs(prod.totalProfit).toLocaleString('en-IN')}`
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>

                        {/* Margin % */}
                        <td className="py-3 px-3 sm:px-4 text-center font-bold">
                          {prod.profitMarginPercent !== null ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              prod.profitMarginPercent > 0 
                                ? 'bg-emerald-50 text-emerald-800' 
                                : prod.profitMarginPercent === 0 
                                  ? 'bg-slate-100 text-slate-700' 
                                  : 'bg-rose-50 text-rose-800'
                            }`}>
                              {prod.profitMarginPercent}%
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                      </tr>

                      {/* Accordion Detail: Every transaction contributing to this product */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={8} className="p-3 sm:p-4 pl-6 sm:pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
                              <h4 className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                                <span>Transactions for {prod.productName} ({`${prod.records.length} records`})</span>
                                <span className="text-[11px] font-normal text-slate-500 normal-case">
                                  {prod.missingCpCount > 0 ? `${`${prod.missingCpCount} missing CP`}` : 'All CP recorded'}
                                </span>
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3">Date</th>
                                      <th className="py-2 px-3 text-center">Qty</th>
                                      <th className="py-2 px-3 text-right">Unit Price (₹)</th>
                                      <th className="py-2 px-3 text-right">Wholesale Amount (₹)</th>
                                      <th className="py-2 px-3 text-right">Customer Price (₹)</th>
                                      <th className="py-2 px-3 text-right">Profit (₹)</th>
                                      <th className="py-2 px-3 text-center">Delivery Status</th>
                                      <th className="py-2 px-3 text-center print:hidden">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {prod.records.map((r, idx) => {
                                      const hasCp = r.customerPrice !== undefined && r.customerPrice !== null && !isNaN(Number(r.customerPrice));
                                      const pAmt = Number(r.profit);

                                      return (
                                        <tr key={r.id || idx} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">{r.date}</td>
                                          <td className="py-2 px-3 text-center font-bold text-slate-700">{`${r.quantity} pcs`}</td>
                                          <td className="py-2 px-3 text-right font-medium text-slate-600">₹{r.unitPrice}</td>
                                          <td className="py-2 px-3 text-right font-semibold text-[#102A4C]">₹{Number(r.totalAmount).toLocaleString('en-IN')}</td>
                                          <td className="py-2 px-3 text-right font-semibold text-[#168BFF]">
                                            {hasCp ? `₹${Number(r.customerPrice).toLocaleString('en-IN')}` : <span className="text-slate-400 italic">Not Recorded</span>}
                                          </td>
                                          <td className={`py-2 px-3 text-right font-bold ${
                                            !hasCp ? 'text-slate-400 italic' : (pAmt >= 0 ? 'text-emerald-700' : 'text-rose-600')
                                          }`}>
                                            {hasCp ? `${pAmt >= 0 ? '+' : '-'}₹${Math.abs(pAmt).toLocaleString('en-IN')}` : '—'}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                              r.deliveryStatus === 'delivered' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                                            }`}>
                                              {r.deliveryStatus}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center print:hidden">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setInspectRecord(r);
                                              }}
                                              className="px-2 py-0.5 text-[11px] font-semibold text-[#168BFF] hover:underline"
                                            >
                                              Details
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Complete Transaction History Section */}
      <div className="bg-white rounded-2xl border border-[#DCE4EC] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#102A4C] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#168BFF]" />
                <span>Complete Transaction History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every record contributing to this statement for {shopDisplayName}.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Showing {filteredTransactions.length} transaction(s)
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by product or date..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Product Filter Dropdown */}
            <div>
              <select
                value={selectedProductFilter}
                onChange={e => {
                  setSelectedProductFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
              >
                <option value="__all__">All Products</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sort Field */}
            <div>
              <select
                value={historySortField}
                onChange={e => setHistorySortField(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
              >
                <option value="date">Sort by Date (Newest first)</option>
                <option value="amount">Sort by Wholesale Amount (Highest)</option>
                <option value="profit">Sort by Profit (Highest)</option>
                <option value="quantity">Sort by Quantity</option>
              </select>
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">No matching transactions found for this period and filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scroll-smooth touch-pan-x">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-[#F8FAFC] text-[#334155] font-semibold border-b border-[#CBD5E1] select-none">
                  <tr>
                    <th className="py-3 px-3 sm:px-4 text-left">Date</th>
                    <th className="py-3 px-3 sm:px-4 text-left min-w-[140px]">Product</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Quantity</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Wholesale Amount (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Customer Price (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Gross Profit (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Delivery Status</th>
                    <th className="py-3 px-3 sm:px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {paginatedTransactions.map((rec, idx) => {
                    const hasCp = rec.customerPrice !== undefined && rec.customerPrice !== null && !isNaN(Number(rec.customerPrice));
                    const profitVal = Number(rec.profit);

                    return (
                      <tr 
                        key={rec.id || idx}
                        onClick={() => setInspectRecord(rec)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {/* Date */}
                        <td className="py-3 px-3 sm:px-4 text-[#102A4C] font-medium whitespace-nowrap">
                          {rec.date}
                        </td>

                        {/* Product */}
                        <td className="py-3 px-3 sm:px-4 font-semibold text-[#102A4C]">
                          <div>{rec.productName}</div>
                          {rec.productSku && (
                            <span className="text-[11px] font-mono text-slate-400 font-normal">
                              {rec.productSku}
                            </span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-700 tabular-nums">
                          {`${rec.quantity} pcs`}
                        </td>

                        {/* Wholesale Amount */}
                        <td className="py-3 px-3 sm:px-4 text-right font-medium text-[#102A4C] tabular-nums">
                          {`₹${Number(rec.totalAmount).toLocaleString('en-IN')}`}
                        </td>

                        {/* Customer Price (CP) */}
                        <td className="py-3 px-3 sm:px-4 text-right font-semibold text-[#168BFF] tabular-nums">
                          {hasCp ? (
                            `₹${Number(rec.customerPrice).toLocaleString('en-IN')}`
                          ) : (
                            <span className="text-slate-400 italic">Not Recorded</span>
                          )}
                        </td>

                        {/* Gross Profit */}
                        <td className={`py-3 px-3 sm:px-4 text-right font-bold tabular-nums ${
                          !hasCp 
                            ? 'text-slate-400' 
                            : (profitVal > 0 ? 'text-emerald-700' : profitVal === 0 ? 'text-slate-600' : 'text-rose-600')
                        }`}>
                          {hasCp ? (
                            profitVal > 0 
                              ? `+₹${profitVal.toLocaleString('en-IN')}` 
                              : profitVal === 0 
                                ? '₹0' 
                                : `-₹${Math.abs(profitVal).toLocaleString('en-IN')}`
                          ) : (
                            <span className="text-slate-400 italic">Not Available</span>
                          )}
                        </td>

                        {/* Delivery Status */}
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            rec.deliveryStatus === 'delivered' 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {rec.deliveryStatus === 'delivered' ? 'Delivered' : 'Pending'}
                          </span>
                        </td>

                        {/* Details Action */}
                        <td className="py-3 px-3 sm:px-4 text-center print:hidden" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setInspectRecord(rec)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#168BFF] hover:bg-[#168BFF]/10 rounded-lg transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-[#E2E8F0] text-xs sm:text-sm text-slate-500 print:hidden">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold bg-white text-slate-700"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>
                    Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Record Inspection Modal */}
      {inspectRecord && (
        <RecordDetailsModal
          record={inspectRecord}
          onClose={() => setInspectRecord(null)}
        />
      )}
    </div>
  );
};

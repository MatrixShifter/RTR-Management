import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Download, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  FileSpreadsheet, 
  ArrowUpDown, 
  Package, 
  Store,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { 
  type Shop, 
  type BusinessRecord,
  getShops, 
  getBusinessRecords, 
  normalizeDateString 
} from '../../services/db.js';
import { RecordDetailsModal } from '../../components/RecordDetailsModal.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface MonthlyShopStatementProps {
  initialShops?: Shop[];
  initialRecords?: BusinessRecord[];
  initialShopId?: string;
}

interface ProductBreakdownItem {
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
}

interface ShopBreakdownItem {
  shopId: string;
  shopName: string;
  shopCode?: string;
  transactionCount: number;
  totalQuantity: number;
  totalAmount: number;
  totalCustomerPrice: number;
  totalProfit: number;
  recordsWithCpCount: number;
  missingCpCount: number;
  deliveredCount: number;
  pendingCount: number;
  profitMarginPercent: number | null;
  products: ProductBreakdownItem[];
  records: BusinessRecord[];
}

export const MonthlyShopStatement: React.FC<MonthlyShopStatementProps> = ({
  initialShops,
  initialRecords,
  initialShopId
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedShopId, setSelectedShopId] = useState<string>(initialShopId || '__all__');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [shops, setShops] = useState<Shop[]>(initialShops || []);
  const [records, setRecords] = useState<BusinessRecord[]>(initialRecords || []);
  const [loading, setLoading] = useState<boolean>(!initialRecords || !initialShops);
  const [, setError] = useState<string | null>(null);

  // Sorting
  const [productSortField, setProductSortField] = useState<'profit' | 'amount' | 'quantity'>('profit');
  const [productSortAsc, setProductSortAsc] = useState<boolean>(false);

  // Expanded Shop in Consolidated Mode
  const [expandedShopIds, setExpandedShopIds] = useState<Set<string>>(new Set());

  // Modal inspection
  const [inspectRecord, setInspectRecord] = useState<BusinessRecord | null>(null);

  // Load Data
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
      setError(err?.message || 'Failed to load statements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialShops || !initialRecords) {
      loadData();
    }
  }, [loadData, initialShops, initialRecords]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    years.add(currentYear - 1);
    records.forEach(r => {
      const norm = normalizeDateString(r.date);
      if (norm.length >= 4) {
        const y = parseInt(norm.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [records, currentYear]);

  // Filter records by Month & Year, and optionally by Status
  const monthFilteredRecords = useMemo(() => {
    const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return records.filter(r => {
      const norm = normalizeDateString(r.date);
      if (!norm.startsWith(targetMonthStr)) return false;
      if (statusFilter !== 'all' && r.deliveryStatus !== statusFilter) return false;
      return true;
    });
  }, [records, selectedYear, selectedMonth, statusFilter]);

  // Selected Shop Entity
  const selectedShop = useMemo(() => {
    if (selectedShopId === '__all__') return null;
    return shops.find(s => s.id === selectedShopId) || null;
  }, [shops, selectedShopId]);

  // Helper to build product breakdown from a list of records
  const buildProductBreakdown = useCallback((recList: BusinessRecord[]): ProductBreakdownItem[] => {
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
    }>();

    for (const r of recList) {
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
          missingCpCount: 0
        };
        prodMap.set(key, existing);
      }

      existing.totalQuantity += (Number(r.quantity) || 1);
      existing.transactionCount += 1;
      existing.totalAmount += (Number(r.totalAmount) || 0);

      if (r.customerPrice !== undefined && r.customerPrice !== null) {
        existing.totalCustomerPrice += Number(r.customerPrice);
        existing.recordsWithCpCount += 1;
        if (r.profit !== undefined && r.profit !== null) {
          existing.totalProfit += Number(r.profit);
        } else {
          existing.totalProfit += (Number(r.customerPrice) - Number(r.totalAmount));
        }
      } else {
        existing.missingCpCount += 1;
      }
    }

    const items: ProductBreakdownItem[] = Array.from(prodMap.values()).map(p => {
      const margin = p.recordsWithCpCount > 0 && p.totalAmount > 0
        ? Math.round((p.totalProfit / p.totalAmount) * 1000) / 10
        : null;
      return {
        ...p,
        totalAmount: Math.round(p.totalAmount * 100) / 100,
        totalCustomerPrice: Math.round(p.totalCustomerPrice * 100) / 100,
        totalProfit: Math.round(p.totalProfit * 100) / 100,
        profitMarginPercent: margin
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
  }, [productSortField, productSortAsc]);

  // Aggregate shop breakdown for All Shops mode
  const shopBreakdownList: ShopBreakdownItem[] = useMemo(() => {
    const shopMap = new Map<string, BusinessRecord[]>();
    monthFilteredRecords.forEach(r => {
      const sId = r.shopId || r.shopName;
      const list = shopMap.get(sId) || [];
      list.push(r);
      shopMap.set(sId, list);
    });

    const results: ShopBreakdownItem[] = [];
    shopMap.forEach((recList, sId) => {
      const shopObj = shops.find(s => s.id === sId || s.name.trim().toLowerCase() === sId.trim().toLowerCase());
      const shopName = shopObj ? shopObj.name : (recList[0]?.shopName || 'Retail Shop');
      const shopCode = shopObj?.code;

      let totalQty = 0;
      let totalAmt = 0;
      let totalCp = 0;
      let totalProfit = 0;
      let cpCount = 0;
      let missingCp = 0;
      let delivered = 0;
      let pending = 0;

      recList.forEach(r => {
        totalQty += (Number(r.quantity) || 1);
        totalAmt += (Number(r.totalAmount) || 0);
        if (r.deliveryStatus === 'delivered') delivered++;
        else pending++;

        if (r.customerPrice !== undefined && r.customerPrice !== null) {
          totalCp += Number(r.customerPrice);
          cpCount++;
          if (r.profit !== undefined && r.profit !== null) {
            totalProfit += Number(r.profit);
          } else {
            totalProfit += (Number(r.customerPrice) - Number(r.totalAmount));
          }
        } else {
          missingCp++;
        }
      });

      const margin = cpCount > 0 && totalAmt > 0
        ? Math.round((totalProfit / totalAmt) * 1000) / 10
        : null;

      results.push({
        shopId: sId,
        shopName,
        shopCode,
        transactionCount: recList.length,
        totalQuantity: totalQty,
        totalAmount: Math.round(totalAmt * 100) / 100,
        totalCustomerPrice: Math.round(totalCp * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        recordsWithCpCount: cpCount,
        missingCpCount: missingCp,
        deliveredCount: delivered,
        pendingCount: pending,
        profitMarginPercent: margin,
        products: buildProductBreakdown(recList),
        records: recList
      });
    });

    return results.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [monthFilteredRecords, shops, buildProductBreakdown]);

  // Consolidated Grand Totals (across all shops in selected month)
  const consolidatedGrandTotals = useMemo(() => {
    let trans = 0;
    let qty = 0;
    let amt = 0;
    let cp = 0;
    let profit = 0;
    let withCp = 0;
    let missingCp = 0;
    let delivered = 0;
    let pending = 0;

    shopBreakdownList.forEach(s => {
      trans += s.transactionCount;
      qty += s.totalQuantity;
      amt += s.totalAmount;
      cp += s.totalCustomerPrice;
      profit += s.totalProfit;
      withCp += s.recordsWithCpCount;
      missingCp += s.missingCpCount;
      delivered += s.deliveredCount;
      pending += s.pendingCount;
    });

    const margin = withCp > 0 && amt > 0
      ? Math.round((profit / amt) * 1000) / 10
      : null;

    return {
      activeShopsCount: shopBreakdownList.length,
      transactionCount: trans,
      totalQuantity: qty,
      totalAmount: Math.round(amt * 100) / 100,
      totalCustomerPrice: Math.round(cp * 100) / 100,
      totalProfit: Math.round(profit * 100) / 100,
      recordsWithCpCount: withCp,
      missingCpCount: missingCp,
      deliveredCount: delivered,
      pendingCount: pending,
      profitMarginPercent: margin
    };
  }, [shopBreakdownList]);

  // Single Shop Data (when an individual shop is selected)
  const currentSingleShopData = useMemo((): ShopBreakdownItem | null => {
    if (selectedShopId === '__all__') return null;
    return shopBreakdownList.find(s => s.shopId === selectedShopId) || {
      shopId: selectedShopId,
      shopName: selectedShop?.name || 'Retail Shop',
      shopCode: selectedShop?.code,
      transactionCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
      totalCustomerPrice: 0,
      totalProfit: 0,
      recordsWithCpCount: 0,
      missingCpCount: 0,
      deliveredCount: 0,
      pendingCount: 0,
      profitMarginPercent: null,
      products: [],
      records: []
    };
  }, [selectedShopId, shopBreakdownList, selectedShop]);

  // Filtered transactions for individual shop with search term
  const singleShopFilteredTransactions = useMemo(() => {
    if (!currentSingleShopData) return [];
    if (!searchTerm.trim()) return currentSingleShopData.records;
    const term = searchTerm.trim().toLowerCase();
    return currentSingleShopData.records.filter(r => 
      r.productName.toLowerCase().includes(term) ||
      (r.productSku && r.productSku.toLowerCase().includes(term)) ||
      r.date.includes(term)
    );
  }, [currentSingleShopData, searchTerm]);

  // Toggle Accordion in All Shops Mode
  const toggleExpandShop = (shopId: string) => {
    setExpandedShopIds(prev => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    const monthName = MONTH_NAMES[selectedMonth - 1];
    let csvContent = '';

    if (selectedShopId === '__all__') {
      csvContent += `RTR Mobiles — Consolidated All Shops Monthly Purchase & Profit Statement\n`;
      csvContent += `Period: ${monthName} ${selectedYear}\n`;
      csvContent += `Generated: ${new Date().toLocaleString('en-IN')}\n\n`;

      csvContent += `GRAND TOTALS\n`;
      csvContent += `Active Shops,Total Transactions,Total Quantity,Total Wholesale Cost (Amount),Total Customer Price (CP),Total Profit,Profit Margin %,Missing CP Records\n`;
      csvContent += `${consolidatedGrandTotals.activeShopsCount},${consolidatedGrandTotals.transactionCount},${consolidatedGrandTotals.totalQuantity},₹${consolidatedGrandTotals.totalAmount},₹${consolidatedGrandTotals.totalCustomerPrice},₹${consolidatedGrandTotals.totalProfit},${consolidatedGrandTotals.profitMarginPercent ?? 'N/A'}%,${consolidatedGrandTotals.missingCpCount}\n\n`;

      csvContent += `SHOP-WISE SUMMARY\n`;
      csvContent += `Shop Name,Shop Code,Transactions,Total Qty,Wholesale Cost (₹),Customer Price (₹),Profit (₹),Margin %,Status\n`;
      shopBreakdownList.forEach(s => {
        csvContent += `"${s.shopName}","${s.shopCode || ''}",${s.transactionCount},${s.totalQuantity},${s.totalAmount},${s.totalCustomerPrice},${s.totalProfit},${s.profitMarginPercent ?? 'N/A'}%,"Delivered: ${s.deliveredCount} | Pending: ${s.pendingCount}"\n`;
      });
    } else {
      const sName = currentSingleShopData?.shopName || 'Shop';
      csvContent += `RTR Mobiles — Monthly Shop Purchase & Profit Statement\n`;
      csvContent += `Shop: "${sName}" (${currentSingleShopData?.shopCode || 'N/A'})\n`;
      csvContent += `Period: ${monthName} ${selectedYear}\n`;
      csvContent += `Generated: ${new Date().toLocaleString('en-IN')}\n\n`;

      csvContent += `SHOP SUMMARY\n`;
      csvContent += `Total Transactions,Total Quantity,Total Wholesale Cost (Amount),Total Customer Price (CP),Total Profit,Margin %,Missing CP Records\n`;
      csvContent += `${currentSingleShopData?.transactionCount || 0},${currentSingleShopData?.totalQuantity || 0},₹${currentSingleShopData?.totalAmount || 0},₹${currentSingleShopData?.totalCustomerPrice || 0},₹${currentSingleShopData?.totalProfit || 0},${currentSingleShopData?.profitMarginPercent ?? 'N/A'}%,${currentSingleShopData?.missingCpCount || 0}\n\n`;

      csvContent += `PRODUCT-WISE BREAKDOWN\n`;
      csvContent += `Product Name,SKU,Quantity,Transactions,Wholesale Cost (₹),Customer Price (₹),Profit (₹),Margin %\n`;
      (currentSingleShopData?.products || []).forEach(p => {
        csvContent += `"${p.productName}","${p.productSku}",${p.totalQuantity},${p.transactionCount},${p.totalAmount},${p.totalCustomerPrice},${p.totalProfit},${p.profitMarginPercent ?? 'N/A'}%\n`;
      });

      csvContent += `\nTRANSACTION HISTORY\n`;
      csvContent += `Date,Product Name,Quantity,Unit Price (₹),Total Cost (₹),Customer Price (₹),Profit (₹),Delivery Status\n`;
      (currentSingleShopData?.records || []).forEach(r => {
        const cpStr = r.customerPrice !== undefined && r.customerPrice !== null ? `₹${r.customerPrice}` : 'Not Recorded';
        const profitStr = r.profit !== undefined && r.profit !== null ? `₹${r.profit}` : 'Not Available';
        csvContent += `"${r.date}","${r.productName}",${r.quantity},${r.unitPrice},${r.totalAmount},"${cpStr}","${profitStr}","${r.deliveryStatus}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeShopStr = selectedShopId === '__all__' ? 'All-Shops' : (currentSingleShopData?.shopName.replace(/[^a-zA-Z0-9]/g, '_') || 'Shop');
    link.setAttribute('href', url);
    link.setAttribute('download', `RTR_Statement_${safeShopStr}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* 1. Header & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DCE4EC] pb-4 print:border-none print:pb-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#168BFF]/10 text-[#168BFF]">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#102A4C] tracking-tight">
              Monthly Purchase & Profit Statement
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconciled wholesale cost, customer selling price, and profit margin analysis.
          </p>
        </div>

        {/* Export & Print Controls */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Refresh statements"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#102A4C] hover:bg-[#152744] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Month Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Statement Month
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
          >
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Shop Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Shop View Mode
          </label>
          <select
            value={selectedShopId}
            onChange={e => {
              setSelectedShopId(e.target.value);
              setSearchTerm('');
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
          >
            <option value="__all__">All Shops (Consolidated View)</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Delivery Status Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Delivery Status
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
          >
            <option value="all">All Deliveries (Delivered & Pending)</option>
            <option value="delivered">Delivered Only</option>
            <option value="pending">Pending Only</option>
          </select>
        </div>
      </div>

      {/* Printable Header Info (Visible only during print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">RTR MOBILES — WHOLESALE MANAGEMENT</h1>
            <h2 className="text-sm font-semibold text-slate-700 mt-0.5">
              Monthly Purchase & Profit Statement — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>
            <p className="text-xs text-slate-500">
              Scope: {selectedShopId === '__all__' ? 'Consolidated All Registered Shops' : (currentSingleShopData?.shopName || 'Retail Shop')}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div>Status: {statusFilter.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* 3. Summary Metric Cards */}
      {selectedShopId === '__all__' ? (
        /* Consolidated Grand Summary Cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Wholesale Cost (Amount) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Wholesale Cost (Amount)
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
              {`₹${consolidatedGrandTotals.totalAmount.toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span>{consolidatedGrandTotals.activeShopsCount} Active Shops with Orders</span>
            </div>
          </div>

          {/* Card 2: Customer Price (CP) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Customer Selling Price (CP)
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#168BFF] mt-1 tabular-nums">
              {`₹${consolidatedGrandTotals.totalCustomerPrice.toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {consolidatedGrandTotals.missingCpCount > 0 ? (
                <span className="text-amber-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>{`${consolidatedGrandTotals.missingCpCount} records missing CP`}</span>
                </span>
              ) : (
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>100% CP recorded</span>
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
              consolidatedGrandTotals.totalProfit > 0 
                ? 'text-emerald-600' 
                : consolidatedGrandTotals.totalProfit === 0 
                  ? 'text-slate-700' 
                  : 'text-rose-600'
            }`}>
              {consolidatedGrandTotals.totalProfit > 0 
                ? `+₹${consolidatedGrandTotals.totalProfit.toLocaleString('en-IN')}` 
                : consolidatedGrandTotals.totalProfit === 0 
                  ? '₹0' 
                  : `-₹${Math.abs(consolidatedGrandTotals.totalProfit).toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
              {consolidatedGrandTotals.profitMarginPercent !== null ? (
                <span className={
                  consolidatedGrandTotals.profitMarginPercent > 0 
                    ? 'text-emerald-700' 
                    : consolidatedGrandTotals.profitMarginPercent === 0 
                      ? 'text-slate-600' 
                      : 'text-rose-600'
                }>
                  {consolidatedGrandTotals.profitMarginPercent}% Overall Margin
                </span>
              ) : (
                <span className="text-slate-400 italic">Margin N/A</span>
              )}
            </div>
          </div>

          {/* Card 4: Orders & Status */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Orders & Quantity
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
              {consolidatedGrandTotals.transactionCount} Orders
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center justify-between">
              <span>{consolidatedGrandTotals.totalQuantity} total pcs</span>
              <span className="text-slate-400">
                Del: {consolidatedGrandTotals.deliveredCount} | Pend: {consolidatedGrandTotals.pendingCount}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Single Shop Summary Cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Wholesale Cost (Amount) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Wholesale Cost (Amount)
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
              {`₹${(currentSingleShopData?.totalAmount || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium truncate">
              {currentSingleShopData?.shopName}
            </div>
          </div>

          {/* Card 2: Customer Price (CP) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Customer Selling Price (CP)
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#168BFF] mt-1 tabular-nums">
              {`₹${(currentSingleShopData?.totalCustomerPrice || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {(currentSingleShopData?.missingCpCount || 0) > 0 ? (
                <span className="text-amber-600 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>{`${currentSingleShopData?.missingCpCount || 0} records missing CP`}</span>
                </span>
              ) : (
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All CP recorded</span>
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Gross Profit / Loss */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Shop Gross Profit / Loss
            </span>
            <div className={`text-lg sm:text-2xl font-black mt-1 tabular-nums ${
              (currentSingleShopData?.totalProfit || 0) > 0 
                ? 'text-emerald-600' 
                : (currentSingleShopData?.totalProfit || 0) === 0 
                  ? 'text-slate-700' 
                  : 'text-rose-600'
            }`}>
              {(currentSingleShopData?.totalProfit || 0) > 0 
                ? `+₹${(currentSingleShopData?.totalProfit || 0).toLocaleString('en-IN')}` 
                : (currentSingleShopData?.totalProfit || 0) === 0 
                  ? '₹0' 
                  : `-₹${Math.abs(currentSingleShopData?.totalProfit || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">
              {currentSingleShopData?.profitMarginPercent !== null ? (
                <span className={
                  (currentSingleShopData?.profitMarginPercent || 0) > 0 
                    ? 'text-emerald-700' 
                    : (currentSingleShopData?.profitMarginPercent || 0) === 0 
                      ? 'text-slate-600' 
                      : 'text-rose-600'
                }>
                  {currentSingleShopData?.profitMarginPercent}% Margin on Cost
                </span>
              ) : (
                <span className="text-slate-400 italic">Profit N/A</span>
              )}
            </div>
          </div>

          {/* Card 4: Orders & Status */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DCE4EC] shadow-2xs">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Orders & Quantity
            </span>
            <div className="text-lg sm:text-2xl font-black text-[#102A4C] mt-1 tabular-nums">
              {currentSingleShopData?.transactionCount || 0} Orders
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center justify-between">
              <span>{currentSingleShopData?.totalQuantity || 0} pcs</span>
              <span className="text-slate-400">
                Del: {currentSingleShopData?.deliveredCount || 0} | Pend: {currentSingleShopData?.pendingCount || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      {selectedShopId === '__all__' ? (
        /* ========================================================
            ALL SHOPS CONSOLIDATED REPORTING TABLE
           ======================================================== */
        <div className="bg-white rounded-2xl border border-[#DCE4EC] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#102A4C]">
                Consolidated Shop-Wise Performance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Statement for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}. Expand rows to inspect product breakdown.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              {shopBreakdownList.length} Shops Found
            </div>
          </div>

          {shopBreakdownList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No transactions recorded for any shop in {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-[#CBD5E1]">
                  <tr>
                    <th className="py-3 px-3 sm:px-4 w-8"></th>
                    <th className="py-3 px-3 sm:px-4">Shop Name</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Orders</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Qty (pcs)</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Wholesale Cost (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Customer Price (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Profit (₹)</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Margin %</th>
                    <th className="py-3 px-3 sm:px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopBreakdownList.map(shopItem => {
                    const isExpanded = expandedShopIds.has(shopItem.shopId);
                    return (
                      <React.Fragment key={shopItem.shopId}>
                        <tr 
                          onClick={() => toggleExpandShop(shopItem.shopId)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#168BFF]" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td className="py-3 px-3 sm:px-4 font-bold text-[#102A4C]">
                            <div className="flex items-center gap-2">
                              <span>{shopItem.shopName}</span>
                              {shopItem.shopCode && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                  {shopItem.shopCode}
                                </span>
                              )}
                              {shopItem.missingCpCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  {shopItem.missingCpCount} unrecorded CP
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center font-medium text-slate-700">
                            {shopItem.transactionCount}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center font-medium text-slate-700">
                            {shopItem.totalQuantity}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-bold text-[#102A4C] tabular-nums">
                            {`₹${shopItem.totalAmount.toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-bold text-[#168BFF] tabular-nums">
                            {`₹${shopItem.totalCustomerPrice.toLocaleString('en-IN')}`}
                          </td>
                          <td className={`py-3 px-3 sm:px-4 text-right font-extrabold tabular-nums ${
                            shopItem.totalProfit > 0 
                              ? 'text-emerald-700' 
                              : shopItem.totalProfit === 0 
                                ? 'text-slate-600' 
                                : 'text-rose-600'
                          }`}>
                            {shopItem.totalProfit > 0 
                              ? `+₹${shopItem.totalProfit.toLocaleString('en-IN')}` 
                              : shopItem.totalProfit === 0 
                                ? '₹0' 
                                : `-₹${Math.abs(shopItem.totalProfit).toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center font-bold">
                            {shopItem.profitMarginPercent !== null ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                shopItem.profitMarginPercent > 0 
                                  ? 'bg-emerald-50 text-emerald-800' 
                                  : shopItem.profitMarginPercent === 0 
                                    ? 'bg-slate-100 text-slate-700' 
                                    : 'bg-rose-50 text-rose-800'
                              }`}>
                                {shopItem.profitMarginPercent}%
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center print:hidden" onClick={e => e.stopPropagation()}>
                            <a
                              href={`/statements/shop/${encodeURIComponent(shopItem.shopId)}?month=${selectedMonth}&year=${selectedYear}&status=${statusFilter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-semibold text-[#168BFF] hover:bg-[#168BFF]/10 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              title={`Open statement for ${shopItem.shopName} in new tab`}
                            >
                              <span>View Shop</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>

                        {/* Accordion Detail: Product breakdown for this shop */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={9} className="p-4 pl-10 sm:pl-12">
                              <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                  Product Breakdown for {shopItem.shopName}
                                </h4>
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3">Product Name</th>
                                      <th className="py-2 px-3 text-center">Orders</th>
                                      <th className="py-2 px-3 text-center">Qty</th>
                                      <th className="py-2 px-3 text-right">Wholesale Cost (₹)</th>
                                      <th className="py-2 px-3 text-right">Customer Price (₹)</th>
                                      <th className="py-2 px-3 text-right">Profit (₹)</th>
                                      <th className="py-2 px-3 text-center">Margin</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {shopItem.products.map((p, pIdx) => (
                                      <tr key={pIdx} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-medium text-slate-800">
                                          {p.productName}
                                          {p.productSku && <span className="ml-1 text-[10px] text-slate-400">({p.productSku})</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center text-slate-600">{p.transactionCount}</td>
                                        <td className="py-2 px-3 text-center text-slate-600">{p.totalQuantity}</td>
                                        <td className="py-2 px-3 text-right font-medium tabular-nums">₹{p.totalAmount.toLocaleString('en-IN')}</td>
                                        <td className="py-2 px-3 text-right font-medium text-[#168BFF] tabular-nums">₹{p.totalCustomerPrice.toLocaleString('en-IN')}</td>
                                        <td className={`py-2 px-3 text-right font-bold tabular-nums ${p.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                          {p.totalProfit >= 0 ? '+' : '-'}₹{Math.abs(p.totalProfit).toLocaleString('en-IN')}
                                        </td>
                                        <td className="py-2 px-3 text-center font-medium">
                                          {p.profitMarginPercent !== null ? `${p.profitMarginPercent}%` : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* RECONCILED GRAND TOTAL FOOTER */}
                <tfoot className="bg-[#F1F5F9] font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td></td>
                    <td className="py-3.5 px-3 sm:px-4 text-xs sm:text-sm uppercase tracking-wide font-extrabold text-[#102A4C]">
                      Consolidated Grand Total ({consolidatedGrandTotals.activeShopsCount} Shops)
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-extrabold text-[#102A4C]">
                      {consolidatedGrandTotals.transactionCount}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-extrabold text-[#102A4C]">
                      {consolidatedGrandTotals.totalQuantity}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right text-xs sm:text-sm font-extrabold tabular-nums text-[#102A4C]">
                      {`₹${consolidatedGrandTotals.totalAmount.toLocaleString('en-IN')}`}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right text-xs sm:text-sm font-extrabold tabular-nums text-[#168BFF]">
                      {`₹${consolidatedGrandTotals.totalCustomerPrice.toLocaleString('en-IN')}`}
                    </td>
                    <td className={`py-3.5 px-3 sm:px-4 text-right text-xs sm:text-sm font-black tabular-nums ${
                      consolidatedGrandTotals.totalProfit > 0 
                        ? 'text-emerald-700' 
                        : consolidatedGrandTotals.totalProfit === 0 
                          ? 'text-slate-600' 
                          : 'text-rose-600'
                    }`}>
                      {consolidatedGrandTotals.totalProfit > 0 
                        ? `+₹${consolidatedGrandTotals.totalProfit.toLocaleString('en-IN')}` 
                        : consolidatedGrandTotals.totalProfit === 0 
                          ? '₹0' 
                          : `-₹${Math.abs(consolidatedGrandTotals.totalProfit).toLocaleString('en-IN')}`}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center font-bold text-xs">
                      {consolidatedGrandTotals.profitMarginPercent !== null ? `${consolidatedGrandTotals.profitMarginPercent}%` : 'N/A'}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================
            INDIVIDUAL SHOP DETAILED STATEMENT
           ======================================================== */
        <div className="space-y-6">
          {/* Section B: Product-wise Purchase & Profit Breakdown */}
          <div className="bg-white rounded-2xl border border-[#DCE4EC] shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#102A4C]">
                  Product-Wise Purchase & Profit Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate wholesale supply cost vs customer price per product line.
                </p>
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 print:hidden">
                <span className="text-xs font-semibold text-slate-500">Sort by:</span>
                <select
                  value={productSortField}
                  onChange={e => setProductSortField(e.target.value as any)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  <option value="profit">Highest Profit</option>
                  <option value="amount">Highest Wholesale Cost</option>
                  <option value="quantity">Highest Quantity</option>
                </select>
                <button
                  type="button"
                  onClick={() => setProductSortAsc(prev => !prev)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  title="Toggle sort direction"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>

            {(!currentSingleShopData?.products || currentSingleShopData.products.length === 0) ? (
              <div className="p-10 text-center text-slate-400">
                <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No products supplied to this shop in {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-[#CBD5E1]">
                    <tr>
                      <th className="py-3 px-3 sm:px-4">Product Name</th>
                      <th className="py-3 px-3 sm:px-4 text-center">Transactions</th>
                      <th className="py-3 px-3 sm:px-4 text-center">Quantity (pcs)</th>
                      <th className="py-3 px-3 sm:px-4 text-right">Wholesale Cost (Amount)</th>
                      <th className="py-3 px-3 sm:px-4 text-right">Customer Price (CP)</th>
                      <th className="py-3 px-3 sm:px-4 text-right">Profit (₹)</th>
                      <th className="py-3 px-3 sm:px-4 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSingleShopData.products.map((prod, pIdx) => (
                      <tr key={pIdx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 sm:px-4 font-bold text-[#102A4C]">
                          <div>{prod.productName}</div>
                          {prod.productSku && (
                            <span className="text-[10px] text-slate-400 font-mono">{prod.productSku}</span>
                          )}
                          {prod.missingCpCount > 0 && (
                            <span className="ml-2 text-[10px] text-amber-600 font-normal">
                              {`(${prod.missingCpCount} without CP)`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-center text-slate-700 font-medium">
                          {prod.transactionCount}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-center text-slate-700 font-medium">
                          {prod.totalQuantity}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-[#102A4C] tabular-nums">
                          {`₹${prod.totalAmount.toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-right font-bold text-[#168BFF] tabular-nums">
                          {`₹${prod.totalCustomerPrice.toLocaleString('en-IN')}`}
                        </td>
                        <td className={`py-3 px-3 sm:px-4 text-right font-extrabold tabular-nums ${
                          prod.totalProfit > 0 
                            ? 'text-emerald-700' 
                            : prod.totalProfit === 0 
                              ? 'text-slate-600' 
                              : 'text-rose-600'
                        }`}>
                          {prod.totalProfit > 0 
                            ? `+₹${prod.totalProfit.toLocaleString('en-IN')}` 
                            : prod.totalProfit === 0 
                              ? '₹0' 
                              : `-₹${Math.abs(prod.totalProfit).toLocaleString('en-IN')}`}
                        </td>
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
                    ))}
                  </tbody>

                  {/* Totals row */}
                  <tfoot className="bg-[#F1F5F9] font-black text-slate-900 border-t-2 border-slate-300">
                    <tr>
                      <td className="py-3 px-3 sm:px-4 font-extrabold uppercase text-[#102A4C]">
                        Total Product Lines ({currentSingleShopData.products.length})
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-extrabold text-[#102A4C]">
                        {currentSingleShopData.transactionCount}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-extrabold text-[#102A4C]">
                        {currentSingleShopData.totalQuantity}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-extrabold text-[#102A4C] tabular-nums">
                        {`₹${currentSingleShopData.totalAmount.toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-extrabold text-[#168BFF] tabular-nums">
                        {`₹${currentSingleShopData.totalCustomerPrice.toLocaleString('en-IN')}`}
                      </td>
                      <td className={`py-3 px-3 sm:px-4 text-right font-black tabular-nums ${
                        currentSingleShopData.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {`${currentSingleShopData.totalProfit >= 0 ? '+' : '-'}₹${Math.abs(currentSingleShopData.totalProfit).toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-bold">
                        {currentSingleShopData.profitMarginPercent !== null ? `${currentSingleShopData.profitMarginPercent}%` : 'N/A'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section C: Individual Transaction History */}
          <div className="bg-white rounded-2xl border border-[#DCE4EC] shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#102A4C]">
                  Individual Transaction Ledger ({currentSingleShopData?.records.length || 0})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete line-by-line delivery records with unit price, wholesale cost, and customer selling price.
                </p>
              </div>

              {/* Transaction Search Bar */}
              <div className="relative w-full sm:w-64 print:hidden">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter transactions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#168BFF]"
                />
              </div>
            </div>

            {singleShopFilteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No matching transactions found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="bg-[#F8FAFC] text-slate-700 font-semibold border-b border-[#CBD5E1]">
                    <tr>
                      <th className="py-2.5 px-3 sm:px-4">Date</th>
                      <th className="py-2.5 px-3 sm:px-4">Product Name</th>
                      <th className="py-2.5 px-3 sm:px-4 text-center">Qty</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Unit Price (₹)</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Wholesale Cost (₹)</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Customer Price (₹)</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Profit (₹)</th>
                      <th className="py-2.5 px-3 sm:px-4 text-center">Status</th>
                      <th className="py-2.5 px-3 sm:px-4 text-center print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {singleShopFilteredTransactions.map((rec, rIdx) => {
                      const totalAmt = Number(rec.totalAmount) || (Number(rec.quantity || 1) * Number(rec.unitPrice || 0));
                      const isDelivered = rec.deliveryStatus === 'delivered';

                      return (
                        <tr key={rec.id || rIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-slate-600 font-medium">
                            {rec.date}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 font-bold text-[#102A4C]">
                            {rec.productName}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-center text-slate-700 font-medium">
                            {rec.quantity}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right text-slate-700 tabular-nums font-medium">
                            {`₹${Number(rec.unitPrice || 0).toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right font-bold text-[#102A4C] tabular-nums">
                            {`₹${totalAmt.toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right font-bold tabular-nums">
                            {rec.customerPrice !== undefined && rec.customerPrice !== null ? (
                              <span className="text-[#168BFF]">₹{Number(rec.customerPrice).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">Not Recorded</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right font-extrabold tabular-nums">
                            {rec.profit !== undefined && rec.profit !== null ? (
                              <span className={
                                rec.profit > 0 
                                  ? 'text-emerald-700 font-semibold' 
                                  : rec.profit === 0 
                                    ? 'text-slate-600 font-semibold' 
                                    : 'text-rose-600 font-semibold'
                              }>
                                {rec.profit > 0 
                                  ? `+₹${rec.profit.toLocaleString('en-IN')}` 
                                  : rec.profit === 0 
                                    ? '₹0' 
                                    : `-₹${Math.abs(rec.profit).toLocaleString('en-IN')}`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">Not Available</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              isDelivered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isDelivered ? 'Delivered' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => setInspectRecord(rec)}
                              className="text-xs font-semibold text-[#168BFF] hover:underline cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Inspect Modal */}
      {inspectRecord && (
        <RecordDetailsModal
          isOpen={true}
          record={inspectRecord}
          onClose={() => setInspectRecord(null)}
        />
      )}
    </div>
  );
};

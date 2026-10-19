import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  Plus, 
  Search, 
  CheckCircle2, 
  Receipt
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TableSkeleton } from '../../components/ui/Skeleton.js';
import { 
  calculatePaymentStatus, 
  type Invoice, 
  type PaymentRecord, 
  type PaymentMethod 
} from '@crimpston/shared';
import { 
  getShops, 
  getInvoices, 
  getPayments, 
  recordPayment, 
  saveInvoice, 
  type Shop 
} from '../../services/db.js';

interface ShopPaymentSummary {
  shop: Shop;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  lastPaymentDate: string | null;
  status: 'fully_paid' | 'partially_paid' | 'unpaid';
  statusLabel: string;
  badgeClasses: { bg: string; text: string; border: string };
}

export const PaymentTracking: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'shops' | 'invoices' | 'payments'>('shops');

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [targetShopId, setTargetShopId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Create Supply Memo / Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [newInvoiceShopId, setNewInvoiceShopId] = useState('');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInvoiceAmount, setNewInvoiceAmount] = useState<number>(0);
  const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sList, iList, pList] = await Promise.all([
        getShops(),
        getInvoices(),
        getPayments()
      ]);
      setShops(sList);
      setInvoices(iList);
      setPayments(pList);

      if (sList.length > 0) {
        if (!targetShopId) setTargetShopId(sList[0]?.id || '');
        if (!newInvoiceShopId) setNewInvoiceShopId(sList[0]?.id || '');
      }
    } catch (err) {
      console.error('Failed to load payment tracking records:', err);
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

  // Compute Shop Summaries
  const shopSummaries: ShopPaymentSummary[] = shops.map(shop => {
    const shopInvs = invoices.filter(i => i.shop_id === shop.id);
    const shopPays = payments.filter(p => p.shop_id === shop.id && p.status === 'COMPLETED');

    const totalBilled = shopInvs.reduce((sum, i) => sum + i.total_amount, 0);
    const totalPaid = shopPays.reduce((sum, p) => sum + p.amount, 0);
    const statusCalc = calculatePaymentStatus(totalBilled, totalPaid);

    // Find latest payment date
    const sortedPays = [...shopPays].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
    const lastPaymentDate = sortedPays[0]?.payment_date || null;

    return {
      shop,
      totalBilled,
      totalPaid,
      outstandingBalance: statusCalc.outstandingBalance,
      lastPaymentDate,
      status: statusCalc.status,
      statusLabel: statusCalc.statusLabel,
      badgeClasses: statusCalc.badgeClasses
    };
  });

  // Global Aggregates
  const totalBilledAll = shopSummaries.reduce((sum, s) => sum + s.totalBilled, 0);
  const totalPaidAll = shopSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalOutstandingAll = shopSummaries.reduce((sum, s) => sum + s.outstandingBalance, 0);

  const fullyPaidCount = shopSummaries.filter(s => s.status === 'fully_paid').length;
  const partiallyPaidCount = shopSummaries.filter(s => s.status === 'partially_paid').length;
  const unpaidCount = shopSummaries.filter(s => s.status === 'unpaid').length;

  // Filtered Shop Summaries
  const filteredShopSummaries = shopSummaries.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = s.shop.name.toLowerCase().includes(q) || s.shop.code.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter || (statusFilter === 'paid' && s.status === 'fully_paid') || (statusFilter === 'fully_paid' && s.status === 'fully_paid');
    return matchesSearch && matchesStatus;
  });

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = inv.invoice_number.toLowerCase().includes(q) ||
                          (inv.shop_name && inv.shop_name.toLowerCase().includes(q)) ||
                          (inv.notes && inv.notes.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Payments
  const filteredPayments = payments.filter(pay => {
    const q = searchQuery.toLowerCase();
    return (pay.payment_reference && pay.payment_reference.toLowerCase().includes(q)) ||
           (pay.notes && pay.notes.toLowerCase().includes(q)) ||
           pay.payment_method.toLowerCase().includes(q) ||
           pay.payment_date.includes(q);
  });

  // Open Payment Modal for specific shop
  const openPaymentForShop = (shopId: string) => {
    setTargetShopId(shopId);
    const shopSummary = shopSummaries.find(s => s.shop.id === shopId);
    setPaymentAmount(shopSummary ? shopSummary.outstandingBalance : 0);
    setPaymentRef('');
    setPaymentNotes('');
    setIsRecordModalOpen(true);
  };

  // Submit Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0.');
      return;
    }

    const shop = shops.find(s => s.id === targetShopId);
    setIsSubmittingPayment(true);
    try {
      await recordPayment({
        business_id: '4fba6fb7-4e1b-4106-ac84-908f821d73c3',
        shop_id: targetShopId,
        payment_date: paymentDate,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_reference: paymentRef.trim() || `Cash entry (${paymentDate})`,
        status: 'COMPLETED',
        notes: paymentNotes.trim(),
        recorded_by_name: 'Business Owner'
      });

      setIsRecordModalOpen(false);
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
      setSuccessMessage(`Payment of ₹${paymentAmount.toLocaleString('en-IN')} recorded for ${shop?.name || 'store'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error recording payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Submit Invoice / Memo
  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newInvoiceAmount <= 0) {
      alert('Memo / Bill amount must be greater than 0.');
      return;
    }

    const shop = shops.find(s => s.id === newInvoiceShopId);
    setIsSubmittingInvoice(true);
    try {
      await saveInvoice({
        business_id: '4fba6fb7-4e1b-4106-ac84-908f821d73c3',
        shop_id: newInvoiceShopId,
        shop_name: shop ? shop.name : '',
        invoice_number: newInvoiceNumber.trim().toUpperCase() || `MEMO-${Date.now().toString().slice(-4)}`,
        invoice_date: newInvoiceDate,
        total_amount: newInvoiceAmount,
        amount_paid: 0,
        outstanding_amount: newInvoiceAmount,
        status: 'unpaid',
        notes: newInvoiceNotes.trim()
      });

      setIsInvoiceModalOpen(false);
      setNewInvoiceAmount(0);
      setNewInvoiceNumber('');
      setNewInvoiceNotes('');
      setSuccessMessage(`Supply memo created for ${shop?.name || 'store'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error creating invoice.');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">CASH</span>;
      case 'UPI':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">UPI</span>;
      case 'BANK_TRANSFER':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">BANK TRANSFER</span>;
      case 'CHEQUE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">CHEQUE</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{method}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Payment & Receivables Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage partner retail balances, cash collections, and outstanding dues with audit accuracy.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsInvoiceModalOpen(true)}
            className="text-xs font-medium"
          >
            <Receipt className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Issue Supply Memo</span>
          </Button>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setIsRecordModalOpen(true)}
            className="text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Unified Receivables KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm">
        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Total Invoiced (Billed)</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums font-mono">
            ₹{totalBilledAll.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">{invoices.length} supply memos</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Total Payments Collected</span>
          <span className="text-lg font-bold text-emerald-700 tabular-nums font-mono">
            ₹{totalPaidAll.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">{payments.length} receipts</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Total Outstanding Dues</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums font-mono">
            ₹{totalOutstandingAll.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Across all retail shops</span>
        </div>

        <div className="p-2.5 bg-slate-50/70 rounded-md border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 block">Payment Compliance</span>
          <div className="flex items-center space-x-1.5 mt-1 text-[11px] font-medium">
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">{fullyPaidCount} Paid</span>
            <span className="text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">{partiallyPaidCount} Partial</span>
            <span className="text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">{unpaidCount} Unpaid</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Out of {shops.length} partner stores</span>
        </div>
      </div>

      {/* Navigation Tabs & Search Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Tabs */}
          <div className="flex border-b sm:border-b-0 border-slate-200 space-x-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('shops')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'shops'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Shop Receivables Ledger ({shops.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Supply Memos ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'payments'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Payment Receipts ({payments.length})
            </button>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center space-x-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by store or memo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        
        {/* TAB 1: SHOP RECEIVABLES WORKSPACE */}
        {activeTab === 'shops' && (
          <div>
            {isLoading ? (
              <TableSkeleton rows={5} />
            ) : shopSummaries.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="No Retail Stores Configured"
                description="Add partner retail shops to start recording supply memos, tracking payment receipts, and managing receivables."
                action={
                  <Button variant="primary" size="sm" onClick={() => window.location.href = '/shops'}>
                    Add Retail Shop
                  </Button>
                }
              />
            ) : filteredShopSummaries.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No retail shops match the selected search or status filter.
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Retail Shop</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3 text-right font-mono">Total Billed</th>
                      <th className="py-2.5 px-3 text-right font-mono">Amount Paid</th>
                      <th className="py-2.5 px-3 text-right font-mono font-bold">Outstanding Balance</th>
                      <th className="py-2.5 px-3 text-center">Last Payment Date</th>
                      <th className="py-2.5 px-3 text-center">Payment Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShopSummaries.map(item => (
                      <tr key={item.shop.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3.5 font-semibold text-slate-900">
                          <Link to="/shops" className="hover:text-blue-600">
                            {item.shop.name}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {item.shop.code}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-mono text-slate-700">
                          ₹{item.totalBilled.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-mono text-emerald-700 font-medium">
                          ₹{item.totalPaid.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-slate-900">
                          ₹{item.outstandingBalance.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {item.lastPaymentDate || <span className="text-slate-300">No payment yet</span>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${item.badgeClasses.bg} ${item.badgeClasses.text} ${item.badgeClasses.border}`}>
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openPaymentForShop(item.shop.id)}
                            className="h-7 text-xs"
                          >
                            Collect
                          </Button>
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
        )}

        {/* TAB 2: INVOICES & SUPPLY MEMOS */}
        {activeTab === 'invoices' && (
          <div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No supply memos created yet. Click "Issue Supply Memo" above to record a billable batch.
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Memo / Bill #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Retail Shop</th>
                      <th className="py-2.5 px-3 text-right font-mono">Billed Amount</th>
                      <th className="py-2.5 px-3 text-right font-mono">Paid</th>
                      <th className="py-2.5 px-3 text-right font-mono font-bold">Outstanding</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map(inv => {
                      const calc = calculatePaymentStatus(inv.total_amount, inv.amount_paid);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3.5 font-mono font-semibold text-blue-600">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {inv.invoice_date}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {inv.shop_name}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono text-slate-800">
                            ₹{inv.total_amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono text-emerald-700">
                            ₹{inv.amount_paid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-slate-900">
                            ₹{inv.outstanding_amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${calc.badgeClasses.bg} ${calc.badgeClasses.text} ${calc.badgeClasses.border}`}>
                              {calc.statusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 italic truncate max-w-xs">
                            {inv.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAYMENT RECEIPTS */}
        {activeTab === 'payments' && (
          <div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No payment receipts logged yet. Click "Record Payment" to enter collections.
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Payment Date</th>
                      <th className="py-2.5 px-3">Retail Shop</th>
                      <th className="py-2.5 px-3 text-center">Payment Method</th>
                      <th className="py-2.5 px-3">Reference / Transaction ID</th>
                      <th className="py-2.5 px-3 text-right font-mono font-bold">Amount Collected</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map(pay => {
                      const shop = shops.find(s => s.id === pay.shop_id);
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3.5 font-mono text-slate-700">{pay.payment_date}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900">{shop ? shop.name : 'Partner Store'}</td>
                          <td className="py-3 px-3 text-center">{getMethodBadge(pay.payment_method)}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">{pay.payment_reference || '—'}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-emerald-700 text-sm">
                            ₹{pay.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{pay.recorded_by_name || 'Business Owner'}</td>
                          <td className="py-3 px-3 text-slate-500 italic truncate max-w-xs">{pay.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Retail Shop Payment"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Retail Shop *
            </label>
            <select
              value={targetShopId}
              onChange={e => {
                setTargetShopId(e.target.value);
                const sSummary = shopSummaries.find(s => s.shop.id === e.target.value);
                setPaymentAmount(sSummary ? sSummary.outstandingBalance : 0);
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
              required
            >
              {shops.map(s => {
                const sSummary = shopSummaries.find(sum => sum.shop.id === s.id);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) — Balance Due: ₹{(sSummary?.outstandingBalance ?? 0).toLocaleString('en-IN')}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payment Date *"
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
                required
              >
                <option value="CASH">CASH (Physical Collection)</option>
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">BANK TRANSFER (NEFT / IMPS)</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Amount Collected (₹) *"
              type="number"
              min={1}
              step="any"
              value={paymentAmount}
              onChange={e => setPaymentAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              required
            />

            <Input
              label="Reference / Cheque / Txn ID"
              placeholder="e.g. UPI Ref / Cheque #8812"
              value={paymentRef}
              onChange={e => setPaymentRef(e.target.value)}
            />
          </div>

          <Input
            label="Internal Notes"
            placeholder="e.g. Collected during weekly visit"
            value={paymentNotes}
            onChange={e => setPaymentNotes(e.target.value)}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsRecordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmittingPayment}
            >
              Confirm Payment Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Issue Supply Memo Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Issue Supply Memo / Receivable"
      >
        <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Retail Shop *
            </label>
            <select
              value={newInvoiceShopId}
              onChange={e => setNewInvoiceShopId(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 bg-white"
              required
            >
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Memo / Bill Number *"
              placeholder="e.g. MEMO-1001"
              value={newInvoiceNumber}
              onChange={e => setNewInvoiceNumber(e.target.value.toUpperCase())}
              required
            />

            <Input
              label="Memo Date *"
              type="date"
              value={newInvoiceDate}
              onChange={e => setNewInvoiceDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Total Billable Amount (₹) *"
            type="number"
            min={1}
            step="any"
            value={newInvoiceAmount}
            onChange={e => setNewInvoiceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
            required
          />

          <Input
            label="Memo Notes / Particulars"
            placeholder="e.g. Batch #14 mobile cases & tempered glass supply"
            value={newInvoiceNotes}
            onChange={e => setNewInvoiceNotes(e.target.value)}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsInvoiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmittingInvoice}
            >
              Issue Supply Memo
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

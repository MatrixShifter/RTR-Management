import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  Plus, 
  Search, 
  User, 
  CheckCircle, 
  Receipt,
  Smartphone,
  Landmark,
  WalletCards
} from 'lucide-react';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Modal } from '../../components/ui/Modal.js';
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

export const PaymentTracking: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [shopFilter, setShopFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [targetShopId, setTargetShopId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Create Supply Memo / Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [newInvoiceShopId, setNewInvoiceShopId] = useState('');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [newInvoiceAmount, setNewInvoiceAmount] = useState<number>(0);
  const [newInvoiceNotes, setNewInvoiceNotes] = useState('');

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

  // Filter calculations
  const filteredInvoices = invoices.filter(inv => {
    const matchesShop = shopFilter === 'all' || inv.shop_id === shopFilter;
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (inv.shop_name && inv.shop_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesShop && matchesSearch;
  });

  const filteredPayments = payments.filter(pay => {
    const matchesShop = shopFilter === 'all' || pay.shop_id === shopFilter;
    const matchesSearch = (pay.payment_reference && pay.payment_reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (pay.shop_name && pay.shop_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (pay.notes && pay.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesShop && matchesSearch;
  });

  // Calculate Aggregates dynamically
  const totalBilled = filteredInvoices.reduce((sum, i) => sum + i.total_amount, 0);
  const totalCollected = filteredInvoices.reduce((sum, i) => sum + i.amount_paid, 0);
  const totalOutstanding = filteredInvoices.reduce((sum, i) => sum + i.outstanding_amount, 0);
  const fullyPaidCount = filteredInvoices.filter(i => i.status === 'fully_paid').length;

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0.');
      return;
    }

    const shop = shops.find(s => s.id === targetShopId);

    await recordPayment({
      business_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: targetShopId,
      shop_name: shop ? shop.name : '',
      invoice_id: selectedInvoiceId || null,
      payment_date: paymentDate,
      amount: paymentAmount,
      payment_method: paymentMethod,
      payment_reference: paymentRef || `Cash entry (${paymentDate})`,
      status: 'COMPLETED',
      notes: paymentNotes,
      recorded_by_name: 'Business Owner'
    });

    setIsRecordModalOpen(false);
    setPaymentAmount(0);
    setPaymentRef('');
    setPaymentNotes('');
    setSuccessMessage(`Recorded ₹${paymentAmount.toLocaleString('en-IN')} payment for ${shop?.name || 'store'}.`);
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadData();
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newInvoiceAmount <= 0) {
      alert('Invoice total amount must be greater than 0.');
      return;
    }

    const shop = shops.find(s => s.id === newInvoiceShopId);

    await saveInvoice({
      business_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: newInvoiceShopId,
      shop_name: shop ? shop.name : '',
      invoice_number: newInvoiceNumber.trim().toUpperCase() || `MEMO-${Date.now().toString().slice(-4)}`,
      invoice_date: newInvoiceDate,
      total_amount: newInvoiceAmount,
      amount_paid: 0,
      outstanding_amount: newInvoiceAmount,
      status: 'unpaid',
      notes: newInvoiceNotes
    });

    setIsInvoiceModalOpen(false);
    setNewInvoiceAmount(0);
    setNewInvoiceNumber('');
    setNewInvoiceNotes('');
    setSuccessMessage(`Created supply memo for ${shop?.name || 'store'}.`);
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadData();
  };

  const renderPaymentBadge = (totalDue: number, totalPaid: number) => {
    const calc = calculatePaymentStatus(totalDue, totalPaid);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${calc.badgeClasses.bg} ${calc.badgeClasses.text}`}>
        {calc.statusLabel}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Notice */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-800 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-crimpston-electric mb-1">
            <Banknote className="w-4 h-4" />
            <span>Retail Cash & Settlements</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Shop Cash & Payment Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manual cash recording, notebook reference tracking, and auto-calculating shop balances.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {shops.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsInvoiceModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Supply Memo
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => {
                  setSelectedInvoiceId('');
                  setIsRecordModalOpen(true);
                }}
              >
                <Banknote className="w-3.5 h-3.5 mr-1.5" />
                Record Cash Payment
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Supply Billed"
          value={`₹${totalBilled.toLocaleString('en-IN')}`}
          subtext={`${filteredInvoices.length} invoices / memos recorded`}
        />
        <MetricCard
          label="Total Cash Collected"
          value={`₹${totalCollected.toLocaleString('en-IN')}`}
          subtext="Verified payments in notebook"
          variant="highlight"
        />
        <MetricCard
          label="Balance Outstanding"
          value={`₹${totalOutstanding.toLocaleString('en-IN')}`}
          subtext={totalOutstanding === 0 ? "All retail shops fully paid" : "Pending collection from stores"}
          variant={totalOutstanding > 0 ? "alert" : "default"}
        />
        <MetricCard
          label="Settlement Ratio"
          value={filteredInvoices.length > 0 ? `${fullyPaidCount} / ${filteredInvoices.length}` : '0 / 0'}
          subtext="Stores with zero pending debt"
        />
      </div>

      {/* Filters and Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by invoice memo number, shop, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>

          <div className="w-full sm:w-64">
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white font-medium"
            >
              <option value="all">All Retail Shops</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-crimpston-navy text-crimpston-navy font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Shop Supply Invoices & Balances ({filteredInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-crimpston-navy text-crimpston-navy font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <WalletCards className="w-4 h-4" />
          <span>Payment Audit History ({filteredPayments.length})</span>
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <Card title="Shop Wholesale Supply Memos & Balance Tracking">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading payment memos...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No payment records or memos found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Record cash collections or create invoice supply memos to track shop settlements.
              </p>
              {shops.length > 0 && (
                <Button variant="primary" size="sm" onClick={() => setIsInvoiceModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Supply Memo
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Memo / Invoice #</th>
                    <th className="py-2.5 px-3">Retail Shop</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Total Due</th>
                    <th className="py-2.5 px-3 text-right">Paid So Far</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Outstanding Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {inv.shop_name}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {inv.invoice_date}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        ₹{inv.total_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700 font-medium">
                        ₹{inv.amount_paid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 bg-slate-50/50">
                        ₹{inv.outstanding_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderPaymentBadge(inv.total_amount, inv.amount_paid)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {inv.outstanding_amount > 0 ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-[11px] py-1 px-2.5 h-auto"
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setTargetShopId(inv.shop_id);
                              setPaymentAmount(inv.outstanding_amount);
                              setIsRecordModalOpen(true);
                            }}
                          >
                            Collect Cash
                          </Button>
                        ) : (
                          <span className="text-emerald-600 font-semibold text-[11px]">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Payments Audit */}
      {activeTab === 'payments' && (
        <Card title="Payment Receipts & Cash Handover Audit Log">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Banknote className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No payments recorded yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                When cash or online payments are received from retail shops, record them here for auditing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Retail Shop</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference / Notebook Note</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {p.payment_date}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {p.shop_name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          {p.payment_method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                          {p.payment_method === 'UPI' && <Smartphone className="w-3.5 h-3.5 text-blue-600" />}
                          {p.payment_method === 'BANK_TRANSFER' && <Landmark className="w-3.5 h-3.5 text-purple-600" />}
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="block font-medium">{p.payment_reference || '-'}</span>
                        {p.notes && <span className="block text-[11px] text-slate-400">{p.notes}</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {p.recorded_by_name || 'Rajesh (Owner)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Shop Payment"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Shop</label>
            <select
              value={targetShopId}
              onChange={(e) => setTargetShopId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
              required
            >
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Amount (₹)"
              type="number"
              min={1}
              value={paymentAmount || ''}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
              >
                <option value="CASH">Cash in Hand</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
            <Input
              label="Notebook Reference / Memo"
              placeholder="e.g. Notebook Page 14"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Notes (Optional)</label>
            <textarea
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Collected during store visit, handed over by store manager"
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Cash Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Supply Memo / Invoice Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title="Add Wholesale Supply Memo"
      >
        <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Shop</label>
            <select
              value={newInvoiceShopId}
              onChange={(e) => setNewInvoiceShopId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
              required
            >
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Memo / Bill Number"
              placeholder="e.g. MEMO-2026-001"
              value={newInvoiceNumber}
              onChange={(e) => setNewInvoiceNumber(e.target.value)}
              required
            />
            <Input
              label="Total Billed Amount (₹)"
              type="number"
              min={1}
              value={newInvoiceAmount || ''}
              onChange={(e) => setNewInvoiceAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div>
            <Input
              label="Supply Date"
              type="date"
              value={newInvoiceDate}
              onChange={(e) => setNewInvoiceDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Memo Notes (Optional)</label>
            <textarea
              rows={2}
              value={newInvoiceNotes}
              onChange={(e) => setNewInvoiceNotes(e.target.value)}
              placeholder="e.g. Weekly accessories supply batch"
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsInvoiceModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Supply Memo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

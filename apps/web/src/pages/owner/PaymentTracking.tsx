import React, { useState } from 'react';
import { 
  Banknote, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle, 
  Receipt,
  Smartphone,
  Landmark
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

// Initial realistic fixtures aligned with Prompt examples
const initialInvoices: Invoice[] = [
  {
    id: 'i0000000-0000-0000-0000-000000000001',
    business_id: 'b1',
    shop_id: 's1',
    shop_name: 'Apex Mobiles & Telecom',
    invoice_number: 'MEMO-2026-001',
    invoice_date: '2026-10-15',
    total_amount: 5000,
    amount_paid: 5000,
    outstanding_amount: 0,
    status: 'fully_paid',
    notes: 'Batch supply memo #1 - Fully settled in cash'
  },
  {
    id: 'i0000000-0000-0000-0000-000000000002',
    business_id: 'b1',
    shop_id: 's2',
    shop_name: 'City Point Digital Hub',
    invoice_number: 'MEMO-2026-002',
    invoice_date: '2026-10-16',
    total_amount: 8000,
    amount_paid: 5000,
    outstanding_amount: 3000,
    status: 'partially_paid',
    notes: 'Weekly accessories supply memo #2'
  },
  {
    id: 'i0000000-0000-0000-0000-000000000003',
    business_id: 'b1',
    shop_id: 's2',
    shop_name: 'City Point Digital Hub',
    invoice_number: 'MEMO-2026-003',
    invoice_date: '2026-10-18',
    total_amount: 4000,
    amount_paid: 0,
    outstanding_amount: 4000,
    status: 'unpaid',
    notes: 'Charger & cable batch supplied this morning'
  }
];

const initialPayments: PaymentRecord[] = [
  {
    id: 'p001',
    business_id: 'b1',
    shop_id: 's1',
    shop_name: 'Apex Mobiles & Telecom',
    invoice_id: 'i0000000-0000-0000-0000-000000000001',
    payment_date: '2026-10-16',
    amount: 5000,
    payment_method: 'CASH',
    payment_reference: 'Cash in hand to Rajesh (Notebook Pg 14)',
    status: 'COMPLETED',
    notes: 'Collected during store visit',
    recorded_by_name: 'Rajesh Crimpston'
  },
  {
    id: 'p002',
    business_id: 'b1',
    shop_id: 's2',
    shop_name: 'City Point Digital Hub',
    invoice_id: 'i0000000-0000-0000-0000-000000000002',
    payment_date: '2026-10-17',
    amount: 5000,
    payment_method: 'CASH',
    payment_reference: 'Cash collected by Arun (Notebook Pg 16)',
    status: 'COMPLETED',
    notes: 'Partial payment - balance Rs 3,000 promised on Monday',
    recorded_by_name: 'Rajesh Crimpston'
  }
];

export const PaymentTracking: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute aggregated totals
  const totalReceivables = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalOutstanding = totalReceivables - totalCollected;

  // Filtered lists
  const filteredInvoices = invoices.filter(inv => {
    const matchesShop = selectedShop === 'all' || inv.shop_id === selectedShop;
    const matchesQuery = (inv.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesShop && matchesQuery;
  });

  const filteredPayments = payments.filter(p => {
    return selectedShop === 'all' || p.shop_id === selectedShop;
  });

  const handleOpenRecordModal = (invoice?: Invoice) => {
    if (invoice) {
      setSelectedInvoiceId(invoice.id);
      setPaymentAmount(invoice.outstanding_amount > 0 ? invoice.outstanding_amount : '');
    } else {
      setSelectedInvoiceId(invoices.find(i => i.outstanding_amount > 0)?.id || '');
      setPaymentAmount('');
    }
    setPaymentMethod('CASH');
    setPaymentRef('');
    setPaymentNotes('');
    setIsRecordModalOpen(true);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetInvoice = invoices.find(i => i.id === selectedInvoiceId);
    if (!targetInvoice || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      alert('Please select an invoice and enter a valid positive payment amount.');
      return;
    }

    const newPayment: PaymentRecord = {
      id: `p-${Date.now()}`,
      business_id: targetInvoice.business_id,
      shop_id: targetInvoice.shop_id,
      shop_name: targetInvoice.shop_name,
      invoice_id: targetInvoice.id,
      payment_date: new Date().toISOString().split('T')[0] || '2026-10-18',
      amount: paymentAmount,
      payment_method: paymentMethod,
      payment_reference: paymentRef || `Manual cash entry (${new Date().toLocaleDateString()})`,
      status: 'COMPLETED',
      notes: paymentNotes,
      recorded_by_name: 'Rajesh Crimpston'
    };

    // Update payments list
    setPayments(prev => [newPayment, ...prev]);

    // Recalculate invoice balance
    setInvoices(prev => prev.map(inv => {
      if (inv.id === targetInvoice.id) {
        const newPaid = inv.amount_paid + paymentAmount;
        const calc = calculatePaymentStatus(inv.total_amount, newPaid);
        return {
          ...inv,
          amount_paid: newPaid,
          outstanding_amount: calc.outstandingBalance,
          status: calc.status
        };
      }
      return inv;
    }));

    setIsRecordModalOpen(false);
    setSuccessMessage(`Recorded ₹${paymentAmount.toLocaleString('en-IN')} payment for ${targetInvoice.shop_name} via ${paymentMethod}.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  /**
   * Helper to render the mandatory Crimpston payment status badge:
   * - GREEN: Fully Paid (Outstanding = 0)
   * - YELLOW / AMBER: Partially Paid (Paid > 0, Outstanding > 0)
   * - NEUTRAL GREY: Unpaid (Paid = 0)
   * - NEVER RED!
   */
  const renderPaymentBadge = (totalDue: number, totalPaid: number) => {
    const calc = calculatePaymentStatus(totalDue, totalPaid);

    if (calc.badgeColor === 'green') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ● Fully Paid
        </span>
      );
    }
    if (calc.badgeColor === 'yellow') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          ● Partially Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        ○ Unpaid
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Notice */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Header and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-crimpston-electric mb-1">
            <Banknote className="w-3.5 h-3.5" />
            <span>Financial Accounts & Settlement</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Shop Cash & Payment Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track wholesale supply dues, cash notebook collections, and pending balances by store.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => handleOpenRecordModal()}
            className="shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Cash Collection
          </Button>
        </div>
      </div>

      {/* Financial KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Wholesale Due"
          value={`₹${totalReceivables.toLocaleString('en-IN')}`}
          subtext="Supplied goods across active stores"
          variant="highlight"
          icon={<Receipt className="w-4 h-4 text-crimpston-electric" />}
        />
        <MetricCard
          label="Total Collected"
          value={`₹${totalCollected.toLocaleString('en-IN')}`}
          subtext="Confirmed cash & UPI receipts"
          icon={<Banknote className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          label="Total Outstanding Balance"
          value={`₹${totalOutstanding.toLocaleString('en-IN')}`}
          subtext="Pending payment from retail partners"
          variant={totalOutstanding > 0 ? 'alert' : 'default'}
          icon={<FileText className="w-4 h-4 text-amber-600" />}
        />
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search store name or memo reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white font-medium"
            >
              <option value="all">All Retail Stores</option>
              <option value="s1">Apex Mobiles & Telecom (SH-01)</option>
              <option value="s2">City Point Digital Hub (SH-02)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Section 1: Invoices & Receivables Status Table */}
      <Card 
        title="Store Billing & Payment Status"
        action={
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <span>Status Guide:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold">Fully Paid</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-amber-800 bg-amber-50 border border-amber-300 font-semibold">Partially Paid</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-slate-700 bg-slate-100 border border-slate-300 font-semibold">Unpaid</span>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Store / Memo #</th>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5 text-right">Amount Due</th>
                <th className="py-3 px-3.5 text-right">Amount Paid</th>
                <th className="py-3 px-3.5 text-right">Balance Outstanding</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-3.5">
                    <span className="font-bold text-slate-900 block text-sm">{inv.shop_name}</span>
                    <span className="font-mono text-[11px] text-slate-500">{inv.invoice_number}</span>
                  </td>
                  <td className="py-3.5 px-3.5 text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {inv.invoice_date}
                    </span>
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-semibold text-slate-800">
                    ₹{inv.total_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-medium text-emerald-700">
                    ₹{inv.amount_paid.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-bold text-slate-900">
                    {inv.outstanding_amount > 0 ? (
                      <span className="text-amber-800">₹{inv.outstanding_amount.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-slate-400 font-normal">₹0.00</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3.5 text-center">
                    {renderPaymentBadge(inv.total_amount, inv.amount_paid)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right">
                    {inv.outstanding_amount > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRecordModal(inv)}
                        className="text-xs font-semibold border-slate-300"
                      >
                        + Pay
                      </Button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-medium">✓ Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 2: Payment History Audit Trail */}
      <Card 
        title="Recent Payment & Cash Collection History"
        action={
          <span className="text-xs text-slate-500 font-medium">
            Immutable audit record of all collected funds
          </span>
        }
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5">Store</th>
                <th className="py-3 px-3.5">Payment Method</th>
                <th className="py-3 px-3.5">Reference / Memo Notes</th>
                <th className="py-3 px-3.5">Collector</th>
                <th className="py-3 px-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3.5 font-medium text-slate-700">{p.payment_date}</td>
                  <td className="py-3 px-3.5 font-semibold text-slate-900">{p.shop_name}</td>
                  <td className="py-3 px-3.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {p.payment_method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-600" />}
                      {p.payment_method === 'UPI' && <Smartphone className="w-3.5 h-3.5 text-blue-600" />}
                      {p.payment_method === 'BANK_TRANSFER' && <Landmark className="w-3.5 h-3.5 text-purple-600" />}
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-slate-600">
                    <span className="block font-medium">{p.payment_reference || 'N/A'}</span>
                    {p.notes && <span className="block text-[11px] text-slate-400">{p.notes}</span>}
                  </td>
                  <td className="py-3 px-3.5 text-slate-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {p.recorded_by_name || 'Rajesh Crimpston'}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right font-bold text-emerald-700 text-sm">
                    ₹{p.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Record Cash / UPI Payment */}
      <Modal 
        isOpen={isRecordModalOpen} 
        onClose={() => setIsRecordModalOpen(false)} 
        title="Record Store Payment Collection"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Target Invoice / Memo #
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value);
                const inv = invoices.find(i => i.id === e.target.value);
                if (inv) setPaymentAmount(inv.outstanding_amount > 0 ? inv.outstanding_amount : '');
              }}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              required
            >
              <option value="">Select Invoice / Supply Batch</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.shop_name} — {inv.invoice_number} (Due: ₹{inv.outstanding_amount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Amount Paid (₹)"
                type="number"
                min={1}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || '')}
                placeholder="e.g. 5000"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
              >
                <option value="CASH">Cash (In-hand collection)</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="BANK_TRANSFER">Bank IMPS / NEFT</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <Input
            label="Payment Reference / Notebook Page #"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="e.g. Cash notebook Pg 22, collected by Arun"
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Store owner paid partial cash, balance to be cleared next week..."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="font-semibold">
              <Banknote className="w-3.5 h-3.5 mr-1.5" />
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

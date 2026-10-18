import React, { useState } from 'react';
import { 
  Truck, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Store,
  ChevronRight,
  Filter,
  FileCheck2,
  Calendar
} from 'lucide-react';
import { Card, MetricCard } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import type { PendingReportTask } from '@crimpston/shared';

// Realistic fixtures for UI demonstration until connected to live API
const mockPendingTasks: PendingReportTask[] = [
  {
    shop_id: 's0000000-0000-0000-0000-000000000002',
    shop_name: 'City Point Digital Hub',
    shop_code: 'SH-02',
    report_date: new Date().toISOString().split('T')[0] || '2026-10-18',
    status: 'missing',
    assigned_employees: ['Deepak Sharma'],
    cutoff_time: '21:00'
  }
];

const mockAwaitingReview = [
  {
    id: 'rep-001',
    shop_name: 'Apex Mobiles & Telecom',
    report_date: new Date().toISOString().split('T')[0] || '2026-10-18',
    submitted_by: 'Arun Kumar',
    submitted_at: '19:42',
    is_zero_sales: false,
    items_count: 3,
    total_quantity_sold: 8
  }
];

export const OwnerDashboard: React.FC = () => {
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [reviewList, setReviewList] = useState(mockAwaitingReview);
  const [tasks] = useState<PendingReportTask[]>(mockPendingTasks);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);

  const handleApprove = (id: string, shopName: string) => {
    setReviewList(prev => prev.filter(r => r.id !== id));
    setApprovedNotice(`Report for ${shopName} approved and posted to the inventory ledger.`);
    setTimeout(() => setApprovedNotice(null), 4000);
  };

  const filteredTasks = selectedShop === 'all' 
    ? tasks 
    : tasks.filter(t => t.shop_code === selectedShop);

  const filteredReview = selectedShop === 'all'
    ? reviewList
    : reviewList.filter(r => (selectedShop === 'SH-01' ? r.shop_name.includes('Apex') : r.shop_name.includes('City Point')));

  return (
    <div className="space-y-6">
      {/* Alert Notice upon Approval */}
      {approvedNotice && (
        <div className="p-4 bg-blue-50 border border-crimpston-electric/30 rounded-xl flex items-center justify-between text-xs text-crimpston-navy shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-crimpston-electric flex-shrink-0" />
            <span className="font-medium">{approvedNotice}</span>
          </div>
          <button 
            onClick={() => setApprovedNotice(null)} 
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-crimpston-electric mb-1">
            <Store className="w-3.5 h-3.5" />
            <span>Operational Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Business Overview & Control</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time accessory distribution, reporting cutoffs, and verified stock movements.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Shop Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              className="bg-transparent focus:outline-none font-semibold cursor-pointer text-slate-800"
              aria-label="Filter by Retail Shop"
            >
              <option value="all">All Retail Stores</option>
              <option value="SH-01">Apex Mobiles (SH-01)</option>
              <option value="SH-02">City Point Digital (SH-02)</option>
            </select>
          </div>

          {/* Record Delivery CTA */}
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => window.location.href = '/deliveries'}
            className="shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Delivery
          </Button>
        </div>
      </div>

      {/* 4 Primary KPI Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Deliveries"
          value="30 Units"
          subtext="Batch #1 supplied to Apex Mobiles"
          icon={<Truck className="w-4 h-4" />}
          variant="highlight"
        />
        <MetricCard
          label="Reported Sales Today"
          value="8 Units"
          subtext="Awaiting owner sign-off"
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <MetricCard
          label="Reports Pending"
          value={filteredTasks.length}
          subtext="Deadline: 21:00 IST today"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          variant={filteredTasks.length > 0 ? 'alert' : 'default'}
        />
        <MetricCard
          label="Awaiting Approval"
          value={filteredReview.length}
          subtext="Ready for ledger posting"
          icon={<FileCheck2 className="w-4 h-4 text-crimpston-electric" />}
          variant={filteredReview.length > 0 ? 'highlight' : 'default'}
        />
      </div>

      {/* Section 1: Pending Work & Missing Daily Reports */}
      <Card
        title="Pending Reports & Action Required"
        action={
          <Badge variant={filteredTasks.length > 0 ? 'warning' : 'success'}>
            {filteredTasks.length > 0 ? `${filteredTasks.length} Store Pending` : 'All Stores Reported'}
          </Badge>
        }
      >
        {filteredTasks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="font-semibold text-slate-800">All shops have submitted their updates for today</p>
            <p className="text-slate-400">No overdue reporting deadlines at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map(task => (
              <div key={task.shop_id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{task.shop_name}</span>
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                        {task.shop_code}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <span>Assigned Staff: <strong className="text-slate-700">{task.assigned_employees.join(', ')}</strong></span>
                      <span>•</span>
                      <span>Cutoff Deadline: <strong className="text-amber-700">{task.cutoff_time} IST</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 self-end sm:self-auto">
                  <Badge variant="warning">Report Due</Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs font-medium"
                    onClick={() => alert(`Reminder alert queued for store ${task.shop_name}`)}
                  >
                    Send In-App Reminder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Section 2: Daily Sales Reports Review Queue */}
      <Card
        title="Reports Awaiting Owner Approval"
        action={
          <span className="text-xs text-slate-500 font-medium">
            Approving posts movements directly to the verified ledger
          </span>
        }
      >
        {filteredReview.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="font-semibold text-slate-800">Review queue is empty</p>
            <p className="text-slate-400">All submitted employee updates have been reviewed and posted.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Store Details</th>
                  <th className="py-3 px-3.5">Submitted By</th>
                  <th className="py-3 px-3.5">Report Type</th>
                  <th className="py-3 px-3.5 text-center">Quantity Sold</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReview.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3.5">
                      <span className="font-bold text-slate-900 block text-sm">{report.shop_name}</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {report.report_date}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700">
                      <span className="font-semibold block">{report.submitted_by}</span>
                      <span className="text-[11px] text-slate-400">Logged at {report.submitted_at}</span>
                    </td>
                    <td className="py-3.5 px-3.5">
                      {report.is_zero_sales ? (
                        <Badge variant="neutral">0 Sales Declared</Badge>
                      ) : (
                        <Badge variant="info">{report.items_count} Accessory Lines</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-crimpston-electric font-bold text-sm">
                        {report.total_quantity_sold} pcs
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-right space-x-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs font-semibold shadow-sm"
                        onClick={() => handleApprove(report.id, report.shop_name)}
                      >
                        Approve & Post Ledger
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => window.location.href = '/deliveries'}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-crimpston-electric border border-blue-100 flex items-center justify-center transition-colors group-hover:bg-crimpston-electric group-hover:text-white">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Wholesale Deliveries
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Supply morning batches to stores</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </div>

        <div 
          onClick={() => window.location.href = '/stock-ledger'}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors group-hover:bg-crimpston-navy group-hover:text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Stock Balances Ledger
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Confirmed vs provisional balances</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </div>

        <div 
          onClick={() => window.location.href = '/management'}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric hover:shadow-md cursor-pointer transition-all group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors group-hover:bg-crimpston-navy group-hover:text-white">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimpston-electric transition-colors">
                Shops & Catalog SKUs
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Manage partner stores & products</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
};

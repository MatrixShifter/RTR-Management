import React, { useState } from 'react';
import { 
  Truck, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Store,
  ChevronRight,
  Filter
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

  const handleApprove = (id: string) => {
    setReviewList(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Overview & Operations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time shop distributions, daily reporting deadlines, and inventory ledger.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              className="bg-transparent focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">All Retail Shops</option>
              <option value="SH-01">Apex Mobiles & Telecom (SH-01)</option>
              <option value="SH-02">City Point Digital Hub (SH-02)</option>
            </select>
          </div>
          <Button variant="primary" size="sm" onClick={() => window.location.href = '/deliveries'}>
            <Plus className="w-4 h-4 mr-1.5" />
            Record Delivery
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Deliveries"
          value="30 Units"
          subtext="Supplied to 1 shop (Batch #1)"
          variant="highlight"
        />
        <MetricCard
          label="Reported Sales Today"
          value="8 Units"
          subtext="From 1 submitted report"
        />
        <MetricCard
          label="Reports Pending"
          value={tasks.length}
          subtext="Past or nearing 21:00 cutoff"
          variant={tasks.length > 0 ? 'alert' : 'default'}
        />
        <MetricCard
          label="Awaiting Approval"
          value={reviewList.length}
          subtext="Requires owner sign-off"
          variant={reviewList.length > 0 ? 'highlight' : 'default'}
        />
      </div>

      {/* Critical Section 1: Pending Work & Missing Daily Reports */}
      <Card
        title="Pending Reports & Action Required"
        action={
          <Badge variant={tasks.length > 0 ? 'warning' : 'success'}>
            {tasks.length > 0 ? `${tasks.length} Missing` : 'All Shops Reported'}
          </Badge>
        }
      >
        {tasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>All retail shops have submitted their updates for today.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map(task => (
              <div key={task.shop_id} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-800">{task.shop_name}</span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {task.shop_code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Assigned: {task.assigned_employees.join(', ')} • Cutoff deadline: {task.cutoff_time}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="warning">Missing Report</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Critical Section 2: Daily Sales Reports Review Queue */}
      <Card
        title="Reports Awaiting Owner Approval"
        action={<span className="text-xs text-slate-400 font-medium">Auto-posts to stock ledger upon approval</span>}
      >
        {reviewList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No reports currently awaiting review.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Reporter</th>
                  <th className="py-2.5 px-3">Submission Type</th>
                  <th className="py-2.5 px-3">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewList.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {report.shop_name}
                      <span className="block text-[11px] text-slate-400">{report.report_date}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {report.submitted_by}
                      <span className="block text-[10px] text-slate-400">at {report.submitted_at}</span>
                    </td>
                    <td className="py-3 px-3">
                      {report.is_zero_sales ? (
                        <Badge variant="neutral">Zero Sales Declared</Badge>
                      ) : (
                        <Badge variant="info">{report.items_count} Product Lines</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {report.total_quantity_sold} pcs
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <Button variant="outline" size="sm" className="text-xs py-1">
                        Inspect
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs py-1"
                        onClick={() => handleApprove(report.id)}
                      >
                        Approve & Post
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => window.location.href = '/deliveries'}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric cursor-pointer transition-colors group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-crimpston-electric flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 group-hover:text-crimpston-electric">
                Supply Deliveries
              </h4>
              <p className="text-xs text-slate-500">Record morning batches & items</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric" />
        </div>

        <div 
          onClick={() => window.location.href = '/stock-ledger'}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric cursor-pointer transition-colors group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 group-hover:text-crimpston-electric">
                Stock Balances
              </h4>
              <p className="text-xs text-slate-500">Track provisional & confirmed counts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric" />
        </div>

        <div 
          onClick={() => window.location.href = '/management'}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-crimpston-electric cursor-pointer transition-colors group flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 group-hover:text-crimpston-electric">
                Shops & Catalog
              </h4>
              <p className="text-xs text-slate-500">Manage stores, products & staff</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-crimpston-electric" />
        </div>
      </div>
    </div>
  );
};

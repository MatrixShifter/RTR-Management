import React, { useState } from 'react';
import { 
  Search, 
  FileSpreadsheet
} from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import type { StockBalance } from '@crimpston/shared';

const mockBalances: StockBalance[] = [
  {
    shop_id: 's1',
    shop_name: 'Apex Mobiles & Telecom',
    product_id: 'p1',
    product_name: 'Shockproof Armor Case (iPhone 15)',
    product_sku: 'CASE-IP15-ARM',
    category: 'Mobile Cases',
    total_delivered: 20,
    confirmed_sold: 5,
    provisional_sold: 2,
    expected_stock: 13,
    last_physical_count: 14,
    last_counted_at: '2026-10-15',
    min_stock_threshold: 5
  },
  {
    shop_id: 's1',
    shop_name: 'Apex Mobiles & Telecom',
    product_id: 'p2',
    product_name: '9H 2.5D Tempered Glass (Galaxy S24)',
    product_sku: 'TG-S24-9H',
    category: 'Tempered Glass',
    total_delivered: 30,
    confirmed_sold: 15,
    provisional_sold: 4,
    expected_stock: 11,
    last_physical_count: null,
    last_counted_at: null,
    min_stock_threshold: 10
  },
  {
    shop_id: 's2',
    shop_name: 'City Point Digital Hub',
    product_id: 'p3',
    product_name: '65W GaN Fast Charger Dual Port',
    product_sku: 'CHG-65W-GAN',
    category: 'Chargers & Adapters',
    total_delivered: 10,
    confirmed_sold: 8,
    provisional_sold: 0,
    expected_stock: 2,
    last_physical_count: 2,
    last_counted_at: '2026-10-17',
    min_stock_threshold: 3
  }
];

export const StockLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('all');
  const [balances] = useState<StockBalance[]>(mockBalances);

  const filtered = balances.filter(b => {
    const matchesSearch = b.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.product_sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesShop = shopFilter === 'all' || b.shop_name.includes(shopFilter);
    return matchesSearch && matchesShop;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Multi-Shop Stock Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparently distinguishes between <strong>Confirmed Stock</strong>, <strong>Provisional Stock</strong>, and <strong>Physically Counted Stock</strong>.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Export Ledger CSV
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric"
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-crimpston-electric bg-white"
            >
              <option value="all">All Retail Shops</option>
              <option value="Apex">Apex Mobiles & Telecom</option>
              <option value="City Point">City Point Digital Hub</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Stock Ledger Table */}
      <Card title="Current Inventory Quantities by Shop">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3">Shop</th>
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-right">Delivered</th>
                <th className="py-2.5 px-3 text-right">Confirmed Sold</th>
                <th className="py-2.5 px-3 text-right">Provisional</th>
                <th className="py-2.5 px-3 text-right">Expected Stock</th>
                <th className="py-2.5 px-3 text-right">Physical Count</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item, idx) => {
                const isLowStock = item.expected_stock <= item.min_stock_threshold;
                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {item.shop_name}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{item.product_sku} • {item.category}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {item.total_delivered}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {item.confirmed_sold}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-600 font-medium">
                      {item.provisional_sold > 0 ? `-${item.provisional_sold}` : '0'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {item.expected_stock}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.last_physical_count !== null ? (
                        <div>
                          <span className="font-semibold text-slate-800">{item.last_physical_count} pcs</span>
                          <span className="block text-[10px] text-slate-400">{item.last_counted_at}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not Audited</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isLowStock ? (
                        <Badge variant="warning">Low Stock</Badge>
                      ) : (
                        <Badge variant="success">Normal</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

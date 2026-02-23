import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  MoreHorizontal,
  ShoppingCart
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-md transition-shadow relative group"
  >
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className={cn("text-3xl font-black tracking-tight", color)}>{value}</h3>
      </div>
      {subtitle && <p className="text-xs text-zinc-400 font-medium">{subtitle}</p>}
    </div>
  </motion.div>
);

import { cn } from '../lib/utils';
import { Plus, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(setSummary);
    
    fetch('/api/analytics/trends')
      .then(res => res.json())
      .then(setTrends);

    fetch('/api/sales')
      .then(res => res.json())
      .then(data => setRecentSales(data.slice(0, 5)));
  }, []);

  if (!summary) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Home</h1>
          <p className="text-zinc-500 font-medium">Overview of your business performance</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
          <Plus className="w-4 h-4" />
          New transaction
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard 
          title="Money In today" 
          value={formatCurrency(summary.today_sales || 0)} 
          color="text-emerald-600"
        />
        <StatCard 
          title="Money Out today" 
          value={formatCurrency(0)} 
          color="text-red-500"
        />
        <StatCard 
          title="Today's Balance" 
          value={formatCurrency(summary.today_sales || 0)} 
          color="text-zinc-900"
        />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Cash Flow Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-zinc-900 tracking-tight text-lg">Cash flow</h3>
              <div className="w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
            </div>
            <select className="text-xs font-bold text-emerald-600 bg-transparent border-none outline-none cursor-pointer">
              <option>This week</option>
              <option>This month</option>
            </select>
          </div>
          
          {trends.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#a1a1aa' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={3} />
                  <Area type="monotone" dataKey="profit" stroke="#ef4444" fill="url(#colorOut)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-48 h-32 mx-auto mb-6 opacity-40">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                  <path d="M10 80 Q 50 10, 90 80 T 170 80" fill="none" stroke="#10b981" strokeWidth="2" />
                  <path d="M10 90 Q 50 40, 90 90 T 170 90" fill="none" stroke="#ef4444" strokeWidth="2" />
                </svg>
              </div>
              <h4 className="text-zinc-900 font-bold mb-1">Cash flow trends</h4>
              <p className="text-zinc-400 text-sm mb-6">Track Money In & Money Out</p>
              <button className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Sales */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-zinc-900 tracking-tight text-lg">Top sales</h3>
                <div className="w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
              </div>
              <select className="text-xs font-bold text-emerald-600 bg-transparent border-none outline-none cursor-pointer">
                <option>This week</option>
              </select>
            </div>
            <div className="py-12 text-center">
              <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-10 h-10 text-zinc-200" />
              </div>
              <p className="text-zinc-400 text-sm">No sales data for this period</p>
            </div>
          </div>

          {/* Top Expenses */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-zinc-900 tracking-tight text-lg">Top expenses</h3>
                <div className="w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
              </div>
              <select className="text-xs font-bold text-emerald-600 bg-transparent border-none outline-none cursor-pointer">
                <option>This week</option>
              </select>
            </div>
            <div className="py-12 text-center">
              <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowDownRight className="w-10 h-10 text-zinc-200" />
              </div>
              <p className="text-zinc-400 text-sm">No expense data for this period</p>
            </div>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <div className="text-center mb-8">
            <h3 className="font-black text-zinc-900 tracking-tight text-lg">Getting Started</h3>
          </div>
          <div className="bg-emerald-50/50 rounded-3xl p-6 mb-8 flex items-center justify-between border border-emerald-100">
            <div>
              <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                Welcome to StockFlow <span role="img" aria-label="rocket">🚀</span>
              </h4>
              <p className="text-emerald-700 text-sm">Get started with our customised setup guide</p>
            </div>
            <div className="w-24 h-24 relative">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="251.2" />
                <path d="M30 50 L45 65 L70 35" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="space-y-4">
            {[
              "Add your business logo to stand out.",
              "Customise your invoices with your brand colours",
              "Add your tax & payment details to start collecting payments.",
              "Add your first product or service and start selling.",
              "Record your first sale and see your money grow in seconds."
            ].map((task, i) => (
              <div key={i} className="flex items-center justify-between p-4 border-b border-zinc-100 last:border-0 group cursor-pointer hover:bg-zinc-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-200" />
                  <span className="text-sm font-medium text-zinc-600">{task}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

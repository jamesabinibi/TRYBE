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

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-5 sm:p-6 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
  >
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl shadow-lg shadow-zinc-200 group-hover:scale-110 transition-transform", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg",
            trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">{value}</h3>
    </div>
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
  </motion.div>
);

import { cn } from '../lib/utils';

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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-zinc-500 font-medium">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm self-start">
          <button className="px-4 py-2 text-xs font-bold bg-zinc-900 text-white rounded-xl shadow-lg shadow-zinc-200">Today</button>
          <button className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors">Week</button>
          <button className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors">Month</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Today's Sales" 
          value={formatCurrency(summary.today_sales || 0)} 
          icon={DollarSign} 
          trend={12}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Today's Profit" 
          value={formatCurrency(summary.today_profit || 0)} 
          icon={TrendingUp} 
          trend={8}
          color="bg-blue-500"
        />
        <StatCard 
          title="Total Stock" 
          value={summary.total_stock || 0} 
          icon={Package} 
          color="bg-zinc-900"
        />
        <StatCard 
          title="Low Stock Alert" 
          value={summary.low_stock_count || 0} 
          icon={AlertTriangle} 
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white p-5 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="font-black text-zinc-900 tracking-tight text-lg">Revenue & Profit Trend</h3>
            <select className="text-xs font-bold border-zinc-200 rounded-xl focus:ring-emerald-500 px-4 py-2 bg-zinc-50 outline-none">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
            </select>
          </div>
          <div className="h-[250px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                  tickFormatter={(val) => `₦${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#3b82f6" 
                  fillOpacity={0} 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col">
          <h3 className="font-black text-zinc-900 tracking-tight text-lg mb-6">Recent Sales</h3>
          <div className="space-y-5 flex-1">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  <Clock className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate tracking-tight">{sale.invoice_number}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-zinc-900 tracking-tight">{formatCurrency(sale.total_amount)}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">+{formatCurrency(sale.total_profit)}</p>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-zinc-200" />
                </div>
                <p className="text-sm font-bold text-zinc-400">No sales recorded yet.</p>
              </div>
            )}
          </div>
          <Link to="/reports" className="w-full mt-8 py-4 text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all text-center border border-emerald-100">
            View All Reports
          </Link>
        </div>
      </div>
    </div>
  );
}

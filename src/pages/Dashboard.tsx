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
  ShoppingCart,
  Sparkles,
  Trophy,
  Users,
  Loader2,
  BrainCircuit,
  TrendingDown
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
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth, useSettings } from '../App';

const StatCard = ({ title, value, icon: Icon, color, subtitle, className }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative group", className)}
  >
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className={cn("text-3xl font-black tracking-tight", color)}>{value}</h3>
      </div>
      {subtitle && <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">{subtitle}</p>}
    </div>
  </motion.div>
);

import { Plus, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { fetchWithAuth } = useAuth();
  const { settings: globalSettings } = useSettings();
  const brandColor = globalSettings?.brand_color || '#10b981';
  const currency = globalSettings?.currency || 'NGN';
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<any>(null);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [topSales, setTopSales] = useState<any[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    fetchWithAuth('/api/analytics/summary')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setSummary(data);
        else setSummary({});
      })
      .catch(() => setSummary({}));
    
    fetchWithAuth('/api/analytics/trends')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTrends(data);
        else setTrends([]);
      })
      .catch(() => setTrends([]));

    fetchWithAuth('/api/sales')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRecentSales(data.slice(0, 5));
        else setRecentSales([]);
      })
      .catch(() => setRecentSales([]));

    fetchWithAuth('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setDashboardSettings(data);
        else setDashboardSettings(null);
      })
      .catch(() => setDashboardSettings(null));

    fetchWithAuth('/api/analytics/staff-performance')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setStaffPerformance(data);
        else setStaffPerformance([]);
      })
      .catch(() => setStaffPerformance([]));

    fetchWithAuth('/api/analytics/top-sales')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTopSales(data);
        else setTopSales([]);
      })
      .catch(() => setTopSales([]));

    fetchWithAuth('/api/analytics/top-expenses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTopExpenses(data);
        else setTopExpenses([]);
      })
      .catch(() => setTopExpenses([]));
  }, []);

  const generateForecast = async () => {
    setIsForecasting(true);
    try {
      const res = await fetchWithAuth('/api/ai/forecast', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes('API key not valid')) {
          toast.error('Invalid Gemini API Key. Please check your settings.');
        } else {
          toast.error(data.error || 'Failed to generate forecast');
        }
        return;
      }
      setForecast(data);
      toast.success('Business intelligence forecast generated');
    } catch (err) {
      console.error('Forecast failed');
      toast.error('Failed to generate forecast. Please try again.');
    } finally {
      setIsForecasting(false);
    }
  };

  if (!summary) return <div className="animate-pulse">Loading...</div>;

  const gettingStartedTasks = [
    {
      id: 'logo',
      label: "Add your business logo to stand out.",
      path: '/settings?section=logo',
      isCompleted: !!globalSettings?.logo_url
    },
    {
      id: 'colors',
      label: "Customise your invoices with your brand colours",
      path: '/settings?section=brand',
      isCompleted: !!globalSettings?.brand_color && globalSettings?.brand_color !== '#10b981'
    },
    {
      id: 'tax',
      label: "Add your tax & payment details to start collecting payments.",
      path: '/settings?section=tax',
      isCompleted: globalSettings?.vat_enabled
    },
    {
      id: 'product',
      label: "Add your first product or service and start selling.",
      path: '/products?action=add',
      isCompleted: summary.total_products > 0
    },
    {
      id: 'sale',
      label: "Record your first sale and see your money grow in seconds.",
      path: '/sales',
      isCompleted: summary.total_sales_count > 0
    }
  ];

  const completedTasksCount = gettingStartedTasks.filter(t => t.isCompleted).length;
  const progressPercentage = (completedTasksCount / gettingStartedTasks.length) * 100;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">Home</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Overview of your business performance</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={generateForecast}
            disabled={isForecasting}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isForecasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
            AI Forecast
          </button>
          <Link 
            to="/products?action=add"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-brand/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {summary?.version && summary.version !== "2.4.9-stable" && (
          <div className="col-span-full bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold">
              CRITICAL: Your server is running an outdated version ({summary.version}). 
              Recorded sales and expenses will NOT reflect correctly until you redeploy to Vercel.
            </p>
          </div>
        )}
        <StatCard 
          title="Money In today" 
          value={formatCurrency(summary.today_sales || 0, currency)} 
          color="text-brand"
        />
        <StatCard 
          title="Money Out today" 
          value={formatCurrency(summary.today_expenses || 0, currency)} 
          color="text-red-500"
        />
        <StatCard 
          title="Today's Balance" 
          value={formatCurrency((summary.today_sales || 0) - (summary.today_expenses || 0), currency)} 
          color="text-zinc-950 dark:text-white"
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>

      <AnimatePresence>
        {forecast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-black p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <BrainCircuit className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400/20 rounded-xl text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase tracking-widest text-xs">AI Business Intelligence</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                    {forecast.strategic_advice}
                  </p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Forecasted Revenue</p>
                      <p className="text-2xl font-black text-amber-400">{formatCurrency(forecast.forecasted_revenue, currency)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Restock Suggestions</h4>
                  <div className="space-y-3">
                    {forecast.restock_suggestions && forecast.restock_suggestions.length > 0 ? (
                      forecast.restock_suggestions.map((item: any) => (
                        <div key={item.product_name} className="flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-300">{item.product_name}</span>
                          <span className="px-3 py-1 bg-amber-400/10 text-amber-400 rounded-full text-[10px] font-black uppercase">
                            Buy {item.suggested_quantity}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500">No restock suggestions at this time.</p>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setForecast(null)}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
              >
                Dismiss Forecast
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8">
        {/* Cash Flow Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-zinc-900 dark:text-white tracking-tight text-base sm:text-lg">Cash flow</h3>
              <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
            </div>
            <select className="text-[10px] sm:text-xs font-bold text-brand bg-transparent border-none outline-none cursor-pointer">
              <option>This week</option>
              <option>This month</option>
            </select>
          </div>
          
          {trends.length > 0 ? (
            <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brandColor} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={brandColor} stopOpacity={0}/>
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
                  <Area type="monotone" dataKey="revenue" stroke={brandColor} fill="url(#colorRevenue)" strokeWidth={3} />
                  <Area type="monotone" dataKey="profit" stroke="#ef4444" fill="url(#colorOut)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-48 h-32 mx-auto mb-6 opacity-40">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                  <path d="M10 80 Q 50 10, 90 80 T 170 80" fill="none" stroke={brandColor} strokeWidth="2" />
                  <path d="M10 90 Q 50 40, 90 90 T 170 90" fill="none" stroke="#ef4444" strokeWidth="2" />
                </svg>
              </div>
              <h4 className="text-zinc-900 dark:text-white font-bold mb-1">Cash flow trends</h4>
              <p className="text-zinc-400 text-sm mb-6">Track Money In & Money Out</p>
              <button className="inline-flex items-center gap-2 px-6 py-2 bg-brand/10 text-brand rounded-xl text-sm font-bold hover:bg-brand/20 transition-colors">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Staff Performance */}
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-zinc-900 dark:text-white tracking-tight text-base sm:text-lg">Staff Performance</h3>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="space-y-4">
              {staffPerformance.map((staff, i) => (
                <div key={`staff-${i}-${staff.name}`} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center font-black text-brand shadow-sm border border-zinc-100 dark:border-zinc-700">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{staff.name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{staff.transaction_count} sales</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand">{formatCurrency(staff.total_sales, currency)}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Revenue</p>
                  </div>
                </div>
              ))}
              {staffPerformance.length === 0 && (
                <div className="py-8 text-center">
                  <Users className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">No performance data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Sales */}
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-zinc-900 dark:text-white tracking-tight text-base sm:text-lg">Top sales</h3>
                <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
              </div>
            </div>
            <div className="space-y-4">
              {topSales.map((sale, i) => (
                <div key={`top-sale-${i}-${sale.name}`} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center font-black text-brand shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white truncate max-w-[120px]">{sale.name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{sale.quantity} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand">{formatCurrency(sale.revenue, currency)}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Revenue</p>
                  </div>
                </div>
              ))}
              {topSales.length === 0 && (
                <div className="py-8 text-center">
                  <TrendingUp className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">No sales data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Expenses */}
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-zinc-900 dark:text-white tracking-tight text-base sm:text-lg">Top expenses</h3>
                <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
              </div>
            </div>
            <div className="space-y-4">
              {topExpenses.map((expense, i) => (
                <div key={`top-expense-${i}-${expense.category}`} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center font-black text-red-500 shadow-sm border border-zinc-100 dark:border-zinc-700">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{expense.category}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-500">{formatCurrency(expense.amount, currency)}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</p>
                  </div>
                </div>
              ))}
              {topExpenses.length === 0 && (
                <div className="py-8 text-center">
                  <TrendingDown className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">No expenses data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-center mb-6 sm:mb-8">
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight text-base sm:text-lg">Getting Started</h3>
          </div>
          <div className="bg-brand/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-brand/10">
            <div className="text-center sm:text-left">
              <h4 className="font-bold text-brand flex items-center justify-center sm:justify-start gap-2">
                Welcome to StockFlow <span role="img" aria-label="rocket">🚀</span>
              </h4>
              <p className="text-brand/70 text-xs sm:text-sm mt-1">
                {completedTasksCount === gettingStartedTasks.length 
                  ? "You're all set! Your business is ready to grow." 
                  : `Complete ${gettingStartedTasks.length - completedTasksCount} more tasks to finish your setup.`}
              </p>
            </div>
            <div className="w-20 h-20 sm:w-24 sm:h-24 relative shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-brand/10" strokeWidth="8" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="none" 
                  stroke="currentColor"
                  className="text-brand transition-all duration-1000 ease-out"
                  strokeWidth="8" 
                  strokeDasharray="251.2" 
                  strokeDashoffset={251.2 - (251.2 * progressPercentage) / 100}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {progressPercentage === 100 ? (
                  <CheckCircle2 className="w-8 h-8 text-brand" />
                ) : (
                  <span className="text-sm font-black text-brand">{Math.round(progressPercentage)}%</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {gettingStartedTasks.map((task) => (
              <div 
                key={task.id} 
                onClick={() => navigate(task.path)}
                className={cn(
                  "flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors",
                  task.isCompleted && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-brand" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-200 dark:text-zinc-700 group-hover:border-brand transition-colors" />
                  )}
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    task.isCompleted ? "text-zinc-400 line-through" : "text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"
                  )}>
                    {task.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-brand transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

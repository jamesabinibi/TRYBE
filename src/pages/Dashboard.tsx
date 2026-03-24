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
  TrendingDown,
  Plus,
  Settings as SettingsIcon,
  Image as ImageIcon,
  CheckCircle2,
  Shield
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
import { useAuth, useSettings, useTheme } from '../App';

const QuickAction = ({ to, icon: Icon, label, color, className, onClick }: any) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Link 
      to={to}
      onClick={onClick ? handleClick : undefined}
      className={cn(
        "flex items-center p-2 rounded-2xl border transition-all duration-300 active:scale-95 group flex-none overflow-hidden h-11 cursor-pointer",
        color,
        className
      )}
    >
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12" title={label}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="ml-3">
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap pr-2">
          {label}
        </span>
      </div>
    </Link>
  );
};

const StatCard = ({ title, value, icon: Icon, color, subtitle, className }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className={cn("glass-card p-6 flex flex-col justify-between min-h-[140px]", className)}
  >
    <div>
      <p className="label-text text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">{title}</p>
      <h3 className={cn("card-number", color)}>{value}</h3>
    </div>
    {subtitle && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-2">{subtitle}</p>}
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { fetchWithAuth, user } = useAuth();
  const { settings: globalSettings } = useSettings();
  const { isDarkMode } = useTheme();

  if (user?.role === 'staff' && !user?.permissions?.can_view_dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full">
          <Shield className="w-12 h-12 text-zinc-400" />
        </div>
        <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-widest">Access Denied</h2>
        <p className="text-zinc-500 dark:text-zinc-400 font-medium text-center max-w-md">
          You do not have permission to view the dashboard. Please contact your administrator.
        </p>
        <button 
          onClick={() => navigate('/sales')}
          className="px-8 py-3 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20"
        >
          Go to Sales
        </button>
      </div>
    );
  }
  const brandColor = globalSettings?.brand_color || '#10b981';
  const currency = globalSettings?.currency || 'NGN';
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [topSales, setTopSales] = useState<any[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, trendRes, salesRes, staffRes, topSalesRes, topExpRes] = await Promise.all([
          fetchWithAuth('/api/analytics/summary'),
          fetchWithAuth('/api/analytics/trends'),
          fetchWithAuth('/api/sales'),
          fetchWithAuth('/api/analytics/staff-performance'),
          fetchWithAuth('/api/analytics/top-sales'),
          fetchWithAuth('/api/analytics/top-expenses')
        ]);

        const sumData = await sumRes.json();
        const trendData = await trendRes.json();
        const salesData = await salesRes.json();
        const staffData = await staffRes.json();
        const topSalesData = await topSalesRes.json();
        const topExpData = await topExpRes.json();

        setSummary(sumData || {});
        setTrends(Array.isArray(trendData) ? trendData : []);
        setRecentSales(Array.isArray(salesData) ? salesData.slice(0, 5) : []);
        setStaffPerformance(Array.isArray(staffData) ? staffData : []);
        setTopSales(Array.isArray(topSalesData) ? topSalesData : []);
        setTopExpenses(Array.isArray(topExpData) ? topExpData : []);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
        setSummary({});
      }
    };
    fetchData();
  }, []);

  if (!summary) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </div>
  );

  const isSetupComplete = globalSettings?.business_name && 
                         globalSettings?.business_name !== 'Gryndee' && 
                         globalSettings?.logo_url && 
                         globalSettings?.phone_number;
  
  const showSetupBanner = (user?.role === 'admin' || user?.role === 'owner') && !isSetupComplete;

  return (
    <div className="space-y-8 pb-10">
      <AnimatePresence>
        {showSetupBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand/10 border border-brand/20 rounded-2xl p-6 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center text-brand shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-zinc-900 dark:text-white font-bold">Complete Your Business Setup</h3>
                    <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mt-1">
                      To get the most out of Gryndee, please finish setting up your business profile.
                    </p>
                    <div className="flex flex-wrap gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        {globalSettings?.business_name && globalSettings?.business_name !== 'Gryndee' ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-500">Business Name</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {globalSettings?.logo_url ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-500">Business Logo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {globalSettings?.phone_number ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />
                        )}
                        <span className="text-[11px] font-medium text-zinc-500">Contact Details</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Link
                    to="/settings"
                    className="flex-1 md:flex-none px-6 py-2.5 bg-brand text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-all shadow-lg shadow-brand/20 text-center"
                  >
                    Complete Setup
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="body-text text-zinc-500 dark:text-zinc-400">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
          <Link 
            to="/ai-advisor"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/[0.05] text-zinc-900 dark:text-white rounded-xl text-[13px] font-semibold transition-all hover:bg-zinc-200 dark:hover:bg-white/[0.1]"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            AI Pulse
          </Link>
          <Link 
            to="/sales"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-[13px] font-semibold transition-all hover:opacity-90 shadow-lg shadow-brand/20"
          >
            <Plus className="w-4 h-4" />
            New Sale
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <QuickAction 
          to="/sales" 
          icon={Plus} 
          label="New Sale" 
          color="bg-brand/10 text-brand border-brand/20 dark:bg-brand/5" 
        />
        <QuickAction 
          to="/products" 
          icon={Package} 
          label="Add Product" 
          color="bg-brand/10 text-brand border-brand/20 dark:bg-brand/5" 
        />
        <QuickAction 
          to="/expenses" 
          icon={DollarSign} 
          label="Add Expense" 
          color="bg-brand/10 text-brand border-brand/20 dark:bg-brand/5" 
        />
        <QuickAction 
          to="/customers" 
          icon={Users} 
          label="Customers" 
          color="bg-brand/10 text-brand border-brand/20 dark:bg-brand/5" 
        />
        <QuickAction 
          to="/invoices" 
          icon={ArrowUpRight} 
          label="Invoices" 
          color="bg-brand/10 text-brand border-brand/20 dark:bg-brand/5" 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Revenue Today" 
          value={formatCurrency(summary.today_sales || 0, currency)} 
          color="text-brand"
        />
        {user?.role !== 'staff' && (
          <>
            <StatCard 
              title="Expenses Today" 
              value={formatCurrency(summary.today_expenses || 0, currency)} 
              color="text-red-500"
            />
            <StatCard 
              title="Net Profit" 
              value={formatCurrency((summary.today_sales || 0) - (summary.today_expenses || 0), currency)} 
              color="text-zinc-900 dark:text-white"
            />
          </>
        )}
        <StatCard 
          title="Total Sales" 
          value={summary.total_sales_count || 0} 
          color="text-zinc-900 dark:text-white"
          subtitle={user?.role === 'staff' ? "Your lifetime transactions" : "Lifetime transactions"}
        />
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-zinc-900 dark:text-white">Cash Flow</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-[11px] font-medium text-zinc-500">Revenue</span>
              </div>
              {user?.role !== 'staff' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[11px] font-medium text-zinc-500">Expenses</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brandColor} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={brandColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff05" : "#00000005"} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#71717a' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#121821' : '#fff',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area 
                    type="natural" 
                    dataKey="revenue" 
                    stroke={brandColor} 
                    fill="url(#colorRevenue)" 
                    strokeWidth={3} 
                    animationDuration={1500}
                  />
                  {user?.role !== 'staff' && (
                    <Area 
                      type="natural" 
                      dataKey="expenses" 
                      stroke="#ef4444" 
                      fill="transparent" 
                      strokeWidth={3} 
                      strokeDasharray="5 5"
                      animationDuration={1500}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">No trend data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-zinc-900 dark:text-white mb-6">Top Products</h2>
          <div className="space-y-6">
            {topSales.slice(0, 5).map((sale, i) => (
              <div key={sale.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.03] flex items-center justify-center text-zinc-500 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate max-w-[120px]">{sale.name}</p>
                    <p className="text-[11px] text-zinc-500">{sale.quantity} units</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{formatCurrency(sale.revenue, currency)}</p>
                  <div className="w-16 h-1 bg-zinc-100 dark:bg-white/[0.05] rounded-full mt-1 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(sale.revenue / topSales[0].revenue) * 100}%` }}
                      className="h-full bg-brand"
                    />
                  </div>
                </div>
              </div>
            ))}
            {topSales.length === 0 && (
              <div className="py-10 text-center text-zinc-400">
                <p className="text-xs">No sales recorded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-zinc-900 dark:text-white">Recent Transactions</h2>
            <Link to="/sales" className="label-text text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-1">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors border-b border-zinc-100 dark:border-white/[0.02] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900 dark:text-white">Sale #{sale.id.toString().slice(-4)}</p>
                    <p className="text-[11px] text-zinc-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-brand">+{formatCurrency(sale.total_amount, currency)}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{sale.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-zinc-900 dark:text-white mb-6">Team Performance</h2>
          <div className="space-y-6">
            {staffPerformance.map((staff, i) => (
              <div key={staff.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-500 font-bold text-xs">
                    {staff.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">{staff.name}</p>
                    <p className="text-[11px] text-zinc-500">{staff.transaction_count} transactions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{formatCurrency(staff.total_sales, currency)}</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <Trophy className={cn("w-3 h-3", i === 0 ? "text-amber-400" : "text-zinc-300")} />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Rank #{i + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

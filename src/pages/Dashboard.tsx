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
  Shield,
  ShieldCheck,
  Copy
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
import { formatCurrency, cn, useQuery, getOptimizedImageUrl } from '../lib/utils';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { NumberDisplay } from '../components/NumberDisplay';
import { TotalDisplay } from '../components/TotalDisplay';
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
        "flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 transition-all duration-300 active:scale-95 group hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-0.5 overflow-hidden">
        <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-white block truncate">
          {label}
        </span>
      </div>
    </Link>
  );
};

const StatCard = ({ title, value, icon: Icon, color, subtitle, className, gradient }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    className={cn(
      "glass-card p-4 sm:p-5 relative overflow-hidden group flex items-center justify-between gap-4", 
      className
    )}
  >
    {gradient && (
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity", gradient)} />
    )}
    <div className="relative z-10 flex flex-col justify-start">
      <p className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
      <div className="text-xl sm:text-2xl font-display font-bold tracking-tight text-zinc-900 dark:text-white line-clamp-1">
        {value}
      </div>
      {subtitle && <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-1">{subtitle}</p>}
    </div>
    {Icon && (
      <div className={cn("relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] flex items-center justify-center shadow-sm shrink-0", color)}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
    )}
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
        <h2 className="h2">Access Denied</h2>
        <p className="body-text text-center max-w-md">
          You do not have permission to view the dashboard. Please contact your administrator.
        </p>
        <button 
          onClick={() => navigate('/sales')}
          className="btn-primary px-8"
        >
          Go to Sales
        </button>
      </div>
    );
  }
  const brandColor = '#4facfe';
  const currency = globalSettings?.currency || 'NGN';
  const [isForecasting, setIsForecasting] = useState(false);

  const { data: dashboardData, isLoading } = useQuery('dashboard_data', async () => {
    const batchRes = await fetchWithAuth('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoints: [
          '/api/analytics/summary',
          '/api/analytics/trends',
          '/api/sales',
          '/api/analytics/staff-performance',
          '/api/analytics/top-sales',
          '/api/analytics/top-expenses',
          '/api/products?exclude_images=true'
        ]
      })
    });

    if (!batchRes.ok) {
      throw new Error(`Batch fetch failed with status ${batchRes.status}`);
    }

    const [sumData, trendData, salesData, staffData, topSalesData, topExpData, productsData] = await batchRes.json();
    
    // Filter for low stock products
    const globalThreshold = Number(globalSettings?.low_stock_threshold) || 5;
    const lowStock = (productsData || []).filter((p: any) => {
      return p.variants?.some((v: any) => {
        const qty = Number(v.quantity) || 0;
        const threshold = v.low_stock_threshold !== null && v.low_stock_threshold !== undefined 
          ? Number(v.low_stock_threshold) 
          : globalThreshold;
        return qty <= threshold;
      });
    });

    return {
      summary: sumData || {},
      trends: Array.isArray(trendData) ? trendData : [],
      recentSales: Array.isArray(salesData) ? salesData.slice(0, 5) : [],
      staffPerformance: Array.isArray(staffData) ? staffData : [],
      topSales: Array.isArray(topSalesData) ? topSalesData : [],
      topExpenses: Array.isArray(topExpData) ? topExpData : [],
      lowStockProducts: lowStock
    };
  }, {
    persist: true,
    enabled: !!user
  });

  const summary = dashboardData?.summary || {};
  const trends = dashboardData?.trends || [];
  const recentSales = dashboardData?.recentSales || [];
  const staffPerformance = dashboardData?.staffPerformance || [];
  const topSales = dashboardData?.topSales || [];
  const topExpenses = dashboardData?.topExpenses || [];
  const lowStockProducts = dashboardData?.lowStockProducts || [];

  if (isLoading && !dashboardData) return (
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
            <div className="bg-brand/5 border border-brand/10 rounded-2xl p-6 mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="h3">Complete Your Business Setup</h3>
                    <p className="body-text opacity-70 mt-1">
                      To get the most out of Gryndee, please finish setting up your business profile.
                    </p>
                    <div className="flex flex-wrap gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        {globalSettings?.business_name && globalSettings?.business_name !== 'Gryndee' ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
                        )}
                        <span className="label-text">Business Name</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {globalSettings?.logo_url ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
                        )}
                        <span className="label-text">Business Logo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {globalSettings?.phone_number ? (
                          <CheckCircle2 className="w-4 h-4 text-brand" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
                        )}
                        <span className="label-text">Contact Details</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Link
                    to="/settings"
                    className="btn-primary"
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
          <div className="flex items-center gap-3">
            <h1 className="h1">Dashboard</h1>
            {(user?.subscription_plan === 'pro' || user?.subscription_plan === 'trial') && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-brand/10 text-brand rounded-full border border-brand/20 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="label-text">Verified Pro</span>
              </div>
            )}
          </div>
          <p className="body-text mt-1">Welcome back, {user?.name || 'User'}. Here's what's happening today.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Link 
              to="/ai-advisor"
              className="btn-secondary"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              AI Pulse
            </Link>
          </div>
        </div>
      </div>

      {/* Referral Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 sm:p-5 border-brand/20 bg-brand/5 relative overflow-hidden group flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
          <Trophy className="w-32 h-32 text-brand -rotate-12 translate-x-4 -translate-y-4" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-brand" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Referral Program</h3>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                      {i}
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">0 / 3</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">Invite friends & get 1 month of Pro features free when you reach 3 referrals!</p>
          </div>
        </div>
        
        <div className="relative z-10 flex items-center gap-3 p-1.5 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0 self-start md:self-auto w-full md:w-auto mt-2 md:mt-0 justify-between md:justify-start">
          <div className="px-3 py-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block mb-0.5">Your Code</span>
            <span className="text-lg font-display font-bold text-zinc-900 dark:text-white tracking-tight leading-none">{user?.referral_code || 'GRYNDEE'}</span>
          </div>
          <button 
            onClick={() => {
              if (user?.referral_code) {
                navigator.clipboard.writeText(user.referral_code);
                toast.success('Referral code copied!');
              }
            }}
            className="w-10 h-10 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:scale-105 transition-all active:scale-95 shadow-md flex items-center justify-center shrink-0"
            title="Copy Code"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        <QuickAction 
          to="/sales" 
          icon={Plus} 
          label="New Sale" 
          color="vibrant-gradient text-white" 
        />
        <QuickAction 
          to="/products" 
          icon={Package} 
          label="Add Product" 
          color="vibrant-gradient-purple text-white" 
        />
        <QuickAction 
          to="/finance?tab=expenses" 
          icon={DollarSign} 
          label="Add Expense" 
          color="vibrant-gradient-pink text-white" 
        />
        <QuickAction 
          to="/customers" 
          icon={Users} 
          label="Customers" 
          color="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" 
        />
        <QuickAction 
          to="/invoices" 
          icon={ArrowUpRight} 
          label="Invoices" 
          color="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white" 
        />
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="label-text font-semibold text-red-900 dark:text-red-400">Low Stock Alerts</h3>
              <p className="text-[10px] text-red-700 dark:text-red-500 opacity-70 uppercase tracking-wider">Inventory Attention Required</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.slice(0, 3).map((product) => (
              <Link 
                key={product.id}
                to={`/products?search=${product.name}`}
                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-red-100 dark:border-red-900/20 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    {product.images?.[0] ? (
                      <img src={getOptimizedImageUrl(product.images[0])} alt="" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="label-text font-medium text-zinc-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Stock: {product.total_stock}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full uppercase">Low</span>
                </div>
              </Link>
            ))}
            {lowStockProducts.length > 3 && (
              <Link 
                to="/products"
                className="flex items-center justify-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-red-100 dark:border-red-900/20 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="label-text text-red-600 dark:text-red-400 font-medium">+{lowStockProducts.length - 3} more items</span>
              </Link>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Revenue This Week" 
          value={<CurrencyDisplay amount={summary.weekly_sales || 0} currencyCode={currency} />} 
          color="vibrant-gradient text-white"
          gradient="bg-brand"
          icon={TrendingUp}
        />
        {user?.role !== 'staff' && (
          <>
            <StatCard 
              title="Expenses This Week" 
              value={<CurrencyDisplay amount={summary.weekly_expenses || 0} currencyCode={currency} />} 
              color="vibrant-gradient-pink text-white"
              gradient="bg-pink-500"
              icon={TrendingDown}
            />
            <StatCard 
              title="Net Profit (Weekly)" 
              value={<CurrencyDisplay amount={(summary.weekly_profit || 0) - (summary.weekly_expenses || 0)} currencyCode={currency} />} 
              color="vibrant-gradient-purple text-white"
              gradient="bg-purple-500"
              icon={DollarSign}
            />
          </>
        )}
        <StatCard 
          title="Total Sales" 
          value={summary.total_sales_count || 0} 
          color="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
          subtitle={user?.role === 'staff' ? "Your lifetime transactions" : "Lifetime transactions"}
          icon={ShoppingCart}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="h2">Cash Flow</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand" />
                <span className="label-text">Revenue</span>
              </div>
              {user?.role !== 'staff' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="label-text">Expenses</span>
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
          <h2 className="h2 mb-6">Top Products</h2>
          <div className="space-y-6">
            {topSales.slice(0, 5).map((sale, i) => (
              <div key={sale.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-white/[0.03] flex items-center justify-center text-zinc-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="body-text font-medium text-zinc-900 dark:text-white truncate max-w-[120px]">{sale.name}</p>
                    <p className="label-text">{sale.quantity} units</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="body-text font-medium text-zinc-900 dark:text-white"><CurrencyDisplay amount={sale.revenue} currencyCode={currency} /></p>
                  <div className="w-16 h-1 bg-zinc-100 dark:bg-white/[0.05] rounded-full mt-1.5 overflow-hidden">
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
                <p className="body-text">No sales recorded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="h2">Recent Transactions</h2>
            <Link to="/sales" className="label-text text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-1">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors border-b border-zinc-100 dark:border-white/[0.02] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="body-text font-medium text-zinc-900 dark:text-white">Sale #{sale.id.toString().slice(-4)}</p>
                    <p className="label-text">{new Date(sale.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="body-text font-medium text-brand">+<CurrencyDisplay amount={sale.total_amount} currencyCode={currency} /></p>
                  <p className="label-text">{sale.payment_method}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8">
          <h2 className="h2 mb-6">Team Performance</h2>
          <div className="space-y-6">
            {staffPerformance.map((staff, i) => (
              <div key={staff.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-white/[0.05] flex items-center justify-center text-zinc-400 font-medium text-xs">
                    {staff.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="body-text font-medium text-zinc-900 dark:text-white">{staff.name}</p>
                    <p className="label-text">{staff.transaction_count} transactions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="body-text font-medium text-zinc-900 dark:text-white"><CurrencyDisplay amount={staff.total_sales} currencyCode={currency} /></p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <Trophy className={cn("w-3 h-3", i === 0 ? "text-amber-400" : "text-zinc-300")} />
                    <span className="label-text">Rank #<NumberDisplay value={i + 1} /></span>
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

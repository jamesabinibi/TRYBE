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
import { formatCurrency, cn } from '../lib/utils';
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
        "flex items-center p-2 rounded-2xl border transition-all duration-300 active:scale-95 group flex-none overflow-hidden h-11 cursor-pointer",
        color,
        className
      )}
    >
      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12" title={label}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="ml-3">
        <span className="label-text whitespace-nowrap pr-2">
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
    <TotalDisplay 
      label={title} 
      value={value} 
      icon={Icon ? <Icon className="w-5 h-5" /> : undefined}
      valueClassName={cn("h2", color)}
      labelClassName="label-text"
    />
    {subtitle && <p className="body-text opacity-70 mt-2">{subtitle}</p>}
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
  const brandColor = globalSettings?.brand_color || '#10b981';
  const currency = globalSettings?.currency || 'NGN';
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [topSales, setTopSales] = useState<any[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, trendRes, salesRes, staffRes, topSalesRes, topExpRes, productsRes] = await Promise.all([
          fetchWithAuth('/api/analytics/summary'),
          fetchWithAuth('/api/analytics/trends'),
          fetchWithAuth('/api/sales'),
          fetchWithAuth('/api/analytics/staff-performance'),
          fetchWithAuth('/api/analytics/top-sales'),
          fetchWithAuth('/api/analytics/top-expenses'),
          fetchWithAuth('/api/products')
        ]);

        const sumData = await sumRes.json();
        const trendData = await trendRes.json();
        const salesData = await salesRes.json();
        const staffData = await staffRes.json();
        const topSalesData = await topSalesRes.json();
        const topExpData = await topExpRes.json();
        const productsData = await productsRes.json();

        setSummary(sumData || {});
        setTrends(Array.isArray(trendData) ? trendData : []);
        setRecentSales(Array.isArray(salesData) ? salesData.slice(0, 5) : []);
        setStaffPerformance(Array.isArray(staffData) ? staffData : []);
        setTopSales(Array.isArray(topSalesData) ? topSalesData : []);
        setTopExpenses(Array.isArray(topExpData) ? topExpData : []);

        // Filter for low stock products
        const lowStock = productsData.filter((p: any) => {
          const globalThreshold = globalSettings?.low_stock_threshold || 5;
          return p.variants?.some((v: any) => v.quantity <= (v.low_stock_threshold || globalThreshold));
        });
        setLowStockProducts(lowStock);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
        setSummary({});
      }
    };
    fetchData();
  }, [globalSettings?.low_stock_threshold]);

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
            {user?.subscription_plan === 'professional' && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-brand/10 text-brand rounded-full border border-brand/20 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="label-text">Verified Premium</span>
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
            <Link 
              to="/sales"
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              New Sale
            </Link>
          </div>
          {user?.referral_code && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="label-text text-zinc-400">Referral Code:</span>
              <span className="label-text text-brand">{user.referral_code}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(user.referral_code);
                  toast.success('Referral code copied!');
                }}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
              >
                <Copy className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Referral Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-brand/20 bg-brand/[0.02] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Trophy className="w-24 h-24 text-brand -rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h3 className="h3">Referral Program</h3>
              <p className="body-text opacity-70">Invite friends and get rewarded. They get 14 days of Pro features free!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-1.5 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="px-4 py-2">
              <span className="label-text block leading-none mb-1">Your Code</span>
              <span className="h2 text-brand tracking-tighter leading-none">{user?.referral_code || 'GRYNDEE'}</span>
            </div>
            <button 
              onClick={() => {
                if (user?.referral_code) {
                  navigator.clipboard.writeText(user.referral_code);
                  toast.success('Referral code copied!');
                }
              }}
              className="p-3 bg-brand text-white rounded-xl hover:bg-brand-hover transition-all active:scale-95 shadow-lg shadow-brand/20"
              title="Copy Code"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <QuickAction 
          to="/sales" 
          icon={Plus} 
          label="New Sale" 
          color="bg-brand/5 text-brand border-brand/10" 
        />
        <QuickAction 
          to="/products" 
          icon={Package} 
          label="Add Product" 
          color="bg-brand/5 text-brand border-brand/10" 
        />
        <QuickAction 
          to="/finance?tab=expenses" 
          icon={DollarSign} 
          label="Add Expense" 
          color="bg-brand/5 text-brand border-brand/10" 
        />
        <QuickAction 
          to="/customers" 
          icon={Users} 
          label="Customers" 
          color="bg-brand/5 text-brand border-brand/10" 
        />
        <QuickAction 
          to="/invoices" 
          icon={ArrowUpRight} 
          label="Invoices" 
          color="bg-brand/5 text-brand border-brand/10" 
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
                      <img src={product.images[0]} alt="" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Revenue Today" 
          value={<CurrencyDisplay amount={summary.today_sales || 0} currencyCode={currency} />} 
          color="text-brand"
        />
        {user?.role !== 'staff' && (
          <>
            <StatCard 
              title="Expenses Today" 
              value={<CurrencyDisplay amount={summary.today_expenses || 0} currencyCode={currency} />} 
              color="text-red-500"
            />
            <StatCard 
              title="Net Profit" 
              value={<CurrencyDisplay amount={(summary.today_sales || 0) - (summary.today_expenses || 0)} currencyCode={currency} />} 
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

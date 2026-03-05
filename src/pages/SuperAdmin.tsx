import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Package, 
  ShoppingCart, 
  ShieldCheck,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Search,
  Mail,
  Calendar,
  ExternalLink,
  Settings as SettingsIcon,
  Database
} from 'lucide-react';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface AdminStats {
  accounts: number;
  users: number;
  products: number;
  sales: number;
  recentAccounts: any[];
}

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon className="w-24 h-24" />
    </div>
    <div className="relative z-10">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{value}</h3>
      {trend && (
        <div className="flex items-center gap-1 mt-2 text-emerald-500 text-xs font-bold">
          <ArrowUpRight className="w-3 h-3" />
          <span>{trend} increase</span>
        </div>
      )}
    </div>
  </motion.div>
);

export default function SuperAdmin() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch admin stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      toast.error('Failed to load system statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">System Administration</span>
          </div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">Global Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Monitoring StockFlow Pro system-wide performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchStats}
            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors shadow-sm"
          >
            <Activity className="w-5 h-5" />
          </button>
          <div className="h-10 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
            <Database className="w-4 h-4" />
            System Healthy
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Accounts" 
          value={stats?.accounts} 
          icon={Building2} 
          color="bg-blue-500/10 text-blue-600"
          trend="12%"
        />
        <StatCard 
          title="Active Users" 
          value={stats?.users} 
          icon={Users} 
          color="bg-purple-500/10 text-purple-600"
          trend="8%"
        />
        <StatCard 
          title="Total Products" 
          value={stats?.products} 
          icon={Package} 
          color="bg-orange-500/10 text-orange-600"
          trend="24%"
        />
        <StatCard 
          title="System Sales" 
          value={stats?.sales} 
          icon={ShoppingCart} 
          color="bg-emerald-500/10 text-emerald-600"
          trend="15%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">Recent Registrations</h3>
                <p className="text-sm text-zinc-500 font-medium">Latest businesses joined the platform</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-800/50">
                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Business Name</th>
                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Owner</th>
                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Joined Date</th>
                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {stats?.recentAccounts.filter(acc => 
                    acc.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((account) => (
                    <tr key={account.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 font-black">
                            {account.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-white">{account.name}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">ID: #{account.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{account.users?.[0]?.name || 'N/A'}</span>
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {account.users?.[0]?.email || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                          <Calendar className="w-4 h-4 opacity-50" />
                          {new Date(account.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <ShieldCheck className="w-64 h-64" />
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-black mb-2">System Health</h3>
              <p className="text-emerald-100 text-sm font-medium mb-6">All core services are operational and performing optimally.</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                  <span>Database</span>
                  <span className="text-emerald-300">99.9% Uptime</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-700 rounded-full overflow-hidden">
                  <div className="w-[99.9%] h-full bg-white" />
                </div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                  <span>API Gateway</span>
                  <span className="text-emerald-300">42ms Latency</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-700 rounded-full overflow-hidden">
                  <div className="w-[95%] h-full bg-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6">Admin Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                System Settings
              </button>
              <button className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                Broadcast Message
              </button>
              <button className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                Growth Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

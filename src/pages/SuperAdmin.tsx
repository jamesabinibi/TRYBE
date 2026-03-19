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
  Database,
  Lock,
  X,
  Shield,
  User as UserIcon,
  Trash2,
  Power
} from 'lucide-react';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
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
      <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium mb-1">{title}</p>
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
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'users'>('accounts');
  
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchAccounts();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch admin stats');
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load system statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/users');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load system users');
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/accounts');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch accounts');
      }
      const data = await res.json();
      setAccounts(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load system accounts');
      console.error('Failed to fetch accounts:', err);
    }
  };

  const handleToggleAccountStatus = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetchWithAuth(`/api/admin/accounts/${id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        toast.success(`Account ${currentStatus ? 'deactivated' : 'activated'} successfully`);
        fetchAccounts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to toggle account status');
      }
    } catch (err: any) {
      toast.error('Network error');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this account? This will delete all associated users, products, and sales. This action cannot be undone.')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/accounts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Account deleted successfully');
        fetchAccounts();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (err: any) {
      toast.error('Network error');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    
    setIsBroadcasting(true);
    try {
      const res = await fetchWithAuth('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage })
      });
      
      if (res.ok) {
        toast.success('Broadcast message sent to all users');
        setIsBroadcastModalOpen(false);
        setBroadcastMessage('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send broadcast');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSystemSetup = async () => {
    const confirm = window.confirm("This will attempt to create missing database tables. Continue?");
    if (!confirm) return;

    toast.loading('Running system setup...', { id: 'setup' });
    try {
      const res = await fetchWithAuth('/api/diag/setup', { method: 'POST' });
      if (res.ok) {
        toast.success('System setup completed successfully', { id: 'setup' });
        fetchStats();
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Setup failed', { id: 'setup' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during setup', { id: 'setup' });
    }
  };

  const handleMigrate = async () => {
    const confirm = window.confirm("This will copy all data from Supabase to AWS RDS. Existing data in RDS with same IDs will be updated. Continue?");
    if (!confirm) return;

    toast.loading('Migrating data to AWS RDS...', { id: 'migrate' });
    try {
      const res = await fetchWithAuth('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Migration successful! Migrated: ${Object.entries(data.results).map(([k, v]) => `${v} ${k}`).join(', ')}`, { id: 'migrate', duration: 5000 });
        fetchStats();
        fetchUsers();
      } else {
        toast.error(data.error || 'Migration failed', { id: 'migrate' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during migration', { id: 'migrate' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    
    setIsResetting(true);
    try {
      const res = await fetchWithAuth('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, newPassword })
      });
      
      if (res.ok) {
        toast.success(`Password reset for ${selectedUser.username}`);
        setIsResetModalOpen(false);
        setNewPassword('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsResetting(false);
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

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">System Administration</span>
          </div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">Global Overview</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Monitoring Gryndee system-wide performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { fetchStats(); fetchUsers(); }}
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
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">Accounts & Users</h2>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50">
                      <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Business Name</th>
                      <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Owner</th>
                      <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Users</th>
                      <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Joined Date</th>
                      <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredAccounts.map((account) => (
                      <tr key={account.id} className={cn("hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group", !account.is_active && "opacity-50")}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 font-black">
                              {account.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                {account.name}
                                {!account.is_active && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Inactive</span>}
                              </p>
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
                            <Users className="w-4 h-4 opacity-50" />
                            {account.users?.length || 0}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                            <Calendar className="w-4 h-4 opacity-50" />
                            {new Date(account.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleToggleAccountStatus(account.id, account.is_active)}
                              className={cn("p-2 transition-colors", account.is_active ? "text-zinc-400 hover:text-amber-500" : "text-amber-500 hover:text-amber-600")}
                              title={account.is_active ? "Deactivate Account" : "Activate Account"}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAccount(account.id)}
                              className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                              title="Delete Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Building2 className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
                            <p className="text-sm text-zinc-500 font-medium italic">No accounts found in the system.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredAccounts.map((account) => (
                <div key={account.id} className={cn("p-6 space-y-4", !account.is_active && "opacity-50")}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 font-black text-lg">
                        {account.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                          {account.name}
                          {!account.is_active && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Inactive</span>}
                        </h3>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">ID: #{account.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleToggleAccountStatus(account.id, account.is_active)}
                        className={cn("p-2.5 rounded-xl transition-all active:scale-95", account.is_active ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : "bg-amber-500/10 text-amber-500")}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Owner</p>
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{account.users?.[0]?.name || 'N/A'}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{account.users?.[0]?.email || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest text-right">Stats</p>
                      <div className="flex items-center justify-end gap-3 text-xs font-bold text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {account.users?.length || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(account.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAccounts.length === 0 && (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
                    <p className="text-sm text-zinc-500 font-medium italic">No accounts found.</p>
                  </div>
                </div>
              )}
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
              <button 
                onClick={handleSystemSetup}
                className="w-full flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all group border border-emerald-100 dark:border-emerald-900/30"
              >
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Database className="w-5 h-5" />
                </div>
                Run System Setup
              </button>
              <button 
                onClick={handleMigrate}
                className="w-full flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-sm font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group border border-blue-100 dark:border-blue-900/30"
              >
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                Migrate to AWS RDS
              </button>
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
              >
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                System Settings
              </button>
              <button 
                onClick={() => setIsBroadcastModalOpen(true)}
                className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
              >
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                Broadcast Message
              </button>
              <button 
                onClick={() => toast.info('Growth analytics dashboard is coming soon!')}
                className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
              >
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:text-emerald-500 transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                Growth Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBroadcastModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Broadcast Message</h3>
                <button onClick={() => setIsBroadcastModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBroadcast} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Message Content</label>
                  <textarea 
                    required
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[120px] resize-none"
                    placeholder="Enter message to send to all users..."
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isBroadcasting}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isBroadcasting ? 'Sending...' : 'Send Broadcast'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">System Settings</h3>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">Maintenance Mode</p>
                      <p className="text-[10px] text-zinc-500 font-medium">Disable access for all users</p>
                    </div>
                    <div className="w-12 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full relative cursor-not-allowed">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">New Registrations</p>
                      <p className="text-[10px] text-zinc-500 font-medium">Allow new users to sign up</p>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-not-allowed">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Reset Password</h3>
                <button onClick={() => setIsResetModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="p-8 space-y-6">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 font-medium">Resetting password for:</p>
                  <p className="text-sm font-black text-zinc-900 dark:text-white mt-1">@{selectedUser?.username}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">New Password</label>
                  <input 
                    required
                    type="text" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    placeholder="Enter new password"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isResetting}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Update Password'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


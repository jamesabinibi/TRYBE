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
  Key,
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
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshEnv = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchWithAuth('/api/admin/refresh-env', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Environment refreshed!');
        fetchStats(); // Reload stats to see if keys appeared
      } else {
        toast.error(data.error || 'Refresh failed');
      }
    } catch (err) {
      toast.error('Network error during refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setIsTestingSmtp(true);
    try {
      const res = await fetchWithAuth('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test email sent successfully!');
      } else {
        toast.error(data.error || 'Failed to send test email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setIsTestingSmtp(false);
    }
  };
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
      
      // Also fetch SMTP status
      const smtpRes = await fetchWithAuth('/api/admin/smtp-status');
      if (smtpRes.ok) {
        const smtpData = await smtpRes.json();
        setSmtpStatus(smtpData);
      }
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

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const confirm = window.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this user?`);
    if (!confirm) return;

    toast.loading(`Updating user status...`, { id: 'user-status' });
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });
      
      if (res.ok) {
        toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, { id: 'user-status' });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update user status', { id: 'user-status' });
      }
    } catch (err) {
      toast.error('Network error', { id: 'user-status' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this user? This action cannot be undone.");
    if (!confirm) return;

    toast.loading('Deleting user...', { id: 'delete-user' });
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
      
      if (res.ok) {
        toast.success('User deleted successfully', { id: 'delete-user' });
        fetchUsers();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete user', { id: 'delete-user' });
      }
    } catch (err) {
      toast.error('Network error', { id: 'delete-user' });
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
    (u.username?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) || 
    (u.email?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
    (u.name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase()) ||
    (u.account_name?.toLowerCase() || '').includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 overflow-x-hidden">
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
              onClick={() => setIsSmtpModalOpen(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                smtpStatus?.configured ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              )}
            >
              <Mail className="w-4 h-4" />
              SMTP: {smtpStatus?.configured ? 'Ready' : 'Check Config'}
            </button>
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

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white">Users</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search users..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>
        
        <div className="w-full">
          <div className="hidden md:block w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-800/50">
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">User</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Role</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Verified</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 font-black">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-900 dark:text-white">{user.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        <Building2 className="w-4 h-4 opacity-50" />
                        {user.account_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                        user.role === 'admin' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                        user.is_verified ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {user.is_verified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                        user.account_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {user.account_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setIsResetModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        {!user.is_verified && (
                          <button 
                            onClick={async () => {
                              try {
                                toast.loading('Resending verification...', { id: 'resend-v' });
                                const res = await fetchWithAuth('/api/auth/resend-verification', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email: user.email })
                                });
                                if (res.ok) {
                                  toast.success('Verification email sent', { id: 'resend-v' });
                                } else {
                                  const d = await res.json();
                                  toast.error(d.error || 'Failed to resend', { id: 'resend-v' });
                                }
                              } catch (e) {
                                toast.error('Network error', { id: 'resend-v' });
                              }
                            }}
                            className="p-2 text-zinc-400 hover:text-blue-500 transition-colors"
                            title="Resend Verification"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleToggleUserStatus(user.id, user.account_active)}
                          className={cn("p-2 transition-colors", user.account_active ? "text-zinc-400 hover:text-amber-500" : "text-amber-500 hover:text-amber-600")}
                          title={user.account_active ? "Deactivate User" : "Activate User"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Users View */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 font-black text-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white">{user.name}</h3>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setSelectedUser(user);
                        setIsResetModalOpen(true);
                      }}
                      className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl active:scale-95 transition-all"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleToggleUserStatus(user.id, user.account_active)}
                      className={cn("p-2.5 rounded-xl transition-all active:scale-95", user.account_active ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : "bg-amber-500/10 text-amber-500")}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Account</p>
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{user.account_name || 'N/A'}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Role & Status</p>
                    <div className="flex items-center justify-end gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                        user.role === 'admin' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {user.role}
                      </span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                        user.account_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {user.account_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals here... */}
      <AnimatePresence>
        {/* Modals */}
      </AnimatePresence>

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

      {/* SMTP Status Modal */}
      <AnimatePresence>
        {isSmtpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSmtpModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">SMTP Configuration</h3>
                <button onClick={() => setIsSmtpModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Host</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{smtpStatus?.host || 'Not set'}</p>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">From Address</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{smtpStatus?.from || 'Not set'}</p>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">User</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{smtpStatus?.user || 'Not set'}</p>
                    {smtpStatus?.env_keys && smtpStatus.env_keys.length > 0 && (
                      <p className="text-[8px] text-emerald-500 font-bold mt-1 uppercase tracking-widest">
                        Keys Found: {smtpStatus.env_keys.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-blue-500/10 text-blue-500 rounded-2xl text-[10px] font-bold">
                    <Activity className="w-4 h-4" />
                    <span>Ensure this domain is verified in your AWS SES console.</span>
                  </div>

                  <form onSubmit={handleTestSmtp} className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Test SMTP Connection</p>
                    <div className="flex gap-2">
                      <input 
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="Recipient email"
                        className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <button 
                        type="submit"
                        disabled={isTestingSmtp || !testEmail}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {isTestingSmtp ? 'Sending...' : 'Test'}
                      </button>
                    </div>
                  </form>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                      onClick={handleRefreshEnv}
                      disabled={isRefreshing}
                      className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh System Environment'}
                    </button>
                    <p className="text-[8px] text-zinc-400 text-center mt-2 font-bold uppercase tracking-wider">
                      Click this after updating secrets in the panel
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsSmtpModalOpen(false)}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


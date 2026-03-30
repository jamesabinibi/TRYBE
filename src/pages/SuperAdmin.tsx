import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Package, 
  ShoppingCart, 
  FileText,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Search,
  Key,
  Sparkles,
  Mail,
  Calendar,
  ExternalLink,
  Settings as SettingsIcon,
  Database,
  Lock,
  X,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Trash2,
  Power,
  RefreshCw,
  Smartphone,
  Download,
  Image as ImageIcon,
  AlertCircle,
  Cloud
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

const StatCard = ({ title, value, icon: Icon, color }: any) => (
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
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isMobileAssetsModalOpen, setIsMobileAssetsModalOpen] = useState(false);
  const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);
  const [mobileAssets, setMobileAssets] = useState<{ icon?: string, splash?: string }>({});

  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isLegalDocsModalOpen, setIsLegalDocsModalOpen] = useState(false);
  const [legalDocs, setLegalDocs] = useState({ terms_and_conditions: '', privacy_policy: '' });
  const [isSavingLegalDocs, setIsSavingLegalDocs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  const fetchLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const res = await fetchWithAuth('/api/debug/logs', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      toast.error('Failed to fetch logs');
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const fetchLegalDocs = async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/legal-docs?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setLegalDocs(data);
      }
    } catch (error) {
      console.error('Failed to fetch legal docs:', error);
    }
  };

  const saveLegalDocs = async () => {
    setIsSavingLegalDocs(true);
    try {
      const response = await fetchWithAuth('/api/admin/legal-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legalDocs)
      });
      if (response.ok) {
        toast.success('Legal documents updated successfully');
        setIsLegalDocsModalOpen(false);
      } else {
        toast.error('Failed to update legal documents');
      }
    } catch (error) {
      console.error('Failed to save legal docs:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsSavingLegalDocs(false);
    }
  };

  const handleGenerateAsset = async (type: 'icon' | 'splash') => {
    setIsGeneratingAsset(true);
    try {
      const res = await fetchWithAuth('/api/admin/generate-mobile-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (res.ok) {
        setMobileAssets(prev => ({ ...prev, [type]: data.base64 }));
        toast.success(`${type === 'icon' ? 'App Icon' : 'Splash Screen'} generated!`);
      } else {
        toast.error(data.error || 'Failed to generate asset');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsGeneratingAsset(false);
    }
  };

  const downloadAsset = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const [isSmtpConfigModalOpen, setIsSmtpConfigModalOpen] = useState(false);
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [isFetchingDiagnostic, setIsFetchingDiagnostic] = useState(false);
  const [secrets, setSecrets] = useState({
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    AWS_S3_BUCKET_NAME: '',
    AWS_REGION: 'us-east-1',
    PAYSTACK_PUBLIC_KEY: '',
    PAYSTACK_SECRET_KEY: '',
    GEMINI_API_KEY: ''
  });

  const fetchSecrets = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/secrets');
      if (res.ok) {
        const data = await res.json();
        setSecrets(data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (isSecretsModalOpen) {
      fetchSecrets();
    }
  }, [isSecretsModalOpen]);

  const [isSavingSecrets, setIsSavingSecrets] = useState(false);

  const fetchDiagnostic = async () => {
    setIsFetchingDiagnostic(true);
    try {
      const res = await fetchWithAuth('/api/admin/check-rds-images');
      const data = await res.json();
      if (res.ok) {
        setDiagnosticData(data);
        setIsDiagnosticModalOpen(true);
      } else {
        toast.error(data.error || 'Failed to fetch diagnostic data');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch diagnostic data');
    } finally {
      setIsFetchingDiagnostic(false);
    }
  };

  const handleUpdateSecrets = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSecrets(true);
    try {
      const res = await fetchWithAuth('/api/admin/update-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env: secrets })
      });
      if (res.ok) {
        toast.success('Secrets updated successfully!');
        setIsSecretsModalOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update secrets');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update secrets');
    } finally {
      setIsSavingSecrets(false);
    }
  };

  const [smtpConfig, setSmtpConfig] = useState({
    user: '',
    pass: '',
    host: '',
    port: 587,
    secure: false,
    from: ''
  });
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const handleUpdateSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    try {
      const res = await fetchWithAuth('/api/admin/update-smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('SMTP configuration updated in database!');
        setIsSmtpConfigModalOpen(false);
        fetchStats(); // Refresh status
      } else {
        toast.error(data.error || 'Failed to update SMTP config');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSavingSmtp(false);
    }
  };

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
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Delete Account</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this account? This will delete all associated users, products, and sales. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
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
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">System Setup</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">This will attempt to create missing database tables. Continue?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
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
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            Continue
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleMigrate = async () => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Migrate Data</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">This will copy all data from Supabase to AWS RDS. Existing data in RDS with same IDs will be updated. Continue?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              toast.loading('Migrating data to AWS RDS...', { id: 'migrate' });
              try {
                const res = await fetchWithAuth('/api/admin/migrate-database', { method: 'POST' });
                const data = await res.json();
                
                if (res.ok) {
                  toast.success(`Migration successful! Migrated: ${data.results?.migrated || 0} records`, { id: 'migrate', duration: 5000 });
                  fetchStats();
                  fetchUsers();
                } else {
                  toast.error(data.error || 'Migration failed', { id: 'migrate' });
                }
              } catch (err: any) {
                toast.error(err.message || 'Network error during migration', { id: 'migrate' });
              }
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            Migrate
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleMigrateImages = async () => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Migrate Images</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">This will copy all product images, service images, and settings logos to AWS S3. Continue?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              toast.loading('Migrating images to AWS S3...', { id: 'migrate-images' });
              try {
                const res = await fetchWithAuth('/api/admin/migrate-images', { method: 'POST' });
                const data = await res.json();
                
                if (res.ok) {
                  if ((data.results?.migrated || 0) === 0) {
                    toast.info('No images were migrated. They might already be on S3 or the upload failed. Check logs for details.', { id: 'migrate-images', duration: 5000 });
                  } else {
                    toast.success(`Image migration successful! Migrated: ${data.results?.migrated || 0} images`, { id: 'migrate-images', duration: 5000 });
                  }
                } else {
                  toast.error(data.error || 'Image migration failed', { id: 'migrate-images' });
                }
              } catch (err: any) {
                toast.error(err.message || 'Network error during image migration', { id: 'migrate-images' });
              }
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            Migrate Images
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGemini(true);
    try {
      const res = await fetchWithAuth('/api/admin/update-gemini-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey })
      });
      
      if (res.ok) {
        toast.success('Gemini API Key updated successfully');
        setIsGeminiModalOpen(false);
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update Gemini key');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">{newStatus ? 'Activate' : 'Deactivate'} User</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to {newStatus ? 'activate' : 'deactivate'} this user?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
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
              } catch (err: any) {
                toast.error(err.message || 'Network error', { id: 'user-status' });
              }
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            {newStatus ? 'Activate' : 'Deactivate'}
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleDeleteUser = async (userId: string) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Delete User</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
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
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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
    String(acc.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase())
  ) || [];

  const filteredUsers = users.filter(u => 
    String(u.username || '').toLowerCase().includes(String(userSearchQuery || '').toLowerCase()) || 
    String(u.email || '').toLowerCase().includes(String(userSearchQuery || '').toLowerCase()) ||
    String(u.name || '').toLowerCase().includes(String(userSearchQuery || '').toLowerCase()) ||
    String(u.account_name || '').toLowerCase().includes(String(userSearchQuery || '').toLowerCase())
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
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={handleMigrate}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-brand/10 text-brand rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-brand/20 transition-all shadow-sm whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Migrate DB
          </button>
          <button 
            onClick={handleMigrateImages}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-500/10 text-blue-500 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all shadow-sm whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Migrate Images
          </button>
          <button 
            onClick={fetchDiagnostic}
            disabled={isFetchingDiagnostic}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-500/10 text-indigo-500 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {isFetchingDiagnostic ? 'Checking...' : 'Check Status'}
          </button>
          <button 
            onClick={() => setIsMobileAssetsModalOpen(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg whitespace-nowrap"
          >
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Mobile Assets
          </button>
          <button 
            onClick={() => setIsGeminiModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
              smtpStatus?.geminiConfigured ? "bg-purple-500/10 text-purple-500" : "bg-amber-500/10 text-amber-500"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            AI: {smtpStatus?.geminiConfigured ? 'Ready' : 'Check Config'}
          </button>
          <button 
            onClick={() => setIsSmtpModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
              smtpStatus?.configured ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
            )}
          >
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            SMTP: {smtpStatus?.configured ? 'Ready' : 'Check Config'}
          </button>
          <button 
            onClick={() => {
              setIsLogsModalOpen(true);
              fetchLogs();
            }}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all shadow-sm whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            View Logs
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => {
                fetchLegalDocs();
                setIsLegalDocsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-all shadow-sm"
              title="Legal Documents"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Legal Docs</span>
            </button>
            <button 
              onClick={() => setIsSecretsModalOpen(true)}
              className="p-2.5 sm:p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors shadow-sm"
              title="Manage Secrets"
            >
              <Key className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={async () => {
                try {
                  const res = await fetchWithAuth('/api/admin/refresh-env', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success('Environment refreshed successfully!');
                    fetchStats();
                  } else {
                    toast.error(data.error || 'Failed to refresh environment');
                  }
                } catch (err: any) {
                  toast.error(err.message || 'Failed to refresh environment');
                }
              }}
              className="p-2.5 sm:p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-amber-500 transition-colors shadow-sm"
              title="Refresh Environment"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={() => { fetchStats(); fetchUsers(); }}
              className="p-2.5 sm:p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors shadow-sm"
              title="Reload Data"
            >
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Accounts" 
          value={stats?.accounts} 
          icon={Building2} 
          color="bg-blue-500/10 text-blue-600"
        />
        <StatCard 
          title="Active Users" 
          value={stats?.users} 
          icon={Users} 
          color="bg-purple-500/10 text-purple-600"
        />
        <StatCard 
          title="Total Products" 
          value={stats?.products} 
          icon={Package} 
          color="bg-orange-500/10 text-orange-600"
        />
        <StatCard 
          title="System Sales" 
          value={stats?.sales} 
          icon={ShoppingCart} 
          color="bg-emerald-500/10 text-emerald-600"
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
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account Type</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Business Type</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Role</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Verified</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 font-black">
                            {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-white">{user.name}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider",
                          user.account_type === 'business' ? "bg-indigo-500/10 text-indigo-500" : "bg-zinc-500/10 text-zinc-500"
                        )}>
                          {user.account_type || 'Personal'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{user.business_type || 'N/A'}</p>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center">
                          <Users className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">No users found</p>
                      </div>
                    </td>
                  </tr>
                )}
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
                      {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
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

      {/* Legal Docs Modal */}
      <AnimatePresence>
        {isLegalDocsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLegalDocsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Legal Documents</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Update global Terms & Conditions and Privacy Policy</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLegalDocsModalOpen(false)}
                  className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Terms & Conditions
                  </label>
                  <textarea
                    value={legalDocs.terms_and_conditions}
                    onChange={(e) => setLegalDocs({ ...legalDocs, terms_and_conditions: e.target.value })}
                    className="w-full h-64 p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm resize-none"
                    placeholder="Enter Terms & Conditions content (HTML or Plain Text)..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Privacy Policy
                  </label>
                  <textarea
                    value={legalDocs.privacy_policy}
                    onChange={(e) => setLegalDocs({ ...legalDocs, privacy_policy: e.target.value })}
                    className="w-full h-64 p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm resize-none"
                    placeholder="Enter Privacy Policy content (HTML or Plain Text)..."
                  />
                </div>
              </div>

              <div className="p-8 bg-zinc-50/50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-4">
                <button
                  onClick={() => setIsLegalDocsModalOpen(false)}
                  className="px-8 py-4 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveLegalDocs}
                  disabled={isSavingLegalDocs}
                  className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {isSavingLegalDocs ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Assets Modal */}
      <AnimatePresence>
        {isMobileAssetsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileAssetsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Native Mobile Assets</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-1">Generate high-resolution icons and splash screens for iOS & Android</p>
                </div>
                <button onClick={() => setIsMobileAssetsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* App Icon */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">App Icon (1024x1024)</h4>
                    {mobileAssets.icon && (
                      <button 
                        onClick={() => downloadAsset(mobileAssets.icon!, 'icon.png')}
                        className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        Download PNG
                      </button>
                    )}
                  </div>
                  <div className="aspect-square bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden group relative">
                    {mobileAssets.icon ? (
                      <img src={`data:image/png;base64,${mobileAssets.icon}`} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6">
                        <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-xs text-zinc-400 font-medium">No icon generated yet</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button 
                        onClick={() => handleGenerateAsset('icon')}
                        disabled={isGeneratingAsset}
                        className="px-6 py-3 bg-white text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                      >
                        {isGeneratingAsset ? 'Generating...' : mobileAssets.icon ? 'Regenerate Icon' : 'Generate Icon'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Splash Screen */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider">Splash Screen (1920x1080)</h4>
                    {mobileAssets.splash && (
                      <button 
                        onClick={() => downloadAsset(mobileAssets.splash!, 'splash.png')}
                        className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        Download PNG
                      </button>
                    )}
                  </div>
                  <div className="aspect-video bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden group relative">
                    {mobileAssets.splash ? (
                      <img src={`data:image/png;base64,${mobileAssets.splash}`} alt="Splash Screen" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6">
                        <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                        <p className="text-xs text-zinc-400 font-medium">No splash screen generated yet</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button 
                        onClick={() => handleGenerateAsset('splash')}
                        disabled={isGeneratingAsset}
                        className="px-6 py-3 bg-white text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                      >
                        {isGeneratingAsset ? 'Generating...' : mobileAssets.splash ? 'Regenerate Splash' : 'Generate Splash'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-1">AI-Powered Assets</h5>
                    <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                      These assets are generated using Gemini 3.1 Flash Image. Once downloaded, you can use them with the Capacitor Assets tool to automatically generate all required sizes for the App Store and Play Store.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
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
        {isLogsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-brand" />
                    <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">System Diagnostics</span>
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">System Logs</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    disabled={isFetchingLogs}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-5 h-5", isFetchingLogs && "animate-spin")} />
                  </button>
                  <button
                    onClick={() => setIsLogsModalOpen(false)}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1 bg-zinc-950 text-zinc-300 selection:bg-brand/30">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className={cn(
                      "py-0.5 border-l-2 pl-3",
                      log.startsWith('[ERR]') ? "border-red-500 text-red-400 bg-red-500/5" : 
                      log.startsWith('[LOG] [AWS S3]') ? "border-blue-500 text-blue-400 bg-blue-500/5" :
                      "border-zinc-800"
                    )}>
                      <span className="opacity-50 mr-2">[{i.toString().padStart(3, '0')}]</span>
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 py-20">
                    <Activity className="w-12 h-12 opacity-20 animate-pulse" />
                    <p className="font-sans font-medium">No logs available yet</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  Showing last {logs.length} entries
                </p>
                <button
                  onClick={() => setIsLogsModalOpen(false)}
                  className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  Close Console
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isDiagnosticModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDiagnosticModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col my-8"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Image Migration Status</span>
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Diagnostic Results</h2>
                </div>
                <button
                  onClick={() => setIsDiagnosticModalOpen(false)}
                  className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh]">
                {/* AWS Config Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    AWS S3 Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Bucket Status</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", diagnosticData?.awsConfig?.bucketSet ? "bg-emerald-500" : "bg-red-500")} />
                        <p className="text-sm font-black text-zinc-900 dark:text-white">
                          {diagnosticData?.awsConfig?.bucketName || 'Not Configured'}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Region</p>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{diagnosticData?.awsConfig?.region}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Access Keys</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", diagnosticData?.awsConfig?.accessKeySet && diagnosticData?.awsConfig?.secretKeySet ? "bg-emerald-500" : "bg-red-500")} />
                        <p className="text-sm font-black text-zinc-900 dark:text-white">
                          {diagnosticData?.awsConfig?.accessKeySet ? 'Keys Configured' : 'Keys Missing'}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">S3 Connection Test</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", diagnosticData?.awsConfig?.s3Test === 'SUCCESS' ? "bg-emerald-500" : diagnosticData?.awsConfig?.s3Test === 'NOT RUN' ? "bg-zinc-400" : "bg-red-500")} />
                        <p className="text-sm font-black text-zinc-900 dark:text-white">{diagnosticData?.awsConfig?.s3Test}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RDS Counts Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    RDS Image Counts
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Products</p>
                      <p className="text-2xl font-black text-zinc-900 dark:text-white">{diagnosticData?.productImagesCount}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Services</p>
                      <p className="text-2xl font-black text-zinc-900 dark:text-white">{diagnosticData?.servicesCount}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Logos</p>
                      <p className="text-2xl font-black text-zinc-900 dark:text-white">{diagnosticData?.settingsCount}</p>
                    </div>
                  </div>
                </div>

                {/* Samples Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Data Format Samples
                  </h3>
                  <div className="space-y-2">
                    {diagnosticData?.samples?.productImages?.length > 0 && (
                      <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 font-mono text-[10px]">
                        <p className="text-indigo-400 mb-2 uppercase font-black tracking-widest">Product Images Sample:</p>
                        {diagnosticData.samples.productImages.map((s: string, i: number) => (
                          <div key={i} className="text-zinc-500 truncate mb-1">
                            {s.startsWith('http') ? (
                              <span className={cn(s.includes('amazonaws.com') ? "text-emerald-500" : "text-amber-500")}>
                                {s.includes('amazonaws.com') ? '[S3] ' : '[EXTERNAL URL] '}
                                {s}
                              </span>
                            ) : (
                              <span className="text-zinc-400">[BASE64] {s}...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {diagnosticData?.samples?.services?.length > 0 && (
                      <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 font-mono text-[10px]">
                        <p className="text-indigo-400 mb-2 uppercase font-black tracking-widest">Services Sample:</p>
                        {diagnosticData.samples.services.map((s: string, i: number) => (
                          <div key={i} className="text-zinc-500 truncate mb-1">
                            {s.startsWith('http') ? (
                              <span className={cn(s.includes('amazonaws.com') ? "text-emerald-500" : "text-amber-500")}>
                                {s.includes('amazonaws.com') ? '[S3] ' : '[EXTERNAL URL] '}
                                {s}
                              </span>
                            ) : (
                              <span className="text-zinc-400">[BASE64] {s}...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  onClick={() => setIsDiagnosticModalOpen(false)}
                  className="px-8 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={handleMigrateImages}
                  className="px-8 py-3 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-500/25"
                >
                  Start Migration
                </button>
              </div>
            </motion.div>
          </div>
        )}

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

      {/* SMTP Manual Configuration Modal */}
      <AnimatePresence>
        {isSmtpConfigModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSmtpConfigModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Manual SMTP Setup</h3>
                <button onClick={() => setIsSmtpConfigModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSmtpConfig} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">SMTP Host</label>
                  <input 
                    required
                    type="text"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({...smtpConfig, host: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder="e.g. email-smtp.us-east-1.amazonaws.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Port</label>
                    <input 
                      required
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({...smtpConfig, port: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Secure (SSL/TLS)</label>
                    <div className="flex items-center h-[44px]">
                      <button
                        type="button"
                        onClick={() => setSmtpConfig({...smtpConfig, secure: !smtpConfig.secure})}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors",
                          smtpConfig.secure ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          smtpConfig.secure ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">SMTP User</label>
                  <input 
                    required
                    type="text"
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({...smtpConfig, user: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder="SMTP Username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">SMTP Password</label>
                  <input 
                    required
                    type="password"
                    value={smtpConfig.pass}
                    onChange={(e) => setSmtpConfig({...smtpConfig, pass: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder="SMTP Password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">From Address</label>
                  <input 
                    required
                    type="text"
                    value={smtpConfig.from}
                    onChange={(e) => setSmtpConfig({...smtpConfig, from: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    placeholder='"Gryndee" <noreply@gryndee.com>'
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSavingSmtp}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-4"
                >
                  {isSavingSmtp ? 'Saving...' : 'Save Configuration'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SMTP Status Modal */}
      {/* Gemini Configuration Modal */}
      <AnimatePresence>
        {isGeminiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGeminiModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Gemini AI Config</h3>
                </div>
                <button onClick={() => setIsGeminiModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGemini} className="p-8 space-y-6">
                <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                  <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 leading-relaxed">
                    Enter your Google Gemini API Key to enable AI-powered insights, transaction extraction, and business forecasting.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Gemini API Key</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      required
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                      placeholder="AIzaSy..."
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSavingGemini || !geminiKey}
                  className="w-full py-4 bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                  {isSavingGemini ? 'Updating...' : 'Save Gemini Key'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setSmtpConfig({
                          user: smtpStatus?.user === 'Not set' ? '' : smtpStatus?.user || '',
                          pass: '',
                          host: smtpStatus?.host || '',
                          port: 587,
                          secure: false,
                          from: smtpStatus?.from || ''
                        });
                        setIsSmtpConfigModalOpen(true);
                      }}
                      className="w-full py-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <SettingsIcon className="w-3 h-3" />
                      Manual Configuration (Database)
                    </button>
                    <p className="text-[8px] text-zinc-400 text-center font-bold uppercase tracking-wider">
                      Use this if environment variables are not working
                    </p>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                      type="button"
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
        {/* Secrets Management Modal */}
        {isSecretsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                    <Key className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Manage Secrets</h2>
                    <p className="text-xs text-zinc-500 font-medium">Update system environment variables</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSecretsModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateSecrets} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Supabase URL</label>
                    <input 
                      type="text"
                      value={secrets.SUPABASE_URL === 'Configured' ? '' : secrets.SUPABASE_URL}
                      onChange={(e) => setSecrets(prev => ({ ...prev, SUPABASE_URL: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.SUPABASE_URL === 'Configured' ? 'Already Configured' : "https://your-project.supabase.co"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Supabase Anon Key</label>
                    <input 
                      type="password"
                      value={secrets.SUPABASE_ANON_KEY === 'Configured' ? '' : secrets.SUPABASE_ANON_KEY}
                      onChange={(e) => setSecrets(prev => ({ ...prev, SUPABASE_ANON_KEY: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.SUPABASE_ANON_KEY === 'Configured' ? 'Already Configured' : "Your public anon key"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AWS Access Key ID</label>
                    <input 
                      type="text"
                      value={secrets.AWS_ACCESS_KEY_ID === 'Configured' ? '' : secrets.AWS_ACCESS_KEY_ID}
                      onChange={(e) => setSecrets(prev => ({ ...prev, AWS_ACCESS_KEY_ID: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.AWS_ACCESS_KEY_ID === 'Configured' ? 'Already Configured' : "AKIA..."}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AWS Secret Access Key</label>
                    <input 
                      type="password"
                      value={secrets.AWS_SECRET_ACCESS_KEY === 'Configured' ? '' : secrets.AWS_SECRET_ACCESS_KEY}
                      onChange={(e) => setSecrets(prev => ({ ...prev, AWS_SECRET_ACCESS_KEY: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.AWS_SECRET_ACCESS_KEY === 'Configured' ? 'Already Configured' : "Your secret key"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">S3 Bucket Name</label>
                    <input 
                      type="text"
                      value={secrets.AWS_S3_BUCKET_NAME === 'Configured' ? '' : secrets.AWS_S3_BUCKET_NAME}
                      onChange={(e) => setSecrets(prev => ({ ...prev, AWS_S3_BUCKET_NAME: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.AWS_S3_BUCKET_NAME === 'Configured' ? 'Already Configured' : "my-app-images"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AWS Region</label>
                    <input 
                      type="text"
                      value={secrets.AWS_REGION}
                      onChange={(e) => setSecrets(prev => ({ ...prev, AWS_REGION: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="us-east-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Paystack Public Key</label>
                    <input 
                      type="text"
                      value={secrets.PAYSTACK_PUBLIC_KEY === 'Configured' ? '' : secrets.PAYSTACK_PUBLIC_KEY}
                      onChange={(e) => setSecrets(prev => ({ ...prev, PAYSTACK_PUBLIC_KEY: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.PAYSTACK_PUBLIC_KEY === 'Configured' ? 'Already Configured' : "pk_test_..."}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Paystack Secret Key</label>
                    <input 
                      type="password"
                      value={secrets.PAYSTACK_SECRET_KEY === 'Configured' ? '' : secrets.PAYSTACK_SECRET_KEY}
                      onChange={(e) => setSecrets(prev => ({ ...prev, PAYSTACK_SECRET_KEY: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.PAYSTACK_SECRET_KEY === 'Configured' ? 'Already Configured' : "sk_test_..."}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gemini API Key</label>
                    <input 
                      type="password"
                      value={secrets.GEMINI_API_KEY === 'Configured' ? '' : secrets.GEMINI_API_KEY}
                      onChange={(e) => setSecrets(prev => ({ ...prev, GEMINI_API_KEY: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={secrets.GEMINI_API_KEY === 'Configured' ? 'Already Configured' : "Your Gemini API Key"}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsSecretsModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingSecrets}
                    className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingSecrets ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Save Secrets
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


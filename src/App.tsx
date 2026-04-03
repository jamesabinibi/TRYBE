import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users as UsersIcon, 
  Settings as SettingsIcon, 
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Plus,
  Brain,
  ChevronRight,
  Wallet,
  Users,
  Briefcase,
  Moon,
  Sun,
  ShieldCheck,
  Crown,
  FileText,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from './types';
import { toast } from 'sonner';
import { SearchProvider, useSearch } from './contexts/SearchContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AIAdvisor from './pages/AIAdvisor';
import Finance from './pages/Finance';
import Products from './pages/Products';
import Services from './pages/Services';
import Sales from './pages/Sales';
import SuperAdmin from './pages/SuperAdmin';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Customers from './pages/Customers';
import TaxReport from './pages/TaxReport';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import PublicInvoice from './pages/PublicInvoice';
import PublicPage from './pages/PublicPage';
import { cn, apiFetch } from './lib/utils';
import NotificationCenter from './components/NotificationCenter';
import Walkthrough from './components/Walkthrough';
import ChatSupport from './components/ChatSupport';
import { Input } from './components/Input';

import { Toaster } from 'sonner';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

interface Settings {
  business_name: string;
  currency: string;
  vat_enabled: boolean;
  low_stock_threshold: number;
  logo_url: string | null;
  brand_color: string;
  slogan: string;
  address: string;
  email: string;
  website: string;
  phone_number: string;
  welcome_email_subject?: string;
  welcome_email_body?: string;
  invoice_footer?: string;
  invoice_terms?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  business_type?: string;
  legal_structure?: string;
}

interface SettingsContextType {
  settings: Settings | null;
  refreshSettings: () => Promise<void>;
}

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SettingsContext = createContext<SettingsContextType | null>(null);
const ThemeContext = createContext<ThemeContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ...(user?.role === 'super_admin' || user?.email?.toLowerCase() === 'abinibimultimedia@yahoo.com' ? [{ icon: Globe, label: 'Landing Page', path: '/landing' }] : []),
    ...(user?.role !== 'staff' ? [{ icon: Brain, label: 'AI Intelligence', path: '/ai-advisor' }] : []),
    ...(user?.role !== 'staff' ? [{ icon: Wallet, label: 'Finance', path: '/finance' }] : []),
    { icon: Package, label: 'Inventory', path: '/products' },
    { icon: ShoppingCart, label: 'Sales', path: '/sales' },
    ...(user?.role !== 'staff' ? [{ icon: FileText, label: 'Tax Report', path: '/tax' }] : []),
    { icon: FileText, label: 'Invoices', path: '/invoices' },
    { icon: Users, label: 'Customers', path: '/customers' },
    ...(user?.role !== 'staff' ? [{ icon: Crown, label: 'Subscription', path: '/subscription' }] : []),
    ...(user?.role === 'super_admin' || user?.email?.toLowerCase() === 'abinibimultimedia@yahoo.com' ? [{ icon: ShieldCheck, label: 'Super Admin', path: '/super-admin' }] : []),
    ...(user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_view_account_data) ? [{ icon: SettingsIcon, label: 'Settings', path: '/settings' }] : []),
  ];

  const brandColor = '#ff4d00';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 flex flex-col z-50 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        isDarkMode ? "bg-[#0A0A0B] text-zinc-400 border-r border-white/[0.04]" : "bg-white text-zinc-500 border-r border-zinc-200",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {settings?.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={settings.business_name} 
                className="h-9 w-auto max-w-full object-contain object-left"
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium text-sm shadow-lg shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {settings?.business_name?.charAt(0) || 'S'}
                </div>
                <span className={cn(
                  "font-display font-medium text-lg tracking-tight flex items-center gap-1.5 truncate",
                  isDarkMode ? "text-white" : "text-zinc-900"
                )}>
                  {settings?.business_name || 'Gryndee'}
                  {(user?.subscription_plan === 'pro' || user?.subscription_plan === 'professional' || user?.subscription_plan === 'trial') && (
                    <ShieldCheck className="w-4 h-4 text-brand fill-brand/10 shrink-0" />
                  )}
                </span>
              </>
            )}
          </div>
          <button onClick={onClose} className="lg:hidden p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <nav id="sidebar-nav" className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const navId = `nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`;
            return (
              <Link
                key={item.path}
                id={navId}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? isDarkMode ? "text-white" : "text-zinc-900"
                    : "hover:bg-zinc-100 dark:hover:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                <item.icon className={cn("w-4.5 h-4.5 transition-colors", isActive ? "text-brand" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300")} />
                <span className="text-sm font-medium tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute inset-0 bg-brand/5 dark:bg-brand/10 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className={cn(
            "rounded-2xl p-4 border",
            isDarkMode ? "bg-white/[0.02] border-white/[0.04]" : "bg-zinc-50 border-zinc-100"
          )}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-medium text-sm">
                {user?.name?.charAt(0) || user?.username?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isDarkMode ? "text-white" : "text-zinc-900")}>
                  {user?.name}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">{user?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleDarkMode}
                className="flex-1 flex items-center justify-center p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button 
                onClick={logout}
                className="flex-1 flex items-center justify-center p-2.5 rounded-xl bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { isDarkMode } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useSearch();

  const brandColor = '#ff4d00';

  return (
    <div className={cn(
      "flex min-h-screen w-full font-sans selection:bg-brand/20 selection:text-brand transition-colors duration-300 overflow-x-hidden",
      isDarkMode ? "bg-[#050505] text-white" : "bg-zinc-50 text-zinc-900"
    )} style={{ '--brand-color': brandColor } as any}>
      {user && <Walkthrough />}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header id="main-header" className={cn(
          "h-16 border-b flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 transition-colors duration-300",
          isDarkMode 
            ? "bg-[#050505]/80 backdrop-blur-md border-white/[0.04]" 
            : "bg-white/80 backdrop-blur-md border-zinc-100"
        )}>
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                type="text" 
                placeholder="Search anything..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user && <NotificationCenter userId={user.id} />}
            
            <Link 
              to={location.pathname.startsWith('/products') ? "/products?action=add" : "/sales"}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">
                {location.pathname.startsWith('/products') ? "Add Product" : "New Transaction"}
              </span>
            </Link>

            {user?.role === 'admin' || user?.role === 'super_admin' ? (
              <Link 
                to="/settings"
                className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/[0.05] flex items-center justify-center text-[11px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-white/[0.05] hover:bg-zinc-300 dark:hover:bg-white/[0.1] transition-colors cursor-pointer relative"
                title="Settings"
              >
                {user?.name?.charAt(0) || user?.username?.charAt(0) || '?'}
                {(user?.subscription_plan === 'pro' || user?.subscription_plan === 'professional') && (
                  <div className="absolute -top-1 -right-1 bg-white dark:bg-[#050505] rounded-full p-0.5">
                    <ShieldCheck className="w-3 h-3 text-brand fill-brand/10" />
                  </div>
                )}
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/[0.05] flex items-center justify-center text-[11px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-white/[0.05] relative">
                {user?.name?.charAt(0) || user?.username?.charAt(0) || '?'}
                {(user?.subscription_plan === 'pro' || user?.subscription_plan === 'professional') && (
                  <div className="absolute -top-1 -right-1 bg-white dark:bg-[#050505] rounded-full p-0.5">
                    <ShieldCheck className="w-3 h-3 text-brand fill-brand/10" />
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div id="main-content-area" className="flex-1 p-4 sm:p-6 lg:p-8 main-content">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      if (!saved || saved === 'undefined' || saved === 'null') return null;
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
      localStorage.removeItem('user');
      return null;
    }
  });

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const res = await fetchWithAuth('/api/settings');
      if (res.ok) {
        let data = await res.json();
        
        // 1. Decode branding from business_name if it's encoded (Server-side fallback)
        if (data.business_name && data.business_name.startsWith('[')) {
          const match = data.business_name.match(/^\[(#?[a-fA-F0-9]{3,6})\]\s*(.*)/);
          if (match) {
            data.brand_color = match[1];
            data.business_name = match[2];
          }
        } else if (data.business_name && data.business_name.startsWith('{"')) {
          try {
            const branding = JSON.parse(data.business_name);
            data.business_name = branding.name;
            data.brand_color = data.brand_color || branding.color;
            data.logo_url = data.logo_url || branding.logo;
          } catch (e) {}
        }

        // 2. Update settings state
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  useEffect(() => {
    console.log('[INIT] App component mounted');
    console.log('[INIT] Current user:', user?.id || 'Guest');
    console.log('[INIT] Current settings:', settings?.business_name || 'Not loaded');
    
    const root = document.documentElement;
    const color = '#ff4d00';
    
    root.style.setProperty('--brand-color', color);
    root.style.setProperty('--brand-color-hover', `${color}dd`);
    root.style.setProperty('--brand-color-muted', `${color}1a`);
    root.style.setProperty('--brand-color-light', `${color}33`);
  }, []);

  useEffect(() => {
    if (settings?.business_name) {
      document.title = `${settings.business_name} | Gryndee`;
    }
  }, [settings]);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const res = await fetchWithAuth('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      'x-user-id': user?.id?.toString() || '',
    };
    
    // Support absolute URLs for mobile/Capacitor
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNative;
    let baseUrl = isNative ? (import.meta.env.VITE_API_URL || '') : '';
    
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    console.log(`[API] Fetching: ${fullUrl} (isNative: ${isNative}, baseUrl: ${baseUrl})`);
    
    const start = performance.now();
    try {
      const response = await fetch(fullUrl, { 
        ...options, 
        headers,
        credentials: 'include'
      });
      const end = performance.now();
      
      if (end - start > 1000) {
        console.warn(`[API] Slow request: ${fullUrl} took ${(end - start).toFixed(2)}ms`);
      }
      
      if (response.status === 429) {
        console.error(`[RATE LIMIT] Rate exceeded for ${fullUrl}`);
        toast.error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      
      if (response.status === 401) {
        console.warn('Unauthorized access detected, logging out...');
        logout();
      }
      
      return response;
    } catch (err) {
      const end = performance.now();
      console.error(`[API] Request failed: ${fullUrl} after ${(end - start).toFixed(2)}ms`, err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, fetchWithAuth }}>
      <SettingsContext.Provider value={{ settings, refreshSettings: fetchSettings }}>
        <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
          <SearchProvider>
            <Toaster position="top-right" richColors />
            <ChatSupport />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
                <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
                <Route path="/invoice/:id" element={<PublicInvoice />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/p/:pageId" element={<PublicPage />} />
                <Route 
                  path="/*" 
                  element={
                    user ? (
                      <Layout>
                        <Routes>
                          <Route path="/" element={user?.role === 'super_admin' ? <Navigate to="/super-admin" /> : <Dashboard />} />
                          <Route path="/landing" element={<Landing />} />
                          <Route path="/ai-advisor" element={user?.role === 'staff' ? <Navigate to="/" /> : <AIAdvisor />} />
                          <Route path="/finance" element={user?.role === 'staff' ? <Navigate to="/" /> : <Finance />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/sales" element={<Sales />} />
                          <Route path="/expenses" element={<Expenses />} />
                          <Route path="/tax" element={user?.role === 'staff' ? <Navigate to="/" /> : <TaxReport />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/subscription" element={<Subscription />} />
                          <Route path="/super-admin" element={<SuperAdmin />} />
                          <Route path="/settings" element={(user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_view_account_data)) ? <Settings /> : <Navigate to="/" />} />
                          <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                      </Layout>
                    ) : (
                      <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="*" element={<Navigate to="/login" />} />
                      </Routes>
                    )
                  } 
                />
              </Routes>
            </BrowserRouter>
          </SearchProvider>
        </ThemeContext.Provider>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );
}

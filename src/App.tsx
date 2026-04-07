import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
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
  Globe,
  Zap
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
import { cn, apiFetch, useQuery, useQueryClient } from './lib/utils';
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
  brandColor: string;
  businessLogo: string | null;
  businessName: string;
  landingConfig: any;
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
  const { settings, brandColor, businessLogo, businessName, landingConfig } = useSettings();
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

      <motion.aside
        initial={false}
        animate={{ 
          x: (isOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) ? 0 : -320,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-6 left-6 z-50 w-72 glass-card flex flex-col transition-all duration-500 ease-in-out",
          !isOpen && "max-lg:-translate-x-full"
        )}
      >
        {/* Logo Section */}
        <div className="h-24 px-6 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-xl shadow-black/5 border border-zinc-100 dark:border-white/10">
            {landingConfig?.logo?.favicon || landingConfig?.logo?.url || businessLogo ? (
              <img src={landingConfig?.logo?.favicon || landingConfig?.logo?.url || businessLogo} alt="" className="w-full h-full object-contain rounded-2xl p-2" />
            ) : (
              <div className="w-full h-full bg-zinc-200/50 dark:bg-zinc-700/50 animate-pulse rounded-2xl" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-display font-bold tracking-tight text-zinc-900 dark:text-white truncate max-w-[140px]">
              {businessName}
            </span>
            <span className="text-[9px] font-bold text-brand uppercase tracking-[0.2em]">Business Hub</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto no-scrollbar">
          <div className="px-3 mb-2 mt-1">
            <p className="label-text opacity-30 text-[10px]">Main Menu</p>
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && onClose()}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-300 relative overflow-hidden",
                  isActive 
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl shadow-black/10" 
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-white dark:text-zinc-900" : "text-zinc-400 group-hover:text-brand"
                )} />
                <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-5 bg-brand rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-zinc-200/50 dark:border-white/5">
          <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-[1.5rem] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-base">
                {user?.name?.charAt(0) || user?.username?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">{user?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleDarkMode}
                className="flex-1 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-brand transition-all active:scale-95 shadow-sm"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button 
                onClick={logout}
                className="flex-1 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95 shadow-sm"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { settings, brandColor } = useSettings();
  const { isDarkMode } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useSearch();

  return (
    <div className={cn(
      "flex min-h-screen w-full font-sans selection:bg-brand/20 selection:text-brand transition-colors duration-300 overflow-x-hidden",
      isDarkMode ? "bg-[#050505] text-white" : "bg-zinc-50 text-zinc-900"
    )} style={{ '--brand-color': brandColor } as any}>
      {user && <Walkthrough />}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 relative lg:pl-80">
        <header id="main-header" className="h-28 flex items-center justify-between px-8 sticky top-0 z-30 transition-all duration-300">
          <div className="flex items-center gap-6 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-12 h-12 flex items-center justify-center bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl text-zinc-500 hover:text-brand transition-all active:scale-95 shadow-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-md hidden md:block group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-brand transition-colors" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 pl-12 pr-6 bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && <NotificationCenter userId={user.id} />}
            
            <Link 
              to={location.pathname.startsWith('/products') ? "/products?action=add" : "/sales"}
              className="h-14 px-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-sm font-bold shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">
                {location.pathname.startsWith('/products') ? "Add Product" : "New Transaction"}
              </span>
            </Link>
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

  const { data: settings, refetch: refreshSettings } = useQuery('app_settings', async () => {
    const res = await fetchWithAuth('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
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
    return data;
  }, {
    persist: true,
    enabled: !!user
  });

  const { data: landingConfig } = useQuery('landing-config', async () => {
    const res = await apiFetch('/api/landing-config');
    if (!res.ok) return null;
    return res.json();
  }, { 
    persist: true
  });

  // Try to get cached data immediately to prevent flash
  const queryClient = useQueryClient();
  const cachedLandingConfig = queryClient.getQueryData('landing-config') as any;
  const cachedSettings = queryClient.getQueryData('app_settings') as any;

  const currentLandingConfig = landingConfig || cachedLandingConfig;
  const currentSettings = settings || cachedSettings;

  const brandColor = currentSettings?.brand_color || currentLandingConfig?.brandColor || '#11abdf';
  const businessLogo = currentLandingConfig?.logo?.favicon || currentLandingConfig?.logo?.url || currentSettings?.logo_url;
  const businessName = currentSettings?.business_name || currentLandingConfig?.logo?.text || 'Gryndee';

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand', brandColor);
    root.style.setProperty('--brand-color', brandColor);
    root.style.setProperty('--brand-color-hover', `${brandColor}dd`);
    root.style.setProperty('--brand-color-muted', `${brandColor}1a`);
    root.style.setProperty('--brand-color-light', `${brandColor}33`);
  }, [brandColor]);

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

  const fetchWithAuth = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> => {
    const headers = {
      ...options.headers,
      'x-user-id': user?.id?.toString() || '',
    };
    
    // Support absolute URLs for mobile/Capacitor, relative for web
    const isNative = Capacitor.isNativePlatform();
    let baseUrl = isNative ? (import.meta.env.VITE_API_URL || '') : '';
    
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
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
        if (retries > 0) {
          console.warn(`[RATE LIMIT] Rate exceeded for ${fullUrl}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithAuth(url, options, retries - 1, delay * 2);
        } else {
          console.error(`[RATE LIMIT] Rate exceeded for ${fullUrl} after max retries.`);
          toast.error('Rate limit exceeded. Please wait a moment before trying again.');
        }
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
      <SettingsContext.Provider value={{ 
        settings: settings || null, 
        refreshSettings: async () => { await refreshSettings(); },
        brandColor,
        businessLogo,
        businessName,
        landingConfig
      }}>
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

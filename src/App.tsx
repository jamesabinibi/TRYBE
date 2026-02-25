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
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from './types';
import { useSearch } from './contexts/SearchContext';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import { cn } from './lib/utils';
import NotificationCenter from './components/NotificationCenter';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: Package, label: 'Inventory', path: '/products' },
    { icon: ShoppingCart, label: 'Sales', path: '/sales' },
    { icon: BarChart3, label: 'Analytics', path: '/reports' },
    ...(user?.role === 'admin' ? [{ icon: UsersIcon, label: 'Team', path: '/users' }] : []),
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
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
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-zinc-950 text-zinc-400 flex flex-col border-r border-zinc-800/50 z-50 transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-emerald-500/20 rotate-3">
              S
            </div>
            <div>
              <span className="text-white font-black text-xl tracking-tight block leading-none">StockFlow</span>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1 block">Pro Edition</span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="px-4 mb-4">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Main Menu</p>
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                    : "hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-zinc-500 group-hover:text-emerald-400")} />
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-emerald-500 -z-10"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 space-y-4">
          <div className="bg-zinc-900/50 rounded-3xl p-4 border border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-sm font-black text-emerald-500 border border-emerald-500/20">
                {user?.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-black text-white truncate tracking-tight">{user?.name}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-zinc-400 transition-all font-black text-[10px] uppercase tracking-widest"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
          
          <div className="px-4 py-2 text-center">
            <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.3em]">Version 2.4.0-Stable</p>
          </div>
        </div>
      </aside>
    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useSearch();

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-30">
          <div className="flex items-center gap-6 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 text-zinc-500 hover:bg-zinc-100 rounded-2xl transition-all active:scale-95"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-md hidden md:block group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search for products, sales, or reports..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-zinc-100/50 border-transparent rounded-2xl text-sm font-medium focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/20 transition-all outline-none border border-zinc-200/0 focus:border-zinc-200"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-1 bg-white border border-zinc-200 rounded-lg text-[10px] font-black text-zinc-400 shadow-sm">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {user && <NotificationCenter userId={user.id} />}
            <div className="h-10 w-px bg-zinc-200 hidden sm:block"></div>
            {location.pathname === '/products' ? (
              <Link 
                to="/products?action=add"
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/10 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Product</span>
              </Link>
            ) : (
              <Link 
                to="/sales"
                className="flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-zinc-900/10 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Transaction</span>
              </Link>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
          <Route 
            path="/*" 
            element={
              user ? (
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

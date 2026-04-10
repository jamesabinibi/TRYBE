import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  BarChart3, 
  Users, 
  Wallet,
  Sparkles,
  Star,
  FileText,
  ChevronDown,
  Smartphone,
  Globe,
  Lock,
  Layout,
  PieChart,
  MessageSquare,
  Clock,
  Edit3,
  Check,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, apiFetch, useQuery } from '../lib/utils';
import { useAuth } from '../App';
import LandingCMS from '../components/LandingCMS';

export default function Landing() {
  const { user } = useAuth() || {};
  const [isEditMode, setIsEditMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: config, isLoading, error, refetch: fetchConfig } = useQuery(
    'landing-config',
    () => apiFetch('/api/landing-config').then(res => res.json()),
    { persist: true }
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (config?.logo?.favicon) {
      const link = document.getElementById('favicon') as HTMLLinkElement;
      const appleLink = document.getElementById('apple-touch-icon') as HTMLLinkElement;
      if (link) link.href = config.logo.favicon;
      if (appleLink) appleLink.href = config.logo.favicon;
    }
  }, [config?.logo?.favicon]);

  const handleSaveConfig = async (newConfig: any) => {
    try {
      let userId = '0';
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const u = JSON.parse(savedUser);
          userId = u?.id?.toString() || '0';
        }
      } catch (e) {}

      const res = await apiFetch('/api/landing-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        fetchConfig();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-medium animate-pulse">Loading your experience...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <Globe className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-bold text-zinc-900 mb-2">Connection Error</h2>
        <p className="text-zinc-600 max-w-md mb-8 leading-relaxed">
          {error instanceof Error ? error.message : String(error || "We couldn't load the application configuration. This usually happens when the backend server is unreachable.")}
        </p>
        <button 
          onClick={() => fetchConfig()}
          className="px-8 py-3 bg-brand text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-brand/10 active:scale-95"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 selection:bg-brand/30 selection:text-brand font-sans overflow-x-hidden" style={{ '--brand-color': config.brandColor || '#11abdf' } as any}>
      {/* CMS Toggle for Admins */}
      {(user?.role === 'super_admin' || 
        user?.email?.toLowerCase() === 'abinibimultimedia@yahoo.com' ||
        user?.email?.toLowerCase() === 'connectabinibi@gmail.com') && (
        <div className="fixed bottom-8 right-8 z-[70]">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-full font-bold shadow-2xl hover:scale-105 transition-all active:scale-95"
          >
            {isEditMode ? <Check className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            {isEditMode ? 'Finish Editing' : 'Edit Landing Page'}
          </button>
        </div>
      )}

      {/* CMS Sidebar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[60]"
          >
            <LandingCMS 
              config={config} 
              onSave={handleSaveConfig} 
              onClose={() => setIsEditMode(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        isScrolled 
          ? "bg-white/95 backdrop-blur-md border-b border-zinc-200/50 shadow-sm py-0" 
          : "bg-transparent border-b border-transparent py-2"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo.url ? (
              <img src={config.logo.url} alt={config.logo.text} className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 flex items-center justify-center vibrant-gradient rounded-2xl shadow-lg shadow-brand/20">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-display font-bold tracking-tight text-zinc-900">{config.logo.text}</span>
              </div>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-10">
            <a href="#features" className="text-sm font-bold text-zinc-600 hover:text-brand transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-bold text-zinc-600 hover:text-brand transition-colors">How it works</a>
            <a href="#ai" className="text-sm font-bold text-zinc-600 hover:text-brand transition-colors">AI Intelligence</a>
            <a href="#faq" className="text-sm font-bold text-zinc-600 hover:text-brand transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/" className="hidden sm:block text-sm font-bold text-zinc-600 hover:text-brand transition-colors">Dashboard</Link>
            ) : (
              <Link to="/login" className="hidden sm:block text-sm font-bold text-zinc-600 hover:text-brand transition-colors">Sign In</Link>
            )}
            <Link 
              to={user ? "/" : "/register"} 
              className="px-8 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-black/10 active:scale-95"
            >
              {user ? 'Go to App' : 'Get Started'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-32 pb-20 overflow-hidden">
        {/* Background Gradients - Atmospheric Recipe 7 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] left-[20%] w-[60%] h-[60%] bg-brand/30 rounded-full blur-[120px] animate-pulse-soft opacity-60" />
          <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[100px] animate-pulse-soft delay-1000 opacity-50" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-zinc-200/50 rounded-full text-xs font-bold text-brand shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span className="uppercase tracking-widest">{config.hero.badge}</span>
              </motion.div>
  
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.8 }}
                className="text-6xl md:text-8xl font-display font-bold tracking-tight leading-[0.95] text-zinc-900"
              >
                {config.hero.title.split('\n').map((line: string, i: number) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </motion.h1>
  
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-xl text-lg md:text-xl text-zinc-500 font-medium leading-relaxed"
              >
                {config.hero.subtitle}
              </motion.p>
  
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4 pt-4"
              >
                <Link 
                  to="/register" 
                  className="w-full sm:w-auto px-10 py-5 bg-zinc-900 text-white rounded-2xl text-lg font-bold hover:bg-zinc-800 transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-3 active:scale-95 group"
                >
                  {config.hero.ctaText}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <div className="flex items-center gap-3">
                  <a 
                    href={config.hero.appStoreUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 bg-white border border-zinc-200/50 rounded-2xl hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                  >
                    <svg viewBox="0 0 384 512" className="w-6 h-6 fill-zinc-900">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>
                  </a>
                  <a 
                    href={config.hero.playStoreUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 bg-white border border-zinc-200/50 rounded-2xl hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                  >
                    <svg viewBox="0 0 512 512" className="w-6 h-6 fill-zinc-900">
                      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                    </svg>
                  </a>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 pt-8 border-t border-zinc-200/50"
              >
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-zinc-100 overflow-hidden">
                      <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="text-sm font-medium text-zinc-500">
                  <span className="text-zinc-900 font-bold">15,000+</span> businesses growing with Gryndee
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
              className="relative lg:block hidden"
            >
              <div className="relative rounded-[3rem] border border-zinc-200/50 bg-white/40 backdrop-blur-2xl p-4 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <img 
                  src={config.hero.image} 
                  alt="Gryndee Dashboard" 
                  className="rounded-[2.5rem] w-full shadow-sm transform group-hover:scale-[1.02] transition-transform duration-1000 ease-out border border-zinc-100"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Floating UI Elements - Technical Recipe 1 */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 p-6 bg-white/90 backdrop-blur-xl rounded-3xl border border-zinc-200/50 shadow-2xl z-10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sales Today</div>
                    <div className="text-xl font-bold text-zinc-900">₦450,000</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-10 -left-10 p-6 bg-white/90 backdrop-blur-xl rounded-3xl border border-zinc-200/50 shadow-2xl z-10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Inventory Status</div>
                    <div className="text-xl font-bold text-zinc-900">Optimal</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Premium Features Showcase - NEW SECTION */}
      <section className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-24 space-y-4">
            <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.4em]">The Pro Advantage</h2>
            <h3 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-zinc-900 leading-[1.05]">Premium tools for <br /> modern businesses.</h3>
            <p className="text-zinc-500 text-lg md:text-xl font-medium leading-relaxed">Unlock the full potential of your business with our most advanced features designed for scale.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {(config.premiumFeatures || []).map((feature: any, index: number) => (
              <motion.div 
                key={feature.id}
                whileHover={{ y: -10 }}
                className="glass-card p-10 space-y-8 group"
              >
                <div className={cn(
                  "w-16 h-16 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500",
                  index === 0 ? "bg-blue-500/10 text-blue-600" : 
                  index === 1 ? "bg-purple-500/10 text-purple-600" : 
                  "bg-amber-500/10 text-amber-600"
                )}>
                  {feature.icon === 'FileText' && <FileText className="w-8 h-8" />}
                  {feature.icon === 'TrendingUp' && <TrendingUp className="w-8 h-8" />}
                  {feature.icon === 'Sparkles' && <Sparkles className="w-8 h-8" />}
                </div>
                <div className="space-y-4">
                  <h4 className="text-3xl font-display font-bold text-zinc-900 tracking-tight">{feature.title}</h4>
                  <p className="text-zinc-500 text-lg font-medium leading-relaxed">{feature.description}</p>
                </div>
                <div className="pt-4 flex items-center gap-2 text-brand font-bold text-sm">
                  <span>Learn more</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 border-y border-zinc-100 bg-zinc-50/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-zinc-500 text-[10px] font-bold mb-8 uppercase tracking-[0.4em]">Trusted by businesses across Africa</p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-60 grayscale hover:opacity-100 transition-opacity duration-500">
            {['Retail', 'Fashion', 'Tech', 'Food', 'Logistics'].map((name) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-5 h-5 bg-zinc-300 rounded-md" />
                <span className="text-base font-display font-bold tracking-tight text-zinc-600">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-24 space-y-4">
            <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.4em]">Core Features</h2>
            <h3 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-zinc-900 leading-[1.05]">Everything you need <br /> to scale your business.</h3>
            <p className="text-zinc-500 text-lg md:text-xl font-medium leading-relaxed">Powerful tools designed for African entrepreneurs to manage sales, inventory, and finances in one place.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Main Feature - POS */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-8 group relative overflow-hidden rounded-[3rem] border border-zinc-200/50 bg-white p-12 shadow-sm hover:shadow-2xl hover:shadow-brand/5 transition-all duration-700"
            >
              <div className="relative z-10 space-y-8 max-w-lg">
                <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-4xl font-display font-bold text-zinc-900 tracking-tight">{config.features[0].title}</h4>
                  <p className="text-zinc-500 text-lg font-medium leading-relaxed">{config.features[0].description}</p>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  {["Digital Receipts", "Offline Mode", "Multi-Payment", "Sales History"].map(item => (
                    <div key={item} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-50 rounded-2xl border border-zinc-100 text-xs font-bold text-zinc-600">
                      <CheckCircle2 className="w-4 h-4 text-brand" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-[55%] translate-y-12 translate-x-12 group-hover:translate-y-6 group-hover:translate-x-6 transition-transform duration-1000 ease-out">
                <img 
                  src={config.features[0].image} 
                  alt="POS" 
                  className="rounded-tl-[3rem] shadow-2xl border-l border-t border-zinc-200/50"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>

            {/* Side Feature 1 - Inventory */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-4 group relative overflow-hidden rounded-[3rem] border border-zinc-200/50 bg-white p-12 shadow-sm hover:shadow-2xl hover:shadow-brand/5 transition-all duration-700"
            >
              <div className="relative z-10 space-y-8">
                <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                  <Package className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-4xl font-display font-bold text-zinc-900 tracking-tight">{config.features[1].title}</h4>
                  <p className="text-zinc-500 text-base font-medium leading-relaxed">{config.features[1].description}</p>
                </div>
              </div>
              <div className="mt-12 transform group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-1000 ease-out">
                <img 
                  src={config.features[1].image} 
                  alt="Inventory" 
                  className="rounded-3xl shadow-xl border border-zinc-100"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>

            {/* Side Feature 2 - Customers */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-4 group relative overflow-hidden rounded-[3rem] border border-zinc-200/50 bg-white p-12 shadow-sm hover:shadow-2xl hover:shadow-brand/5 transition-all duration-700"
            >
              <div className="relative z-10 space-y-8">
                <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                  <Users className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-4xl font-display font-bold text-zinc-900 tracking-tight">{config.features[2].title}</h4>
                  <p className="text-zinc-500 text-base font-medium leading-relaxed">{config.features[2].description}</p>
                </div>
              </div>
              <div className="mt-12 transform group-hover:scale-105 group-hover:rotate-2 transition-transform duration-1000 ease-out">
                <img 
                  src={config.features[2].image} 
                  alt="Customers" 
                  className="rounded-3xl shadow-xl border border-zinc-100"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>

            {/* Main Feature 2 - Bookkeeping */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-8 group relative overflow-hidden rounded-[3rem] border border-zinc-200/50 bg-white p-12 shadow-sm hover:shadow-2xl hover:shadow-brand/5 transition-all duration-700"
            >
              <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center h-full">
                <div className="space-y-8 flex-1">
                  <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center text-brand">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-4xl font-display font-bold text-zinc-900 tracking-tight">Automated Bookkeeping</h4>
                    <p className="text-zinc-500 text-lg font-medium leading-relaxed">Let Gryndee handle the numbers. Automated tracking of income, expenses, and taxes so you can focus on growth.</p>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="px-6 py-3 bg-zinc-50 rounded-2xl border border-zinc-100 text-xs font-bold text-zinc-600">Tax Reports</div>
                    <div className="px-6 py-3 bg-zinc-50 rounded-2xl border border-zinc-100 text-xs font-bold text-zinc-600">Profit Tracking</div>
                  </div>
                </div>
                <div className="flex-1 transform group-hover:translate-x-4 group-hover:-translate-y-2 transition-transform duration-1000 ease-out">
                  <img 
                    src="https://picsum.photos/seed/analytics/1000/800" 
                    alt="Analytics" 
                    className="rounded-3xl shadow-xl border border-zinc-100"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-24 space-y-4">
            <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.4em]">The Process</h2>
            <h3 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-zinc-900 leading-[1.05]">{config.howItWorks.title}</h3>
            <p className="text-zinc-500 text-lg md:text-xl font-medium leading-relaxed">{config.howItWorks.subtitle}</p>
          </div>
 
          <div className="grid md:grid-cols-3 gap-12">
            {config.howItWorks.steps.map((step: any, index: number) => (
              <StepCard 
                key={step.id}
                number={`0${index + 1}`}
                title={step.title}
                description={step.description}
                icon={index === 0 ? Users : index === 1 ? Package : TrendingUp}
              />
            ))}
          </div>
        </div>
      </section>

      {/* AI Intelligence Section */}
      <section id="ai" className="py-32 relative overflow-hidden bg-zinc-900 rounded-[4rem] mx-6 mb-32">
        <div className="absolute inset-0 bg-brand/5 -z-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand/30 to-transparent opacity-40 -z-10" />
        
        <div className="max-w-7xl mx-auto px-10 grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 border border-white/10 rounded-full text-xs font-bold text-brand backdrop-blur-md shadow-sm"
            >
              <Brain className="w-4 h-4" />
              <span className="uppercase tracking-widest">AI Intelligence</span>
            </motion.div>
            <h2 className="text-6xl md:text-8xl font-display font-bold tracking-tight leading-[0.9] text-white">
              The Brain <br /> Behind Your <br /> Business.
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl font-medium leading-relaxed max-w-xl">
              Gryndee isn't just a ledger; it's an intelligent partner. 
              Our AI Advisor analyzes your data to predict stockouts, suggest pricing, and generate professional branding in seconds.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-8 pt-4">
              <div className="p-10 bg-white/5 rounded-[3rem] backdrop-blur-md border border-white/10 group hover:bg-white/10 transition-all duration-700">
                <div className="w-16 h-16 rounded-3xl bg-brand/20 flex items-center justify-center text-brand mb-8 group-hover:scale-110 transition-transform shadow-sm">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h4 className="text-2xl font-display font-bold text-white mb-4 tracking-tight">AI Logo Generator</h4>
                <p className="text-zinc-500 text-base font-medium leading-relaxed">Create your brand identity instantly with AI-powered logo generation tailored to your niche.</p>
              </div>
              <div className="p-10 bg-white/5 rounded-[3rem] backdrop-blur-md border border-white/10 group hover:bg-white/10 transition-all duration-700">
                <div className="w-16 h-16 rounded-3xl vibrant-gradient-purple flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-xl shadow-purple-500/20">
                  <Brain className="w-8 h-8" />
                </div>
                <h4 className="text-2xl font-display font-bold text-white mb-4 tracking-tight">AI Business Advisor</h4>
                <p className="text-zinc-500 text-base font-medium leading-relaxed">Get strategic advice on inventory, sales growth, and market trends from Gemini AI.</p>
              </div>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute -inset-20 bg-brand/40 blur-[150px] rounded-full -z-10 animate-pulse-soft" />
            <div className="rounded-[4rem] bg-white/5 p-4 backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <img 
                src="https://picsum.photos/seed/ai-advisor/1000/1200" 
                alt="AI Advisor Interface" 
                className="rounded-[3.5rem] w-full shadow-2xl transform group-hover:scale-[1.02] transition-transform duration-1000 ease-out"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Floating Elements */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-12 -right-12 p-10 bg-white/10 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 shadow-2xl"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl vibrant-gradient flex items-center justify-center text-white shadow-lg shadow-brand/20">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Revenue Forecast</div>
                  <div className="text-3xl font-bold text-white">+24.5%</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8">
            <div className="space-y-4">
              <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.4em]">Testimonials</h2>
              <h3 className="text-6xl md:text-8xl font-display font-bold tracking-tight text-zinc-900 leading-[0.9]">Trusted by <br /> <span className="text-brand">Visionaries.</span></h3>
            </div>
            <p className="text-zinc-500 text-lg md:text-xl font-medium max-w-md">Join 15,000+ business owners simplifying their operations and scaling their dreams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {config.testimonials.map((testimonial: any) => (
              <TestimonialCard 
                key={testimonial.id}
                quote={testimonial.content}
                author={testimonial.name}
                role={testimonial.role}
                image={testimonial.image || `https://picsum.photos/seed/${testimonial.name}/100/100`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 relative">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.4em]">FAQ</h2>
            <h3 className="text-4xl md:text-5xl font-display font-semibold text-zinc-900 mb-4 tracking-tight">Common <span className="text-brand">Questions.</span></h3>
            <p className="text-zinc-500 text-lg font-medium">Everything you need to know about Gryndee.</p>
          </div>
          <div className="space-y-2">
            {(config.faq || []).map((item: any) => (
              <FAQItem key={item.id} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] animate-pulse-soft" />
        </div>
        
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-zinc-900 rounded-[4rem] p-16 md:p-24 text-center space-y-10 relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand/20 to-transparent opacity-50 -z-10" />
            <div className="space-y-4">
              <h2 className="text-5xl md:text-8xl font-display font-bold tracking-tight leading-[0.95] text-white">
                Start Your <br /> <span className="text-brand">Grynd</span> Today.
              </h2>
              <p className="text-zinc-400 font-medium text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Join thousands of business owners who have digitized their operations and focused on building their empire.
              </p>
            </div>
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link 
                to="/register" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-12 py-6 bg-brand text-white rounded-[2rem] text-xl font-bold hover:opacity-90 transition-all shadow-2xl shadow-brand/20 group active:scale-95"
              >
                Get Started Free
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/login" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-12 py-6 bg-white/10 text-white border border-white/10 rounded-[2rem] text-xl font-bold hover:bg-white/20 transition-all backdrop-blur-md active:scale-95"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-zinc-200/50 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <div className="flex items-center gap-2">
                {config.logo.url ? (
                  <img src={config.logo.url} alt={config.logo.text} className="h-8 w-auto object-contain" />
                ) : (
                  <>
                    <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                      {config.logo.favicon ? (
                        <img src={config.logo.favicon} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Zap className="w-5 h-5 text-brand" />
                      )}
                    </div>
                    <span className="text-xl font-display font-semibold tracking-tight text-zinc-900">{config.logo.text}</span>
                  </>
                )}
              </div>
              <p className="text-zinc-500 text-sm font-medium max-w-sm leading-relaxed">
                {config.footer.description}
              </p>
              <div className="flex items-center gap-5">
                {(config.footer.socials || []).map((social: any) => (
                  <a key={social.name} href={social.url} className="text-zinc-400 hover:text-brand transition-colors text-[10px] font-bold uppercase tracking-widest">{social.name}</a>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <a 
                  href={config.hero.appStoreUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all border border-zinc-800 scale-90 origin-left"
                >
                  <svg viewBox="0 0 384 512" className="w-4 h-4 fill-current">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[6px] uppercase font-bold opacity-60 leading-none">Download on the</div>
                    <div className="text-[10px] font-bold leading-none">App Store</div>
                  </div>
                </a>
                <a 
                  href={config.hero.playStoreUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all border border-zinc-800 scale-90 origin-left"
                >
                  <svg viewBox="0 0 512 512" className="w-4 h-4 fill-current">
                    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[6px] uppercase font-bold opacity-60 leading-none">Get it on</div>
                    <div className="text-[10px] font-bold leading-none">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
            <div className="space-y-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">How it works</a></li>
                <li><a href="#ai" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">AI Advisor</a></li>
                <li><Link to="/login" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div className="space-y-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/p/about" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">About Us</Link></li>
                <li><Link to="/p/privacy" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">Privacy Policy</Link></li>
                <li><Link to="/p/terms" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">Terms of Service</Link></li>
                <li><Link to="/p/contact" className="text-zinc-500 hover:text-brand text-sm font-medium transition-colors">Contact Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-zinc-200/50">
            <p className="text-zinc-500 text-sm font-medium">{config.footer.copyright}</p>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-500">Lagos, Nigeria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                <span className="text-sm font-medium text-zinc-500">System Operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, description, icon: Icon }: any) {
  return (
    <div className="relative p-8 rounded-[2.5rem] bg-white border border-zinc-200/50 group hover:border-brand/30 transition-all shadow-sm hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1 duration-500">
      <div className="absolute top-8 right-8 text-6xl font-display font-bold text-zinc-900/5 group-hover:text-brand/10 transition-colors">
        {number}
      </div>
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center text-brand mb-6 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-2xl font-display font-semibold text-zinc-900 mb-3 tracking-tight">{title}</h4>
      <p className="text-zinc-500 text-base leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role, image }: { quote: string; author: string; role: string; image: string }) {
  return (
    <div className="p-8 rounded-[2.5rem] bg-white border border-zinc-200/50 space-y-6 hover:shadow-xl hover:shadow-brand/5 transition-all duration-500 group">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-brand fill-brand" />)}
      </div>
      <p className="text-zinc-600 text-lg font-medium leading-relaxed italic">"{quote}"</p>
      <div className="flex items-center gap-4 pt-2">
        <div className="w-12 h-12 rounded-full bg-zinc-100 overflow-hidden ring-2 ring-white shadow-sm group-hover:scale-105 transition-transform duration-500">
          <img src={image} alt={author} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-base font-semibold text-zinc-900">{author}</div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{role}</div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-zinc-200/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-semibold text-zinc-800 group-hover:text-brand transition-colors tracking-tight">{question}</span>
        <div className={cn(
          "w-8 h-8 rounded-xl border border-zinc-200/50 flex items-center justify-center transition-all duration-500",
          isOpen ? "bg-brand border-brand text-white shadow-sm" : "text-zinc-500 group-hover:border-brand/30"
        )}>
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-500", isOpen && "rotate-180")} />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-zinc-500 text-base leading-relaxed font-medium">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

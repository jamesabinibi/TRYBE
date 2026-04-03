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
import { cn, apiFetch } from '../lib/utils';
import { useAuth } from '../App';
import LandingCMS from '../components/LandingCMS';

export default function Landing() {
  const { user } = useAuth() || {};
  const [isEditMode, setIsEditMode] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config?.logo?.favicon) {
      const link = document.getElementById('favicon') as HTMLLinkElement;
      const appleLink = document.getElementById('apple-touch-icon') as HTMLLinkElement;
      if (link) link.href = config.logo.favicon;
      if (appleLink) appleLink.href = config.logo.favicon;
    }
  }, [config?.logo?.favicon]);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch('/api/landing-config');
      if (!res.ok) throw new Error('Failed to fetch landing configuration');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch landing config:', err);
      setError('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (newConfig: any) => {
    try {
      const res = await apiFetch('/api/landing-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || '0'
        },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(newConfig);
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
          {error || "We couldn't load the application configuration. This usually happens when the backend server is unreachable."}
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
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-brand/30 selection:text-brand font-sans overflow-x-hidden" style={{ '--brand-color': config.brandColor || '#ff4d00' } as any}>
      {/* CMS Toggle for Admins */}
      {(user?.role === 'super_admin' || 
        user?.email?.toLowerCase() === 'abinibimultimedia@yahoo.com') && (
        <div className="fixed bottom-8 right-8 z-[70]">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-full font-bold shadow-2xl shadow-brand/40 hover:scale-105 transition-all active:scale-95"
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
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo.url ? (
              <img src={config.logo.url} alt={config.logo.text} className="h-8 w-auto object-contain" />
            ) : (
              <>
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-md shadow-brand/10">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-display font-bold tracking-tight text-zinc-900">{config.logo.text}</span>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-xs font-medium text-zinc-600 hover:text-brand transition-colors">Features</a>
            <a href="#how-it-works" className="text-xs font-medium text-zinc-600 hover:text-brand transition-colors">How it works</a>
            <a href="#ai" className="text-xs font-medium text-zinc-600 hover:text-brand transition-colors">AI Intelligence</a>
            <a href="#faq" className="text-xs font-medium text-zinc-600 hover:text-brand transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/" className="hidden sm:block text-xs font-medium text-zinc-600 hover:text-brand transition-colors">Dashboard</Link>
            ) : (
              <Link to="/login" className="hidden sm:block text-xs font-medium text-zinc-600 hover:text-brand transition-colors">Sign In</Link>
            )}
            <Link 
              to={user ? "/" : "/register"} 
              className="px-5 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-brand/10 active:scale-95"
            >
              {user ? 'Go to App' : 'Get Started'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand/30 rounded-full blur-[120px] animate-pulse opacity-60" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse delay-1000 opacity-40" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 text-center lg:text-left">
            {config.logo.url && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center lg:justify-start"
              >
                <img src={config.logo.url} alt={config.logo.text} className="h-12 w-auto object-contain" />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-full text-xs font-semibold text-brand backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{config.hero.badge}</span>
            </motion.div>
 
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.15] text-zinc-900"
            >
              {config.hero.title.split('\n').map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </motion.h1>
 
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-xl mx-auto lg:mx-0 text-base md:text-lg text-zinc-700 font-medium leading-relaxed"
            >
              {config.hero.subtitle}
            </motion.p>
 
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-8 pt-4"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link 
                  to="/register" 
                  className="w-full sm:w-auto px-8 py-4 bg-brand text-white rounded-xl text-base font-bold hover:opacity-90 transition-all shadow-lg shadow-brand/10 flex items-center justify-center gap-2 active:scale-95"
                >
                  {config.hero.ctaText}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <a 
                    href={config.hero.appStoreUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none flex items-center gap-2.5 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-95 border border-white/10"
                  >
                    <svg viewBox="0 0 384 512" className="w-5 h-5 fill-current">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[8px] uppercase font-bold opacity-60 leading-none">Download on the</div>
                      <div className="text-[12px] font-bold leading-none">App Store</div>
                    </div>
                  </a>
                  <a 
                    href={config.hero.playStoreUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none flex items-center gap-2.5 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-95 border border-white/10"
                  >
                    <svg viewBox="0 0 512 512" className="w-5 h-5 fill-current">
                      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[8px] uppercase font-bold opacity-60 leading-none">Get it on</div>
                      <div className="text-[12px] font-bold leading-none">Google Play</div>
                    </div>
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-4">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-zinc-100 overflow-hidden ring-1 ring-zinc-200 shadow-sm">
                      <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-zinc-900">15,000+ Business Owners</div>
                  <div className="text-xs text-zinc-600 font-medium">Trust Gryndee daily</div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-brand/20 blur-[120px] -z-10" />
            <div className="relative rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src={config.hero.image} 
                alt="Gryndee Dashboard" 
                className="rounded-xl w-full shadow-sm transform group-hover:scale-[1.005] transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
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

      {/* Feature Highlights - Alternating Sections */}
      <section id="features" className="py-24 space-y-24">
        {config.features.map((feature: any, index: number) => (
          <div key={feature.id} className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
            <div className={cn("space-y-5", index % 2 === 0 ? "order-2 lg:order-1" : "order-2")}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", 
                index === 0 ? "bg-brand/10 text-brand" : 
                index === 1 ? "bg-blue-500/10 text-blue-600" : 
                "bg-purple-500/10 text-purple-600")}>
                {index === 0 ? <ShoppingCart className="w-5 h-5" /> : 
                 index === 1 ? <Package className="w-5 h-5" /> : 
                 <Users className="w-5 h-5" />}
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-zinc-900 leading-tight">
                {feature.title}
              </h2>
              <p className="text-zinc-700 text-sm leading-relaxed">
                {feature.description}
              </p>
              <ul className="space-y-3 pt-2">
                {(index === 0 ? [
                  "Instant digital receipts via WhatsApp",
                  "Multiple payment method support",
                  "Real-time sales tracking & history",
                  "Offline mode with auto-sync"
                ] : index === 1 ? [
                  "Low stock alerts & notifications",
                  "Product variant management",
                  "Bulk inventory updates",
                  "Multi-location stock tracking"
                ] : [
                  "Customer & Supplier ledgers",
                  "Automated debt reminders",
                  "Transaction history per party",
                  "Credit limit management"
                ]).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-zinc-600">
                    <CheckCircle2 className={cn("w-4 h-4", 
                      index === 0 ? "text-brand" : 
                      index === 1 ? "text-blue-600" : 
                      "text-purple-600")} />
                    <span className="text-sm font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn("relative", index % 2 === 0 ? "order-1 lg:order-2" : "order-1")}>
              <div className={cn("absolute inset-0 blur-[60px] -z-10", 
                index === 0 ? "bg-brand/10" : 
                index === 1 ? "bg-blue-500/10" : 
                "bg-purple-500/10")} />
              <img 
                src={feature.image} 
                alt={feature.title} 
                className="rounded-2xl border border-zinc-100 shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ))}
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-[10px] font-bold text-brand uppercase tracking-[0.3em]">How it works</h2>
            <h3 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-zinc-900">{config.howItWorks.title}</h3>
            <p className="text-zinc-700 text-sm font-medium">{config.howItWorks.subtitle}</p>
          </div>
 
          <div className="grid md:grid-cols-3 gap-8">
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
      <section id="ai" className="py-24 relative overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 bg-brand/5 -z-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent opacity-30 -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-brand backdrop-blur-md">
              <Brain className="w-3.5 h-3.5" />
              AI Intelligence
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight leading-[1.15] text-white">
              The Brain <br /> Behind Your <br /> Business.
            </h2>
            <p className="text-zinc-400 text-base font-medium leading-relaxed">
              Gryndee isn't just a ledger; it's an intelligent partner. 
              Our AI Advisor analyzes your data to predict stockouts, suggest pricing, and generate professional branding in seconds.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 bg-white/5 rounded-2xl backdrop-blur-xl border border-white/10 group hover:bg-white/10 transition-all">
                <Sparkles className="w-5 h-5 text-brand mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-bold text-white mb-1.5">AI Logo Generator</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">Create your brand identity instantly with AI-powered logo generation tailored to your niche.</p>
              </div>
              <div className="p-5 bg-white/5 rounded-2xl backdrop-blur-xl border border-white/10 group hover:bg-white/10 transition-all">
                <Brain className="w-5 h-5 text-brand mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-bold text-white mb-1.5">AI Business Advisor</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">Get strategic advice on inventory, sales growth, and market trends from Gemini AI.</p>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 bg-white/5 blur-3xl rounded-full -z-10" />
            <div className="rounded-2xl bg-white/5 p-2 backdrop-blur-2xl border border-white/10 shadow-2xl transform rotate-1 hover:rotate-0 transition-transform duration-700">
              <img 
                src="https://picsum.photos/seed/ai-advisor/800/1000" 
                alt="AI Advisor Interface" 
                className="rounded-xl w-full shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-zinc-900">Trusted by <span className="text-brand">Visionaries.</span></h2>
            <p className="text-zinc-600 text-sm font-medium">Join 15,000+ business owners simplifying their operations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
      <section id="faq" className="py-24 bg-zinc-50 border-y border-zinc-100 relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-4xl font-display font-bold text-zinc-900 mb-4">Common <span className="text-brand">Questions.</span></h2>
            <p className="text-zinc-600 text-base font-medium">Everything you need to know about Gryndee.</p>
          </div>
          <div className="space-y-4">
            {(config.faq || []).map((item: any) => (
              <FAQItem key={item.id} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-zinc-900 rounded-2xl p-8 md:p-12 text-center space-y-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-full bg-brand/5 opacity-50 -z-10" />
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight leading-tight text-white">
              Start Your <br /> <span className="text-brand">Grynd</span> Today.
            </h2>
            <p className="text-zinc-400 font-medium text-base max-w-xl mx-auto">
              Join thousands of business owners who have digitized their operations and focused on building their empire.
            </p>
            <div className="pt-2">
              <Link 
                to="/register" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-brand text-white rounded-xl text-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-brand/20 group active:scale-95"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center overflow-hidden">
                  {config.logo.url ? (
                    <img src={config.logo.url} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Zap className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="text-xl font-display font-bold tracking-tight text-zinc-900">{config.logo.text}</span>
              </div>
              <p className="text-zinc-700 text-sm font-medium max-w-sm leading-relaxed">
                {config.footer.description}
              </p>
              <div className="flex items-center gap-5">
                {(config.footer.socials || []).map((social: any) => (
                  <a key={social.name} href={social.url} className="text-zinc-500 hover:text-brand transition-colors text-[10px] font-bold uppercase tracking-widest">{social.name}</a>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <a 
                  href={config.hero.appStoreUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all border border-white/10 scale-90 origin-left"
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
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all border border-white/10 scale-90 origin-left"
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
                <li><a href="#features" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">How it works</a></li>
                <li><a href="#ai" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">AI Advisor</a></li>
                <li><Link to="/login" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div className="space-y-5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/p/about" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">About Us</Link></li>
                <li><Link to="/p/privacy" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">Privacy Policy</Link></li>
                <li><Link to="/p/terms" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">Terms of Service</Link></li>
                <li><Link to="/p/contact" className="text-zinc-600 hover:text-brand text-xs font-medium transition-colors">Contact Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-zinc-200">
            <p className="text-zinc-600 text-sm font-medium">{config.footer.copyright}</p>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-medium text-zinc-600">Lagos, Nigeria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                <span className="text-sm font-medium text-zinc-600">System Operational</span>
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
    <div className="relative p-8 rounded-3xl bg-white border border-zinc-100 group hover:border-brand/20 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 duration-300">
      <div className="absolute top-6 right-8 text-5xl font-display font-bold text-zinc-900/10 group-hover:text-brand/15 transition-colors">
        {number}
      </div>
      <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-xl font-display font-bold text-zinc-900 mb-3">{title}</h4>
      <p className="text-zinc-600 text-sm leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role, image }: { quote: string; author: string; role: string; image: string }) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-5 hover:bg-zinc-100/30 transition-colors">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 text-brand fill-brand" />)}
      </div>
      <p className="text-zinc-700 text-sm font-medium leading-relaxed">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden ring-1 ring-zinc-100">
          <img src={image} alt={author} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-900">{author}</div>
          <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">{role}</div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-zinc-100">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-base font-bold text-zinc-700 group-hover:text-brand transition-colors">{question}</span>
        <div className={cn(
          "w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center transition-all",
          isOpen ? "bg-brand border-brand text-white" : "text-zinc-600 group-hover:border-brand/20"
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
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-zinc-700 text-sm leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

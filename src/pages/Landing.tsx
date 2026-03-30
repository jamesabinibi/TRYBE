import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-brand/30 selection:text-brand font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-display font-extrabold tracking-tight">Gryndee</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">How it works</a>
            <a href="#ai" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">AI Intelligence</a>
            <a href="#faq" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden sm:block text-sm font-medium text-zinc-400 hover:text-white transition-colors">Sign In</Link>
            <Link 
              to="/register" 
              className="px-6 py-2.5 bg-brand text-white rounded-full text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-brand/20 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand/20 rounded-full blur-[120px] animate-pulse opacity-50" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-1000 opacity-30" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full text-xs font-semibold text-brand backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Empowering African MSMEs</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-7xl xl:text-8xl font-display font-extrabold tracking-tight leading-[0.9] text-white"
            >
              The Smartest Way <br />
              To Run Your <br />
              <span className="text-brand">Business.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-xl mx-auto lg:mx-0 text-lg md:text-xl text-zinc-400 font-medium leading-relaxed"
            >
              Gryndee simplifies your operations, automates your bookkeeping, 
              and provides AI-powered insights to help your business thrive.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 pt-4"
            >
              <Link 
                to="/register" 
                className="w-full sm:w-auto px-10 py-5 bg-brand text-white rounded-2xl text-lg font-bold hover:opacity-90 transition-all shadow-2xl shadow-brand/30 flex items-center justify-center gap-3 active:scale-95"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#050505] bg-zinc-800 overflow-hidden ring-1 ring-white/10">
                      <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">15,000+ Business Owners</div>
                  <div className="text-xs text-zinc-500 font-medium">Trust Gryndee daily</div>
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
            <div className="relative rounded-[2.5rem] border border-white/[0.1] bg-white/[0.02] p-3 shadow-2xl backdrop-blur-sm overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src="https://picsum.photos/seed/gryndee-dashboard/1200/1400" 
                alt="Gryndee Dashboard" 
                className="rounded-[2rem] w-full shadow-2xl transform group-hover:scale-[1.02] transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              
              {/* Floating Elements */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-12 -left-8 p-5 bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 space-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center text-brand">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Daily Sales</div>
                    <div className="text-sm font-bold text-white">₦245,000.00</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-12 -right-8 p-5 bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 space-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inventory Status</div>
                    <div className="text-sm font-bold text-white">All items in stock</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-20 border-y border-white/[0.04] bg-zinc-950/20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-zinc-500 text-sm font-medium mb-12 uppercase tracking-[0.2em]">Trusted by businesses across Africa</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {['Retail', 'Fashion', 'Tech', 'Food', 'Logistics'].map((name) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
                <span className="text-xl font-display font-bold tracking-tight text-zinc-400">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlights - Alternating Sections */}
      <section id="features" className="py-32 space-y-32">
        {/* Feature 1 */}
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white leading-tight">
              Effortless Sales <br /> & <span className="text-brand">POS Management.</span>
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Record sales in seconds, whether you're online or offline. 
              Our intuitive POS interface is designed for speed, helping you serve customers faster and never miss a transaction.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Instant digital receipts via WhatsApp",
                "Multiple payment method support",
                "Real-time sales tracking & history",
                "Offline mode with auto-sync"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-zinc-300">
                  <CheckCircle2 className="w-5 h-5 text-brand" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="absolute inset-0 bg-brand/10 blur-[80px] -z-10" />
            <img 
              src="https://picsum.photos/seed/gryndee-sales/1000/800" 
              alt="Sales Management" 
              className="rounded-[2.5rem] border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Feature 2 */}
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/10 blur-[80px] -z-10" />
            <img 
              src="https://picsum.photos/seed/gryndee-inventory/1000/800" 
              alt="Inventory Management" 
              className="rounded-[2.5rem] border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
              <Package className="w-6 h-6" />
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white leading-tight">
              Master Your <br /> <span className="text-blue-400">Inventory Control.</span>
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Stop losing money to stockouts or overstocking. 
              Gryndee gives you a bird's-eye view of your products, variants, and stock levels across all locations.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Low stock alerts & notifications",
                "Product variant management",
                "Bulk inventory updates",
                "Multi-location stock tracking"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-zinc-300">
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature 3 */}
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-white leading-tight">
              Keep Your <br /> <span className="text-purple-400">Parties Organized.</span>
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Manage relationships with customers and suppliers effortlessly. 
              Track debts, credits, and transaction histories in one centralized ledger.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Customer & Supplier ledgers",
                "Automated debt reminders",
                "Transaction history per party",
                "Credit limit management"
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-zinc-300">
                  <CheckCircle2 className="w-5 h-5 text-purple-400" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="absolute inset-0 bg-purple-500/10 blur-[80px] -z-10" />
            <img 
              src="https://picsum.photos/seed/gryndee-parties/1000/800" 
              alt="Party Management" 
              className="rounded-[2.5rem] border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-zinc-950/30 border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-xs font-bold text-brand uppercase tracking-[0.3em]">How it works</h2>
            <h3 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight text-white">Three Steps to <span className="text-brand">Success.</span></h3>
            <p className="text-zinc-500 text-lg font-medium">Getting your business on Gryndee is faster than your morning coffee.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <StepCard 
              number="01"
              title="Create Account"
              description="Sign up in seconds and set up your business profile with basic details."
              icon={Users}
            />
            <StepCard 
              number="02"
              title="Add Products"
              description="Upload your inventory or import products via CSV to get started instantly."
              icon={Package}
            />
            <StepCard 
              number="03"
              title="Start Selling"
              description="Record your first sale and watch your business insights come to life."
              icon={TrendingUp}
            />
          </div>
        </div>
      </section>

      {/* AI Intelligence Section */}
      <section id="ai" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand -z-20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50 -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-bold text-white backdrop-blur-md">
              <Brain className="w-4 h-4" />
              AI Intelligence
            </div>
            <h2 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-[0.9] text-white">
              The Brain <br /> Behind Your <br /> Business.
            </h2>
            <p className="text-white/80 text-xl font-medium leading-relaxed">
              Gryndee isn't just a ledger; it's an intelligent partner. 
              Our AI Advisor analyzes your data to predict stockouts, suggest pricing, and generate professional branding in seconds.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6 pt-4">
              <div className="p-8 bg-white/10 rounded-[2.5rem] backdrop-blur-xl border border-white/10 group hover:bg-white/20 transition-all">
                <Sparkles className="w-8 h-8 text-white mb-6 group-hover:scale-110 transition-transform" />
                <h4 className="text-lg font-bold text-white mb-3">AI Logo Generator</h4>
                <p className="text-sm text-white/70 leading-relaxed">Create your brand identity instantly with AI-powered logo generation tailored to your niche.</p>
              </div>
              <div className="p-8 bg-white/10 rounded-[2.5rem] backdrop-blur-xl border border-white/10 group hover:bg-white/20 transition-all">
                <Brain className="w-8 h-8 text-white mb-6 group-hover:scale-110 transition-transform" />
                <h4 className="text-lg font-bold text-white mb-3">AI Business Advisor</h4>
                <p className="text-sm text-white/70 leading-relaxed">Get strategic advice on inventory, sales growth, and market trends from Gemini AI.</p>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 bg-white/10 blur-3xl rounded-full -z-10" />
            <div className="rounded-[3rem] bg-white/10 p-4 backdrop-blur-2xl border border-white/20 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-700">
              <img 
                src="https://picsum.photos/seed/ai-advisor/800/1000" 
                alt="AI Advisor Interface" 
                className="rounded-[2rem] w-full shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight text-white">Trusted by <span className="text-brand">Visionaries.</span></h2>
            <p className="text-zinc-500 text-lg font-medium">Join 15,000+ business owners simplifying their operations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="The best business app with a truly user-friendly design. It changed how I track my sales and inventory completely."
              author="Kabiru Fatai"
              role="Retail Store Owner"
              image="https://picsum.photos/seed/kabiru/100/100"
            />
            <TestimonialCard 
              quote="I love it! Easy to navigate and very useful for my inventory management. The AI advisor is a game changer."
              author="Law Jove"
              role="Wholesaler"
              image="https://picsum.photos/seed/law/100/100"
            />
            <TestimonialCard 
              quote="I highly recommend Gryndee for all business owners. It's packed with impressive features that make growth easy."
              author="Esther Godwin"
              role="Fashion Designer"
              image="https://picsum.photos/seed/esther/100/100"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 bg-zinc-950/30 border-y border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-display font-extrabold tracking-tight text-white">Common <span className="text-brand">Questions.</span></h2>
            <p className="text-zinc-500 font-medium">Everything you need to know about Gryndee.</p>
          </div>
          <div className="space-y-2">
            <FAQItem 
              question="What is Gryndee?"
              answer="Gryndee is an all-in-one business management platform designed for African MSMEs. It helps you track sales, manage inventory, handle bookkeeping, and grow with AI-powered insights."
            />
            <FAQItem 
              question="Is my data safe with Gryndee?"
              answer="Yes, security is our top priority. We use industry-standard encryption to protect your data and provide regular backups. You can also enable app-level locks for additional privacy."
            />
            <FAQItem 
              question="Can I use Gryndee offline?"
              answer="Gryndee requires an internet connection to sync your data across devices and provide real-time AI insights, but we've optimized it to work smoothly even on slower connections."
            />
            <FAQItem 
              question="Is it suitable for new businesses?"
              answer="Absolutely! Gryndee is built to scale with you. Whether you're just starting out or managing a large enterprise, our tools are designed to be intuitive and powerful."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[160px]" />
        </div>
        
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-zinc-900/50 backdrop-blur-xl rounded-[4rem] p-12 md:p-24 text-center space-y-10 relative overflow-hidden border border-white/[0.08] shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full bg-brand/5 opacity-50 -z-10" />
            <h2 className="text-5xl md:text-8xl font-display font-extrabold tracking-tight leading-none text-white">
              Start Your <br /> <span className="text-brand">Grynd</span> Today.
            </h2>
            <p className="text-zinc-400 font-medium text-xl max-w-2xl mx-auto">
              Join thousands of business owners who have digitized their operations and focused on building their empire.
            </p>
            <div className="pt-6">
              <Link 
                to="/register" 
                className="inline-flex items-center gap-4 px-12 py-6 bg-brand text-white rounded-3xl text-2xl font-bold hover:opacity-90 transition-all shadow-2xl shadow-brand/40 group active:scale-95"
              >
                Get Started Free
                <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-1 md:col-span-2 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-display font-extrabold tracking-tight">Gryndee</span>
              </div>
              <p className="text-zinc-500 text-lg font-medium max-w-sm leading-relaxed">
                The intelligent business management app for African MSMEs. Simple, smart, and stress-free.
              </p>
              <div className="flex items-center gap-6">
                {['Twitter', 'Instagram', 'LinkedIn', 'Facebook'].map(social => (
                  <a key={social} href="#" className="text-zinc-600 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">{social}</a>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Product</h4>
              <ul className="space-y-4">
                <li><a href="#features" className="text-zinc-500 hover:text-white font-medium transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-zinc-500 hover:text-white font-medium transition-colors">How it works</a></li>
                <li><a href="#ai" className="text-zinc-500 hover:text-white font-medium transition-colors">AI Advisor</a></li>
                <li><Link to="/login" className="text-zinc-500 hover:text-white font-medium transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-zinc-500 hover:text-white font-medium transition-colors">About Us</a></li>
                <li><a href="#" className="text-zinc-500 hover:text-white font-medium transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-zinc-500 hover:text-white font-medium transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-zinc-500 hover:text-white font-medium transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-white/[0.04]">
            <p className="text-zinc-600 text-sm font-medium">© 2026 Gryndee. All rights reserved.</p>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-medium text-zinc-600">Lagos, Nigeria</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
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
    <div className="relative p-10 rounded-[3rem] bg-white/[0.02] border border-white/[0.08] group hover:border-brand/30 transition-all">
      <div className="absolute top-8 right-8 text-6xl font-display font-black text-white/[0.03] group-hover:text-brand/10 transition-colors">
        {number}
      </div>
      <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center text-brand mb-8 group-hover:scale-110 transition-transform">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-2xl font-display font-bold text-white mb-4">{title}</h4>
      <p className="text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role, image }: { quote: string; author: string; role: string; image: string }) {
  return (
    <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/[0.08] space-y-8 hover:bg-white/[0.04] transition-colors">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-brand fill-brand" />)}
      </div>
      <p className="text-zinc-300 text-lg font-medium leading-relaxed">"{quote}"</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden ring-2 ring-white/10">
          <img src={image} alt={author} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">{author}</div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{role}</div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-white/[0.04]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-8 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">{question}</span>
        <div className={cn(
          "w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all",
          isOpen ? "bg-brand border-brand text-white" : "text-zinc-500 group-hover:border-white/20"
        )}>
          <ChevronDown className={cn("w-5 h-5 transition-transform duration-500", isOpen && "rotate-180")} />
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
            <p className="pb-8 text-zinc-500 text-lg leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

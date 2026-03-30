import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Briefcase, TrendingDown, LayoutDashboard, Lock, X } from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import CashFlowRunway from './CashFlowRunway';
import Bookkeeping from './Bookkeeping';
import Expenses from './Expenses';

export default function Finance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPro = user?.subscription_plan === 'professional' || user?.subscription_plan === 'trial';
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') as 'cashflow' | 'bookkeeping' | 'expenses' || 'cashflow';
  const [activeTab, setActiveTab] = useState<'cashflow' | 'bookkeeping' | 'expenses'>(tab);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  const handleTabChange = (newTab: 'cashflow' | 'bookkeeping' | 'expenses') => {
    setSearchParams({ tab: newTab });
    setActiveTab(newTab);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 relative">
      {!isPro && showOverlay && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-[2.5rem]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full text-center space-y-6 sticky top-20 relative"
          >
            <button 
              onClick={() => navigate('/')}
              className="absolute top-6 right-6 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-brand/10 rounded-[2rem] flex items-center justify-center mx-auto">
              <Wallet className="w-10 h-10 text-brand" />
            </div>
            <div className="space-y-2">
              <h2 className="h2 uppercase">Pro Feature</h2>
              <p className="body-text">
                Advanced Finance Hub is exclusive to our Pro plan. Upgrade now to manage your cash flow and bookkeeping with ease.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <Link 
                to="/settings" 
                className="btn-primary w-full py-4 text-xs uppercase tracking-widest"
              >
                Upgrade to Pro
              </Link>
              <p className="label-text">
                Or use a referral code to get 14 days free
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="h1 flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-brand" />
            Finance Hub
          </h1>
          <p className="body-text">
            Manage your cash flow, bookkeeping, and expenses all in one place.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit">
        <button
          onClick={() => handleTabChange('cashflow')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'cashflow'
              ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cash Flow
        </button>
        <button
          onClick={() => handleTabChange('bookkeeping')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'bookkeeping'
              ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Bookkeeping
        </button>
        <button
          onClick={() => handleTabChange('expenses')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Expenses
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'cashflow' && (
            <motion.div
              key="cashflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CashFlowRunway hideHeader />
            </motion.div>
          )}
          {activeTab === 'bookkeeping' && (
            <motion.div
              key="bookkeeping"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Bookkeeping hideHeader />
            </motion.div>
          )}
          {activeTab === 'expenses' && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Expenses hideHeader />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

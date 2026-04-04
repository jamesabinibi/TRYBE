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
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') as 'cashflow' | 'bookkeeping' | 'expenses' || 'cashflow';
  const [activeTab, setActiveTab] = useState<'cashflow' | 'bookkeeping' | 'expenses'>(tab);

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  const handleTabChange = (newTab: 'cashflow' | 'bookkeeping' | 'expenses') => {
    setSearchParams({ tab: newTab });
    setActiveTab(newTab);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 relative">
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
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1.5 bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl w-full md:w-fit">
        <button
          onClick={() => handleTabChange('cashflow')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'cashflow'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cash Flow
        </button>
        <button
          onClick={() => handleTabChange('bookkeeping')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'bookkeeping'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Bookkeeping
        </button>
        <button
          onClick={() => handleTabChange('expenses')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
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

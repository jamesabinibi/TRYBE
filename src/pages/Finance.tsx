import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Briefcase, TrendingDown, LayoutDashboard } from 'lucide-react';
import CashFlowRunway from './CashFlowRunway';
import Bookkeeping from './Bookkeeping';
import Expenses from './Expenses';

export default function Finance() {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'bookkeeping' | 'expenses'>('cashflow');

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-brand" />
            Finance Hub
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">
            Manage your cash flow, bookkeeping, and expenses all in one place.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit">
        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'cashflow'
              ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cash Flow
        </button>
        <button
          onClick={() => setActiveTab('bookkeeping')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'bookkeeping'
              ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Bookkeeping
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
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

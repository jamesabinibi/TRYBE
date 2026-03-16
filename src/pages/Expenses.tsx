import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle,
  Calendar,
  Tag,
  FileText,
  TrendingDown,
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export default function Expenses() {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency || 'NGN';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDuration, setFilterDuration] = useState('All Time');
  
  const [newExpense, setNewExpense] = useState({
    category: 'General',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = [
    'Rent',
    'Electricity',
    'Salaries',
    'Supplies',
    'Marketing',
    'Transport',
    'General'
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await fetchWithAuth('/api/expenses');
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        console.error('Expenses data is not an array:', data);
        setExpenses([]);
      }
    } catch (err) {
      toast.error('Failed to fetch expenses');
      setExpenses([]);
    }
  };

  const handleAIScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('AI Screenshot: File selected', file.name);
    setIsProcessingAI(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      console.log('AI Screenshot: Image loaded, calling API...');
      try {
        const response = await fetchWithAuth('/api/ai/process-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error('AI Screenshot: API Error', data);
          if (data.error?.includes('API key not valid')) {
            toast.error('Invalid Gemini API Key. Please check your settings.');
          } else {
            toast.error(data.error || 'AI failed to process image');
          }
          return;
        }

        console.log('AI Screenshot: API Success', data);
        
        if (data.amount) {
          // Robust date parsing
          let parsedDate = new Date().toISOString().split('T')[0];
          if (data.date) {
            try {
              // Try standard parsing
              const d = new Date(data.date);
              if (!isNaN(d.getTime())) {
                parsedDate = d.toISOString().split('T')[0];
              } else {
                // Try DD/MM/YY or DD/MM/YYYY
                const parts = data.date.split(/[\/\-]/);
                if (parts.length === 3) {
                  let day, month, year;
                  if (parts[0].length === 4) { // YYYY-MM-DD
                    [year, month, day] = parts;
                  } else { // DD/MM/YY
                    [day, month, year] = parts;
                    if (year.length === 2) year = '20' + year;
                  }
                  const d2 = new Date(`${year}-${month}-${day}`);
                  if (!isNaN(d2.getTime())) {
                    parsedDate = d2.toISOString().split('T')[0];
                  }
                }
              }
            } catch (e) {
              console.error('Date parsing failed:', e);
            }
          }

          setNewExpense(prev => ({
            ...prev,
            amount: data.amount.toString(),
            description: data.narration || '',
            date: parsedDate
          }));
          toast.success('AI extracted transaction details!');
        }
      } catch (err) {
        toast.error('AI failed to process image');
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount) || 0
        })
      });
      
      if (response.ok) {
        setIsAddModalOpen(false);
        setNewExpense({
          category: 'General',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        fetchExpenses();
        toast.success('Expense recorded');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save expense');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const response = await fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchExpenses();
        toast.success('Expense deleted');
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'All' || e.category === filterCategory;
    
    let matchesDuration = true;
    if (filterDuration !== 'All Time') {
      const expenseDate = new Date(e.date);
      const now = new Date();
      if (filterDuration === 'Today') {
        matchesDuration = expenseDate.toDateString() === now.toDateString();
      } else if (filterDuration === 'This Week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        matchesDuration = expenseDate >= weekAgo;
      } else if (filterDuration === 'This Month') {
        matchesDuration = expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
      }
    }
    
    return matchesSearch && matchesCategory && matchesDuration;
  });

  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Business Expenses</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Track your operational costs and overheads</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="glass-card p-8 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Total Expenses</p>
          <h3 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight font-display">
            <span className="text-zinc-400 dark:text-zinc-600 mr-1 font-mono text-2xl">{currency === 'NGN' ? '₦' : currency}</span>
            {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-transparent rounded-2xl text-sm font-medium text-zinc-950 dark:text-white focus:bg-white dark:focus:bg-zinc-800 transition-all outline-none border border-zinc-200 dark:border-zinc-700 focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:border-brand outline-none transition-all dark:text-white"
            >
              <option value="All" className="dark:bg-zinc-900">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat} className="dark:bg-zinc-900">{cat}</option>)}
            </select>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:border-brand outline-none transition-all dark:text-white"
            >
              <option value="All Time" className="dark:bg-zinc-900">All Time</option>
              <option value="Today" className="dark:bg-zinc-900">Today</option>
              <option value="This Week" className="dark:bg-zinc-900">This Week</option>
              <option value="This Month" className="dark:bg-zinc-900">This Month</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Category</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Description</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-right">Amount</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3 text-sm font-bold font-mono tracking-tighter">
                      <Calendar className="w-3.5 h-3.5 opacity-50" />
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-white/10 dark:group-hover:bg-black/10 transition-colors">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium opacity-70 line-clamp-1">{expense.description}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="text-sm font-bold font-mono tracking-tighter text-red-500 group-hover:text-red-400">
                      -{formatCurrency(expense.amount, currency)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl flex items-center justify-center text-zinc-300">
                        <Wallet className="w-8 h-8" />
                      </div>
                      <p className="text-zinc-400 font-medium italic">No expenses found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-950 dark:text-white tracking-tight">Record Expense</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAIScreenshot}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <button 
                      className={cn(
                        "p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-brand transition-all",
                        isProcessingAI && "animate-pulse text-brand"
                      )}
                      title="Extract from Screenshot"
                    >
                      {isProcessingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    </button>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddExpense} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</label>
                    <select 
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                    >
                      {categories.map(c => <option key={c} value={c} className="dark:bg-zinc-900">{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount (₦)</label>
                    <input 
                      required
                      type="number" 
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</label>
                  <input 
                    type="date" 
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Description</label>
                  <textarea 
                    required
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    placeholder="What was this expense for?"
                    rows={3}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 active:scale-95"
                  >
                    {isSaving ? 'Saving...' : 'Save Expense'}
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


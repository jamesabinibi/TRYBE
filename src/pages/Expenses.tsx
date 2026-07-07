import React, { useState, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
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
  Sparkles,
  Shield,
  Check,
  UploadCloud
} from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { TotalDisplay } from '../components/TotalDisplay';
import { formatCurrency, cn, NUMBER_STYLE, retryWithBackoff, fetchGeminiKey, useQuery } from '../lib/utils';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from "@google/genai";

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}

interface ExtractedExpense {
  id: string;
  fileName: string;
  imagePreview: string;
  category: string;
  amount: string;
  date: string;
  description: string;
  status: 'reading' | 'extracting' | 'done' | 'failed';
  error?: string;
}

export default function Expenses({ hideHeader = false }: { hideHeader?: boolean }) {
  const { fetchWithAuth, user } = useAuth();
  const { settings } = useSettings();

  if (user?.role === 'staff' && !user?.permissions?.can_view_expenses) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full">
          <Shield className="w-12 h-12 text-zinc-400" />
        </div>
        <h2 className="h2">Access Denied</h2>
        <p className="body-text text-center max-w-md">
          You do not have permission to view expenses. Please contact your administrator.
        </p>
      </div>
    );
  }

  const currency = settings?.currency || 'NGN';
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const { ref: loadMoreRef, inView } = useInView();
  const LIMIT = 20;

  const fetchExpensesData = useCallback(async (pageIndex: number, isRefresh = false) => {
    if (!user) return;
    setIsLoadingExpenses(true);
    try {
      const res = await fetchWithAuth(`/api/expenses?limit=${LIMIT}&offset=${pageIndex * LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        if (isRefresh) {
          setExpenses(data);
        } else {
          setExpenses(prev => [...prev, ...data]);
        }
        setHasMore(data.length === LIMIT);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [user, fetchWithAuth]);

  useEffect(() => {
    if (user) {
      fetchExpensesData(0, true);
    }
  }, [user, fetchExpensesData]);

  useEffect(() => {
    if (inView && hasMore && !isLoadingExpenses) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchExpensesData(nextPage);
    }
  }, [inView, hasMore, isLoadingExpenses, page, fetchExpensesData]);

  const fetchExpenses = () => {
    fetchExpensesData(0, true);
    refetchStats();
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: expenseStats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery(`expense_stats_${debouncedSearch}`, async () => {
    const res = await fetchWithAuth(`/api/expenses/stats?search=${encodeURIComponent(debouncedSearch)}`);
    if (!res.ok) throw new Error('Failed to fetch expense stats');
    return await res.json();
  }, {
    persist: true,
    enabled: !!user
  });

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

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiStep, setAiStep] = useState<string>('');
  const [batchExpenses, setBatchExpenses] = useState<ExtractedExpense[]>([]);

  const handleAIScreenshotMultiple = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingAI(true);
    setAiStep('Processing screenshots...');

    const fileArray = Array.from(files);

    const newItems: ExtractedExpense[] = fileArray.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      imagePreview: '',
      category: 'General',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      status: 'reading'
    }));

    setBatchExpenses(prev => [...prev, ...newItems]);

    fileArray.forEach((file, index) => {
      const tempId = newItems[index].id;
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        setBatchExpenses(prev => prev.map(item => 
          item.id === tempId 
            ? { ...item, imagePreview: base64, status: 'extracting' }
            : item
        ));

        try {
          const response = await fetchWithAuth('/api/expenses/extract-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });

          if (!response.ok) {
            throw new Error('Server returned an error');
          }

          const data = await response.json();
          
          if (data && data.amount !== undefined) {
            let parsedDate = new Date().toISOString().split('T')[0];
            if (data.date) {
              try {
                const d = new Date(data.date);
                if (!isNaN(d.getTime())) {
                  parsedDate = d.toISOString().split('T')[0];
                } else {
                  const parts = data.date.split(/[\/\-]/);
                  if (parts.length === 3) {
                    let day, month, year;
                    if (parts[0].length === 4) {
                      [year, month, day] = parts;
                    } else {
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

            let category = 'General';
            const normNarration = (data.narration || '').toLowerCase();
            if (normNarration.includes('rent') || normNarration.includes('landlord')) category = 'Rent';
            else if (normNarration.includes('electricity') || normNarration.includes('power') || normNarration.includes('nepa') || normNarration.includes('ekedc')) category = 'Electricity';
            else if (normNarration.includes('salary') || normNarration.includes('salaries') || normNarration.includes('payroll') || normNarration.includes('staff')) category = 'Salaries';
            else if (normNarration.includes('supplies') || normNarration.includes('vendor') || normNarration.includes('inventory')) category = 'Supplies';
            else if (normNarration.includes('ads') || normNarration.includes('marketing') || normNarration.includes('facebook') || normNarration.includes('google ads') || normNarration.includes('advert')) category = 'Marketing';
            else if (normNarration.includes('transport') || normNarration.includes('fuel') || normNarration.includes('uber') || normNarration.includes('bolt') || normNarration.includes('logistic')) category = 'Transport';

            setBatchExpenses(prev => prev.map(item => 
              item.id === tempId 
                ? { 
                    ...item, 
                    amount: data.amount.toString(),
                    description: data.narration || '',
                    date: parsedDate,
                    category,
                    status: 'done'
                  }
                : item
            ));
          } else {
            throw new Error('AI failed to extract amount');
          }
        } catch (err: any) {
          console.error('[AI] Batch item processing error:', err);
          setBatchExpenses(prev => prev.map(item => 
            item.id === tempId 
              ? { ...item, status: 'failed', error: err.message || 'Unknown error' }
              : item
          ));
        }
      };

      reader.onerror = () => {
        setBatchExpenses(prev => prev.map(item => 
          item.id === tempId 
            ? { ...item, status: 'failed', error: 'Could not read file' }
            : item
        ));
      };

      reader.readAsDataURL(file);
    });

    setIsProcessingAI(false);
  };

  const handleSaveBatchExpenses = async () => {
    const activeItems = batchExpenses.filter(item => item.status === 'reading' || item.status === 'extracting');
    if (activeItems.length > 0) {
      toast.error('Please wait for all images to finish extracting.');
      return;
    }

    const itemsToSave = batchExpenses.filter(item => item.status === 'done');
    if (itemsToSave.length === 0) {
      toast.error('No successfully extracted expenses to save.');
      return;
    }

    const invalidItem = itemsToSave.find(item => !item.amount || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0);
    if (invalidItem) {
      toast.error(`Please enter a valid amount for "${invalidItem.fileName}".`);
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(itemsToSave.map(async (item) => {
        try {
          const response = await fetchWithAuth('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: item.category,
              amount: parseFloat(item.amount) || 0,
              description: item.description || `Extracted from ${item.fileName}`,
              date: item.date
            })
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        toast.success(`Successfully saved ${successCount} expense(s)!`);
        setBatchExpenses([]);
        setIsAddModalOpen(false);
        fetchExpenses();
        refetchStats();
      }
      
      if (failCount > 0) {
        toast.error(`Failed to save ${failCount} expense(s).`);
      }
    } catch (err) {
      toast.error('Error saving expenses');
    } finally {
      setIsSaving(false);
    }
  };

  const updateBatchItem = (id: string, field: keyof ExtractedExpense, value: string) => {
    setBatchExpenses(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeBatchItem = (id: string) => {
    setBatchExpenses(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered;
    });
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
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="h3">Delete Expense</h3>
        </div>
        <p className="body-text opacity-70">Are you sure you want to delete this expense? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const response = await fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' });
                if (response.ok) {
                  fetchExpenses();
                  toast.success('Expense deleted');
                }
              } catch (err) {
                toast.error('Failed to delete');
              }
            }}
            className="btn-destructive flex-1"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const filteredExpenses = (expenses || []).filter(e => {
    const matchesSearch = 
      String(e.description || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()) ||
      String(e.category || '').toLowerCase().includes(String(searchQuery || '').toLowerCase());
    
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
    <div className={`space-y-8 ${hideHeader ? '' : 'pb-20'}`}>
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="h1">Business Expenses</h1>
            <p className="body-text mt-1">Track your operational costs and overheads</p>
          </div>
          {(user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_manage_expenses)) && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </button>
          )}
        </div>
      )}
      
      {hideHeader && (
        <div className="flex justify-end mb-4">
          {(user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_manage_expenses)) && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="glass-card p-8 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown className="w-24 h-24" />
          </div>
          <TotalDisplay 
            label="Total Expenses" 
            value={(expenseStats?.total || 0).toLocaleString()} 
            labelClassName="label-text"
            valueClassName="h2"
          />
        </motion.div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              type="text" 
              placeholder="Search expenses..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              as="select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All" className="dark:bg-zinc-900">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat} className="dark:bg-zinc-900">{cat}</option>)}
            </Input>
            <Input
              as="select"
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
            >
              <option value="All Time" className="dark:bg-zinc-900">All Time</option>
              <option value="Today" className="dark:bg-zinc-900">Today</option>
              <option value="This Week" className="dark:bg-zinc-900">This Week</option>
              <option value="This Month" className="dark:bg-zinc-900">This Month</option>
            </Input>
          </div>
        </div>

        <div className="overflow-x-auto sm:overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead className="hidden sm:table-header-group">
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                <th className="px-8 py-6 label-text">Date</th>
                <th className="px-8 py-6 label-text">Category</th>
                <th className="px-8 py-6 label-text">Description</th>
                <th className="px-8 py-6 label-text text-right">Amount</th>
                <th className="px-8 py-6 label-text text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="flex flex-col sm:table-row hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer p-4 sm:p-0">
                  <td className="px-4 sm:px-8 py-2 sm:py-5 flex justify-between items-center sm:table-cell">
                    <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Date</span>
                    <div className={cn(NUMBER_STYLE, "flex items-center gap-3 text-sm tracking-tighter")}>
                      <Calendar className="w-3.5 h-3.5 opacity-50" />
                      {new Date(expense.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 sm:px-8 py-2 sm:py-5 flex justify-between items-center sm:table-cell">
                    <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-white/10 dark:group-hover:bg-black/10 transition-colors">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-2 sm:py-5 flex justify-between items-center sm:table-cell">
                    <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Description</span>
                    <p className="text-sm font-medium opacity-70 line-clamp-1">{expense.description}</p>
                  </td>
                  <td className="px-4 sm:px-8 py-2 sm:py-5 flex justify-between items-center sm:table-cell text-right">
                    <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</span>
                    <span className={cn(NUMBER_STYLE, "text-sm text-red-500 group-hover:text-red-400")}>
                      -<CurrencyDisplay amount={expense.amount} currencyCode={currency} size="sm" />
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-2 sm:py-5 flex justify-between items-center sm:table-cell text-right">
                    <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</span>
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
                      <p className="text-zinc-400 font-medium">No expenses found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddModalOpen(false); setBatchExpenses([]); }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300",
                batchExpenses.length > 0 ? "max-w-4xl" : "max-w-lg"
              )}
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h2 className="h2">{batchExpenses.length > 0 ? "Record Expenses (Batch Mode)" : "Record Expense"}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={handleAIScreenshotMultiple}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <button 
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 bg-brand/10 text-brand rounded-xl text-[10px] font-medium uppercase tracking-widest hover:bg-brand/20 transition-all",
                        isProcessingAI && "animate-pulse"
                      )}
                    >
                      {isProcessingAI ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{aiStep}</span>
                        </div>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Snap & Track
                        </>
                      )}
                    </button>
                  </div>
                  {batchExpenses.length > 0 && (
                    <button 
                      onClick={() => setBatchExpenses([])}
                      className="p-2 text-[10px] font-medium uppercase tracking-widest bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 rounded-xl transition-all"
                    >
                      Clear Batch
                    </button>
                  )}
                  <button onClick={() => { setIsAddModalOpen(false); setBatchExpenses([]); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>

              {batchExpenses.length > 0 ? (
                <div className="p-8 space-y-6">
                  <p className="body-text opacity-70">
                    We've scanned your receipts/screenshots. You can review, edit, or categorize them before saving.
                  </p>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {batchExpenses.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col sm:flex-row gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 items-start sm:items-center"
                      >
                        {/* Thumbnail preview */}
                        <div className="relative w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                          {item.imagePreview ? (
                            <img src={item.imagePreview} alt="Receipt Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                              <UploadCloud className="w-5 h-5 text-zinc-400 animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Editable Inputs */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 w-full">
                          {/* Category select */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Category</label>
                            <select
                              value={item.category}
                              onChange={(e) => updateBatchItem(item.id, 'category', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            >
                              {categories.map(c => <option key={c} value={c} className="dark:bg-zinc-900">{c}</option>)}
                            </select>
                          </div>

                          {/* Amount Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Amount ({currency})</label>
                            <input
                              type="number"
                              required
                              value={item.amount}
                              onChange={(e) => updateBatchItem(item.id, 'amount', e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand font-medium"
                            />
                          </div>

                          {/* Date input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Date</label>
                            <input
                              type="date"
                              required
                              value={item.date}
                              onChange={(e) => updateBatchItem(item.id, 'date', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                          </div>

                          {/* Description input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Description</label>
                            <input
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => updateBatchItem(item.id, 'description', e.target.value)}
                              placeholder="Describe this expense"
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                          </div>
                        </div>

                        {/* Status indicators & Actions */}
                        <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                          {item.status === 'reading' && (
                            <span className="text-[11px] text-amber-500 flex items-center gap-1 font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Reading
                            </span>
                          )}
                          {item.status === 'extracting' && (
                            <span className="text-[11px] text-brand flex items-center gap-1 font-medium">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Scanning
                            </span>
                          )}
                          {item.status === 'done' && (
                            <span className="text-[11px] text-green-500 flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              Ready
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="text-[11px] text-red-500 flex items-center gap-1 font-medium" title={item.error}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => removeBatchItem(item.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex gap-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => { setBatchExpenses([]); setIsAddModalOpen(false); }}
                      className="btn-secondary flex-1 py-4"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBatchExpenses}
                      disabled={isSaving || batchExpenses.some(x => x.status === 'reading' || x.status === 'extracting')}
                      className="btn-primary flex-1 py-4"
                    >
                      {isSaving ? 'Saving expenses...' : `Save ${batchExpenses.filter(x => x.status === 'done').length} Expense(s)`}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddExpense} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="label-text">Category</label>
                      <Input 
                        as="select"
                        value={newExpense.category}
                        onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c} value={c} className="dark:bg-zinc-900">{c}</option>)}
                      </Input>
                    </div>
                    <div className="space-y-2">
                      <label className="label-text">Amount ({currency})</label>
                      <Input 
                        required
                        type="number" 
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="label-text">Date</label>
                    <Input 
                      type="date" 
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="label-text">Description</label>
                    <Textarea 
                      required
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                      placeholder="What was this expense for?"
                      rows={3}
                    />
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="btn-secondary flex-1 py-4"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="btn-primary flex-1 py-4"
                    >
                      {isSaving ? 'Saving...' : 'Save Expense'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


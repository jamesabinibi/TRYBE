import React, { useState, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { 
  TrendingUp, 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle,
  Calendar,
  Tag,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Loader2,
  Download
} from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { formatCurrency, cn, NUMBER_STYLE } from '../lib/utils';
import { TotalDisplay } from '../components/TotalDisplay';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';

interface Record {
  id: number | string;
  type: 'loan' | 'debt_recovery' | 'investment' | 'other' | 'sale' | 'cogs' | string;
  nature: 'income' | 'expense' | 'other';
  amount: number;
  description: string;
  date: string;
  source?: string;
}

export default function Bookkeeping({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user, fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency || 'NGN';
  const [records, setRecords] = useState<Record[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  const [newRecord, setNewRecord] = useState({
    type: 'loan',
    nature: 'other' as 'income' | 'expense' | 'other',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const types = [
    { value: 'loan', label: 'Loan' },
    { value: 'debt_recovery', label: 'Debt Recovery' },
    { value: 'investment', label: 'Investment' },
    { value: 'other', label: 'Other' }
  ];

  const natures = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'other', label: 'Other Inflow/Outflow' }
  ];

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const { ref: loadMoreRef, inView } = useInView();
  const LIMIT = 20;

  const fetchRecordsData = useCallback(async (pageIndex: number, isRefresh = false) => {
    if (!user) return;
    setIsLoadingRecords(true);
    try {
      const res = await fetchWithAuth(`/api/bookkeeping?limit=${LIMIT}&offset=${pageIndex * LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        if (isRefresh) {
          setRecords(data);
        } else {
          setRecords(prev => [...prev, ...data]);
        }
        setHasMore(data.length === LIMIT);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [user, fetchWithAuth]);

  useEffect(() => {
    if (user) {
      fetchRecordsData(0, true);
    }
  }, [user, fetchRecordsData]);

  useEffect(() => {
    if (inView && hasMore && !isLoadingRecords) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchRecordsData(nextPage);
    }
  }, [inView, hasMore, isLoadingRecords, page, fetchRecordsData]);

  const fetchRecords = () => fetchRecordsData(0, true);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.amount || !newRecord.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/bookkeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      
      if (response.ok) {
        fetchRecords();
        setIsAddModalOpen(false);
        setNewRecord({
          type: 'loan',
          nature: 'other',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        toast.success('Record added successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save record');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (id: number | string) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="label-text text-zinc-900">Delete Record</h3>
        </div>
        <p className="body-text">Are you sure you want to delete this record? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const response = await fetchWithAuth(`/api/bookkeeping/${id}`, { method: 'DELETE' });
                if (response.ok) {
                  fetchRecords();
                  toast.success('Record deleted');
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

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      String(r.description || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()) ||
      String(r.type || '').toLowerCase().includes(String(searchQuery || '').toLowerCase());
    
    const matchesType = filterType === 'All' || r.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const totalInflows = filteredRecords.filter(r => r.nature === 'income').reduce((acc, r) => acc + Number(r.amount), 0);
  const totalOutflows = filteredRecords.filter(r => r.nature === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount'];
    const rows = filteredRecords.map(r => [
      r.date,
      r.type.toUpperCase(),
      r.description,
      r.amount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookkeeping_records_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-8 ${hideHeader ? '' : 'pb-20'}`}>
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="h1">Financial Bookkeeping</h1>
            <p className="body-text mt-1">Record non-sales inflows like loans and investments</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={exportToCSV}
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Record Inflow
            </button>
          </div>
        </div>
      )}
      
      {hideHeader && (
        <div className="flex justify-end mb-4 gap-3">
          <button 
            onClick={exportToCSV}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Record Inflow
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <TotalDisplay 
            label="Total Inflows" 
            value={totalInflows} 
            icon={<ArrowUpRight className="w-6 h-6" />}
            iconClassName="bg-brand/10 text-brand"
          />
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <TotalDisplay 
            label="Total Outflows" 
            value={totalOutflows} 
            icon={<ArrowDownRight className="w-6 h-6" />}
            iconClassName="bg-red-500/10 text-red-500"
          />
        </div>
        <div className="bg-brand text-white p-6 rounded-3xl shadow-sm">
          <TotalDisplay 
            label="Net Balance" 
            value={totalInflows - totalOutflows} 
            icon={<TrendingUp className="w-6 h-6" />}
            iconClassName="bg-white/20 text-white"
            valueClassName="text-white"
            labelClassName="text-white/80"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              type="text" 
              placeholder="Search records..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
          <div className="flex items-center gap-3">
            <Input 
              as="select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              {types.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Input>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <th className="px-6 py-4 label-text">Date</th>
                <th className="px-6 py-4 label-text">Type</th>
                <th className="px-6 py-4 label-text">Nature</th>
                <th className="px-6 py-4 label-text">Description</th>
                <th className="px-6 py-4 label-text text-right">Amount</th>
                <th className="px-6 py-4 label-text text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">
                        {new Date(record.date).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      record.type === 'loan' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                      record.type === 'debt_recovery' ? "bg-brand/10 text-brand" :
                      record.type === 'investment' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                      record.type === 'sale' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                      record.type === 'cogs' ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      {record.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      record.nature === 'income' ? "bg-brand/10 text-brand" :
                      record.nature === 'expense' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      {record.nature || 'other'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{record.description}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      NUMBER_STYLE,
                      "text-sm",
                      record.nature === 'income' ? "text-brand " :
                      record.nature === 'expense' ? "text-red-600 dark:text-red-400" :
                      "text-zinc-950 dark:text-white"
                    )}>
                      {record.nature === 'expense' ? '-' : '+'}<CurrencyDisplay amount={record.amount} currencyCode={currency} size="sm" />
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {record.source === 'bookkeeping' && (
                      <button 
                        onClick={() => handleDeleteRecord(record.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-zinc-300" />
                      <p className="text-sm font-bold text-zinc-500">No records found</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="h2">Record Inflow</h2>
                  <p className="body-text opacity-70">Add non-sales income to your books</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-text ml-1">Type</label>
                    <Input 
                      as="select"
                      value={newRecord.type}
                      onChange={(e) => setNewRecord({...newRecord, type: e.target.value as any})}
                    >
                      {types.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Input>
                  </div>
                  <div className="space-y-2">
                    <label className="label-text ml-1">Nature</label>
                    <Input 
                      as="select"
                      value={newRecord.nature}
                      onChange={(e) => setNewRecord({...newRecord, nature: e.target.value as any})}
                    >
                      {natures.map(n => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </Input>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-text ml-1">Date</label>
                    <Input 
                      type="date" 
                      value={newRecord.date}
                      onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-text ml-1">Amount ({currency})</label>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      value={newRecord.amount}
                      onChange={(e) => setNewRecord({...newRecord, amount: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-text ml-1">Description</label>
                  <Textarea 
                    placeholder="What is this inflow for?"
                    value={newRecord.description}
                    onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                    rows={4}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary w-full py-5"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Save Record
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

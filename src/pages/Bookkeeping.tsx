import React, { useState, useEffect } from 'react';
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
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Record {
  id: number;
  type: 'loan' | 'debt_recovery' | 'investment' | 'other';
  nature: 'income' | 'expense' | 'other';
  amount: number;
  description: string;
  date: string;
}

export default function Bookkeeping() {
  const { fetchWithAuth } = useAuth();
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

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetchWithAuth('/api/bookkeeping');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      toast.error('Failed to fetch records');
      setRecords([]);
    }
  };

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

  const handleDeleteRecord = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const response = await fetchWithAuth(`/api/bookkeeping/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchRecords();
        toast.success('Record deleted');
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'All' || r.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const totalInflows = filteredRecords.reduce((acc, r) => acc + Number(r.amount), 0);

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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight">Financial Bookkeeping</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Record non-sales inflows like loans and investments</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Record Inflow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Total Inflows</p>
              <h3 className="text-2xl font-black text-zinc-950 dark:text-white">{formatCurrency(totalInflows, currency)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search records..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-transparent rounded-2xl text-sm font-medium text-zinc-950 dark:text-white focus:ring-4 focus:ring-brand/10 focus:border-brand/20 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-transparent rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all"
            >
              <option value="All">All Types</option>
              {types.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nature</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-bold text-zinc-950 dark:text-white">
                        {new Date(record.date).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      record.type === 'loan' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                      record.type === 'debt_recovery' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      record.type === 'investment' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      {record.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      record.nature === 'income' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
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
                      "text-sm font-black",
                      record.nature === 'income' ? "text-emerald-600 dark:text-emerald-400" :
                      record.nature === 'expense' ? "text-red-600 dark:text-red-400" :
                      "text-zinc-950 dark:text-white"
                    )}>
                      {record.nature === 'expense' ? '-' : '+'}{formatCurrency(record.amount, currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                  <h2 className="text-2xl font-black text-zinc-950 dark:text-white tracking-tight">Record Inflow</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Add non-sales income to your books</p>
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
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      value={newRecord.type}
                      onChange={(e) => setNewRecord({...newRecord, type: e.target.value as any})}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-brand rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none transition-all"
                    >
                      {types.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nature</label>
                    <select 
                      value={newRecord.nature}
                      onChange={(e) => setNewRecord({...newRecord, nature: e.target.value as any})}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-brand rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none transition-all"
                    >
                      {natures.map(n => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date</label>
                    <input 
                      type="date" 
                      value={newRecord.date}
                      onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-brand rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount ({currency})</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={newRecord.amount}
                      onChange={(e) => setNewRecord({...newRecord, amount: e.target.value})}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-brand rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    placeholder="What is this inflow for?"
                    value={newRecord.description}
                    onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-brand rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none transition-all resize-none h-32"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-5 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 flex items-center justify-center gap-2"
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

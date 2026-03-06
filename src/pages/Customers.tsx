import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Star,
  History,
  TrendingUp,
  X,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  loyalty_points: number;
  created_at: string;
}

export default function Customers() {
  const { fetchWithAuth } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetchWithAuth('/api/customers');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Ensure loyalty_points exists for frontend
        const normalized = data.map(c => ({
          ...c,
          loyalty_points: c.loyalty_points || 0
        }));
        setCustomers(normalized);
      } else {
        console.error('Customers data is not an array:', data);
        setCustomers([]);
      }
    } catch (err) {
      toast.error('Failed to fetch customers');
      setCustomers([]);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetchWithAuth('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      
      if (response.ok) {
        setIsAddModalOpen(false);
        setNewCustomer({ name: '', phone: '', email: '' });
        fetchCustomers();
        toast.success('Customer added');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save customer');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Customer CRM</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Manage your relationships and loyalty programs</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Customers</p>
          <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{customers.length}</h3>
          <div className="mt-2 flex items-center gap-1 text-emerald-500 text-[10px] font-black uppercase">
            <TrendingUp className="w-3 h-3" />
            Growing
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search by name, phone, or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-transparent rounded-2xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-800 transition-all outline-none border border-zinc-200 dark:border-zinc-700 focus:border-brand"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filteredCustomers.map((customer) => (
            <motion.div 
              layout
              key={customer.id}
              className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700/50 hover:border-brand transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-brand font-black text-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                  {customer.name.charAt(0)}
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-brand/10 text-brand rounded-full text-[10px] font-black uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current" />
                  {customer.loyalty_points} pts
                </div>
              </div>
              
              <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-4 tracking-tight">{customer.name}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm font-medium truncate">{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-zinc-400">
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Joined {new Date(customer.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                <button className="flex-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all">
                  View History
                </button>
                <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand/20 transition-all">
                  Edit
                </button>
              </div>
            </motion.div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl flex items-center justify-center text-zinc-300">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-zinc-400 font-medium italic">No customers found</p>
              </div>
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
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Add New Customer</h2>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="John Doe"
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="+234..."
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email (Optional)</label>
                    <input 
                      type="email" 
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      placeholder="john@example.com"
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>
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
                    {isSaving ? 'Saving...' : 'Save Customer'}
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

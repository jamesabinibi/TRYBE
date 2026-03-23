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
  UserPlus,
  Download,
  FileText,
  Trash2,
  Edit2,
  Calendar,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address?: string;
  loyalty_points: number;
  created_at: string;
}

interface SaleItem {
  id: number;
  product_id?: number;
  quantity: number;
  price?: number;
  unit_price?: number;
  products?: { name: string };
  product_variants?: {
    size: string;
    color: string;
    products?: {
      name: string;
    };
  };
}

interface SaleHistory {
  id: number;
  invoice_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  sale_items: SaleItem[];
}

export default function Customers() {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency || 'NGN';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<SaleHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
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
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
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

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      const response = await fetchWithAuth(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      
      if (response.ok) {
        setIsEditModalOpen(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
        setSelectedCustomer(null);
        fetchCustomers();
        toast.success('Customer updated');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update customer');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
    try {
      const response = await fetchWithAuth(`/api/customers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCustomers();
        toast.success('Customer deleted');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete customer');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const fetchHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const res = await fetchWithAuth(`/api/customers/${customer.id}/history`);
      const data = await res.json();
      setCustomerHistory(data || []);
    } catch (err) {
      toast.error('Failed to fetch history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Customer List', 14, 15);
    const tableData = filteredCustomers.map(c => [
      c.name,
      c.phone,
      c.email || 'N/A',
      c.loyalty_points.toString(),
      new Date(c.created_at).toLocaleDateString()
    ]);
    (doc as any).autoTable({
      head: [['Name', 'Phone', 'Email', 'Points', 'Joined']],
      body: tableData,
      startY: 20,
    });
    doc.save('customers.pdf');
  };

  const exportCSV = () => {
    const data = filteredCustomers.map(c => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email || '',
      Points: c.loyalty_points,
      Joined: new Date(c.created_at).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customers.csv");
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
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight">Customer CRM</h1>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">Manage your relationships and loyalty programs</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button 
            onClick={() => {
              setNewCustomer({ name: '', phone: '', email: '', address: '' });
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="glass-card p-8 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] mb-4">Total Customers</p>
          <h3 className="text-4xl font-bold text-zinc-950 dark:text-white tracking-tight font-display">
            {customers.length}
          </h3>
          <div className="mt-4 flex items-center gap-2 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
            <TrendingUp className="w-3.5 h-3.5" />
            Active Growth
          </div>
        </motion.div>
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
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-transparent rounded-2xl text-sm font-medium text-zinc-950 dark:text-white focus:bg-white dark:focus:bg-zinc-800 transition-all outline-none border border-zinc-200 dark:border-zinc-700 focus:border-brand"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
          {filteredCustomers.map((customer) => (
            <motion.div 
              layout
              whileHover={{ y: -4 }}
              key={customer.id}
              className="glass-card p-8 group relative overflow-hidden border-zinc-200/50 dark:border-zinc-700/30"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-brand font-bold text-2xl border border-zinc-200 dark:border-zinc-700 group-hover:bg-brand group-hover:text-white group-hover:border-brand transition-all duration-500">
                  {customer.name?.charAt(0) || '?'}
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2 bg-brand/10 text-brand rounded-full text-[10px] font-bold uppercase tracking-widest">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {customer.loyalty_points} Points
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight font-display">{customer.name}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-brand/10 group-hover:text-brand transition-all">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold font-mono tracking-tighter">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-brand/10 group-hover:text-brand transition-all">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium truncate">{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-zinc-400 dark:text-zinc-500">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Since {new Date(customer.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                <button 
                  onClick={() => fetchHistory(customer)}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-zinc-950 transition-all"
                >
                  History
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setNewCustomer({
                        name: customer.name,
                        phone: customer.phone,
                        email: customer.email || '',
                        address: customer.address || ''
                      });
                      setIsEditModalOpen(true);
                    }}
                    className="p-3 bg-brand/10 text-brand rounded-2xl hover:bg-brand hover:text-white transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
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
                    {isAddModalOpen ? <UserPlus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                    {isAddModalOpen ? 'Add New Customer' : 'Edit Customer'}
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={isAddModalOpen ? handleAddCustomer : handleEditCustomer} className="p-8 space-y-6">
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

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Address (Optional)</label>
                  <textarea 
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    placeholder="123 Main St, Lagos"
                    rows={2}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setIsEditModalOpen(false);
                    }}
                    className="flex-1 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-4 bg-brand text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 active:scale-95"
                  >
                    {isSaving ? 'Saving...' : (isAddModalOpen ? 'Save Customer' : 'Update Customer')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-950 dark:text-white tracking-tight">Purchase History</h2>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{selectedCustomer?.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 p-8">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : customerHistory.length > 0 ? (
                  <div className="space-y-6">
                    {customerHistory.map((sale) => (
                      <div key={sale.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-100 dark:border-zinc-700">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-zinc-950 dark:text-white uppercase tracking-widest">{sale.invoice_number}</p>
                              <p className="text-[10px] font-bold text-zinc-400">{new Date(sale.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-brand">{formatCurrency(sale.total_amount, currency)}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{sale.payment_method}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {sale.sale_items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 bg-white dark:bg-zinc-800 rounded flex items-center justify-center text-[10px] font-black text-zinc-400 border border-zinc-100 dark:border-zinc-700">
                                  {item.quantity}x
                                </span>
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                  {item.product_variants?.products?.name || 'Unknown Product'}
                                </span>
                              </div>
                              <span className="font-black text-zinc-950 dark:text-white">
                                {formatCurrency((item.unit_price || item.price || 0) * item.quantity, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <History className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-400 font-medium">No purchase history found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

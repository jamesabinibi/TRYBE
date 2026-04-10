import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Briefcase,
  DollarSign,
  ChevronRight,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { useSearch } from '../contexts/SearchContext';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
}

const Services = () => {
  const { fetchWithAuth } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { settings } = useSettings();
  const { searchQuery, setSearchQuery } = useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetchWithAuth('/api/services');
      const data = await res.json();
      if (res.ok) {
        setServices(data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch services');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-bold text-zinc-900 uppercase tracking-widest text-xs">Delete Service</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this service? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const res = await fetchWithAuth(`/api/services/${id}`, {
                  method: 'DELETE'
                });
                const data = await res.json();
                
                if (res.ok) {
                  setServices(services.filter(s => s.id !== id));
                  toast.success('Service deleted successfully');
                } else {
                  throw new Error(data.error || 'Failed to delete service');
                }
              } catch (error: any) {
                toast.error(error.message);
              }
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const serviceData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      price: parseFloat(formData.get('price') as string),
      category: formData.get('category') as string,
    };

    try {
      const url = editingService ? `/api/services/${editingService.id}` : '/api/services';
      const method = editingService ? 'PUT' : 'POST';
      
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(editingService ? 'Service updated successfully' : 'Service added successfully');
        setIsAddModalOpen(false);
        setEditingService(null);
        fetchServices();
      } else {
        throw new Error(data.error || 'Failed to save service');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = services.filter(s => 
    String(s.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()) ||
    String(s.category || '').toLowerCase().includes(String(searchQuery || '').toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Services</h1>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">Manage your service offerings and pricing</p>
        </div>
        <button 
          onClick={() => {
            setEditingService(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <Input 
              type="text" 
              placeholder="Search services..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <motion.div 
                key={service.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-brand/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-brand shadow-sm border border-zinc-100 dark:border-zinc-800">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingService(service);
                        setIsAddModalOpen(true);
                      }}
                      className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-brand transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteService(service.id)}
                      className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{service.name}</h3>
                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{service.category}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{service.description}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end">
                  <span className="text-lg font-bold text-brand">{formatCurrency(service.price, settings?.currency || 'NGN')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-10 h-10 text-zinc-200 dark:text-zinc-700" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">No services found</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">Try adjusting your search or add a new service</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 sm:p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                      {editingService ? 'Edit Service' : 'Add New Service'}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1">Fill in the details below</p>
                  </div>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800 rounded-2xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Service Name</label>
                    <Input 
                      name="name"
                      required
                      defaultValue={editingService?.name}
                      placeholder="e.g. Haircut, Consultation"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Price (₦)</label>
                    <Input 
                      name="price"
                      type="number"
                      step="0.01"
                      required
                      defaultValue={editingService?.price}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                    <Input 
                      name="category"
                      required
                      defaultValue={editingService?.category}
                      placeholder="e.g. Beauty, Consulting"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                    <Textarea 
                      name="description"
                      rows={3}
                      defaultValue={editingService?.description}
                      placeholder="Brief description of the service..."
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-5 bg-brand text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingService ? 'Update Service' : 'Create Service'
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Services;

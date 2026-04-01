import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Edit3,
  Trash2, 
  ChevronRight,
  Package,
  AlertCircle,
  Image as ImageIcon,
  TrendingUp,
  X,
  Check,
  Briefcase,
  Upload,
  Share2
} from 'lucide-react';
import { Product, Category, Service } from '../types';
import { formatCurrency, cn, NUMBER_STYLE } from '../lib/utils';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { NumberDisplay } from '../components/NumberDisplay';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { useSearch } from '../contexts/SearchContext';
import { toast } from 'sonner';

const getOptimizedImageUrl = (url: string, width: number = 300) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  let key = url;
  if (url.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1);
      
      if (url.includes('amazonaws.com')) {
        // For S3 URLs, the key is just the pathname without the leading slash
        key = urlObj.pathname.substring(1);
      } else if (url.includes('cloudinary.com')) {
        const uploadIndex = url.indexOf('/upload/');
        if (uploadIndex !== -1) {
           const afterUpload = url.substring(uploadIndex + 8);
           const parts = afterUpload.split('/');
           if (parts.length > 1 && parts[0].startsWith('v')) {
             key = parts.slice(1).join('/');
           } else {
             key = afterUpload;
           }
        }
      }
    } catch (e) {
      // fallback
    }
  }
  
  return `https://pmp323myg6rsao42jsmdzpidb40xhakc.lambda-url.us-east-1.on.aws/?key=${encodeURIComponent(key)}&w=${width}`;
};

const getInitialProductState = () => ({
  name: '',
  category_id: '',
  description: '',
  cost_price: '',
  selling_price: '',
  supplier_name: '',
  unit: 'Pieces',
  pieces_per_unit: '1',
  product_type: 'one' as 'one' | 'multiple',
  variants: [{ size: '', color: '', quantity: '0', low_stock_threshold: '' }],
  images: []
});

export default function Products() {
  const { user, fetchWithAuth } = useAuth();
  const { settings } = useSettings();

  const canManageProducts = user?.role === 'admin' || user?.role === 'manager' || (user?.role === 'staff' && user?.permissions?.can_manage_products);
  const currency = settings?.currency || 'NGN';
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: ''
  });

  const closeModal = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingProduct(null);
    setNewProduct(getInitialProductState());
    setImagePreviews([]);
    setIsBulkEditing(false);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setNewProduct(getInitialProductState());
    setImagePreviews([]);
    setIsBulkEditing(false);
    setIsAddModalOpen(true);
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'services') {
      setActiveSubTab('services');
    } else if (tab === 'products') {
      setActiveSubTab('products');
    }

    const action = searchParams.get('action');
    if (action === 'add') {
      // Clear the action immediately to prevent re-triggering
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
      
      // Open the modal with fresh state
      openAddModal();
    }
  }, [searchParams, setSearchParams, openAddModal]);
  const { searchQuery, setSearchQuery } = useSearch();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'count'>('list');
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'services'>('products');
  
  const [newProduct, setNewProduct] = useState(getInitialProductState());

  const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const totalQuantity = newProduct.variants.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);

  useEffect(() => {
    if (user) {
      const loadInitialData = async () => {
        try {
          const batchRes = await fetchWithAuth('/api/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoints: ['/api/products?exclude_images=true', '/api/services', '/api/categories']
            })
          });
          if (!batchRes.ok) {
            throw new Error(`Batch fetch failed with status ${batchRes.status}`);
          }
          const [productsData, servicesData, categoriesData] = await batchRes.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
          setServices(Array.isArray(servicesData) ? servicesData : []);
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
          
          // Load images in the background
          fetchProducts();
        } catch (err) {
          console.error("Batch fetch failed", err);
        } finally {
          setIsLoading(false);
        }
      };
      loadInitialData();
    }
  }, [user]);

  const fetchServices = async () => {
    try {
      const res = await fetchWithAuth('/api/services');
      const data = await res.json();
      if (Array.isArray(data)) {
        setServices(data);
      } else {
        setServices([]);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setServices([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/products');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        console.error("Failed to fetch products:", data);
        setProducts([]);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetchWithAuth('/api/categories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        console.error("Failed to fetch categories:", data);
        setCategories([]);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      setCategories([]);
    }
  };

  const handleShareWhatsApp = (product: Product) => {
    const message = `*${product.name}*\n${product.description || ''}\n\nPrice: ${formatCurrency(product.selling_price, currency)}\n\nCheck it out on our store!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      
      const payload = {
        name: newProduct.name,
        category_id: parseInt(newProduct.category_id) || null,
        description: newProduct.description,
        cost_price: parseFloat(newProduct.cost_price) || 0,
        selling_price: parseFloat(newProduct.selling_price) || 0,
        supplier_name: newProduct.supplier_name,
        unit: newProduct.unit,
        pieces_per_unit: parseInt(newProduct.pieces_per_unit as any) || 1,
        product_type: newProduct.product_type,
        variants: (newProduct.product_type === 'one' ? [newProduct.variants[0] || { size: '', color: '', quantity: '0', low_stock_threshold: '' }] : newProduct.variants).map(v => ({
          ...v,
          quantity: parseInt(v.quantity as any) || 0,
          low_stock_threshold: v.low_stock_threshold === '' || v.low_stock_threshold === null || v.low_stock_threshold === undefined ? null : parseInt(v.low_stock_threshold as any)
        })),
        images: newProduct.images
      };

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        closeModal();
        fetchProducts();
        toast.success(editingProduct ? 'Product updated' : 'Product added');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save product');
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      category_id: (product.category_id || '').toString(),
      description: product.description || '',
      cost_price: (product.cost_price || 0).toString(),
      selling_price: (product.selling_price || 0).toString(),
      supplier_name: product.supplier_name || '',
      unit: (product as any).unit || 'Pieces',
      pieces_per_unit: (product as any).pieces_per_unit?.toString() || '1',
      product_type: (product as any).product_type || (product.variants?.length > 1 ? 'multiple' : 'one'),
      variants: (product.variants || []).map(v => ({
        size: v.size || '',
        color: v.color || '',
        quantity: (v.quantity || 0).toString(),
        low_stock_threshold: v.low_stock_threshold !== null && v.low_stock_threshold !== undefined ? v.low_stock_threshold.toString() : '',
        price_override: v.price_override
      })),
      images: product.images || []
    });
    setImagePreviews(product.images || []);
    setIsAddModalOpen(true);
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
                const response = await fetchWithAuth(`/api/services/${id}`, { method: 'DELETE' });
                if (response.ok) {
                  toast.success('Service deleted');
                  fetchServices();
                } else {
                  toast.error('Failed to delete service');
                }
              } catch (err) {
                console.error(err);
                toast.error('An error occurred');
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

  const openAddServiceModal = () => {
    setEditingService(null);
    setNewService({
      name: '',
      description: '',
      price: '',
      category: '',
      image_url: ''
    });
    setIsServiceModalOpen(true);
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setNewService({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
      category: service.category || '',
      image_url: service.image_url || ''
    });
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingService ? `/api/services/${editingService.id}` : '/api/services';
      const method = editingService ? 'PUT' : 'POST';
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newService,
          price: parseFloat(newService.price) || 0
        })
      });
      if (response.ok) {
        toast.success(editingService ? 'Service updated' : 'Service added');
        setIsServiceModalOpen(false);
        setEditingService(null);
        setNewService({ name: '', description: '', price: '', category: '', image_url: '' });
        fetchServices();
      } else {
        toast.error('Failed to save service');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-bold text-zinc-900 uppercase tracking-widest text-xs">Confirm Deletion</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this product? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const response = await fetchWithAuth(`/api/products/${id}`, { method: 'DELETE' });
                if (response.ok) {
                  fetchProducts();
                  toast.success('Product deleted');
                } else {
                  const errorData = await response.json();
                  toast.error(errorData.error || 'Failed to delete product');
                }
              } catch (err) {
                toast.error('Network error');
              }
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button 
            onClick={() => toast.dismiss(t)}
            className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleServiceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewService(prev => ({ ...prev, image_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeServiceImage = () => {
    setNewService(prev => ({ ...prev, image_url: '' }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        newImages.push(base64String);
        newPreviews.push(base64String);
        
        if (newImages.length === files.length) {
          setNewProduct(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addVariant = () => {
    setNewProduct({
      ...newProduct,
      variants: [...newProduct.variants, { size: '', color: '', quantity: '0', low_stock_threshold: '' }]
    });
  };

  const filteredProducts = products.filter(p => {
    const search = String(searchQuery || '').toLowerCase();
    const matchesSearch = String(p.name || '').toLowerCase().includes(search) ||
      String(p.supplier_name || '').toLowerCase().includes(search) ||
      String(p.category_name || '').toLowerCase().includes(search) ||
      String(p.description || '').toLowerCase().includes(search);
    
    const catFilter = searchParams.get('category');
    const matchesCategory = !catFilter || catFilter === 'all' || p.category_id?.toString() === catFilter;
    
    return matchesSearch && matchesCategory;
  });

  const filteredServices = services.filter(s => {
    const search = String(searchQuery || '').toLowerCase();
    const matchesSearch = String(s.name || '').toLowerCase().includes(search) ||
      String(s.description || '').toLowerCase().includes(search) ||
      String(s.category || '').toLowerCase().includes(search);
    return matchesSearch;
  });

  const displayItems = activeSubTab === 'products' ? filteredProducts : filteredServices;

  const totalCostValue = filteredProducts.reduce((acc, p) => {
    const cost = typeof p.cost_price === 'string' ? parseFloat(p.cost_price) || 0 : p.cost_price || 0;
    return acc + (cost * (p.total_stock || 0));
  }, 0);
  const totalSellingValue = filteredProducts.reduce((acc, p) => {
    const price = activeSubTab === 'products' ? (p as unknown as Product).selling_price : (p as unknown as Service).price;
    const selling = typeof price === 'string' ? parseFloat(price) || 0 : price || 0;
    return acc + (selling * (p.total_stock || 0));
  }, 0);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Top Tabs */}
      <div className="flex items-center gap-8 border-b border-zinc-200 dark:border-zinc-800">
        <button 
          onClick={() => setActiveTab('list')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'list' ? "text-brand" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          )}
        >
          Inventory list
          {activeTab === 'list' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-full" />}
        </button>
      </div>

      {/* Summary Cards */}
      <div className={cn(
        "grid gap-6",
        user?.role === 'staff' ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
      )}>
        {user?.role !== 'staff' && (
          <motion.div 
            whileHover={{ y: -4 }}
            className="glass-card p-8 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Package className="w-24 h-24" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Stock value @ cost price</p>
          <h3 className="h1">
              <span className="text-zinc-400 dark:text-zinc-600 mr-1 font-mono text-2xl">{currency === 'NGN' ? '₦' : currency}</span>
              {totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </motion.div>
        )}
        <motion.div 
          whileHover={{ y: -4 }}
          className="glass-card p-8 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-24 h-24" />
          </div>
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Stock value @ selling price</p>
          <h3 className="h1">
            <span className="text-zinc-400 dark:text-zinc-600 mr-1 font-mono text-2xl">{currency === 'NGN' ? '₦' : currency}</span>
            {totalSellingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </motion.div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        {/* Sub Tabs and Search */}
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
              <button 
                onClick={() => setActiveSubTab('products')}
                className={cn(
                  "pb-2 text-sm font-bold transition-all relative",
                  activeSubTab === 'products' ? "text-brand" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                )}
              >
                Products
                {activeSubTab === 'products' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />}
              </button>
              <button 
                onClick={() => setActiveSubTab('services')}
                className={cn(
                  "pb-2 text-sm font-bold transition-all relative",
                  activeSubTab === 'services' ? "text-brand" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                )}
              >
                Services
                {activeSubTab === 'services' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />}
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-3xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                <Input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative group">
                <Input 
                  as="select"
                  value={searchParams.get('category') || 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newParams = new URLSearchParams(searchParams);
                    if (val === 'all') newParams.delete('category');
                    else newParams.set('category', val);
                    setSearchParams(newParams);
                  }}
                >
                  <option value="all" className="dark:bg-zinc-900">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="dark:bg-zinc-900">{cat.name}</option>
                  ))}
                </Input>
              </div>
              {(user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_manage_products)) && (
                <button 
                  onClick={() => activeSubTab === 'products' ? openAddModal() : openAddServiceModal()}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add {activeSubTab === 'products' ? 'Product' : 'Service'}
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayItems.length > 0 ? (
          <div className="overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                    <th className="px-8 py-6 label-text">
                      {activeSubTab === 'products' ? 'Product Details' : 'Service Details'}
                    </th>
                    <th className="px-8 py-6 label-text">Category</th>
                    {activeSubTab === 'products' && (
                      <th className="px-8 py-6 label-text">Stock Status</th>
                    )}
                    <th className="px-8 py-6 label-text">Unit Price</th>
                    {activeSubTab === 'products' && (user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_view_account_data)) && (
                      <th className="px-8 py-6 label-text">Inventory Value</th>
                    )}
                    {activeSubTab === 'services' && (
                      <th className="px-8 py-6 label-text">Duration</th>
                    )}
                    {user?.role !== 'staff' && (
                      <th className="px-8 py-6 label-text text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {displayItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 overflow-hidden border border-zinc-200 dark:border-zinc-700 group-hover:border-white/20 dark:group-hover:border-black/20 transition-colors">
                            {activeSubTab === 'products' ? (
                              item.images && item.images.length > 0 ? (
                                <img src={getOptimizedImageUrl(item.images[0])} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="w-6 h-6" />
                              )
                            ) : (
                              item.image_url ? (
                                <img src={getOptimizedImageUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Briefcase className="w-6 h-6" />
                              )
                            )}
                          </div>
                          <div>
                            <p className="body-text font-bold mb-0.5">{item.name}</p>
                            {activeSubTab === 'products' && (
                              <p className="label-text">{item.supplier_name || 'No Supplier'}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="label-text px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-white/10 dark:group-hover:bg-black/10 transition-colors">
                          {activeSubTab === 'products' ? item.category_name : item.category}
                        </span>
                      </td>
                      {activeSubTab === 'products' && (
                        <td className="px-8 py-6">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                NUMBER_STYLE,
                                "text-sm",
                                (Number(item.total_stock) || 0) <= (item.low_stock_threshold !== null && item.low_stock_threshold !== undefined ? Number(item.low_stock_threshold) : (Number(settings?.low_stock_threshold) || 5)) ? "text-red-500" : ""
                              )}>
                                <NumberDisplay value={item.total_stock || 0} size="sm" />
                              </p>
                              <span className="label-text">Units</span>
                            </div>
                            {item.variants && item.variants.length > 1 && (
                              <div className="flex flex-wrap gap-1">
                                {item.variants.map((v: any, i: number) => v.quantity > 0 && (
                                  <span key={i} className="label-text px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md tracking-tighter border border-zinc-200 dark:border-zinc-700 group-hover:border-white/10 dark:group-hover:bg-black/10 transition-colors">
                                    {v.size}: {v.quantity}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-6">
                        <CurrencyDisplay amount={activeSubTab === 'products' ? item.selling_price : item.price} currencyCode={currency} size="sm" />
                      </td>
                      {activeSubTab === 'products' && user?.role !== 'staff' && (
                        <td className="px-8 py-6">
                          <CurrencyDisplay amount={(activeSubTab === 'products' ? (typeof item.selling_price === 'string' ? parseFloat(item.selling_price) : item.selling_price) || 0 : (typeof item.price === 'string' ? parseFloat(item.price) : item.price) || 0) * (item.total_stock || 0)} currencyCode={currency} size="sm" />
                        </td>
                      )}
                      {activeSubTab === 'services' && (
                        <td className="px-8 py-6">
                          <span className="text-xs font-bold opacity-70">{item.duration_minutes} mins</span>
                        </td>
                      )}
                      {user?.role !== 'staff' && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleShareWhatsApp(item)} className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all">
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => activeSubTab === 'products' ? handleEditClick(item) : handleEditService(item)} className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => activeSubTab === 'products' ? handleDeleteProduct(item.id) : handleDeleteService(item.id)} className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Grid */}
            <div className="md:hidden grid grid-cols-1 gap-4 p-4">
              {displayItems.map((item: any) => (
                <div key={item.id} className="p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                        {activeSubTab === 'products' ? (
                          item.images && item.images.length > 0 ? (
                            <img src={getOptimizedImageUrl(item.images[0])} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-6 h-6" />
                          )
                        ) : (
                          item.image_url ? (
                            <img src={getOptimizedImageUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Briefcase className="w-6 h-6" />
                          )
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">{item.name}</h4>
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{activeSubTab === 'products' ? item.category_name : item.category}</p>
                      </div>
                    </div>
                    {user?.role !== 'staff' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleShareWhatsApp(item)} className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-brand transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => activeSubTab === 'products' ? handleEditClick(item) : handleEditService(item)} className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-brand transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => activeSubTab === 'products' ? handleDeleteProduct(item.id) : handleDeleteService(item.id)} className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div>
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                        {activeSubTab === 'products' ? 'Stock' : 'Duration'}
                      </p>
                      <p className={cn(
                        "text-xs font-bold",
                        activeSubTab === 'products' && (item.total_stock || 0) <= 5 ? "text-red-600" : "text-zinc-900 dark:text-white"
                      )}>
                        {activeSubTab === 'products' ? `${item.total_stock || 0} units` : `${item.duration_minutes} mins`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Price</p>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">{formatCurrency(activeSubTab === 'products' ? item.selling_price : item.price, currency)}</p>
                    </div>
                  </div>

                  {activeSubTab === 'products' && item.variants && item.variants.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {item.variants.map((v: any, i: number) => v.quantity > 0 && (
                        <span key={i} className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg uppercase tracking-tighter">
                          {v.size}: {v.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No {activeSubTab} found</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Service Modal */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsServiceModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    {editingService ? 'Edit Service' : 'Add Service'}
                  </h3>
                  <button onClick={() => setIsServiceModalOpen(false)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                <form onSubmit={handleSaveService} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Service Image</label>
                    <div className="flex items-center gap-4">
                      {newService.image_url ? (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 group">
                          <img src={getOptimizedImageUrl(newService.image_url)} alt="Service Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={removeServiceImage}
                            className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-24 h-24 flex flex-col items-center justify-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-400 dark:text-zinc-500">
                          <Upload className="w-6 h-6" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleServiceImageUpload} 
                            className="hidden" 
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Service Name</label>
                    <Input 
                      required
                      value={newService.name}
                      onChange={(e) => setNewService({...newService, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Price ({currency === 'NGN' ? '₦' : currency})</label>
                      <Input 
                        required
                        type="number"
                        value={newService.price}
                        onChange={(e) => setNewService({...newService, price: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Category</label>
                    <Input
                      as="select"
                      value={newService.category}
                      onChange={(e) => setNewService({...newService, category: e.target.value})}
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </Input>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Description</label>
                    <Textarea 
                      value={newService.description}
                      onChange={(e) => setNewService({...newService, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-5 bg-brand text-white rounded-2xl font-bold hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-[0.98]"
                  >
                    {editingService ? 'Update Service' : 'Add Service'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSaving) {
                  closeModal();
                }
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-6xl h-full sm:h-auto sm:max-h-[90vh] bg-white dark:bg-zinc-900 sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative z-10 border border-zinc-100 dark:border-zinc-800"
            >
              {/* Header */}
              <div className="p-6 sm:p-10 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={closeModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-brand rounded-2xl text-xs sm:text-sm font-bold transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    {editingProduct ? 'Edit Product' : 'Add Product'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-brand font-bold text-[10px] sm:text-sm bg-brand/5 px-4 py-2.5 rounded-2xl border border-brand/10">
                  <span role="img" aria-label="calendar">📅</span>
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
                {/* Main Form Area */}
                <div className="flex-1 p-4 sm:p-10 bg-white dark:bg-zinc-900 order-2 lg:order-1 lg:overflow-y-auto">
                  <form onSubmit={handleAddProduct} id="product-form" className="max-w-4xl mx-auto space-y-8 sm:space-y-10">
                    {/* Basic Info Section */}
                    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8 sm:space-y-10">
                      <div className="flex flex-col md:flex-row gap-8 sm:gap-10">
                        {/* Image Upload Area */}
                        <div className="w-full md:w-48 space-y-4">
                          <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Product Image</label>
                          <div className="flex flex-wrap gap-4">
                            {imagePreviews.length > 0 ? (
                              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 group">
                                <img src={getOptimizedImageUrl(imagePreviews[0])} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button 
                                  type="button"
                                  onClick={() => removeImage(0)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-full aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl hover:border-brand dark:hover:border-brand hover:bg-brand/5 dark:hover:bg-brand/5 transition-all cursor-pointer group">
                                <ImageIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-600 group-hover:text-brand transition-colors" />
                                <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 group-hover:text-brand mt-2 uppercase tracking-widest">Upload</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleImageUpload} 
                                  className="hidden" 
                                />
                              </label>
                            )}
                          </div>
                          {imagePreviews.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                              {imagePreviews.slice(1).map((preview, idx) => (
                                <div key={idx} className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-100 group">
                                  <img src={getOptimizedImageUrl(preview)} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <button 
                                    type="button"
                                    onClick={() => removeImage(idx + 1)}
                                    className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-8 sm:space-y-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Product name</label>
                              <Input 
                                required
                                type="text" 
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                                placeholder="e.g. Vintage Denim Jacket"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Category</label>
                              <div className="relative group">
                                <Input 
                                  as="select"
                                  value={newProduct.category_id}
                                  onChange={(e) => setNewProduct({...newProduct, category_id: e.target.value})}
                                >
                                  <option value="" className="dark:bg-zinc-900">Select Category</option>
                                  {categories.map(cat => (
                                    <option key={cat.id} value={cat.id} className="dark:bg-zinc-900">{cat.name}</option>
                                  ))}
                                </Input>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 rotate-90 pointer-events-none group-hover:text-brand transition-colors" />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Select unit</label>
                              <div className="relative group">
                                <Input 
                                  as="select"
                                  value={newProduct.unit}
                                  onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                                >
                                  <option value="Pieces" className="dark:bg-zinc-900">Pieces</option>
                                  <option value="Kilograms" className="dark:bg-zinc-900">Kilograms</option>
                                </Input>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 rotate-90 pointer-events-none group-hover:text-brand transition-colors" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Supplier Name</label>
                              <Input 
                                type="text" 
                                value={newProduct.supplier_name}
                                onChange={(e) => setNewProduct({...newProduct, supplier_name: e.target.value})}
                                placeholder="e.g. Global Supplies Ltd"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">How many pieces in 1 unit?</label>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  value={newProduct.pieces_per_unit}
                                  onChange={(e) => setNewProduct({...newProduct, pieces_per_unit: e.target.value})}
                                />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Description</label>
                              <Input 
                                type="text" 
                                value={newProduct.description}
                                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                                placeholder="Short description of the product"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Product Type Section */}
                    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6 sm:space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Select product type:</label>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <button 
                            type="button"
                            onClick={() => setNewProduct({...newProduct, product_type: 'one', variants: [newProduct.variants[0] || { size: '', color: '', quantity: '0', low_stock_threshold: '' }]})}
                            className={cn(
                              "flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all border",
                              newProduct.product_type === 'one' 
                                ? "bg-brand text-white border-brand shadow-lg shadow-brand/20" 
                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600"
                            )}
                          >
                            One type
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              if (newProduct.product_type === 'multiple') return;
                              setNewProduct({
                                ...newProduct, 
                                product_type: 'multiple',
                                variants: newProduct.variants.length > 1 ? newProduct.variants : ['M', 'L', 'XL', '2X', '3X'].map(size => ({
                                  size,
                                  color: '',
                                  quantity: '0',
                                  low_stock_threshold: ''
                                }))
                              });
                              setIsBulkEditing(true);
                            }}
                            className={cn(
                              "flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all border flex items-center justify-center gap-2",
                              newProduct.product_type === 'multiple' 
                                ? "bg-brand text-white border-brand shadow-lg shadow-brand/20" 
                                : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600"
                            )}
                          >
                            {newProduct.product_type === 'multiple' && <Check className="w-4 h-4" />}
                            Multiple
                          </button>
                        </div>
                      </div>

                      {newProduct.product_type === 'one' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Initial Stock Quantity</label>
                            <Input 
                              type="number" 
                              value={newProduct.variants[0]?.quantity || '0'}
                              onChange={(e) => {
                                const updated = [...newProduct.variants];
                                if (updated.length === 0) {
                                  updated.push({ size: '', color: '', quantity: e.target.value, low_stock_threshold: '' });
                                } else {
                                  updated[0].quantity = e.target.value;
                                }
                                setNewProduct({...newProduct, variants: updated});
                              }}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Low Stock Alert at</label>
                            <Input 
                              type="number" 
                              value={newProduct.variants[0]?.low_stock_threshold !== undefined ? newProduct.variants[0].low_stock_threshold : ''}
                              onChange={(e) => {
                                const updated = [...newProduct.variants];
                                if (updated.length === 0) {
                                  updated.push({ size: '', color: '', quantity: '0', low_stock_threshold: e.target.value });
                                } else {
                                  updated[0].low_stock_threshold = e.target.value;
                                }
                                setNewProduct({...newProduct, variants: updated});
                              }}
                              placeholder="5"
                            />
                          </div>
                        </div>
                      )}

                      {newProduct.product_type === 'multiple' && (
                        <div className="space-y-6 sm:space-y-8">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-brand rounded-full"></span>
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Size & Stock</h4>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setNewProduct({
                                    ...newProduct,
                                    variants: [...newProduct.variants, { size: '', color: '', quantity: '0', low_stock_threshold: '' }]
                                  });
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand/20 transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                Add more
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                              {newProduct.variants.map((v, i) => (
                                <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 sm:p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 space-y-3 relative group">
                                  <Input 
                                    placeholder="Size"
                                    value={v.size}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].size = e.target.value;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                  />
                                  <Input 
                                    type="number"
                                    placeholder="Qty"
                                    value={v.quantity}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].quantity = e.target.value;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                  />
                                  <Input 
                                    type="number"
                                    placeholder="Low Stock Alert"
                                    value={v.low_stock_threshold}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].low_stock_threshold = e.target.value;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const updated = newProduct.variants.filter((_, idx) => idx !== i);
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="absolute -right-2 -top-2 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pricing Section */}
                    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cost Price (₦)</label>
                        <Input 
                          required
                          type="number" 
                          step="0.01"
                          value={newProduct.cost_price}
                          onChange={(e) => setNewProduct({...newProduct, cost_price: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Selling Price (₦)</label>
                        <Input 
                          required
                          type="number" 
                          step="0.01"
                          value={newProduct.selling_price}
                          onChange={(e) => setNewProduct({...newProduct, selling_price: e.target.value})}
                        />
                      </div>
                    </div>
                  </form>
                </div>

                {/* Summary Sidebar */}
                <div className="w-full lg:w-80 bg-zinc-50/50 lg:bg-white dark:bg-zinc-900/50 border-b lg:border-b-0 lg:border-l border-zinc-100 dark:border-zinc-800 p-6 sm:p-8 flex flex-col order-1 lg:order-2 shrink-0 lg:overflow-y-auto">
                  <div className="flex-1 space-y-6 sm:space-y-8">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Summary</h3>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
                      {imagePreviews.length > 0 && (
                        <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 mb-6">
                          <img src={getOptimizedImageUrl(imagePreviews[0])} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-bold text-zinc-400 dark:text-zinc-500">Product:</span>
                          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[100px] sm:max-w-[150px]">{newProduct.name || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-bold text-zinc-400 dark:text-zinc-500">Unit:</span>
                          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">{newProduct.unit}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-bold text-zinc-400 dark:text-zinc-500">Qty:</span>
                          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">{totalQuantity}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 sm:pt-8 space-y-3 sm:space-y-4">
                    <button 
                      type="submit"
                      form="product-form"
                      disabled={isSaving}
                      className="w-full py-3.5 sm:py-4 bg-brand text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
                    </button>
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="w-full py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs sm:text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-95 border border-zinc-200 dark:border-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

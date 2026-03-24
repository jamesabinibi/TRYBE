import React, { useState, useEffect } from 'react';
import ProductSelect from '../components/ProductSelect';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Maximize,
  User,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  History,
  Eye,
  X,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Package,
  FileText,
  Download,
  Calendar,
  Building2,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { Product, Variant, Sale, Customer, Service } from '../types';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { NumberDisplay } from '../components/NumberDisplay';
import { formatCurrency, cn, NUMBER_STYLE } from '../lib/utils';
import { TotalDisplay } from '../components/TotalDisplay';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { useSearch } from '../contexts/SearchContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

interface CartItem {
  type: 'product' | 'service';
  variant?: Variant;
  product?: Product;
  service?: Service;
  quantity: number;
  price_override?: number;
}

export default function Sales() {
  const { user, fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency || 'NGN';
  const { searchQuery } = useSearch();
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedSaleForPreview, setSelectedSaleForPreview] = useState<any>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [itemType, setItemType] = useState<'product' | 'service'>('product');

  const brandColor = settings?.brand_color || '#10b981';
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewAccountData = user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_view_account_data);
  const canManageSales = user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_manage_sales);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const clearCart = () => {
    if (cart.length === 0) return;
    toast.custom((t) => (
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-zinc-900 dark:text-white">
          <Trash2 className="w-5 h-5 text-red-500" />
          <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">Clear Cart?</h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">This will remove all items from your current order. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setCart([]);
              toast.dismiss(t);
              toast.success('Cart cleared');
            }}
            className="flex-1 py-3 bg-red-500 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95"
          >
            Clear All
          </button>
          <button 
            onClick={() => toast.dismiss(t)}
            className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    ));
  };

  useEffect(() => {
    if (user) {
      Promise.all([fetchProducts(), fetchServices(), fetchSales(), fetchCustomers()]);
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

  const fetchCustomers = async () => {
    try {
      const res = await fetchWithAuth('/api/customers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        console.error('Customers data is not an array:', data);
        setCustomers([]);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setCustomers([]);
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

  const fetchSales = async () => {
    try {
      const res = await fetchWithAuth('/api/sales');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSales(data);
      } else {
        console.error("Failed to fetch sales:", data);
        setSales([]);
      }
    } catch (err) {
      console.error("Error fetching sales:", err);
      setSales([]);
    }
  };

  const addToCart = (product: Product, variant: Variant) => {
    if (variant.quantity <= 0) {
      toast.error('Item out of stock');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.type === 'product' && item.variant?.id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.quantity) {
          toast.warning('Maximum stock reached');
          return prev;
        }
        return prev.map(item => 
          item.type === 'product' && item.variant?.id === variant.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      toast.success(`Added ${product.name} to cart`);
      return [...prev, { type: 'product', product, variant, quantity: 1 }];
    });
  };

  const addServiceToCart = (service: Service) => {
    setCart(prev => {
      const existing = prev.find(item => item.type === 'service' && item.service?.id === service.id);
      if (existing) {
        return prev.map(item => 
          item.type === 'service' && item.service?.id === service.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      toast.success(`Added ${service.name} to cart`);
      return [...prev, { type: 'service', service, quantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        if (item.type === 'product' && item.variant) {
          const newQty = Math.max(1, Math.min(item.variant.quantity, item.quantity + delta));
          if (newQty === item.variant.quantity && delta > 0) {
            toast.warning('Maximum stock reached');
          }
          return { ...item, quantity: newQty };
        } else {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => {
    if (item.type === 'product' && item.product && item.variant) {
      return acc + (item.price_override || item.variant.price_override || item.product.selling_price) * item.quantity;
    } else if (item.type === 'service' && item.service) {
      return acc + (item.price_override || item.service.price) * item.quantity;
    }
    return acc;
  }, 0);

  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setError(null);
    
    const checkoutPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await fetchWithAuth('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(item => {
              if (item.type === 'product') {
                return {
                  type: 'product',
                  variant_id: item.variant?.id,
                  quantity: item.quantity,
                  price_override: item.price_override
                };
              } else {
                return {
                  type: 'service',
                  service_id: item.service?.id,
                  quantity: item.quantity,
                  price_override: item.price_override
                };
              }
            }),
            payment_method: paymentMethod,
            staff_id: user?.id,
            customer_id: selectedCustomer?.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            discount_percentage: discountPercent,
            discount_amount: discountAmount
          })
        });

        if (response.ok) {
          setCart([]);
          setSelectedCustomer(null);
          fetchProducts();
          fetchSales();
          resolve(true);
        } else {
          const data = await response.json();
          reject(data.error || "Checkout failed");
        }
      } catch (e) {
        reject("Network error");
      } finally {
        setIsProcessing(false);
      }
    });

    toast.promise(checkoutPromise, {
      loading: 'Processing checkout...',
      success: 'Sale recorded successfully!',
      error: (err) => err
    });
  };

  const handlePreview = (sale: any) => {
    setSelectedSaleForPreview(sale);
  };

  const handleDownloadInvoice = (sale: any) => {
    const doc = new jsPDF();
    const brandColor = settings?.brand_color || '#10b981';
    
    doc.setFillColor(brandColor);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(settings?.business_name || 'StockFlow', 15, 25);
    
    doc.setFontSize(10);
    doc.text('INVOICE', 195, 25, { align: 'right' });
    doc.text(`#${sale.invoice_number}`, 195, 32, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Bill To:', 15, 55);
    doc.setFontSize(10);
    doc.text(sale.customer_name || 'Walk-in Customer', 15, 62);
    if (sale.customer_phone) doc.text(sale.customer_phone, 15, 67);
    if (sale.customer_email) doc.text(sale.customer_email, 15, 72);

    doc.text('Date:', 140, 62);
    doc.text(new Date(sale.created_at).toLocaleDateString(), 160, 62);

    const tableData = (sale.sale_items || []).map((item: any) => [
      item.product_name || item.service_name || 'Item',
      item.quantity.toString(),
      formatCurrency(item.unit_price || 0, currency),
      formatCurrency(item.total_price || 0, currency)
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      headStyles: { fillColor: brandColor },
      foot: [
        ['', '', 'Subtotal', formatCurrency((sale.total_amount || 0) + (sale.discount_amount || 0) - (sale.vat_amount || 0), currency)],
        ['', '', `Discount (${sale.discount_percentage}%)`, `-${formatCurrency(sale.discount_amount || 0, currency)}`],
        ['', '', 'VAT (7.5%)', formatCurrency(sale.vat_amount || 0, currency)],
        ['', '', 'Total', formatCurrency(sale.total_amount || 0, currency)]
      ],
      footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
    });

    doc.save(`invoice-${sale.invoice_number}.pdf`);
  };

  const handleAIScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAI(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const response = await fetchWithAuth('/api/ai/process-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          toast.success(`AI Extracted: ${formatCurrency(data.amount, currency)}`);
          // For now, we just show the data. In a real app, we'd add a generic "AI Sale" item to cart
          // or pre-fill the checkout amount.
          if (data.amount > 0) {
            setPaymentMethod('Bank Transfer');
            toast.info(`Narration: ${data.narration}`);
          }
        } else {
          if (data.error?.includes('API key not valid')) {
            toast.error('Invalid Gemini API Key. Please check your settings.');
          } else {
            toast.error(data.error || 'AI failed to process image');
          }
        }
      } catch (err) {
        toast.error('Network error during AI processing');
      } finally {
        setIsProcessingAI(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSale = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Confirm Deletion</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this sale? Stock will be reverted and this action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              const deletePromise = new Promise(async (resolve, reject) => {
                try {
                  const res = await fetchWithAuth(`/api/sales/${id}`, { method: 'DELETE' });
                  if (res.ok) {
                    fetchSales();
                    fetchProducts();
                    resolve(true);
                  } else {
                    const data = await res.json();
                    reject(data.error || 'Failed to delete sale');
                  }
                } catch (error) {
                  reject('Network error');
                }
              });

              toast.promise(deletePromise, {
                loading: 'Deleting sale and reverting stock...',
                success: 'Sale deleted successfully',
                error: (err) => err
              });
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button 
            onClick={() => toast.dismiss(t)}
            className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const exportPDF = () => {
    if (!filteredSales || filteredSales.length === 0) {
      toast.error('No sales data to export');
      return;
    }
    const doc = new jsPDF();
    doc.text('Sales Report', 14, 15);
    
    const tableData = (filteredSales || []).map(s => [
      s.invoice_number || 'N/A',
      s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A',
      s.staff_name || 'N/A',
      s.payment_method || 'N/A',
      formatCurrency(s.total_amount || 0, currency),
      formatCurrency(s.total_profit || 0, currency)
    ]);

    autoTable(doc, {
      head: [['Invoice', 'Date', 'Staff', 'Payment', 'Amount', 'Profit']],
      body: tableData,
      startY: 20,
    });

    doc.save('sales-report.pdf');
  };

  const exportExcel = () => {
    if (!filteredSales || filteredSales.length === 0) {
      toast.error('No sales data to export');
      return;
    }
    const data = (filteredSales || []).map(s => ({
      'Invoice #': s.invoice_number || 'N/A',
      'Date': s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A',
      'Staff': s.staff_name || 'N/A',
      'Payment': s.payment_method || 'N/A',
      'Total': s.total_amount || 0,
      'Profit': s.total_profit || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, "sales-report.xlsx");
  };

  const filteredProducts = (products || []).filter(p => {
    const search = (searchQuery || '').toLowerCase();
    return String(p.name || '').toLowerCase().includes(search) ||
           String(p.category_name || '').toLowerCase().includes(search) ||
           String(p.supplier_name || '').toLowerCase().includes(search);
  });

  const filteredServices = (services || []).filter(s => {
    const search = (searchQuery || '').toLowerCase();
    return String(s.name || '').toLowerCase().includes(search) ||
           String(s.category || '').toLowerCase().includes(search);
  });

  const filteredSales = (sales || []).filter(s => {
    const search = (historySearchQuery || '').toLowerCase();
    const matchesSearch = String(s.invoice_number || '').toLowerCase().includes(search) ||
           String(s.staff_name || '').toLowerCase().includes(search) ||
           String(s.customer_name || '').toLowerCase().includes(search) ||
           String(s.payment_method || '').toLowerCase().includes(search);

    if (!matchesSearch) return false;

    const saleDate = new Date(s.created_at);
    const now = new Date();
    
    if (dateRange === 'today') {
      return saleDate.toDateString() === now.toDateString();
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return saleDate >= weekAgo;
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return saleDate >= monthAgo;
    }
    
    return true;
  });

  return (
    <div className="flex flex-col gap-4 lg:gap-8 max-w-[1600px] mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-4 sm:gap-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0 overflow-x-auto no-scrollbar max-w-full">
        <button 
          onClick={() => setActiveTab('pos')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'pos' ? "text-brand" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          )}
        >
          Point of Sale
          {activeTab === 'pos' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'history' ? "text-brand" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
          )}
        >
          Sales History & Analytics
          {activeTab === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-brand rounded-full" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'pos' ? (
            <motion.div 
              key="pos"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8"
            >
              {/* Item Selection */}
              <div className="flex-1 flex flex-col gap-8">
                <div className="glass-card p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setItemType('product')}
                      className={cn(
                        "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                        itemType === 'product' ? "bg-brand text-white shadow-md shadow-brand/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                    >
                      Products
                    </button>
                    <button
                      onClick={() => setItemType('service')}
                      className={cn(
                        "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                        itemType === 'service' ? "bg-brand text-white shadow-md shadow-brand/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                    >
                      Services
                    </button>
                  </div>

                  {itemType === 'product' ? (
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Select Product</label>
                        <ProductSelect 
                          products={products}
                          selectedProduct={selectedProduct}
                          onSelect={setSelectedProduct}
                          formatCurrency={formatCurrency}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Select Service</label>
                      <div className="relative">
                        <select
                          value={selectedService?.id || ''}
                          onChange={(e) => {
                            const svc = services.find(s => s.id === parseInt(e.target.value));
                            setSelectedService(svc || null);
                          }}
                          className="w-full pl-4 pr-10 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-base font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Choose a service...</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Customer (Optional)</label>
                        {selectedCustomer && (
                          <span className="text-[10px] font-bold text-brand uppercase tracking-widest bg-brand/10 px-2 py-1 rounded-full">
                            {selectedCustomer.loyalty_points || 0} Points
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        <select 
                          value={selectedCustomer?.id || ''}
                          onChange={(e) => {
                            const customer = customers.find(c => c.id === parseInt(e.target.value));
                            setSelectedCustomer(customer || null);
                            if (customer) {
                              setCustomerName('');
                              setCustomerPhone('');
                            }
                          }}
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all appearance-none cursor-pointer"
                        >
                          <option value="" className="dark:bg-zinc-900">Walk-in Customer</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id} className="dark:bg-zinc-900">{c.name} ({c.phone})</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    {!selectedCustomer && (
                      <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">New Customer Name</label>
                          <input 
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Phone Number</label>
                          <input 
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="080..."
                            className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {itemType === 'product' ? (
                      selectedProduct ? (
                        <motion.div 
                          key={selectedProduct.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-8 pt-8 border-t border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <button
                                  onClick={() => setSelectedProduct(null)}
                                  className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                                  title="Back to Products"
                                >
                                  <ArrowRight className="w-5 h-5 rotate-180" />
                                </button>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{selectedProduct.name}</h2>
                              </div>
                              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1 ml-10">{selectedProduct.category_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-brand tracking-tight"><CurrencyDisplay amount={selectedProduct.selling_price} currencyCode={currency} size="xl" /></p>
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Base Price</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Pick Size & Color</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {(selectedProduct.variants || []).map((variant) => (
                                <button
                                  key={variant.id}
                                  disabled={variant.quantity <= 0}
                                  onClick={() => addToCart(selectedProduct, variant)}
                                  className={cn(
                                    "p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 text-center group relative overflow-hidden",
                                    variant.quantity > 0 
                                      ? "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:border-brand hover:bg-white dark:hover:bg-zinc-800 text-zinc-900 dark:text-white active:scale-95 shadow-sm" 
                                      : "border-zinc-50 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                                  )}
                                >
                                  <span className="text-xs font-bold uppercase tracking-widest">{variant.size}</span>
                                  {variant.color && <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">{variant.color}</span>}
                                  <span className={cn(
                                    "text-[9px] font-bold mt-2",
                                    variant.quantity > 0 ? "text-brand" : "text-zinc-300 dark:text-zinc-700"
                                  )}>
                                    {variant.quantity > 0 ? `${variant.quantity} in stock` : 'Out of stock'}
                                  </span>
                                  {variant.quantity > 0 && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="w-3 h-3 text-brand" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="py-20 text-center space-y-4">
                          <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto border border-zinc-100 dark:border-zinc-700 shadow-sm">
                            <Package className="w-10 h-10 text-zinc-200 dark:text-zinc-700" />
                          </div>
                          <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 tracking-tight">Select a product to see available sizes</p>
                        </div>
                      )
                    ) : (
                      selectedService ? (
                        <motion.div 
                          key={selectedService.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-8 pt-8 border-t border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <button
                                  onClick={() => setSelectedService(null)}
                                  className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                                  title="Back to Services"
                                >
                                  <ArrowRight className="w-5 h-5 rotate-180" />
                                </button>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{selectedService.name}</h2>
                              </div>
                              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1 ml-10">{selectedService.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-brand tracking-tight">{formatCurrency(selectedService.price, currency)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => addServiceToCart(selectedService)}
                            className="w-full py-4 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
                          >
                            Add to Cart
                          </button>
                        </motion.div>
                      ) : (
                        <div className="py-20 text-center space-y-4">
                          <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto border border-zinc-100 dark:border-zinc-700 shadow-sm">
                            <Package className="w-10 h-10 text-zinc-200 dark:text-zinc-700" />
                          </div>
                          <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 tracking-tight">Select a service to add it to the cart</p>
                        </div>
                      )
                    )}
                  </AnimatePresence>
                </div>

                {itemType === 'product' ? (
                  !selectedProduct && (
                    <div className="flex-1 pr-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {(filteredProducts || []).map((product) => (
                          <motion.button 
                            key={product.id} 
                            whileHover={{ y: -4 }}
                            onClick={() => {
                              if (product.product_type === 'one' && product.variants && product.variants.length > 0) {
                                addToCart(product, product.variants[0]);
                              } else {
                                setSelectedProduct(product);
                              }
                            }}
                            className="glass-card p-6 flex flex-col gap-4 text-left group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h4 className="font-bold text-zinc-900 dark:text-white truncate tracking-tight group-hover:text-brand transition-colors">{product.name}</h4>
                                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">{product.category_name}</p>
                              </div>
                              <span className="text-sm font-bold text-brand whitespace-nowrap">{formatCurrency(product.selling_price, currency)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{(product.variants || []).length} variants</span>
                              <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-700 group-hover:text-brand group-hover:translate-x-1 transition-all" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  !selectedService && (
                    <div className="flex-1 pr-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {(filteredServices || []).map((service) => (
                          <motion.button 
                            key={service.id} 
                            whileHover={{ y: -4 }}
                            onClick={() => setSelectedService(service)}
                            className="glass-card p-6 flex flex-col gap-4 text-left group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h4 className="font-bold text-zinc-900 dark:text-white truncate tracking-tight group-hover:text-brand transition-colors">{service.name}</h4>
                                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">{service.category}</p>
                              </div>
                              <span className="text-sm font-bold text-brand whitespace-nowrap">{formatCurrency(service.price, currency)}</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Cart & Checkout */}
              <div className="w-full lg:w-[450px] glass-card p-0 flex flex-col shadow-xl lg:shadow-2xl h-fit lg:sticky lg:top-8">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand rounded-2xl text-white shadow-lg shadow-brand/20">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-zinc-900 dark:text-white tracking-tight">Current Order</h3>
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">{cart.length} items selected</p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button 
                      onClick={clearCart}
                      className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all active:scale-90"
                      title="Clear Cart"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 p-8 space-y-8 min-h-[400px]">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 text-xs font-bold text-center">
                      {error}
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {(cart || []).map((item, index) => {
                      if (!item) return null;
                      
                      const isProduct = item.type === 'product' && item.product && item.variant;
                      const isService = item.type === 'service' && item.service;
                      
                      if (!isProduct && !isService) return null;

                      const id = isProduct ? `prod-${item.variant?.id}` : `srv-${item.service?.id}`;
                      const name = isProduct ? item.product?.name : item.service?.name;
                      const price = isProduct 
                        ? (item.price_override || item.variant?.price_override || item.product?.selling_price || 0)
                        : (item.price_override || item.service?.price || 0);

                      return (
                        <motion.div 
                          key={`${id}-${index}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center gap-4 group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate tracking-tight">{name}</p>
                            {isProduct && item.product?.product_type !== 'one' && (item.variant?.size || item.variant?.color) && (
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">
                                {item.variant.size} {item.variant.color && `· ${item.variant.color}`}
                              </p>
                            )}
                            {isService && (
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">
                                Service
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden p-1.5 border border-zinc-200 dark:border-zinc-700">
                              <button 
                                onClick={() => updateQuantity(index, -1)}
                                className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-400 transition-all active:scale-90"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-10 text-center text-sm font-bold text-zinc-900 dark:text-white">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(index, 1)}
                                className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-400 transition-all active:scale-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-right min-w-[90px]">
                              <p className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                                {formatCurrency(price * item.quantity, currency)}
                              </p>
                            </div>
                            <button 
                              onClick={() => removeFromCart(index)}
                              className="p-2.5 text-zinc-300 dark:text-zinc-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mb-8 border border-zinc-100 dark:border-zinc-700 shadow-sm">
                        <Package className="w-12 h-12 text-zinc-200 dark:text-zinc-700" />
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Your cart is empty</p>
                      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mt-2">Add products or services to start a sale</p>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                      <span className="text-xs font-bold uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-bold tracking-tight">{formatCurrency(subtotal, currency)}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Discount (%)</label>
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-24 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-right outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                        />
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex items-center justify-between text-emerald-500">
                          <span className="text-[10px] font-bold uppercase tracking-widest">Discount Amount</span>
                          <span className="text-xs font-bold">-{formatCurrency(discountAmount, currency)}</span>
                        </div>
                      )}
                    </div>
<TotalDisplay 
                      label="Total Amount" 
                      value={formatCurrency(total, currency)} 
                      direction="row"
                      labelClassName="text-sm font-bold text-zinc-950 dark:text-white uppercase tracking-widest"
                      valueClassName="text-4xl font-display font-bold text-brand tracking-tight"
                      className="pt-6 border-t border-zinc-200 dark:border-zinc-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setPaymentMethod('Cash')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95",
                        paymentMethod === 'Cash' 
                          ? "bg-white dark:bg-zinc-800 border-brand text-brand shadow-xl shadow-brand/10" 
                          : "bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                      )}
                    >
                      <Banknote className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Cash</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('Transfer')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95",
                        paymentMethod === 'Transfer' 
                          ? "bg-white dark:bg-zinc-800 border-brand text-brand shadow-xl shadow-brand/10" 
                          : "bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                      )}
                    >
                      <History className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Transfer</span>
                    </button>
                  </div>

                  {canManageSales && (
                    <button 
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || isProcessing}
                      className="w-full py-6 bg-brand hover:bg-brand-hover disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-3xl font-display font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-2xl shadow-brand/20 active:scale-[0.98]"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          Complete Checkout
                          <ArrowRight className="w-6 h-6" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10 pr-2"
            >
              {canViewAccountData && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Reports & Analytics</h1>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1">Track your business performance and export data.</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={exportExcel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Excel
                      </button>
                      <button 
                        onClick={exportPDF}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-lg shadow-zinc-200 dark:shadow-none active:scale-95"
                      >
                        <FileText className="w-4 h-4" />
                        PDF Report
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-6 group relative overflow-hidden">
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-brand/10 rounded-lg">
                              <TrendingUp className="w-4 h-4 text-brand" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+12.5%</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Total Revenue</p>
                          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                            {formatCurrency((filteredSales || []).reduce((acc, s) => acc + (s.total_amount || 0), 0), currency)}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 group relative overflow-hidden">
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+8.2%</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Total Profit</p>
                          <h3 className="text-2xl font-bold text-emerald-500 tracking-tight">
                            {formatCurrency((filteredSales || []).reduce((acc, s) => acc + (s.total_profit || 0), 0), currency)}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 group relative overflow-hidden">
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <ShoppingCart className="w-4 h-4 text-blue-500" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">Active</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Transactions</p>
                          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{filteredSales.length}</h3>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 group relative overflow-hidden">
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                              <CreditCard className="w-4 h-4 text-purple-500" />
                            </div>
                            <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">Stable</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Avg. Order Value</p>
                          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                            {formatCurrency(filteredSales.length > 0 ? (filteredSales.reduce((acc, s) => acc + (s.total_amount || 0), 0) / filteredSales.length) : 0, currency)}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="glass-card p-0 overflow-hidden border-zinc-200/50 dark:border-white/[0.02]">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-zinc-50/30 dark:bg-zinc-800/20">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white tracking-tight text-lg">Sales History</h3>
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">Real-time transaction log</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                      <input 
                        type="text"
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        placeholder="Search invoices, customers..."
                        className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all w-full sm:w-64"
                      />
                    </div>
                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1">
                      {(['today', 'week', 'month', 'all'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setDateRange(range)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                            dateRange === range 
                              ? "bg-brand text-white shadow-sm" 
                              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                          )}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-zinc-50/30 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Invoice</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Date</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Customer</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Staff</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Payment</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-right">Profit</th>
                        <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {(filteredSales || []).map((sale) => (
                        <tr key={sale.id} className="hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer">
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => handlePreview(sale)}
                              className="text-xs font-bold text-brand group-hover:text-white dark:group-hover:text-brand transition-colors tracking-widest uppercase"
                            >
                              {sale.invoice_number}
                            </button>
                          </td>
                          <td className="px-8 py-5 text-[11px] font-medium opacity-70">
                            {sale.created_at ? new Date(sale.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 dark:text-zinc-400 group-hover:bg-white/10 dark:group-hover:bg-zinc-900/10">
                                {sale.customer_name?.charAt(0) || 'W'}
                              </div>
                              <span className="text-xs font-bold">{sale.customer_name || 'Walk-in'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-[11px] font-bold opacity-80">{sale.staff_name}</td>
                          <td className="px-8 py-5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 group-hover:bg-white/10 group-hover:text-white dark:group-hover:bg-zinc-900/10 dark:group-hover:text-zinc-900">
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className={cn(NUMBER_STYLE, "px-8 py-5 text-sm text-right tracking-tighter")}>
                            {formatCurrency(sale.total_amount, currency)}
                          </td>
                          <td className={cn(NUMBER_STYLE, "px-8 py-5 text-sm text-brand text-right tracking-tighter group-hover:text-white dark:group-hover:text-brand")}>
                            {formatCurrency(sale.total_profit, currency)}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handlePreview(sale); }}
                                className="p-2 text-zinc-400 hover:text-brand group-hover:text-white dark:group-hover:text-brand transition-all active:scale-90"
                                title="View Invoice"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(sale); }}
                                className="p-2 text-zinc-400 hover:text-brand group-hover:text-white dark:group-hover:text-brand transition-all active:scale-90"
                                title="Download PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }}
                                className="p-2 text-zinc-300 dark:text-zinc-700 hover:text-red-500 group-hover:text-red-400 transition-all active:scale-90"
                                title="Delete Sale"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Sales Cards */}
                <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(filteredSales || []).map((sale) => (
                    <div key={sale.id} className="p-6 space-y-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <button 
                            onClick={() => handlePreview(sale)}
                            className="text-sm font-bold text-brand hover:underline tracking-tight"
                          >
                            {sale.invoice_number}
                          </button>
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                            {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A'} · {sale.staff_name}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {sale.payment_method}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Total Amount</p>
                          <p className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{formatCurrency(sale.total_amount, currency)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Profit</p>
                          <p className="text-lg font-bold text-brand tracking-tight">{formatCurrency(sale.total_profit, currency)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                            {sale.customer_name?.charAt(0) || 'W'}
                          </div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white">{sale.customer_name || 'Walk-in'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handlePreview(sale)}
                            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-2.5 text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl active:scale-95 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {filteredSales.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-zinc-200 dark:text-zinc-700" />
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold tracking-tight">No sales data found.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedSaleForPreview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
              >
                <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div>
                    <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight font-display">Invoice Preview</h2>
                    <p className={cn(NUMBER_STYLE, "text-zinc-400 dark:text-zinc-500 text-sm mt-1 tracking-widest uppercase")}>NO. {selectedSaleForPreview.invoice_number}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleDownloadInvoice(selectedSaleForPreview)}
                      className="flex items-center gap-3 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold text-sm transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                    >
                      <Download className="w-5 h-5" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => setSelectedSaleForPreview(null)}
                      className="p-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-2xl transition-all active:scale-95"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-12 overflow-y-auto space-y-12">
                  {/* Header Section */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="space-y-6">
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-zinc-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-2xl text-zinc-950 dark:text-white tracking-tight">{settings?.business_name || 'Business Name'}</h3>
                        <div className="mt-4 space-y-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                          {settings?.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> {settings.email}</p>}
                          {settings?.phone_number && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> {settings.phone_number}</p>}
                          {settings?.address && (
                            <p className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 opacity-50 mt-1" />
                              <span className="max-w-[240px] leading-relaxed">{settings.address}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Date Issued</p>
                        <p className="font-bold text-zinc-950 dark:text-white text-lg tracking-tight">
                          {new Date(selectedSaleForPreview.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Payment Status</p>
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                          {selectedSaleForPreview.payment_method || 'Paid'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Billed To Section */}
                  <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Billed To</p>
                    <h4 className="font-bold text-xl text-zinc-950 dark:text-white tracking-tight leading-tight">
                      {selectedSaleForPreview.customer_name || 'Walk-in Customer'}
                    </h4>
                    <div className="mt-2 space-y-1 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                      {selectedSaleForPreview.customer_email && <p>{selectedSaleForPreview.customer_email}</p>}
                      {selectedSaleForPreview.customer_phone && <p>{selectedSaleForPreview.customer_phone}</p>}
                      {selectedSaleForPreview.customer_address && <p className="max-w-[300px]">{selectedSaleForPreview.customer_address}</p>}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mt-16">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                          <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 w-1/2">Description</th>
                          <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Qty</th>
                          <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Price</th>
                          <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                        {selectedSaleForPreview.sale_items?.map((item: any, idx: number) => {
                          const name = item.product_variants?.products?.name || item.services?.name || item.product_name || item.service_name || 'Item';
                          const variant = item.product_variants ? ` (${item.product_variants.size || ''}${item.product_variants.color ? ' - ' + item.product_variants.color : ''})` : '';
                          return (
                            <tr key={idx} className="group">
                              <td className="py-8 pr-4">
                                <p className="font-bold text-zinc-950 dark:text-white text-base tracking-tight">{name}{variant}</p>
                                <p className="text-xs text-zinc-400 mt-1 font-medium">{item.service_id ? 'Service' : 'Product'}</p>
                              </td>
                              <td className="py-8 px-4 text-center">
                                <span className={cn(NUMBER_STYLE, "text-sm text-zinc-950 dark:text-white")}>
                                  {item.quantity}
                                </span>
                              </td>
                              <td className={cn(NUMBER_STYLE, "py-8 px-4 text-right text-sm text-zinc-500 dark:text-zinc-400")}>
                                {formatCurrency(item.unit_price || 0, currency)}
                              </td>
                              <td className={cn(NUMBER_STYLE, "py-8 pl-4 text-right text-zinc-950 dark:text-white text-base")}>
                                {formatCurrency(item.total_price || 0, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Section */}
                  <div className="mt-12 flex flex-col sm:flex-row justify-between items-start gap-12 pt-12 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="max-w-xs">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Note</h5>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium italic">
                        {settings?.invoice_footer || `Thank you for your business. We appreciate your trust in ${settings?.business_name || 'us'}.`}
                      </p>
                    </div>

                    <div className="w-full sm:w-80 space-y-4">
                      <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subtotal</span>
                        <span className={NUMBER_STYLE}>{formatCurrency((selectedSaleForPreview.total_amount || 0) + (selectedSaleForPreview.discount_amount || 0) - (selectedSaleForPreview.vat_amount || 0), currency)}</span>
                      </div>
                      
                      {selectedSaleForPreview.discount_amount > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Discount ({selectedSaleForPreview.discount_percentage}%)</span>
                          <span className={NUMBER_STYLE}>-{formatCurrency(selectedSaleForPreview.discount_amount, currency)}</span>
                        </div>
                      )}

                      {selectedSaleForPreview.vat_amount > 0 && (
                        <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">VAT (7.5%)</span>
                          <span className={NUMBER_STYLE}>{formatCurrency(selectedSaleForPreview.vat_amount, currency)}</span>
                        </div>
                      )}

                      <div className="pt-6 border-t-4 border-zinc-950 dark:border-white flex justify-between items-center">
                        <span className="text-sm font-black uppercase tracking-[0.3em] text-zinc-950 dark:text-white">Total</span>
                        <span className="text-4xl font-black tracking-tighter text-zinc-950 dark:text-white">
                          {formatCurrency(selectedSaleForPreview.total_amount || 0, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
        </AnimatePresence>
      </div>
    </div>
  );
}

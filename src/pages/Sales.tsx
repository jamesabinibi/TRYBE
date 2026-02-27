import React, { useState, useEffect } from 'react';
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
  Package,
  FileText,
  Download,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { Product, Variant, Sale } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useSearch } from '../contexts/SearchContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

interface CartItem {
  variant: Variant;
  product: Product;
  quantity: number;
  price_override?: number;
}

export default function Sales() {
  const { user } = useAuth();
  const { searchQuery } = useSearch();
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, []);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts);
  };

  const fetchSales = () => {
    fetch('/api/sales')
      .then(res => res.json())
      .then(setSales);
  };

  const addToCart = (product: Product, variant: Variant) => {
    if (variant.quantity <= 0) {
      toast.error('Item out of stock');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.variant.id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.quantity) {
          toast.warning('Maximum stock reached');
          return prev;
        }
        return prev.map(item => 
          item.variant.id === variant.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      toast.success(`Added ${product.name} to cart`);
      return [...prev, { product, variant, quantity: 1 }];
    });
  };

  const removeFromCart = (variantId: number) => {
    setCart(prev => prev.filter(item => item.variant.id !== variantId));
  };

  const updateQuantity = (variantId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variant.id === variantId) {
        const newQty = Math.max(1, Math.min(item.variant.quantity, item.quantity + delta));
        if (newQty === item.variant.quantity && delta > 0) {
          toast.warning('Maximum stock reached');
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => 
    acc + (item.price_override || item.variant.price_override || item.product.selling_price) * item.quantity, 0
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setError(null);
    
    const checkoutPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(item => ({
              variant_id: item.variant.id,
              quantity: item.quantity,
              price_override: item.price_override
            })),
            payment_method: paymentMethod,
            staff_id: user?.id
          })
        });

        if (response.ok) {
          setCart([]);
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
                  const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
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
      formatCurrency(s.total_amount || 0),
      formatCurrency(s.total_profit || 0)
    ]);

    (doc as any).autoTable({
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
    return (p.name || '').toLowerCase().includes(search) ||
           (p.category_name || '').toLowerCase().includes(search) ||
           (p.supplier_name || '').toLowerCase().includes(search);
  });

  const filteredSales = (sales || []).filter(s => {
    const search = (searchQuery || '').toLowerCase();
    return (s.invoice_number || '').toLowerCase().includes(search) ||
           (s.staff_name || '').toLowerCase().includes(search) ||
           (s.payment_method || '').toLowerCase().includes(search);
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-zinc-200 shrink-0">
        <button 
          onClick={() => setActiveTab('pos')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'pos' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          Point of Sale
          {activeTab === 'pos' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'history' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          Sales History & Analytics
          {activeTab === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'pos' ? (
            <motion.div 
              key="pos"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col lg:flex-row gap-6 sm:gap-8"
            >
              {/* Product Selection */}
              <div className="flex-1 flex flex-col gap-6 min-h-0">
                <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Select Product</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <select 
                        className="w-full pl-12 pr-10 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-base focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm font-bold appearance-none cursor-pointer"
                        value={selectedProduct?.id || ''}
                        onChange={(e) => {
                          const product = products.find(p => p.id === parseInt(e.target.value));
                          setSelectedProduct(product || null);
                        }}
                      >
                        <option value="">Choose a product...</option>
                        {filteredProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.selling_price)}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {selectedProduct ? (
                      <motion.div 
                        key={selectedProduct.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 pt-4 border-t border-zinc-100"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{selectedProduct.name}</h2>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{selectedProduct.category_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(selectedProduct.selling_price)}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Base Price</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pick Size & Color</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {(selectedProduct.variants || []).map((variant) => (
                              <button
                                key={variant.id}
                                disabled={variant.quantity <= 0}
                                onClick={() => addToCart(selectedProduct, variant)}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 text-center group relative overflow-hidden",
                                  variant.quantity > 0 
                                    ? "border-zinc-100 bg-zinc-50 hover:border-emerald-500 hover:bg-white text-zinc-900 active:scale-95" 
                                    : "border-zinc-50 bg-zinc-50/50 text-zinc-300 cursor-not-allowed"
                                )}
                              >
                                <span className="text-xs font-black uppercase tracking-widest">{variant.size}</span>
                                {variant.color && <span className="text-[10px] font-bold text-zinc-400">{variant.color}</span>}
                                <span className={cn(
                                  "text-[9px] font-bold mt-1",
                                  variant.quantity > 0 ? "text-emerald-500" : "text-zinc-300"
                                )}>
                                  {variant.quantity > 0 ? `${variant.quantity} in stock` : 'Out of stock'}
                                </span>
                                {variant.quantity > 0 && (
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-3 h-3 text-emerald-500" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="py-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                          <Package className="w-8 h-8 text-zinc-200" />
                        </div>
                        <p className="text-sm font-bold text-zinc-400 tracking-tight">Select a product to see available sizes</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {!selectedProduct && (
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredProducts.map((product) => (
                        <button 
                          key={product.id} 
                          onClick={() => setSelectedProduct(product)}
                          className="bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-4 hover:shadow-md hover:border-emerald-500/30 transition-all text-left group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-black text-zinc-900 truncate tracking-tight group-hover:text-emerald-600 transition-colors">{product.name}</h4>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.category_name}</p>
                            </div>
                            <span className="text-sm font-black text-emerald-600 whitespace-nowrap">{formatCurrency(product.selling_price)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.variants.length} variants</span>
                            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cart & Checkout */}
              <div className="w-full lg:w-[400px] bg-white border border-zinc-200 rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden lg:h-full">
                <div className="p-6 sm:p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 rounded-xl text-white">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-zinc-900 tracking-tight">Current Order</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{cart.length} items selected</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar min-h-[300px] lg:min-h-0">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center">
                      {error}
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <motion.div 
                        key={item.variant.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-4 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-zinc-900 truncate tracking-tight">{item.product.name}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.variant.size} {item.variant.color && `· ${item.variant.color}`}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-zinc-100 rounded-xl overflow-hidden p-1">
                            <button 
                              onClick={() => updateQuantity(item.variant.id, -1)}
                              className="p-1.5 hover:bg-white rounded-lg text-zinc-500 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-black text-zinc-900">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.variant.id, 1)}
                              className="p-1.5 hover:bg-white rounded-lg text-zinc-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className="text-sm font-black text-zinc-900 tracking-tight">
                              {formatCurrency((item.price_override || item.variant.price_override || item.product.selling_price) * item.quantity)}
                            </p>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.variant.id)}
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                        <Package className="w-10 h-10 text-zinc-200" />
                      </div>
                      <p className="text-sm font-bold text-zinc-900 tracking-tight">Your cart is empty</p>
                      <p className="text-xs font-medium text-zinc-400 mt-1">Add products to start a sale</p>
                    </div>
                  )}
                </div>

                <div className="p-6 sm:p-8 bg-zinc-50 border-t border-zinc-100 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-zinc-500">
                      <span className="text-xs font-bold uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-black tracking-tight">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-500">
                      <span className="text-xs font-bold uppercase tracking-widest">Tax (VAT 0%)</span>
                      <span className="text-sm font-black tracking-tight">₦0.00</span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                      <span className="text-sm font-black text-zinc-900 uppercase tracking-widest">Total Amount</span>
                      <span className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setPaymentMethod('Cash')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95",
                        paymentMethod === 'Cash' 
                          ? "bg-white border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/10" 
                          : "bg-transparent border-zinc-200 text-zinc-400 hover:bg-white hover:border-zinc-300"
                      )}
                    >
                      <Banknote className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('POS')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95",
                        paymentMethod === 'POS' 
                          ? "bg-white border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/10" 
                          : "bg-transparent border-zinc-200 text-zinc-400 hover:bg-white hover:border-zinc-300"
                      )}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-widest">POS</span>
                    </button>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isProcessing}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98]"
                  >
                    {isProcessing ? "Processing..." : (
                      <>
                        Complete Checkout
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 overflow-y-auto h-full pr-2 custom-scrollbar"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Reports & Analytics</h1>
                  <p className="text-zinc-500 font-medium">Track your business performance and export data.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={exportExcel}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Excel
                  </button>
                  <button 
                    onClick={exportPDF}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
                  >
                    <FileText className="w-4 h-4" />
                    PDF Report
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Revenue</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
                      {formatCurrency((filteredSales || []).reduce((acc, s) => acc + (s.total_amount || 0), 0))}
                    </h3>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
                </div>
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Profit</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                      {formatCurrency((filteredSales || []).reduce((acc, s) => acc + (s.total_profit || 0), 0))}
                    </h3>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50/30 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
                </div>
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200 shadow-sm relative overflow-hidden group sm:col-span-2 lg:col-span-1">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Transactions</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">{filteredSales.length}</h3>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-zinc-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
                  <div>
                    <h3 className="font-black text-zinc-900 tracking-tight text-lg">Sales History</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Detailed transaction log</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 shadow-sm">
                      <Calendar className="w-3.5 h-3.5" />
                      This Month
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-zinc-50/30 border-b border-zinc-100">
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Invoice</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Staff</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Payment</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Profit</th>
                        <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-8 py-5 text-sm font-black text-zinc-900 tracking-tight">{sale.invoice_number}</td>
                          <td className="px-8 py-5 text-sm text-zinc-500 font-medium">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-8 py-5 text-sm text-zinc-600 font-bold">{sale.staff_name}</td>
                          <td className="px-8 py-5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-600">
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-sm font-black text-zinc-900 text-right tracking-tight">
                            {formatCurrency(sale.total_amount)}
                          </td>
                          <td className="px-8 py-5 text-sm font-black text-emerald-600 text-right tracking-tight">
                            {formatCurrency(sale.total_profit)}
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button 
                              onClick={() => handleDeleteSale(sale.id)}
                              className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {filteredSales.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-zinc-200" />
                    </div>
                    <p className="text-zinc-500 font-bold tracking-tight">No sales data found.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

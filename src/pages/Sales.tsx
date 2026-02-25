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
  Package
} from 'lucide-react';
import { Product, Variant } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useSearch } from '../contexts/SearchContext';

interface CartItem {
  variant: Variant;
  product: Product;
  quantity: number;
  price_override?: number;
}

export default function Sales() {
  const { user } = useAuth();
  const { searchQuery } = useSearch();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts);
  }, []);

  const addToCart = (product: Product, variant: Variant) => {
    if (variant.quantity <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.variant.id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.quantity) return prev;
        return prev.map(item => 
          item.variant.id === variant.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
    // Optional: Reset selection after adding to cart
    // setSelectedProduct(null);
  };

  const removeFromCart = (variantId: number) => {
    setCart(prev => prev.filter(item => item.variant.id !== variantId));
  };

  const updateQuantity = (variantId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variant.id === variantId) {
        const newQty = Math.max(1, Math.min(item.variant.quantity, item.quantity + delta));
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
        // Refresh products to update stock
        fetch('/api/products').then(res => res.json()).then(setProducts);
        alert("Sale recorded successfully!");
      } else {
        const data = await response.json();
        setError(data.error || "Checkout failed. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 sm:gap-8 overflow-hidden">
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
                    {selectedProduct.variants.map((variant) => (
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

        {/* Quick Search List (Optional, but user said "list or dropdown") */}
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
    </div>
  );
}

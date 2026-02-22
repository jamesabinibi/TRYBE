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

interface CartItem {
  variant: Variant;
  product: Product;
  quantity: number;
  price_override?: number;
}

export default function Sales() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isProcessing, setIsProcessing] = useState(false);

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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 sm:gap-8 overflow-hidden">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search products by name or SKU..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-base focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm font-bold"
            />
          </div>
          <button className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>
            Scan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start custom-scrollbar">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-black text-zinc-900 truncate tracking-tight">{product.name}</h4>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.category_name}</p>
                </div>
                <span className="text-sm font-black text-emerald-600 whitespace-nowrap">{formatCurrency(product.selling_price)}</span>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Available Variants</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      disabled={variant.quantity <= 0}
                      onClick={() => addToCart(product, variant)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex flex-col items-center gap-0.5 min-w-[80px]",
                        variant.quantity > 0 
                          ? "border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50 text-zinc-700 active:scale-95" 
                          : "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
                      )}
                    >
                      <span>{variant.size} {variant.color && `- ${variant.color}`}</span>
                      <span className="text-[9px] opacity-60 font-bold">{variant.quantity} in stock</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
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

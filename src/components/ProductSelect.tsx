import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Package } from 'lucide-react';
import { cn } from '../lib/utils';
import { Product } from '../types';

interface ProductSelectProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelect: (product: Product | null) => void;
  formatCurrency: (amount: number) => string;
}

export default function ProductSelect({ products, selectedProduct, onSelect, formatCurrency }: ProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredProducts = (products || []).filter(p => 
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full pl-4 pr-10 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-base focus-within:ring-4 focus-within:ring-brand/10 focus-within:border-brand outline-none transition-all shadow-sm font-bold cursor-pointer flex items-center gap-3",
          isOpen && "border-brand ring-4 ring-brand/10"
        )}
      >
        <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <div className="flex-1 truncate">
          {selectedProduct ? (
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
              {selectedProduct.images && selectedProduct.images.length > 0 ? (
                <img src={selectedProduct.images[0]} alt="" className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <Package className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                </div>
              )}
              <span>{selectedProduct.name} - {formatCurrency(selectedProduct.selling_price)}</span>
            </div>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">Choose a product...</span>
          )}
        </div>
        <ChevronDown className={cn("w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelect(product);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors",
                    selectedProduct?.id === product.id && "bg-brand/5 dark:bg-brand/10"
                  )}
                >
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest truncate">{product.category_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand">{formatCurrency(product.selling_price)}</p>
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      {product.variants?.reduce((acc, v) => acc + (v.quantity || 0), 0) || 0} in stock
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Package className="w-8 h-8 text-zinc-200 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-400 dark:text-zinc-500 font-medium">No products found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

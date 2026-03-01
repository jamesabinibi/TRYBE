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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(search.toLowerCase())
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
          "w-full pl-4 pr-10 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-base focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 outline-none transition-all shadow-sm font-bold cursor-pointer flex items-center gap-3",
          isOpen && "border-emerald-500 ring-4 ring-emerald-500/10"
        )}
      >
        <Search className="w-5 h-5 text-zinc-400 shrink-0" />
        <div className="flex-1 truncate">
          {selectedProduct ? (
            <div className="flex items-center gap-2">
              {selectedProduct.images && selectedProduct.images.length > 0 ? (
                <img src={selectedProduct.images[0]} alt="" className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded-md bg-zinc-200 flex items-center justify-center">
                  <Package className="w-3 h-3 text-zinc-400" />
                </div>
              )}
              <span>{selectedProduct.name} - {formatCurrency(selectedProduct.selling_price)}</span>
            </div>
          ) : (
            <span className="text-zinc-400">Choose a product...</span>
          )}
        </div>
        <ChevronDown className={cn("w-5 h-5 text-zinc-400 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-zinc-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                    "flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors",
                    selectedProduct?.id === product.id && "bg-emerald-50"
                  )}
                >
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{product.name}</p>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{product.category_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600">{formatCurrency(product.selling_price)}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {product.variants?.reduce((acc, v) => acc + v.quantity, 0) || 0} in stock
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Package className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-sm text-zinc-400 font-medium">No products found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ChevronRight,
  Package,
  AlertCircle,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { Product, Category } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [newProduct, setNewProduct] = useState<{
    name: string;
    category_id: string;
    description: string;
    cost_price: string;
    selling_price: string;
    supplier_name: string;
    variants: { size: string; color: string; quantity: number; low_stock_threshold: number; price_override?: number }[];
    images: string[];
  }>({
    name: '',
    category_id: '',
    description: '',
    cost_price: '',
    selling_price: '',
    supplier_name: '',
    variants: [{ size: '', color: '', quantity: 0, low_stock_threshold: 5 }],
    images: []
  });

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts);
  };

  const fetchCategories = () => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          cost_price: parseFloat(newProduct.cost_price) || 0,
          selling_price: parseFloat(newProduct.selling_price) || 0,
          category_id: parseInt(newProduct.category_id) || null
        })
      });
      
      if (response.ok) {
        setIsAddModalOpen(false);
        setEditingProduct(null);
        fetchProducts();
        setNewProduct({
          name: '',
          category_id: '',
          description: '',
          cost_price: '',
          selling_price: '',
          supplier_name: '',
          variants: [{ size: '', color: '', quantity: 0, low_stock_threshold: 5 }],
          images: []
        });
        setImagePreviews([]);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save product'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      category_id: product.category_id.toString(),
      description: product.description,
      cost_price: product.cost_price.toString(),
      selling_price: product.selling_price.toString(),
      supplier_name: product.supplier_name,
      variants: product.variants.map(v => ({
        size: v.size,
        color: v.color,
        quantity: v.quantity,
        low_stock_threshold: v.low_stock_threshold,
        price_override: v.price_override
      })),
      images: product.images || []
    });
    setImagePreviews(product.images || []);
    setIsAddModalOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product? This will remove all variants and images.')) return;
    
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchProducts();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete product'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred');
    }
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
      variants: [...newProduct.variants, { size: '', color: '', quantity: 0, low_stock_threshold: 5 }]
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Product Management</h1>
          <p className="text-zinc-500 font-medium">Manage your inventory and product variants.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white p-4 rounded-[2rem] border border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search by name, SKU, or supplier..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border-transparent rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 border-b border-zinc-200">
              <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product</th>
              <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</th>
              <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock</th>
              <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Price</th>
              <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 overflow-hidden border border-zinc-200 group-hover:scale-105 transition-transform">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 tracking-tight">{product.name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.supplier_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-600">
                    {product.category_name}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-bold tracking-tight",
                      product.total_stock <= 5 ? "text-red-600" : "text-zinc-900"
                    )}>
                      {product.total_stock} units
                    </span>
                    {product.total_stock <= 5 && (
                      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                    )}
                  </div>
                </td>
                <td className="px-8 py-5 text-sm text-zinc-900 font-black tracking-tight">
                  {formatCurrency(product.selling_price)}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleEditClick(product)}
                      className="p-2.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Cards */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 overflow-hidden border border-zinc-200">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-zinc-900 truncate tracking-tight">{product.name}</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.category_name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Stock</p>
                <p className={cn(
                  "text-sm font-bold tracking-tight",
                  product.total_stock <= 5 ? "text-red-600" : "text-zinc-900"
                )}>{product.total_stock} units</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Price</p>
                <p className="text-sm font-black text-zinc-900 tracking-tight">{formatCurrency(product.selling_price)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.supplier_name}</p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEditClick(product)}
                  className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl active:scale-90 transition-transform"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteProduct(product.id)}
                  className="p-2.5 bg-red-50 text-red-600 rounded-xl active:scale-90 transition-transform"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-zinc-200 border-dashed">
          <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-zinc-200" />
          </div>
          <p className="text-zinc-500 font-bold tracking-tight">No products found matching your search.</p>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSaving) {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Product Details & Inventory</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="p-3 hover:bg-zinc-200/50 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Product Name</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      placeholder="e.g. Wireless Headphones"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Category</label>
                    <select 
                      required
                      value={newProduct.category_id}
                      onChange={(e) => setNewProduct({...newProduct, category_id: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Product Images</label>
                  <div className="flex flex-wrap gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-[1.5rem] overflow-hidden border-2 border-zinc-100 group shadow-sm">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-[1.5rem] hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                      <Plus className="w-6 h-6 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                      <span className="text-[10px] font-black text-zinc-300 group-hover:text-emerald-500 mt-1 uppercase tracking-widest">Upload</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all h-28 resize-none"
                    placeholder="Tell us more about this product..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cost Price (₦)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={newProduct.cost_price}
                      onChange={(e) => setNewProduct({...newProduct, cost_price: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Selling Price (₦)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={newProduct.selling_price}
                      onChange={(e) => setNewProduct({...newProduct, selling_price: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Supplier</label>
                    <input 
                      type="text" 
                      value={newProduct.supplier_name}
                      onChange={(e) => setNewProduct({...newProduct, supplier_name: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-100 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Supplier name"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Variants & Stock</label>
                      <p className="text-[10px] font-bold text-zinc-400 mt-0.5">Define sizes, colors and stock levels</p>
                    </div>
                    <button 
                      type="button"
                      onClick={addVariant}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      Add Variant
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newProduct.variants.map((v, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-100 relative group/variant">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Size</label>
                          <input 
                            placeholder="e.g. XL"
                            value={v.size}
                            onChange={(e) => {
                              const updated = [...newProduct.variants];
                              updated[i].size = e.target.value;
                              setNewProduct({...newProduct, variants: updated});
                            }}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Color</label>
                          <input 
                            placeholder="e.g. Black"
                            value={v.color}
                            onChange={(e) => {
                              const updated = [...newProduct.variants];
                              updated[i].color = e.target.value;
                              setNewProduct({...newProduct, variants: updated});
                            }}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Quantity</label>
                          <input 
                            type="number"
                            placeholder="0"
                            value={v.quantity}
                            onChange={(e) => {
                              const updated = [...newProduct.variants];
                              updated[i].quantity = parseInt(e.target.value) || 0;
                              setNewProduct({...newProduct, variants: updated});
                            }}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Low Alert</label>
                          <input 
                            type="number"
                            placeholder="5"
                            value={v.low_stock_threshold}
                            onChange={(e) => {
                              const updated = [...newProduct.variants];
                              updated[i].low_stock_threshold = parseInt(e.target.value) || 5;
                              setNewProduct({...newProduct, variants: updated});
                            }}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        {newProduct.variants.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = newProduct.variants.filter((_, idx) => idx !== i);
                              setNewProduct({...newProduct, variants: updated});
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-zinc-200 text-zinc-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover/variant:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
              <div className="p-6 sm:p-8 bg-zinc-50/80 backdrop-blur-sm border-t border-zinc-100 flex gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 rounded-[1.5rem] text-sm font-bold hover:bg-white transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const form = document.querySelector('form');
                    form?.requestSubmit();
                  }}
                  disabled={isSaving}
                  className="flex-[2] px-6 py-4 bg-emerald-600 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

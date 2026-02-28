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
  X,
  Check
} from 'lucide-react';
import { Product, Category } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useSearch } from '../contexts/SearchContext';
import { toast } from 'sonner';

const getInitialProductState = () => ({
  name: '',
  category_id: '',
  description: '',
  cost_price: '',
  selling_price: '',
  supplier_name: '',
  unit: 'Pieces',
  pieces_per_unit: 1,
  product_type: 'one' as const,
  variants: [{ size: '', color: '', quantity: 0, low_stock_threshold: 5 }],
  images: []
});

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  const totalQuantity = newProduct.variants.reduce((acc, v) => acc + (v.quantity || 0), 0);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          console.error("Failed to fetch products:", data);
          setProducts([]);
        }
      })
      .catch(err => {
        console.error("Error fetching products:", err);
        setProducts([]);
      });
  };

  const fetchCategories = () => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          console.error("Failed to fetch categories:", data);
          setCategories([]);
        }
      })
      .catch(err => {
        console.error("Error fetching categories:", err);
        setCategories([]);
      });
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
        variants: newProduct.variants,
        images: newProduct.images
      };

      const response = await fetch(url, {
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
      pieces_per_unit: (product as any).pieces_per_unit || 1,
      product_type: (product as any).product_type || (product.variants?.length > 1 ? 'multiple' : 'one'),
      variants: (product.variants || []).map(v => ({
        size: v.size || '',
        color: v.color || '',
        quantity: v.quantity || 0,
        low_stock_threshold: v.low_stock_threshold || 5,
        price_override: v.price_override
      })),
      images: product.images || []
    });
    setImagePreviews(product.images || []);
    setIsAddModalOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Confirm Deletion</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this product? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
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
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.supplier_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.category_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const totalCostValue = products.reduce((acc, p) => acc + ((p.cost_price || 0) * (p.total_stock || 0)), 0);
  const totalSellingValue = products.reduce((acc, p) => acc + ((p.selling_price || 0) * (p.total_stock || 0)), 0);

  return (
    <div className="space-y-8">
      {/* Top Tabs */}
      <div className="flex items-center gap-8 border-b border-zinc-200">
        <button 
          onClick={() => setActiveTab('list')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'list' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          Inventory list
          {activeTab === 'list' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-sm text-zinc-500 font-medium mb-4">Stock value @ cost price</p>
          <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{formatCurrency(totalCostValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-sm text-zinc-500 font-medium mb-4">Stock value @ selling price</p>
          <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{formatCurrency(totalSellingValue)}</h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
        {/* Sub Tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveSubTab('products')}
              className={cn(
                "pb-2 text-sm font-bold transition-all relative",
                activeSubTab === 'products' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Products
              {activeSubTab === 'products' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveSubTab('services')}
              className={cn(
                "pb-2 text-sm font-bold transition-all relative",
                activeSubTab === 'services' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Services
              {activeSubTab === 'services' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />}
            </button>
          </div>
          
          <div className="flex flex-1 max-w-md items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
              />
            </div>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
              Sort <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Price</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Value</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 overflow-hidden border border-zinc-200">
                          {product.images && product.images.length > 0 ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 tracking-tight">{product.name}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.supplier_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className="text-xs font-bold text-zinc-600">{product.category_name}</span>
                    </td>
                    <td className="py-5">
                      <div className="space-y-1">
                        <p className={cn(
                          "text-sm font-bold tracking-tight",
                          product.total_stock <= 5 ? "text-red-600" : "text-zinc-900"
                        )}>
                          {product.total_stock} units
                        </p>
                        {product.variants && product.variants.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {product.variants.map((v, i) => v.quantity > 0 && (
                              <span key={i} className="text-[9px] font-black px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded-md uppercase tracking-tighter">
                                {v.size}: {v.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-5 text-sm text-zinc-900 font-black tracking-tight">
                      {formatCurrency(product.selling_price)}
                    </td>
                    <td className="py-5 text-sm text-zinc-900 font-black tracking-tight">
                      {formatCurrency(product.selling_price * product.total_stock)}
                    </td>
                    <td className="py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditClick(product)} className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-64 h-64 mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-emerald-50 rounded-full opacity-50 blur-3xl" />
              <div className="relative bg-white rounded-3xl p-8 shadow-xl border border-zinc-100">
                <div className="space-y-4">
                  <div className="h-4 bg-zinc-100 rounded-full w-3/4" />
                  <div className="h-4 bg-zinc-100 rounded-full w-1/2" />
                  <div className="h-4 bg-zinc-100 rounded-full w-2/3" />
                  <div className="pt-4 flex justify-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                      <Package className="w-8 h-8 text-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-black text-zinc-900 mb-2">Add all your products</h3>
            <p className="text-zinc-400 font-medium mb-8">Start by adding your first product in seconds</p>
            <button 
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Add product
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSaving) {
                  closeModal();
                }
              }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-6xl bg-white sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={closeModal}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 text-emerald-600 rounded-full text-sm font-bold transition-all border border-zinc-200"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Back
                  </button>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight">
                    {editingProduct ? 'Edit Product' : 'Add Product'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-zinc-50 px-4 py-2 rounded-xl">
                  <span role="img" aria-label="calendar">📅</span>
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Main Form Area */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-white">
                  <form onSubmit={handleAddProduct} id="product-form" className="max-w-4xl mx-auto space-y-10">
                    {/* Basic Info Section */}
                    <div className="bg-white p-8 rounded-xl border border-zinc-100 shadow-sm space-y-10">
                      <div className="flex flex-col md:flex-row gap-10">
                        {/* Image Upload Area */}
                        <div className="w-full md:w-48 space-y-4">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product Image</label>
                          <div className="flex flex-wrap gap-4">
                            {imagePreviews.length > 0 ? (
                              <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-zinc-200 group">
                                <img src={imagePreviews[0]} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button 
                                  type="button"
                                  onClick={() => removeImage(0)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-full aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                                <ImageIcon className="w-8 h-8 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                                <span className="text-[10px] font-black text-zinc-300 group-hover:text-emerald-500 mt-2 uppercase tracking-widest">Upload</span>
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
                                  <img src={preview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <button 
                                    type="button"
                                    onClick={() => removeImage(idx + 1)}
                                    className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product name</label>
                              <input 
                                required
                                type="text" 
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                                className="w-full px-0 py-2 bg-transparent border-b border-zinc-200 text-lg font-bold focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-300"
                                placeholder="e.g. Vintage Denim Jacket"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select unit</label>
                              <div className="relative group">
                                <select 
                                  value={newProduct.unit}
                                  onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none appearance-none cursor-pointer"
                                >
                                  <option value="Pieces">Pieces</option>
                                  <option value="Kilograms">Kilograms</option>
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 rotate-90 pointer-events-none group-hover:text-emerald-500 transition-colors" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 max-w-xs">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">How many pieces in 1 unit?</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                value={newProduct.pieces_per_unit}
                                onChange={(e) => setNewProduct({...newProduct, pieces_per_unit: parseInt(e.target.value) || 1})}
                                className="w-full px-0 py-2 bg-transparent border-b border-zinc-200 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
                              />
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-zinc-300 flex items-center justify-center text-[10px] text-zinc-400 font-bold cursor-help">i</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Product Type Section */}
                    <div className="bg-white p-8 rounded-xl border border-zinc-100 shadow-sm space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select product type:</label>
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setNewProduct({...newProduct, product_type: 'one'})}
                            className={cn(
                              "px-6 py-2 rounded-full text-sm font-bold transition-all border",
                              newProduct.product_type === 'one' 
                                ? "bg-white border-emerald-500 text-emerald-600" 
                                : "bg-white border-zinc-200 text-zinc-400"
                            )}
                          >
                            One type
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              const defaultVariants = ['M', 'L', 'XL', '2X', '3X'].map(size => ({
                                size,
                                color: '',
                                quantity: 0,
                                low_stock_threshold: 5
                              }));
                              setNewProduct({
                                ...newProduct, 
                                product_type: 'multiple',
                                variants: defaultVariants
                              });
                              setIsBulkEditing(true); // Always show grid for multiple
                            }}
                            className={cn(
                              "px-6 py-2 rounded-full text-sm font-bold transition-all border flex items-center gap-2",
                              newProduct.product_type === 'multiple' 
                                ? "bg-white border-emerald-500 text-emerald-600" 
                                : "bg-white border-zinc-200 text-zinc-400"
                            )}
                          >
                            {newProduct.product_type === 'multiple' && <Check className="w-4 h-4" />}
                            Multiple
                          </button>
                        </div>
                      </div>

                      {newProduct.product_type === 'multiple' && (
                        <div className="space-y-8">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                <h4 className="text-sm font-black text-zinc-900">Size & Stock</h4>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setNewProduct({
                                    ...newProduct,
                                    variants: [...newProduct.variants, { size: '', color: '', quantity: 0, low_stock_threshold: 5 }]
                                  });
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                Add more
                              </button>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-4 gap-4 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                <div>Size</div>
                                <div>Color</div>
                                <div>Quantity</div>
                                <div>Alert</div>
                              </div>
                              {newProduct.variants.map((v, i) => (
                                <div key={i} className="grid grid-cols-4 gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100 relative group">
                                  <input 
                                    value={v.size}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].size = e.target.value;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="bg-transparent border-b border-zinc-200 text-xs font-bold outline-none focus:border-emerald-500"
                                    placeholder="Size"
                                  />
                                  <input 
                                    value={v.color}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].color = e.target.value;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="bg-transparent border-b border-zinc-200 text-xs font-bold outline-none focus:border-emerald-500"
                                    placeholder="Color"
                                  />
                                  <input 
                                    type="number"
                                    value={v.quantity}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].quantity = parseInt(e.target.value) || 0;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="bg-transparent border-b border-zinc-200 text-xs font-bold outline-none focus:border-emerald-500"
                                  />
                                  <input 
                                    type="number"
                                    value={v.low_stock_threshold}
                                    onChange={(e) => {
                                      const updated = [...newProduct.variants];
                                      updated[i].low_stock_threshold = parseInt(e.target.value) || 5;
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="bg-transparent border-b border-zinc-200 text-xs font-bold outline-none focus:border-emerald-500"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const updated = newProduct.variants.filter((_, idx) => idx !== i);
                                      setNewProduct({...newProduct, variants: updated});
                                    }}
                                    className="absolute -right-2 -top-2 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
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
                    <div className="bg-white p-8 rounded-xl border border-zinc-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cost Price (₦)</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          value={newProduct.cost_price}
                          onChange={(e) => setNewProduct({...newProduct, cost_price: e.target.value})}
                          className="w-full px-0 py-2 bg-transparent border-b border-zinc-200 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selling Price (₦)</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          value={newProduct.selling_price}
                          onChange={(e) => setNewProduct({...newProduct, selling_price: e.target.value})}
                          className="w-full px-0 py-2 bg-transparent border-b border-zinc-200 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </form>
                </div>

                {/* Summary Sidebar */}
                <div className="w-full lg:w-80 bg-white border-l border-zinc-100 p-8 flex flex-col">
                  <div className="flex-1 space-y-8">
                    <h3 className="text-lg font-black text-zinc-900 tracking-tight">Summary</h3>
                    
                    <div className="space-y-6">
                      {imagePreviews.length > 0 && (
                        <div className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-100 mb-6">
                          <img src={imagePreviews[0]} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-400">Product:</span>
                        <span className="text-sm font-black text-zinc-900 truncate max-w-[150px]">{newProduct.name || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-400">Unit:</span>
                        <span className="text-sm font-black text-zinc-900">{newProduct.unit}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-400">Qty:</span>
                        <span className="text-sm font-black text-zinc-900">{totalQuantity || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 space-y-4">
                    <button 
                      type="submit"
                      form="product-form"
                      disabled={isSaving}
                      className="w-full py-4 bg-emerald-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
                    </button>
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="w-full py-4 bg-zinc-50 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-100 transition-all active:scale-95 border border-zinc-200"
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

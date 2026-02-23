import React, { useState, useEffect } from 'react';
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

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
      // Remove the param so it doesn't re-open on every render or navigation back
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'count'>('list');
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'services'>('products');
  
  // Form State
  const [newProduct, setNewProduct] = useState<{
    name: string;
    category_id: string;
    description: string;
    cost_price: string;
    selling_price: string;
    supplier_name: string;
    unit: string;
    pieces_per_unit: number;
    product_type: 'one' | 'multiple';
    variants: { size: string; color: string; quantity: number; low_stock_threshold: number; price_override?: number }[];
    images: string[];
  }>({
    name: '',
    category_id: '',
    description: '',
    cost_price: '',
    selling_price: '',
    supplier_name: '',
    unit: 'Pieces',
    pieces_per_unit: 1,
    product_type: 'one',
    variants: [{ size: '', color: '', quantity: 0, low_stock_threshold: 5 }],
    images: []
  });

  const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const totalQuantity = newProduct.variants.reduce((acc, v) => acc + (v.quantity || 0), 0);

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
      unit: (product as any).unit || 'Pieces',
      pieces_per_unit: (product as any).pieces_per_unit || 1,
      product_type: (product as any).product_type || (product.variants.length > 1 ? 'multiple' : 'one'),
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

  const totalCostValue = products.reduce((acc, p) => acc + (p.cost_price * p.total_stock), 0);
  const totalSellingValue = products.reduce((acc, p) => acc + (p.selling_price * p.total_stock), 0);

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
        <button 
          onClick={() => setActiveTab('count')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            activeTab === 'count' ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          Inventory count
          {activeTab === 'count' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-full" />}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-sm text-zinc-500 font-medium mb-4">Stock value @ cost price</p>
          <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{formatCurrency(totalCostValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-sm text-zinc-500 font-medium mb-4">Stock value @ selling price</p>
          <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{formatCurrency(totalSellingValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500 font-medium mb-4">Review prices</p>
            <h3 className="text-3xl font-black text-zinc-400 tracking-tight">-</h3>
          </div>
          <button className="flex items-center gap-1 text-emerald-600 text-xs font-bold hover:underline">
            Review <ChevronRight className="w-4 h-4" />
          </button>
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
                      <p className={cn(
                        "text-sm font-bold tracking-tight",
                        product.total_stock <= 5 ? "text-red-600" : "text-zinc-900"
                      )}>{product.total_stock} units</p>
                    </td>
                    <td className="py-5 text-sm text-zinc-900 font-black tracking-tight">
                      {formatCurrency(product.selling_price)}
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
              onClick={() => setIsAddModalOpen(true)}
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
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
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
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingProduct(null);
                    }}
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
                          <div className="relative">
                            <select 
                              value={newProduct.unit}
                              onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                              className="w-full px-0 py-2 bg-transparent border-b border-zinc-200 text-lg font-bold focus:border-emerald-500 outline-none transition-all appearance-none"
                            >
                              <option value="Pieces">Pieces</option>
                              <option value="Dozens">Dozens</option>
                              <option value="Boxes">Boxes</option>
                              <option value="Kilograms">Kilograms</option>
                            </select>
                            <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 rotate-90 pointer-events-none" />
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
                            onClick={() => setNewProduct({...newProduct, product_type: 'multiple'})}
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
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                              <h4 className="text-sm font-black text-zinc-900">Size</h4>
                            </div>
                            
                            <div className="flex flex-wrap gap-3 items-center">
                              {newProduct.variants.filter(v => v.size).map((v, i) => (
                                <div key={i} className="px-4 py-2 bg-zinc-50 text-zinc-600 rounded-xl text-xs font-bold border border-zinc-100">
                                  {v.size}
                                </div>
                              ))}
                              <div className="flex items-center gap-2 ml-auto">
                                <button type="button" className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button type="button" className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <button 
                              type="button"
                              onClick={() => {
                                const sizes = ['S', 'M', 'L', 'XL'];
                                const newVariants = sizes.map(s => ({
                                  size: s,
                                  color: '',
                                  quantity: 0,
                                  low_stock_threshold: 5
                                }));
                                setNewProduct(prev => ({
                                  ...prev,
                                  variants: [...prev.variants, ...newVariants]
                                }));
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-50/50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              Add more
                            </button>
                          </div>

                          <div className="pt-8 border-t border-zinc-50 flex items-center justify-between">
                            <h4 className="text-sm font-black text-zinc-900">Manage product types</h4>
                            <div className="relative">
                              <button 
                                type="button"
                                className="px-6 py-2 border border-emerald-500 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all"
                              >
                                Bulk edit
                              </button>
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-200 rounded-full border-2 border-white"></span>
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
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-400">Product:</span>
                        <span className="text-sm font-black text-zinc-900">{newProduct.name || '-'}</span>
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
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setEditingProduct(null);
                      }}
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

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Tag, Bell, Shield, Globe, Database } from 'lucide-react';
import { Category } from '../types';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories);
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory) return;
    
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory })
    });
    
    if (response.ok) {
      setNewCategory('');
      fetch('/api/categories').then(res => res.json()).then(setCategories);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Settings</h1>
        <p className="text-zinc-500 font-medium">Configure your business preferences and system settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-1">
          <h3 className="font-black text-zinc-900 tracking-tight">Product Categories</h3>
          <p className="text-sm text-zinc-500 font-medium">Manage the categories used to organize your inventory.</p>
        </div>
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-8">
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="New category name..." 
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
            />
            <button 
              type="submit"
              className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Add
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c.id} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 border border-zinc-200/50">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-zinc-200">
        <div className="space-y-1">
          <h3 className="font-black text-zinc-900 tracking-tight">Business Profile</h3>
          <p className="text-sm text-zinc-500 font-medium">Update your business information and tax settings.</p>
        </div>
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Business Name</label>
              <input type="text" defaultValue="StockFlow Pro Demo" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Currency</label>
              <select className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none">
                <option>NGN (₦)</option>
                <option>USD ($)</option>
                <option>EUR (€)</option>
                <option>GBP (£)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-900 uppercase tracking-widest">VAT Enabled</p>
                <p className="text-xs text-emerald-700 font-medium">Apply 0% tax to all sales by default.</p>
              </div>
            </div>
            <div className="w-14 h-8 bg-emerald-500 rounded-full relative cursor-pointer shadow-inner">
              <div className="absolute right-1 top-1 w-6 h-6 bg-white rounded-full shadow-md"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

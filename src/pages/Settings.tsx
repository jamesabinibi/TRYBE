import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Tag, Bell, Shield, Globe, Database, Trash2, Edit2, Check, X } from 'lucide-react';
import { Category } from '../types';
import { cn } from '../lib/utils';

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  
  const [settings, setSettings] = useState({
    business_name: 'StockFlow Pro',
    currency: 'NGN',
    vat_enabled: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories);
      
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSettings({
            business_name: data.business_name || 'StockFlow Pro',
            currency: data.currency || 'NGN',
            vat_enabled: data.vat_enabled || false
          });
        }
      });
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

  const handleUpdateCategory = async (id: number) => {
    if (!editCategoryName) return;
    const response = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCategoryName })
    });
    if (response.ok) {
      setEditingCategory(null);
      fetch('/api/categories').then(res => res.json()).then(setCategories);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetch('/api/categories').then(res => res.json()).then(setCategories);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete category');
      }
    }
  };

  const saveSettings = async (updatedSettings = settings) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (response.ok) {
        const data = await response.json();
        setSettings({
          business_name: data.business_name,
          currency: data.currency,
          vat_enabled: data.vat_enabled
        });
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setIsSaving(false);
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
              <div key={c.id} className="group relative">
                {editingCategory === c.id ? (
                  <div className="flex items-center gap-1 bg-white border border-emerald-500 rounded-xl px-2 py-1 shadow-sm">
                    <input 
                      autoFocus
                      type="text" 
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      className="w-24 text-xs font-bold outline-none"
                    />
                    <button onClick={() => handleUpdateCategory(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingCategory(null)} className="p-1 text-zinc-400 hover:bg-zinc-50 rounded-lg">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 border border-zinc-200/50 group-hover:bg-white group-hover:border-emerald-200 transition-all">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    {c.name}
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingCategory(c.id);
                          setEditCategoryName(c.name);
                        }}
                        className="p-1 text-zinc-400 hover:text-emerald-600 rounded-lg"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-1 text-zinc-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={settings.business_name} 
                  onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                  className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all" 
                />
                <button 
                  onClick={() => saveSettings()}
                  disabled={isSaving}
                  className="px-4 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Currency</label>
              <select 
                value={settings.currency}
                onChange={(e) => {
                  const newSettings = {...settings, currency: e.target.value};
                  setSettings(newSettings);
                  saveSettings(newSettings);
                }}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
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
                <p className="text-xs text-emerald-700 font-medium">Apply 7.5% tax to all sales by default.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const newSettings = {...settings, vat_enabled: !settings.vat_enabled};
                setSettings(newSettings);
                saveSettings(newSettings);
              }}
              className={cn(
                "w-14 h-8 rounded-full relative transition-all shadow-inner",
                settings.vat_enabled ? "bg-emerald-500" : "bg-zinc-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all",
                settings.vat_enabled ? "right-1" : "left-1"
              )}></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

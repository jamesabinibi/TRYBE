import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Tag, 
  Bell, 
  Shield, 
  Globe, 
  Database, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  AlertCircle,
  History,
  User as UserIcon,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../App';

export default function Settings() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  
  const [settings, setSettings] = useState({
    business_name: 'StockFlow Pro',
    currency: 'NGN',
    vat_enabled: false,
    low_stock_threshold: 5,
    logo_url: '',
    brand_color: '#10b981'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      const element = document.getElementById(section);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setSettings(prev => ({ ...prev, logo_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name,
        email: user.email
      });
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
    fetchSettings();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Categories fetch error:', errorData);
        return;
      }
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Categories fetch network error:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Settings fetch error:', errorData);
        return;
      }
      const data = await res.json();
      if (data && !data.error) {
        const fetchedSettings = {
          business_name: data.business_name || 'StockFlow Pro',
          currency: data.currency || 'NGN',
          vat_enabled: data.vat_enabled || false,
          low_stock_threshold: data.low_stock_threshold || 5,
          logo_url: data.logo_url || '',
          brand_color: data.brand_color || '#10b981'
        };
        setSettings(fetchedSettings);
        setLogoPreview(data.logo_url || null);
      }
    } catch (err) {
      console.error('Settings fetch network error:', err);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory) return;
    
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory })
      });
      
      if (response.ok) {
        setNewCategory('');
        fetchCategories();
        toast.success('Category added successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add category');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleUpdateCategory = async (id: number) => {
    if (!editCategoryName) return;
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategoryName })
      });
      if (response.ok) {
        setEditingCategory(null);
        fetchCategories();
        toast.success('Category updated');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update category');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Delete Category</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure? This will only work if no products are assigned to this category.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              const deletePromise = new Promise(async (resolve, reject) => {
                try {
                  const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
                  if (response.ok) {
                    fetchCategories();
                    resolve(true);
                  } else {
                    const data = await response.json();
                    reject(data.error || 'Failed to delete category');
                  }
                } catch (error) {
                  reject('Network error');
                }
              });

              toast.promise(deletePromise, {
                loading: 'Deleting category...',
                success: 'Category deleted',
                error: (err) => err
              });
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const [diagResults, setDiagResults] = useState<any>(null);

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
          vat_enabled: data.vat_enabled,
          low_stock_threshold: data.low_stock_threshold,
          logo_url: data.logo_url,
          brand_color: data.brand_color
        });
        toast.success('Settings saved successfully');
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          toast.error(errorData.error || `Error ${response.status}: Failed to save`);
        } else {
          const textError = await response.text();
          console.error('Non-JSON error:', textError);
          toast.error(`Server Error ${response.status}: Check console or run diagnostics`);
        }
      }
    } catch (e: any) {
      console.error('Network error during save:', e);
      toast.error(`Network Error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const response = await fetch(`/api/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        // Update local storage/auth context if possible
        // For now, just show success and close
        toast.success('Profile updated successfully. Please sign out and back in to see all changes.');
        setIsEditingProfile(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    try {
      const response = await fetch(`/api/change-password/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      if (response.ok) {
        toast.success('Password changed successfully');
        setIsChangingPassword(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to change password');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleClearSales = () => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Clear All Sales</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium italic">Warning: This will permanently delete ALL sales history and records. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              const clearPromise = new Promise(async (resolve, reject) => {
                try {
                  const response = await fetch('/api/sales', { method: 'DELETE' });
                  if (response.ok) {
                    resolve(true);
                  } else {
                    const data = await response.json();
                    reject(data.error || 'Failed to clear sales');
                  }
                } catch (error) {
                  reject('Network error');
                }
              });

              toast.promise(clearPromise, {
                loading: 'Clearing sales history...',
                success: 'All sales history cleared',
                error: (err) => err
              });
            }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Clear All
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  return (
    <div className="max-w-4xl space-y-12 pb-20">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Settings</h1>
        <p className="text-zinc-500 font-medium">Configure your business preferences and system settings.</p>
      </div>

      {/* Product Categories Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600" />
            <h3 className="font-black text-zinc-900 tracking-tight uppercase text-xs tracking-widest">Categories</h3>
          </div>
          <p className="text-xs text-zinc-500 font-medium">Manage the categories used to organize your inventory.</p>
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
      </section>

      {/* Business Profile Section */}
      <section id="profile" className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12 border-t border-zinc-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h3 className="font-black text-zinc-900 tracking-tight uppercase text-xs tracking-widest">Business Profile</h3>
          </div>
          <p className="text-xs text-zinc-500 font-medium">Update your business information and tax settings.</p>
        </div>
        <div id="logo" className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Business Logo</label>
              <div className="flex flex-col gap-4">
                <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-zinc-200 overflow-hidden bg-zinc-50 flex items-center justify-center relative group">
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                      <button 
                        onClick={() => {
                          setLogoPreview(null);
                          setSettings(prev => ({ ...prev, logo_url: '' }));
                        }}
                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Plus className="w-6 h-6 text-zinc-300" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Upload Logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>
                <button 
                  onClick={() => saveSettings()}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Save Logo'}
                </button>
              </div>
            </div>

            <div id="brand" className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Brand Color</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input 
                    type="color" 
                    value={settings.brand_color} 
                    onChange={(e) => setSettings({...settings, brand_color: e.target.value})}
                    className="w-20 h-20 rounded-3xl border-none cursor-pointer bg-transparent" 
                  />
                  <div className="absolute inset-0 rounded-3xl pointer-events-none border-4 border-white shadow-inner" style={{ backgroundColor: settings.brand_color }} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-bold text-zinc-900">{settings.brand_color}</p>
                  <p className="text-[10px] text-zinc-400 font-medium">Accent color for your brand</p>
                </div>
                <button 
                  onClick={() => saveSettings()}
                  className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Global Low Stock Alert</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={settings.low_stock_threshold} 
                  onChange={(e) => setSettings({...settings, low_stock_threshold: parseInt(e.target.value) || 0})}
                  className="w-24 px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all" 
                />
                <span className="text-xs text-zinc-400 font-medium">units</span>
                <button 
                  onClick={() => saveSettings()}
                  className="ml-auto px-4 py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          </div>

          <div id="tax" className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100 gap-4">
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
      </section>

      {/* User Account Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12 border-t border-zinc-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="font-black text-zinc-900 tracking-tight uppercase text-xs tracking-widest">User Account</h3>
          </div>
          <p className="text-xs text-zinc-500 font-medium">Manage your personal profile and security settings.</p>
        </div>
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center gap-6 p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-emerald-500/20">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Full Name"
                    required
                  />
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Email Address"
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
                      Save Changes
                    </button>
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 bg-zinc-200 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-black text-zinc-900 tracking-tight">{user?.name}</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">{user?.role}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {isChangingPassword ? (
              <form onSubmit={handleChangePassword} className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Change Password</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Current Password"
                    required
                  />
                  <div className="hidden sm:block" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="New Password"
                    required
                  />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Confirm New Password"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
                    Update Password
                  </button>
                  <button type="button" onClick={() => setIsChangingPassword(false)} className="px-6 py-3 bg-zinc-200 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full flex items-center justify-between p-4 border border-zinc-100 rounded-2xl hover:bg-zinc-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600" />
                  <span className="text-sm font-bold text-zinc-600">Change Password</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Data Management Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12 border-t border-zinc-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-red-600" />
            <h3 className="font-black text-zinc-900 tracking-tight uppercase text-xs tracking-widest">Data Management</h3>
          </div>
          <p className="text-xs text-zinc-500 font-medium">Dangerous operations. Use with extreme caution.</p>
        </div>
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between p-6 bg-red-50 rounded-[2rem] border border-red-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl text-red-600 shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-red-900 uppercase tracking-widest">Clear Sales History</p>
                <p className="text-xs text-red-700 font-medium">Delete all transaction logs and profit data.</p>
              </div>
            </div>
            <button 
              onClick={handleClearSales}
              className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Clear Data
            </button>
          </div>

          <div className="pt-6 border-t border-zinc-100 space-y-4">
            <button 
              onClick={async () => {
                try {
                  const res = await fetch('/api/diag');
                  const data = await res.json();
                  setDiagResults(data);
                  console.log('System Diagnostics:', data);
                  toast.info('Diagnostic info retrieved');
                } catch (e) {
                  toast.error('Failed to fetch diagnostics');
                }
              }}
              className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em] hover:text-zinc-500 transition-colors"
            >
              Run System Diagnostics
            </button>

            {diagResults && (
              <div className="p-4 bg-zinc-900 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Diagnostic Results</p>
                  <button onClick={() => setDiagResults(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(diagResults, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

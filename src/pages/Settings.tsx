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
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth, useSettings } from '../App';

export default function Settings() {
  const { user } = useAuth();
  const { refreshSettings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  
  const [settings, setSettings] = useState({
    business_name: 'StockFlow Pro',
    currency: 'NGN',
    vat_enabled: false,
    low_stock_threshold: '5',
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

  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateImages = async () => {
    if (!confirm('This will move all existing product images to Cloudinary for faster loading. Continue?')) return;
    
    setIsMigrating(true);
    try {
      const res = await fetch('/api/admin/migrate-images', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully migrated ${data.migratedCount} images!`);
      } else {
        throw new Error(data.error || 'Migration failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMigrating(false);
    }
  };

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
        // 1. Decode branding from business_name if it's encoded (Server-side fallback)
        if (data.business_name && data.business_name.startsWith('[')) {
          const match = data.business_name.match(/^\[(#?[a-fA-F0-9]{3,6})\]\s*(.*)/);
          if (match) {
            data.brand_color = match[1];
            data.business_name = match[2];
          }
        } else if (data.business_name && data.business_name.startsWith('{"')) {
          try {
            const branding = JSON.parse(data.business_name);
            data.business_name = branding.name;
            data.brand_color = data.brand_color || branding.color;
            data.logo_url = data.logo_url || branding.logo;
          } catch (e) {}
        }

        // 2. Fallback for branding from localStorage if missing in DB
        const localBranding = localStorage.getItem('branding_settings');
        let logo_url = data.logo_url;
        let brand_color = data.brand_color;
        
        if (localBranding) {
          try {
            const parsed = JSON.parse(localBranding);
            logo_url = logo_url || parsed.logo_url;
            brand_color = brand_color || parsed.brand_color;
          } catch (e) {}
        }

        const fetchedSettings = {
          business_name: data.business_name || 'StockFlow Pro',
          currency: data.currency || 'NGN',
          vat_enabled: data.vat_enabled || false,
          low_stock_threshold: (data.low_stock_threshold || 5).toString(),
          logo_url: logo_url || '',
          brand_color: brand_color || '#10b981'
        };
        setSettings(fetchedSettings);
        setLogoPreview(logo_url || null);
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
  const [isCheckingDiag, setIsCheckingDiag] = useState(false);

  const runDiagnostics = async () => {
    setIsCheckingDiag(true);
    try {
      const res = await fetch('/api/diag');
      const data = await res.json();
      setDiagResults(data);
      if (res.ok) {
        toast.success('Diagnostics complete');
      } else {
        toast.error('Diagnostics failed to run');
      }
    } catch (err) {
      toast.error('Network error during diagnostics');
    } finally {
      setIsCheckingDiag(false);
    }
  };

  const setupSql = `
-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  cost_price DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2) DEFAULT 0,
  supplier_name TEXT,
  unit TEXT DEFAULT 'Pieces',
  pieces_per_unit INTEGER DEFAULT 1,
  product_type TEXT DEFAULT 'one',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  price_override DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Services
CREATE TABLE IF NOT EXISTS services (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Settings
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  business_name TEXT DEFAULT 'StockFlow Pro',
  currency TEXT DEFAULT 'NGN',
  vat_enabled BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#10b981',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Sales
CREATE TABLE IF NOT EXISTS sales (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  customer_id BIGINT,
  total_amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  variant_id BIGINT REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  payment_method TEXT DEFAULT 'Cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
  `;

  const copySql = () => {
    navigator.clipboard.writeText(setupSql);
    toast.success('SQL copied to clipboard! Paste it into Supabase SQL Editor.');
  };

  const saveSettings = async (updatedSettings = settings) => {
    setIsSaving(true);
    try {
      const payload = {
        ...updatedSettings,
        low_stock_threshold: parseInt(updatedSettings.low_stock_threshold as any) || 0
      };
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Save branding to localStorage as fallback
        localStorage.setItem('branding_settings', JSON.stringify({
          logo_url: updatedSettings.logo_url,
          brand_color: updatedSettings.brand_color
        }));

        setSettings({
          business_name: data.business_name,
          currency: data.currency,
          vat_enabled: data.vat_enabled,
          low_stock_threshold: (data.low_stock_threshold || 0).toString(),
          logo_url: data.logo_url,
          brand_color: data.brand_color
        });
        await refreshSettings();
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
    <div className="max-w-4xl space-y-8 sm:space-y-12 pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 font-medium">Configure your business preferences and system settings.</p>
      </div>

      {/* Product Categories Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand" />
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Categories</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Manage the categories used to organize your inventory.</p>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 sm:space-y-8">
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="New category name..." 
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all dark:text-white"
            />
            <button 
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95"
            >
              Add
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <div key={c.id} className="group relative">
                {editingCategory === c.id ? (
                  <div className="flex items-center gap-1 bg-white border border-brand rounded-xl px-2 py-1 shadow-sm">
                    <input 
                      autoFocus
                      type="text" 
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      className="w-24 text-xs font-bold outline-none"
                    />
                    <button onClick={() => handleUpdateCategory(c.id)} className="p-1 text-brand hover:bg-brand/5 rounded-lg">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingCategory(null)} className="p-1 text-zinc-400 hover:bg-zinc-50 rounded-lg">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 border border-zinc-200/50 group-hover:bg-white group-hover:border-brand/20 transition-all">
                    {c.name}
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingCategory(c.id);
                          setEditCategoryName(c.name);
                        }}
                        className="p-1 text-zinc-400 hover:text-brand rounded-lg"
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
      <section id="profile" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand" />
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Business Profile</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Update your business information and tax settings.</p>
        </div>
        <div id="logo" className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Business Logo</label>
              <div className="flex flex-col gap-4">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center relative group">
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                      <button 
                        onClick={() => {
                          setLogoPreview(null);
                          setSettings(prev => ({ ...prev, logo_url: '' }));
                        }}
                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-300 dark:text-zinc-600" />
                      <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Upload Logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>
                <button 
                  onClick={() => saveSettings()}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Save Logo'}
                </button>
              </div>
            </div>

            <div id="brand" className="space-y-4">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Brand Color</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input 
                    type="color" 
                    value={settings.brand_color} 
                    onChange={(e) => setSettings({...settings, brand_color: e.target.value})}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-none cursor-pointer bg-transparent" 
                  />
                  <div className="absolute inset-0 rounded-2xl sm:rounded-3xl pointer-events-none border-4 border-white dark:border-zinc-800 shadow-inner" style={{ backgroundColor: settings.brand_color }} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">{settings.brand_color}</p>
                  <p className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Accent color for your brand</p>
                </div>
                <button 
                  onClick={() => saveSettings()}
                  className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Business Name</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={settings.business_name} 
                  onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                  className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white" 
                />
                <button 
                  onClick={() => saveSettings()}
                  disabled={isSaving}
                  className="px-4 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Currency</label>
              <select 
                value={settings.currency}
                onChange={(e) => {
                  const newSettings = {...settings, currency: e.target.value};
                  setSettings(newSettings);
                  saveSettings(newSettings);
                }}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all appearance-none dark:text-white"
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
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Global Low Stock Alert</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={settings.low_stock_threshold} 
                  onChange={(e) => setSettings({...settings, low_stock_threshold: e.target.value})}
                  className="w-24 px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white" 
                />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">units</span>
                <button 
                  onClick={() => saveSettings()}
                  className="ml-auto px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          </div>

          <div id="tax" className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-brand/5 dark:bg-brand/10 rounded-2xl sm:rounded-[2rem] border border-brand/10 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl text-brand shadow-sm">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-sm font-black text-brand uppercase tracking-widest">VAT Enabled</p>
                <p className="text-[10px] sm:text-xs text-brand/70 dark:text-brand/80 font-medium">Apply 7.5% tax to all sales by default.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const newSettings = {...settings, vat_enabled: !settings.vat_enabled};
                setSettings(newSettings);
                saveSettings(newSettings);
              }}
              className={cn(
                "w-12 h-7 sm:w-14 sm:h-8 rounded-full relative transition-all shadow-inner self-end sm:self-auto",
                settings.vat_enabled ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-700"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-md transition-all",
                settings.vat_enabled ? "right-1" : "left-1"
              )}></div>
            </button>
          </div>
        </div>
      </section>

      {/* User Account Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-brand" />
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">User Account</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Manage your personal profile and security settings.</p>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl sm:rounded-[2rem] border border-zinc-100 dark:border-zinc-700/50">
            <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-brand/20 shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 w-full">
              {isEditingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white"
                    placeholder="Full Name"
                    required
                  />
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white"
                    placeholder="Email Address"
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 sm:flex-none px-4 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all">
                      Save Changes
                    </button>
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 sm:flex-none px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-center sm:text-left">
                    <h4 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">{user?.name}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-black">{user?.role}</p>
                  </div>
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="p-2 text-zinc-400 hover:text-brand transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {isChangingPassword ? (
              <form onSubmit={handleChangePassword} className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl sm:rounded-[2rem] border border-zinc-100 dark:border-zinc-700/50 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-brand" />
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">Change Password</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white"
                    placeholder="Current Password"
                    required
                  />
                  <div className="hidden sm:block" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white"
                    placeholder="New Password"
                    required
                  />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white"
                    placeholder="Confirm New Password"
                    required
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20">
                    Update Password
                  </button>
                  <button type="button" onClick={() => setIsChangingPassword(false)} className="w-full sm:w-auto px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-zinc-400 group-hover:text-brand" />
                  <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Change Password</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* System Diagnostics Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">System Health</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Check database connectivity and table status.</p>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-3 h-3 rounded-full",
                diagResults?.supabase_connected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-red-500"
              )} />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  {diagResults?.supabase_connected ? 'Supabase Connected' : 'Supabase Disconnected'}
                </span>
                {diagResults?.supabase_status?.error && (
                  <span className="text-[10px] text-red-500 font-black uppercase tracking-widest">{diagResults.supabase_status.error}</span>
                )}
              </div>
            </div>
            <button 
              onClick={runDiagnostics}
              disabled={isCheckingDiag}
              className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2"
            >
              {isCheckingDiag ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
              Run Check
            </button>
          </div>

          {diagResults?.tables && Object.keys(diagResults.tables || {}).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(diagResults.tables || {}).map(([name, status]: [string, any]) => (
                <div key={name} className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  status.exists ? "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20" : "bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/20"
                )}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{name}</span>
                  {status.exists ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-6 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <Database className="w-5 h-5" />
              <h4 className="text-sm font-black uppercase tracking-widest">Database Setup</h4>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 font-medium leading-relaxed">
              If any tables are missing (marked with <X className="inline w-3 h-3" />), you need to create them in your Supabase SQL Editor.
            </p>
            <button 
              onClick={copySql}
              className="w-full py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
            >
              Copy Setup SQL Script
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Cloudinary</p>
              <p className={cn("text-xs font-bold", diagResults?.env?.cloudinary ? "text-emerald-500" : "text-red-500")}>
                {diagResults?.env?.cloudinary ? 'Configured' : 'Missing'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Gemini AI</p>
              <p className={cn("text-xs font-bold", diagResults?.env?.gemini ? "text-emerald-500" : "text-red-500")}>
                {diagResults?.env?.gemini ? 'Configured' : 'Missing'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Email (SMTP)</p>
              <p className={cn("text-xs font-bold", diagResults?.env?.smtp ? "text-emerald-500" : "text-zinc-400")}>
                {diagResults?.env?.smtp ? 'Configured' : 'Mock Mode'}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-red-600" />
            <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Data Management</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Dangerous operations. Use with extreme caution.</p>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-red-50 dark:bg-red-500/10 rounded-2xl sm:rounded-[2rem] border border-red-100 dark:border-red-500/20 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl text-red-600 shadow-sm shrink-0">
                <History className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-sm font-black text-red-900 dark:text-red-500 uppercase tracking-widest">Clear Sales History</p>
                <p className="text-[10px] sm:text-xs text-red-700 dark:text-red-400 font-medium">Delete all transaction logs and profit data.</p>
              </div>
            </div>
            <button 
              onClick={handleClearSales}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Clear Data
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-brand/5 dark:bg-brand/10 rounded-2xl sm:rounded-[2rem] border border-brand/10 dark:border-brand/20 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl text-brand shadow-sm shrink-0">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-sm font-black text-brand uppercase tracking-widest">Cloudinary Migration</p>
                <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Move existing product images to Cloudinary for faster loading.</p>
              </div>
            </div>
            <button 
              onClick={handleMigrateImages}
              disabled={isMigrating}
              className="w-full sm:w-auto px-6 py-3 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50"
            >
              {isMigrating ? 'Migrating...' : 'Start Migration'}
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
                  <p className="text-[10px] font-black text-brand uppercase tracking-widest">Diagnostic Results</p>
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

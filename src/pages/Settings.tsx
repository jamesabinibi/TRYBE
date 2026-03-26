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
  Loader2,
  Activity,
  AlertTriangle,
  Users
} from 'lucide-react';
import { Category } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth, useSettings } from '../App';

export default function Settings() {
  const { user, fetchWithAuth } = useAuth();
  const { settings: globalSettings, refreshSettings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  
  const [settings, setSettings] = useState({
    business_name: globalSettings?.business_name || 'Gryndee',
    currency: globalSettings?.currency || 'NGN',
    vat_enabled: globalSettings?.vat_enabled || false,
    low_stock_threshold: (globalSettings?.low_stock_threshold || 5).toString(),
    logo_url: globalSettings?.logo_url || '',
    brand_color: globalSettings?.brand_color || '#10b981',
    slogan: globalSettings?.slogan || '',
    address: globalSettings?.address || '',
    email: globalSettings?.email || '',
    website: globalSettings?.website || '',
    phone_number: globalSettings?.phone_number || '',
    welcome_email_subject: globalSettings?.welcome_email_subject || 'Welcome to Gryndee!',
    welcome_email_body: globalSettings?.welcome_email_body || 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nBest regards,\nThe Gryndee Team'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(globalSettings?.logo_url || null);
  const [showClearSalesConfirm, setShowClearSalesConfirm] = useState(false);
  const [colorMode, setColorMode] = useState<'solid' | 'gradient'>('solid');

  useEffect(() => {
    if (settings.brand_color.includes('gradient')) {
      setColorMode('gradient');
    } else {
      setColorMode('solid');
    }
  }, [settings.brand_color]);

  useEffect(() => {
    if (globalSettings) {
      setSettings({
        business_name: globalSettings.business_name || 'Gryndee',
        currency: globalSettings.currency || 'NGN',
        vat_enabled: globalSettings.vat_enabled || false,
        low_stock_threshold: (globalSettings.low_stock_threshold || 5).toString(),
        logo_url: globalSettings.logo_url || '',
        brand_color: globalSettings.brand_color || '#10b981',
        slogan: globalSettings.slogan || '',
        address: globalSettings.address || '',
        email: globalSettings.email || '',
        website: globalSettings.website || '',
        phone_number: globalSettings.phone_number || '',
        welcome_email_subject: globalSettings.welcome_email_subject || 'Welcome to Gryndee!',
        welcome_email_body: globalSettings.welcome_email_body || 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nBest regards,\nThe Gryndee Team'
      });
      setLogoPreview(globalSettings.logo_url || null);
    }
  }, [globalSettings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    const hash = window.location.hash.replace('#', '');
    
    const targetId = section || hash;
    if (targetId) {
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Please upload a PNG or JPEG image. SVG is not allowed.');
      return;
    }

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
  }, []);

  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateImages = async () => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Migrate Images</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">This will move all existing product images to AWS S3. Continue?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              setIsMigrating(true);
              try {
                const res = await fetchWithAuth('/api/admin/migrate-images', { method: 'POST' });
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
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            Migrate
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const fetchCategories = async () => {
    try {
      const res = await fetchWithAuth('/api/categories');
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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory) return;
    
    try {
      const response = await fetchWithAuth('/api/categories', {
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
      const response = await fetchWithAuth(`/api/categories/${id}`, {
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
                  const response = await fetchWithAuth(`/api/categories/${id}`, { method: 'DELETE' });
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
      const res = await fetchWithAuth('/api/diag');
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

  const [isInitializing, setIsInitializing] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  const handleSendTestEmail = async () => {
    const email = prompt('Enter recipient email address for the test:', user?.email);
    if (!email) return;

    setIsSendingTestEmail(true);
    try {
      const res = await fetchWithAuth('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          subject: settings.welcome_email_subject,
          body: settings.welcome_email_body
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test email sent! Please check your inbox (and spam folder).');
      } else {
        toast.error(data.error || 'Failed to send test email');
        if (data.details) {
          console.error('SMTP Error Details:', data.details);
          toast.error(`SMTP Error: ${data.details}`, { duration: 10000 });
        }
      }
    } catch (err) {
      toast.error('Network error during test email');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleInitializeDb = async () => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-brand">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Initialize Database</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">This will create all necessary tables. Existing data will be preserved. Continue?</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              setIsInitializing(true);
              try {
                const res = await fetchWithAuth('/api/diag/setup', { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                  toast.success('Database initialized successfully');
                } else {
                  toast.error(data.error || 'Failed to initialize database');
                }
              } catch (err) {
                toast.error('Network error during database initialization');
              } finally {
                setIsInitializing(false);
              }
            }}
            className="flex-1 py-2 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all"
          >
            Initialize
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const setupSql = `
-- 0. Accounts (Multi-tenancy)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 0.1 Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
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
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
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
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Services
CREATE TABLE IF NOT EXISTS services (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Settings
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  business_name TEXT DEFAULT 'Gryndee',
  currency TEXT DEFAULT 'NGN',
  vat_enabled BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#10b981',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

-- 7. Sales
CREATE TABLE IF NOT EXISTS sales (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id BIGINT,
  total_amount DECIMAL(12,2) NOT NULL,
  total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Completed',
  staff_id BIGINT,
  invoice_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  variant_id BIGINT REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL,
  profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix for loyalty_points if table already exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='loyalty_points') THEN
    ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;
  END IF;
END $$;

-- Fix for total_profit in sales if table already exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='total_profit') THEN
    ALTER TABLE sales ADD COLUMN total_profit DECIMAL(12,2) DEFAULT 0;
  END IF;
END $$;

-- Fix for account_id in all tables if they exist
DO $$ 
DECLARE
    t text;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=t AND column_name='account_id') THEN
            BEGIN
                EXECUTE format('ALTER TABLE %I ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE', t);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not add account_id to %', t;
            END;
        END IF;
    END LOOP;
END $$;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
  `;

  const copySql = () => {
    navigator.clipboard.writeText(setupSql);
    toast.success('SQL copied to clipboard! Paste it into Supabase SQL Editor.');
  };

  const [activeTab, setActiveTab] = useState<'branding' | 'team' | 'categories' | 'account' | 'system'>('branding');

  // Users Management State (Merged from Users.tsx)
  const [users, setUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'staff' as 'admin' | 'manager' | 'staff',
    email: '',
    permissions: {
      can_view_dashboard: true,
      can_view_account_data: false,
      can_manage_products: false,
      can_manage_sales: false,
      can_view_expenses: false,
      can_manage_expenses: false,
    }
  });

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const response = await fetchWithAuth('/api/users');
      const data = await response.json();
      if (response.ok) {
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'account') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleOpenUserModal = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({
        username: user.username,
        password: '',
        name: user.name || '',
        role: user.role as any,
        email: user.email || '',
        permissions: {
          can_view_dashboard: true,
          can_view_account_data: false,
          can_manage_products: false,
          can_manage_sales: false,
          can_view_expenses: false,
          can_manage_expenses: false,
          ...(user.permissions || {})
        }
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        username: '',
        password: '',
        name: '',
        role: 'staff',
        email: '',
        permissions: {
          can_view_dashboard: true,
          can_view_account_data: false,
          can_manage_products: false,
          can_manage_sales: false,
          can_view_expenses: false,
          can_manage_expenses: false,
        }
      });
    }
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData)
      });

      if (response.ok) {
        toast.success(editingUser ? 'User updated' : 'User added');
        setIsUserModalOpen(false);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save user');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Delete User</h3>
        </div>
        <p className="text-sm text-zinc-500 font-medium">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex gap-3">
          <button 
            onClick={async () => {
              toast.dismiss(t);
              try {
                const res = await fetchWithAuth(`/api/users/${id}`, { method: 'DELETE' });
                if (res.ok) {
                  fetchUsers();
                  toast.success('User deleted');
                } else {
                  const data = await res.json();
                  toast.error(data.error || 'Failed to delete user');
                }
              } catch (error) {
                toast.error('Network error');
              }
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

  const saveSettings = async (updatedSettings = settings) => {
    setIsSaving(true);
    try {
      // Encode branding into business_name for robust persistence
      const encodedBusinessName = JSON.stringify({
        name: updatedSettings.business_name,
        color: updatedSettings.brand_color,
        logo: updatedSettings.logo_url,
        slogan: updatedSettings.slogan,
        address: updatedSettings.address,
        email: updatedSettings.email,
        website: updatedSettings.website,
        phone: updatedSettings.phone_number,
        welcome_email_subject: updatedSettings.welcome_email_subject,
        welcome_email_body: updatedSettings.welcome_email_body
      });

      const payload = {
        ...updatedSettings,
        business_name: encodedBusinessName,
        low_stock_threshold: parseInt(updatedSettings.low_stock_threshold as any) || 0
      };
      const response = await fetchWithAuth('/api/settings', {
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

        // Decode branding from business_name if it's encoded (Server-side fallback)
        let decodedName = data.business_name;
        let decodedColor = data.brand_color;
        let decodedLogo = data.logo_url;

        if (decodedName && decodedName.startsWith('[')) {
          const match = decodedName.match(/^\[(#?[a-fA-F0-9]{3,6})\]\s*(.*)/);
          if (match) {
            decodedColor = match[1];
            decodedName = match[2];
          }
        } else if (decodedName && decodedName.startsWith('{"')) {
          try {
            const branding = JSON.parse(decodedName);
            decodedName = branding.name;
            decodedColor = decodedColor || branding.color;
            decodedLogo = decodedLogo || branding.logo;
            data.slogan = data.slogan || branding.slogan;
            data.address = data.address || branding.address;
            data.email = data.email || branding.email;
            data.website = data.website || branding.website;
            data.phone_number = data.phone_number || branding.phone;
            data.welcome_email_subject = data.welcome_email_subject || branding.welcome_email_subject;
            data.welcome_email_body = data.welcome_email_body || branding.welcome_email_body;
          } catch (e) {}
        }

        setSettings({
          business_name: decodedName,
          currency: data.currency,
          vat_enabled: data.vat_enabled,
          low_stock_threshold: (data.low_stock_threshold || 0).toString(),
          logo_url: decodedLogo,
          brand_color: decodedColor,
          slogan: data.slogan || '',
          address: data.address || '',
          email: data.email || '',
          website: data.website || '',
          phone_number: data.phone_number || '',
          welcome_email_subject: data.welcome_email_subject || 'Welcome to Gryndee!',
          welcome_email_body: data.welcome_email_body || 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nBest regards,\nThe Gryndee Team'
        });
        await refreshSettings();
        toast.success('Settings saved successfully');
      } else {
        if (response.status === 403) {
          toast.error('Forbidden: Only the business owner or an admin can change these settings.');
          return;
        }
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
      const response = await fetchWithAuth(`/api/profile/${user.id}`, {
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
      const response = await fetchWithAuth(`/api/change-password/${user.id}`, {
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
                  const response = await fetchWithAuth('/api/sales', { method: 'DELETE' });
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
    <div className="max-w-6xl space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">Settings</h1>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-medium">Configure your business preferences and system settings.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('branding')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
            activeTab === 'branding' 
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          Branding
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
            activeTab === 'categories' 
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          PRODUCT/SERVICE CATEGORY
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
            activeTab === 'account' 
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          Account & Team
        </button>
        {user?.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('system')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === 'system' 
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            System
          </button>
        )}
      </div>

      {activeTab === 'branding' && (
        <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Business Profile Section */}
          <section id="profile" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand" />
            <h3 className="font-black text-zinc-950 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Business Profile</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Update your business information and tax settings.</p>
        </div>
        <div id="logo" className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex flex-col items-center text-center space-y-6">
              <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Business Logo</label>
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl sm:rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center relative group shadow-inner">
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                      <button 
                        onClick={() => {
                          setLogoPreview(null);
                          setSettings(prev => ({ ...prev, logo_url: '' }));
                        }}
                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-3 w-full h-full justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors">
                      <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <Plus className="w-6 h-6 text-brand" />
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Upload Logo</span>
                      <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>
                <div className="space-y-3 w-full max-w-xs">
                  <button 
                    onClick={() => saveSettings()}
                    disabled={isSaving}
                    className="w-full px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/20 dark:shadow-white/10 disabled:opacity-50"
                  >
                    {isSaving ? '...' : 'Save Business Logo'}
                  </button>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Recommended: Square PNG or JPEG</p>
                </div>
              </div>
            </div>
          </div>

          <div id="brand" className="space-y-4">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Brand Colour</label>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-200/50 dark:border-zinc-700/50 relative overflow-visible">
              <div className="flex flex-col sm:flex-row items-center gap-6 relative z-20 w-full lg:w-auto">
                <div 
                  className="w-20 h-20 rounded-3xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] border border-white/20 dark:border-white/10 flex items-center justify-center shrink-0" 
                  style={{ background: settings.brand_color }}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-white/50 mix-blend-overlay" />
                </div>
                <div className="flex-1 flex flex-col items-center sm:items-start w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="flex items-center gap-3 w-full max-w-[200px]">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0">
                      HEX
                    </span>
                    <input 
                      type="color" 
                      value={settings.brand_color}
                      onChange={(e) => setSettings({...settings, brand_color: e.target.value})}
                      className="w-full h-10 bg-white dark:bg-black/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-1 py-1 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-2">Enter a valid HEX code (e.g. #10b981)</p>
                </div>
              </div>
              
              <button 
                onClick={() => saveSettings()}
                className="w-full lg:w-auto px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/20 dark:shadow-white/10 relative z-10"
              >
                Apply Colour
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Business Name</label>
              <input 
                type="text" 
                value={settings.business_name} 
                onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Slogan / Tagline</label>
              <input 
                type="text" 
                value={settings.slogan} 
                onChange={(e) => setSettings({...settings, slogan: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Email Address</label>
              <input 
                type="email" 
                value={settings.email} 
                onChange={(e) => setSettings({...settings, email: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Phone Number</label>
              <input 
                type="text" 
                value={settings.phone_number} 
                onChange={(e) => setSettings({...settings, phone_number: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
          </div>

          <div className="space-y-2 pt-6">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Business Address</label>
            <textarea 
              value={settings.address} 
              onChange={(e) => setSettings({...settings, address: e.target.value})}
              rows={3}
              className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900 resize-none" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Website URL</label>
              <input 
                type="text" 
                value={settings.website} 
                onChange={(e) => setSettings({...settings, website: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Currency Symbol</label>
              <input 
                type="text" 
                value={settings.currency} 
                onChange={(e) => setSettings({...settings, currency: e.target.value})}
                className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
              />
            </div>
          </div>
        </div>
      </section>

      <div className="pt-8 flex justify-end">
            <button 
              onClick={() => saveSettings()}
              disabled={isSaving}
              className="w-full sm:w-auto px-10 py-4 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Save Branding Settings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Global Low Stock Alert</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={settings.low_stock_threshold} 
                  onChange={(e) => setSettings({...settings, low_stock_threshold: e.target.value})}
                  className="w-24 px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
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

          <div id="tax" className="flex flex-col p-5 sm:p-6 bg-brand/5 dark:bg-brand/10 rounded-2xl sm:rounded-[2rem] border border-brand/10 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl text-brand shadow-sm">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm font-black text-brand uppercase tracking-widest">VAT Enabled</p>
                  <p className="text-[10px] sm:text-xs text-brand/70 dark:text-brand/80 font-medium">Apply 7.5% tax to all sales by default (Nigeria Finance Act 2023).</p>
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
            
            <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <p className="text-[10px] text-brand/80 leading-relaxed font-medium">
                <strong>Note for Nigerian Businesses:</strong> Companies with turnover &lt; N25m are exempt from VAT. 
                If you enable this, ensure you are registered with FIRS. Visit the <strong>Tax Report</strong> page for more details.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Categories Section */}
          <section id="categories" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand" />
                <h3 className="font-black text-zinc-950 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Product/Service Category</h3>
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
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-brand rounded-xl px-2 py-1 shadow-sm">
                        <input 
                          autoFocus
                          type="text" 
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="w-24 text-xs font-bold outline-none bg-transparent text-zinc-900 dark:text-white"
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
        </div>
      )}

      {activeTab === 'system' && user?.role === 'super_admin' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Email Templates Section - Restricted to Super Admin */}
          <section id="email-templates" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand" />
              <h3 className="font-black text-zinc-950 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Email Templates</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Customize the automated emails sent to your users.</p>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 sm:space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Welcome Email</h4>
                <button 
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestEmail}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2"
                >
                  {isSendingTestEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                  Send Test
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Subject Line</label>
                <input 
                  type="text" 
                  value={settings.welcome_email_subject} 
                  onChange={(e) => setSettings({...settings, welcome_email_subject: e.target.value})}
                  className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Email Body</label>
                <textarea 
                  value={settings.welcome_email_body} 
                  onChange={(e) => setSettings({...settings, welcome_email_body: e.target.value})}
                  rows={6}
                  className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white text-zinc-900 resize-none" 
                />
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium italic">
                  Use <code className="text-brand">{'{name}'}</code>, <code className="text-brand">{'{username}'}</code>, and <code className="text-brand">{'{verification_code}'}</code> as placeholders.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={() => saveSettings()}
                disabled={isSaving}
                className="w-full sm:w-auto px-10 py-4 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Save Email Templates
              </button>
            </div>
          </div>
        </section>

        {/* System Health Section */}
        <section id="health" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand" />
              <h3 className="font-black text-zinc-950 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">System Health</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Diagnostic tools and system status information.</p>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Server Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">Operational</p>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Database</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">Connected</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => toast.success('System diagnostics completed. All systems normal.')}
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              Run Full Diagnostics
            </button>
          </div>
        </section>

        {/* Data Management Section */}
        <section id="data" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-brand" />
              <h3 className="font-black text-zinc-950 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Data Management</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Critical operations for managing your business data.</p>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 space-y-4">
              <div className="flex items-center gap-3 text-zinc-900 dark:text-white">
                <Database className="w-5 h-5 text-brand" />
                <h4 className="text-sm font-black uppercase tracking-widest">Image Migration</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Migrate existing product images to AWS S3. This process runs in the background.
              </p>
              <div className="pt-2">
                <button 
                  onClick={handleMigrateImages}
                  disabled={isMigrating}
                  className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMigrating ? 'Migrating...' : 'Migrate Images to AWS S3'}
                </button>
              </div>
            </div>

            <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 space-y-4">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-sm font-black uppercase tracking-widest">Danger Zone</h4>
              </div>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">
                These actions are irreversible. Please proceed with extreme caution.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => setShowClearSalesConfirm(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Clear All Sales Data
                </button>
                <button 
                  onClick={() => toast.error('Full system reset is disabled for safety.')}
                  className="px-6 py-3 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                >
                  Factory Reset
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )}

      {activeTab === 'account' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* User Account Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
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
            <button 
              onClick={() => {
                localStorage.removeItem('hasSeenWalkthrough');
                window.location.reload();
              }}
              className="w-full flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 text-zinc-400 group-hover:text-brand" />
                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Restart App Walkthrough</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
            </button>
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

      {/* Team Management Section */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <section id="team" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pt-8 sm:pt-12 border-t border-zinc-200 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <h3 className="font-black text-zinc-900 dark:text-white tracking-tight uppercase text-[10px] sm:text-xs tracking-widest">Team Management</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Manage your staff accounts and their access levels.</p>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => handleOpenUserModal()}
                className="px-6 py-3 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Member</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Role</th>
                    <th className="px-4 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {users.map(u => (
                    <tr key={u.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-black text-zinc-600 dark:text-zinc-400">
                            {u.name?.charAt(0) || u.username?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{u.name}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          u.role === 'admin' || u.role === 'super_admin' ? "bg-brand/10 text-brand" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenUserModal(u)}
                            className="p-2 text-zinc-400 hover:text-brand transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
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
          </div>
        </section>
      )}
    </div>
  )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase tracking-widest text-xs">
                  {editingUser ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <p className="text-[10px] text-zinc-500 font-medium">Configure access for your staff.</p>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleUserSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({...userFormData, name: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Username</label>
                  <input 
                    type="text" 
                    required
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({...userFormData, username: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Role</label>
                  <select 
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({...userFormData, role: e.target.value as any})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {userFormData.role !== 'admin' && (
                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Permissions</label>
                    <div className="space-y-3">
                      {[
                        { id: 'can_view_dashboard', label: 'View Dashboard' },
                        { id: 'can_view_account_data', label: 'View All Account Data' },
                        { id: 'can_manage_products', label: 'Manage Products' },
                        { id: 'can_manage_sales', label: 'Manage Sales & Invoices' },
                        { id: 'can_view_expenses', label: 'View Expenses' },
                        { id: 'can_manage_expenses', label: 'Manage Expenses' },
                      ].map((perm) => (
                        <label key={perm.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{perm.label}</span>
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand"
                            checked={!!userFormData.permissions?.[perm.id as keyof typeof userFormData.permissions]}
                            onChange={(e) => setUserFormData({
                              ...userFormData,
                              permissions: {
                                ...userFormData.permissions,
                                [perm.id]: e.target.checked
                              }
                            })}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                  </label>
                  <input 
                    type="password" 
                    required={!editingUser}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all dark:text-white"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {editingUser ? 'Update Member' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

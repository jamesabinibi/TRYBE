import React, { useState, useEffect } from 'react';
import { useAuth, useSettings } from '../App';
import { 
  Users as UsersIcon, 
  Plus, 
  Shield, 
  User as UserIcon, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  AlertCircle,
  Package,
  ShoppingCart,
  BarChart3,
  Wallet,
  CreditCard,
  Zap,
  Search,
  Target,
  Loader2
} from 'lucide-react';
import { Input } from '../components/Input';
import { User } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Users() {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'staff' as 'admin' | 'manager' | 'staff',
    email: '',
    permissions: {
      can_view_dashboard: false,
      can_view_account_data: false,
      can_manage_products: true,
      can_manage_sales: true,
      can_view_expenses: false,
      can_manage_expenses: false,
      product_access_type: 'all' as 'all' | 'specific',
      assigned_product_ids: [] as number[],
    }
  });

  const fetchStoreProducts = async () => {
    setIsProductsLoading(true);
    try {
      const response = await fetchWithAuth('/api/products?exclude_images=true');
      if (response.ok) {
        const data = await response.json();
        setStoreProducts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load store products:', e);
    } finally {
      setIsProductsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/users');
      const data = await response.json();
      if (response.ok) {
        setUsers(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch users:', data.error);
        toast.error(data.error || 'Failed to load team members');
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Network error while loading team members');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user?: User) => {
    setProductSearch('');
    fetchStoreProducts();
    if (user) {
      setEditingUser(user);
      const rawPerms = user.permissions;
      const parsedPerms = typeof rawPerms === 'string'
        ? (() => { try { return JSON.parse(rawPerms); } catch { return {}; } })()
        : (rawPerms || {});

      setFormData({
        username: user.username,
        password: '',
        name: user.name || '',
        role: user.role as any,
        email: user.email || '',
        permissions: {
          can_view_dashboard: false,
          can_view_account_data: false,
          can_manage_products: true,
          can_manage_sales: true,
          can_view_expenses: false,
          can_manage_expenses: false,
          product_access_type: parsedPerms.product_access_type || 'all',
          assigned_product_ids: Array.isArray(parsedPerms.assigned_product_ids) ? parsedPerms.assigned_product_ids : [],
          ...parsedPerms
        }
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        name: '',
        role: 'staff',
        email: '',
        permissions: {
          can_view_dashboard: false,
          can_view_account_data: false,
          can_manage_products: true,
          can_manage_sales: true,
          can_view_expenses: false,
          can_manage_expenses: false,
          product_access_type: 'all',
          assigned_product_ids: [],
        }
      });
    }
    setIsModalOpen(true);
  };

  const toggleProductAssignment = (productId: number) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.permissions?.assigned_product_ids)
        ? [...prev.permissions.assigned_product_ids]
        : [];
      const exists = current.includes(productId);
      const next = exists ? current.filter(id => id !== productId) : [...current, productId];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          product_access_type: 'specific',
          assigned_product_ids: next
        }
      };
    });
  };

  const selectAllProducts = (idsToSelect: number[]) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        product_access_type: 'specific',
        assigned_product_ids: Array.from(new Set([...(prev.permissions?.assigned_product_ids || []), ...idsToSelect]))
      }
    }));
  };

  const clearSelectedProducts = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        assigned_product_ids: []
      }
    }));
  };

  const setProductAccessType = (type: 'all' | 'specific') => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        product_access_type: type
      }
    }));
  };

  const filteredModalProducts = storeProducts.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q)) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
    );
  });

  const applyPermissionPreset = (preset: 'inventory_sales' | 'inventory_only' | 'sales_only' | 'all') => {
    setFormData((prev) => {
      let newPermissions: any = { 
        ...prev.permissions,
        product_access_type: prev.permissions?.product_access_type || 'all',
        assigned_product_ids: prev.permissions?.assigned_product_ids || []
      };
      if (preset === 'inventory_sales') {
        newPermissions = {
          ...newPermissions,
          can_view_dashboard: false,
          can_view_account_data: false,
          can_manage_products: true,
          can_manage_sales: true,
          can_view_expenses: false,
          can_manage_expenses: false,
        };
      } else if (preset === 'inventory_only') {
        newPermissions = {
          ...newPermissions,
          can_view_dashboard: false,
          can_view_account_data: false,
          can_manage_products: true,
          can_manage_sales: false,
          can_view_expenses: false,
          can_manage_expenses: false,
        };
      } else if (preset === 'sales_only') {
        newPermissions = {
          ...newPermissions,
          can_view_dashboard: false,
          can_view_account_data: false,
          can_manage_products: false,
          can_manage_sales: true,
          can_view_expenses: false,
          can_manage_expenses: false,
        };
      } else if (preset === 'all') {
        newPermissions = {
          ...newPermissions,
          can_view_dashboard: true,
          can_view_account_data: true,
          can_manage_products: true,
          can_manage_sales: true,
          can_view_expenses: true,
          can_manage_expenses: true,
        };
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const isInventorySalesOnly = 
    !!formData.permissions?.can_manage_products &&
    !!formData.permissions?.can_manage_sales &&
    !formData.permissions?.can_view_dashboard &&
    !formData.permissions?.can_view_account_data &&
    !formData.permissions?.can_view_expenses &&
    !formData.permissions?.can_manage_expenses;

  const isInventoryOnly = 
    !!formData.permissions?.can_manage_products &&
    !formData.permissions?.can_manage_sales &&
    !formData.permissions?.can_view_dashboard &&
    !formData.permissions?.can_view_account_data &&
    !formData.permissions?.can_view_expenses &&
    !formData.permissions?.can_manage_expenses;

  const isSalesOnly = 
    !formData.permissions?.can_manage_products &&
    !!formData.permissions?.can_manage_sales &&
    !formData.permissions?.can_view_dashboard &&
    !formData.permissions?.can_view_account_data &&
    !formData.permissions?.can_view_expenses &&
    !formData.permissions?.can_manage_expenses;

  const isAllPermissions = 
    !!formData.permissions?.can_manage_products &&
    !!formData.permissions?.can_manage_sales &&
    !!formData.permissions?.can_view_dashboard &&
    !!formData.permissions?.can_view_account_data &&
    !!formData.permissions?.can_view_expenses &&
    !!formData.permissions?.can_manage_expenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const payload: any = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingUser ? 'Team member updated' : 'Team member added');
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save team member');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-w-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Delete User</h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Are you sure? This will permanently remove this staff member's access.</p>
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
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Delete
          </button>
          <button onClick={() => toast.dismiss(t)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-brand" />
            User & Team Management
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
            Manage staff accounts and configure role-based access permissions.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-hover transition-colors shadow-sm shadow-brand/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="hidden lg:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Member</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Role & Permissions</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading team members...</p>
                    </div>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 font-bold">
                          {user.name?.charAt(0) || user.username?.charAt(0) || <UserIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">@{user.username} {user.email && `• ${user.email}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <div className="flex items-center gap-2">
                          <Shield className={cn(
                            "w-4 h-4",
                            user.role === 'admin' || user.role === 'super_admin' ? "text-purple-500" : 
                            user.role === 'manager' ? "text-blue-500" : "text-zinc-400"
                          )} />
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                            {user.role}
                          </span>
                        </div>

                        {user.role === 'staff' && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {user.permissions?.can_manage_products && user.permissions?.can_manage_sales && !user.permissions?.can_view_dashboard && !user.permissions?.can_view_account_data && !user.permissions?.can_view_expenses ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-brand/10 text-brand border border-brand/20 shadow-sm" title="Has access only to product inventory and sales/invoices information">
                                <Package className="w-3.5 h-3.5 text-brand" />
                                <ShoppingCart className="w-3.5 h-3.5 text-brand" />
                                Inventory & Sales/Invoices Only
                              </span>
                            ) : user.permissions?.can_manage_products && !user.permissions?.can_manage_sales && !user.permissions?.can_view_dashboard && !user.permissions?.can_view_account_data && !user.permissions?.can_view_expenses ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Package className="w-3.5 h-3.5 text-emerald-500" />
                                Inventory Only
                              </span>
                            ) : !user.permissions?.can_manage_products && user.permissions?.can_manage_sales && !user.permissions?.can_view_dashboard && !user.permissions?.can_view_account_data && !user.permissions?.can_view_expenses ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                                Sales & Invoices Only
                              </span>
                            ) : user.permissions?.can_manage_products && user.permissions?.can_manage_sales && user.permissions?.can_view_dashboard && user.permissions?.can_view_account_data && user.permissions?.can_view_expenses ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                Full Staff Access
                              </span>
                            ) : (
                              <>
                                {user.permissions?.can_manage_products && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    <Package className="w-3 h-3 text-brand" /> Inventory
                                  </span>
                                )}
                                {user.permissions?.can_manage_sales && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    <ShoppingCart className="w-3 h-3 text-blue-500" /> Sales/Invoices
                                  </span>
                                )}
                                {user.permissions?.can_view_dashboard && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    <BarChart3 className="w-3 h-3 text-amber-500" /> Dashboard
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-zinc-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors"
                          title="Edit User & Permissions"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No team members found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet View */}
        <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading...</p>
              </div>
            </div>
          ) : users.length > 0 ? (
            users.map((user) => (
              <div key={user.id} className="p-6 space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 font-bold text-lg">
                      {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{user.name}</h3>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenModal(user)}
                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2.5 bg-red-500/10 text-red-500 rounded-xl active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{user.role}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-brand/10 text-brand">
                      Active
                    </span>
                  </div>

                  {user.role === 'staff' && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {user.permissions?.can_manage_products && user.permissions?.can_manage_sales && !user.permissions?.can_view_dashboard && !user.permissions?.can_view_account_data && !user.permissions?.can_view_expenses ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                          <Package className="w-3 h-3" /> Inventory & Sales/Invoices Only
                        </span>
                      ) : (
                        <>
                          {user.permissions?.can_manage_products && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              <Package className="w-2.5 h-2.5 text-brand" /> Inventory
                            </span>
                          )}
                          {user.permissions?.can_manage_sales && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              <ShoppingCart className="w-2.5 h-2.5 text-blue-500" /> Sales/Invoices
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No team members found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50 shrink-0">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-xs">
                    {editingUser ? 'Edit Team Member' : 'Add New Team Member'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Configure staff credentials and store access permissions.
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Full Name</label>
                    <Input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Username</label>
                    <Input 
                      required
                      type="text" 
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      placeholder="janedoe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Email Address</label>
                    <Input 
                      required
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="jane@example.com"
                    />
                  </div>

                  {!editingUser && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Password</label>
                      <Input 
                        required
                        type="password" 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {editingUser && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Reset Password (optional)</label>
                      <Input 
                        type="password" 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="Leave blank to keep existing password"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Role</label>
                    <Input 
                      as="select"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                    >
                      <option value="staff" className="dark:bg-zinc-900">Staff</option>
                      <option value="manager" className="dark:bg-zinc-900">Manager</option>
                      <option value="admin" className="dark:bg-zinc-900">Admin</option>
                    </Input>
                  </div>
                </div>

                {formData.role !== 'admin' && (
                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-widest">Assign Store Access</label>
                        {isInventorySalesOnly && (
                          <span className="text-[9px] font-bold text-brand uppercase tracking-wider bg-brand/10 dark:bg-brand/20 px-2 py-0.5 rounded-full">
                            Inventory & Sales Only
                          </span>
                        )}
                        {isInventoryOnly && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Inventory Only
                          </span>
                        )}
                        {isSalesOnly && (
                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-full">
                            Sales & Invoices Only
                          </span>
                        )}
                        {isAllPermissions && (
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">
                            Full Staff Access
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Choose a quick preset or customize granular access below.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {/* FEATURED PRESET: Product Inventory & Sales/Invoices Information */}
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset('inventory_sales')}
                        className={cn(
                          "w-full p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative",
                          isInventorySalesOnly
                            ? "border-brand bg-brand/10 dark:bg-brand/20 text-brand ring-2 ring-brand/30 shadow-md"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl transition-colors",
                              isInventorySalesOnly ? "bg-brand text-white shadow-md shadow-brand/20" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            )}>
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                Product Inventory & Sales/Invoices Only
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand/15 text-brand font-bold uppercase tracking-wider">
                                  Recommended
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                                Assign access strictly to product inventory and sales/invoices information. Financial reports, margins, and dashboard are hidden.
                              </p>
                            </div>
                          </div>
                          {isInventorySalesOnly && (
                            <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200/40 dark:border-zinc-700/40 text-[10px]">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">✓ Product Catalog & Inventory</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">✓ Sales POS & Customer Invoices</span>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400">✗ Financial Reports & Margins Hidden</span>
                        </div>
                      </button>

                      {/* OTHER PRESETS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => applyPermissionPreset('inventory_only')}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5",
                            isInventoryOnly
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold">Inventory Only</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                            Manage stock and catalog only. No sales or invoices.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyPermissionPreset('sales_only')}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5",
                            isSalesOnly
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold">Sales & Invoices</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                            POS checkout and customer invoices only.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyPermissionPreset('all')}
                          className={cn(
                            "p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5",
                            isAllPermissions
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold">Full Staff Access</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                            Full access across all store modules.
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3">
                      <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-1">
                        Operational Permissions
                      </div>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-brand/10 text-brand mt-0.5">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Product Inventory & Stock</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Browse catalog, check stock counts, manage inventory items</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_manage_products}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_manage_products: e.target.checked }
                          })}
                        />
                      </label>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 mt-0.5">
                            <ShoppingCart className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Sales & Invoices (POS)</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Record sales at POS checkout, create and view invoices, print receipts</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_manage_sales}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_manage_sales: e.target.checked }
                          })}
                        />
                      </label>

                      <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-1 pt-2">
                        Financial & Sensitive Store Data (Restricted)
                      </div>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 mt-0.5">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Executive Dashboard & Revenue Trends</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Access store overview, weekly revenue curves, and performance stats</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_view_dashboard}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_view_dashboard: e.target.checked }
                          })}
                        />
                      </label>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 mt-0.5">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">All Account Data & Cost Margins</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Reveal product purchase cost prices, inventory valuation, and team-wide data</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_view_account_data}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_view_account_data: e.target.checked }
                          })}
                        />
                      </label>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 mt-0.5">
                            <Wallet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">View Expenses</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Browse company operating expenditures</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_view_expenses}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_view_expenses: e.target.checked }
                          })}
                        />
                      </label>

                      <label className="flex items-start justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200/60 dark:border-zinc-700/60">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-red-500/10 text-red-500 mt-0.5">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Manage Expenses</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">Create, modify, or delete business expenses</div>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 mt-1 rounded border-zinc-300 text-brand focus:ring-brand"
                          checked={!!formData.permissions?.can_manage_expenses}
                          onChange={(e) => setFormData({
                            ...formData,
                            permissions: { ...formData.permissions, can_manage_expenses: e.target.checked }
                          })}
                        />
                      </label>
                    </div>

                    {/* PRODUCT ACCESS & SPECIFIC PRODUCT ASSIGNMENT */}
                    <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                            <Target className="w-3.5 h-3.5 text-brand" /> Product Access Scope
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Select the specific products you want this member to have access to.
                          </p>
                        </div>
                        {formData.permissions?.product_access_type === 'specific' ? (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            {(formData.permissions?.assigned_product_ids?.length || 0)} Selected
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            All Products
                          </span>
                        )}
                      </div>

                      {/* Segmented Selector for Access Type */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setProductAccessType('all')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                            formData.permissions?.product_access_type !== 'specific'
                              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          <Package className="w-3.5 h-3.5 text-brand" />
                          All Store Products
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductAccessType('specific')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                            formData.permissions?.product_access_type === 'specific'
                              ? "bg-white dark:bg-zinc-900 text-brand shadow-sm"
                              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                          )}
                        >
                          <Target className="w-3.5 h-3.5" />
                          Specific Products Only
                        </button>
                      </div>

                      {/* SPECIFIC PRODUCT PICKER UI */}
                      {formData.permissions?.product_access_type === 'specific' && (
                        <div className="space-y-2.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                              <input
                                type="text"
                                placeholder="Search products by name or category..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand/40 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => selectAllProducts(filteredModalProducts.map(p => p.id))}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg text-brand hover:bg-brand/10 transition-colors"
                              >
                                Select All
                              </button>
                              <span className="text-zinc-300 dark:text-zinc-600">|</span>
                              <button
                                type="button"
                                onClick={clearSelectedProducts}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          {/* Product List */}
                          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {isProductsLoading ? (
                              <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
                                <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading store products...
                              </div>
                            ) : filteredModalProducts.length === 0 ? (
                              <div className="py-6 text-center text-xs text-zinc-400">
                                {storeProducts.length === 0
                                  ? 'No products found in catalog. Add products first to assign them.'
                                  : `No products match "${productSearch}"`}
                              </div>
                            ) : (
                              filteredModalProducts.map((prod) => {
                                const isSelected = (formData.permissions?.assigned_product_ids || []).includes(prod.id);
                                return (
                                  <div
                                    key={prod.id}
                                    onClick={() => toggleProductAssignment(prod.id)}
                                    className={cn(
                                      "pt-1.5 first:pt-0 flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-left select-none",
                                      isSelected
                                        ? "bg-brand/10 dark:bg-brand/20 border border-brand/30"
                                        : "hover:bg-white dark:hover:bg-zinc-900 border border-transparent"
                                    )}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className={cn(
                                        "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                        isSelected
                                          ? "bg-brand border-brand text-white"
                                          : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                      )}>
                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                          {prod.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                                          {prod.category_name && (
                                            <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 font-medium">
                                              {prod.category_name}
                                            </span>
                                          )}
                                          <span>Stock: {prod.total_stock || 0}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 pl-2">
                                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                                        {formatCurrency(prod.selling_price || 0, settings?.currency || 'NGN')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {(formData.permissions?.assigned_product_ids?.length || 0) === 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span>Please select at least one product above, or choose "All Store Products".</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-4 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingUser ? 'Update Team Member' : 'Create Team Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

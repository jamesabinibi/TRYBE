export type Role = 'admin' | 'manager' | 'staff' | 'owner' | 'super_admin';

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  email?: string;
  account_id?: number;
  subscription_plan?: string;
  subscription_status?: string;
  account_type?: string;
  business_type?: string;
  referral_code?: string;
  referral_count?: number;
  referrals_for_reward?: number;
  active_referral_count?: number;
  invoice_count_month?: number;
  last_invoice_reset?: string;
  trial_expiry?: string;
  permissions?: {
    can_view_dashboard: boolean;
    can_view_account_data: boolean;
    can_manage_products: boolean;
    can_manage_sales: boolean;
    can_view_expenses: boolean;
    can_manage_expenses: boolean;
  };
}

export interface Category {
  id: number;
  name: string;
}

export interface Variant {
  id: number;
  product_id: number;
  size: string;
  color: string;
  quantity: number;
  low_stock_threshold: number;
  price_override?: number;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface Product {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  description: string;
  cost_price: number;
  selling_price: number;
  supplier_name: string;
  created_at: string;
  total_stock: number;
  product_type: 'one' | 'multiple';
  variants: Variant[];
  images: string[];
}

export interface Sale {
  id: number;
  invoice_number: string;
  total_amount: number;
  total_profit: number;
  payment_method: string;
  staff_id: number;
  staff_name?: string;
  created_at: string;
  customer_id?: number;
  customer_name?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  variant_id: number;
  quantity: number;
  selling_price: number;
  cost_price: number;
  profit: number;
  unit_price?: number;
  product_variants?: {
    size: string;
    color: string;
    products?: {
      name: string;
    };
  };
}

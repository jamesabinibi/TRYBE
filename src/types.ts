export type Role = 'admin' | 'manager' | 'staff';

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  email?: string;
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
}

export interface SaleItem {
  id: number;
  sale_id: number;
  variant_id: number;
  quantity: number;
  selling_price: number;
  cost_price: number;
  profit: number;
}

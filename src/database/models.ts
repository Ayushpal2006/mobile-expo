/**
 * Orion POS Mobile Expo - Local SQLite Database Models
 */

export interface DBProduct {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  selling_price: number; // in paise
  cost_price?: number | null; // in paise
  stock: number;
  gst?: number | null;
  category?: string | null;
  unit?: string | null;
  image_url?: string | null;
  min_stock_level?: number | null;
  is_archived?: number | null; // 1 or 0
  is_active?: number | null; // 1 or 0
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBCustomer {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  gstin?: string | null;
  total_purchases: number;
  total_spent: number; // in paise
  last_visit?: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBSale {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  local_id: string;
  invoice_number: string;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  subtotal: number; // in paise
  discount: number; // in paise
  tax: number; // in paise
  total_amount: number; // in paise
  paid_amount?: number | null; // in paise
  balance?: number | null; // in paise
  round_off?: number | null; // in paise
  payment_method: string;
  payment_details?: string | null;
  notes?: string | null;
  cashier_name?: string | null;
  status?: string | null; // 'completed' | 'voided'
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  public_token?: string | null;
  client_mutation_id?: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBSaleItem {
  id: number;
  sale_id: number;
  product_id?: number | null;
  product_name: string;
  quantity: number;
  unit_price: number; // in paise
  discount?: number | null; // in percentage or paise
  subtotal: number; // in paise
  created_at: string;
}

export interface DBExpense {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  category: string;
  amount: number; // in paise
  date: string;
  payment_mode?: string | null;
  notes?: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBSupplier {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  total_purchases: number; // in paise
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface DBStockAdjustment {
  id: number;
  server_id?: number | null;
  store_id?: number | null;
  product_id: number;
  product_name: string;
  adjustment_type: 'INCREASE' | 'DECREASE' | 'SET';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  notes?: string | null;
  adjusted_by?: string | null;
  sync_status: string;
  created_at: string;
}

export interface DBHeldCart {
  id: number;
  store_id: number;
  cart_name: string;
  customer_id?: number | null;
  customer_name?: string | null;
  cart_payload: string;
  total_amount: number; // in paise
  created_at: string;
  updated_at: string;
}

export interface DBSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface DBOutbox {
  id: number;
  entity_type: 'sale' | 'product' | 'customer' | 'purchase' | 'expense' | 'supplier' | 'stock_adjustment' | 'settings';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID';
  payload: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'AUTH_REQUIRED';
  attempt_count: number;
  last_attempt_at?: string | null;
  last_error?: string | null;
  created_at: string;
}



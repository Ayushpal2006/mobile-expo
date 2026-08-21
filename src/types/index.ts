/**
 * Orion POS Mobile Expo - Shared Type Definitions
 */

export type SyncStatus =
  | 'IDLE'
  | 'SYNCING'
  | 'SYNCED'
  | 'OFFLINE'
  | 'PENDING'
  | 'FAILED'
  | 'AUTH_REQUIRED'
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'failed';
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'AUTH_REQUIRED';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  organization_id?: number;
  store_id: number;
}

export interface OrganizationContext {
  id: number;
  name: string;
  code?: string;
  status?: string;
  currency?: string;
}

export interface StoreContext {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  organization_id?: number;
}

export interface AuthSessionData {
  token: string;
  user: AuthUser;
  organization: OrganizationContext | null;
  store: StoreContext | null;
  organizationStatus?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface ApiRequestOptions {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

export interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: (options?: { force?: boolean }) => Promise<T | null>;
}

export interface HealthCheckResult {
  ok: boolean;
  status: number;
  statusText: string;
  responseTimeMs: number;
  url: string;
  error?: string;
}

export type MainTabType =
  | 'dashboard'
  | 'billing'
  | 'bills'
  | 'products'
  | 'adjust-stock'
  | 'stock-history'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'profit'
  | 'expenses'
  | 'reports'
  | 'settings';


// Domain Entities

export interface Product {
  id: number;
  server_id?: number;
  store_id?: number;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  selling_price?: number;
  cost_price?: number;
  stock: number;
  gst?: number;
  category?: string;
  unit?: string;
  image_url?: string;
  imageUrl?: string;
  min_stock_level?: number;
  is_archived?: boolean;
  is_active?: boolean;
  sync_status?: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: number;
  server_id?: number;
  store_id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  gstin?: string;
  total_purchases?: number;
  total_spent?: number;
  last_visit?: string;
  sync_status?: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount?: number; // Line discount %
}

export interface CheckoutItemPayload {
  productId: number;
  product_id?: number;
  name?: string;
  quantity: number;
  unitPrice?: number;
  selling_price?: number;
  discount?: number; // Line discount %
  lineTotal?: number;
}

export interface CheckoutPayload {
  offlineIdentifier?: string;
  customerPhone?: string;
  customerName?: string;
  customerId?: number;
  paymentMethod: string;
  cashierName?: string;
  items: CheckoutItemPayload[];
  subtotal?: number;
  discount?: number;
  gst?: number;
  roundOff?: number;
  round_off?: number;
  grandTotal?: number;
  paidAmount?: number;
  balance?: number;
  notes?: string;
  clientMutationId?: string;
  client_mutation_id?: string;
  storeId?: number;
}

export interface SaleInvoiceItem {
  id?: number;
  product_id?: number;
  productId?: number;
  product_name?: string;
  productName?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  selling_price?: number;
  discount?: number;
  subtotal?: number;
  lineTotal?: number;
}

export interface SaleInvoice {
  id: number;
  server_id?: number;
  store_id?: number;
  local_id?: string;
  invoice_number?: string;
  invoiceNumber?: string;
  customer_id?: number;
  customer_name?: string;
  customerName?: string;
  customer_phone?: string;
  customerPhone?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  gst?: number;
  round_off?: number;
  roundOff?: number;
  total_amount?: number;
  grandTotal?: number;
  paid_amount?: number;
  balance?: number;
  payment_method?: string;
  paymentMethod?: string;
  payment_details?: string;
  notes?: string;
  cashier_name?: string;
  cashierName?: string;
  status?: 'completed' | 'voided';
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  public_token?: string;
  client_mutation_id?: string;
  sync_status?: SyncStatus;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  items?: SaleInvoiceItem[];
}

export interface DashboardData {
  todayRevenue: number;
  todayOrders: number;
  todayProfit: number;
  inventoryCount: number;
  lowStockCount: number;
  topProducts: Array<{ id: number; name: string; totalSold: number; revenue: number }>;
  recentSales: Array<{ id: number; invoiceNumber: string; grandTotal: number; createdAt: string; status?: string }>;
}

export interface PurchaseItem {
  id?: number;
  product_id?: number;
  productId?: number;
  product_name?: string;
  productName?: string;
  quantity: number;
  cost_price?: number;
  costPrice?: number;
}

export interface Purchase {
  id: number;
  server_id?: number;
  store_id?: number;
  supplier_name?: string;
  supplierName?: string;
  supplier_id?: number;
  invoice_number?: string;
  invoiceNumber?: string;
  total_amount?: number;
  totalAmount?: number;
  created_at?: string;
  createdAt?: string;
  status?: string;
  items?: PurchaseItem[];
}

export interface Supplier {
  id: number;
  server_id?: number;
  store_id?: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  total_purchases?: number;
  sync_status?: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: number;
  server_id?: number;
  store_id?: number;
  category: string;
  amount: number;
  date: string;
  payment_mode?: string;
  notes?: string;
  sync_status?: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface StockAdjustment {
  id: number;
  server_id?: number;
  store_id?: number;
  product_id: number;
  product_name: string;
  adjustment_type: 'INCREASE' | 'DECREASE' | 'SET';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: 'DAMAGED' | 'SPOILED' | 'RESTOCKED' | 'CORRECTION' | 'THEFT' | 'AUDIT' | 'OTHER';
  notes?: string;
  adjusted_by?: string;
  sync_status?: SyncStatus;
  created_at: string;
}

export interface HeldCart {
  id: number;
  store_id: number;
  cart_name: string;
  customer_id?: number;
  customer_name?: string;
  cart_payload: string; // JSON
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ReportData {
  todayRevenue?: number;
  totalSales?: number;
  totalRevenue?: number;
  totalGstCollected?: number;
  todayOrdersCount?: number;
  totalOrdersCount?: number;
  totalExpenses?: number;
  netProfit?: number;
  topCategories?: Array<{ category: string; count: number; revenue: number }>;
  paymentBreakdown?: Array<{ method: string; count: number; total: number }>;
}

export interface StoreSettings {
  // General & Shop
  storeName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  upiId?: string;
  taxRate?: number;
  currencySymbol?: string;
  timezone?: string;
  language?: string;

  // Org Profile
  organizationName?: string;
  website?: string;
  stateProvince?: string;

  // Branding
  logoUrl?: string;
  tagline?: string;
  accentColor?: string;

  // Billing POS
  invoicePrefix?: string;
  invoiceStartNumber?: string;
  allowNegativeStock?: boolean;
  quickBillingMode?: boolean;
  autoPrintReceipt?: boolean;
  roundOffDefault?: boolean;
  invoiceHeader?: string;
  invoiceFooter?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  termsAndConditions?: string;

  // Purchase POS
  purchasePrefix?: string;
  purchaseStartNumber?: string;
  autofillPurchaseCost?: boolean;
  autoSaveDrafts?: boolean;

  // Inventory
  lowStockThreshold?: number;
  autoGenSkuPrefix?: string;
  defaultHsnCode?: string;

  // Printing & Hardware
  enableThermalPrint?: boolean;
  paperWidth?: '58mm' | '80mm';
  activePrinterDriver?: string;
  printerName?: string;
  printerMacAddress?: string;
  printerIpAddress?: string;
  printerType?: 'Bluetooth' | 'USB' | 'Network' | 'Native';

  // Invoice & Templates
  receiptTemplate?: 'Classic' | 'Modern' | 'Retail' | 'Compact' | 'Detailed';
  invoiceTemplate?: string;
  upiQrEnabled?: boolean;

  // WhatsApp
  whatsappTemplate?: string;
  whatsappTemplateCustom?: string;
  whatsappFooter?: string;

  // Advanced & System
  apiEndpoint?: string;
  syncIntervalSeconds?: number;
  offlineDbVersion?: string;
}


export interface OutboxEvent {
  id: number;
  entity_type: 'sale' | 'product' | 'customer' | 'purchase' | 'expense' | 'supplier' | 'stock_adjustment' | 'settings';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID';
  payload: string;
  status: OutboxStatus;
  attempt_count: number;
  last_attempt_at?: string | null;
  last_error?: string | null;
  created_at: string;
}



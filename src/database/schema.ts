/**
 * Orion POS Mobile Expo - SQLite DDL Schema & Index Definitions
 */

export const SCHEMA_V1 = `
-- Schema Migrations Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  selling_price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  gst INTEGER DEFAULT 18,
  category TEXT,
  unit TEXT,
  is_active INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_server_id ON products(server_id);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gstin TEXT,
  total_purchases INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'synced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  local_id TEXT UNIQUE NOT NULL,
  invoice_number TEXT NOT NULL,
  customer_id INTEGER,
  customer_name TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  cashier_name TEXT,
  sync_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_local_id ON sales(local_id);
CREATE INDEX IF NOT EXISTS idx_sales_sync_status ON sales(sync_status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);

-- Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Outbox Events Queue Table
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);
`;

export const SCHEMA_V2 = `
-- Printer Profiles Table (Migration 002)
CREATE TABLE IF NOT EXISTS printer_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  address TEXT,
  paper_width INTEGER DEFAULT 58,
  is_default INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_printer_profiles_store ON printer_profiles(store_id);
`;

export const SCHEMA_V3 = `
-- Purchases Table (Migration 003)
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  store_id INTEGER NOT NULL DEFAULT 1,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed',
  sync_status TEXT DEFAULT 'synced',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_store ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_server ON purchases(server_id);

-- Purchase Items Table (Migration 003)
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_pid ON purchase_items(purchase_id);

-- Sync Metadata Table (Migration 003)
CREATE TABLE IF NOT EXISTS sync_metadata (
  domain TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL DEFAULT 1,
  last_pull_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  pending_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

export const SCHEMA_V4 = `
-- Products image_url column (Migration 004)
ALTER TABLE products ADD COLUMN image_url TEXT;
`;

export const SCHEMA_V5_STATEMENTS = [
  // Sales table enhancements
  `ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed';`,
  `ALTER TABLE sales ADD COLUMN store_id INTEGER DEFAULT 1;`,
  `ALTER TABLE sales ADD COLUMN customer_phone TEXT;`,
  `ALTER TABLE sales ADD COLUMN paid_amount INTEGER DEFAULT 0;`,
  `ALTER TABLE sales ADD COLUMN balance INTEGER DEFAULT 0;`,
  `ALTER TABLE sales ADD COLUMN public_token TEXT;`,
  `ALTER TABLE sales ADD COLUMN payment_details TEXT;`,
  `ALTER TABLE sales ADD COLUMN void_reason TEXT;`,
  `ALTER TABLE sales ADD COLUMN voided_at TEXT;`,
  `ALTER TABLE sales ADD COLUMN voided_by TEXT;`,

  // Sale items discount enhancement
  `ALTER TABLE sale_items ADD COLUMN discount INTEGER DEFAULT 0;`,

  // Products & Customers tenant isolation enhancements
  `ALTER TABLE products ADD COLUMN store_id INTEGER DEFAULT 1;`,
  `ALTER TABLE customers ADD COLUMN store_id INTEGER DEFAULT 1;`,
  `ALTER TABLE customers ADD COLUMN notes TEXT;`,
  `ALTER TABLE customers ADD COLUMN last_visit TEXT;`,

  // Performance & Tenant Indexes
  `CREATE INDEX IF NOT EXISTS idx_sales_store_status ON sales(store_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);`,
  `CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);`,
];

export const SCHEMA_V6_STATEMENTS = [
  // Expenses Table
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,
    store_id INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    payment_mode TEXT DEFAULT 'Cash',
    notes TEXT,
    sync_status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, date);`,

  // Suppliers Table
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,
    store_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    total_purchases INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);`,

  // Stock Adjustments Table
  `CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER UNIQUE,
    store_id INTEGER NOT NULL DEFAULT 1,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT,
    adjusted_by TEXT,
    sync_status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_stock_adj_store ON stock_adjustments(store_id);`,

  // Held Carts Table (Cashier Draft / Hold Cart)
  `CREATE TABLE IF NOT EXISTS held_carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL DEFAULT 1,
    cart_name TEXT NOT NULL,
    customer_id INTEGER,
    customer_name TEXT,
    cart_payload TEXT NOT NULL,
    total_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_held_carts_store ON held_carts(store_id);`,

  // Products enhancements (low stock threshold, archive state)
  `ALTER TABLE products ADD COLUMN min_stock_level INTEGER DEFAULT 5;`,
  `ALTER TABLE products ADD COLUMN is_archived INTEGER DEFAULT 0;`,

  // Sales enhancements (notes, round-off, idempotency client mutation ID)
  `ALTER TABLE sales ADD COLUMN notes TEXT;`,
  `ALTER TABLE sales ADD COLUMN round_off INTEGER DEFAULT 0;`,
  `ALTER TABLE sales ADD COLUMN client_mutation_id TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_sales_client_mutation ON sales(client_mutation_id);`,
];

export const SCHEMA_V7_STATEMENTS = [
  // Multi-Tenant organization_id support
  `ALTER TABLE products ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE customers ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE suppliers ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE sales ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE purchases ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE expenses ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE stock_adjustments ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE held_carts ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE printer_profiles ADD COLUMN organization_id INTEGER DEFAULT 1;`,
  `ALTER TABLE outbox ADD COLUMN store_id INTEGER DEFAULT 1;`,
  `ALTER TABLE outbox ADD COLUMN organization_id INTEGER DEFAULT 1;`,

  // High-performance store-scoped composite indexes
  `CREATE INDEX IF NOT EXISTS idx_products_store_server ON products(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_products_store_sku ON products(store_id, sku);`,
  `CREATE INDEX IF NOT EXISTS idx_products_store_barcode ON products(store_id, barcode);`,
  `CREATE INDEX IF NOT EXISTS idx_customers_store_server ON customers(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_customers_store_phone ON customers(store_id, phone);`,
  `CREATE INDEX IF NOT EXISTS idx_suppliers_store_server ON suppliers(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_store_server ON purchases(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_store_server ON sales(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_store_server ON expenses(store_id, server_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_adj_store_server ON stock_adjustments(store_id, server_id);`,
];



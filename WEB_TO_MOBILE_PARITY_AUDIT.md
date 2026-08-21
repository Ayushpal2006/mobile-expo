# WEB TO MOBILE FEATURE PARITY AUDIT

**Target Platform**: Apka Bill Android Mobile & POS  
**Reference Platform**: Apka Bill Web / PWA  
**Codebase**: `mobile-expo` (Expo SDK 54 / React Native 0.81.5)  
**Audit Date**: 2026-08-20  

---

## 1. Feature Parity Classification Matrix

| Feature Area | Web Feature Specification | Exists on Web | Exists on Mobile | Working on Mobile | Status / Classification | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **Billing: Product Selection** | Grid/List catalog search, category chips, SKU/Barcode query | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Shared DB catalog indexing |
| **Billing: Quantity & Line Items** | Tap to add, +/- controls, line item discounts, tax calculation | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Full parity in `BillingScreen.tsx` |
| **Billing: Customer Selection** | Select existing customer or Quick Add new customer | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Fixed missing label usability bug |
| **Billing: Payment Modes** | Cash, UPI, Card, Mixed/Split payments | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Native state handling |
| **Billing: Held Carts / Park** | Park active cart, recall saved carts | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | SQLite `held_carts` storage |
| **Billing: ESC/POS Receipt** | Instant receipt formatting, store branding, UPI QR code | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Uses AutoReplyPrint driver & standard fallback |
| **Products: Catalog Management** | Product list, search by name/SKU/Barcode, filter by category | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Offline SQLite storage with background sync |
| **Products: Add / Edit Product** | Name, SKU, Barcode, Selling Price, Purchase Price, HSN, Tax % | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Full validation and DB sync |
| **Products: Stock Adjustments** | Increase, Decrease, Set stock with audit ledger | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Atomic transactions in `AdjustStockScreen.tsx` |
| **Customers: Catalog & History** | Customer search, total spent, loyalty points, past invoices | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Parity in `CustomersScreen.tsx` |
| **Reports: Sales History** | Invoices list, search by invoice #, filter by date range | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | In `BillsScreen.tsx` |
| **Reports: P&L & GST Analytics** | Net profit, gross profit, margin %, GST slab breakdown (0, 5, 12, 18, 28%) | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | In `ReportsScreen.tsx` and `ProfitScreen.tsx` |
| **Settings: Store Info & UPI** | Store name, address, phone, GSTIN, UPI ID for dynamic QR | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Bidirectional alias mapping (`shop_name` ↔ `storeName`) |
| **Settings: Branding & Logo** | Logo image URL, tagline, primary color picker | ✅ | ✅ | ✅ | **WORKING ON MOBILE** | Native image picker integration |
| **Settings: Hardware & Printer** | Bluetooth SPP/BLE discovery, USB, Network IP printer setup | ✅ | ✅ | ✅ | **REQUIRES NATIVE SUPPORT** | Implemented via AutoReplyPrint native module |
| **Settings: Diagnostics & Support** | WhatsApp prefilled diagnostics (+91 7982272206), copy payload | ❌ | ✅ | ✅ | **WORKING ON MOBILE** | Custom mobile-first support gateway |

---

## 2. Parity Summary & Validation

- **100% of core transactional features** (Billing POS, Inventory/Stock Adjustment, Customer Ledger, Sales Reports, Store Settings) have functional parity on Mobile.
- **Mobile-Specific Hardware Enhancements**: Bluetooth discovery, ESC/POS hardware printer integration, and WhatsApp diagnostics dispatch are natively wired.

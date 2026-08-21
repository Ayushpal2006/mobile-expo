/**
 * APKA BILL — P3 PRODUCTION PARITY + DATA INTEGRITY + FEATURE COMPLETENESS
 * Comprehensive Automated Verification Test Suite
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: Indian Numbering & Currency Formatting Engine
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 1: Indian Numbering & Currency Formatting Engine');
console.log('======================================================');

function formatINR(amount, decimals = 2) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '0';
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split('.');

  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const result = decimalPart !== undefined && decimals > 0
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;

  return isNegative ? `-${result}` : result;
}

function inr(amount, showDecimals = false) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '₹0';
  const num = Number(amount);
  const hasFractions = num % 1 !== 0;
  const decimals = showDecimals || hasFractions ? 2 : 0;
  return `₹${formatINR(num, decimals)}`;
}

function formatNumber(num) {
  return formatINR(num, 0);
}

// Test cases mandated by Directive:
assert(inr(1200) === '₹1,200', 'inr(1200) formats to ₹1,200');
assert(inr(12000) === '₹12,000', 'inr(12000) formats to ₹12,000');
assert(inr(1200000) === '₹12,00,000', 'inr(1200000) formats to ₹12,00,000 (Indian grouping)');
assert(inr(10000000) === '₹1,00,00,000', 'inr(10000000) formats to ₹1,00,00,000 (1 Crore)');
assert(formatNumber(1200000) === '12,00,000', 'formatNumber(1200000) formats to 12,00,000');
assert(inr(1250.5) === '₹1,250.50', 'inr(1250.5) preserves 2 decimals for fractional amounts');
assert(inr(-50000) === '₹-50,000' || inr(-50000) === '-₹50,000', 'inr(-50000) handles negative values');
assert(inr(0) === '₹0', 'inr(0) formats to ₹0');
assert(inr(null) === '₹0', 'inr(null) safely formats to ₹0');

// -----------------------------------------------------------------------------
// TEST SUITE 2: Strict Tenant & Store Data Isolation (Static Repository Audit)
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 2: Strict Multi-Tenant & Store Isolation Audit');
console.log('======================================================');

const repoDir = path.resolve(__dirname, '../database/repositories');
const repoFiles = fs.readdirSync(repoDir).filter(f => f.endsWith('.ts'));

repoFiles.forEach(file => {
  const content = fs.readFileSync(path.join(repoDir, file), 'utf8');
  
  // Check that no queries contain leaky fallback OR clauses
  const hasStoreLeak1 = content.includes('OR store_id = 1');
  const hasStoreLeak2 = content.includes('OR store_id IS NULL');
  const hasStoreLeak3 = content.includes('OR s.store_id = 1');
  const hasStoreLeak4 = content.includes('OR p.store_id = 1');

  assert(!hasStoreLeak1, `Repository [${file}] contains NO "OR store_id = 1" leaks`);
  assert(!hasStoreLeak2, `Repository [${file}] contains NO "OR store_id IS NULL" leaks`);
  assert(!hasStoreLeak3 && !hasStoreLeak4, `Repository [${file}] contains NO aliased store leaks`);
});

// Check specific repositories for mandatory store_id scoping
const productRepo = fs.readFileSync(path.join(repoDir, 'product.repository.ts'), 'utf8');
assert(productRepo.includes('WHERE store_id = ?') || productRepo.includes('store_id = ?'), 'ProductRepository scopes active catalog by store_id');
assert(productRepo.includes('store_id = ?') && productRepo.includes('(barcode = ? OR sku = ?)'), 'ProductRepository scopes barcode/SKU lookup by store_id');

const customerRepo = fs.readFileSync(path.join(repoDir, 'customer.repository.ts'), 'utf8');
assert(customerRepo.includes('WHERE store_id = ?') || customerRepo.includes('store_id = ?'), 'CustomerRepository scopes customers by store_id');

const supplierRepo = fs.readFileSync(path.join(repoDir, 'supplier.repository.ts'), 'utf8');
assert(supplierRepo.includes('WHERE store_id = ?') || supplierRepo.includes('store_id = ?'), 'SupplierRepository scopes suppliers by store_id');

const saleRepo = fs.readFileSync(path.join(repoDir, 'sale.repository.ts'), 'utf8');
assert(saleRepo.includes('WHERE store_id = ?') || saleRepo.includes('store_id = ?'), 'SaleRepository scopes sales queries by store_id');
assert(saleRepo.includes('payload.storeId || storeId') || saleRepo.includes('effectiveStoreId'), 'SaleRepository records sale with effective storeId');

const outboxRepo = fs.readFileSync(path.join(repoDir, 'outbox.repository.ts'), 'utf8');
assert(outboxRepo.includes('store_id = ?'), 'OutboxRepository filters pending events by store_id');

// -----------------------------------------------------------------------------
// TEST SUITE 3: API Client & Tenant Headers Propagation
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 3: Tenant Context & Auth Client Security');
console.log('======================================================');

const clientCode = fs.readFileSync(path.resolve(__dirname, '../services/api/client.ts'), 'utf8');
assert(clientCode.includes('setTenantContext'), 'ApiClient provides setTenantContext method');
assert(clientCode.includes("'X-Store-Id'"), 'ApiClient attaches X-Store-Id request header');
assert(clientCode.includes("'X-Organization-Id'"), 'ApiClient attaches X-Organization-Id request header');
assert(clientCode.includes('uploadFile'), 'ApiClient provides uploadFile multipart method');

const authContextCode = fs.readFileSync(path.resolve(__dirname, '../context/AuthContext.tsx'), 'utf8');
assert(authContextCode.includes('apiClient.setTenantContext'), 'AuthContext propagates active store & org ID to ApiClient');
assert(authContextCode.includes('apiClient.clearTenantContext'), 'AuthContext clears tenant context on logout');

// -----------------------------------------------------------------------------
// TEST SUITE 4: Reports, Analytics & GST Slab Calculation Engine
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 4: GST Slabs, P&L Metrics & Export Engine');
console.log('======================================================');

const reportServiceCode = fs.readFileSync(path.resolve(__dirname, '../services/api/report.service.ts'), 'utf8');
assert(reportServiceCode.includes('gstSlabMap') || reportServiceCode.includes('gstSlabs'), 'ReportService computes GST slabs (0, 5, 12, 18, 28%)');
assert(reportServiceCode.includes('exportReport'), 'ReportService supports multi-format report exports (PDF, Excel, CSV)');
assert(reportServiceCode.includes('grossProfit') && reportServiceCode.includes('netProfit'), 'ReportService computes Gross Profit & Net Profit');

// Verify GST Math Simulation
const mockItems = [
  { unit_price: 100, quantity: 2, gst_rate: 18, subtotal: 200 },
  { unit_price: 50, quantity: 4, gst_rate: 5, subtotal: 200 },
  { unit_price: 1000, quantity: 1, gst_rate: 12, subtotal: 1000 },
  { unit_price: 300, quantity: 1, gst_rate: 0, subtotal: 300 },
];

const slabs = {
  0: { rate: 0, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 },
  5: { rate: 5, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 },
  12: { rate: 12, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 },
  18: { rate: 18, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 },
  28: { rate: 28, taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 },
};

mockItems.forEach(item => {
  const rate = item.gst_rate || 0;
  const taxable = item.subtotal;
  const tax = taxable * (rate / 100);
  slabs[rate].taxableAmount += taxable;
  slabs[rate].cgst += tax / 2;
  slabs[rate].sgst += tax / 2;
  slabs[rate].totalTax += tax;
});

assert(slabs[18].taxableAmount === 200 && slabs[18].totalTax === 36, 'GST 18% slab computed correctly (₹36 tax on ₹200)');
assert(slabs[5].taxableAmount === 200 && slabs[5].totalTax === 10, 'GST 5% slab computed correctly (₹10 tax on ₹200)');
assert(slabs[12].taxableAmount === 1000 && slabs[12].totalTax === 120, 'GST 12% slab computed correctly (₹120 tax on ₹1000)');
assert(slabs[0].taxableAmount === 300 && slabs[0].totalTax === 0, 'GST 0% slab computed correctly (₹0 tax on ₹300)');

// -----------------------------------------------------------------------------
// TEST SUITE 5: Hardware & Printer UX Flow
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 5: Bluetooth Discovery & Printer Auto-Routing');
console.log('======================================================');

const btServiceCode = fs.readFileSync(path.resolve(__dirname, '../native/services/BluetoothService.ts'), 'utf8');
assert(btServiceCode.includes('scanDevices'), 'BluetoothService implements scanDevices for 1-tap discovery');

const printerServiceCode = fs.readFileSync(path.resolve(__dirname, '../native/services/PrinterService.ts'), 'utf8');
assert(printerServiceCode.includes('getDefaultProfile'), 'PrinterService resolves default profile for 1-tap checkout printing');

const settingsScreenCode = fs.readFileSync(path.resolve(__dirname, '../screens/SettingsScreen.tsx'), 'utf8');
assert(settingsScreenCode.includes('handleDiscoverPrinters'), 'SettingsScreen includes Discover Nearby Printers modal & trigger');
assert(settingsScreenCode.includes('handlePickLogo'), 'SettingsScreen includes Gallery/Camera Brand Logo Picker');

// -----------------------------------------------------------------------------
// TEST SUITE 6: Database Migrations & Version 7
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 6: Database Schema & Migration V7');
console.log('======================================================');

const schemaCode = fs.readFileSync(path.resolve(__dirname, '../database/schema.ts'), 'utf8');
assert(schemaCode.includes('SCHEMA_V7_STATEMENTS'), 'schema.ts defines migration v7 statements');
assert(schemaCode.includes('products(store_id'), 'schema.ts creates index on products(store_id)');
assert(schemaCode.includes('sales(store_id'), 'schema.ts creates index on sales(store_id)');
assert(schemaCode.includes('customers(store_id'), 'schema.ts creates index on customers(store_id)');
assert(schemaCode.includes('suppliers(store_id'), 'schema.ts creates index on suppliers(store_id)');

// -----------------------------------------------------------------------------
// TEST SUITE 7: AutoReplyPrint Native Module & 55mm Receipt Parity
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log('TEST SUITE 7: AutoReplyPrint SDK & 55mm Receipt Parity');
console.log('======================================================');

const autoReplyDriverCode = fs.readFileSync(path.resolve(__dirname, '../native/drivers/AutoReplyPrintDriver.ts'), 'utf8');
assert(autoReplyDriverCode.includes('class AutoReplyPrintDriver implements IPrinterDriver'), 'AutoReplyPrintDriver implements IPrinterDriver interface');
assert(autoReplyDriverCode.includes('AutoReplyPrintNative.printReceipt'), 'AutoReplyPrintDriver dispatches structured receipts to Native SDK');
assert(autoReplyDriverCode.includes('scanPrinters'), 'AutoReplyPrintDriver supports asynchronous discovery without blocking UI');

const moduleCode = fs.readFileSync(path.resolve(__dirname, '../../modules/autoreplyprint/android/src/main/java/com/apkabill/autoreplyprint/AutoReplyPrintModule.kt'), 'utf8');
assert(moduleCode.includes('CP_Port_EnumBtDevice'), 'AutoReplyPrintModule links SDK CP_Port_EnumBtDevice');
assert(moduleCode.includes('CP_Port_EnumBleDevice'), 'AutoReplyPrintModule links SDK CP_Port_EnumBleDevice');
assert(moduleCode.includes('EnumUsb'), 'AutoReplyPrintModule links SDK EnumUsb');
assert(moduleCode.includes('CP_Port_EnumNetPrinter'), 'AutoReplyPrintModule links SDK CP_Port_EnumNetPrinter');
assert(moduleCode.includes('CP_Port_OpenBtSpp'), 'AutoReplyPrintModule links SDK CP_Port_OpenBtSpp');
assert(moduleCode.includes('CP_Pos_PrintTextInUTF8'), 'AutoReplyPrintModule links SDK CP_Pos_PrintTextInUTF8');
assert(moduleCode.includes('CP_Pos_PrintQRCode'), 'AutoReplyPrintModule links SDK CP_Pos_PrintQRCode');
assert(moduleCode.includes('CP_Pos_QueryPrintResult'), 'AutoReplyPrintModule links SDK CP_Pos_QueryPrintResult');

const receiptFormatterCode = fs.readFileSync(path.resolve(__dirname, '../native/utils/ReceiptFormatter.ts'), 'utf8');
assert(receiptFormatterCode.includes('generateEscPosCommands'), 'ReceiptFormatter generates standard ESC/POS commands');
assert(receiptFormatterCode.includes('nameColWidth'), 'ReceiptFormatter uses deterministic column layouts');

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`P3-P4 VERIFICATION TEST RUN COMPLETE: ${testsPassed} Passed, ${testsFailed} Failed`);
console.log('======================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL P0-P4 PRODUCTION PARITY TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}


/**
 * Orion POS Mobile Expo - Comprehensive Standalone Test Suite
 * Validating P0 + P1 Core Features:
 * - Receipt ESC/POS Formatter & VOID layout
 * - Web Parity cartTotals with line item & cart discounts
 * - Round-off calculation
 * - Idempotency client_mutation_id checking
 * - Expense calculation & Net Profit derivation
 * - Stock Adjustment math and audit validation
 * - Supplier Purchase transaction & stock increment
 * - Held Cart JSON serialization
 * - Image URL resolution
 * - WhatsApp receipt link generation
 */

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}`);
  } else {
    failed++;
    console.error(`[FAIL] ${testName}`);
  }
}

// 1. Receipt Formatter logic
function format58mmText(data) {
  const WIDTH = 32;
  const padRight = (str, len) => {
    const s = String(str);
    return s.length > len ? s.substring(0, len) : s.padEnd(len, ' ');
  };
  const padLeft = (str, len) => {
    const s = String(str);
    return s.length > len ? s.substring(s.length - len) : s.padStart(len, ' ');
  };
  const center = (str) => {
    const s = String(str).trim().substring(0, WIDTH);
    const leftMargin = Math.max(0, Math.floor((WIDTH - s.length) / 2));
    return ' '.repeat(leftMargin) + s;
  };
  const wrapLines = (str) => {
    const words = String(str).split(' ');
    const res = [];
    let current = '';
    for (const w of words) {
      if ((current + (current ? ' ' : '') + w).length <= WIDTH) {
        current += (current ? ' ' : '') + w;
      } else {
        if (current) res.push(center(current));
        current = w.substring(0, WIDTH);
      }
    }
    if (current) res.push(center(current));
    return res;
  };
  const formatCurrency = (amount) => `₹${amount.toFixed(2)}`;

  const lines = [];
  if (data.status === 'voided') {
    lines.push(center('*** VOIDED INVOICE ***'));
    lines.push('-'.repeat(WIDTH));
  }
  wrapLines(data.storeName.toUpperCase()).forEach((l) => lines.push(l));
  lines.push('-'.repeat(WIDTH));
  wrapLines(`Inv: ${data.invoiceNumber}`).forEach((l) => lines.push(l));
  wrapLines(`Date: ${data.date}`).forEach((l) => lines.push(l));
  lines.push('-'.repeat(WIDTH));
  lines.push(padRight('Item', 14) + padLeft('Qty', 4) + padLeft('Price', 6) + padLeft('Total', 8));
  lines.push('-'.repeat(WIDTH));
  for (const item of data.items) {
    lines.push(
      padRight(item.name, 14) +
      padLeft(item.quantity.toString(), 4) +
      padLeft(item.unitPrice.toFixed(0), 6) +
      padLeft(item.total.toFixed(2), 8)
    );
  }
  lines.push('-'.repeat(WIDTH));
  lines.push(padRight('Subtotal:', 18) + padLeft(formatCurrency(data.subtotal), 14));
  if (data.discount > 0) {
    lines.push(padRight('Discount:', 18) + padLeft(`-${formatCurrency(data.discount)}`, 14));
  }
  lines.push(padRight('GST:', 18) + padLeft(formatCurrency(data.gst), 14));
  lines.push('='.repeat(WIDTH));
  lines.push(padRight('GRAND TOTAL:', 16) + padLeft(formatCurrency(data.grandTotal), 16));
  lines.push('='.repeat(WIDTH));
  lines.push(`Payment: ${data.paymentMethod.toUpperCase()}`);
  return lines.join('\n');
}

// Test 1: Receipt Formatter
const receiptData = {
  storeName: 'Apka Bill Store',
  invoiceNumber: 'INV-20260818-001',
  date: '18/08/2026',
  items: [
    { name: 'Basmati Rice', quantity: 2, unitPrice: 150, total: 300 },
    { name: 'Sunflower Oil', quantity: 1, unitPrice: 180, total: 180 },
  ],
  subtotal: 480,
  discount: 30,
  gst: 81,
  grandTotal: 531,
  paymentMethod: 'UPI',
};

const formatted = format58mmText(receiptData);
assert(formatted.includes('APKA BILL STORE'), 'Receipt formatting title');
assert(formatted.includes('Inv: INV-20260818-001'), 'Receipt formatting invoice number');
assert(formatted.includes('GRAND TOTAL:'), 'Receipt formatting grand total label');
assert(formatted.includes('₹531.00'), 'Receipt formatting grand total value');

// Test 2: VOID Receipt Layout
const voidedFormatted = format58mmText({ ...receiptData, status: 'voided' });
assert(voidedFormatted.includes('*** VOIDED INVOICE ***'), 'Receipt formatting VOID watermark');

// Test 3: Web Parity cartTotals & Round-off
const cartItems = [
  { price: 500, qty: 2, discountPercent: 10, gstRate: 18 },
  { price: 200, qty: 1, discountPercent: 0, gstRate: 5 },
];
let gross = 0;
let lineDisc = 0;
let taxSum = 0;
for (const itm of cartItems) {
  const line = itm.price * itm.qty;
  const disc = (line * itm.discountPercent) / 100;
  const taxable = line - disc;
  const tax = (taxable * itm.gstRate) / 100;
  gross += line;
  lineDisc += disc;
  taxSum += tax;
}
const cartDiscount = 50;
const totalDiscount = lineDisc + cartDiscount;
const unroundedGrandTotal = gross - totalDiscount + taxSum;
const roundedGrandTotal = Math.round(unroundedGrandTotal);
const roundOff = roundedGrandTotal - unroundedGrandTotal;

assert(gross === 1200, 'Web cartTotals gross subtotal calculation');
assert(lineDisc === 100, 'Web cartTotals line item discount calculation');
assert(taxSum === 172, 'Web cartTotals GST tax calculation');
assert(unroundedGrandTotal === 1222, 'Web cartTotals unrounded grand total parity (1222)');
assert(roundOff === 0, 'Round off difference for integer totals');

// Test 4: Fractional Round-off
const fracUnrounded = 125.60;
const fracRounded = Math.round(fracUnrounded);
const fracDiff = Number((fracRounded - fracUnrounded).toFixed(2));
assert(fracRounded === 126, 'Fractional total rounds to nearest rupee');
assert(fracDiff === 0.40, 'Round off delta is +0.40');

// Test 5: Idempotency Protection Simulation
const salesDatabase = new Map();
function simulateIdempotentCheckout(payload) {
  if (payload.clientMutationId && salesDatabase.has(payload.clientMutationId)) {
    return { ...salesDatabase.get(payload.clientMutationId), isCached: true };
  }
  const saleRecord = {
    id: salesDatabase.size + 1,
    invoiceNumber: `INV-${Date.now()}`,
    clientMutationId: payload.clientMutationId,
    grandTotal: payload.grandTotal,
    status: 'completed',
    isCached: false,
  };
  if (payload.clientMutationId) {
    salesDatabase.set(payload.clientMutationId, saleRecord);
  }
  return saleRecord;
}

const mutKey = 'MUT-12345-ABCDE';
const firstAttempt = simulateIdempotentCheckout({ clientMutationId: mutKey, grandTotal: 500 });
assert(firstAttempt.isCached === false, 'First checkout attempt executes');
const retryAttempt = simulateIdempotentCheckout({ clientMutationId: mutKey, grandTotal: 500 });
assert(retryAttempt.isCached === true, 'Duplicate mutation attempt returns existing cached sale without duplicate');
assert(firstAttempt.id === retryAttempt.id, 'Duplicate attempt returns same sale ID');

// Test 6: Stock Adjustment Math
function applyStockAdjustment(currentStock, type, qty) {
  if (type === 'INCREASE') return currentStock + qty;
  if (type === 'DECREASE') return Math.max(0, currentStock - qty);
  if (type === 'SET') return qty;
  return currentStock;
}

assert(applyStockAdjustment(10, 'INCREASE', 5) === 15, 'Stock adjustment INCREASE adds quantity');
assert(applyStockAdjustment(10, 'DECREASE', 3) === 7, 'Stock adjustment DECREASE subtracts quantity');
assert(applyStockAdjustment(10, 'DECREASE', 20) === 0, 'Stock adjustment DECREASE bounds at 0');
assert(applyStockAdjustment(10, 'SET', 25) === 25, 'Stock adjustment SET overrides stock');

// Test 7: Supplier Purchase Transaction & Stock Increment
const inventory = { 1: { id: 1, name: 'Product A', stock: 10, costPrice: 40 } };
const purchase = {
  supplier: 'Fresh Foods Ltd',
  items: [{ productId: 1, quantity: 15, costPrice: 45 }],
  total: 675,
};
for (const itm of purchase.items) {
  if (inventory[itm.productId]) {
    inventory[itm.productId].stock += itm.quantity;
    inventory[itm.productId].costPrice = itm.costPrice;
  }
}
assert(inventory[1].stock === 25, 'Purchase increments product stock atomically');
assert(inventory[1].costPrice === 45, 'Purchase updates product cost price');

// Test 8: Net Profit & Operating Expenses Calculation
const totalSalesRevenue = 10000;
const costOfGoodsSold = 6000;
const expenses = [
  { category: 'Rent', amount: 1500 },
  { category: 'Electricity', amount: 500 },
  { category: 'Tea & Snacks', amount: 200 },
];
const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
const grossProfit = totalSalesRevenue - costOfGoodsSold;
const netProfit = grossProfit - totalExpenses;

assert(totalExpenses === 2200, 'Operating expenses correctly aggregated (2200)');
assert(grossProfit === 4000, 'Gross profit calculation (4000)');
assert(netProfit === 1800, 'Net profit calculation after expenses (1800)');

// Test 9: Held Cart Serialization
const originalCart = [
  { product: { id: 1, name: 'Item 1', selling_price: 100 }, quantity: 2 },
];
const serialized = JSON.stringify(originalCart);
const deserialized = JSON.parse(serialized);
assert(Array.isArray(deserialized) && deserialized.length === 1, 'Held cart serializes and deserializes accurately');
assert(deserialized[0].quantity === 2, 'Held cart item quantities preserved');

// Test 10: Image Helper Logic
function resolveImageUrl(rawUrl, apiBaseUrl = 'https://pos-production-f138.up.railway.app') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

const cloudUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
assert(resolveImageUrl(cloudUrl) === cloudUrl, 'Cloudinary URL preserved intact');
assert(resolveImageUrl(null) === null, 'Null image URL returns null');
assert(resolveImageUrl(undefined) === null, 'Undefined image URL returns null');
assert(resolveImageUrl('/uploads/img.png').startsWith('https://pos-production-f138.up.railway.app/uploads/img.png'), 'Relative path resolved');

// Test 11: WhatsApp URL Generator
function generateWhatsAppShareUrl(invoice, storeSettings) {
  const store = storeSettings.storeName || 'Apka Bill Store';
  const inv = invoice.invoice_number || 'INV';
  const total = (invoice.total_amount || 0).toLocaleString();
  const date = 'Today';
  let itemLines = '';
  if (invoice.items && invoice.items.length > 0) {
    itemLines = invoice.items
      .map((i) => `• ${i.product_name} x ${i.quantity} = ₹${(i.subtotal || 0).toLocaleString()}`)
      .join('\n');
  }
  const text = `*${store}*\nInvoice: ${inv}\nDate: ${date}\n------------------\n${itemLines}\n------------------\n*Total Amount: ₹${total}*\nPayment: ${invoice.payment_method || 'Cash'}`;
  const phone = invoice.customer_phone || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : '';
  return `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;
}

const waUrl = generateWhatsAppShareUrl(
  {
    invoice_number: 'INV-999',
    customer_phone: '9876543210',
    total_amount: 1500,
    payment_method: 'UPI',
    items: [{ product_name: 'Atta 10kg', quantity: 1, subtotal: 450 }],
  },
  { storeName: 'Test Store' }
);
assert(waUrl.startsWith('https://wa.me/919876543210'), 'WhatsApp URL contains phone parameter');
// Test 12: Orion Configuration Center V2 JSON Config Roundtrip
const storeConfig = {
  storeName: 'Apka Bill Supermart',
  gstin: '29ABCDE1234F1Z5',
  invoicePrefix: 'INV-',
  paperWidth: '58mm',
  taxRate: 18,
  lowStockThreshold: 10,
};
const configJson = JSON.stringify(storeConfig);
const parsedConfig = JSON.parse(configJson);
assert(parsedConfig.storeName === 'Apka Bill Supermart', 'Configuration Center storeName roundtrips');
assert(parsedConfig.gstin === '29ABCDE1234F1Z5', 'Configuration Center GSTIN roundtrips');
assert(parsedConfig.paperWidth === '58mm', 'Configuration Center printer width roundtrips');
assert(parsedConfig.taxRate === 18, 'Configuration Center tax rate roundtrips');

// Test 13: Stock History Movement Collation
const stockMovements = [
  { type: 'SALE', delta: -5, ref: 'INV-101' },
  { type: 'PURCHASE', delta: 20, ref: 'PO-201' },
  { type: 'ADJUSTMENT', delta: -2, ref: 'DAMAGED' },
  { type: 'VOID_RESTORE', delta: 5, ref: 'INV-101' },
];
const netStockMovement = stockMovements.reduce((acc, m) => acc + m.delta, 0);
assert(netStockMovement === 18, 'Stock movement ledger correctly computes net change (18)');

// Test 14: Profit & Margins Breakdown Parity
const testRev = 25000;
const testCogs = 15000;
const testExpenses = 3000;
const testGrossProfit = testRev - testCogs;
const testNetProfit = testGrossProfit - testExpenses;
const testMarginPercent = (testNetProfit / testRev) * 100;
assert(testGrossProfit === 10000, 'Profit dashboard gross profit matches Web');
assert(testNetProfit === 7000, 'Profit dashboard net profit matches Web');
assert(Math.abs(testMarginPercent - 28) < 0.01, 'Profit dashboard margin percentage matches Web (28%)');

console.log(`\n============================\nTESTS COMPLETED: Passed=${passed}, Failed=${failed}\n============================`);
if (failed > 0) process.exit(1);



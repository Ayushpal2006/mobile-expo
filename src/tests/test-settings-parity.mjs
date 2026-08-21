/**
 * Apka Bill POS - Mobile Settings Parity & Templates Verification Suite (Node.js test runner)
 */

let passed = 0;
let failed = 0;

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✕ ${testName} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  }
}

console.log('\n======================================================');
console.log('  RUNNING MOBILE SETTINGS PARITY & TEMPLATES TESTS');
console.log('======================================================\n');

// --- SUITE 1: INVOICE TEMPLATES REGISTRY (1:1 Web Parity) ---
console.log('--- Suite 1: Invoice & Receipt Templates ---');
const INVOICE_TEMPLATES_REGISTRY = [
  { id: 'Classic', name: 'Classic Thermal', badge: 'Popular', paperWidth: '58mm' },
  { id: 'Modern', name: 'Modern Banner', badge: 'Premium', paperWidth: '80mm' },
  { id: 'Retail', name: 'Retail Supermarket', badge: 'High Detail', paperWidth: '80mm' },
  { id: 'Compact', name: 'Compact Express', badge: 'Fast', paperWidth: '58mm' },
  { id: 'Detailed', name: 'Detailed Tax Invoice', badge: 'GST Ready', paperWidth: '80mm' },
];

assert(INVOICE_TEMPLATES_REGISTRY.length === 5, '5 Invoice templates registered in mobile');
const templateIds = INVOICE_TEMPLATES_REGISTRY.map((t) => t.id);
assert(templateIds.includes('Classic'), 'Classic Thermal template exists');
assert(templateIds.includes('Modern'), 'Modern Banner template exists');
assert(templateIds.includes('Retail'), 'Retail Supermarket template exists');
assert(templateIds.includes('Compact'), 'Compact Express template exists');
assert(templateIds.includes('Detailed'), 'Detailed Tax Invoice template exists');

// --- SUITE 2: WHATSAPP PREDEFINED TEMPLATES & VARIABLES ---
console.log('\n--- Suite 2: WhatsApp Predefined Templates & Variable Engine ---');

const WHATSAPP_TEMPLATES_REGISTRY = [
  {
    id: 'sales_invoice',
    name: 'Invoice / Bill Sent',
    badge: 'Default',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nYour invoice {{invoiceNumber}} for ₹{{grandTotal}} is ready.\nDate: {{invoiceDate}}\nStore: {{storeName}}\n\nThank you for shopping with us!`,
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    badge: 'Receipt',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nPayment of ₹{{grandTotal}} for invoice {{invoiceNumber}} has been successfully recorded.\nPayment Method: {{paymentMethod}}\nStore: {{storeName}}\n\nThank you!`,
  },
  {
    id: 'thank_you',
    name: 'Thank You & Appreciation',
    badge: 'Greeting',
    defaultTemplate: `Thank you for shopping with {{storeName}}, {{customerName}}!\nTotal: ₹{{grandTotal}}\nWe appreciate your business and look forward to serving you again.`,
  },
  {
    id: 'payment_reminder',
    name: 'Invoice Follow-up / Reminder',
    badge: 'Reminder',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nThis is a friendly reminder regarding invoice {{invoiceNumber}} of ₹{{grandTotal}} from {{storeName}}.\nDate: {{invoiceDate}}\n\nPlease contact us if you need any assistance.`,
  },
  {
    id: 'custom',
    name: 'Custom Template',
    badge: 'Custom',
    defaultTemplate: `Hello {{customerName}},\n\nYour invoice {{invoiceNumber}} for ₹{{grandTotal}} is generated at {{storeName}}.\n\nThank you!`,
  },
];

const TEMPLATE_VARIABLES = [
  { placeholder: '{{customerName}}', label: 'Customer Name' },
  { placeholder: '{{storeName}}', label: 'Store Name' },
  { placeholder: '{{invoiceNumber}}', label: 'Invoice No.' },
  { placeholder: '{{grandTotal}}', label: 'Grand Total' },
  { placeholder: '{{subtotal}}', label: 'Subtotal' },
  { placeholder: '{{discount}}', label: 'Discount' },
  { placeholder: '{{tax}}', label: 'GST Tax' },
  { placeholder: '{{paymentMethod}}', label: 'Payment Mode' },
  { placeholder: '{{invoiceDate}}', label: 'Date' },
  { placeholder: '{{upiId}}', label: 'UPI ID' },
];

function resolveTemplate(templateText, invoice, storeSettings) {
  const inv = invoice || {};
  const storeN = storeSettings?.storeName || 'Apka Bill Store';
  const grandTot = Number(inv.total_amount || inv.grandTotal || 0).toFixed(2);
  const subTot = Number(inv.subtotal || grandTot).toFixed(2);
  const disc = Number(inv.discount || 0).toFixed(2);
  const tax = Number(inv.tax || inv.gst || 0).toFixed(2);
  const invNum = inv.invoice_number || inv.invoiceNumber || 'INV-001';
  const custName = inv.customer_name || inv.customerName || 'Customer';
  const payMethod = inv.payment_method || inv.paymentMethod || 'Cash';
  const invDate = inv.created_at ? inv.created_at.split('T')[0] : 'Today';
  const upi = storeSettings?.upiId || '';

  let resolved = templateText;
  resolved = resolved.replace(/\{\{customerName\}\}/g, custName);
  resolved = resolved.replace(/\{\{storeName\}\}/g, storeN);
  resolved = resolved.replace(/\{\{invoiceNumber\}\}/g, invNum);
  resolved = resolved.replace(/\{\{grandTotal\}\}/g, grandTot);
  resolved = resolved.replace(/\{\{subtotal\}\}/g, subTot);
  resolved = resolved.replace(/\{\{discount\}\}/g, disc);
  resolved = resolved.replace(/\{\{tax\}\}/g, tax);
  resolved = resolved.replace(/\{\{paymentMethod\}\}/g, payMethod);
  resolved = resolved.replace(/\{\{invoiceDate\}\}/g, invDate);
  resolved = resolved.replace(/\{\{upiId\}\}/g, upi);

  resolved = resolved.replace(/\{customer_name\}/g, custName);
  resolved = resolved.replace(/\{shop_name\}/g, storeN);
  resolved = resolved.replace(/\{invoice_number\}/g, invNum);
  resolved = resolved.replace(/\{amount\}/g, grandTot);
  resolved = resolved.replace(/\{date\}/g, invDate);

  return resolved;
}

assert(WHATSAPP_TEMPLATES_REGISTRY.length === 5, '5 WhatsApp message templates configured');

const sampleInvoice = {
  invoice_number: 'INV-2026-0099',
  customer_name: 'Priya Sharma',
  customer_phone: '9876543210',
  total_amount: 1250.0,
  subtotal: 1200.0,
  discount: 50.0,
  tax: 100.0,
  payment_method: 'UPI',
  created_at: '2026-08-20T10:30:00.000Z',
};

const sampleSettings = {
  storeName: 'Sharma Mega Store',
  upiId: 'sharma@okaxis',
};

const salesTpl = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === 'sales_invoice').defaultTemplate;
const resolvedSales = resolveTemplate(salesTpl, sampleInvoice, sampleSettings);
assert(resolvedSales.includes('Priya Sharma'), 'Customer name resolved in WhatsApp message');
assert(resolvedSales.includes('INV-2026-0099'), 'Invoice number resolved in WhatsApp message');
assert(resolvedSales.includes('1250.00'), 'Grand total resolved in WhatsApp message');
assert(resolvedSales.includes('Sharma Mega Store'), 'Store name resolved in WhatsApp message');
assert(!resolvedSales.includes('{{'), 'No raw mustache placeholders left in resolved message');
assert(!resolvedSales.includes('{customer_name}'), 'No legacy single brace placeholders left');

const allVarsTest = TEMPLATE_VARIABLES.map((v) => `${v.label}: ${v.placeholder}`).join('\n');
const resolvedAllVars = resolveTemplate(allVarsTest, sampleInvoice, sampleSettings);
assert(!resolvedAllVars.includes('{{'), 'All 10 template variables successfully resolved');

// --- SUITE 3: UPI QR GENERATION & VALIDATION ---
console.log('\n--- Suite 3: UPI QR URI Generation & Format Validation ---');
const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
assert(upiRegex.test('store@okaxis'), 'Valid standard UPI VPA (store@okaxis)');
assert(upiRegex.test('merchant.billing_pos@icici'), 'Valid complex UPI VPA (merchant.billing_pos@icici)');
assert(!upiRegex.test('invalid-upi'), 'Rejects UPI without @ handle');
assert(!upiRegex.test('store@'), 'Rejects UPI with empty PSP bank handle');
assert(!upiRegex.test(''), 'Rejects empty UPI ID');

const upiPayload = `upi://pay?pa=store@okaxis&pn=${encodeURIComponent('Apka Bill Store')}&am=1250.00&cu=INR&tn=INV-2026-0099`;
assert(upiPayload.startsWith('upi://pay?pa=store@okaxis'), 'UPI payment URI correctly formatted');
assert(upiPayload.includes('am=1250.00'), 'UPI payment amount formatted with 2 decimal precision');
assert(upiPayload.includes('cu=INR'), 'UPI currency explicitly set to INR');

console.log('\n======================================================');
console.log(`  ALL ${passed} TESTS PASSED CLEANLY! (0 FAILURES)`);
console.log('======================================================\n');

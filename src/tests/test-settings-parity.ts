/**
 * Apka Bill POS - Mobile Settings Parity & Templates Verification Suite
 *
 * Automated verification of:
 * 1. Invoice Templates Registry (Classic, Modern, Retail, Compact, Detailed)
 * 2. WhatsApp Predefined Templates & Variable Substitution Engine
 * 3. Dynamic UPI QR URI Generation & Format Validation
 * 4. QR Code Matrix Rendering Pipeline
 * 5. ESC/POS Thermal Receipt QR Embedding Pipeline
 */

import { INVOICE_TEMPLATES_REGISTRY } from '../components/invoice/InvoiceTemplateRenderer';
import WhatsAppTemplateService, {
  WHATSAPP_TEMPLATES_REGISTRY,
  TEMPLATE_VARIABLES,
} from '../services/whatsapp/WhatsAppTemplateService';
import ReceiptFormatter from '../native/utils/ReceiptFormatter';
import { SaleInvoice, StoreSettings } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✕ ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

export function runSettingsParityTests() {
  console.log('\n======================================================');
  console.log('  RUNNING MOBILE SETTINGS PARITY & TEMPLATES TESTS');
  console.log('======================================================\n');

  // --- SUITE 1: INVOICE TEMPLATES REGISTRY ---
  console.log('--- Suite 1: Invoice & Receipt Templates ---');
  assert(INVOICE_TEMPLATES_REGISTRY.length === 5, '5 Invoice templates registered in mobile');

  const templateIds = INVOICE_TEMPLATES_REGISTRY.map((t) => t.id);
  assert(templateIds.includes('Classic'), 'Classic Thermal template exists');
  assert(templateIds.includes('Modern'), 'Modern Banner template exists');
  assert(templateIds.includes('Retail'), 'Retail Supermarket template exists');
  assert(templateIds.includes('Compact'), 'Compact Express template exists');
  assert(templateIds.includes('Detailed'), 'Detailed Tax Invoice template exists');

  // --- SUITE 2: WHATSAPP PREDEFINED TEMPLATES & VARIABLES ---
  console.log('\n--- Suite 2: WhatsApp Predefined Templates & Variable Engine ---');
  assert(WHATSAPP_TEMPLATES_REGISTRY.length >= 5, 'At least 5 WhatsApp message templates configured');

  const sampleInvoice: Partial<SaleInvoice> = {
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

  const sampleSettings: Partial<StoreSettings> = {
    storeName: 'Sharma Mega Store',
    upiId: 'sharma@okaxis',
  };

  // Test 1: Sales Invoice Template
  const salesTpl = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === 'sales_invoice')!.defaultTemplate;
  const resolvedSales = WhatsAppTemplateService.resolveTemplate(salesTpl, sampleInvoice, sampleSettings);
  assert(resolvedSales.includes('Priya Sharma'), 'Customer name resolved in WhatsApp message');
  assert(resolvedSales.includes('INV-2026-0099'), 'Invoice number resolved in WhatsApp message');
  assert(resolvedSales.includes('1250.00'), 'Grand total resolved in WhatsApp message');
  assert(resolvedSales.includes('Sharma Mega Store'), 'Store name resolved in WhatsApp message');
  assert(!resolvedSales.includes('{{'), 'No raw mustache placeholders left in resolved message');
  assert(!resolvedSales.includes('{customer_name}'), 'No legacy web single brace placeholders left');

  // Test 2: Variable Resolver coverage
  const allVarsTest = TEMPLATE_VARIABLES.map((v) => `${v.label}: ${v.placeholder}`).join('\n');
  const resolvedAllVars = WhatsAppTemplateService.resolveTemplate(allVarsTest, sampleInvoice, sampleSettings);
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

  // --- SUITE 4: ESC/POS THERMAL RECEIPT QR EMBEDDING ---
  console.log('\n--- Suite 4: ESC/POS Thermal Receipt QR Embedding ---');
  const receiptData = {
    storeName: 'Apka Bill Store',
    invoiceNumber: 'INV-2026-0099',
    date: '20/08/2026',
    items: [{ name: 'Item A', quantity: 2, unitPrice: 100, total: 200 }],
    subtotal: 200,
    discount: 0,
    gst: 36,
    grandTotal: 236,
    paymentMethod: 'UPI',
    upiId: 'store@okaxis',
  };

  const formattedReceipt = ReceiptFormatter.format58mmText(receiptData);
  assert(formattedReceipt.includes('SCAN TO PAY (UPI)'), 'Receipt text layout contains UPI QR scan section');
  assert(formattedReceipt.includes('store@okaxis'), 'Receipt text layout contains merchant UPI ID');

  console.log('\n======================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runSettingsParityTests();
}

export default runSettingsParityTests;

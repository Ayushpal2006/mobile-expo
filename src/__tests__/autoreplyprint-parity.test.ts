/**
 * AutoReplyPrint & 55mm Thermal Parity Automated Tests
 */

import ReceiptFormatter from '../native/utils/ReceiptFormatter';
import { ReceiptPrintData } from '../native/types';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

export function runParityTests() {
  const baseReceipt: ReceiptPrintData = {
    storeName: 'Apka Bill Supermarket',
    storeAddress: '123 Market Road, Bangalore',
    storePhone: '9876543210',
    storeGstin: '29ABCDE1234F1Z5',
    invoiceNumber: 'INV-2026-0099',
    date: '19/08/2026, 14:30',
    cashierName: 'Ayush',
    customerName: 'Ayush',
    customerPhone: '7982272206',
    items: [],
    subtotal: 0,
    discount: 0,
    gst: 0,
    grandTotal: 0,
    paymentMethod: 'UPI',
    upiId: 'apkabill@upi',
    footerText: 'Thank you for your business!',
  };

  // TC1: Single Item Receipt with Named Customer & Phone
  const d1: ReceiptPrintData = {
    ...baseReceipt,
    items: [{ name: 'Basmati Rice 1kg', quantity: 1, unitPrice: 120, total: 120 }],
    subtotal: 120,
    discount: 0,
    gst: 6,
    grandTotal: 126,
  };
  const t1 = ReceiptFormatter.format58mmText(d1);
  assert(t1.includes('APKA BILL SUPERMARKET'), 'TC1 store name');
  assert(t1.includes('INV-2026-0099'), 'TC1 invoice number');
  assert(t1.includes('Customer: Ayush'), 'TC1 customer name');
  assert(t1.includes('Phone: 7982272206'), 'TC1 customer phone');
  assert(t1.includes('Basmati Rice 1'), 'TC1 item line');
  assert(t1.includes('Rs.126.00'), 'TC1 grand total');

  // TC2: Customer without Phone
  const d2: ReceiptPrintData = {
    ...baseReceipt,
    customerName: 'Ayush',
    customerPhone: undefined,
    items: [
      { name: 'Toor Dal 1kg', quantity: 2, unitPrice: 150, total: 300 },
      { name: 'Sunflower Oil 1L', quantity: 1, unitPrice: 180, total: 180 },
      { name: 'Wheat Flour 5kg', quantity: 1, unitPrice: 240, total: 240 },
    ],
    subtotal: 720,
    discount: 20,
    gst: 35,
    grandTotal: 735,
  };
  const t2 = ReceiptFormatter.format58mmText(d2);
  assert(t2.includes('Customer: Ayush'), 'TC2 customer name');
  assert(!t2.includes('Phone: undefined'), 'TC2 no undefined phone');
  assert(!t2.includes('Phone: null'), 'TC2 no null phone');
  assert(!t2.includes('Phone:\n'), 'TC2 no empty phone line');
  assert(t2.includes('Toor Dal 1kg'), 'TC2 item 1');
  assert(t2.includes('Sunflower Oil'), 'TC2 item 2');
  assert(t2.includes('Wheat Flour 5k'), 'TC2 item 3');
  assert(t2.includes('Subtotal:'), 'TC2 subtotal');
  assert(t2.includes('GRAND TOTAL:'), 'TC2 grand total');

  // TC3: Walk-in Customer (No Phone)
  const d3WalkIn: ReceiptPrintData = {
    ...baseReceipt,
    customerName: 'Walk-in Customer',
    customerPhone: undefined,
    items: [{ name: 'Test Product', quantity: 1, unitPrice: 50, total: 50 }],
    subtotal: 50,
    discount: 0,
    gst: 2.5,
    grandTotal: 52.5,
  };
  const t3WalkIn = ReceiptFormatter.format58mmText(d3WalkIn);
  assert(t3WalkIn.includes('Customer: Walk-in Customer'), 'TC3 Walk-in customer');
  assert(!t3WalkIn.includes('Phone:'), 'TC3 Walk-in customer has no phone line');

  // TC4: 10+ Bulk Items
  const bulkItems = Array.from({ length: 12 }, (_, i) => ({
    name: `Grocery Item #${i + 1}`,
    quantity: i + 1,
    unitPrice: 50,
    total: (i + 1) * 50,
  }));
  const totalAmt = bulkItems.reduce((sum, item) => sum + item.total, 0);
  const d4: ReceiptPrintData = {
    ...baseReceipt,
    items: bulkItems,
    subtotal: totalAmt,
    discount: 50,
    gst: totalAmt * 0.05,
    grandTotal: totalAmt - 50 + totalAmt * 0.05,
  };
  const t4 = ReceiptFormatter.format58mmText(d4);
  for (let i = 1; i <= 12; i++) {
    assert(t4.includes(`Grocery Item #${i}`), `TC4 item ${i}`);
  }

  // TC5: Multi-line wrapping
  const d5: ReceiptPrintData = {
    ...baseReceipt,
    items: [{ name: 'Cadbury Dairy Milk Silk Roasted Almond 143g', quantity: 2, unitPrice: 175, total: 350 }],
    subtotal: 350,
    discount: 0,
    gst: 17.5,
    grandTotal: 367.5,
  };
  const t5 = ReceiptFormatter.format58mmText(d5);
  assert(t5.includes('Cadbury Dairy '), 'TC5 line 1');
  assert(t5.includes('Silk Roasted'), 'TC5 line 2');
  assert(t5.includes('Rs.367.50'), 'TC5 total');

  // TC6: ESC/POS binary command generation
  const escPosBytes = ReceiptFormatter.generateEscPosCommands(d1, '58mm');
  assert(escPosBytes instanceof Uint8Array, 'TC6 byte array');
  assert(escPosBytes.length > 50, 'TC6 buffer length');
  assert(escPosBytes[0] === 0x1b && escPosBytes[1] === 0x40, 'TC6 init command');

  // TC7: Dynamic UPI QR Code Generation matching final Grand Total
  const upiPayload = `upi://pay?pa=${encodeURIComponent(baseReceipt.upiId!)}&pn=${encodeURIComponent(baseReceipt.storeName)}&am=${d1.grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(d1.invoiceNumber)}`;
  const d7: ReceiptPrintData = {
    ...d1,
    qrData: upiPayload,
  };
  const escPosWithQr = ReceiptFormatter.generateEscPosCommands(d7, '58mm');
  assert(escPosWithQr.length > escPosBytes.length, 'TC7 QR code adds bytes to stream');
  const bufferString = Buffer.from(escPosWithQr).toString('binary');
  assert(bufferString.includes('upi://pay?pa=apkabill%40upi'), 'TC7 buffer encodes valid UPI payment URI');
  assert(bufferString.includes('am=126.00'), 'TC7 buffer encodes exact grand total');

  return true;
}

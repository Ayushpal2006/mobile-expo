/**
 * Orion POS Mobile Expo - ESC/POS & 55mm/58mm Thermal Receipt Formatter
 *
 * Formats receipt payloads into deterministic column layouts (32-col for 55mm/58mm, 48-col for 80mm)
 * and generates standard ESC/POS binary buffers.
 */

import { ReceiptPrintData, ReceiptItem, ReceiptPayload } from '../types';

export class ReceiptFormatter {
  /**
   * Formats ReceiptPrintData into deterministic string layout for thermal rolls
   */
  static formatText(data: ReceiptPrintData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const WIDTH = paperWidth === '80mm' ? 48 : 32;

    const padRight = (str: string, len: number) => {
      const s = String(str);
      return s.length > len ? s.substring(0, len) : s.padEnd(len, ' ');
    };

    const padLeft = (str: string, len: number) => {
      const s = String(str);
      return s.length > len ? s.substring(s.length - len) : s.padStart(len, ' ');
    };

    const center = (str: string) => {
      const s = String(str).trim();
      if (s.length >= WIDTH) return s.substring(0, WIDTH);
      const leftMargin = Math.max(0, Math.floor((WIDTH - s.length) / 2));
      return ' '.repeat(leftMargin) + s;
    };

    const wrapLines = (str: string, width: number = WIDTH): string[] => {
      const words = String(str).split(' ');
      const res: string[] = [];
      let current = '';
      for (const w of words) {
        if ((current + (current ? ' ' : '') + w).length <= width) {
          current += (current ? ' ' : '') + w;
        } else {
          if (current) res.push(current);
          current = w.substring(0, width);
        }
      }
      if (current) res.push(current);
      return res;
    };

    const formatCurrency = (amount: number) => `Rs.${amount.toFixed(2)}`;

    const lines: string[] = [];

    // Header / Store Branding
    if (data.status === 'voided' || (data as any).isVoided) {
      lines.push(center('*** VOIDED INVOICE ***'));
      lines.push('-'.repeat(WIDTH));
    }

    wrapLines(data.storeName.toUpperCase()).forEach((l) => lines.push(center(l)));
    if (data.storeAddress) {
      wrapLines(data.storeAddress).forEach((l) => lines.push(center(l)));
    }
    if (data.storePhone) lines.push(center(`Ph: ${data.storePhone}`));
    if (data.storeGstin) lines.push(center(`GSTIN: ${data.storeGstin}`));

    lines.push('-'.repeat(WIDTH));

    wrapLines(`Inv: ${data.invoiceNumber}`).forEach((l) => lines.push(l));
    wrapLines(`Date: ${data.date}`).forEach((l) => lines.push(l));
    if (data.customerName) wrapLines(`Customer: ${data.customerName}`).forEach((l) => lines.push(l));
    if (data.customerPhone) wrapLines(`Phone: ${data.customerPhone}`).forEach((l) => lines.push(l));
    if (data.cashierName) wrapLines(`Cashier: ${data.cashierName}`).forEach((l) => lines.push(l));

    lines.push('-'.repeat(WIDTH));

    // Item Table Header
    const totalColWidth = 10;
    const nameColWidth = WIDTH - totalColWidth;

    lines.push(
      padRight('ITEM', nameColWidth) +
      padLeft('TOTAL', totalColWidth)
    );
    lines.push('-'.repeat(WIDTH));

    for (const item of data.items) {
      const itemTotalStr = `₹${item.total.toFixed(2)}`;
      const prefix = `${item.quantity}x ${item.name}`;

      if (prefix.length <= nameColWidth) {
        lines.push(
          padRight(prefix, nameColWidth) +
          padLeft(itemTotalStr, totalColWidth)
        );
      } else {
        const firstChunk = prefix.substring(0, nameColWidth);
        const restChunks = wrapLines(prefix.substring(nameColWidth), nameColWidth);

        lines.push(
          padRight(firstChunk, nameColWidth) +
          padLeft(itemTotalStr, totalColWidth)
        );

        for (const chunk of restChunks) {
          lines.push('   ' + chunk);
        }
      }
    }

    lines.push('-'.repeat(WIDTH));

    // Totals
    const labelWidth = WIDTH - 12;
    lines.push(padRight('Subtotal', labelWidth) + padLeft(`₹${data.subtotal.toFixed(2)}`, 12));
    lines.push(padRight('Discount', labelWidth) + padLeft(`-₹${(data.discount || 0).toFixed(2)}`, 12));
    lines.push(padRight('GST Tax', labelWidth) + padLeft(`₹${(data.gst || 0).toFixed(2)}`, 12));
    lines.push('-'.repeat(WIDTH));
    lines.push(padRight('GRAND TOTAL', labelWidth) + padLeft(`₹${data.grandTotal.toFixed(2)}`, 12));
    lines.push('-'.repeat(WIDTH));

    lines.push(`Paid via ${data.paymentMethod.toUpperCase()}`);

    if (data.upiId || data.qrData) {
      lines.push('-'.repeat(WIDTH));
      lines.push(center('SCAN TO PAY (UPI)'));
      lines.push(center('[ UPI QR CODE EMBEDDED ]'));
      if (data.upiId) lines.push(center(data.upiId));
    }

    lines.push('-'.repeat(WIDTH));
    if (data.footerText) {
      wrapLines(data.footerText).forEach((l) => lines.push(center(l)));
    }

    return lines.join('\n');
  }

  /**
   * Helper for 58mm / 55mm thermal rolls
   */
  static format58mmText(data: ReceiptPrintData): string {
    return ReceiptFormatter.formatText(data, '58mm');
  }

  /**
   * Helper to format generic ReceiptPayload into text string
   */
  static formatReceipt(payload: ReceiptPayload): string {
    if (payload.formattedText) return payload.formattedText;
    if (payload.data) return ReceiptFormatter.formatText(payload.data, payload.data.paperWidth || '58mm');

    // Fallback template
    const store = payload.storeName || 'Orion POS Store';
    const inv = payload.invoiceNumber || 'INV-000';
    return `${store.toUpperCase()}\n--------------------------------\nInvoice: ${inv}\nDate: ${new Date().toLocaleDateString()}\n--------------------------------\nThank you for shopping with us!\n--------------------------------`;
  }

  /**
   * Generates standard binary ESC/POS byte sequence for thermal printers
   */
  static generateEscPosCommands(data: ReceiptPrintData, paperWidth: '58mm' | '80mm' = '58mm'): Uint8Array {
    const bytes: number[] = [];

    // Helper pushers
    const push = (...b: number[]) => bytes.push(...b);
    const text = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
      }
    };
    const line = (str: string = '') => {
      text(str);
      push(0x0a);
    };

    // 1. Initialize printer (ESC @)
    push(0x1b, 0x40);

    // 2. Format receipt lines
    const formatted = ReceiptFormatter.formatText(data, paperWidth);
    const textLines = formatted.split('\n');

    for (const l of textLines) {
      line(l);
    }

    // 3. QR Code if provided (Centered, Size 3 for 55mm / Size 4 for 80mm)
    if (data.qrData || data.upiId) {
      const qrPayload = data.qrData || `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.storeName)}&am=${data.grandTotal}&cu=INR`;
      const qrSize = paperWidth === '80mm' ? 4 : 3;
      const len = qrPayload.length + 3;
      const pL = len % 256;
      const pH = Math.floor(len / 256);

      // Center Align (ESC a 1)
      push(0x1b, 0x61, 0x01);
      line();

      // Model 2
      push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
      // Module size
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, qrSize);
      // ECC Level M (48)
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
      // Store data
      push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
      text(qrPayload);
      // Print QR Code
      push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
      line();

      if (data.upiId) {
        line('Scan & Pay with UPI');
      }

      // Reset align to left (ESC a 0)
      push(0x1b, 0x61, 0x00);
    }

    // 4. Clean paper feed (3 lines feed)
    push(0x1b, 0x64, 0x03);

    return new Uint8Array(bytes);
  }
}

export default ReceiptFormatter;

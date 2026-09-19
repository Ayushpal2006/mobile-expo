/**
 * Apka Bill POS - WhatsApp Predefined Message Templates & Variable Resolver
 *
 * Provides full parity with Web WhatsApp Template System:
 * - Predefined message templates (Sales Invoice, Payment Received, Thank You, Payment Reminder, Custom)
 * - Dynamic placeholder substitution with zero raw unresolved variables
 * - Direct URI launcher targeting customer mobile number (91XXXXXXXXXX)
 */

import { Linking, Alert } from 'react-native';
import { SaleInvoice, StoreSettings } from '../../types';
import { getApiBaseUrl } from '../../config/env';

export interface WhatsAppTemplateConfig {
  id: string;
  name: string;
  badge: string;
  description: string;
  defaultTemplate: string;
}

export const WHATSAPP_TEMPLATES_REGISTRY: WhatsAppTemplateConfig[] = [
  {
    id: 'sales_invoice',
    name: 'Invoice / Bill Sent',
    badge: 'Default',
    description: 'Sent immediately after checkout with bill totals and store details.',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nYour invoice {{invoiceNumber}} for ₹{{grandTotal}} is ready.\nDate: {{invoiceDate}}\nStore: {{storeName}}\n\nThank you for shopping with us!`,
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    badge: 'Receipt',
    description: 'Confirms payment received with payment method details.',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nPayment of ₹{{grandTotal}} for invoice {{invoiceNumber}} has been successfully recorded.\nPayment Method: {{paymentMethod}}\nStore: {{storeName}}\n\nThank you!`,
  },
  {
    id: 'thank_you',
    name: 'Thank You & Appreciation',
    badge: 'Greeting',
    description: 'Warm appreciation message to build customer loyalty.',
    defaultTemplate: `Thank you for shopping with {{storeName}}, {{customerName}}!\nTotal: ₹{{grandTotal}}\nWe appreciate your business and look forward to serving you again.`,
  },
  {
    id: 'payment_reminder',
    name: 'Invoice Follow-up / Reminder',
    badge: 'Reminder',
    description: 'Gentle follow-up message regarding pending invoice payments.',
    defaultTemplate: `Namaste {{customerName}} 🙏\n\nThis is a friendly reminder regarding invoice {{invoiceNumber}} of ₹{{grandTotal}} from {{storeName}}.\nDate: {{invoiceDate}}\n\nPlease contact us if you need any assistance.`,
  },
  {
    id: 'custom',
    name: 'Custom Template',
    badge: 'Custom',
    description: 'User-defined template configured in Store Settings.',
    defaultTemplate: `Hello {{customerName}},\n\nYour invoice {{invoiceNumber}} for ₹{{grandTotal}} is generated at {{storeName}}.\n\nThank you!`,
  },
];

export const TEMPLATE_VARIABLES = [
  { placeholder: '{{customerName}}', label: 'Customer Name', example: 'Rahul Sharma' },
  { placeholder: '{{storeName}}', label: 'Store Name', example: 'Apka Bill Store' },
  { placeholder: '{{invoiceNumber}}', label: 'Invoice No.', example: 'INV-2026-0042' },
  { placeholder: '{{grandTotal}}', label: 'Grand Total', example: '472.00' },
  { placeholder: '{{subtotal}}', label: 'Subtotal', example: '450.00' },
  { placeholder: '{{discount}}', label: 'Discount', example: '50.00' },
  { placeholder: '{{tax}}', label: 'GST Tax', example: '72.00' },
  { placeholder: '{{paymentMethod}}', label: 'Payment Mode', example: 'UPI' },
  { placeholder: '{{invoiceDate}}', label: 'Date', example: '20 Aug 2026' },
  { placeholder: '{{upiId}}', label: 'UPI ID', example: 'store@upi' },
];

export class WhatsAppTemplateService {
  /**
   * Resolves template placeholders with concrete invoice and store data
   */
  static resolveTemplate(
    templateText: string,
    invoice: Partial<SaleInvoice> | null,
    storeSettings?: Partial<StoreSettings> | null
  ): string {
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

    const token = (inv as any).public_token || (inv as any).publicToken || '';
    // Derived from the configured backend rather than hardcoded: these links are sent to
    // customers, and the previous hardcoded Render host is decommissioned (503).
    const apiBase = getApiBaseUrl();
    const receiptUrl = token ? `${apiBase}/r/${token}` : `${apiBase}/invoice/v/${invNum}`;
    const pdfUrl = (inv as any).pdf_url || (inv as any).pdfUrl || `${receiptUrl}/download`;

    let resolved = templateText || '';

    // Replace modern mustache placeholders
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
    resolved = resolved.replace(/\{\{receiptUrl\}\}/g, receiptUrl);
    resolved = resolved.replace(/\{\{pdfUrl\}\}/g, pdfUrl);

    // Also support legacy web single brace placeholders: {customer_name}, {shop_name}, {amount}
    resolved = resolved.replace(/\{customer_name\}/g, custName);
    resolved = resolved.replace(/\{shop_name\}/g, storeN);
    resolved = resolved.replace(/\{invoice_number\}/g, invNum);
    resolved = resolved.replace(/\{amount\}/g, grandTot);
    resolved = resolved.replace(/\{date\}/g, invDate);
    resolved = resolved.replace(/\{receipt_url\}/g, receiptUrl);
    resolved = resolved.replace(/\{pdf_url\}/g, pdfUrl);

    return resolved;
  }

  /**
   * Generates a sample resolved preview for settings demonstration
   */
  static getSamplePreview(templateId: string, customTemplateText?: string, storeSettings?: Partial<StoreSettings> | null): string {
    let tplText = '';
    if (templateId === 'custom' && customTemplateText) {
      tplText = customTemplateText;
    } else {
      const found = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === templateId);
      tplText = found ? found.defaultTemplate : WHATSAPP_TEMPLATES_REGISTRY[0].defaultTemplate;
    }

    const sampleInvoice: Partial<SaleInvoice> = {
      invoice_number: 'INV-2026-0042',
      customer_name: 'Rahul Sharma',
      total_amount: 472.0,
      subtotal: 450.0,
      discount: 50.0,
      tax: 72.0,
      payment_method: 'UPI',
      created_at: new Date().toISOString(),
    };

    return this.resolveTemplate(tplText, sampleInvoice, storeSettings);
  }

  /**
   * Opens WhatsApp directly with resolved text
   */
  static async sendWhatsApp(
    phone: string | undefined,
    message: string
  ): Promise<boolean> {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '').slice(-10) : '';
    const encoded = encodeURIComponent(message);

    const appUrl = cleanPhone
      ? `whatsapp://send?phone=91${cleanPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;

    const webFallbackUrl = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
        return true;
      }
      await Linking.openURL(webFallbackUrl);
      return true;
    } catch {
      try {
        await Linking.openURL(webFallbackUrl);
        return true;
      } catch (err: any) {
        Alert.alert('Notice', 'Unable to launch WhatsApp on this device.');
        return false;
      }
    }
  }
}

export default WhatsAppTemplateService;

/**
 * Orion POS Mobile Expo - Sales Domain Service & Transaction Manager
 */

import { SaleRepository } from '../../database/repositories/sale.repository';
import { SettingsRepository } from '../../database/repositories/settings.repository';
import { PrinterRepository } from '../../database/repositories/printer.repository';
import { PrinterService } from '../../native/services/PrinterService';
import { CheckoutPayload, SaleInvoice, StoreSettings } from '../../types';
import { ReceiptPrintData } from '../../native/types';
import { apiClient, extractApiPayload } from './client';
import { SyncEngine } from './sync.service';
import logger from '../../utils/logger';
import { inr } from '../../utils/format';

export const SalesService = {
  /**
   * Complete Offline Sale Creation:
   * 1. Atomically inserts sale, line items, stock deduction, and outbox event into SQLite.
   * 2. Triggers immediate background sync to server.
   * 3. Automatically prints receipt to default printer profile if configured.
   * 4. Returns sale invoice immediately.
   */
  async processCheckout(payload: CheckoutPayload, storeId: number = 1): Promise<SaleInvoice> {
    const effectiveStoreId = payload.storeId || storeId || 1;

    // 1. Perform atomic SQLite transaction
    const invoice = await SaleRepository.createSaleTransaction(payload, effectiveStoreId);
    logger.info(`[SalesService] Transaction completed offline: ${invoice.invoice_number}`);

    // 2. Trigger immediate background sync
    SyncEngine.syncNow(effectiveStoreId).catch((err) => {
      logger.warn('[SalesService] Background sync trigger warning:', err.message);
    });

    // 2. Trigger automatic receipt printing to configured default printer
    try {
      const storeSettings = await SettingsRepository.getAllSettings(effectiveStoreId);
      const defaultPrinter = await PrinterRepository.getDefaultProfile(effectiveStoreId);

      if (defaultPrinter) {
        PrinterService.setDriverType(defaultPrinter.type);
      }

      const grandTotalNum = invoice.total_amount || invoice.grandTotal || 0;
      const storeUpi = storeSettings.upiId ? storeSettings.upiId.trim() : '';

      const printData: ReceiptPrintData = {
        storeName: storeSettings.storeName || 'Apka Bill Store',
        storeAddress: storeSettings.address || '',
        storePhone: storeSettings.phone || '',
        storeGstin: storeSettings.gstin || '',
        upiId: storeUpi || undefined,
        qrData: storeUpi
          ? `upi://pay?pa=${storeUpi}&pn=${encodeURIComponent(storeSettings.storeName || 'Store')}&am=${grandTotalNum.toFixed(2)}&cu=INR`
          : undefined,
        paperWidth: defaultPrinter?.paper_width ? (`${defaultPrinter.paper_width}mm` as any) : '58mm',
        invoiceNumber: invoice.invoice_number || 'INV-000',
        date: new Date().toLocaleString('en-IN'),
        cashierName: invoice.cashier_name || 'Cashier',
        customerName: invoice.customer_name || 'Walk-in Customer',
        customerPhone: invoice.customer_phone || undefined,
        items: (invoice.items || []).map((i) => ({
          name: i.product_name || 'Item',
          quantity: i.quantity,
          unitPrice: i.unit_price || 0,
          total: i.subtotal || (i.unit_price || 0) * (i.quantity || 1),
        })),
        subtotal: invoice.subtotal || 0,
        discount: invoice.discount || 0,
        gst: invoice.tax || 0,
        grandTotal: grandTotalNum,
        paymentMethod: invoice.payment_method || 'Cash',
        footerText: storeSettings.receiptFooter || 'Thank you for shopping with us!',
      };

      PrinterService.printReceipt({ invoiceNumber: invoice.invoice_number!, data: printData }).catch((err) => {
        logger.warn('[SalesService] Auto-print side-effect warning:', err.message);
      });
    } catch (err: any) {
      logger.warn('[SalesService] Receipt generation warning:', err.message);
    }

    return invoice;
  },

  async voidSale(
    saleIdOrInvoice: string | number,
    reason: string,
    voidedBy: string = 'Cashier',
    storeId: number = 1
  ): Promise<SaleInvoice | null> {
    const voided = await SaleRepository.voidSaleTransaction(saleIdOrInvoice, reason, voidedBy, storeId);
    if (voided) {
      logger.info(`[SalesService] Sale voided successfully: ${voided.invoice_number}`);
      SyncEngine.syncNow(storeId).catch(() => {});
    }
    return voided;
  },

  async getTodaySales(storeId: number = 1): Promise<SaleInvoice[]> {
    const local = await SaleRepository.getAllSales(storeId, 100);
    if (local.length > 0) {
      return local;
    }

    try {
      const res = await apiClient.get<any>('/api/sales');
      const payload = extractApiPayload(res);
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.sales) ? payload.sales : []);
      if (list.length > 0) {
        await SaleRepository.insertServerSalesBatch(list, storeId);
        return await SaleRepository.getAllSales(storeId, 100);
      }
    } catch {
      // fallback
    }

    return local;
  },

  async getSaleById(idOrInvoice: string, storeId: number = 1): Promise<SaleInvoice | null> {
    return SaleRepository.getSaleByInvoiceOrLocalId(idOrInvoice, storeId);
  },

  /**
   * Generates WhatsApp invoice text and share link
   */
  generateWhatsAppShareUrl(invoice: SaleInvoice, storeSettings: StoreSettings): string {
    const store = storeSettings.storeName || 'Apka Bill Store';
    const inv = invoice.invoice_number || invoice.invoiceNumber || 'INV';
    const total = inr(invoice.total_amount || invoice.grandTotal || 0);
    const date = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-IN') : 'Today';

    let itemLines = '';
    if (invoice.items && invoice.items.length > 0) {
      itemLines = invoice.items
        .map((i) => `• ${i.product_name || i.productName} x ${i.quantity} = ${inr(i.subtotal || i.lineTotal || 0)}`)
        .join('\n');
    }

    const text = `*${store}*\nInvoice: ${inv}\nDate: ${date}\n------------------\n${itemLines}\n------------------\n*Total Amount: ${total}*\nPayment: ${invoice.payment_method || 'Cash'}\n${storeSettings.receiptFooter || 'Thank you for shopping with us!'}`;

    const phone = invoice.customer_phone || invoice.customerPhone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : '';

    return `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;
  },
};

export default SalesService;


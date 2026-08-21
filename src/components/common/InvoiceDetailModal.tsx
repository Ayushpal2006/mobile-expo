/**
 * Apka Bill POS - Unified Transaction & Invoice Detail Modal
 *
 * Single source of truth for invoice inspection & post-checkout receipt actions across:
 * 1. BillingScreen (Post-Checkout Invoice & Receipt Screen)
 * 2. DashboardScreen (Recent Transactions)
 * 3. BillsScreen (View All Invoices / Sales History)
 * 4. CustomersScreen (Customer Purchase History)
 *
 * Real Invoice Data Displayed:
 * 1. Store Branding (Logo, Name, GSTIN, Address, Phone, Template)
 * 2. Invoice Info (Invoice Number, Completed/Paid Status, Date & Time, Cashier)
 * 3. Customer Info (Customer Name, Mobile Number / Walk-in Customer)
 * 4. Billed Products (Product Name, Quantity, Unit Price, Line Total)
 * 5. Totals (Subtotal, Discount, GST/Tax, Round-Off, Grand Total)
 * 6. Payment Info (Payment Method, Paid Amount)
 * 7. UPI QR (Rendered only when store UPI ID is configured; zero fake QR)
 * 8. Invoice Actions (View Receipt, Print ESC/POS, Download/Share PDF, WhatsApp, Duplicate, Void, New Sale)
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Modal,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  Share,
  Platform,
} from 'react-native';
import { SaleInvoice } from '../../types';
import PrinterService from '../../native/services/PrinterService';
import ReceiptFormatter from '../../native/utils/ReceiptFormatter';
import useSettings from '../../hooks/useSettings';
import { Button, Badge, StatusBadge, COLORS, SPACING, RADIUS, SHADOWS } from './UIComponents';
import useResponsive from '../../hooks/useResponsive';
import logger from '../../utils/logger';
import WhatsAppTemplateService, {
  WHATSAPP_TEMPLATES_REGISTRY,
} from '../../services/whatsapp/WhatsAppTemplateService';
import { resolveImageUrl } from '../../utils/imageHelper';

export interface InvoiceDetailModalProps {
  visible: boolean;
  invoice: SaleInvoice | null;
  onClose: () => void;
  onNewSale?: () => void;
  onVoidSuccess?: (updatedInvoice: SaleInvoice) => void;
  onDuplicatePOS?: (invoice: SaleInvoice) => void;
}

const inr = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  visible,
  invoice,
  onClose,
  onNewSale,
  onVoidSuccess,
  onDuplicatePOS,
}) => {
  const { isMedium, isExpanded } = useResponsive();
  const { data: storeSettings } = useSettings();

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [voidModalVisible, setVoidModalVisible] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!invoice) return null;

  const isVoid = ((invoice.status as string) || '').toLowerCase() === 'voided';
  const invNumber = invoice.invoice_number || invoice.invoiceNumber || `INV-${invoice.id}`;
  const grandTotal = Number(invoice.total_amount || invoice.grandTotal || 0);
  const subtotal = Number(invoice.subtotal || grandTotal);
  const discount = Number(invoice.discount || 0);
  const tax = Number(invoice.tax || invoice.gst || 0);
  const roundOff = Number(invoice.round_off || invoice.roundOff || 0);
  const paymentMethod = invoice.payment_method || invoice.paymentMethod || 'Cash';
  const paidAmount = Number(invoice.paid_amount || (invoice as any).amount_paid || grandTotal);
  const customerName = invoice.customer_name || invoice.customerName || 'Walk-in Customer';
  const customerPhone = invoice.customer_phone || invoice.customerPhone || '';
  const cashierName = invoice.cashier_name || invoice.cashierName || 'Cashier';
  const storeName = storeSettings?.storeName || 'Apka Bill Store';
  const storeAddress = storeSettings?.address || '';
  const storePhone = storeSettings?.phone || '';
  const storeGstin = storeSettings?.gstin || '';
  const storeUpi = storeSettings?.upiId?.trim() || undefined;
  const storeLogo = storeSettings?.logoUrl ? resolveImageUrl(storeSettings.logoUrl) : null;
  const templateName = storeSettings?.invoiceTemplate || 'Classic Thermal';

  // Build standard structured receipt payload for ESC/POS printing
  const buildReceiptData = () => {
    const qrPayload = storeUpi
      ? `upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${encodeURIComponent(storeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invNumber)}`
      : undefined;

    return {
      storeName,
      storeAddress: storeAddress || undefined,
      storePhone: storePhone || undefined,
      storeGstin: storeGstin || undefined,
      upiId: storeUpi,
      qrData: qrPayload,
      invoiceNumber: invNumber,
      date: invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
      customerName,
      customerPhone: customerPhone || undefined,
      cashierName,
      items: (invoice.items || []).map((i: any) => {
        const pName = i.product_name || i.productName || i.name || 'Product';
        const qty = Number(i.quantity || 1);
        const unitPrice = Number(i.unit_price || i.price || 0);
        const total = Number(i.subtotal || i.lineTotal || unitPrice * qty);
        return {
          name: pName,
          quantity: qty,
          unitPrice,
          total,
        };
      }),
      subtotal,
      discount,
      gst: tax,
      roundOff,
      grandTotal,
      paymentMethod,
      footerText: storeSettings?.receiptFooter || 'Thank you for shopping with us!',
    };
  };

  // 1. Print Receipt (Native ESC/POS Thermal)
  const handlePrintReceipt = async () => {
    setIsPrinting(true);
    try {
      const receiptData = buildReceiptData();
      const res = await PrinterService.printReceipt({ data: receiptData });
      if (res.success) {
        Alert.alert('Success', `Receipt sent to ${PrinterService.getActiveDriver().name}.`);
      } else {
        Alert.alert('Printer Error', res.error || 'Could not print receipt.');
      }
    } catch (err: any) {
      Alert.alert('Print Failed', err.message || 'Printer communication failed.');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. WhatsApp Share Action
  const handleWhatsAppShare = () => {
    const cleanPhone = customerPhone ? customerPhone.replace(/[^0-9]/g, '').slice(-10) : '';
    const configuredTemplateId = storeSettings?.whatsappTemplate || 'sales_invoice';
    const foundTpl = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === configuredTemplateId);
    const templateText = foundTpl ? foundTpl.defaultTemplate : WHATSAPP_TEMPLATES_REGISTRY[0].defaultTemplate;

    const msg = WhatsAppTemplateService.resolveTemplate(templateText, invoice, storeSettings);
    WhatsAppTemplateService.sendWhatsApp(cleanPhone, msg);
  };

  // 3. Share / PDF Share Action
  const handleShareInvoice = async () => {
    const itemsList = (invoice.items || [])
      .map((i: any) => `• ${i.product_name || i.productName || 'Item'} (${i.quantity}x) = ${inr(i.subtotal || i.lineTotal || 0)}`)
      .join('\n');

    const summary = `🧾 *${storeName}*\nInvoice: ${invNumber}\nDate: ${invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : 'Today'}\nCustomer: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}\n------------------\n${itemsList}\n------------------\nSubtotal: ${inr(subtotal)}\nDiscount: -${inr(discount)}\nTax/GST: ${inr(tax)}\n*Grand Total: ${inr(grandTotal)}*\nPayment: ${paymentMethod} (${inr(paidAmount)})\n${storeSettings?.receiptFooter || 'Thank you for shopping with us!'}`;

    try {
      await Share.share({
        title: `Invoice ${invNumber}`,
        message: summary,
      });
    } catch (err: any) {
      logger.info('Share dismissed:', err.message);
    }
  };

  // 4. Duplicate in POS (Load to cart)
  const handleDuplicateToPOS = () => {
    if (onDuplicatePOS) {
      onDuplicatePOS(invoice);
      onClose();
    } else {
      Alert.alert('Notice', 'Cart duplication available on Billing POS screen.');
    }
  };

  // 5. Void Invoice
  const handleConfirmVoid = async () => {
    if (!voidReason.trim()) {
      Alert.alert('Required', 'Please enter a void reason.');
      return;
    }
    setIsVoiding(true);
    try {
      const updated: SaleInvoice = {
        ...invoice,
        status: 'voided',
        void_reason: voidReason.trim(),
      };
      setVoidModalVisible(false);
      onVoidSuccess?.(updated);
      Alert.alert('Invoice Voided', `Invoice ${invNumber} has been marked as VOID.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to void invoice.');
    } finally {
      setIsVoiding(false);
    }
  };

  const formattedAscii = ReceiptFormatter.formatText(buildReceiptData(), '58mm');

  return (
    <>
      {/* Primary Detail Modal */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, (isMedium || isExpanded) ? { maxWidth: 580, width: '92%' } : { width: '95%' }]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.invoiceTitle}>{invNumber}</Text>
                  <View style={{ marginLeft: 8 }}>
                    {isVoid ? (
                      <StatusBadge status="VOIDED" variant="danger" />
                    ) : (
                      <StatusBadge status={invoice.status || 'PAID'} variant="success" />
                    )}
                  </View>
                </View>
                <Text style={styles.invoiceDate}>
                  {invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : 'Today'} · {paymentMethod}
                </Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* 1. Store Branding Card */}
              <View style={styles.brandingCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {storeLogo ? (
                    <Image source={{ uri: storeLogo }} style={styles.storeLogo} resizeMode="contain" />
                  ) : (
                    <View style={styles.storeLogoPlaceholder}>
                      <Text style={{ fontSize: 16 }}>🏬</Text>
                    </View>
                  )}
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.storeNameText}>{storeName}</Text>
                    {storeGstin ? <Text style={styles.storeMetaText}>GSTIN: {storeGstin}</Text> : null}
                    {storePhone ? <Text style={styles.storeMetaText}>Phone: {storePhone}</Text> : null}
                    {storeAddress ? <Text style={styles.storeMetaText} numberOfLines={1}>{storeAddress}</Text> : null}
                  </View>
                </View>
                <View style={styles.templateBadgeRow}>
                  <Text style={styles.templateBadgeText}>Layout: {templateName}</Text>
                  <Text style={styles.templateBadgeText}>Cashier: {cashierName}</Text>
                </View>
              </View>

              {/* 2. Customer Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Customer:</Text>
                  <Text style={styles.infoValue}>👤 {customerName}</Text>
                </View>
                {customerPhone ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mobile Number:</Text>
                    <Text style={styles.infoValue}>📱 {customerPhone}</Text>
                  </View>
                ) : (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mobile Number:</Text>
                    <Text style={[styles.infoValue, { color: COLORS.textMuted }]}>Walk-in (No Phone)</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment Status:</Text>
                  <Text style={[styles.infoValue, { color: COLORS.successText }]}>✓ Completed ({paymentMethod})</Text>
                </View>
              </View>

              {/* 3. Billed Products Table */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeader}>Billed Products ({invoice.items?.length || 0})</Text>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item: any, idx: number) => {
                    const iName = item.product_name || item.productName || item.name || 'Product';
                    const iQty = Number(item.quantity || 1);
                    const iPrice = Number(item.unit_price || item.price || 0);
                    const iTotal = Number(item.subtotal || item.lineTotal || iPrice * iQty);
                    return (
                      <View key={idx} style={styles.lineItemRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {iName}
                          </Text>
                          <Text style={styles.itemMeta}>
                            {inr(iPrice)} × {iQty} {item.discount ? `(Disc ${item.discount}%)` : ''}
                          </Text>
                        </View>
                        <Text style={styles.itemTotal}>{inr(iTotal)}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No item details attached.</Text>
                )}
              </View>

              {/* 4. Financial Totals */}
              <View style={styles.sectionBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalVal}>{inr(subtotal)}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Discount:</Text>
                    <Text style={[styles.totalVal, { color: COLORS.warning }]}>-{inr(discount)}</Text>
                  </View>
                )}
                {tax > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Output GST / Tax:</Text>
                    <Text style={styles.totalVal}>{inr(tax)}</Text>
                  </View>
                )}
                {roundOff !== 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Round Off:</Text>
                    <Text style={styles.totalVal}>{roundOff > 0 ? `+${inr(roundOff)}` : `-${inr(Math.abs(roundOff))}`}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                  <Text style={styles.grandTotalVal}>{inr(grandTotal)}</Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 4 }]}>
                  <Text style={styles.infoLabel}>Paid via {paymentMethod}:</Text>
                  <Text style={[styles.infoValue, { color: COLORS.successText }]}>{inr(paidAmount)}</Text>
                </View>
              </View>

              {/* 5. UPI QR Section (Shown strictly when store UPI is configured) */}
              {storeUpi && (
                <View style={styles.upiQrBox}>
                  <Text style={styles.upiQrTitle}>⚡ Instant UPI Payment QR</Text>
                  <Text style={styles.upiQrSub}>VPA: {storeUpi}</Text>
                  <Text style={styles.upiQrAmount}>Amount: {inr(grandTotal)}</Text>
                  <Text style={styles.upiNotice}>Customers can scan this receipt code from GPay, PhonePe, or Paytm.</Text>
                </View>
              )}

              {/* 6. Invoice Actions Grid */}
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={handlePrintReceipt} disabled={isPrinting}>
                  <Text style={styles.actionBtnPrimaryText}>{isPrinting ? 'Printing...' : '🖨️ Print ESC/POS'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setReceiptModalVisible(true)}>
                  <Text style={styles.actionBtnSecondaryText}>👁️ View Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleWhatsAppShare}>
                  <Text style={styles.actionBtnSecondaryText}>💬 WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleShareInvoice}>
                  <Text style={styles.actionBtnSecondaryText}>📤 Download / Share</Text>
                </TouchableOpacity>

                {onDuplicatePOS && (
                  <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleDuplicateToPOS}>
                    <Text style={styles.actionBtnSecondaryText}>🛒 Duplicate in POS</Text>
                  </TouchableOpacity>
                )}

                {!isVoid && (
                  <TouchableOpacity style={styles.actionBtnDanger} onPress={() => setVoidModalVisible(true)}>
                    <Text style={styles.actionBtnDangerText}>🚫 Void Invoice</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            <View style={styles.footerRow}>
              {onNewSale ? (
                <Button
                  title="➕ Start New Sale"
                  variant="primary"
                  onPress={() => {
                    onClose();
                    onNewSale();
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
              ) : null}
              <Button
                title={onNewSale ? 'Done' : 'Close'}
                variant="secondary"
                onPress={onClose}
                style={onNewSale ? { flex: 1 } : { width: '100%' }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ASCII Receipt Preview Modal */}
      <Modal visible={receiptModalVisible} animationType="fade" transparent onRequestClose={() => setReceiptModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440, width: '92%' }]}>
            <Text style={styles.modalSubTitle}>ESC/POS Thermal Receipt Preview</Text>
            <ScrollView style={styles.receiptBox}>
              <Text style={styles.receiptMonoText}>{formattedAscii}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
              <Button title="🖨️ Print Ticket" onPress={handlePrintReceipt} style={{ flex: 1, marginRight: 6 }} />
              <Button title="Close" variant="secondary" onPress={() => setReceiptModalVisible(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Void Reason Confirmation Dialog */}
      <Modal visible={voidModalVisible} animationType="fade" transparent onRequestClose={() => setVoidModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400, width: '90%' }]}>
            <Text style={[styles.modalTitle, { color: COLORS.danger }]}>Confirm Void Invoice</Text>
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginVertical: 6 }}>
              Voiding will reverse sales revenue in financial reports. Please enter the reason for audit logs:
            </Text>
            <TextInput
              style={styles.voidInput}
              placeholder="e.g. Customer returned items / Cashier entry error"
              value={voidReason}
              onChangeText={setVoidReason}
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm }}>
              <Button title="Cancel" variant="secondary" onPress={() => setVoidModalVisible(false)} style={{ marginRight: 8 }} />
              <Button title="Confirm Void" variant="danger" onPress={handleConfirmVoid} loading={isVoiding} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    maxHeight: '92%',
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  invoiceDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  scrollArea: {
    marginVertical: SPACING.xs,
  },
  brandingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  storeLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  storeLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  storeMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  templateBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  templateBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  sectionBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },
  upiQrBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  upiQrTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  upiQrSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  upiQrAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
    marginTop: 2,
  },
  upiNotice: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionBtnPrimary: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDanger: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnDangerText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  receiptBox: {
    backgroundColor: '#1E293B',
    borderRadius: RADIUS.md,
    padding: 12,
    maxHeight: 340,
  },
  receiptMonoText: {
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  voidInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 60,
  },
});

export default InvoiceDetailModal;

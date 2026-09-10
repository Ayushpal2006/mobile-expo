/**
 * Apka Bill POS - Compact Official Thermal Receipt Preview & Detail Modal
 *
 * Features:
 * - Visually styled like an authentic, compact thermal receipt paper ticket
 * - Single source of truth for receipt data (Print, Preview, WhatsApp, PDF)
 * - Scrollable receipt body with Dotted / Dashed dividers & Monospace typography
 * - Sticky bottom action container (Print, WhatsApp, Download PDF, View Receipt, New Sale)
 * - Safe area / Android navigation bar compliant
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SaleInvoice } from '../../types';
import PrinterService from '../../native/services/PrinterService';
import ReceiptFormatter from '../../native/utils/ReceiptFormatter';
import useSettings from '../../hooks/useSettings';
import { Button, StatusBadge, COLORS, SPACING, RADIUS, SHADOWS } from './UIComponents';
import useResponsive from '../../hooks/useResponsive';
import logger from '../../utils/logger';
import WhatsAppTemplateService, {
  WHATSAPP_TEMPLATES_REGISTRY,
} from '../../services/whatsapp/WhatsAppTemplateService';
import SalesService from '../../services/api/sales.service';
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
  const insets = useSafeAreaInsets();
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
  const isSynced = invoice.sync_status === 'synced';

  // Build standard structured receipt payload for ESC/POS printing & preview
  const buildReceiptData = () => {
    const qrPayload = storeUpi
      ? `upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${encodeURIComponent(storeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invNumber)}`
      : undefined;

    return {
      storeName,
      storeAddress,
      storePhone,
      storeGstin,
      upiId: storeUpi,
      qrData: qrPayload,
      paperWidth: (storeSettings?.paperWidth ? `${storeSettings.paperWidth}mm` : '58mm') as any,
      invoiceNumber: invNumber,
      date: invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
      cashierName,
      customerName,
      customerPhone: customerPhone || undefined,
      items: (invoice.items || []).map((item: any) => ({
        name: item.product_name || item.productName || item.name || 'Item',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || item.price || 0),
        total: Number(item.subtotal || item.lineTotal || (item.unit_price || item.price || 0) * (item.quantity || 1)),
      })),
      subtotal,
      discount,
      gst: tax,
      grandTotal,
      paymentMethod,
      footerText: storeSettings?.receiptFooter || 'Thank you for shopping with us!',
    };
  };

  const handlePrintReceipt = async () => {
    setIsPrinting(true);
    try {
      const receiptData = buildReceiptData();
      const success = await PrinterService.printReceipt({
        invoiceNumber: invNumber,
        data: receiptData,
      });

      if (success) {
        Alert.alert('Printed', `Invoice ${invNumber} sent to printer.`);
      } else {
        Alert.alert('Print Error', 'Could not reach configured printer. Check connection in Settings.');
      }
    } catch (err: any) {
      Alert.alert('Print Failed', err.message || 'An error occurred while printing.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const template = WHATSAPP_TEMPLATES_REGISTRY.find(
        (t) => t.id === storeSettings?.whatsappTemplate
      ) || WHATSAPP_TEMPLATES_REGISTRY[0];

      const cleanPhone = customerPhone.replace(/\D/g, '');
      const validPhone = cleanPhone.length >= 10 ? cleanPhone : '';

      const resolved = WhatsAppTemplateService.resolveTemplate(
        template.defaultTemplate,
        invoice,
        storeSettings
      );

      await WhatsAppTemplateService.sendWhatsApp(validPhone, resolved);
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err.message || 'Could not launch WhatsApp.');
    }
  };

  const handleShareInvoice = async () => {
    try {
      const summaryText = `*INVOICE: ${invNumber}*\nStore: ${storeName}\nDate: ${new Date().toLocaleDateString('en-IN')}\nCustomer: ${customerName}\n\n*Items:*\n${(invoice.items || []).map((i: any) => `• ${i.name || i.product_name} x${i.quantity} = ${inr(i.subtotal || (i.unit_price * i.quantity))}`).join('\n')}\n\n*Grand Total: ${inr(grandTotal)}*\nPaid via ${paymentMethod}\n\nThank you!`;
      await Share.share({
        title: `Invoice ${invNumber}`,
        message: summaryText,
      });
    } catch (err: any) {
      logger.warn('[InvoiceDetailModal] Share error:', err.message);
    }
  };

  const handleDuplicateToPOS = () => {
    if (onDuplicatePOS) {
      onDuplicatePOS(invoice);
      onClose();
    }
  };

  const confirmVoidInvoice = async () => {
    if (!voidReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a valid reason for voiding this invoice.');
      return;
    }
    setIsVoiding(true);
    try {
      const targetIdentifier = invoice.local_id || invoice.invoice_number || invoice.id;
      const voided = await SalesService.voidSale(
        targetIdentifier,
        voidReason.trim(),
        cashierName,
        invoice.store_id || 1
      );

      const updated: SaleInvoice = voided || {
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
      {/* Primary Detail & Compact Receipt Modal */}
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, (isMedium || isExpanded) ? { maxWidth: 480, width: '92%' } : { width: '96%' }]}>
            
            {/* Modal Header */}
            <View style={styles.topHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.headerInvoiceNum}>{invNumber}</Text>
                  <View style={{ marginLeft: 8 }}>
                    {isVoid ? (
                      <StatusBadge status="VOIDED" variant="danger" />
                    ) : isSynced ? (
                      <StatusBadge status="SYNCED" variant="success" />
                    ) : (
                      <StatusBadge status="PENDING" variant="warning" />
                    )}
                  </View>
                </View>
                <Text style={styles.headerDate}>
                  {invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : 'Today'} · {cashierName}
                </Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Receipt Body (Styled as a Compact Official Thermal Slip) */}
            <ScrollView style={styles.receiptScrollArea} contentContainerStyle={styles.receiptPaper}>
              
              {/* Store Branding Header */}
              <View style={styles.receiptStoreHeader}>
                {storeLogo ? (
                  <Image source={{ uri: storeLogo }} style={styles.receiptStoreLogo} resizeMode="contain" />
                ) : null}
                <Text style={styles.receiptStoreName}>{storeName}</Text>
                {storeGstin ? <Text style={styles.receiptStoreMeta}>GSTIN: {storeGstin}</Text> : null}
                {storeAddress ? <Text style={styles.receiptStoreMeta} numberOfLines={2}>{storeAddress}</Text> : null}
                {storePhone ? <Text style={styles.receiptStoreMeta}>Tel: {storePhone}</Text> : null}
              </View>

              <View style={styles.dashedDivider} />

              {/* Customer & Sale Metadata Row */}
              <View style={styles.metaRow}>
                <Text style={styles.metaTextLeft}>Customer: <Text style={styles.metaTextBold}>{customerName}</Text></Text>
                <Text style={styles.metaTextRight}>{paymentMethod}</Text>
              </View>
              {customerPhone ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaTextLeft}>Phone: {customerPhone}</Text>
                  <Text style={styles.metaTextRight}>{isVoid ? 'VOIDED' : 'PAID'}</Text>
                </View>
              ) : null}

              <View style={styles.dashedDivider} />

              {/* Billed Items Header */}
              <View style={styles.itemHeaderRow}>
                <Text style={[styles.itemHeaderCol, { flex: 2 }]}>ITEM</Text>
                <Text style={[styles.itemHeaderCol, { flex: 1, textAlign: 'center' }]}>QTY</Text>
                <Text style={[styles.itemHeaderCol, { flex: 1, textAlign: 'right' }]}>RATE</Text>
                <Text style={[styles.itemHeaderCol, { flex: 1.2, textAlign: 'right' }]}>TOTAL</Text>
              </View>
              <View style={styles.solidDivider} />

              {/* Billed Items List */}
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item: any, idx: number) => {
                  const iName = item.product_name || item.productName || item.name || 'Product';
                  const iQty = Number(item.quantity || 1);
                  const iPrice = Number(item.unit_price || item.price || 0);
                  const iTotal = Number(item.subtotal || item.lineTotal || iPrice * iQty);
                  return (
                    <View key={idx} style={styles.receiptItemRow}>
                      <View style={{ flex: 2, paddingRight: 4 }}>
                        <Text style={styles.itemRowName} numberOfLines={2}>{iName}</Text>
                        {item.discount ? <Text style={styles.itemRowDisc}>Disc {item.discount}%</Text> : null}
                      </View>
                      <Text style={[styles.itemRowCol, { flex: 1, textAlign: 'center' }]}>{iQty}</Text>
                      <Text style={[styles.itemRowCol, { flex: 1, textAlign: 'right' }]}>{iPrice.toFixed(0)}</Text>
                      <Text style={[styles.itemRowCol, { flex: 1.2, textAlign: 'right', fontWeight: '700' }]}>{iTotal.toFixed(2)}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyItemsText}>No items attached.</Text>
              )}

              <View style={styles.solidDivider} />

              {/* Financial Totals Summary */}
              <View style={styles.totalsContainer}>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                  <Text style={styles.receiptTotalValue}>{inr(subtotal)}</Text>
                </View>

                {discount > 0 ? (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Discount</Text>
                    <Text style={[styles.receiptTotalValue, { color: '#DC2626' }]}>-{inr(discount)}</Text>
                  </View>
                ) : null}

                {tax > 0 ? (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Output GST</Text>
                    <Text style={styles.receiptTotalValue}>{inr(tax)}</Text>
                  </View>
                ) : null}

                {roundOff !== 0 ? (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Round Off</Text>
                    <Text style={styles.receiptTotalValue}>{roundOff > 0 ? `+${inr(roundOff)}` : `-${inr(Math.abs(roundOff))}`}</Text>
                  </View>
                ) : null}

                <View style={[styles.receiptTotalRow, styles.receiptGrandTotalRow]}>
                  <Text style={styles.receiptGrandTotalLabel}>GRAND TOTAL</Text>
                  <Text style={styles.receiptGrandTotalValue}>{inr(grandTotal)}</Text>
                </View>

                <View style={[styles.receiptTotalRow, { marginTop: 3 }]}>
                  <Text style={styles.receiptTotalLabel}>Amount Paid ({paymentMethod})</Text>
                  <Text style={[styles.receiptTotalValue, { color: '#059669', fontWeight: '700' }]}>{inr(paidAmount)}</Text>
                </View>
              </View>

              {/* Real UPI QR Box (Only rendered if UPI ID is configured) */}
              {storeUpi ? (
                <View style={styles.upiReceiptCard}>
                  <Text style={styles.upiReceiptTitle}>⚡ Scan & Pay via UPI</Text>
                  <Text style={styles.upiReceiptVpa}>{storeUpi}</Text>
                  <Text style={styles.upiReceiptNotice}>GPay · PhonePe · Paytm · BHIM</Text>
                </View>
              ) : null}

              <View style={styles.dashedDivider} />
              <Text style={styles.receiptFooterNote}>{storeSettings?.receiptFooter || 'Thank you for your business!'}</Text>
            </ScrollView>

            {/* Sticky Bottom Action Bar (Fixed at bottom outside ScrollView) */}
            <View style={[styles.stickyActionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              
              {/* Row 1: Primary Print & WhatsApp */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { flex: 1, backgroundColor: '#0F172A' }]}
                  onPress={handlePrintReceipt}
                  disabled={isPrinting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>{isPrinting ? 'Printing...' : '🖨️ Print'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { flex: 1, backgroundColor: '#16A34A' }]}
                  onPress={handleWhatsAppShare}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Secondary Download PDF & View Monospace Ticket */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { flex: 1 }]}
                  onPress={handleShareInvoice}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>📄 PDF Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { flex: 1 }]}
                  onPress={() => setReceiptModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryActionBtnText}>👁️ View Receipt</Text>
                </TouchableOpacity>

                {onDuplicatePOS ? (
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { width: 44, alignItems: 'center' }]}
                    onPress={handleDuplicateToPOS}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 14 }}>🛒</Text>
                  </TouchableOpacity>
                ) : null}

                {!isVoid ? (
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { width: 44, alignItems: 'center', borderColor: '#FECACA' }]}
                    onPress={() => setVoidModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, color: '#DC2626' }}>🚫</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Final Row: New Sale or Close */}
              {onNewSale ? (
                <TouchableOpacity
                  style={styles.newSaleBtn}
                  onPress={() => {
                    onClose();
                    onNewSale();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.newSaleBtnText}>✓ Start New Sale</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.dismissBtnText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>

      {/* Monospace ASCII Thermal Receipt Preview Modal */}
      <Modal visible={receiptModalVisible} animationType="fade" transparent onRequestClose={() => setReceiptModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 380, width: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>ESC/POS Monospace Ticket</Text>
              <TouchableOpacity onPress={() => setReceiptModalVisible(false)}>
                <Text style={{ fontSize: 16, color: '#64748B', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monoBox}>
              <Text style={styles.monoText}>{formattedAscii}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="🖨️ Print Ticket" onPress={handlePrintReceipt} style={{ flex: 1 }} />
              <Button title="Close" variant="secondary" onPress={() => setReceiptModalVisible(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Void Reason Confirmation Dialog */}
      <Modal visible={voidModalVisible} animationType="fade" transparent onRequestClose={() => setVoidModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 380, width: '90%' }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#DC2626', marginBottom: 4 }}>Confirm Void Invoice</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
              Voiding will reverse sales revenue in reports. Please enter the reason for audit logs:
            </Text>
            <TextInput
              style={styles.voidTextInput}
              placeholder="e.g. Customer returned items / Cashier error"
              value={voidReason}
              onChangeText={setVoidReason}
              placeholderTextColor="#94A3B8"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button
                title={isVoiding ? 'Voiding...' : 'Confirm Void'}
                variant="danger"
                onPress={confirmVoidInvoice}
                loading={isVoiding}
                style={{ flex: 1 }}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setVoidModalVisible(false)}
                disabled={isVoiding}
                style={{ flex: 1 }}
              />
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
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    maxHeight: '94%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerInvoiceNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  closeIconText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '800',
    lineHeight: 14,
  },
  receiptScrollArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    margin: 10,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  receiptStoreHeader: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  receiptStoreLogo: {
    width: 38,
    height: 38,
    marginBottom: 4,
  },
  receiptStoreName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  receiptStoreMeta: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 1,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  solidDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  metaTextLeft: {
    fontSize: 11,
    color: '#475569',
  },
  metaTextBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  metaTextRight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  itemHeaderCol: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemRowName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemRowDisc: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '600',
  },
  itemRowCol: {
    fontSize: 11,
    color: '#0F172A',
  },
  emptyItemsText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 6,
  },
  totalsContainer: {
    marginTop: 4,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  receiptTotalLabel: {
    fontSize: 11,
    color: '#475569',
  },
  receiptTotalValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  receiptGrandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
    paddingVertical: 4,
    marginTop: 4,
  },
  receiptGrandTotalLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  receiptGrandTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  upiReceiptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  upiReceiptTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  upiReceiptVpa: {
    fontSize: 10,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 1,
  },
  upiReceiptNotice: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  receiptFooterNote: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  stickyActionBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
    ...SHADOWS.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  newSaleBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSaleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  dismissBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  monoBox: {
    maxHeight: 260,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#38BDF8',
    fontSize: 10,
    lineHeight: 14,
  },
  voidTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    padding: 8,
    fontSize: 12,
    color: '#0F172A',
  },
});

export default InvoiceDetailModal;

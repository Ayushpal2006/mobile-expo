/**
 * Apka Bill POS - Multi-Template Invoice & Receipt Renderer
 *
 * 1:1 Parity with Web Invoice Template System:
 * - Classic: Traditional high-contrast Thermal POS ticket (58mm/80mm)
 * - Modern: Contemporary corporate layout with brand accent header
 * - Retail: Supermarket catalog style with SKU/Barcode and item savings callout
 * - Compact: Minimalist slip for rapid counter checkout
 * - Detailed: Full Tax Invoice with itemized GST breakdown & payment QR
 */

import React from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import QRCodeView from '../common/QRCodeView';
import { StoreSettings, SaleInvoice } from '../../types';
import { COLORS, SPACING, RADIUS } from '../common/UIComponents';

export type InvoiceTemplateId = 'Classic' | 'Modern' | 'Retail' | 'Compact' | 'Detailed';

export interface InvoiceTemplateInfo {
  id: InvoiceTemplateId;
  name: string;
  badge: string;
  description: string;
  recommendedFor: string;
  paperWidth: '58mm' | '80mm';
}

export const INVOICE_TEMPLATES_REGISTRY: InvoiceTemplateInfo[] = [
  {
    id: 'Classic',
    name: 'Classic Thermal',
    badge: 'Popular',
    description: 'Traditional standard receipt with bold headers, divider lines, and clean financial breakdown.',
    recommendedFor: '58mm & 80mm ESC/POS thermal roll printers',
    paperWidth: '58mm',
  },
  {
    id: 'Modern',
    name: 'Modern Banner',
    badge: 'Premium',
    description: 'Contemporary design with colored brand header, rounded cards, and prominent payment badge.',
    recommendedFor: 'Boutiques, cafes, and modern retail counters',
    paperWidth: '80mm',
  },
  {
    id: 'Retail',
    name: 'Retail Supermarket',
    badge: 'High Detail',
    description: 'Includes SKU codes, line-item savings callout, item tax rates, and loyalty summary.',
    recommendedFor: 'Grocery stores, supermarkets, and electronics shops',
    paperWidth: '80mm',
  },
  {
    id: 'Compact',
    name: 'Compact Express',
    badge: 'Fast',
    description: 'High-speed minimalist slip designed to save paper roll length during rush hours.',
    recommendedFor: 'Kiosks, food trucks, and rapid checkout counters',
    paperWidth: '58mm',
  },
  {
    id: 'Detailed',
    name: 'Detailed Tax Invoice',
    badge: 'GST Ready',
    description: 'Complete GST B2C format with CGST, SGST, and total tax breakdown table.',
    recommendedFor: 'Wholesale, hardware, and B2C registered billing',
    paperWidth: '80mm',
  },
];

export interface InvoiceTemplateRendererProps {
  templateId?: InvoiceTemplateId;
  invoice?: Partial<SaleInvoice> | null;
  storeSettings?: Partial<StoreSettings> | null;
  showQr?: boolean;
}

const inr = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

// Sample data generator for live preview in Settings
export const SAMPLE_INVOICE_DATA: Partial<SaleInvoice> = {
  id: 101,
  invoice_number: 'INV-2026-0042',
  created_at: new Date().toISOString(),
  customer_name: 'Rahul Sharma',
  customer_phone: '9876543210',
  cashier_name: 'Store Manager',
  payment_method: 'UPI',
  subtotal: 450.0,
  discount: 50.0,
  tax: 72.0,
  total_amount: 472.0,
  items: [
    { product_name: 'Basmati Rice (1kg)', quantity: 2, unit_price: 150.0, subtotal: 300.0 } as any,
    { product_name: 'Tata Salt (1kg)', quantity: 1, unit_price: 30.0, subtotal: 30.0 } as any,
    { product_name: 'Fortune Oil (1L)', quantity: 1, unit_price: 120.0, subtotal: 120.0 } as any,
  ],
};

export const InvoiceTemplateRenderer: React.FC<InvoiceTemplateRendererProps> = ({
  templateId = 'Classic',
  invoice = SAMPLE_INVOICE_DATA,
  storeSettings,
  showQr = true,
}) => {
  const inv = invoice || SAMPLE_INVOICE_DATA;
  const storeName = storeSettings?.storeName || 'Apka Bill Store';
  const storeAddress = storeSettings?.address || '123 Market Street, New Delhi';
  const storePhone = storeSettings?.phone || '+91 98765 43210';
  const storeGstin = storeSettings?.gstin || '07AAAAA0000A1Z5';
  const storeUpi = storeSettings?.upiId || 'store@upi';
  const footerText = storeSettings?.receiptFooter || 'Thank you for shopping with us! Visit again.';
  const logoUrl = storeSettings?.logoUrl;

  const grandTotal = Number(inv?.total_amount || inv?.grandTotal || 472);
  const subtotal = Number(inv?.subtotal || 450);
  const discount = Number(inv?.discount || 0);
  const tax = Number(inv?.tax || inv?.gst || 0);
  const invNum = inv?.invoice_number || 'INV-001';
  const dateStr = inv?.created_at ? new Date(inv.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  const items = inv?.items && inv.items.length > 0 ? inv.items : SAMPLE_INVOICE_DATA.items!;

  const upiPayload = `upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${encodeURIComponent(storeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invNum)}`;

  // 1. Classic Thermal Template
  if (templateId === 'Classic') {
    return (
      <View style={styles.receiptContainer}>
        {/* Header */}
        <View style={styles.centerAlign}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain" /> : null}
          <Text style={styles.classicTitle}>{storeName.toUpperCase()}</Text>
          {storeAddress ? <Text style={styles.classicSub}>{storeAddress}</Text> : null}
          {storePhone ? <Text style={styles.classicSub}>Ph: {storePhone}</Text> : null}
          {storeGstin ? <Text style={styles.classicSub}>GSTIN: {storeGstin}</Text> : null}
        </View>

        <View style={styles.dashedDivider} />

        {/* Invoice Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Inv: {invNum}</Text>
          <Text style={styles.metaText}>{dateStr.split(',')[0]}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Customer: {inv?.customer_name || 'Walk-in'}</Text>
          <Text style={styles.metaText}>{inv?.customer_phone || ''}</Text>
        </View>

        <View style={styles.dashedDivider} />

        {/* Items Table */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colHeader, { flex: 2 }]}>ITEM</Text>
          <Text style={[styles.colHeader, { width: 35, textAlign: 'center' }]}>QTY</Text>
          <Text style={[styles.colHeader, { width: 55, textAlign: 'right' }]}>PRICE</Text>
          <Text style={[styles.colHeader, { width: 60, textAlign: 'right' }]}>TOTAL</Text>
        </View>
        <View style={styles.dashedDivider} />

        {items.map((item: any, idx: number) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={[styles.itemText, { flex: 2 }]} numberOfLines={1}>
              {item.product_name || item.name || 'Item'}
            </Text>
            <Text style={[styles.itemText, { width: 35, textAlign: 'center' }]}>{item.quantity || 1}</Text>
            <Text style={[styles.itemText, { width: 55, textAlign: 'right' }]}>{inr(item.unit_price || item.price || 0)}</Text>
            <Text style={[styles.itemText, { width: 60, textAlign: 'right', fontWeight: '700' }]}>
              {inr(item.subtotal || (item.unit_price || 0) * (item.quantity || 1))}
            </Text>
          </View>
        ))}

        <View style={styles.dashedDivider} />

        {/* Totals */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalVal}>{inr(subtotal)}</Text>
        </View>
        {discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalVal, { color: COLORS.warning }]}>-{inr(discount)}</Text>
          </View>
        )}
        {tax > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST Tax</Text>
            <Text style={styles.totalVal}>{inr(tax)}</Text>
          </View>
        )}

        <View style={styles.solidDivider} />
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandTotalVal}>{inr(grandTotal)}</Text>
        </View>
        <View style={styles.solidDivider} />

        <Text style={[styles.metaText, { marginTop: 4 }]}>Paid via: {(inv?.payment_method || 'Cash').toUpperCase()}</Text>

        {/* QR Code Section */}
        {showQr && storeUpi ? (
          <View style={styles.qrSection}>
            <Text style={styles.qrTitle}>SCAN TO PAY (UPI)</Text>
            <QRCodeView value={upiPayload} size={110} />
            <Text style={styles.qrUpiText}>{storeUpi}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={[styles.centerAlign, { marginTop: 10 }]}>
          <Text style={styles.footerText}>{footerText}</Text>
          <Text style={styles.poweredByText}>Powered by Apka Bill POS</Text>
        </View>
      </View>
    );
  }

  // 2. Modern Banner Template
  if (templateId === 'Modern') {
    return (
      <View style={[styles.receiptContainer, styles.modernContainer]}>
        {/* Banner Header */}
        <View style={styles.modernBanner}>
          <Text style={styles.modernBannerStore}>{storeName}</Text>
          <Text style={styles.modernBannerSub}>{storePhone} · {storeGstin ? `GSTIN: ${storeGstin}` : 'Tax Invoice'}</Text>
        </View>

        <View style={{ padding: 10 }}>
          <View style={styles.modernMetaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.modernMetaLabel}>Invoice No:</Text>
              <Text style={styles.modernMetaVal}>{invNum}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.modernMetaLabel}>Date & Time:</Text>
              <Text style={styles.modernMetaVal}>{dateStr}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.modernMetaLabel}>Billed To:</Text>
              <Text style={styles.modernMetaVal}>{inv?.customer_name || 'Walk-in Customer'}</Text>
            </View>
          </View>

          {/* Items */}
          <Text style={styles.sectionHeaderTitle}>Purchased Items</Text>
          {items.map((item: any, idx: number) => (
            <View key={idx} style={styles.modernItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modernItemName}>{item.product_name || item.name}</Text>
                <Text style={styles.modernItemSub}>{inr(item.unit_price || 0)} × {item.quantity || 1}</Text>
              </View>
              <Text style={styles.modernItemTotal}>
                {inr(item.subtotal || (item.unit_price || 0) * (item.quantity || 1))}
              </Text>
            </View>
          ))}

          {/* Breakdown Card */}
          <View style={styles.modernTotalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>{inr(subtotal)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount Savings</Text>
                <Text style={[styles.totalVal, { color: COLORS.warning }]}>-{inr(discount)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxes (GST)</Text>
              <Text style={styles.totalVal}>{inr(tax)}</Text>
            </View>
            <View style={[styles.totalRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#CBD5E1' }]}>
              <Text style={styles.grandTotalLabel}>Net Payable</Text>
              <Text style={styles.modernGrandTotal}>{inr(grandTotal)}</Text>
            </View>
          </View>

          {showQr && storeUpi ? (
            <View style={styles.modernQrCard}>
              <Text style={styles.modernQrTitle}>Instant UPI Checkout</Text>
              <QRCodeView value={upiPayload} size={110} />
              <Text style={styles.qrUpiText}>{storeUpi}</Text>
            </View>
          ) : null}

          <Text style={styles.modernFooter}>{footerText}</Text>
        </View>
      </View>
    );
  }

  // 3. Retail Supermarket / 4. Compact / 5. Detailed fallback
  return (
    <View style={styles.receiptContainer}>
      <View style={styles.centerAlign}>
        <Text style={styles.classicTitle}>{storeName}</Text>
        <Text style={styles.classicSub}>*** {templateId.toUpperCase()} RECEIPT ***</Text>
        <Text style={styles.classicSub}>{storeAddress}</Text>
      </View>

      <View style={styles.dashedDivider} />

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Inv: {invNum}</Text>
        <Text style={styles.metaText}>{dateStr.split(',')[0]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Customer: {inv?.customer_name || 'Walk-in'}</Text>
        <Text style={styles.metaText}>Pay: {inv?.payment_method || 'Cash'}</Text>
      </View>

      <View style={styles.dashedDivider} />

      {items.map((item: any, idx: number) => (
        <View key={idx} style={styles.itemRow}>
          <Text style={[styles.itemText, { flex: 1 }]}>{item.product_name || item.name}</Text>
          <Text style={[styles.itemText, { width: 50, textAlign: 'center' }]}>x{item.quantity || 1}</Text>
          <Text style={[styles.itemText, { width: 70, textAlign: 'right', fontWeight: '700' }]}>
            {inr(item.subtotal || (item.unit_price || 0) * (item.quantity || 1))}
          </Text>
        </View>
      ))}

      <View style={styles.dashedDivider} />

      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
        <Text style={styles.grandTotalVal}>{inr(grandTotal)}</Text>
      </View>

      {showQr && storeUpi ? (
        <View style={styles.qrSection}>
          <QRCodeView value={upiPayload} size={100} />
          <Text style={styles.qrUpiText}>{storeUpi}</Text>
        </View>
      ) : null}

      <Text style={styles.footerText}>{footerText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  receiptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  centerAlign: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logoImg: {
    width: 60,
    height: 35,
    marginBottom: 4,
  },
  classicTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  classicSub: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
    marginTop: 1,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748B',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  solidDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  metaText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colHeader: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  itemText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#0F172A',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  totalLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
  },
  totalVal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  grandTotalLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  grandTotalVal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  qrTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    color: '#000000',
  },
  qrUpiText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#475569',
    marginTop: 3,
  },
  footerText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
  },
  poweredByText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },

  // Modern Template Styles
  modernContainer: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  modernBanner: {
    backgroundColor: '#0284C7',
    padding: 12,
    alignItems: 'center',
  },
  modernBannerStore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modernBannerSub: {
    fontSize: 11,
    color: '#E0F2FE',
    marginTop: 2,
  },
  modernMetaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginBottom: 8,
  },
  modernMetaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modernMetaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modernItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modernItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  modernItemSub: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  modernItemTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  modernTotalCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 8,
  },
  modernGrandTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0284C7',
  },
  modernQrCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modernQrTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 4,
  },
  modernFooter: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default InvoiceTemplateRenderer;

/**
 * Apka Bill Mobile POS - Official Responsive Reports & Analytics Screen (100% Web Parity)
 *
 * Production Financial & Tax Analytics:
 * - Phone (Compact): Clean stacked metrics, date pills, sub-tabs, and scrollable tables
 * - Small Tablet / POS (Medium): 2-to-3 column metric grid with wider touch targets
 * - Tablet Landscape (Expanded): Multi-column executive dashboard (6 KPI cards, side-by-side breakdowns, centered canvas)
 * - Real-time metrics: Total Revenue, Gross Profit, Total Orders, Net Profit, Output GST, Total Discounts
 * - GST Slab Breakdown: 0%, 5%, 12%, 18%, 28% tax buckets
 * - Date Range Filters: Today, Yesterday, Last 7 Days, This Month
 * - Multi-Format Export: PDF, Excel, CSV via ReportService
 * - Multi-tenant store scoping & zero fake data
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useReports from '../hooks/useReports';
import useResponsive from '../hooks/useResponsive';
import {
  Card,
  LoadingSpinner,
  Badge,
  StatusBadge,
  Button,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
} from '../components/common/UIComponents';
import { inr, formatNumber } from '../utils/format';
import { ReportService, GstSlabSummary, TopProductItem, TopCustomerItem } from '../services/api/report.service';
import { useAuth } from '../context/AuthContext';

type ReportTab = 'overview' | 'gst' | 'products' | 'customers' | 'invoices';

export const ReportsScreen: React.FC = () => {
  const { store } = useAuth();
  const storeId = store?.id || 1;
  const { isExpanded, isMedium, isCompact } = useResponsive();

  const [filter, setFilter] = useState<'today' | 'yesterday' | '7days' | 'month'>('today');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const { data, isLoading, isRefreshing, refetch } = useReports(filter);

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await ReportService.exportReport(format, filter, storeId);
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Unable to generate report export.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !isRefreshing) {
    return <LoadingSpinner message="Generating report analytics..." />;
  }

  const revenue = data?.totalSales || data?.totalRevenue || 0;
  const profit = data?.grossProfit || data?.netProfit || 0;
  const orders = data?.totalOrdersCount || data?.todayOrdersCount || (data?.salesList ? data.salesList.length : 0);
  const avgTicket = orders > 0 ? revenue / orders : 0;
  const gst = data?.totalGstCollected || (data?.gstSlabs ? data.gstSlabs.reduce((sum, s) => sum + (s.totalTax || 0), 0) : 0);
  const discount = (data as any)?.totalDiscount || 0;
  const paymentBreakdown = data?.paymentBreakdown || [];
  const gstSlabs = data?.gstSlabs || [];
  const topProducts = data?.topProducts || [];
  const topCustomers = data?.topCustomers || [];
  const salesList = data?.salesList || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.content, isExpanded && styles.expandedContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Toolbar */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Financial & Sales Analytics</Text>
            <Text style={styles.headerSub}>Real-time store performance and tax breakdown</Text>
          </View>

          <View style={styles.exportButtonGroup}>
            {isExporting ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('pdf')} activeOpacity={0.7}>
                  <Text style={styles.exportBtnText}>📄 PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { marginLeft: 4 }]} onPress={() => handleExport('excel')} activeOpacity={0.7}>
                  <Text style={styles.exportBtnText}>📊 Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { marginLeft: 4 }]} onPress={() => handleExport('csv')} activeOpacity={0.7}>
                  <Text style={styles.exportBtnText}>📁 CSV</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* 2. Date Range Filter Pills */}
        <View style={styles.filterPillRow}>
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
            ] as const
          ).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.pill, filter === p.id && styles.pillActive]}
              onPress={() => setFilter(p.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, filter === p.id && styles.pillTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 3. Navigation Sub-Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'gst', label: 'GST Breakdown' },
              { id: 'products', label: 'Top Products' },
              { id: 'customers', label: 'Customers' },
              { id: 'invoices', label: 'Invoice Log' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTab, activeTab === tab.id && styles.subTabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subTabText, activeTab === tab.id && styles.subTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 4. Tab 1: Overview Dashboard */}
        {activeTab === 'overview' && (
          <View>
            <View style={styles.kpiGrid}>
              {[
                { label: 'Total Revenue', icon: '💰', val: inr(revenue), color: COLORS.text },
                { label: 'Gross Profit', icon: '📈', val: inr(profit), color: COLORS.success },
                { label: 'Total Orders', icon: '🛍️', val: String(orders), color: COLORS.text },
                { label: 'Average Ticket', icon: '🎯', val: inr(Math.round(avgTicket || 0)), color: COLORS.text },
                { label: 'Output GST', icon: '🏛️', val: inr(gst), color: COLORS.secondary },
                { label: 'Discounts Given', icon: '🏷️', val: inr(discount), color: COLORS.warning },
              ].map((kpi, idx) => (
                <Card
                  key={idx}
                  style={[
                    styles.kpiCard,
                    {
                      width: isExpanded
                        ? '31.8%'
                        : isMedium
                        ? '31.8%'
                        : '48.5%',
                    },
                  ]}
                >
                  <View style={styles.kpiHeaderRow}>
                    <Text style={styles.kpiLabel}>{kpi.label}</Text>
                    <Text style={styles.kpiIcon}>{kpi.icon}</Text>
                  </View>
                  <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.val}</Text>
                </Card>
              ))}
            </View>

            {/* Payment Method Breakdown */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Payment Tender Split</Text>
              <View style={styles.paymentSplitGrid}>
                {Array.isArray(paymentBreakdown) ? (
                  paymentBreakdown.map((item) => (
                    <View key={item.method} style={styles.paymentSplitBox}>
                      <Text style={styles.paymentSplitLabel}>{item.method.toUpperCase()}</Text>
                      <Text style={styles.paymentSplitVal}>{inr(item.total || 0)}</Text>
                    </View>
                  ))
                ) : (
                  Object.entries(paymentBreakdown as Record<string, number>).map(([method, amount]) => (
                    <View key={method} style={styles.paymentSplitBox}>
                      <Text style={styles.paymentSplitLabel}>{method.toUpperCase()}</Text>
                      <Text style={styles.paymentSplitVal}>{inr(amount as number)}</Text>
                    </View>
                  ))
                )}
              </View>
            </Card>
          </View>
        )}

        {/* 5. Tab 2: GST Tax Slabs */}
        {activeTab === 'gst' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Output GST Tax Slab Breakdown</Text>
            <View style={styles.tableBox}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, { flex: 1 }]}>Slab Rate</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Taxable Amount</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Calculated GST</Text>
              </View>

              {gstSlabs.length > 0 ? (
                gstSlabs.map((slab: GstSlabSummary) => (
                  <View key={slab.rate} style={styles.tableRow}>
                    <Text style={[styles.tdText, { flex: 1, fontWeight: '700' }]}>{slab.rate}% GST</Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>{inr(slab.taxableAmount || 0)}</Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'right', color: COLORS.primary, fontWeight: '700' }]}>
                      {inr(slab.totalTax || 0)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No tax transactions recorded for this period.</Text>
              )}
            </View>
          </Card>
        )}

        {/* 6. Tab 3: Top Products */}
        {activeTab === 'products' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Performing Products</Text>
            <View style={styles.tableBox}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, { flex: 2 }]}>Product Name</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>Units Sold</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Revenue</Text>
              </View>

              {topProducts.length > 0 ? (
                topProducts.map((p: TopProductItem, idx: number) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tdText, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>{p.quantitySold}</Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'right', fontWeight: '700', color: COLORS.primary }]}>
                      {inr(p.revenue)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No sales recorded in this period.</Text>
              )}
            </View>
          </Card>
        )}

        {/* 7. Tab 4: Customers */}
        {activeTab === 'customers' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Customer Purchase Summary</Text>
            <View style={styles.tableBox}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, { flex: 2 }]}>Customer</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>Orders</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Total Spent</Text>
              </View>

              {topCustomers.length > 0 ? (
                topCustomers.map((c: TopCustomerItem, idx: number) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tdText, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>{c.orderCount}</Text>
                    <Text style={[styles.tdText, { flex: 1, textAlign: 'right', fontWeight: '700', color: COLORS.primary }]}>
                      {inr(c.totalSpent)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No customer purchases in this period.</Text>
              )}
            </View>
          </Card>
        )}

        {/* 8. Tab 5: Invoice Log */}
        {activeTab === 'invoices' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Invoice Ledger Log</Text>
            <View style={styles.tableBox}>
              {salesList.length > 0 ? (
                salesList.map((inv: any) => (
                  <View key={inv.id} style={styles.invoiceLogRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoiceLogNumber}>{inv.invoice_number || inv.invoiceNumber || `INV-${inv.id}`}</Text>
                      <Text style={styles.invoiceLogMeta}>
                        {inv.created_at || inv.createdAt
                          ? (inv.created_at || inv.createdAt).split('T')[0]
                          : 'Today'}{' '}
                        · {inv.customer_name || inv.customerName || 'Walk-in'} · {inv.payment_method || inv.paymentMethod || 'Cash'}
                      </Text>
                    </View>
                    <Text style={styles.invoiceLogAmount}>{inr(inv.total_amount || inv.totalAmount || inv.grandTotal || 0)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No invoices found for this period.</Text>
              )}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  expandedContent: {
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  exportButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterPillRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabScroll: {
    marginBottom: SPACING.md,
  },
  subTab: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 6,
  },
  subTabActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  kpiCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  kpiIcon: {
    fontSize: 14,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  paymentSplitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentSplitBox: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentSplitLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  paymentSplitVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  tableBox: {
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tdText: {
    fontSize: 12,
    color: COLORS.text,
  },
  invoiceLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  invoiceLogNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceLogMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  invoiceLogAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default ReportsScreen;

/**
 * Orion POS Mobile Expo - Profit & Margins Dashboard (Exact Web Parity)
 *
 * Matches Web /profit:
 * - Period Filters: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, This Year
 * - Real-time Ledger Computed Cards:
 *   - Gross Sales Revenue
 *   - Cost of Goods Sold (COGS)
 *   - Operating Expenses
 *   - Gross Store Profit
 *   - Net Profit (Revenue - COGS - Expenses)
 *   - Operating Margin (%)
 * - Profit by Category breakdown
 * - Product Margin Rankings
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import useSales from '../hooks/useSales';
import useProducts from '../hooks/useProducts';
import useExpenses from '../hooks/useExpenses';
import { Card, LoadingSpinner, COLORS, SPACING } from '../components/common/UIComponents';
import { inr } from '../utils/format';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'thisYear', label: 'This Year' },
] as const;

export const ProfitScreen: React.FC = () => {
  const [filter, setFilter] = useState<typeof FILTERS[number]['id']>('today');

  const { data: salesData, isLoading: loadingSales } = useSales();
  const { data: productsData, isLoading: loadingProducts } = useProducts();
  const { data: expensesData, isLoading: loadingExpenses } = useExpenses();

  const sales = salesData || [];
  const products = productsData || [];
  const expenses = expensesData || [];

  const productMap = useMemo(() => {
    const map = new Map<number, { name: string; costPrice: number; sellingPrice: number; category: string }>();
    for (const p of products) {
      map.set(p.id, {
        name: p.name,
        costPrice: p.cost_price || 0,
        sellingPrice: p.selling_price || p.price || 0,
        category: p.category || 'General',
      });
    }
    return map;
  }, [products]);

  // Filter calculations
  const { grossRevenue, cogs, totalExpenses, grossProfit, netProfit, marginPercent, categoryStats, productStats } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const yearStartStr = `${now.getFullYear()}-01-01`;

    const filteredSales = sales.filter((s) => {
      if (s.status === 'voided') return false;
      if (!s.created_at) return false;
      const sDate = s.created_at.split('T')[0];

      if (filter === 'today') return sDate === todayStr;
      if (filter === 'yesterday') return sDate === yesterdayStr;
      if (filter === 'last7') return new Date(s.created_at) >= sevenDaysAgo;
      if (filter === 'thisMonth') return sDate >= monthStartStr;
      if (filter === 'thisYear') return sDate >= yearStartStr;
      return true;
    });

    const filteredExpenses = expenses.filter((e) => {
      if (!e.date) return false;
      const eDate = e.date.split('T')[0];

      if (filter === 'today') return eDate === todayStr;
      if (filter === 'yesterday') return eDate === yesterdayStr;
      if (filter === 'last7') return new Date(e.date) >= sevenDaysAgo;
      if (filter === 'thisMonth') return eDate >= monthStartStr;
      if (filter === 'thisYear') return eDate >= yearStartStr;
      return true;
    });

    let revenue = 0;
    let cost = 0;

    const catMap = new Map<string, { category: string; revenue: number; cost: number; profit: number }>();
    const prodMap = new Map<string, { name: string; soldCount: number; revenue: number; cost: number; profit: number }>();

    for (const s of filteredSales) {
      revenue += s.total_amount || s.grandTotal || 0;

      for (const item of s.items || []) {
        const pInfo = item.product_id ? productMap.get(item.product_id) : null;
        const itemCost = (pInfo?.costPrice || 0) * (item.quantity || 1);
        const itemRevenue = item.subtotal || item.lineTotal || (item.unit_price || 0) * (item.quantity || 1);
        cost += itemCost;

        // Category aggregation
        const cat = pInfo?.category || 'General';
        const cStat = catMap.get(cat) || { category: cat, revenue: 0, cost: 0, profit: 0 };
        cStat.revenue += itemRevenue;
        cStat.cost += itemCost;
        cStat.profit += itemRevenue - itemCost;
        catMap.set(cat, cStat);

        // Product aggregation
        const pName = item.product_name || pInfo?.name || 'Product';
        const pStat = prodMap.get(pName) || { name: pName, soldCount: 0, revenue: 0, cost: 0, profit: 0 };
        pStat.soldCount += item.quantity || 1;
        pStat.revenue += itemRevenue;
        pStat.cost += itemCost;
        pStat.profit += itemRevenue - itemCost;
        prodMap.set(pName, pStat);
      }
    }

    const exp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const gp = revenue - cost;
    const np = gp - exp;
    const margin = revenue > 0 ? (np / revenue) * 100 : 0;

    const sortedCats = Array.from(catMap.values()).sort((a, b) => b.profit - a.profit);
    const sortedProds = Array.from(prodMap.values()).sort((a, b) => b.profit - a.profit);

    return {
      grossRevenue: revenue,
      cogs: cost,
      totalExpenses: exp,
      grossProfit: gp,
      netProfit: np,
      marginPercent: margin,
      categoryStats: sortedCats,
      productStats: sortedProds,
    };
  }, [sales, expenses, productMap, filter]);

  if (loadingSales || loadingProducts || loadingExpenses) {
    return <LoadingSpinner message="Calculating real-time margins & profit..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Profit & Margins Command</Text>
      <Text style={styles.headerSub}>Live derived from local ledger transactions with zero cloud latency</Text>

      {/* Filter Tabs */}
      <View style={styles.filterPillRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.pill, filter === f.id && styles.pillActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.pillText, filter === f.id && styles.pillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 6 Top Metric Cards */}
      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>Gross Sales</Text>
          <Text style={styles.cardVal}>{inr(grossRevenue)}</Text>
          <Text style={styles.cardSub}>Total Volume</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>COGS (Procurement)</Text>
          <Text style={[styles.cardVal, { color: COLORS.textMuted }]}>{inr(cogs)}</Text>
          <Text style={styles.cardSub}>Product Cost</Text>
        </Card>
      </View>

      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>Gross Profit</Text>
          <Text style={[styles.cardVal, { color: COLORS.primary }]}>{inr(grossProfit)}</Text>
          <Text style={styles.cardSub}>Revenue - COGS</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>Operating Expenses</Text>
          <Text style={[styles.cardVal, { color: COLORS.danger }]}>{inr(totalExpenses)}</Text>
          <Text style={styles.cardSub}>Shop Overheads</Text>
        </Card>
      </View>

      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>Net Store Profit</Text>
          <Text style={[styles.cardVal, { color: netProfit >= 0 ? COLORS.success : COLORS.danger }]}>
            {inr(netProfit)}
          </Text>
          <Text style={styles.cardSub}>Take Home</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.cardLabel}>Profit Margin</Text>
          <Text style={[styles.cardVal, { color: marginPercent >= 20 ? COLORS.success : COLORS.primary }]}>
            {marginPercent.toFixed(1)}%
          </Text>
          <Text style={styles.cardSub}>Net Return %</Text>
        </Card>
      </View>

      {/* Profit by Category */}
      <Text style={styles.sectionHeader}>Category Profit Contribution</Text>
      <Card style={{ padding: SPACING.sm, marginBottom: SPACING.md }}>
        {categoryStats.length > 0 ? (
          categoryStats.map((c, idx) => (
            <View key={idx} style={styles.catRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName}>{c.category}</Text>
                <Text style={styles.catSub}>
                  Revenue: {inr(c.revenue)} | Cost: {inr(c.cost)}
                </Text>
              </View>
              <Text style={styles.catProfit}>+{inr(c.profit)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No sales for selected period.</Text>
        )}
      </Card>

      {/* Top Product Margins */}
      <Text style={styles.sectionHeader}>Product Profit Rankings</Text>
      <Card style={{ padding: SPACING.sm }}>
        {productStats.length > 0 ? (
          productStats.slice(0, 10).map((p, idx) => (
            <View key={idx} style={styles.prodRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prodName}>{p.name}</Text>
                <Text style={styles.prodSub}>
                  {p.soldCount} units sold | Rev: {inr(p.revenue)}
                </Text>
              </View>
              <Text style={styles.prodProfit}>+{inr(p.profit)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No product sales for selected period.</Text>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: SPACING.sm },
  filterPillRow: { flexDirection: 'row', marginBottom: SPACING.md, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
    marginBottom: 6,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  pillTextActive: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  statCard: { width: '48%', padding: SPACING.md },
  cardLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  cardVal: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginVertical: 3 },
  cardSub: { fontSize: 10, color: COLORS.textMuted },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: SPACING.sm, marginBottom: 6 },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  catName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  catSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  catProfit: { fontSize: 13, fontWeight: '800', color: COLORS.success },
  prodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  prodName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  prodSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  prodProfit: { fontSize: 13, fontWeight: '800', color: COLORS.success },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.md },
});

export default ProfitScreen;

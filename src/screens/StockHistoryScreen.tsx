/**
 * Orion POS Mobile Expo - Stock History Screen (Exact Web Parity)
 *
 * Matches Web /stock-history and /inventory/history:
 * - Real-time chronological ledger of all inventory movements:
 *   - Customer Sales (Deductions)
 *   - Supplier Purchases (Additions)
 *   - Physical Count Adjustments (Corrections / Damage / Found)
 *   - Voided Sales (Restorations)
 * - Search by product name, SKU, or transaction reference
 * - Filter pills for movement types
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import getDatabaseAsync from '../database/db';
import { useAuth } from '../context/AuthContext';
import { Card, LoadingSpinner, Badge, COLORS, SPACING } from '../components/common/UIComponents';

interface StockMovement {
  id: string;
  productName: string;
  movementType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'VOID_RESTORE';
  quantityDelta: number;
  reference: string;
  notes?: string;
  date: string;
}

export const StockHistoryScreen: React.FC = () => {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SALE' | 'PURCHASE' | 'ADJUSTMENT'>('ALL');

  const loadStockHistory = async () => {
    try {
      const db = await getDatabaseAsync();
      const rows: StockMovement[] = [];

      // 1. Fetch from Sale Items
      const saleRows = await db.getAllAsync<any>(
        `SELECT si.id, si.product_name, si.quantity, s.invoice_number, s.created_at, s.status
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.store_id = ?
         ORDER BY s.id DESC LIMIT 100;`,
        storeId
      );

      for (const r of saleRows) {
        if (r.status === 'voided') {
          rows.push({
            id: `void-${r.id}`,
            productName: r.product_name || 'Product',
            movementType: 'VOID_RESTORE',
            quantityDelta: r.quantity,
            reference: `Void: ${r.invoice_number}`,
            notes: 'Restored upon invoice void',
            date: r.created_at || 'Recent',
          });
        } else {
          rows.push({
            id: `sale-${r.id}`,
            productName: r.product_name || 'Product',
            movementType: 'SALE',
            quantityDelta: -r.quantity,
            reference: `Sale: ${r.invoice_number}`,
            date: r.created_at || 'Recent',
          });
        }
      }

      // 2. Fetch from Purchase Items
      const purchaseRows = await db.getAllAsync<any>(
        `SELECT pi.id, pi.product_name, pi.quantity, p.invoice_number, p.supplier_name, p.created_at
         FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE p.store_id = ?
         ORDER BY p.id DESC LIMIT 100;`,
        storeId
      );

      for (const r of purchaseRows) {
        rows.push({
          id: `pur-${r.id}`,
          productName: r.product_name || 'Product',
          movementType: 'PURCHASE',
          quantityDelta: r.quantity,
          reference: `PO: ${r.invoice_number || 'Direct'} (${r.supplier_name})`,
          date: r.created_at || 'Recent',
        });
      }

      // 3. Fetch from Stock Adjustments
      const adjRows = await db.getAllAsync<any>(
        `SELECT id, product_name, quantity, previous_stock, new_stock, reason, notes, created_at
         FROM stock_adjustments
         WHERE store_id = ?
         ORDER BY id DESC LIMIT 100;`,
        storeId
      );

      for (const r of adjRows) {
        const delta = r.new_stock - r.previous_stock;
        rows.push({
          id: `adj-${r.id}`,
          productName: r.product_name || 'Product',
          movementType: 'ADJUSTMENT',
          quantityDelta: delta,
          reference: `Audit: ${r.reason}`,
          notes: r.notes || undefined,
          date: r.created_at || 'Recent',
        });
      }

      // Sort chronological descending
      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(rows);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStockHistory();
  }, [storeId]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'ALL') {
        if (m.movementType !== typeFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.productName.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      );
    });
  }, [movements, typeFilter, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Stock Movement Ledger</Text>
        <Text style={styles.headerSub}>Complete trace of all sales, purchases, and audit corrections</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by product, invoice #, PO #, or reason..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={COLORS.textMuted}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { key: 'ALL', label: `All (${movements.length})` },
          { key: 'SALE', label: 'Sales' },
          { key: 'PURCHASE', label: 'Purchases' },
          { key: 'ADJUSTMENT', label: 'Adjustments' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, typeFilter === f.key && styles.filterPillActive]}
            onPress={() => setTypeFilter(f.key as any)}
          >
            <Text style={[styles.filterText, typeFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading && !isRefreshing ? (
        <LoadingSpinner message="Loading inventory ledger..." />
      ) : (
        <FlatList
          data={filteredMovements}
          keyExtractor={(item) => item.id}
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            loadStockHistory();
          }}
          renderItem={({ item }) => {
            const isPositive = item.quantityDelta > 0;
            return (
              <Card style={styles.movementCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.productName}>{item.productName}</Text>
                    <View style={{ marginLeft: 6 }}>
                      <Badge
                        label={item.movementType}
                        variant={
                          item.movementType === 'PURCHASE' || item.movementType === 'VOID_RESTORE'
                            ? 'success'
                            : item.movementType === 'SALE'
                            ? 'info'
                            : 'warning'
                        }
                      />
                    </View>
                  </View>
                  <Text style={styles.refText}>{item.reference}</Text>
                  {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
                  <Text style={styles.dateText}>{item.date.split('T')[0]}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.deltaText,
                      { color: isPositive ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    {isPositive ? `+${item.quantityDelta}` : `${item.quantityDelta}`}
                  </Text>
                  <Text style={styles.unitsLabel}>units</Text>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No stock movement records found.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  searchInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  filterScroll: { maxHeight: 36, marginBottom: SPACING.sm },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  filterTextActive: { color: '#FFFFFF' },
  movementCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
  },
  productName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  refText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  notesText: { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 1 },
  dateText: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  deltaText: { fontSize: 16, fontWeight: '800' },
  unitsLabel: { fontSize: 10, color: COLORS.textMuted },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xl },
});

export default StockHistoryScreen;

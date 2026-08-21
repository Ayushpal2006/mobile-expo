/**
 * Orion POS Mobile Expo - Adjust Stock Screen (Exact Web Parity)
 *
 * Matches Web /adjust-stock and /stock-adjustments:
 * - 8 Adjustment Types: PHYSICAL_COUNT, DAMAGED, LOST, FOUND, MANUAL_CORRECTION, SAMPLE, RETURN_FROM_CUSTOMER, OPENING_STOCK
 * - Product autocomplete selector with live before/after stock preview
 * - Adjustment history ledger with audit reasons, quantities, and cashier timestamps
 * - Atomic local SQLite stock adjustment + Outbox sync
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import useProducts from '../hooks/useProducts';
import useInventory from '../hooks/useInventory';
import { Product, StockAdjustment } from '../types';
import { Card, Button, LoadingSpinner, Badge, COLORS, SPACING } from '../components/common/UIComponents';

const ADJUSTMENT_TYPES = [
  { key: 'PHYSICAL_COUNT', label: 'Physical Count', color: '#3B82F6' },
  { key: 'DAMAGED', label: 'Damaged', color: '#EF4444' },
  { key: 'LOST', label: 'Lost', color: '#F59E0B' },
  { key: 'FOUND', label: 'Found', color: '#10B981' },
  { key: 'MANUAL_CORRECTION', label: 'Manual Correction', color: '#8B5CF6' },
  { key: 'SAMPLE', label: 'Sample', color: '#6366F1' },
  { key: 'RETURN_FROM_CUSTOMER', label: 'Return from Customer', color: '#06B6D4' },
  { key: 'OPENING_STOCK', label: 'Opening Stock', color: '#10B981' },
] as const;

export const AdjustStockScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  const { data: productsData } = useProducts();
  const { adjustments, isLoading, isRefreshing, refetch, adjustStock } = useInventory();

  // Create Adjustment Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<typeof ADJUSTMENT_TYPES[number]['key']>('PHYSICAL_COUNT');
  const [calcMode, setCalcMode] = useState<'DELTA' | 'EXACT'>('DELTA');
  const [deltaQty, setDeltaQty] = useState('1');
  const [exactQty, setExactQty] = useState('');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [reasonNotes, setReasonNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const products = productsData || [];
  const adjustmentList = adjustments || [];

  // Filtered products for picker
  const filteredProductsForPicker = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 15);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
    ).slice(0, 15);
  }, [products, productSearch]);

  // Filtered Adjustments History
  const filteredAdjustments = useMemo(() => {
    return adjustmentList.filter((adj) => {
      if (selectedTypeFilter !== 'ALL') {
        if ((adj.reason || '').toUpperCase() !== selectedTypeFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (adj.product_name || '').toLowerCase().includes(q) ||
        (adj.notes || '').toLowerCase().includes(q) ||
        (adj.reason || '').toLowerCase().includes(q)
      );
    });
  }, [adjustmentList, selectedTypeFilter, searchQuery]);

  // Derived stock calculation for live preview in dialog
  const computedNewStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const current = selectedProduct.stock || 0;
    if (calcMode === 'EXACT') {
      return parseInt(exactQty, 10) || 0;
    }
    const delta = parseInt(deltaQty, 10) || 0;
    return direction === 'INCREASE' ? current + delta : Math.max(0, current - delta);
  }, [selectedProduct, calcMode, deltaQty, exactQty, direction]);

  const handleOpenNewModal = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setAdjustmentType('PHYSICAL_COUNT');
    setCalcMode('DELTA');
    setDeltaQty('1');
    setExactQty('');
    setDirection('DECREASE');
    setReasonNotes('');
    setModalVisible(true);
  };

  const handleApplyAdjustment = async () => {
    if (!selectedProduct) {
      Alert.alert('Required', 'Please select a product from catalog.');
      return;
    }

    let finalType: 'INCREASE' | 'DECREASE' | 'SET' = 'SET';
    let finalQty = 0;

    if (calcMode === 'EXACT') {
      finalType = 'SET';
      finalQty = parseInt(exactQty, 10) || 0;
    } else {
      finalType = direction;
      finalQty = parseInt(deltaQty, 10) || 0;
      if (finalQty <= 0) {
        Alert.alert('Invalid Quantity', 'Please enter a quantity greater than 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await adjustStock(
        selectedProduct.id,
        finalType,
        finalQty,
        adjustmentType as any,
        reasonNotes.trim() || undefined
      );

      setModalVisible(false);
      Alert.alert('Success', `Stock adjusted for "${selectedProduct.name}". New stock: ${computedNewStock}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to apply stock adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.headerTitle}>Stock Adjustments & Audits</Text>
          <Text style={styles.headerSub}>{adjustmentList.length} physical count corrections recorded</Text>
        </View>
        <Button title="+ Adjust Stock" onPress={handleOpenNewModal} />
      </View>

      {/* Search & Type Filter Chips */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search adjustment logs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
        <TouchableOpacity
          style={[styles.typeChip, selectedTypeFilter === 'ALL' && styles.typeChipActive]}
          onPress={() => setSelectedTypeFilter('ALL')}
        >
          <Text style={[styles.typeChipText, selectedTypeFilter === 'ALL' && styles.typeChipTextActive]}>
            All ({adjustmentList.length})
          </Text>
        </TouchableOpacity>
        {ADJUSTMENT_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, selectedTypeFilter === t.key && styles.typeChipActive]}
            onPress={() => setSelectedTypeFilter(t.key)}
          >
            <Text style={[styles.typeChipText, selectedTypeFilter === t.key && styles.typeChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Adjustment Records List */}
      {isLoading && !isRefreshing ? (
        <LoadingSpinner message="Loading stock audit logs..." />
      ) : (
        <FlatList
          data={filteredAdjustments}
          keyExtractor={(item) => String(item.id)}
          refreshing={isRefreshing}
          onRefresh={() => refetch({ force: true })}
          renderItem={({ item }) => (
            <Card style={styles.recordCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.prodName}>{item.product_name}</Text>
                  <View style={{ marginLeft: 6 }}>
                    <Badge label={item.reason || 'CORRECTION'} variant="info" />
                  </View>
                </View>
                <Text style={styles.metaText}>
                  Previous: {item.previous_stock} → New: {item.new_stock} units
                </Text>
                <Text style={styles.dateText}>
                  Date: {item.created_at ? item.created_at.split('T')[0] : 'N/A'} {item.notes ? `| ${item.notes}` : ''}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.qtyDeltaText,
                    { color: item.new_stock >= item.previous_stock ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {item.new_stock >= item.previous_stock
                    ? `+${item.new_stock - item.previous_stock}`
                    : `-${item.previous_stock - item.new_stock}`}
                </Text>
                <Text style={styles.byText}>By: {item.adjusted_by || 'Cashier'}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No stock adjustment records match your filters.</Text>
          }
        />
      )}

      {/* New Adjustment Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Record Stock Adjustment</Text>

              {/* Product Picker */}
              <Text style={styles.label}>1. Select Product *</Text>
              <TextInput
                style={styles.input}
                placeholder="Search product by name or SKU..."
                value={productSearch}
                onChangeText={setProductSearch}
                placeholderTextColor={COLORS.textMuted}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {filteredProductsForPicker.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.productPill, selectedProduct?.id === p.id && styles.productPillActive]}
                    onPress={() => {
                      setSelectedProduct(p);
                      setExactQty(String(p.stock));
                    }}
                  >
                    <Text style={[styles.productPillText, selectedProduct?.id === p.id && styles.productPillTextActive]}>
                      {p.name} (Stock: {p.stock})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedProduct && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>Selected: {selectedProduct.name}</Text>
                  <Text style={styles.previewStock}>Current System Stock: {selectedProduct.stock} units</Text>
                </View>
              )}

              {/* Adjustment Reason */}
              <Text style={[styles.label, { marginTop: 10 }]}>2. Adjustment Type & Reason *</Text>
              <View style={styles.pillGrid}>
                {ADJUSTMENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeSelectPill, adjustmentType === t.key && styles.typeSelectPillActive]}
                    onPress={() => setAdjustmentType(t.key)}
                  >
                    <Text
                      style={[
                        styles.typeSelectText,
                        adjustmentType === t.key && styles.typeSelectTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Calculation Mode */}
              <Text style={[styles.label, { marginTop: 10 }]}>3. Quantity Mode</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, calcMode === 'DELTA' && styles.modeBtnActive]}
                  onPress={() => setCalcMode('DELTA')}
                >
                  <Text style={[styles.modeBtnText, calcMode === 'DELTA' && styles.modeBtnTextActive]}>
                    Add / Deduct Quantity
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, calcMode === 'EXACT' && styles.modeBtnActive]}
                  onPress={() => setCalcMode('EXACT')}
                >
                  <Text style={[styles.modeBtnText, calcMode === 'EXACT' && styles.modeBtnTextActive]}>
                    Set Exact Physical Count
                  </Text>
                </TouchableOpacity>
              </View>

              {calcMode === 'DELTA' ? (
                <View style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <TouchableOpacity
                      style={[styles.dirBtn, direction === 'DECREASE' && styles.dirBtnActiveDanger]}
                      onPress={() => setDirection('DECREASE')}
                    >
                      <Text style={[styles.dirBtnText, direction === 'DECREASE' && styles.dirBtnTextActive]}>
                        - Deduct / Damage
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dirBtn, direction === 'INCREASE' && styles.dirBtnActiveSuccess]}
                      onPress={() => setDirection('INCREASE')}
                    >
                      <Text style={[styles.dirBtnText, direction === 'INCREASE' && styles.dirBtnTextActive]}>
                        + Add / Restock
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter quantity delta (e.g. 5)"
                    value={deltaQty}
                    onChangeText={setDeltaQty}
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View style={{ marginTop: 6 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter actual physical count in shop"
                    value={exactQty}
                    onChangeText={setExactQty}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {selectedProduct && (
                <View style={styles.resultComparisonBox}>
                  <Text style={styles.resultComparisonText}>
                    Stock Adjustment Result: {selectedProduct.stock} →{' '}
                    <Text style={{ fontWeight: '800', color: COLORS.primary }}>{computedNewStock} units</Text>
                  </Text>
                </View>
              )}

              {/* Notes */}
              <Text style={[styles.label, { marginTop: 10 }]}>4. Audit Notes (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Box fell off shelf / Verified count with manager"
                value={reasonNotes}
                onChangeText={setReasonNotes}
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md }}>
                <Button
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="outline"
                  style={{ marginRight: SPACING.xs }}
                />
                <Button
                  title="Confirm Adjustment"
                  onPress={handleApplyAdjustment}
                  loading={submitting}
                  disabled={!selectedProduct}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  searchRow: { marginBottom: SPACING.xs },
  searchInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  typeScroll: { maxHeight: 36, marginBottom: SPACING.sm },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  typeChipTextActive: { color: '#FFFFFF' },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
  },
  prodName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  metaText: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  dateText: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  qtyDeltaText: { fontSize: 16, fontWeight: '800' },
  byText: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: SPACING.lg, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  input: {
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
  productPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  productPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  productPillText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  productPillTextActive: { color: '#FFFFFF' },
  previewBox: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, marginBottom: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  previewStock: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  typeSelectPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  typeSelectPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  typeSelectText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  typeSelectTextActive: { color: '#FFFFFF' },
  modeRow: { flexDirection: 'row', marginBottom: 6 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 2,
    backgroundColor: '#F8FAFC',
  },
  modeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  modeBtnTextActive: { color: '#FFFFFF' },
  dirBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 2,
    backgroundColor: '#F8FAFC',
  },
  dirBtnActiveDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  dirBtnActiveSuccess: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  dirBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  dirBtnTextActive: { color: '#FFFFFF' },
  resultComparisonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
  },
  resultComparisonText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
});

export default AdjustStockScreen;

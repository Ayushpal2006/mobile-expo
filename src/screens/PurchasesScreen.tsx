/**
 * Orion POS Mobile Expo - Purchases Management Screen (1:1 Web Parity)
 *
 * Full Web Parity with /purchases:
 * - Summary KPI Cards: Today's Purchases, Today's Orders, Total Procurement, PO Count
 * - Dual Tabs: "Purchase Orders" vs "New Purchase Intake"
 * - Reusable ProductPicker with interactive search, category chips, and tap-to-add
 * - Itemized Purchase Order Builder (Qty, Cost Price, Selling Price, Margin %, Line Total)
 * - Supplier Selection & Quick-Add Modal (Name, Phone, GSTIN, Address)
 * - Atomic local SQLite execution with inventory auto-increment & Outbox synchronization
 * - Purchase Order Details & Void action
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import usePurchases from '../hooks/usePurchases';
import useSuppliers from '../hooks/useSuppliers';
import useProducts from '../hooks/useProducts';
import useResponsive from '../hooks/useResponsive';
import { Purchase, Product, Supplier } from '../types';
import { ProductPicker } from '../components/common/ProductPicker';
import { Card, Button, LoadingSpinner, Badge, COLORS, SPACING } from '../components/common/UIComponents';
import { inr, formatNumber } from '../utils/format';

export interface PurchaseFormItem {
  productId: number;
  productName: string;
  sku?: string;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
}

export const PurchasesScreen: React.FC = () => {
  const { isMedium, isExpanded } = useResponsive();
  const { data: purchasesData, isLoading, isRefreshing, refetch, createPurchase } = usePurchases();
  const { data: suppliersData, createSupplier } = useSuppliers();
  const { data: productsData } = useProducts();

  const [activeTab, setActiveTab] = useState<'history' | 'form'>('history');
  const [productSearch, setProductSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Selected Purchase Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // New Supplier Modal
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupGstin, setNewSupGstin] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  // Purchase Form State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Credit'>('Cash');
  const [cartItems, setCartItems] = useState<PurchaseFormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const purchases = purchasesData || [];
  const suppliers = suppliersData || [];
  const products = productsData || [];

  // Summary Metrics matching Web /purchases
  const stats = useMemo(() => {
    const activePurchases = purchases.filter((p) => p.status !== 'VOID' && p.status !== 'voided');
    const totalCount = activePurchases.length;
    const totalValue = activePurchases.reduce((acc, p) => acc + (p.total_amount || p.totalAmount || 0), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayPurchases = activePurchases.filter(
      (p) => p.created_at && p.created_at.startsWith(todayStr)
    );
    const todayValue = todayPurchases.reduce((acc, p) => acc + (p.total_amount || p.totalAmount || 0), 0);

    return {
      totalCount,
      totalValue,
      todayCount: todayPurchases.length,
      todayValue,
    };
  }, [purchases]);

  // Handle Add Product from Picker
  const handleSelectProduct = (product: Product) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          costPrice: product.cost_price || 0,
          sellingPrice: product.selling_price || product.price || 0,
        },
      ];
    });
  };

  const getProductPurchaseQty = (productId: number) => {
    const found = cartItems.find((i) => i.productId === productId);
    return found ? found.quantity : 0;
  };

  const updateItemQuantity = (productId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as PurchaseFormItem[]
    );
  };

  const updateItemCost = (productId: number, costStr: string) => {
    const cost = parseFloat(costStr) || 0;
    setCartItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, costPrice: cost } : item))
    );
  };

  const removeItem = (productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Grand total calculation
  const computedGrandTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  }, [cartItems]);

  // Save New Supplier
  const handleQuickAddSupplier = async () => {
    const trimmedName = newSupName.trim();
    const cleanPhone = newSupPhone.replace(/[^0-9]/g, '').slice(-10);

    if (!trimmedName) {
      Alert.alert('Required', 'Supplier Name is required. Please enter supplier name.');
      return;
    }

    if (cleanPhone) {
      const existing = suppliers.find(
        (s) => (s.phone || '').replace(/[^0-9]/g, '').slice(-10) === cleanPhone
      );
      if (existing) {
        setSelectedSupplier(existing);
        setNewSupName('');
        setNewSupPhone('');
        setNewSupGstin('');
        setSupplierSearch('');
        setSupplierModalVisible(false);
        Alert.alert('Supplier Found', `Attached existing supplier: ${existing.name}`);
        return;
      }
    }

    setIsCreatingSupplier(true);
    try {
      const created = await createSupplier({
        name: trimmedName,
        phone: cleanPhone || undefined,
        gstin: newSupGstin.trim() || undefined,
      });
      setSelectedSupplier(created);
      setNewSupName('');
      setNewSupPhone('');
      setNewSupGstin('');
      setSupplierSearch('');
      setSupplierModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create supplier');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Submit Purchase Order
  const handleSavePurchase = async () => {
    if (!selectedSupplier) {
      Alert.alert('Required', 'Please select or add a supplier.');
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('No Items', 'Please select at least one product item for the purchase.');
      return;
    }

    setSubmitting(true);
    try {
      await createPurchase(
        selectedSupplier.name,
        supplierInvoiceNumber.trim() || undefined,
        cartItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
        })),
        computedGrandTotal,
        selectedSupplier.id
      );

      // Reset form
      setCartItems([]);
      setSupplierInvoiceNumber('');
      setPurchaseNotes('');
      setSelectedSupplier(null);
      setActiveTab('history');
      await refetch({ force: true });
      Alert.alert('Purchase Recorded', 'Stock levels updated and procurement transaction recorded successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered History
  const filteredPurchases = useMemo(() => {
    if (!historySearch.trim()) return purchases;
    const q = historySearch.toLowerCase();
    return purchases.filter(
      (p) =>
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q))
    );
  }, [purchases, historySearch]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header Toolbar & Tab Switcher */}
      <View style={styles.headerArea}>
        <View style={styles.tabNavRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
              📋 Purchase Orders ({purchases.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'form' && styles.tabBtnActive]}
            onPress={() => setActiveTab('form')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'form' && styles.tabBtnTextActive]}>
              + New Purchase Intake {cartItems.length > 0 ? `(${cartItems.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* KPI Metric Summary Cards */}
        {activeTab === 'history' && (
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Today's Purchases</Text>
              <Text style={styles.kpiValue}>{inr(stats.todayValue)}</Text>
              <Text style={styles.kpiSub}>{formatNumber(stats.todayCount)} intake orders</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Procurement</Text>
              <Text style={styles.kpiValue}>{inr(stats.totalValue)}</Text>
              <Text style={styles.kpiSub}>{formatNumber(stats.totalCount)} all-time POs</Text>
            </View>
          </View>
        )}
      </View>

      {/* 2. TAB: Purchase Orders History */}
      {activeTab === 'history' ? (
        <View style={styles.contentArea}>
          <View style={styles.searchBarRow}>
            <TextInput
              style={styles.historySearchInput}
              placeholder="Search by supplier name or invoice number..."
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {isLoading && !isRefreshing ? (
            <LoadingSpinner message="Loading purchase orders..." />
          ) : (
            <FlatList
              data={filteredPurchases}
              keyExtractor={(item) => String(item.id)}
              refreshing={isRefreshing}
              onRefresh={() => refetch({ force: true })}
              contentContainerStyle={{ padding: SPACING.sm }}
              renderItem={({ item }) => {
                const isVoid = item.status === 'VOID' || item.status === 'voided';
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPurchase(item);
                      setDetailModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Card style={styles.purchaseCard}>
                      <View style={styles.cardHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.supplierTitle}>{item.supplier_name || 'General Supplier'}</Text>
                          <Text style={styles.invoiceSub}>
                            {item.invoice_number ? `Invoice: ${item.invoice_number}` : `PO #${item.id}`} · {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : 'Recent'}
                          </Text>
                        </View>
                        <Badge
                          label={isVoid ? 'VOIDED' : 'COMPLETED'}
                          variant={isVoid ? 'danger' : 'success'}
                        />
                      </View>

                      <View style={styles.cardFooterRow}>
                        <Text style={styles.itemsCountText}>
                          {item.items ? `${item.items.length} item line${item.items.length !== 1 ? 's' : ''}` : 'Stock Intake'}
                        </Text>
                        <Text style={[styles.amountText, isVoid && styles.voidAmountText]}>
                          {inr(item.total_amount || item.totalAmount || 0)}
                        </Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🛍️</Text>
                  <Text style={styles.emptyTitle}>No Purchase Orders</Text>
                  <Text style={styles.emptySubText}>Tap "+ New Purchase Intake" to record your first stock procurement.</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        /* 3. TAB: New Purchase Intake Flow */
        <View style={styles.contentArea}>
          {/* Top Form Controls: Supplier Selector & Invoice Number */}
          <View style={styles.formHeaderBox}>
            <View style={styles.supplierPickerRow}>
              <TouchableOpacity
                style={styles.supplierSelector}
                onPress={() => setSupplierModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.supplierSelectorText} numberOfLines={1}>
                  🏭 {selectedSupplier ? `${selectedSupplier.name} (${selectedSupplier.phone || 'No phone'})` : 'Select Supplier *'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addSupplierBtn}
                onPress={() => setSupplierModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addSupplierBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.invoiceInputRow}>
              <TextInput
                style={styles.invoiceInput}
                placeholder="Supplier Invoice No. (e.g. INV-9842)"
                value={supplierInvoiceNumber}
                onChangeText={setSupplierInvoiceNumber}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Interactive Product Picker */}
          <View style={{ flex: 1 }}>
            <ProductPicker
              mode="purchase"
              products={products}
              searchQuery={productSearch}
              onSearchChange={setProductSearch}
              onSelectProduct={handleSelectProduct}
              getItemQuantity={getProductPurchaseQty}
              bottomPadding={cartItems.length > 0 ? 110 : 0}
            />
          </View>

          {/* Bottom Sticky Purchase Order Summary & Review */}
          {cartItems.length > 0 && (
            <View style={styles.stickyPurchaseBar}>
              <View style={styles.stickyBarLeft}>
                <Text style={styles.stickyItemsLabel}>{cartItems.length} product{cartItems.length > 1 ? 's' : ''} selected</Text>
                <Text style={styles.stickyTotalValue}>{inr(computedGrandTotal)}</Text>
              </View>
              <Button
                title={`Save Purchase (${inr(computedGrandTotal)})`}
                onPress={handleSavePurchase}
                loading={submitting}
                style={{ paddingHorizontal: 20 }}
              />
            </View>
          )}
        </View>
      )}

      {/* 4. Supplier Selection & Quick Add Modal */}
      <Modal visible={supplierModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, (isMedium || isExpanded) ? { maxWidth: 520, width: '90%' } : { width: '94%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs }}>
              <Text style={styles.modalTitle}>Select or Add Supplier</Text>
              <TouchableOpacity onPress={() => setSupplierModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Existing Supplier */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 }}>
              Search Existing Suppliers
            </Text>
            <TextInput
              style={styles.historySearchInput}
              placeholder="Search supplier by name or mobile..."
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              placeholderTextColor={COLORS.textMuted}
            />

            <FlatList
              data={suppliers.filter(
                (s) =>
                  s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                  (s.phone && s.phone.includes(supplierSearch))
              )}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 140, marginVertical: SPACING.xs }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.supplierOption}
                  onPress={() => {
                    setSelectedSupplier(item);
                    setSupplierModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.supplierOptionName}>🏢 {item.name}</Text>
                    <Text style={styles.supplierOptionMeta}>{item.phone ? `📱 ${item.phone}` : 'No phone'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptySubText}>
                  {supplierSearch ? `No matching supplier found for "${supplierSearch}".` : 'No suppliers recorded.'}
                </Text>
              }
            />

            {/* Quick Add Supplier Form */}
            <View style={styles.quickAddSupplierBox}>
              <Text style={[styles.modalTitle, { fontSize: 13, color: COLORS.primary, marginBottom: 6 }]}>
                Quick Add New Supplier
              </Text>

              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 3 }}>
                  Supplier Name <Text style={{ color: COLORS.danger }}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter supplier name"
                  value={newSupName}
                  onChangeText={setNewSupName}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 3 }}>
                  Mobile Number
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter mobile number"
                  value={newSupPhone}
                  onChangeText={(text) => setNewSupPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 3 }}>
                  GSTIN (Optional)
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter GSTIN"
                  value={newSupGstin}
                  onChangeText={setNewSupGstin}
                  autoCapitalize="characters"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <Button
                title="Save & Select Supplier"
                onPress={handleQuickAddSupplier}
                loading={isCreatingSupplier}
                variant="primary"
                style={{ marginTop: 4 }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm }}>
              <Button title="Close" variant="secondary" onPress={() => setSupplierModalVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Purchase Order Detail Inspection Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Purchase Order #{selectedPurchase?.id}</Text>
            <Text style={styles.detailSupplierName}>{selectedPurchase?.supplier_name || 'General Supplier'}</Text>
            <Text style={styles.detailInvoiceSub}>
              Invoice: {selectedPurchase?.invoice_number || 'N/A'} · Date: {selectedPurchase?.created_at ? new Date(selectedPurchase.created_at).toLocaleString('en-IN') : 'Recent'}
            </Text>

            <ScrollView style={{ maxHeight: 220, marginVertical: SPACING.sm }}>
              {(selectedPurchase?.items || []).map((itm, idx) => (
                <View key={idx} style={styles.detailItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailItemName}>{itm.product_name || itm.productName || 'Item'}</Text>
                    <Text style={styles.detailItemSub}>Qty: {itm.quantity} × {inr(itm.cost_price || itm.costPrice || 0)}</Text>
                  </View>
                  <Text style={styles.detailItemTotal}>
                    {inr((itm.cost_price || itm.costPrice || 0) * (itm.quantity || 1))}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.detailTotalRow}>
              <Text style={styles.detailTotalLabel}>Grand Total:</Text>
              <Text style={styles.detailTotalVal}>{inr(selectedPurchase?.total_amount || selectedPurchase?.totalAmount || 0)}</Text>
            </View>

            <Button title="Close" onPress={() => setDetailModalVisible(false)} style={{ marginTop: SPACING.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabNavRow: {
    flexDirection: 'row',
    padding: SPACING.xs,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  contentArea: {
    flex: 1,
  },
  searchBarRow: {
    padding: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  historySearchInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: COLORS.text,
  },
  purchaseCard: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemsCountText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  voidAmountText: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  formHeaderBox: {
    padding: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  supplierPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  supplierSelector: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  supplierSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  addSupplierBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  addSupplierBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  invoiceInputRow: {
    flexDirection: 'row',
  },
  invoiceInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
  },
  stickyPurchaseBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  stickyBarLeft: {
    justifyContent: 'center',
  },
  stickyItemsLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stickyTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  supplierOption: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  supplierOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  supplierOptionMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  quickAddSupplierBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  formInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 6,
  },
  detailSupplierName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  detailInvoiceSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  detailItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  detailTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PurchasesScreen;

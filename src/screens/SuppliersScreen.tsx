/**
 * Orion POS Mobile Expo - Suppliers Directory Screen (Exact Web Parity)
 *
 * Matches Web /suppliers:
 * - Supplier directory with search by name, contact person, phone, or GSTIN
 * - Add and Edit Supplier modal with phone, email, GSTIN, and address
 * - Supplier Details & Purchase Order History modal
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
import useSuppliers from '../hooks/useSuppliers';
import usePurchases from '../hooks/usePurchases';
import { Supplier } from '../types';
import { Card, Button, LoadingSpinner, COLORS, SPACING } from '../components/common/UIComponents';
import { inr } from '../utils/format';

export const SuppliersScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: suppliersData, isLoading, isRefreshing, refetch, createSupplier } = useSuppliers(searchQuery);
  const { data: purchasesData } = usePurchases();

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const suppliers = suppliersData || [];
  const purchases = purchasesData || [];

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setModalVisible(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setContactPerson(s.contact_person || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setGstin(s.gstin || '');
    setModalVisible(true);
  };

  const openDetailModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setDetailModalVisible(true);
  };

  const handleSaveSupplier = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Supplier or vendor name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupplier({
        id: editingSupplier?.id,
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        gstin: gstin.trim() || undefined,
      });

      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered purchases for selected supplier
  const supplierPurchaseOrders = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchases.filter(
      (p) =>
        p.supplier_id === selectedSupplier.id ||
        (p.supplier_name || '').toLowerCase() === selectedSupplier.name.toLowerCase()
    );
  }, [selectedSupplier, purchases]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers by name, phone, or GSTIN..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textMuted}
        />
        <Button title="+ Supplier" onPress={openAddModal} style={{ marginLeft: SPACING.xs }} />
      </View>

      {isLoading && !isRefreshing ? (
        <LoadingSpinner message="Loading suppliers directory..." />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => String(item.id)}
          refreshing={isRefreshing}
          onRefresh={() => refetch({ force: true })}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openDetailModal(item)}>
              <Card style={styles.supplierCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supplierName}>{item.name}</Text>
                  {item.contact_person ? (
                    <Text style={styles.contactText}>Contact: {item.contact_person}</Text>
                  ) : null}
                  <Text style={styles.subText}>
                    Ph: {item.phone || 'N/A'} {item.gstin ? `| GSTIN: ${item.gstin}` : ''}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.spendText}>
                    Spend: {inr(item.total_purchases || 0)}
                  </Text>
                  <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No suppliers found in directory.</Text>
          }
        />
      )}

      {/* Add / Edit Supplier Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Supplier / Company Name *"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact Person Name"
                value={contactPerson}
                onChangeText={setContactPerson}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="GSTIN Identifier"
                value={gstin}
                onChangeText={setGstin}
              />
              <TextInput
                style={styles.input}
                placeholder="Office / Warehouse Address"
                value={address}
                onChangeText={setAddress}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md }}>
                <Button
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="outline"
                  style={{ marginRight: SPACING.xs }}
                />
                <Button
                  title={editingSupplier ? 'Save Changes' : 'Create Supplier'}
                  onPress={handleSaveSupplier}
                  loading={submitting}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Supplier Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSupplier && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedSupplier.name}</Text>
                <Text style={styles.detailLine}>Contact: {selectedSupplier.contact_person || 'N/A'}</Text>
                <Text style={styles.detailLine}>Phone: {selectedSupplier.phone || 'N/A'}</Text>
                <Text style={styles.detailLine}>Email: {selectedSupplier.email || 'N/A'}</Text>
                <Text style={styles.detailLine}>GSTIN: {selectedSupplier.gstin || 'N/A'}</Text>
                <Text style={styles.detailLine}>Address: {selectedSupplier.address || 'N/A'}</Text>
                <Text style={[styles.detailLine, { fontWeight: '700', color: COLORS.primary }]}>
                  Total Procurement Spend: {inr(selectedSupplier.total_purchases || 0)}
                </Text>

                <Text style={[styles.modalTitle, { fontSize: 14, marginTop: 14, marginBottom: 6 }]}>
                  Purchase Orders ({supplierPurchaseOrders.length})
                </Text>

                {supplierPurchaseOrders.length > 0 ? (
                  supplierPurchaseOrders.map((po, idx) => (
                    <View key={idx} style={styles.poRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.poInv}>{po.invoice_number || `PO-${po.id}`}</Text>
                        <Text style={styles.poDate}>{po.created_at ? po.created_at.split('T')[0] : 'N/A'}</Text>
                      </View>
                      <Text style={styles.poTotal}>{inr(po.total_amount || 0)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No purchase orders on record for this vendor.</Text>
                )}

                <Button title="Close" onPress={() => setDetailModalVisible(false)} style={{ marginTop: SPACING.md }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  supplierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
  },
  supplierName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  contactText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  subText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  spendText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  editBtn: { marginTop: 4, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: '#E2E8F0', borderRadius: 4 },
  editBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.text },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: SPACING.lg, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.xs },
  detailLine: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
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
  poRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  poInv: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  poDate: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  poTotal: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
});

export default SuppliersScreen;

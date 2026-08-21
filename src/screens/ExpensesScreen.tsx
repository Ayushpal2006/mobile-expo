/**
 * Orion POS Mobile Expo - Expenses Management Screen
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import useExpenses from '../hooks/useExpenses';
import { Card, Button, LoadingSpinner, Badge, COLORS, SPACING } from '../components/common/UIComponents';
import { inr } from '../utils/format';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salary',
  'Maintenance',
  'Logistics',
  'Tea & Snacks',
  'Marketing',
  'Miscellaneous',
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card'];

export const ExpensesScreen: React.FC = () => {
  const { data: expensesData, isLoading, isRefreshing, refetch, createExpense, deleteExpense } = useExpenses();

  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState('Miscellaneous');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const expenses = expensesData || [];
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleAddExpense = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Required Field', 'Please enter a valid expense amount.');
      return;
    }

    setSubmitting(true);
    try {
      await createExpense({
        category,
        amount: parsedAmount,
        payment_mode: paymentMode,
        date: new Date().toISOString().split('T')[0],
        notes: notes.trim() || undefined,
      });

      setModalVisible(false);
      setAmount('');
      setNotes('');
      setCategory('Miscellaneous');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (id: number, cat: string, amt: number) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this ${inr(amt)} (${cat}) expense?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.headerSub}>Total Store Expenses</Text>
          <Text style={styles.headerTotal}>{inr(totalExpenseAmount)}</Text>
        </View>
        <Button title="+ Add Expense" onPress={() => setModalVisible(true)} />
      </View>

      {isLoading && !isRefreshing ? (
        <LoadingSpinner message="Loading expenses..." />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => String(item.id)}
          refreshing={isRefreshing}
          onRefresh={() => refetch({ force: true })}
          renderItem={({ item }) => (
            <Card style={styles.expenseCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.categoryTitle}>{item.category}</Text>
                  <View style={{ marginLeft: 6 }}>
                    <Badge label={item.payment_mode || 'Cash'} variant="info" />
                  </View>
                </View>
                <Text style={styles.dateText}>
                  Date: {item.date} {item.notes ? `| ${item.notes}` : ''}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amountText}>{inr(item.amount || 0)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteExpense(item.id, item.category, item.amount)}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No expenses recorded yet.</Text>}
        />
      )}

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record New Expense</Text>

            <Text style={styles.label}>Category</Text>
            <View style={styles.pillGrid}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pill, category === cat && styles.pillActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.pillGrid}>
              {PAYMENT_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.pill, paymentMode === mode && styles.pillActive]}
                  onPress={() => setPaymentMode(mode)}
                >
                  <Text style={[styles.pillText, paymentMode === mode && styles.pillTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes / Description (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Paid electricity bill for shop"
              value={notes}
              onChangeText={setNotes}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md }}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} variant="outline" style={{ marginRight: SPACING.xs }} />
              <Button title="Save Expense" onPress={handleAddExpense} loading={submitting} />
            </View>
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
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerSub: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  headerTotal: { fontSize: 20, fontWeight: '800', color: COLORS.danger, marginTop: 2 },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
  },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  amountText: { fontSize: 15, fontWeight: '800', color: COLORS.danger },
  deleteBtn: { marginTop: 4, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#FEE2E2', borderRadius: 4 },
  deleteBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.danger },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: SPACING.lg, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  pillTextActive: { color: '#FFFFFF' },
});

export default ExpensesScreen;

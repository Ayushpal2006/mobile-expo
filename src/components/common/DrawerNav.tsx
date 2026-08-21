/**
 * Orion POS Mobile Expo - Web Parity Navigation Drawer Component
 *
 * Replicates the exact navigation tree from Web AppShell:
 * - Dashboard
 * - Billing
 * - Inventory: Products, Adjust Stock, Stock History
 * - Contacts: Customers, Suppliers
 * - Purchases
 * - Reports
 * - Finance: Profit, Expenses
 * - Settings
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { MainTabType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Badge, COLORS, SPACING } from './UIComponents';
import FeedbackModal from './FeedbackModal';

interface DrawerNavProps {
  visible: boolean;
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  onClose: () => void;
}

export const DrawerNav: React.FC<DrawerNavProps> = ({
  visible,
  activeTab,
  onSelectTab,
  onClose,
}) => {
  const { user, store, logout } = useAuth();
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  // Accordion state matching Web AppShell
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Inventory: true,
    Contacts: true,
    Finance: true,
  });

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const handleNav = (tab: MainTabType) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.drawerContainer}>
          {/* Header */}
          <View style={styles.drawerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.drawerLogoImage}
                resizeMode="contain"
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.brandTitle}>Apka Bill</Text>
                <Text style={styles.brandSub}>Retail POS Platform</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Active Store Badge */}
          <View style={styles.storeCard}>
            <Text style={styles.storeIcon}>🏬</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store?.name || 'Main Store'}
              </Text>
              <Text style={styles.storeRole}>Role: {user?.role || 'Cashier'}</Text>
            </View>
          </View>

          {/* Navigation Tree */}
          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
            {/* Dashboard */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
              onPress={() => handleNav('dashboard')}
            >
              <Text style={styles.navIcon}>📊</Text>
              <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>
                Dashboard
              </Text>
            </TouchableOpacity>

            {/* Billing */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'billing' && styles.navItemActive]}
              onPress={() => handleNav('billing')}
            >
              <Text style={styles.navIcon}>💳</Text>
              <Text style={[styles.navLabel, activeTab === 'billing' && styles.navLabelActive]}>
                Billing
              </Text>
            </TouchableOpacity>

            {/* Bills History */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'bills' && styles.navItemActive]}
              onPress={() => handleNav('bills')}
            >
              <Text style={styles.navIcon}>🧾</Text>
              <Text style={[styles.navLabel, activeTab === 'bills' && styles.navLabelActive]}>
                Bills & Invoices
              </Text>
            </TouchableOpacity>

            {/* Inventory Group */}
            <View style={styles.groupContainer}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup('Inventory')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.navIcon}>📦</Text>
                  <Text style={styles.groupTitle}>Inventory</Text>
                </View>
                <Text style={styles.chevron}>{openGroups.Inventory ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              {openGroups.Inventory && (
                <View style={styles.subItemsBox}>
                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'products' && styles.subItemActive]}
                    onPress={() => handleNav('products')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'products' && styles.subLabelActive]}>
                      • Products Catalog
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'adjust-stock' && styles.subItemActive]}
                    onPress={() => handleNav('adjust-stock')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'adjust-stock' && styles.subLabelActive]}>
                      • Adjust Stock
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'stock-history' && styles.subItemActive]}
                    onPress={() => handleNav('stock-history')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'stock-history' && styles.subLabelActive]}>
                      • Stock History
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Contacts Group */}
            <View style={styles.groupContainer}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup('Contacts')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.navIcon}>👥</Text>
                  <Text style={styles.groupTitle}>Contacts</Text>
                </View>
                <Text style={styles.chevron}>{openGroups.Contacts ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              {openGroups.Contacts && (
                <View style={styles.subItemsBox}>
                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'customers' && styles.subItemActive]}
                    onPress={() => handleNav('customers')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'customers' && styles.subLabelActive]}>
                      • Customers Directory
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'suppliers' && styles.subItemActive]}
                    onPress={() => handleNav('suppliers')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'suppliers' && styles.subLabelActive]}>
                      • Suppliers & Vendors
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Purchases */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'purchases' && styles.navItemActive]}
              onPress={() => handleNav('purchases')}
            >
              <Text style={styles.navIcon}>🛍️</Text>
              <Text style={[styles.navLabel, activeTab === 'purchases' && styles.navLabelActive]}>
                Purchases & Orders
              </Text>
            </TouchableOpacity>

            {/* Reports */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'reports' && styles.navItemActive]}
              onPress={() => handleNav('reports')}
            >
              <Text style={styles.navIcon}>📈</Text>
              <Text style={[styles.navLabel, activeTab === 'reports' && styles.navLabelActive]}>
                Reports & Analytics
              </Text>
            </TouchableOpacity>

            {/* Finance Group */}
            <View style={styles.groupContainer}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup('Finance')}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.navIcon}>💰</Text>
                  <Text style={styles.groupTitle}>Finance</Text>
                </View>
                <Text style={styles.chevron}>{openGroups.Finance ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              {openGroups.Finance && (
                <View style={styles.subItemsBox}>
                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'profit' && styles.subItemActive]}
                    onPress={() => handleNav('profit')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'profit' && styles.subLabelActive]}>
                      • Profit & Margins
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subItem, activeTab === 'expenses' && styles.subItemActive]}
                    onPress={() => handleNav('expenses')}
                  >
                    <Text style={[styles.subLabel, activeTab === 'expenses' && styles.subLabelActive]}>
                      • Store Expenses
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Settings */}
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
              onPress={() => handleNav('settings')}
            >
              <Text style={styles.navIcon}>⚙️</Text>
              <Text style={[styles.navLabel, activeTab === 'settings' && styles.navLabelActive]}>
                Settings
              </Text>
            </TouchableOpacity>

            {/* Pilot Feedback & Support */}
            <TouchableOpacity
              style={[styles.navItem, { marginTop: 8, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}
              onPress={() => setFeedbackVisible(true)}
            >
              <Text style={styles.navIcon}>💬</Text>
              <Text style={[styles.navLabel, { color: COLORS.primary, fontWeight: '700' }]}>
                Pilot Feedback & Support
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer with Sign out */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
              <Text style={styles.signOutText}>🚪 Sign Out ({user?.name || 'Cashier'})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        currentScreen={activeTab}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: { flex: 1 },
  drawerContainer: {
    width: 290,
    backgroundColor: '#FFFFFF',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  drawerHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerLogoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  brandTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  brandSub: { fontSize: 10, color: COLORS.textMuted },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 16, color: COLORS.textMuted, fontWeight: '700' },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  storeIcon: { fontSize: 18 },
  storeName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  storeRole: { fontSize: 10, color: COLORS.textMuted },
  navScroll: { flex: 1, padding: SPACING.sm },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  navItemActive: { backgroundColor: '#EFF6FF' },
  navIcon: { fontSize: 16, marginRight: 10 },
  navLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  navLabelActive: { color: COLORS.primary, fontWeight: '700' },
  groupContainer: { marginBottom: 4 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  groupTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chevron: { fontSize: 10, color: COLORS.textMuted },
  subItemsBox: { marginLeft: 24, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#E2E8F0', marginTop: 2 },
  subItem: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2 },
  subItemActive: { backgroundColor: '#EFF6FF' },
  subLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },
  subLabelActive: { color: COLORS.primary, fontWeight: '700' },
  drawerFooter: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  signOutBtn: { backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  signOutText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
});

export default DrawerNav;

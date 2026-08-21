/**
 * Orion POS / Apka Bill Mobile Expo - Responsive Tab Navigation Bar
 *
 * Exposes the 5 primary Web routes directly on the bottom bar:
 * - Home (Dashboard)
 * - Billing (POS)
 * - Products (Catalog)
 * - Purchases (Procurement)
 * - Customers (Contacts)
 *
 * Responsively centers navigation on tablets and POS displays to avoid extreme horizontal stretching.
 * Safe Area Aware: Guarantees bottom navigation is never obscured by Android system gesture bar.
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabType } from '../../types';
import { COLORS, SPACING, RADIUS } from './UIComponents';
import useResponsive from '../../hooks/useResponsive';

interface TabBarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
}

const PRIMARY_TABS: { id: MainTabType; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '📊' },
  { id: 'billing', label: 'Billing', icon: '💳' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'purchases', label: 'Purchases', icon: '🛍️' },
  { id: 'customers', label: 'Customers', icon: '👥' },
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onSelectTab }) => {
  const { isExpanded } = useResponsive();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 6);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={[styles.tabBarRow, isExpanded && styles.tabBarRowExpanded]}>
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive && styles.activeTabItem,
                isExpanded && styles.tabItemExpanded,
              ]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.icon, isExpanded && { fontSize: 20 }]}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.activeTabLabel,
                  isExpanded && { fontSize: 12 },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    alignItems: 'center',
  },
  tabBarRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  tabBarRowExpanded: {
    maxWidth: 700,
    paddingHorizontal: SPACING.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginHorizontal: 1,
  },
  tabItemExpanded: {
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: '#EFF6FF',
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});

export default TabBar;

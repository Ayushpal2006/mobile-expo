/**
 * Orion POS Mobile Expo - Primary Application Shell Entry
 *
 * Implements complete Web Parity Information Architecture with controlled Startup Phase Diagnostics:
 * - Phase 1: React Root Mount [STARTUP-P1]
 * - Phase 2: Root Providers Render [STARTUP-P2]
 * - Phase 3: Session Restore Begin [STARTUP-P3]
 * - Phase 4: Session Restore Complete [STARTUP-P4]
 * - Phase 5: Main Navigation Shell [STARTUP-P5]
 * - Phase 6: Feature Services Ready [STARTUP-P6]
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoadingSpinner, COLORS, SPACING, RADIUS, SHADOWS } from './src/components/common/UIComponents';
import Header from './src/components/common/Header';
import DrawerNav from './src/components/common/DrawerNav';
import TabBar from './src/components/common/TabBar';
import { MainTabType } from './src/types';
import getDatabaseAsync from './src/database/db';
import SyncEngine from './src/services/api/sync.service';
import RootErrorBoundary from './src/components/common/RootErrorBoundary';
import { recordStartupPhase, StartupDiagnosticHUD, isStartupDiagnosticsEnabled } from './src/utils/startupDiagnostics';

// Screen Imports (1:1 Web Parity)
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BillingScreen from './src/screens/BillingScreen';
import BillsScreen from './src/screens/BillsScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import AdjustStockScreen from './src/screens/AdjustStockScreen';
import StockHistoryScreen from './src/screens/StockHistoryScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import SuppliersScreen from './src/screens/SuppliersScreen';
import PurchasesScreen from './src/screens/PurchasesScreen';
import ProfitScreen from './src/screens/ProfitScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [isDbReady, setIsDbReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    console.log('[CHECKPOINT 2] MainAppContent mounted');
    recordStartupPhase('P2', 'SUCCESS', 'Root providers mounted');
  }, []);

  useEffect(() => {
    if (!isLoading && isDbReady) {
      if (!isAuthenticated) {
        console.log('[CHECKPOINT 7] Root navigator rendered: LoginScreen (Unauthenticated)');
        recordStartupPhase('P5', 'SUCCESS', 'Unauthenticated - Rendering LoginScreen');
      } else {
        console.log(`[CHECKPOINT 7] Root navigator rendered: TabShell [${activeTab}] (Authenticated)`);
        recordStartupPhase('P5', 'SUCCESS', `Authenticated - Rendering TabShell [${activeTab}]`);
      }
    }
  }, [isLoading, isDbReady, isAuthenticated, activeTab]);

  useEffect(() => {
    let isMounted = true;
    console.log('[CHECKPOINT 3] Database initialization started');

    (async () => {
      try {
        await getDatabaseAsync();
        await SyncEngine.initOnStartup();
        console.log('[CHECKPOINT 4] Database initialization completed successfully');
        recordStartupPhase('P6', 'SUCCESS', 'SQLite DB and SyncEngine online');
      } catch (err: any) {
        console.error('[CHECKPOINT 4] Database initialization warning/error:', err);
        recordStartupPhase('P6', 'ERROR', err?.message || 'Database initialization warning');
      } finally {
        if (isMounted) {
          setIsDbReady(true);
        }
      }
    })();

    // Database startup safety timeout (4 seconds max)
    const safetyTimer = setTimeout(() => {
      if (isMounted && !isDbReady) {
        console.warn('[App] Database safety timeout reached (4s); unlocking UI gate.');
        setIsDbReady(true);
        recordStartupPhase('P6', 'SUCCESS', 'Unlocked via safety timeout');
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Fatal startup error recovery screen
  if (startupError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Apka Bill Startup Recovery</Text>
          <Text style={styles.errorMessage}>{startupError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setStartupError(null);
              setIsDbReady(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>🔄 Retry Startup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading Gate: Unlocks automatically when auth & local db resolve
  if (isLoading || !isDbReady) {
    const loadingMessage = !isDbReady ? 'Initializing local POS database...' : 'Restoring POS session...';
    return (
      <View style={styles.loadingContainer}>
        {isStartupDiagnosticsEnabled() ? <StartupDiagnosticHUD /> : null}
        <LoadingSpinner message={loadingMessage} />
      </View>
    );
  }

  // Unauthenticated: Render Login Screen
  if (!isAuthenticated) {
    return (
      <View style={styles.screenContainer}>
        {isStartupDiagnosticsEnabled() ? <StartupDiagnosticHUD /> : null}
        <LoginScreen />
      </View>
    );
  }

  const renderActiveTabScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen onNavigateTab={setActiveTab} />;
      case 'billing':
        return <BillingScreen />;
      case 'bills':
        return <BillsScreen onNavigateTab={setActiveTab} />;
      case 'products':
        return <ProductsScreen />;
      case 'adjust-stock':
        return <AdjustStockScreen />;
      case 'stock-history':
        return <StockHistoryScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'suppliers':
        return <SuppliersScreen />;
      case 'purchases':
        return <PurchasesScreen />;
      case 'profit':
        return <ProfitScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <View style={styles.appShell}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {isStartupDiagnosticsEnabled() ? <StartupDiagnosticHUD /> : null}
      <Header onOpenDrawer={() => setDrawerVisible(true)} />
      <View style={styles.screenContainer}>{renderActiveTabScreen()}</View>
      <TabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      
      {/* Web Parity Navigation Drawer */}
      <DrawerNav
        visible={drawerVisible}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
};

export default function App() {
  useEffect(() => {
    console.log('[CHECKPOINT 1] App mounted');
    recordStartupPhase('P1', 'SUCCESS', 'React root component mount');
  }, []);

  return (
    <RootErrorBoundary>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    ...SHADOWS.md,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: SPACING.xs,
  },
  errorMessage: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

/**
 * Apka Bill Mobile POS - Central Light-Theme UI Component & Design System Foundation
 *
 * Implements 100% Web Brand Parity in a crisp, high-contrast, modern Light Theme:
 * - Design Tokens: COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY
 * - Reusable Components: AppScreen, AppHeader, Card, PrimaryButton, SecondaryButton,
 *   IconButton, Button, TextField, Input, SearchField, SectionHeader, EmptyState,
 *   LoadingState, LoadingSpinner, ErrorState, ErrorAlert, StatusBadge, Badge, AmountText.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inr } from '../../utils/format';

// =============================================================================
// DESIGN SYSTEM TOKENS (LIGHT THEME)
// =============================================================================

export const COLORS = {
  // Brand Primary (Apka Bill Signature Royal Blue)
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryBg: '#EFF6FF',

  // Neutrals / Light Theme Canvas & Surfaces
  background: '#F8FAFC',      // Main canvas background (Slate 50)
  surface: '#FFFFFF',         // Card / Sheet surface
  surfaceElevated: '#FFFFFF',
  cardBg: '#FFFFFF',
  inputBg: '#FFFFFF',
  inputBgDisabled: '#F1F5F9', // Slate 100

  // Borders & Dividers
  border: '#E2E8F0',          // Subtle card & row border (Slate 200)
  borderSubtle: '#F1F5F9',    // Table divider (Slate 100)
  borderDark: '#CBD5E1',      // Input outline (Slate 300)
  borderFocus: '#2563EB',

  // Text Hierarchy (High-Contrast Slate)
  text: '#0F172A',            // Primary text & headings (Slate 900)
  textSecondary: '#334155',   // Secondary body text (Slate 700)
  textMuted: '#64748B',       // Hints, captions, timestamps (Slate 500)
  textDisabled: '#94A3B8',    // Disabled text (Slate 400)
  textInverse: '#FFFFFF',

  // Semantic Status Colors
  success: '#16A34A',         // Green 600
  successBg: '#DCFCE7',       // Green 100
  successText: '#15803D',     // Green 700

  warning: '#D97706',         // Amber 600
  warningBg: '#FEF3C7',       // Amber 100
  warningText: '#B45309',     // Amber 700

  danger: '#DC2626',          // Red 600
  dangerBg: '#FEE2E2',        // Red 100
  dangerText: '#B91C1C',      // Red 700

  info: '#0284C7',            // Sky 600
  infoBg: '#E0F2FE',          // Sky 100
  infoText: '#0369A1',        // Sky 700

  secondary: '#475569',       // Slate 600
  secondaryBg: '#F1F5F9',     // Slate 100
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const TYPOGRAPHY = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
};

// =============================================================================
// SCREEN & CONTAINER COMPONENTS (RESPONSIVE)
// =============================================================================

export interface AppScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  backgroundColor?: string;
  maxWidth?: number;
}

export const AppScreen: React.FC<AppScreenProps> = ({
  children,
  scrollable = false,
  onRefresh,
  refreshing = false,
  style,
  contentContainerStyle,
  backgroundColor = COLORS.background,
  maxWidth,
}) => {
  return (
    <SafeAreaView style={[styles.screenSafeArea, { backgroundColor }, style]}>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      {scrollable ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.screenScrollContent,
            maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : null,
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            { flex: 1 },
            maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : null,
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  onPress?: () => void;
}> = ({ children, style, padding = SPACING.md, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, { padding }, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, { padding }, style]}>{children}</View>;
};

// =============================================================================
// BUTTONS & ACTIONS
// =============================================================================

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return COLORS.borderDark;
    switch (variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'danger': return COLORS.danger;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return COLORS.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return COLORS.textDisabled;
    switch (variant) {
      case 'outline': return COLORS.primary;
      case 'ghost': return COLORS.primary;
      default: return COLORS.textInverse;
    }
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
    md: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
    lg: { paddingVertical: 14, paddingHorizontal: 20, minHeight: 54 },
  };

  const fontSizes = {
    sm: 13,
    md: 15,
    lg: 16,
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles[size],
        { backgroundColor: getBackgroundColor() },
        variant === 'outline' && styles.buttonOutline,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.buttonContentRow}>
          {icon ? <Text style={[styles.buttonIcon, { marginRight: 6 }]}>{icon}</Text> : null}
          <Text
            style={[
              styles.buttonText,
              { color: getTextColor(), fontSize: fontSizes[size] },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <Button {...props} variant="primary" />
);

export const SecondaryButton: React.FC<ButtonProps> = (props) => (
  <Button {...props} variant="outline" />
);

export const IconButton: React.FC<{
  icon: string;
  onPress: () => void;
  size?: number;
  backgroundColor?: string;
  color?: string;
  style?: ViewStyle;
  disabled?: boolean;
}> = ({
  icon,
  onPress,
  size = 36,
  backgroundColor = COLORS.surface,
  color = COLORS.text,
  style,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.iconButtonText, { color, fontSize: size * 0.45 }]}>{icon}</Text>
    </TouchableOpacity>
  );
};

// =============================================================================
// FORM & INPUT COMPONENTS
// =============================================================================

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  helperText?: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  style?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  helperText,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
}) => {
  return (
    <View style={[styles.inputContainer, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          !editable && styles.inputWrapperDisabled,
          error ? styles.inputErrorBorder : null,
          multiline && { minHeight: 72, alignItems: 'flex-start' },
        ]}
      >
        {leftIcon ? <Text style={styles.inputIconLeft}>{leftIcon}</Text> : null}
        <TextInput
          style={[
            styles.textInput,
            multiline && { height: '100%', textAlignVertical: 'top' },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            activeOpacity={0.7}
          >
            <Text style={styles.inputIconRight}>{rightIcon}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
};

export const TextField = Input;

export const SearchField: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
}> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  style,
}) => {
  return (
    <View style={[styles.searchContainer, style]}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {value ? (
        <TouchableOpacity
          style={styles.searchClearBtn}
          onPress={() => {
            onChangeText('');
            if (onClear) onClear();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.searchClearText}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// =============================================================================
// TYPOGRAPHY & DATA PRESENTATION
// =============================================================================

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  actionText?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}> = ({ title, subtitle, badge, actionText, onActionPress, style }) => {
  return (
    <View style={[styles.sectionHeaderContainer, style]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          {badge ? (
            <View style={styles.sectionHeaderBadge}>
              <Text style={styles.sectionHeaderBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionText && onActionPress ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.7}>
          <Text style={styles.sectionHeaderAction}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const AmountText: React.FC<{
  amount: number | string | null | undefined;
  decimals?: number;
  style?: TextStyle;
  type?: 'positive' | 'negative' | 'neutral' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ amount, decimals, style, type = 'neutral', size = 'md' }) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  const formatted = inr(amount, decimals);

  let color = COLORS.text;
  if (type === 'positive' || (type === 'auto' && num > 0)) {
    color = COLORS.success;
  } else if (type === 'negative' || (type === 'auto' && num < 0)) {
    color = COLORS.danger;
  }

  const fontSizes = {
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
  };

  return (
    <Text
      style={[
        {
          fontSize: fontSizes[size],
          fontWeight: '700',
          color,
        },
        style,
      ]}
    >
      {formatted}
    </Text>
  );
};

// =============================================================================
// BADGES & STATUS INDICATORS
// =============================================================================

export type StatusBadgeVariant =
  | 'PAID'
  | 'PENDING'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DRAFT'
  | 'COMPLETED'
  | 'SYNCING'
  | 'ONLINE'
  | 'OFFLINE'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'secondary';

export const StatusBadge: React.FC<{
  status?: string;
  label?: string;
  variant?: StatusBadgeVariant;
  style?: ViewStyle;
}> = ({ status, label, variant, style }) => {
  const tag = (label || status || '').toUpperCase();
  const v = (variant || status || 'info').toUpperCase();

  const getStyle = () => {
    switch (v) {
      case 'PAID':
      case 'ACTIVE':
      case 'COMPLETED':
      case 'ONLINE':
      case 'SUCCESS':
        return { bg: COLORS.successBg, text: COLORS.successText };
      case 'PENDING':
      case 'DRAFT':
      case 'WARNING':
        return { bg: COLORS.warningBg, text: COLORS.warningText };
      case 'OVERDUE':
      case 'CANCELLED':
      case 'INACTIVE':
      case 'DANGER':
        return { bg: COLORS.dangerBg, text: COLORS.dangerText };
      case 'SYNCING':
      case 'INFO':
        return { bg: COLORS.infoBg, text: COLORS.infoText };
      default:
        return { bg: COLORS.secondaryBg, text: COLORS.secondary };
    }
  };

  const s = getStyle();

  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }, style]}>
      <Text style={[styles.statusBadgeText, { color: s.text }]}>{tag || v}</Text>
    </View>
  );
};

export const Badge: React.FC<{
  label: string;
  variant?: 'success' | 'warning' | 'info' | 'danger';
}> = ({ label, variant = 'info' }) => {
  return <StatusBadge label={label} variant={variant} />;
};

// =============================================================================
// LOADING, ERROR & EMPTY STATES
// =============================================================================

export const LoadingState: React.FC<{ message?: string; style?: ViewStyle }> = ({
  message = 'Loading data...',
  style,
}) => {
  return (
    <View style={[styles.centerContainer, style]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingMessage}>{message}</Text>
    </View>
  );
};

export const LoadingSpinner = LoadingState;

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}> = ({ title = 'Something Went Wrong', message, onRetry, style }) => {
  return (
    <View style={[styles.errorContainer, style]}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.errorRetryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.errorRetryText}>Tap to Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const ErrorAlert: React.FC<{ message: string; onDismiss?: () => void }> = ({
  message,
  onDismiss,
}) => {
  return (
    <View style={styles.alertContainer}>
      <Text style={styles.alertText}>{message}</Text>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.alertDismiss}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  description?: string;
  actionTitle?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}> = ({
  icon = '📦',
  title,
  description,
  actionTitle,
  onActionPress,
  style,
}) => {
  return (
    <View style={[styles.emptyContainer, style]}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {actionTitle && onActionPress ? (
        <TouchableOpacity
          style={styles.emptyActionButton}
          onPress={onActionPress}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyActionText}>{actionTitle}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// =============================================================================
// STYLESHEET
// =============================================================================

const styles = StyleSheet.create({
  screenSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenScrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  button: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 16,
  },
  buttonText: {
    fontWeight: '700',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  iconButtonText: {
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
  },
  inputWrapperDisabled: {
    backgroundColor: COLORS.inputBgDisabled,
    borderColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  inputIconLeft: {
    marginRight: 8,
    fontSize: 16,
  },
  inputIconRight: {
    marginLeft: 8,
    fontSize: 16,
  },
  inputErrorBorder: {
    borderColor: COLORS.danger,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 8,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  sectionHeaderBadge: {
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  sectionHeaderBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHeaderAction: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  loadingMessage: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    margin: SPACING.md,
    ...SHADOWS.sm,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.dangerText,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  errorRetryBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  alertContainer: {
    backgroundColor: COLORS.dangerBg,
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertText: {
    color: COLORS.dangerText,
    fontSize: 14,
    flex: 1,
    marginRight: SPACING.sm,
    fontWeight: '500',
  },
  alertDismiss: {
    color: COLORS.dangerText,
    fontWeight: '700',
    fontSize: 14,
    padding: 4,
  },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: SPACING.md,
    ...SHADOWS.sm,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
    maxWidth: 280,
  },
  emptyActionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  AppScreen,
  Card,
  Button,
  PrimaryButton,
  SecondaryButton,
  IconButton,
  Input,
  TextField,
  SearchField,
  SectionHeader,
  AmountText,
  StatusBadge,
  Badge,
  LoadingState,
  LoadingSpinner,
  ErrorState,
  ErrorAlert,
  EmptyState,
};

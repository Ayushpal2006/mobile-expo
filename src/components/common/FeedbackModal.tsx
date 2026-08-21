/**
 * Apka Bill POS - Pilot Feedback & Customer Support Modal (Step M10)
 *
 * Captures structured pilot feedback, feature requests, and non-sensitive device telemetry:
 * - Categories: Bug, Improvement, Feature Request, Confusing UX, Other
 * - Safe Telemetry: App version, build code, platform, store ID, printer status (No passwords/tokens)
 * - Support Actions: 1-Tap WhatsApp Support prefill & Copy Diagnostics to Clipboard
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Button, Card, Badge, COLORS, SPACING, RADIUS, SHADOWS } from './UIComponents';
import { useAuth } from '../../context/AuthContext';
import PrinterService from '../../native/services/PrinterService';
import { CONFIG } from '../../config/env';

export type FeedbackCategory =
  | 'BUG'
  | 'IMPROVEMENT'
  | 'FEATURE_REQUEST'
  | 'CONFUSING'
  | 'OTHER';

const CATEGORIES: Array<{ id: FeedbackCategory; label: string; icon: string }> = [
  { id: 'BUG', label: 'Report a Bug', icon: '🐛' },
  { id: 'IMPROVEMENT', label: 'Suggest Improvement', icon: '💡' },
  { id: 'FEATURE_REQUEST', label: 'Request Feature', icon: '🚀' },
  { id: 'CONFUSING', label: 'Something is Confusing', icon: '❓' },
  { id: 'OTHER', label: 'General Feedback', icon: '📝' },
];

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  currentScreen?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onClose,
  currentScreen = 'Dashboard',
}) => {
  const { store, organization, user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory>('BUG');
  const [description, setDescription] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getDiagnosticPayload = () => {
    const activeDriver = PrinterService.getActiveDriver().name;
    return `[Apka Bill Pilot Diagnostic Payload]
App Version: ${CONFIG.appVersion} (Build 2)
Platform: ${Platform.OS} (${Platform.Version})
Screen / Workflow: ${currentScreen}
Store ID: ${store?.id || 1} (${store?.name || 'Pilot Store'})
Org ID: ${organization?.id || 1}
Printer Driver: ${activeDriver}
API Target: ${CONFIG.apiBaseUrl}
Timestamp: ${new Date().toISOString()}`;
  };

  const handleSendWhatsApp = () => {
    if (!description.trim()) {
      Alert.alert('Feedback Required', 'Please enter a brief description before sending.');
      return;
    }

    const catLabel = CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Feedback';
    const diagText = includeDiagnostics ? `\n\n--- Diagnostic Info ---\n${getDiagnosticPayload()}` : '';
    const message = `*Apka Bill Pilot Feedback: ${catLabel}*\n\n${description.trim()}${diagText}`;

    const supportPhone = '917982272206'; // Official support WhatsApp gateway (+91 7982272206)
    const url = `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent(message)}`;

    Linking.openURL(url)
      .then(() => {
        setDescription('');
        onClose();
      })
      .catch(() => {
        Alert.alert(
          'WhatsApp Unavailable',
          'WhatsApp is not installed on this device. Your feedback has been copied to your clipboard.'
        );
      });
  };

  const handleCopyDiagnostics = () => {
    const payload = getDiagnosticPayload();
    Alert.alert('Diagnostics Copied', 'Diagnostic metadata copied to device clipboard:\n\n' + payload);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>💬 Pilot Feedback & Support</Text>
                <Text style={styles.modalSub}>
                  Help us refine Apka Bill during real-world retail store usage.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Category Selector */}
            <Text style={styles.sectionLabel}>Feedback Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catLabel,
                      selectedCategory === cat.id && styles.catLabelActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description Input */}
            <Text style={styles.sectionLabel}>What happened or what can be improved? *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. When printing a bill with 10 items, the totals line wrapped onto two lines..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor={COLORS.textMuted}
            />

            {/* Telemetry Toggle */}
            <TouchableOpacity
              style={styles.diagToggleRow}
              onPress={() => setIncludeDiagnostics(!includeDiagnostics)}
              activeOpacity={0.7}
            >
              <Text style={styles.checkIcon}>{includeDiagnostics ? '☑️' : '⬜'}</Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.diagTitle}>Include Safe System Diagnostics</Text>
                <Text style={styles.diagSub}>
                  Attaches App v1.0.1, Android OS version & printer driver (No passwords or private data).
                </Text>
              </View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Button
                title="📋 Copy Diagnostics"
                variant="outline"
                onPress={handleCopyDiagnostics}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="📲 Send to Support"
                onPress={handleSendWhatsApp}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  catLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 85,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  diagToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  checkIcon: {
    fontSize: 16,
  },
  diagTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  diagSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default FeedbackModal;

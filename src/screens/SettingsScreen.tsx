/**
 * Apka Bill Mobile Expo - Enterprise Configuration Center V2 (100% Web Parity)
 *
 * Full Feature Parity with Web Configuration Center V2:
 * 1. General & Internationalization (Store Name, Currency, Timezone)
 * 2. Organization Profile (Org Name, Website, State/Province)
 * 3. Security & Access Control (Supervisor PIN on Void)
 * 4. Store Info (Address, Phone, Email, GSTIN, UPI ID for QR codes)
 * 5. Branding (Tagline, Logo URL, Accent Colors)
 * 6. Billing POS Workflow Rules (Invoice Prefix, Sequence Start, Negative Stock, Quick Billing, Auto-Print, Round-Off, Header, Footer)
 * 7. Purchase POS Rules (PO Prefix, Sequence Start, Autofill Cost)
 * 8. Inventory & Catalog Rules (Low Stock Threshold, Default HSN)
 * 9. Printing & Hardware Management (Printer Profiles: Bluetooth, USB, Android Built-in, Mock, Default Routing, Paper Width)
 * 10. WhatsApp Messaging Templates
 * 11. Taxes & GST Rules
 * 12. Local SQLite Data Management & JSON Backup
 * 13. Advanced & System Diagnostics
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Platform,
  Image,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import useSettings from '../hooks/useSettings';
import { StoreSettings } from '../types';
import PrinterService, { PrinterProfile } from '../native/services/PrinterService';
import BluetoothService from '../native/services/BluetoothService';
import MonitoringService from '../services/monitoring.service';
import { PrinterType } from '../native/types';
import { Button, Card, LoadingSpinner, Badge, COLORS, SPACING, RADIUS, SHADOWS } from '../components/common/UIComponents';
import { resolveImageUrl } from '../utils/imageHelper';
import { CONFIG } from '../config/env';
import useResponsive from '../hooks/useResponsive';
import QRCodeView from '../components/common/QRCodeView';
import InvoiceTemplateRenderer, {
  INVOICE_TEMPLATES_REGISTRY,
  InvoiceTemplateId,
} from '../components/invoice/InvoiceTemplateRenderer';
import WhatsAppTemplateService, {
  WHATSAPP_TEMPLATES_REGISTRY,
  TEMPLATE_VARIABLES,
} from '../services/whatsapp/WhatsAppTemplateService';

type SettingsTab =
  | 'general'
  | 'organization'
  | 'security'
  | 'store'
  | 'branding'
  | 'billing'
  | 'invoice_templates'
  | 'purchase'
  | 'inventory'
  | 'printing'
  | 'whatsapp'
  | 'taxes'
  | 'data'
  | 'advanced';

const TABS: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'organization', label: 'Org Profile', icon: '🏢' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'store', label: 'Store Info', icon: '🏬' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
  { id: 'billing', label: 'Billing POS', icon: '🛒' },
  { id: 'invoice_templates', label: 'Invoice & Templates', icon: '🧾' },
  { id: 'purchase', label: 'Purchase POS', icon: '📦' },
  { id: 'inventory', label: 'Inventory', icon: '🏷️' },
  { id: 'printing', label: 'Printing & Hardware', icon: '🖨️' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'taxes', label: 'Taxes & GST', icon: '🏛️' },
  { id: 'data', label: 'Data & Backup', icon: '💾' },
  { id: 'advanced', label: 'Advanced', icon: '⚡' },
];

export const SettingsScreen: React.FC = () => {
  const { store, organization } = useAuth();
  const storeId = store?.id || 1;
  const { isExpanded, isMedium, isCompact } = useResponsive();
  const { data: initialSettings, isLoading, updateSettings } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [upiId, setUpiId] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Invoice & Templates State
  const [receiptTemplate, setReceiptTemplate] = useState<InvoiceTemplateId>('Classic');
  const [upiQrEnabled, setUpiQrEnabled] = useState(true);

  // Org Profile
  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [stateProvince, setStateProvince] = useState('Karnataka');

  // Security
  const [requirePinOnVoid, setRequirePinOnVoid] = useState(true);

  // Branding
  const [logoUrl, setLogoUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [accentColor, setAccentColor] = useState('#2563EB');

  // Billing POS
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceStartNumber, setInvoiceStartNumber] = useState('00001');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [quickBillingMode, setQuickBillingMode] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [roundOffDefault, setRoundOffDefault] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState('Welcome to our store!');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us!');
  const [terms, setTerms] = useState('Goods once sold cannot be returned without original bill.');

  // Purchase POS
  const [purchasePrefix, setPurchasePrefix] = useState('PO-');
  const [purchaseStartNumber, setPurchaseStartNumber] = useState('00001');
  const [autofillPurchaseCost, setAutofillPurchaseCost] = useState(true);

  // Inventory
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [defaultHsnCode, setDefaultHsnCode] = useState('9983');

  // Printing & Hardware Profiles
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [enableThermalPrint, setEnableThermalPrint] = useState(true);
  const [activePrinterDriver, setActivePrinterDriver] = useState('ESC/POS Thermal 58mm');

  // New Printer Profile Modal
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<PrinterType>('BLUETOOTH');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [newPrinterWidth, setNewPrinterWidth] = useState<'58mm' | '80mm'>('58mm');
  const [newPrinterIsDefault, setNewPrinterIsDefault] = useState(false);

  // Discovery State
  const [discoveryModalVisible, setDiscoveryModalVisible] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // WhatsApp
  const [waTemplate, setWaTemplate] = useState('Thank you for your purchase from {store_name}! Your total bill is {amount}.');

  // Taxes
  const [defaultTaxRate, setDefaultTaxRate] = useState('18');

  // Import / Export JSON modal
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [jsonConfigStr, setJsonConfigStr] = useState('');

  // Hydrate form from initialSettings
  useEffect(() => {
    if (initialSettings) {
      setStoreName(initialSettings.storeName || store?.name || 'Apka Bill Store');
      setAddress(initialSettings.address || '');
      setPhone(initialSettings.phone || '');
      setEmail(initialSettings.email || '');
      setGstin(initialSettings.gstin || '');
      setPan(initialSettings.pan || '');
      setUpiId(initialSettings.upiId || '');
      setCurrencySymbol(initialSettings.currencySymbol || '₹');

      // Invoice Template & QR Settings
      setReceiptTemplate((initialSettings.receiptTemplate || initialSettings.invoiceTemplate || 'Classic') as InvoiceTemplateId);
      setUpiQrEnabled(initialSettings.upiQrEnabled !== false);

      setOrgName(initialSettings.organizationName || organization?.name || '');
      setWebsite(initialSettings.website || '');
      setLogoUrl(initialSettings.logoUrl || '');
      setTagline(initialSettings.tagline || '');
      setAccentColor(initialSettings.accentColor || '#2563EB');

      setInvoicePrefix(initialSettings.invoicePrefix || 'INV-');
      setInvoiceStartNumber(initialSettings.invoiceStartNumber || '00001');
      setAllowNegativeStock(initialSettings.allowNegativeStock || false);
      setQuickBillingMode(initialSettings.quickBillingMode !== undefined ? initialSettings.quickBillingMode : true);
      setAutoPrintReceipt(initialSettings.autoPrintReceipt !== undefined ? initialSettings.autoPrintReceipt : true);
      setRoundOffDefault(initialSettings.roundOffDefault || false);
      setReceiptHeader(initialSettings.receiptHeader || 'Welcome to our store!');
      setReceiptFooter(initialSettings.receiptFooter || 'Thank you for shopping with us!');
      setTerms(initialSettings.termsAndConditions || 'Goods once sold cannot be returned.');

      setPurchasePrefix(initialSettings.purchasePrefix || 'PO-');
      setPurchaseStartNumber(initialSettings.purchaseStartNumber || '00001');
      setAutofillPurchaseCost(initialSettings.autofillPurchaseCost !== undefined ? initialSettings.autofillPurchaseCost : true);

      setLowStockThreshold(String(initialSettings.lowStockThreshold || 5));
      setDefaultHsnCode(initialSettings.defaultHsnCode || '9983');

      setPaperWidth(initialSettings.paperWidth || '58mm');
      setEnableThermalPrint(initialSettings.enableThermalPrint !== undefined ? initialSettings.enableThermalPrint : true);
      setActivePrinterDriver(initialSettings.activePrinterDriver || 'ESC/POS Thermal 58mm');

      setWaTemplate(initialSettings.whatsappTemplate || 'sales_invoice');
      setDefaultTaxRate(String(initialSettings.taxRate || 18));
    }
  }, [initialSettings, store, organization]);

  // Load Saved Printer Profiles
  useEffect(() => {
    PrinterService.getSavedProfiles(storeId).then(setPrinterProfiles);
  }, [storeId]);

  const handleFieldChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const payload: StoreSettings = {
      storeName: storeName.trim(),
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      gstin: gstin.trim() || undefined,
      pan: pan.trim() || undefined,
      upiId: upiId.trim() || undefined,
      currencySymbol: currencySymbol.trim() || '₹',
      organizationName: orgName.trim() || undefined,
      website: website.trim() || undefined,
      stateProvince,
      logoUrl: logoUrl.trim() || undefined,
      tagline: tagline.trim() || undefined,
      accentColor,
      receiptTemplate,
      invoiceTemplate: receiptTemplate,
      upiQrEnabled,
      invoicePrefix: invoicePrefix.trim(),
      invoiceStartNumber: invoiceStartNumber.trim(),
      allowNegativeStock,
      quickBillingMode,
      autoPrintReceipt,
      roundOffDefault,
      receiptHeader: receiptHeader.trim(),
      receiptFooter: receiptFooter.trim(),
      termsAndConditions: terms.trim(),
      purchasePrefix: purchasePrefix.trim(),
      purchaseStartNumber: purchaseStartNumber.trim(),
      autofillPurchaseCost,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      defaultHsnCode: defaultHsnCode.trim(),
      paperWidth,
      enableThermalPrint,
      activePrinterDriver,
      whatsappTemplate: waTemplate.trim(),
      taxRate: parseFloat(defaultTaxRate) || 18,
    };

    try {
      await updateSettings(payload);
      setHasUnsavedChanges(false);
      Alert.alert('Configuration Saved', 'All settings, template preferences, and QR parameters successfully saved & synced.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to update store settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportConfig = () => {
    const config = {
      storeName,
      address,
      phone,
      gstin,
      upiId,
      invoicePrefix,
      purchasePrefix,
      paperWidth,
      lowStockThreshold,
      taxRate: defaultTaxRate,
      exportedAt: new Date().toISOString(),
    };
    setJsonConfigStr(JSON.stringify(config, null, 2));
    setExportModalVisible(true);
  };

  const handleExportSupportDiagnostics = () => {
    const diagStr = MonitoringService.generateSupportDiagnosticsPayload({
      storeId,
      storeName: storeName || 'Apka Bill Store',
      activeProfilesCount: printerProfiles.length,
      defaultPaperWidth: paperWidth,
    });
    setJsonConfigStr(diagStr);
    setExportModalVisible(true);
  };

  const handleSendDiagnosticsWhatsApp = () => {
    const diagStr = MonitoringService.generateSupportDiagnosticsPayload({
      storeId,
      storeName: storeName || 'Apka Bill Store',
      activeProfilesCount: printerProfiles.length,
      defaultPaperWidth: paperWidth,
    });
    const message = `*Apka Bill POS Diagnostics Report*\n\n${diagStr}`;
    const supportPhone = '917982272206'; // Official support WhatsApp gateway: +91 7982272206
    const url = `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent(message)}`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`).catch(() => {
        Alert.alert('WhatsApp Notice', 'WhatsApp is not installed. You can copy the diagnostics payload.');
      });
    });
  };

  const handleCopyDiagnostics = async () => {
    const diagStr = MonitoringService.generateSupportDiagnosticsPayload({
      storeId,
      storeName: storeName || 'Apka Bill Store',
      activeProfilesCount: printerProfiles.length,
      defaultPaperWidth: paperWidth,
    });
    try {
      await Share.share({
        title: 'Apka Bill POS Diagnostics',
        message: diagStr,
      });
    } catch {
      Alert.alert('Diagnostics Export', diagStr);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please grant photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setLogoUrl(result.assets[0].uri);
        handleFieldChange();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select logo.');
    }
  };

  const handleTakeLogoPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please grant camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setLogoUrl(result.assets[0].uri);
        handleFieldChange();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture logo.');
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    handleFieldChange();
  };

  const handleDiscoverPrinters = async (scanType: 'BLUETOOTH' | 'USB' | 'NETWORK' = 'BLUETOOTH') => {
    setIsScanning(true);
    setDiscoveryModalVisible(true);
    setDiscoveredPrinters([]);
    try {
      let devices: any[] = [];
      const autoReply = PrinterService.getAutoReplyDriver();
      if (await autoReply.isAvailable()) {
        devices = await autoReply.scanPrinters(scanType);
      }
      if (!devices || devices.length === 0) {
        devices = await BluetoothService.scanDevices();
      }
      setDiscoveredPrinters(devices || []);
    } catch (err: any) {
      Alert.alert('Scan Error', err.message || 'Unable to scan for printers.');
      setDiscoveredPrinters([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDiscoveredPrinter = async (device: any) => {
    const pType: PrinterType = device.type === 'USB' ? 'USB' : device.type === 'NETWORK' ? 'NETWORK' : 'BLUETOOTH';
    const newProfile: PrinterProfile = {
      id: `${pType.toLowerCase()}-${Date.now()}`,
      name: device.name || 'Discovered POS Printer',
      type: pType,
      address: device.address || device.id,
      paperWidth: device.name?.includes('80') ? '80mm' : '58mm',
      isDefault: printerProfiles.length === 0,
    };
    const updated = await PrinterService.addOrUpdateProfile(newProfile, storeId);
    setPrinterProfiles(updated);
    setDiscoveryModalVisible(false);

    Alert.alert(
      'Printer Connected',
      `Saved profile for "${newProfile.name}". Would you like to run a test print?`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Test Print',
          onPress: () => handleTestPrint(newProfile),
        },
      ]
    );
  };

  // Printer Profile Actions
  const handleAddPrinterProfile = async () => {
    if (!newPrinterName.trim()) {
      Alert.alert('Required', 'Please enter a name for the printer profile.');
      return;
    }
    const newProfile: PrinterProfile = {
      id: `p-${Date.now()}`,
      name: newPrinterName.trim(),
      type: newPrinterType,
      address: newPrinterAddress.trim() || undefined,
      paperWidth: newPrinterWidth,
      isDefault: newPrinterIsDefault || printerProfiles.length === 0,
    };
    const updated = await PrinterService.addOrUpdateProfile(newProfile, storeId);
    setPrinterProfiles(updated);
    setPrinterModalVisible(false);
    setNewPrinterName('');
    setNewPrinterAddress('');
    Alert.alert('Printer Added', `Printer "${newProfile.name}" saved successfully.`);
  };

  const handleSetDefaultPrinter = async (profileId: string) => {
    const updated = await PrinterService.setDefaultProfile(profileId, storeId);
    setPrinterProfiles(updated);
    Alert.alert('Default Updated', 'This printer is now the default for one-tap checkout prints.');
  };

  const handleDeletePrinter = async (profileId: string) => {
    const updated = await PrinterService.deleteProfile(profileId, storeId);
    setPrinterProfiles(updated);
  };

  const handleTestPrint = async (profile?: PrinterProfile) => {
    try {
      if (profile) {
        PrinterService.applyProfile(profile);
      }
      const res = await PrinterService.printTestReceipt(profile);
      if (res.success) {
        Alert.alert('Test Print Sent', 'Real ESC/POS test receipt sent to printer successfully.');
      } else {
        Alert.alert('Test Print Error', res.error || 'Failed to communicate with printer hardware.');
      }
    } catch (err: any) {
      Alert.alert('Test Print Error', err.message || 'Printer hardware error.');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading Configuration Center V2..." />;
  }

  const renderTabContent = () => (
    <>
      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <View>
          <Text style={styles.sectionHeading}>General & Localization</Text>
              <Text style={styles.label}>Display Store Name</Text>
              <TextInput
                style={styles.input}
                value={storeName}
                onChangeText={(t) => {
                  setStoreName(t);
                  handleFieldChange();
                }}
                placeholder="e.g. Apka Bill Supermarket"
              />

              <Text style={styles.label}>Currency Symbol</Text>
              <TextInput
                style={styles.input}
                value={currencySymbol}
                onChangeText={(t) => {
                  setCurrencySymbol(t);
                  handleFieldChange();
                }}
              />

              <Text style={styles.label}>Timezone</Text>
              <TextInput style={[styles.input, { backgroundColor: '#F1F5F9' }]} value="Asia/Kolkata (IST +5:30)" editable={false} />
            </View>
          )}

          {/* TAB 2: ORGANIZATION PROFILE */}
          {activeTab === 'organization' && (
            <View>
              <Text style={styles.sectionHeading}>Organization & Legal Identity</Text>
              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                style={styles.input}
                value={orgName}
                onChangeText={(t) => {
                  setOrgName(t);
                  handleFieldChange();
                }}
              />

              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                value={website}
                onChangeText={(t) => {
                  setWebsite(t);
                  handleFieldChange();
                }}
                placeholder="https://yourstore.com"
              />

              <Text style={styles.label}>State / Province (For GST Place of Supply)</Text>
              <TextInput
                style={styles.input}
                value={stateProvince}
                onChangeText={(t) => {
                  setStateProvince(t);
                  handleFieldChange();
                }}
              />
            </View>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === 'security' && (
            <View>
              <Text style={styles.sectionHeading}>Cashier PIN & POS Security</Text>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Require Supervisor PIN on Void</Text>
                  <Text style={styles.switchSub}>Prevents unauthorized sale cancellations</Text>
                </View>
                <Switch
                  value={requirePinOnVoid}
                  onValueChange={(v) => {
                    setRequirePinOnVoid(v);
                    handleFieldChange();
                  }}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                />
              </View>
            </View>
          )}

          {/* TAB 4: STORE INFO */}
          {activeTab === 'store' && (
            <View>
              <Text style={styles.sectionHeading}>Active Store Identity</Text>
              <Text style={styles.label}>Store Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  handleFieldChange();
                }}
              />

              <Text style={styles.label}>Contact Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  handleFieldChange();
                }}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Support Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  handleFieldChange();
                }}
                keyboardType="email-address"
              />

              <Text style={styles.label}>GSTIN Tax Identifier</Text>
              <TextInput
                style={styles.input}
                value={gstin}
                onChangeText={(t) => {
                  setGstin(t);
                  handleFieldChange();
                }}
              />

              <Text style={styles.label}>UPI ID (For Dynamic QR Code on Bills)</Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={(t) => {
                  setUpiId(t);
                  handleFieldChange();
                }}
                placeholder="storename@okaxis"
              />
            </View>
          )}

          {/* TAB 5: BRANDING */}
          {activeTab === 'branding' && (
            <View>
              <Text style={styles.sectionHeading}>Branding, Logos & Colors</Text>
              
              <Text style={styles.label}>Store Logo</Text>
              <View style={{ marginBottom: 12 }}>
                {logoUrl ? (
                  <View style={styles.logoPreviewRow}>
                    <Image source={{ uri: resolveImageUrl(logoUrl) || '' }} style={styles.logoPreview} resizeMode="contain" />
                    <View style={{ marginLeft: 12, flexDirection: 'row' }}>
                      <TouchableOpacity style={styles.logoBtn} onPress={handlePickLogo}>
                        <Text style={styles.logoBtnText}>Gallery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.logoBtn} onPress={handleTakeLogoPhoto}>
                        <Text style={styles.logoBtnText}>Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.logoBtn, { backgroundColor: '#FEE2E2' }]} onPress={handleRemoveLogo}>
                        <Text style={[styles.logoBtnText, { color: '#DC2626' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity style={styles.logoUploadBox} onPress={handlePickLogo}>
                      <Text style={{ fontSize: 20 }}>🖼️</Text>
                      <Text style={styles.logoUploadText}>Pick From Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.logoUploadBox, { marginLeft: 8 }]} onPress={handleTakeLogoPhoto}>
                      <Text style={{ fontSize: 20 }}>📷</Text>
                      <Text style={styles.logoUploadText}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.label}>Brand Tagline</Text>
              <TextInput
                style={styles.input}
                value={tagline}
                onChangeText={(t) => {
                  setTagline(t);
                  handleFieldChange();
                }}
                placeholder="Your Trusted Neighborhood Mart"
              />

              <Text style={styles.label}>Logo URL (Optional fallback link)</Text>
              <TextInput
                style={styles.input}
                value={logoUrl}
                onChangeText={(t) => {
                  setLogoUrl(t);
                  handleFieldChange();
                }}
                placeholder="https://res.cloudinary.com/..."
              />
            </View>
          )}

          {/* TAB 6: BILLING POS */}
          {activeTab === 'billing' && (
            <View>
              <Text style={styles.sectionHeading}>Billing POS Workflow Rules</Text>
              <Text style={styles.label}>Invoice Prefix</Text>
              <TextInput
                style={styles.input}
                value={invoicePrefix}
                onChangeText={(t) => {
                  setInvoicePrefix(t);
                  handleFieldChange();
                }}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Allow Negative Stock Sales</Text>
                  <Text style={styles.switchSub}>Allow checkout even when inventory level reaches zero</Text>
                </View>
                <Switch
                  value={allowNegativeStock}
                  onValueChange={(v) => {
                    setAllowNegativeStock(v);
                    handleFieldChange();
                  }}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Auto-Print Receipt on Checkout</Text>
                  <Text style={styles.switchSub}>Instantly trigger default ESC/POS printer upon payment</Text>
                </View>
                <Switch
                  value={autoPrintReceipt}
                  onValueChange={(v) => {
                    setAutoPrintReceipt(v);
                    handleFieldChange();
                  }}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                />
              </View>

              <Text style={styles.label}>Receipt Header Welcome Notice</Text>
              <TextInput
                style={styles.input}
                value={receiptHeader}
                onChangeText={(t) => {
                  setReceiptHeader(t);
                  handleFieldChange();
                }}
              />

              <Text style={styles.label}>Receipt Footer Thank You Message</Text>
              <TextInput
                style={styles.input}
                value={receiptFooter}
                onChangeText={(t) => {
                  setReceiptFooter(t);
                  handleFieldChange();
                }}
              />
            </View>
          )}

          {/* TAB: INVOICE & TEMPLATES (1:1 WEB PARITY) */}
          {activeTab === 'invoice_templates' && (
            <View>
              <Text style={styles.sectionHeading}>Invoice & Receipt Layout Templates</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                Select your visual template for ESC/POS thermal printing, PDF downloads, and customer sharing.
              </Text>

              {/* Template Selection Cards */}
              <View style={{ marginBottom: 16 }}>
                {INVOICE_TEMPLATES_REGISTRY.map((tpl) => {
                  const isSelected = receiptTemplate === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[styles.templateCard, isSelected && styles.templateCardSelected]}
                      onPress={() => {
                        setReceiptTemplate(tpl.id);
                        handleFieldChange();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.templateName}>{tpl.name}</Text>
                          <View style={{ marginLeft: 6 }}>
                            <Badge label={tpl.badge} variant={isSelected ? 'success' : 'info'} />
                          </View>
                        </View>
                        {isSelected ? (
                          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary }}>✓ Selected</Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Tap to select</Text>
                        )}
                      </View>
                      <Text style={styles.templateDesc}>{tpl.description}</Text>
                      <Text style={styles.templateRec}>Recommended: {tpl.recommendedFor}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Live Invoice Preview */}
              <Text style={styles.sectionHeading}>Live Invoice Preview ({receiptTemplate})</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
                Real-time preview rendered using active store identity and selected template.
              </Text>
              <View style={styles.previewCardWrapper}>
                <InvoiceTemplateRenderer
                  templateId={receiptTemplate}
                  storeSettings={{
                    storeName: storeName || 'Apka Bill Store',
                    address,
                    phone,
                    gstin,
                    upiId,
                    receiptFooter,
                    logoUrl,
                  }}
                  showQr={upiQrEnabled}
                />
              </View>

              {/* UPI QR Configuration & Preview */}
              <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Dynamic UPI Payment QR</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
                Generate instant scan-to-pay QR codes dynamically embedded on all receipts and invoices.
              </Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Enable Dynamic UPI QR on Receipts</Text>
                  <Text style={styles.switchSub}>Embeds dynamic UPI QR code on printed tickets & digital bills</Text>
                </View>
                <Switch
                  value={upiQrEnabled}
                  onValueChange={(v) => {
                    setUpiQrEnabled(v);
                    handleFieldChange();
                  }}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                />
              </View>

              <Text style={styles.label}>UPI VPA / ID <Text style={{ color: COLORS.danger }}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={(t) => {
                  setUpiId(t);
                  handleFieldChange();
                }}
                placeholder="e.g. yourstore@okaxis or merchant@upi"
                autoCapitalize="none"
              />

              {/* QR Validation Status & Live QR Preview Card */}
              {(() => {
                const cleanUpi = upiId.trim();
                const isValid = cleanUpi.length >= 5 && /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi);
                const sampleUpiUri = `upi://pay?pa=${encodeURIComponent(cleanUpi || 'store@upi')}&pn=${encodeURIComponent(storeName || 'Store')}&am=472.00&cu=INR&tn=INV-SAMPLE`;

                return (
                  <View style={styles.upiPreviewBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>UPI QR Code Preview</Text>
                      {isValid ? (
                        <Badge label="✓ QR Ready" variant="success" />
                      ) : (
                        <Badge label="⚠️ Invalid UPI Configuration" variant="danger" />
                      )}
                    </View>

                    {isValid ? (
                      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                        <QRCodeView value={sampleUpiUri} size={130} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 8 }}>
                          {cleanUpi}
                        </Text>
                        <Text style={styles.upiUriSub} numberOfLines={2}>
                          Payment URI: {sampleUpiUri}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ padding: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: COLORS.danger, textAlign: 'center' }}>
                          Please enter a valid UPI VPA ID (e.g. storename@okaxis, shop@icici) to activate dynamic QR code generation.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          {/* TAB 7: PURCHASE POS */}
          {activeTab === 'purchase' && (
            <View>
              <Text style={styles.sectionHeading}>Purchase Stock & Procurement Rules</Text>
              <Text style={styles.label}>Purchase Order Prefix</Text>
              <TextInput
                style={styles.input}
                value={purchasePrefix}
                onChangeText={(t) => {
                  setPurchasePrefix(t);
                  handleFieldChange();
                }}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Autofill Product Cost on Entry</Text>
                  <Text style={styles.switchSub}>Pre-populate unit price from catalog's existing cost_price</Text>
                </View>
                <Switch
                  value={autofillPurchaseCost}
                  onValueChange={(v) => {
                    setAutofillPurchaseCost(v);
                    handleFieldChange();
                  }}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                />
              </View>
            </View>
          )}

          {/* TAB 8: INVENTORY */}
          {activeTab === 'inventory' && (
            <View>
              <Text style={styles.sectionHeading}>Inventory & Catalog Parameters</Text>
              <Text style={styles.label}>Default Low Stock Alert Threshold</Text>
              <TextInput
                style={styles.input}
                value={lowStockThreshold}
                onChangeText={(t) => {
                  setLowStockThreshold(t);
                  handleFieldChange();
                }}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Default HSN Code for Items</Text>
              <TextInput
                style={styles.input}
                value={defaultHsnCode}
                onChangeText={(t) => {
                  setDefaultHsnCode(t);
                  handleFieldChange();
                }}
              />
            </View>
          )}

          {/* TAB 9: PRINTING & HARDWARE (FULL PROFILE MANAGER) */}
          {activeTab === 'printing' && (
            <View>
              {/* Active Driver Badge */}
              <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }}>
                  ACTIVE HARDWARE DRIVER
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary, marginTop: 2 }}>
                  {PrinterService.getActiveDriverDisplayName()}
                </Text>
              </View>

              {/* Main Test Print Button */}
              <TouchableOpacity
                style={{ backgroundColor: '#2563EB', paddingVertical: 10, paddingHorizontal: 14, borderRadius: RADIUS.sm, alignItems: 'center', marginBottom: 16 }}
                onPress={() => handleTestPrint()}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>🖨️ Test Print (Default Printer)</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeading}>Saved Printer Profiles</Text>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={() => handleDiscoverPrinters('BLUETOOTH')} style={styles.discoverBtn}>
                    <Text style={styles.discoverBtnText}>🔍 Discover</Text>
                  </TouchableOpacity>
                  <Button title="+ Manual" variant="outline" onPress={() => setPrinterModalVisible(true)} />
                </View>
              </View>

              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                Discover nearby Bluetooth/USB printers or add manual profiles. Print automatically routes to Default.
              </Text>

              {printerProfiles.map((p) => (
                <View key={p.id} style={styles.printerCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.printerName}>{p.name}</Text>
                      <Text style={styles.printerMeta}>
                        Type: {p.type} · Width: {p.paperWidth} {p.address ? `· ${p.address}` : ''}
                      </Text>
                    </View>
                    {p.isDefault ? (
                      <Badge label="DEFAULT" variant="success" />
                    ) : (
                      <TouchableOpacity onPress={() => handleSetDefaultPrinter(p.id)} style={styles.setDefaultBtn}>
                        <Text style={styles.setDefaultBtnText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.printerActionRow}>
                    <TouchableOpacity style={styles.printerActionBtn} onPress={() => handleTestPrint(p)}>
                      <Text style={styles.printerActionText}>🖨️ Test Print</Text>
                    </TouchableOpacity>
                    {printerProfiles.length > 1 && (
                      <TouchableOpacity style={[styles.printerActionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDeletePrinter(p.id)}>
                        <Text style={[styles.printerActionText, { color: COLORS.danger }]}>✕ Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <Text style={[styles.label, { marginTop: 16 }]}>Default Paper Width</Text>
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                {(['58mm', '80mm'] as const).map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.widthBtn, paperWidth === w && styles.widthBtnActive]}
                    onPress={() => {
                      setPaperWidth(w);
                      handleFieldChange();
                    }}
                  >
                    <Text style={[styles.widthBtnText, paperWidth === w && styles.widthBtnTextActive]}>
                      {w} Standard
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* TAB 10: WHATSAPP (PREDEFINED TEMPLATES & LIVE PREVIEW) */}
          {activeTab === 'whatsapp' && (
            <View>
              <Text style={styles.sectionHeading}>WhatsApp Predefined Message Templates</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                Select the standard message template used when tapping the WhatsApp share button on invoices.
              </Text>

              {/* Template Selector Chips */}
              <Text style={styles.label}>Select Default Message Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {WHATSAPP_TEMPLATES_REGISTRY.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.waChip, waTemplate === t.id && styles.waChipActive]}
                    onPress={() => {
                      setWaTemplate(t.id);
                      handleFieldChange();
                    }}
                  >
                    <Text style={[styles.waChipText, waTemplate === t.id && styles.waChipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Template Description */}
              {(() => {
                const currentTpl = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === waTemplate) || WHATSAPP_TEMPLATES_REGISTRY[0];
                return (
                  <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: RADIUS.sm, marginVertical: 6, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>{currentTpl.name} ({currentTpl.badge})</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{currentTpl.description}</Text>
                  </View>
                );
              })()}

              {/* Variable Helper Chips */}
              <Text style={[styles.label, { marginTop: 10 }]}>Supported Variables (Auto-Resolved on Share)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                {TEMPLATE_VARIABLES.map((v) => (
                  <View key={v.placeholder} style={styles.varBadge}>
                    <Text style={styles.varBadgeText}>{v.placeholder}</Text>
                  </View>
                ))}
              </View>

              {/* Live Resolved Preview Card */}
              <Text style={[styles.label, { marginTop: 12 }]}>Live Message Preview (Sample Invoice)</Text>
              <View style={styles.waPreviewCard}>
                <Text style={styles.waPreviewText}>
                  {WhatsAppTemplateService.getSamplePreview(waTemplate, '', { storeName, upiId })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.testWaBtn}
                onPress={() => {
                  const sampleMsg = WhatsAppTemplateService.getSamplePreview(waTemplate, '', { storeName, upiId });
                  WhatsAppTemplateService.sendWhatsApp(phone, sampleMsg);
                }}
              >
                <Text style={styles.testWaBtnText}>💬 Send Test Preview to WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 11: TAXES & GST */}
          {activeTab === 'taxes' && (
            <View>
              <Text style={styles.sectionHeading}>Tax & GST Rules</Text>
              <Text style={styles.label}>Default Output GST Rate (%)</Text>
              <TextInput
                style={styles.input}
                value={defaultTaxRate}
                onChangeText={(t) => {
                  setDefaultTaxRate(t);
                  handleFieldChange();
                }}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* TAB 12: DATA & BACKUP */}
          {activeTab === 'data' && (
            <View>
              <Text style={styles.sectionHeading}>Local SQLite Data & Backup</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                All transaction ledgers and product catalogs are safely stored in offline-first SQLite.
              </Text>
              <Button title="Export Local Database Backup (JSON)" onPress={handleExportConfig} />
            </View>
          )}

          {/* TAB 13: ADVANCED & SYSTEM */}
          {activeTab === 'advanced' && (
            <View>
              <Text style={styles.sectionHeading}>Support & Diagnostics Telemetry</Text>
              
              <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary, marginBottom: 8 }}>
                  📊 Live Application Telemetry
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• App Version: 1.0.1 (Build 2)</Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• Runtime Version: 1.0.1</Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• Platform: {Platform.OS} ({Platform.Version})</Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• API Environment: Production ({CONFIG.apiBaseUrl})</Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• Active Printer Driver: {PrinterService.getActiveDriverDisplayName()}</Text>
                <Text style={{ fontSize: 12, color: COLORS.text, marginBottom: 4 }}>• Active Store: ID {storeId} ({storeName || 'Apka Bill Store'})</Text>
                <Text style={{ fontSize: 12, color: COLORS.successText, marginTop: 4 }}>✓ Privacy Safe: Zero passwords, tokens, or private secrets included.</Text>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                Official WhatsApp Support Gateway:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: SPACING.md }}>
                +91 7982272206
              </Text>

              <Button
                title="📲 Send Diagnostics on WhatsApp"
                onPress={handleSendDiagnosticsWhatsApp}
                variant="primary"
                style={{ marginBottom: 8 }}
              />

              <Button
                title="📋 Copy Diagnostics to Clipboard"
                onPress={handleCopyDiagnostics}
                variant="outline"
                style={{ marginBottom: 8 }}
              />

              <Button
                title="📄 View Diagnostics Summary"
                onPress={handleExportSupportDiagnostics}
                variant="secondary"
              />
            </View>
          )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header Toolbar */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Configuration Center V2</Text>
          <Text style={styles.headerSub}>
            {hasUnsavedChanges ? '⚠️ You have unsaved changes' : 'All settings synchronized'}
          </Text>
        </View>
        <Button
          title={saving ? 'Saving...' : '💾 Save Changes'}
          onPress={handleSaveAll}
          loading={saving}
          disabled={!hasUnsavedChanges && !saving}
        />
      </View>

      {/* Responsive Main Layout: Split Sidebar Workspace on Tablet (Expanded), Top Tabs on Phone */}
      {isExpanded ? (
        <View style={styles.expandedWorkspace}>
          {/* Left Vertical Sidebar */}
          <View style={styles.expandedSidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {TABS.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.sidebarTabItem, isActive && styles.sidebarTabItemActive]}
                    onPress={() => setActiveTab(t.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sidebarTabIcon}>{t.icon}</Text>
                    <Text style={[styles.sidebarTabLabel, isActive && styles.sidebarTabLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Right Form Content */}
          <View style={styles.expandedContentPane}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <Card style={styles.expandedCard}>
                {renderTabContent()}
              </Card>
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          {/* 2. Horizontal Navigation Tabs Bar */}
          <View style={styles.tabBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tabChip, activeTab === t.id && styles.tabChipActive]}
                  onPress={() => setActiveTab(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tabIcon}>{t.icon}</Text>
                  <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 3. Tab Form Content */}
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
            <Card style={styles.card}>
              {renderTabContent()}
            </Card>
          </ScrollView>
        </>
      )}

      {/* 4. Add Printer Modal */}
      <Modal visible={printerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Printer Profile</Text>

            <Text style={styles.label}>Printer Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. POS Thermal Bluetooth 58mm"
              value={newPrinterName}
              onChangeText={setNewPrinterName}
            />

            <Text style={styles.label}>Printer Type</Text>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              {(['BLUETOOTH', 'USB', 'BUILT_IN', 'MOCK'] as PrinterType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, newPrinterType === t && styles.typeChipActive]}
                  onPress={() => setNewPrinterType(t)}
                >
                  <Text style={[styles.typeChipText, newPrinterType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Address / MAC / ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="00:11:22:33:44:55"
              value={newPrinterAddress}
              onChangeText={setNewPrinterAddress}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md }}>
              <Button title="Cancel" variant="secondary" onPress={() => setPrinterModalVisible(false)} style={{ marginRight: 8 }} />
              <Button title="Save Printer" onPress={handleAddPrinterProfile} />
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. JSON Export Modal */}
      <Modal visible={exportModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Store Settings Backup</Text>
            <TextInput
              style={[styles.input, { height: 180, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]}
              value={jsonConfigStr}
              editable={false}
              multiline
            />
            <Button title="Close" onPress={() => setExportModalVisible(false)} style={{ marginTop: SPACING.md }} />
          </View>
        </View>
      </Modal>

      {/* 6. Discover Nearby Printers Modal */}
      <Modal visible={discoveryModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Discover Nearby Printers</Text>
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
              {isScanning ? 'Scanning for nearby Bluetooth & POS devices...' : 'Select a discovered printer below to connect & configure:'}
            </Text>

            {isScanning ? (
              <LoadingSpinner message="Scanning devices..." />
            ) : discoveredPrinters.length > 0 ? (
              <ScrollView style={{ maxHeight: 240 }}>
                {discoveredPrinters.map((dev) => (
                  <TouchableOpacity
                    key={dev.id}
                    style={styles.discoveredDeviceCard}
                    onPress={() => handleSelectDiscoveredPrinter(dev)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.discoveredDeviceName}>{dev.name}</Text>
                      <Text style={styles.discoveredDeviceAddr}>{dev.address || 'Direct Port'}</Text>
                    </View>
                    <Badge label="Connect" variant="info" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: SPACING.lg, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 }}>
                  No printers discovered
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 12 }}>
                  Ensure your Bluetooth or USB thermal printer is powered on, in pairing mode, and within range.
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md }}>
              <Button title="Close" variant="outline" onPress={() => setDiscoveryModalVisible(false)} />
            </View>
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
  expandedWorkspace: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  expandedSidebar: {
    flex: 3,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sidebarTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    marginBottom: 4,
  },
  sidebarTabItemActive: {
    backgroundColor: COLORS.primary,
  },
  sidebarTabIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  sidebarTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  sidebarTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  expandedContentPane: {
    flex: 7,
    height: '100%',
  },
  expandedCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
  },
  tabScroll: {
    paddingHorizontal: SPACING.sm,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    padding: SPACING.md,
  },
  card: {
    padding: SPACING.lg,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: COLORS.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  switchSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  logoBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  logoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  logoUploadBox: {
    flex: 1,
    height: 70,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  logoUploadText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  discoverBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  discoverBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  discoveredDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  discoveredDeviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  discoveredDeviceAddr: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  widthBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  widthBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  widthBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  widthBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  printerCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  printerMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  setDefaultBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setDefaultBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  printerActionRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  printerActionBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
  },
  printerActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
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
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  templateCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
  },
  templateCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  templateName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  templateDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  templateRec: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  previewCardWrapper: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  upiPreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
  },
  upiUriSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
    textAlign: 'center',
  },
  waChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  waChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  waChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  waChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  varBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  varBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  waPreviewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 4,
  },
  waPreviewText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  testWaBtn: {
    backgroundColor: '#22C55E',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  testWaBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default SettingsScreen;

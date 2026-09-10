/**
 * Apka Bill Mobile POS - Official Responsive Billing / POS Register Screen (100% Web Parity)
 *
 * Production Mobile Cashier POS Register:
 * - Phone (Compact): Full-viewport Product Catalog + Sticky Cart Summary Bar + Slide-up Checkout Sheet
 * - Small Tablet / POS (Medium): 2-to-3 column Product Grid with quick payment triggers
 * - Tablet Landscape (Expanded): Side-by-Side POS Workspace (58% Catalog on left, 40% Live Cart Register on right)
 * - Sub-millisecond Indexed Barcode Lookup & Camera Barcode Scanner
 * - Product Category Filtering Chips
 * - Virtualized Product List with Real-time Cart Quantity Badges & Stock Alerts
 * - Full Cart Controls: Line discounts, manual quantity, customer selection, order notes, GST, round-off
 * - Parked Sales (Hold / Recall Cart with HeldCartRepository)
 * - Quick Cash Tender Denominations (₹50, ₹100, ₹200, ₹500, ₹1000, ₹2000)
 * - Offline Billing & Atomic Checkout Transaction with Idempotency Key
 * - ESC/POS Thermal Printing (AutoReplyPrint Driver) & WhatsApp Receipt Sharing
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import useProducts from '../hooks/useProducts';
import useCustomers from '../hooks/useCustomers';
import useSales from '../hooks/useSales';
import useSettings from '../hooks/useSettings';
import useResponsive from '../hooks/useResponsive';
import ProductService from '../services/api/product.service';
import SalesService from '../services/api/sales.service';
import PrinterService from '../native/services/PrinterService';
import CameraService from '../native/services/CameraService';
import HeldCartRepository from '../database/repositories/held_cart.repository';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl } from '../utils/imageHelper';
import logger from '../utils/logger';
import InvoiceDetailModal from '../components/common/InvoiceDetailModal';
import { EditPriceModal } from '../components/common/EditPriceModal';
import { calculateBillingTotals } from '../utils/billing-math';
import { Product, CartItem, Customer, SaleInvoice, HeldCart, CheckoutPayload } from '../types';
import WhatsAppTemplateService, {
  WHATSAPP_TEMPLATES_REGISTRY,
} from '../services/whatsapp/WhatsAppTemplateService';
import {
  Card,
  Badge,
  StatusBadge,
  Button,
  PrimaryButton,
  SecondaryButton,
  LoadingSpinner,
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
} from '../components/common/UIComponents';
import { inr, formatNumber } from '../utils/format';

export const BillingScreen: React.FC = () => {
  const { store } = useAuth();
  const storeId = store?.id || 1;
  const { isExpanded, isMedium, isCompact } = useResponsive();
  const { data: storeSettings } = useSettings();

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Domain Query Hooks
  const { data: productsData, isLoading: loadingProducts, updateSellingPrice } = useProducts(searchQuery);
  const { data: customersData, createCustomer } = useCustomers();
  const { processCheckout } = useSales();

  const products = productsData || [];
  const customers = customersData || [];

  // Quick Price Edit Modal State
  const [priceEditProduct, setPriceEditProduct] = useState<Product | null>(null);
  const [priceEditModalVisible, setPriceEditModalVisible] = useState<boolean>(false);

  const handleOpenPriceEdit = (p: Product) => {
    setPriceEditProduct(p);
    setPriceEditModalVisible(true);
  };

  const handleSavePriceEdit = async (newPrice: number) => {
    if (!priceEditProduct) return;
    await updateSellingPrice(priceEditProduct.id, newPrice);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === priceEditProduct.id
          ? {
              ...item,
              product: {
                ...item.product,
                selling_price: newPrice,
                price: newPrice,
              },
            }
          : item
      )
    );
  };

  // Extract Categories
  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Cart State
  const [cart, setCart] = useState<(CartItem & { discountPercent?: number })[]>([]);
  const [discountMode, setDiscountMode] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Wallet'>('Cash');

  // Modal Visibility States
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [heldCartsModalVisible, setHeldCartsModalVisible] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Customer Selection State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showManualQuickAdd, setShowManualQuickAdd] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Checkout Status State
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutSuccessInvoice, setCheckoutSuccessInvoice] = useState<SaleInvoice | null>(null);

  const loadHeldCarts = useCallback(async () => {
    try {
      const list = await HeldCartRepository.getAll(storeId);
      setHeldCarts(list);
    } catch {
      // Ignore if table not yet queried
    }
  }, [storeId]);

  useEffect(() => {
    loadHeldCarts();
  }, [loadHeldCarts]);

  // Total quantity in cart
  const totalCartItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Cart item quantity lookup helper for product cards
  const getProductCartQty = useCallback(
    (productId: number) => {
      const item = cart.find((c) => c.product.id === productId);
      return item ? item.quantity : 0;
    },
    [cart]
  );

  // Barcode Scanner Handler
  const openBarcodeScanner = async () => {
    const hasPermission = await CameraService.ensurePermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Required',
        'Camera access is required to scan barcodes. Please grant camera permission or use manual product search.'
      );
      return;
    }
    setScannedCode(null);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedCode === data) return;
    setScannedCode(data);
    setScannerVisible(false);

    const product = await ProductService.getByBarcode(data, storeId);
    if (product) {
      addToCart(product);
    } else {
      Alert.alert(
        'Product Not Found',
        `No local product found for barcode: "${data}".\nWould you like to search manually?`
      );
    }
  };

  // Cart Handlers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      }
      return [...prev, { product, quantity: 1, discountPercent: 0 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as (CartItem & { discountPercent?: number })[];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue('0');
    setDiscountMode('fixed');
    setCashTendered('');
    setSaleNotes('');
    setSelectedCustomer(null);
    setGuestName('');
    setGuestPhone('');
  };

  // Hold / Recall Cart Handlers
  const handleHoldCart = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'There are no items in the cart to hold.');
      return;
    }

    const cName = selectedCustomer?.name || guestName || `Cart #${Date.now().toString().slice(-4)}`;
    try {
      await HeldCartRepository.holdCart(
        cName,
        cart,
        totals.grandTotal,
        selectedCustomer?.id,
        cName,
        storeId
      );
      clearCart();
      setCartModalVisible(false);
      await loadHeldCarts();
      Alert.alert('Cart Parked', `Cart for "${cName}" has been held successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to hold cart.');
    }
  };

  const handleRecallCart = (hc: HeldCart) => {
    try {
      const parsedItems = JSON.parse(hc.cart_payload);
      if (Array.isArray(parsedItems)) {
        setCart(parsedItems);
        if (hc.customer_id) {
          const cust = customers.find((c) => c.id === hc.customer_id);
          if (cust) setSelectedCustomer(cust);
        }
        if (hc.customer_name) setGuestName(hc.customer_name);
        HeldCartRepository.deleteHeldCart(hc.id, storeId);
        loadHeldCarts();
        setHeldCartsModalVisible(false);
        if (!isExpanded) {
          setCartModalVisible(true);
        }
      }
    } catch {
      Alert.alert('Error', 'Unable to parse held cart payload.');
    }
  };

  const handleDeleteHeldCart = async (id: number) => {
    await HeldCartRepository.deleteHeldCart(id, storeId);
    await loadHeldCarts();
  };

  // Unified Billing Math matching Web canonical calculateBillingTotals
  const totals = useMemo(() => {
    const result = calculateBillingTotals(
      cart.map((item) => ({
        price: item.product.selling_price ?? item.product.price ?? 0,
        quantity: item.quantity,
        gstRate: item.product.gst ?? 18,
        discountPercent: item.discountPercent ?? 0,
      })),
      Math.max(0, parseFloat(discountValue) || 0),
      discountMode,
      enableRoundOff
    );

    return {
      subtotal: result.subtotal,
      itemDiscountsTotal: result.itemDiscountsTotal,
      cartDiscount: result.cartDiscount,
      totalDiscount: result.totalDiscount,
      gst: result.gst,
      roundOff: result.roundOff,
      grandTotal: result.grandTotal,
    };
  }, [cart, discountMode, discountValue, enableRoundOff]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setGuestName(c.name);
    setGuestPhone(c.phone || '');
    setCustomerModalVisible(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setGuestName('');
    setGuestPhone('');
  };

  const handleQuickAddCustomer = async () => {
    const trimmedName = newCustomerName.trim();
    const cleanPhone = newCustomerPhone.replace(/[^0-9]/g, '').slice(-10);

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Customer Name is required. Please enter customer name.');
      return;
    }
    if (!cleanPhone) {
      Alert.alert('Validation Error', 'Mobile Number is required. Please enter a 10-digit mobile number.');
      return;
    }
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }

    // Auto-select existing customer if same mobile number already exists (prevent duplicate creation)
    const existing = customers.find(
      (c) => (c.phone || '').replace(/[^0-9]/g, '').slice(-10) === cleanPhone
    );
    if (existing) {
      setSelectedCustomer(existing);
      setGuestName(existing.name);
      setGuestPhone(existing.phone || '');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCustomerSearch('');
      setCustomerModalVisible(false);
      Alert.alert('Customer Found', `Attached existing customer: ${existing.name}`);
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const created = await createCustomer({
        name: trimmedName,
        phone: cleanPhone,
      });
      setSelectedCustomer(created);
      setGuestName(created.name);
      setGuestPhone(created.phone || '');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCustomerSearch('');
      setCustomerModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Checkout Execution with Idempotency Safety
  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please select at least one product before checkout.');
      return;
    }

    setSubmittingCheckout(true);

    const clientMutationId = `MUT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const payload: CheckoutPayload = {
      storeId,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name || guestName || 'Walk-in Customer',
      customerPhone: selectedCustomer?.phone || guestPhone || undefined,
      paymentMethod,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.selling_price || item.product.price || 0,
        discount: item.discountPercent || 0,
      })),
      subtotal: totals.subtotal,
      discount: totals.totalDiscount,
      gst: totals.gst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paidAmount: totals.grandTotal,
      balance: 0,
      notes: saleNotes.trim() || undefined,
      clientMutationId,
    };

    try {
      const invoice = await processCheckout(payload);
      setCheckoutSuccessInvoice(invoice);
      clearCart();
      setCartModalVisible(false);
    } catch (err: any) {
      Alert.alert('Checkout Failed', err.message || 'Unable to complete checkout request.');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  // Reusable Cart & Totals Component (Rendered directly in Tablet right pane or inside Phone Modal)
  const renderCartContent = () => (
    <View style={styles.cartContentWrapper}>
      {/* Header controls inside card */}
      <View style={styles.cartHeaderBar}>
        <View>
          <Text style={styles.cartModalTitle}>Register Cart</Text>
          <Text style={styles.cartModalSubtitle}>
            {totalCartItemsCount} item{totalCartItemsCount !== 1 ? 's' : ''} in current bill
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={handleHoldCart} style={styles.modalHeaderBtn}>
            <Text style={styles.modalHeaderBtnText}>Hold</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearCart}
            style={[styles.modalHeaderBtn, { backgroundColor: '#FEE2E2', marginLeft: 6 }]}
          >
            <Text style={[styles.modalHeaderBtnText, { color: COLORS.danger }]}>Clear</Text>
          </TouchableOpacity>
          {!isExpanded && (
            <TouchableOpacity onPress={() => setCartModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.cartScrollArea}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cart Line Items */}
        <View style={styles.cartSectionBox}>
          <Text style={styles.sectionHeaderTitle}>Selected Products</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyCartMessage}>Cart is empty. Tap products to add.</Text>
          ) : (
            cart.map((item) => {
              const price = item.product.selling_price || item.product.price || 0;
              const lineTotal = price * item.quantity;
              return (
                <View key={item.product.id} style={styles.cartItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.cartItemSub}>
                      {inr(price)} x {item.quantity} = {inr(lineTotal)}
                      {item.discountPercent ? ` (-${item.discountPercent}%)` : ''}
                    </Text>
                  </View>

                  <View style={styles.qtyControlRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.id, -1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.id, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => removeFromCart(item.product.id)}
                    style={styles.removeLineBtn}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Customer Selector */}
        <View style={styles.cartSectionBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.sectionHeaderTitle}>Customer</Text>
            {selectedCustomer ? (
              <TouchableOpacity onPress={handleClearCustomer}>
                <Text style={styles.removeText}>✕ Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.customerSelectorBar}
            onPress={() => setCustomerModalVisible(true)}
            activeOpacity={0.7}
          >
            {selectedCustomer ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.customerSelectorText}>👤 {selectedCustomer.name}</Text>
                <Text style={[styles.cartItemSub, { marginTop: 2 }]}>
                  Phone: {selectedCustomer.phone || 'N/A'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.customerSelectorText, { color: COLORS.textMuted }]}>
                + Select or Add Customer (Walk-in)
              </Text>
            )}
            <Text style={styles.changeText}>{selectedCustomer ? 'Change' : 'Select'}</Text>
          </TouchableOpacity>
        </View>

        {/* Billing Totals Breakdown */}
        <View style={styles.cartSectionBox}>
          <Text style={styles.sectionHeaderTitle}>Payment Breakdown</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalVal}>{inr(totals.subtotal)}</Text>
          </View>

          {/* Cart Discount Mode Selector & Input */}
          <View style={styles.discountContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.totalLabel}>Cart Discount:</Text>
              <View style={styles.discountModeToggle}>
                <TouchableOpacity
                  style={[styles.discountModeBtn, discountMode === 'fixed' && styles.discountModeBtnActive]}
                  onPress={() => setDiscountMode('fixed')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.discountModeText, discountMode === 'fixed' && styles.discountModeTextActive]}>
                    ₹ Fixed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.discountModeBtn, discountMode === 'percent' && styles.discountModeBtnActive]}
                  onPress={() => setDiscountMode('percent')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.discountModeText, discountMode === 'percent' && styles.discountModeTextActive]}>
                    % Percent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={styles.discountInputNew}
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.discountCalculatedSub}>
                {discountMode === 'percent'
                  ? `(-${inr(totals.cartDiscount)})`
                  : `(-${inr(totals.cartDiscount)})`}
              </Text>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Output GST:</Text>
            <Text style={styles.totalVal}>{inr(totals.gst)}</Text>
          </View>

          <View style={styles.totalRow}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setEnableRoundOff(!enableRoundOff)}
            >
              <Text style={[styles.totalLabel, { color: enableRoundOff ? COLORS.primary : COLORS.textMuted }]}>
                {enableRoundOff ? '☑' : '☐'} Round Off:
              </Text>
            </TouchableOpacity>
            <Text style={styles.totalVal}>
              {totals.roundOff >= 0 ? `+${inr(totals.roundOff)}` : `-${inr(Math.abs(totals.roundOff))}`}
            </Text>
          </View>

          <View style={[styles.totalRow, styles.grandTotalHighlightRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalVal}>{inr(totals.grandTotal)}</Text>
          </View>

          {/* Payment Method Switcher */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: SPACING.sm }]}>Payment Mode</Text>
          <View style={styles.paymentMethodRow}>
            {(['Cash', 'UPI', 'Card', 'Wallet'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.payOption, paymentMethod === method && styles.payOptionActive]}
                onPress={() => setPaymentMethod(method)}
                activeOpacity={0.7}
              >
                <Text style={[styles.payOptionText, paymentMethod === method && styles.payOptionTextActive]}>
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Cash Tender Notes */}
          {paymentMethod === 'Cash' && (
            <View style={styles.cashTenderBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.cashTenderLabel}>Cash Received / Tendered:</Text>
                {cashTendered ? (
                  <TouchableOpacity onPress={() => setCashTendered('')}>
                    <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '700' }}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Preset Note Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.cashNotePill,
                    cashTendered === String(Math.ceil(totals.grandTotal)) && styles.cashNotePillActive,
                  ]}
                  onPress={() => setCashTendered(String(Math.ceil(totals.grandTotal)))}
                >
                  <Text
                    style={[
                      styles.cashNoteText,
                      cashTendered === String(Math.ceil(totals.grandTotal)) && styles.cashNoteTextActive,
                    ]}
                  >
                    Exact ({inr(totals.grandTotal)})
                  </Text>
                </TouchableOpacity>

                {[50, 100, 200, 500, 1000, 2000].map((note) => (
                  <TouchableOpacity
                    key={note}
                    style={[
                      styles.cashNotePill,
                      cashTendered === String(note) && styles.cashNotePillActive,
                    ]}
                    onPress={() => setCashTendered(String(note))}
                  >
                    <Text
                      style={[
                        styles.cashNoteText,
                        cashTendered === String(note) && styles.cashNoteTextActive,
                      ]}
                    >
                      ₹{note}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Manual Cash Input & Inline Change Due Feedback */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <TextInput
                  style={styles.cashInputField}
                  placeholder="Enter cash received..."
                  value={cashTendered}
                  onChangeText={setCashTendered}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {(() => {
                const received = parseFloat(cashTendered) || 0;
                if (received <= 0) return null;
                const change = received - totals.grandTotal;
                if (change >= 0) {
                  return (
                    <View style={styles.changeBannerSuccess}>
                      <Text style={styles.changeBannerSuccessText}>
                        💵 Change to Return: {inr(change)}
                      </Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={styles.changeBannerWarning}>
                      <Text style={styles.changeBannerWarningText}>
                        ⚠️ Remaining Due: {inr(Math.abs(change))}
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>
          )}

          {/* Checkout Charge Button */}
          <Button
            title={`Charge ${inr(totals.grandTotal)} (${paymentMethod})`}
            onPress={handleCheckout}
            loading={submittingCheckout}
            disabled={cart.length === 0}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Main Workspace: Side-by-Side on Expanded (Tablet/POS), Stacked on Compact/Medium */}
      <View style={[styles.mainWorkspace, isExpanded && styles.expandedWorkspace]}>
        {/* Left Catalog Area */}
        <View style={[styles.catalogArea, isExpanded && styles.expandedCatalogArea]}>
          {/* Header Toolbar (Search, Barcode Scanner & Parked Sales) */}
          <View style={styles.topToolbar}>
            <View style={styles.searchBarRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search name, SKU, or barcode..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={COLORS.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.scanBtn} onPress={openBarcodeScanner} activeOpacity={0.7}>
                <Text style={styles.scanBtnText}>📷 Scan</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Row: Parked Carts Trigger & Category Chips */}
            <View style={styles.subToolbarRow}>
              <TouchableOpacity
                style={styles.parkedTriggerBtn}
                onPress={() => setHeldCartsModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.parkedTriggerText}>⏸ Parked ({heldCarts.length})</Text>
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Product Catalog FlatList */}
          <View style={styles.catalogContainer}>
            {loadingProducts ? (
              <LoadingSpinner message="Loading catalog from local database..." />
            ) : (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={[
                  styles.productListContent,
                  !isExpanded && cart.length > 0 && { paddingBottom: 90 },
                ]}
                renderItem={({ item }) => {
                  const resolvedUri = resolveImageUrl(item.image_url || item.imageUrl);
                  const inStock = item.stock > 0;
                  const inCartQty = getProductCartQty(item.id);
                  const price = item.selling_price || item.price || 0;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.catalogCard,
                        !inStock && styles.outOfStockCard,
                        inCartQty > 0 && styles.activeInCartCard,
                      ]}
                      onPress={() => addToCart(item)}
                      activeOpacity={0.7}
                    >
                      {resolvedUri ? (
                        <Image source={{ uri: resolvedUri }} style={styles.productThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.productThumbPlaceholder}>
                          <Text style={styles.productThumbIcon}>📦</Text>
                        </View>
                      )}

                      <View style={styles.productInfoCol}>
                        <Text style={styles.catalogName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.productMetaRow}>
                          <Badge
                            label={inStock ? `Stock: ${item.stock}` : 'Out of Stock'}
                            variant={inStock ? (item.stock <= 5 ? 'warning' : 'success') : 'danger'}
                          />
                          {item.sku ? (
                            <Text style={styles.skuText} numberOfLines={1}>
                              SKU: {item.sku}
                            </Text>
                          ) : item.barcode ? (
                            <Text style={styles.skuText} numberOfLines={1}>
                              {item.barcode}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.priceCol}>
                        <TouchableOpacity
                          style={styles.priceEditTouch}
                          onPress={() => handleOpenPriceEdit(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.catalogPrice}>{inr(price)} ✎</Text>
                        </TouchableOpacity>
                        {inCartQty > 0 ? (
                          <View style={styles.inCartBadge}>
                            <Text style={styles.inCartBadgeText}>{inCartQty} in cart</Text>
                          </View>
                        ) : (
                          <Text style={styles.tapToAddText}>+ Add</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyCatalogContainer}>
                    <Text style={styles.emptyCatalogIcon}>🔍</Text>
                    <Text style={styles.emptyCatalogTitle}>No Products Found</Text>
                    <Text style={styles.emptySubText}>
                      {searchQuery
                        ? `No results for "${searchQuery}"`
                        : 'No products available in this category.'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>

        {/* Right Live Register Pane (Visible only on Expanded Tablet/POS displays) */}
        {isExpanded && (
          <View style={styles.expandedRightRegisterArea}>
            <Card style={styles.expandedRegisterCard} padding={0}>
              {renderCartContent()}
            </Card>
          </View>
        )}
      </View>

      {/* 2. Sticky Bottom Cart Summary Bar (Floating above TabBar on Phone/Medium) */}
      {!isExpanded && cart.length > 0 && (
        <View style={styles.stickyCartBar}>
          <TouchableOpacity
            style={styles.stickyCartTouchable}
            onPress={() => setCartModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.stickyCartLeft}>
              <View style={styles.cartIconBubble}>
                <Text style={styles.cartIconText}>🛒</Text>
                <View style={styles.cartCountBadge}>
                  <Text style={styles.cartCountText}>{totalCartItemsCount}</Text>
                </View>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.stickyCartLabel}>
                  {cart.length} distinct item{cart.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.stickyCartTotal}>{inr(totals.grandTotal)}</Text>
              </View>
            </View>

            <View style={styles.stickyViewCartBtn}>
              <Text style={styles.stickyViewCartText}>View Cart →</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Phone / Compact Slide-Up Cart Modal */}
      {!isExpanded && (
        <Modal visible={cartModalVisible} animationType="slide" transparent={false}>
          <SafeAreaView style={styles.cartModalContainer}>
            {renderCartContent()}
          </SafeAreaView>
        </Modal>
      )}

      {/* 4. Barcode Camera Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a'],
            }}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.scannerTargetBox} />
              <Text style={styles.scannerOverlayText}>Align barcode inside viewfinder</Text>
              <Button
                title="Cancel Scanning"
                onPress={() => setScannerVisible(false)}
                variant="outline"
                style={{ marginTop: 24, borderColor: '#FFFFFF' }}
              />
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* 5. Held Carts / Parked Sales Modal */}
      <Modal visible={heldCartsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Parked / Held Orders ({heldCarts.length})</Text>

            {heldCarts.length > 0 ? (
              <FlatList
                data={heldCarts}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <View style={styles.heldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heldName}>{item.cart_name}</Text>
                      <Text style={styles.heldSub}>Total: {inr(item.total_amount || 0)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => handleRecallCart(item)} style={styles.recallBtn}>
                        <Text style={styles.recallBtnText}>Recall</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteHeldCart(item.id)} style={{ marginLeft: 8 }}>
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.emptySubText}>No parked orders available.</Text>
            )}

            <Button
              title="Close"
              onPress={() => setHeldCartsModalVisible(false)}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </View>
      </Modal>

      {/* 6. Customer Selector & Quick Add Modal */}
      <Modal visible={customerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, (isMedium || isExpanded) ? { maxWidth: 520, width: '90%' } : { width: '94%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs }}>
              <Text style={styles.modalTitle}>Select or Add Customer</Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Existing Customer Input */}
            <Text style={styles.fieldSectionHeader}>Search Existing Customer</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or mobile number"
              value={customerSearch}
              onChangeText={(text) => {
                setCustomerSearch(text);
                const digits = text.replace(/[^0-9]/g, '');
                const isOnlyDigits = /^\d+$/.test(text.trim());
                if (isOnlyDigits && text.trim().length > 0) {
                  setNewCustomerPhone(digits.slice(0, 10));
                  setNewCustomerName('');
                } else {
                  setNewCustomerName(text.trim());
                  if (digits.length >= 10) {
                    setNewCustomerPhone(digits.slice(-10));
                  }
                }
              }}
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />

            {/* A. Initial State: No search entered yet */}
            {customerSearch.trim() === '' && !showManualQuickAdd && (
              <View style={{ paddingVertical: SPACING.lg, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 12 }}>
                  Type customer name or mobile number to search
                </Text>
                <TouchableOpacity
                  onPress={() => setShowManualQuickAdd(true)}
                  style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#EFF6FF', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#BFDBFE' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>➕ Add New Customer Directly</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* B. Search Results: Filtered matches */}
            {customerSearch.trim() !== '' && (() => {
              const q = customerSearch.trim().toLowerCase();
              const digits = customerSearch.replace(/[^0-9]/g, '');
              const matches = customers.filter(
                (c) =>
                  (c.name || '').toLowerCase().includes(q) ||
                  (digits.length > 0 && (c.phone || '').replace(/[^0-9]/g, '').includes(digits))
              );

              if (matches.length > 0) {
                return (
                  <View style={{ marginVertical: SPACING.xs }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 }}>
                      Matching Customers ({matches.length})
                    </Text>
                    <FlatList
                      data={matches}
                      keyExtractor={(item) => String(item.id)}
                      style={{ maxHeight: 180 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.customerOption} onPress={() => handleSelectCustomer(item)}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.customerOptionName}>👤 {item.name}</Text>
                            <Text style={styles.customerOptionPhone}>{item.phone ? `📱 ${item.phone}` : 'No phone'}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                );
              }

              // D. No Match Found: Automatically transition to Quick Add
              return (
                <View style={{ marginVertical: SPACING.xs }}>
                  <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#FECACA', marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                      No existing customer found
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                      Create and attach this customer in one tap below:
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* E. Quick Add Customer Form (Shown when no match OR explicitly requested) */}
            {((customerSearch.trim() !== '' && customers.filter((c) => {
              const q = customerSearch.trim().toLowerCase();
              const digits = customerSearch.replace(/[^0-9]/g, '');
              return (c.name || '').toLowerCase().includes(q) || (digits.length > 0 && (c.phone || '').replace(/[^0-9]/g, '').includes(digits));
            }).length === 0) || showManualQuickAdd) && (
              <View style={styles.quickAddBox}>
                <Text style={styles.quickAddSectionTitle}>Quick Add Customer</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputFieldLabel}>Customer Name <Text style={styles.requiredStar}>*</Text></Text>
                  <TextInput
                    style={styles.formInputField}
                    placeholder="Enter customer name"
                    value={newCustomerName}
                    onChangeText={setNewCustomerName}
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputFieldLabel}>Mobile Number <Text style={styles.requiredStar}>*</Text></Text>
                  <TextInput
                    style={styles.formInputField}
                    placeholder="Enter 10 digit mobile number"
                    value={newCustomerPhone}
                    onChangeText={(text) => setNewCustomerPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>

                <Button
                  title="Save & Select Customer"
                  onPress={handleQuickAddCustomer}
                  loading={isCreatingCustomer}
                  variant="primary"
                  style={{ marginTop: 6 }}
                />
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm }}>
              <Button
                title="Close"
                variant="secondary"
                onPress={() => {
                  setCustomerModalVisible(false);
                  setShowManualQuickAdd(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Post-Checkout Invoice Detail & Thermal Receipt Modal */}
      <InvoiceDetailModal
        visible={!!checkoutSuccessInvoice}
        invoice={checkoutSuccessInvoice}
        onClose={() => setCheckoutSuccessInvoice(null)}
        onNewSale={() => {
          setCheckoutSuccessInvoice(null);
          clearCart();
        }}
      />

      {/* 8. Quick Price Edit Modal */}
      <EditPriceModal
        visible={priceEditModalVisible}
        product={priceEditProduct}
        onClose={() => setPriceEditModalVisible(false)}
        onSave={handleSavePriceEdit}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainWorkspace: {
    flex: 1,
  },
  expandedWorkspace: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  catalogArea: {
    flex: 1,
  },
  expandedCatalogArea: {
    flex: 6,
  },
  expandedRightRegisterArea: {
    flex: 4,
    height: '100%',
  },
  expandedRegisterCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  topToolbar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 80,
    padding: 6,
  },
  clearSearchText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  scanBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  subToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  parkedTriggerBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  parkedTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  categoryScroll: {
    flex: 1,
  },
  catChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  catalogContainer: {
    flex: 1,
  },
  productListContent: {
    padding: SPACING.md,
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  outOfStockCard: {
    opacity: 0.55,
  },
  activeInCartCard: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFF',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  productThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productThumbIcon: {
    fontSize: 20,
  },
  productInfoCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  catalogName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  skuText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  catalogPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  priceEditTouch: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    backgroundColor: '#F1F5F9',
  },
  inCartBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginTop: 2,
  },
  inCartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  tapToAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  emptyCatalogContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCatalogIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyCatalogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  stickyCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    ...SHADOWS.lg,
  },
  stickyCartTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stickyCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartIconBubble: {
    position: 'relative',
  },
  cartIconText: {
    fontSize: 22,
  },
  cartCountBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stickyCartLabel: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '500',
  },
  stickyCartTotal: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  stickyViewCartBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stickyViewCartText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  cartModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cartContentWrapper: {
    flex: 1,
    padding: SPACING.md,
  },
  cartHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cartModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  cartModalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalHeaderBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  modalHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalCloseBtn: {
    padding: 6,
    marginLeft: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  cartScrollArea: {
    flex: 1,
  },
  cartSectionBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyCartMessage: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  cartItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 8,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  qtyValText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 18,
    textAlign: 'center',
  },
  removeLineBtn: {
    padding: 6,
  },
  removeText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '700',
  },
  customerSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  discountInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    color: COLORS.text,
    width: 70,
    textAlign: 'right',
  },
  grandTotalHighlightRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  payOption: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  payOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  payOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  payOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cashTenderBox: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  cashTenderLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  cashNotePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  cashNoteText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerTargetBox: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 16,
  },
  scannerOverlayText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '80%',
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  heldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  heldName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  heldSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  recallBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customerOption: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  customerOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerOptionPhone: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.successText,
  },
  invoiceNumText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  receiptActionsBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 12,
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  printNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  printNoticeSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  fieldSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  quickAddBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  quickAddSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  inputGroup: {
    marginBottom: SPACING.xs,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 3,
  },
  requiredStar: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  formInputField: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: COLORS.text,
  },
  discountContainer: {
    marginVertical: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  discountModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.sm,
    padding: 2,
  },
  discountModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
  },
  discountModeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  discountModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  discountModeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  discountInputNew: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    width: 90,
  },
  discountCalculatedSub: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
    marginLeft: 8,
  },
  cashNotePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cashNoteTextActive: {
    color: '#FFFFFF',
  },
  cashInputField: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  changeBannerSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  changeBannerSuccessText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  changeBannerWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  changeBannerWarningText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
});

export default BillingScreen;

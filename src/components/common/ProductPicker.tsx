/**
 * Orion POS Mobile Expo - Shared Product Picker Component
 *
 * Unified Product Selection Component used across Billing & Purchase:
 * - Real-time Indexed Search (by Name, SKU, Barcode)
 * - Category Filter Chips with Horizontal Scroll
 * - Virtualized Product Cards with Canonical Image Fallbacks & Stock Badges
 * - Contextual Mode:
 *   - 'sale': Highlights Selling Price & Cart Quantity Badges
 *   - 'purchase': Highlights Cost Price & Purchase Intake Quantity
 * - Integrated Barcode Scanner Trigger
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Product } from '../../types';
import { resolveImageUrl } from '../../utils/imageHelper';
import { inr } from '../../utils/format';
import { Badge, LoadingSpinner, COLORS, SPACING } from './UIComponents';

export interface ProductPickerProps {
  mode: 'sale' | 'purchase';
  products: Product[];
  isLoading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onScanBarcodePress?: () => void;
  onSelectProduct: (product: Product) => void;
  getItemQuantity?: (productId: number) => number;
  bottomPadding?: number;
}

export const ProductPicker: React.FC<ProductPickerProps> = ({
  mode,
  products,
  isLoading = false,
  searchQuery,
  onSearchChange,
  onScanBarcodePress,
  onSelectProduct,
  getItemQuantity,
  bottomPadding = 0,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <View style={styles.container}>
      {/* 1. Search Bar & Barcode Scanner */}
      <View style={styles.searchBarRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={mode === 'sale' ? 'Search name, SKU, or barcode...' : 'Search product to purchase...'}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholderTextColor={COLORS.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => onSearchChange('')}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
        {onScanBarcodePress && (
          <TouchableOpacity style={styles.scanBtn} onPress={onScanBarcodePress} activeOpacity={0.7}>
            <Text style={styles.scanBtnText}>📷 Scan</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Category Filter Chips */}
      <View style={styles.categoryScrollContainer}>
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

      {/* 3. Product Cards List */}
      {isLoading ? (
        <LoadingSpinner message="Searching product catalog..." />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            bottomPadding > 0 && { paddingBottom: bottomPadding },
          ]}
          renderItem={({ item }) => {
            const resolvedUri = resolveImageUrl(item.image_url || item.imageUrl);
            const inStock = item.stock > 0;
            const currentQty = getItemQuantity ? getItemQuantity(item.id) : 0;
            const sellingPrice = item.selling_price || item.price || 0;
            const costPrice = item.cost_price || 0;

            return (
              <TouchableOpacity
                style={[
                  styles.productCard,
                  !inStock && mode === 'sale' && styles.outOfStockCard,
                  currentQty > 0 && styles.activeCard,
                ]}
                onPress={() => onSelectProduct(item)}
                activeOpacity={0.7}
              >
                {resolvedUri ? (
                  <Image source={{ uri: resolvedUri }} style={styles.productThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.productThumbPlaceholder}>
                    <Text style={styles.productThumbIcon}>📦</Text>
                  </View>
                )}

                <View style={styles.productDetailsCol}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.productMetaRow}>
                    <Badge
                      label={inStock ? `Stock: ${item.stock}` : 'Out of Stock'}
                      variant={inStock ? (item.stock <= (item.min_stock_level || 5) ? 'warning' : 'success') : 'danger'}
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

                <View style={styles.priceActionCol}>
                  {mode === 'sale' ? (
                    <>
                      <Text style={styles.primaryPrice}>{inr(sellingPrice)}</Text>
                      {currentQty > 0 ? (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyBadgeText}>{currentQty} in cart</Text>
                        </View>
                      ) : (
                        <Text style={styles.addText}>+ Add</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.primaryPrice}>{inr(costPrice)}</Text>
                      <Text style={styles.subPriceText}>SP: {inr(sellingPrice)}</Text>
                      {currentQty > 0 ? (
                        <View style={[styles.qtyBadge, { backgroundColor: '#DBEAFE' }]}>
                          <Text style={[styles.qtyBadgeText, { color: '#1E40AF' }]}>{currentQty} added</Text>
                        </View>
                      ) : (
                        <Text style={styles.addText}>+ Select</Text>
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubText}>
                {searchQuery ? `No matching products for "${searchQuery}"` : 'No products available in this category.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: COLORS.text,
  },
  clearBtn: {
    position: 'absolute',
    right: 86,
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  scanBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 8,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  categoryScrollContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: SPACING.sm,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  activeCard: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  outOfStockCard: {
    opacity: 0.55,
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  productThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productThumbIcon: {
    fontSize: 22,
  },
  productDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  skuText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  priceActionCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  primaryPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  subPriceText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  qtyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
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

export default ProductPicker;

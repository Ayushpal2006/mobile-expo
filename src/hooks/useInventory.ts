/**
 * Orion POS Mobile Expo - useInventory Hook
 */

import { useState, useEffect, useCallback } from 'react';
import InventoryService from '../services/api/inventory.service';
import { StockAdjustment, Product } from '../types';
import { useAuth } from '../context/AuthContext';

export function useInventory() {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryData = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        if (options?.force) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);
        const [adjList, lowList] = await Promise.all([
          InventoryService.getStockAdjustments(storeId),
          InventoryService.getLowStockProducts(storeId),
        ]);
        setAdjustments(adjList);
        setLowStockProducts(lowList);
        return { adjList, lowList };
      } catch (err: any) {
        setError(err.message || 'Failed to load inventory data');
        return null;
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const adjustStock = async (
    productId: number,
    type: 'INCREASE' | 'DECREASE' | 'SET',
    quantity: number,
    reason: 'DAMAGED' | 'SPOILED' | 'RESTOCKED' | 'CORRECTION' | 'THEFT' | 'AUDIT' | 'OTHER',
    notes?: string
  ) => {
    const res = await InventoryService.adjustStock(
      productId,
      type,
      quantity,
      reason,
      notes,
      'Cashier',
      storeId
    );
    await fetchInventoryData({ force: true });
    return res;
  };

  return {
    adjustments,
    lowStockProducts,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchInventoryData,
    adjustStock,
  };
}

export default useInventory;

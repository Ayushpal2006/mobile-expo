/**
 * Orion POS Mobile Expo - Purchases Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import PurchaseService from '../services/api/purchase.service';
import { Purchase, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function usePurchases(): QueryState<Purchase[]> & {
  createPurchase: (
    supplierName: string,
    invoiceNumber: string | undefined,
    items: Array<{ productId?: number; productName: string; quantity: number; costPrice: number }>,
    totalAmount: number,
    supplierId?: number
  ) => Promise<Purchase>;
} {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<Purchase[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchases = useCallback(async (options?: { force?: boolean }): Promise<Purchase[] | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const list = await PurchaseService.getPurchases(storeId);
      setData(list);
      return list;
    } catch (err: any) {
      logger.error('[usePurchases] Fetch error:', err);
      setError(err.message || 'Failed to load purchases');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const createPurchase = async (
    supplierName: string,
    invoiceNumber: string | undefined,
    items: Array<{ productId?: number; productName: string; quantity: number; costPrice: number }>,
    totalAmount: number,
    supplierId?: number
  ): Promise<Purchase> => {
    const created = await PurchaseService.createPurchase(
      supplierName,
      invoiceNumber,
      items,
      totalAmount,
      supplierId,
      storeId
    );
    await fetchPurchases({ force: true });
    return created;
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchPurchases,
    createPurchase,
  };
}

export default usePurchases;


/**
 * Orion POS Mobile Expo - Sales & Checkout Hook
 */

import { useState, useEffect, useCallback } from 'react';
import SalesService from '../services/api/sales.service';
import { SaleInvoice, CheckoutPayload, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useSales(statusFilter?: string): QueryState<SaleInvoice[]> & {
  processCheckout: (payload: CheckoutPayload) => Promise<SaleInvoice>;
  voidSale: (saleIdOrInvoice: string | number, reason: string) => Promise<SaleInvoice | null>;
} {
  const { store, user } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<SaleInvoice[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async (options?: { force?: boolean }): Promise<SaleInvoice[] | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const list = await SalesService.getTodaySales(storeId);
      const filtered = statusFilter ? list.filter((s) => s.status === statusFilter) : list;
      setData(filtered);
      return filtered;
    } catch (err: any) {
      logger.error('[useSales] Fetch error:', err);
      setError(err.message || 'Failed to load sales history');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storeId, statusFilter]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const processCheckout = async (payload: CheckoutPayload): Promise<SaleInvoice> => {
    const invoice = await SalesService.processCheckout({ ...payload, storeId }, storeId);
    await fetchSales({ force: true });
    return invoice;
  };

  const voidSale = async (saleIdOrInvoice: string | number, reason: string): Promise<SaleInvoice | null> => {
    const voided = await SalesService.voidSale(saleIdOrInvoice, reason, user?.name || 'Cashier', storeId);
    await fetchSales({ force: true });
    return voided;
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchSales,
    processCheckout,
    voidSale,
  };
}

export default useSales;


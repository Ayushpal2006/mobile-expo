/**
 * Orion POS Mobile Expo - useSuppliers Hook
 */

import { useState, useEffect, useCallback } from 'react';
import SupplierService from '../services/api/supplier.service';
import { Supplier } from '../types';
import { useAuth } from '../context/AuthContext';

export function useSuppliers(searchQuery?: string) {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        if (options?.force) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);
        let list: Supplier[];
        if (searchQuery && searchQuery.trim().length > 0) {
          list = await SupplierService.searchSuppliers(searchQuery, storeId);
        } else {
          list = await SupplierService.getSuppliers(storeId);
        }
        setData(list);
        return list;
      } catch (err: any) {
        setError(err.message || 'Failed to load suppliers');
        return null;
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchQuery, storeId]
  );

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const createSupplier = async (payload: Partial<Supplier>) => {
    const created = await SupplierService.createOrUpdateSupplier(payload, storeId);
    await fetchSuppliers({ force: true });
    return created;
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchSuppliers,
    createSupplier,
  };
}

export default useSuppliers;

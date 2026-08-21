/**
 * Orion POS Mobile Expo - Product Domain Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import ProductService from '../services/api/product.service';
import { Product, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useProducts(searchQuery?: string): QueryState<Product[]> & {
  createProduct: (p: Partial<Product>) => Promise<Product>;
  updateProduct: (p: Partial<Product>) => Promise<Product>;
  archiveProduct: (id: number) => Promise<void>;
  restoreProduct: (id: number) => Promise<void>;
} {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<Product[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (options?: { force?: boolean }): Promise<Product[] | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const list = await ProductService.getProducts(searchQuery, storeId);
      setData(list);
      return list;
    } catch (err: any) {
      logger.error('[useProducts] Fetch error:', err);
      setError(err.message || 'Failed to load product catalog');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (product: Partial<Product>): Promise<Product> => {
    const created = await ProductService.createProduct(product, storeId);
    await fetchProducts({ force: true });
    return created;
  };

  const updateProduct = async (product: Partial<Product>): Promise<Product> => {
    const updated = await ProductService.updateProduct(product, storeId);
    await fetchProducts({ force: true });
    return updated;
  };

  const archiveProduct = async (id: number): Promise<void> => {
    await ProductService.archiveProduct(id, storeId);
    await fetchProducts({ force: true });
  };

  const restoreProduct = async (id: number): Promise<void> => {
    await ProductService.restoreProduct(id, storeId);
    await fetchProducts({ force: true });
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    archiveProduct,
    restoreProduct,
  };
}

export default useProducts;



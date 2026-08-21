/**
 * Orion POS Mobile Expo - Product Domain Service
 */

import { ProductRepository } from '../../database/repositories/product.repository';
import { apiClient } from './client';
import { Product } from '../../types';
import logger from '../../utils/logger';

export const ProductService = {
  async getProducts(searchQuery?: string, storeId: number = 1): Promise<Product[]> {
    if (searchQuery && searchQuery.trim().length > 0) {
      return ProductRepository.search(searchQuery, storeId);
    }

    const localProducts = await ProductRepository.getAll(storeId);
    if (localProducts.length > 0) {
      return localProducts;
    }

    // Fallback to API if local DB is empty
    try {
      const response = await apiClient.get<Product[]>('/api/products');
      const list = Array.isArray(response.data) ? response.data : [];
      if (list.length > 0) {
        await ProductRepository.insertBatch(list, storeId);
        return await ProductRepository.getAll(storeId);
      }
    } catch (err: any) {
      logger.warn('[ProductService] Server fetch failed, returning empty local list:', err.message);
    }
    return [];
  },

  async getByBarcode(code: string, storeId: number = 1): Promise<Product | null> {
    return ProductRepository.getByBarcode(code, storeId);
  },

  async createProduct(product: Partial<Product>, storeId: number = 1): Promise<Product> {
    const savedLocal = await ProductRepository.upsert(product, storeId);
    try {
      const response = await apiClient.post<Product>('/api/products', { ...product, store_id: storeId });
      if (response.data && response.data.id) {
        await ProductRepository.upsert({ ...savedLocal, server_id: response.data.id, sync_status: 'synced' }, storeId);
      }
    } catch (err: any) {
      logger.warn('[ProductService] Network product creation failed, saved locally as PENDING:', err.message);
    }
    return savedLocal;
  },

  async updateProduct(product: Partial<Product>, storeId: number = 1): Promise<Product> {
    return ProductRepository.upsert(product, storeId);
  },

  async archiveProduct(id: number, storeId: number = 1): Promise<void> {
    await ProductRepository.archiveProduct(id, storeId);
  },

  async restoreProduct(id: number, storeId: number = 1): Promise<void> {
    await ProductRepository.restoreProduct(id, storeId);
  },

  async uploadProductImage(productId: number, imageUri: string, storeId: number = 1): Promise<string> {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'product.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    let finalUrl = imageUri;
    try {
      const response = await apiClient.uploadFile<{ imageUrl?: string; data?: any; success?: boolean }>(
        `/api/products/${productId}/image`,
        formData
      );
      if (response.data?.imageUrl) {
        finalUrl = response.data.imageUrl;
      }
    } catch (err: any) {
      logger.warn('[ProductService] Product image upload to backend failed, saving local URI:', err.message);
    }

    await ProductRepository.upsert({ id: productId, image_url: finalUrl }, storeId);
    return finalUrl;
  },
};

export default ProductService;




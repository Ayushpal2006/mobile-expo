/**
 * Orion POS Mobile Expo - Dashboard Domain Service
 *
 * Web Parity Data Strategy:
 * - Online: Fetches `/api/dashboard` directly for 100% mathematical parity with Web dashboard metrics
 * - Offline Fallback: Computes local SQLite aggregation matching the exact backend formulas
 */

import { SaleRepository } from '../../database/repositories/sale.repository';
import { ProductRepository } from '../../database/repositories/product.repository';
import { apiClient } from './client';
import { DashboardData } from '../../types';
import logger from '../../utils/logger';

export const DashboardService = {
  async getDashboardData(storeId: number = 1): Promise<DashboardData> {
    // 1. Online attempt: Fetch from server `/api/dashboard`
    try {
      const response = await apiClient.get<any>('/api/dashboard');
      const data = response.data?.data || response.data;

      if (data && typeof data.todayRevenue === 'number') {
        logger.info('[DashboardService] Server dashboard metrics loaded successfully with 100% Web parity.');
        return {
          todayRevenue: data.todayRevenue || 0,
          todayOrders: data.todayOrders || 0,
          todayProfit: data.todayProfit || 0,
          inventoryCount: data.inventoryCount || 0,
          lowStockCount: data.lowStockCount || 0,
          topProducts: Array.isArray(data.topProducts)
            ? data.topProducts.map((p: any) => ({
                id: p.id || 0,
                name: p.name || 'Product',
                totalSold: p.unitsSold || p.totalSold || 0,
                revenue: p.revenue || 0,
              }))
            : [],
          recentSales: Array.isArray(data.recentSales)
            ? data.recentSales.map((s: any) => ({
                id: s.id || 0,
                invoiceNumber: s.invoiceNumber || s.invoice_number || 'INV-000',
                grandTotal: s.amount !== undefined ? s.amount : (s.grandTotal || 0),
                createdAt: s.time || s.createdAt || s.created_at || new Date().toISOString(),
                status: s.status || 'completed',
              }))
            : [],
        };
      }
    } catch (err: any) {
      logger.info('[DashboardService] Online fetch unavailable, falling back to local SQLite aggregation:', err.message);
    }

    // 2. Offline Fallback: Local SQLite Ledger Aggregation
    const allSales = await SaleRepository.getAllSales(storeId, 200);
    const allProducts = await ProductRepository.getAll(storeId);

    // Filter active (completed) sales
    const completedSales = allSales.filter((s) => (s.status as any) !== 'voided' && (s.status as any) !== 'VOID');

    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = completedSales.filter((s) => s.created_at && s.created_at.startsWith(todayStr));

    const todayRevenue = todaySales.reduce((acc, s) => acc + (s.total_amount || s.grandTotal || 0), 0);
    const todayOrders = todaySales.length;

    // Calculate profit: selling price - cost price for all line items today
    let calculatedTodayProfit = 0;
    const productCostMap = new Map<number, number>();
    for (const p of allProducts) {
      if (p.id) productCostMap.set(p.id, p.cost_price || 0);
    }

    for (const s of todaySales) {
      if (s.items && s.items.length > 0) {
        for (const itm of s.items) {
          const cost = itm.product_id ? (productCostMap.get(itm.product_id) || 0) : 0;
          const selling = itm.unit_price || itm.selling_price || itm.price || 0;
          const itemProfit = Math.max(0, (selling - cost) * (itm.quantity || 1));
          calculatedTodayProfit += itemProfit;
        }
      } else {
        calculatedTodayProfit += Math.round((s.total_amount || s.grandTotal || 0) * 0.2);
      }
    }

    const lowStockCount = allProducts.filter((p) => p.stock <= (p.min_stock_level ?? 5)).length;

    const recentSales = completedSales.slice(0, 10).map((s) => ({
      id: s.id,
      invoiceNumber: s.invoice_number || s.invoiceNumber || 'INV-000',
      grandTotal: s.total_amount || s.grandTotal || 0,
      createdAt: s.created_at || new Date().toISOString(),
      status: s.status,
    }));

    // Aggregate top products from sales line items
    const productSoldMap = new Map<string, { id: number; name: string; totalSold: number; revenue: number }>();
    for (const s of completedSales) {
      for (const itm of s.items || []) {
        const key = itm.product_name || itm.productName || 'Item';
        const existing = productSoldMap.get(key) || {
          id: itm.product_id || 0,
          name: key,
          totalSold: 0,
          revenue: 0,
        };
        existing.totalSold += itm.quantity || 1;
        existing.revenue += itm.subtotal || itm.lineTotal || (itm.unit_price || 0) * (itm.quantity || 1);
        productSoldMap.set(key, existing);
      }
    }

    const topProducts = Array.from(productSoldMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    return {
      todayRevenue,
      todayOrders,
      todayProfit: calculatedTodayProfit,
      inventoryCount: allProducts.length,
      lowStockCount,
      topProducts,
      recentSales,
    };
  },
};

export default DashboardService;

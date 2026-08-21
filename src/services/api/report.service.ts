/**
 * Orion POS Mobile Expo - Report Domain Service
 *
 * Provides aggregated financial KPIs, GST Slabs, P&L Metrics, and
 * multi-format export pipelines (PDF, Excel, CSV) via modern Expo FileSystem (SDK 54) & Sharing.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SaleRepository } from '../../database/repositories/sale.repository';
import { ProductRepository } from '../../database/repositories/product.repository';
import { ExpenseRepository } from '../../database/repositories/expense.repository';
import { PurchaseRepository } from '../../database/repositories/purchase.repository';
import { apiClient } from './client';
import { ReportData } from '../../types';
import logger from '../../utils/logger';

export interface GstSlabSummary {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export interface TopProductItem {
  id?: number;
  name: string;
  sku?: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

export interface TopCustomerItem {
  id?: number;
  name: string;
  phone?: string;
  orderCount: number;
  totalSpent: number;
}

export interface DetailedReportData extends ReportData {
  grossProfit: number;
  profitMargin: number;
  totalPurchases: number;
  gstSlabs: GstSlabSummary[];
  topProducts: TopProductItem[];
  topCustomers: TopCustomerItem[];
  salesList: any[];
}

export const ReportService = {
  async getReportsData(
    filter: 'today' | 'yesterday' | '7days' | 'month' | 'custom' = 'today',
    storeId: number = 1,
    customStart?: string,
    customEnd?: string
  ): Promise<DetailedReportData> {
    const allSales = await SaleRepository.getAllSales(storeId, 2000);
    const allProducts = await ProductRepository.getAll(storeId);
    const allExpenses = await ExpenseRepository.getAll(storeId);
    const allPurchases = await PurchaseRepository.getAll(storeId);

    const productMap = new Map<number, any>();
    for (const p of allProducts) {
      if (p.id) {
        productMap.set(p.id, p);
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const completedSales = allSales.filter((s) => s.status !== 'voided');

    const filteredSales = completedSales.filter((s) => {
      if (!s.created_at) return false;
      const saleDateStr = s.created_at.split('T')[0];

      if (filter === 'today') return saleDateStr === todayStr;
      if (filter === 'yesterday') return saleDateStr === yesterdayStr;
      if (filter === '7days') return new Date(s.created_at) >= sevenDaysAgoDate;
      if (filter === 'month') return saleDateStr >= monthStartStr;
      if (filter === 'custom' && customStart && customEnd) {
        return saleDateStr >= customStart && saleDateStr <= customEnd;
      }
      return true;
    });

    const filteredExpenses = allExpenses.filter((e) => {
      if (!e.date) return false;
      const expDateStr = e.date.split('T')[0];

      if (filter === 'today') return expDateStr === todayStr;
      if (filter === 'yesterday') return expDateStr === yesterdayStr;
      if (filter === '7days') return new Date(e.date) >= sevenDaysAgoDate;
      if (filter === 'month') return expDateStr >= monthStartStr;
      if (filter === 'custom' && customStart && customEnd) {
        return expDateStr >= customStart && expDateStr <= customEnd;
      }
      return true;
    });

    const filteredPurchases = allPurchases.filter((p) => {
      if (!p.created_at) return false;
      const purDateStr = p.created_at.split('T')[0];

      if (filter === 'today') return purDateStr === todayStr;
      if (filter === 'yesterday') return purDateStr === yesterdayStr;
      if (filter === '7days') return new Date(p.created_at) >= sevenDaysAgoDate;
      if (filter === 'month') return purDateStr >= monthStartStr;
      if (filter === 'custom' && customStart && customEnd) {
        return purDateStr >= customStart && purDateStr <= customEnd;
      }
      return true;
    });

    const totalRevenue = filteredSales.reduce((acc, s) => acc + (s.total_amount || s.grandTotal || 0), 0);
    const totalGst = filteredSales.reduce((acc, s) => acc + (s.tax || s.gst || 0), 0);
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalPurchases = filteredPurchases.reduce((acc, p) => acc + (p.total_amount || 0), 0);

    // GST Slabs tracking: 0%, 5%, 12%, 18%, 28%
    const gstSlabMap = new Map<number, { taxable: number; tax: number }>();
    [0, 5, 12, 18, 28].forEach((rate) => gstSlabMap.set(rate, { taxable: 0, tax: 0 }));

    // Product breakdown
    const productStatsMap = new Map<string, TopProductItem>();
    // Customer breakdown
    const customerStatsMap = new Map<string, TopCustomerItem>();

    let totalCogs = 0;
    const categoryMap = new Map<string, { category: string; count: number; revenue: number }>();
    const paymentMap = new Map<string, { method: string; count: number; total: number }>();

    for (const s of filteredSales) {
      // Payment breakdown
      const method = (s.payment_method || s.paymentMethod || 'Cash').toUpperCase();
      const existingPay = paymentMap.get(method) || { method, count: 0, total: 0 };
      existingPay.count += 1;
      existingPay.total += s.total_amount || s.grandTotal || 0;
      paymentMap.set(method, existingPay);

      // Customer stats
      const custKey = s.customer_phone || s.customer_name || 'Walk-in Customer';
      const existingCust = customerStatsMap.get(custKey) || {
        id: s.customer_id,
        name: s.customer_name || 'Walk-in Customer',
        phone: s.customer_phone || undefined,
        orderCount: 0,
        totalSpent: 0,
      };
      existingCust.orderCount += 1;
      existingCust.totalSpent += s.total_amount || s.grandTotal || 0;
      customerStatsMap.set(custKey, existingCust);

      // Line items analysis
      let itemsList: any[] = [];
      try {
        if (s.items && typeof s.items === 'string') {
          itemsList = JSON.parse(s.items);
        } else if (Array.isArray(s.items)) {
          itemsList = s.items;
        }
      } catch {}

      for (const item of itemsList) {
        const prodName = item.product_name || item.name || 'Custom Product';
        const qty = item.quantity || 1;
        const rev = (item.unit_price || item.price || 0) * qty;

        const dbProd = item.product_id ? productMap.get(item.product_id) : null;
        const costPrice = dbProd?.cost_price || dbProd?.costPrice || (item.unit_price || 0) * 0.7;
        const itemCogs = costPrice * qty;
        totalCogs += itemCogs;
        const itemProfit = rev - itemCogs;

        const existingProd = productStatsMap.get(prodName) || {
          id: item.product_id,
          name: prodName,
          sku: dbProd?.sku || undefined,
          quantitySold: 0,
          revenue: 0,
          profit: 0,
        };
        existingProd.quantitySold += qty;
        existingProd.revenue += rev;
        existingProd.profit += itemProfit;
        productStatsMap.set(prodName, existingProd);

        // Category breakdown
        const cat = dbProd?.category || 'General';
        const existingCat = categoryMap.get(cat) || { category: cat, count: 0, revenue: 0 };
        existingCat.count += qty;
        existingCat.revenue += rev;
        categoryMap.set(cat, existingCat);

        // Slab rate computation
        const slabRate = item.tax_rate !== undefined ? item.tax_rate : 18;
        const currentSlab = gstSlabMap.get(slabRate) || { taxable: 0, tax: 0 };
        const taxable = rev / (1 + slabRate / 100);
        const taxVal = rev - taxable;
        currentSlab.taxable += taxable;
        currentSlab.tax += taxVal;
        gstSlabMap.set(slabRate, currentSlab);
      }
    }

    const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
    const paymentBreakdown = Array.from(paymentMap.values()).sort((a, b) => b.total - a.total);
    const topProducts = Array.from(productStatsMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
    const topCustomers = Array.from(customerStatsMap.values())
      .filter((c) => c.name !== 'Walk-in Customer')
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 15);

    const gstSlabs: GstSlabSummary[] = Array.from(gstSlabMap.entries())
      .filter(([_, data]) => data.taxable > 0 || data.tax > 0)
      .map(([rate, data]) => ({
        rate,
        taxableAmount: data.taxable,
        cgst: data.tax / 2,
        sgst: data.tax / 2,
        igst: 0,
        totalTax: data.tax,
      }));

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;

    return {
      todayRevenue: totalRevenue,
      totalSales: totalRevenue,
      totalRevenue,
      totalGstCollected: totalGst,
      todayOrdersCount: filteredSales.length,
      totalOrdersCount: filteredSales.length,
      totalExpenses,
      totalPurchases,
      grossProfit,
      netProfit,
      profitMargin,
      topCategories,
      paymentBreakdown,
      topProducts,
      topCustomers,
      gstSlabs,
      salesList: filteredSales,
    };
  },

  /**
   * Export Reports to PDF/Excel or local CSV via modern Expo SDK 54 FileSystem & Sharing
   */
  async exportReport(
    format: 'pdf' | 'excel' | 'csv',
    filter: 'today' | 'yesterday' | '7days' | 'month' | 'custom' = 'today',
    storeId: number = 1,
    customStart?: string,
    customEnd?: string
  ): Promise<boolean> {
    try {
      const data = await ReportService.getReportsData(filter, storeId, customStart, customEnd);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Report_${filter}_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
      const file = new File(Paths.cache, filename);

      if (format === 'csv') {
        // Generate complete structured CSV locally
        let csv = `Apka Bill POS Sales Report - ${filter.toUpperCase()}\n`;
        csv += `Generated At: ${new Date().toLocaleString('en-IN')}\n\n`;
        csv += `KPI SUMMARY\n`;
        csv += `Total Revenue,₹${data.totalRevenue}\n`;
        csv += `Total GST Collected,₹${data.totalGstCollected}\n`;
        csv += `Total Orders,${data.totalOrdersCount}\n`;
        csv += `Total Expenses,₹${data.totalExpenses}\n`;
        csv += `Total Purchases,₹${data.totalPurchases}\n`;
        csv += `Gross Profit,₹${data.grossProfit}\n`;
        csv += `Net Profit,₹${data.netProfit}\n`;
        csv += `Net Margin,${data.profitMargin}%\n\n`;

        csv += `GST BREAKDOWN\n`;
        csv += `GST Rate,Taxable Value,CGST,SGST,Total GST\n`;
        for (const slab of data.gstSlabs) {
          csv += `${slab.rate}%,₹${slab.taxableAmount.toFixed(2)},₹${slab.cgst.toFixed(2)},₹${slab.sgst.toFixed(2)},₹${slab.totalTax.toFixed(2)}\n`;
        }

        csv += `\nTOP PRODUCTS\n`;
        csv += `Product Name,SKU,Quantity Sold,Revenue,Profit\n`;
        for (const p of data.topProducts) {
          csv += `"${p.name}",${p.sku || 'N/A'},${p.quantitySold},₹${p.revenue.toFixed(2)},₹${p.profit.toFixed(2)}\n`;
        }

        csv += `\nINVOICE DETAILS\n`;
        csv += `Invoice Number,Date,Customer Name,Customer Phone,Payment Method,Total Amount,Status\n`;
        for (const s of data.salesList) {
          csv += `${s.invoice_number},${s.created_at},"${s.customer_name || 'Walk-in'}",${s.customer_phone || 'N/A'},${s.payment_method || 'Cash'},₹${(s.total_amount || s.grandTotal || 0).toFixed(2)},${s.status}\n`;
        }

        file.create({ overwrite: true });
        file.write(csv);
      } else {
        // Try backend PDF/Excel export endpoint first
        try {
          const endpoint = format === 'pdf' ? '/api/reports/pdf' : '/api/reports/excel';
          const downloadUrl = `${apiClient.getBaseUrl()}${endpoint}?filter=${filter}${customStart ? `&startDate=${customStart}` : ''}${customEnd ? `&endDate=${customEnd}` : ''}`;
          
          await File.downloadFileAsync(downloadUrl, file, {
            headers: {
              ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
              'X-Store-Id': String(storeId),
            },
          });
        } catch (serverErr: any) {
          logger.warn(`[ReportService] Backend ${format.toUpperCase()} export unavailable, falling back to local CSV:`, serverErr.message);
          return await ReportService.exportReport('csv', filter, storeId, customStart, customEnd);
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'pdf' ? 'application/pdf' : format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
          dialogTitle: `Export Report - ${filter.toUpperCase()}`,
        });
        return true;
      } else {
        logger.info('[ReportService] File saved to cache:', file.uri);
        return true;
      }
    } catch (err: any) {
      const errorTelemetry = {
        format,
        filter,
        storeId,
        message: err?.message || String(err),
        stack: err?.stack || 'N/A',
        status: err?.status || err?.statusCode || 'N/A',
      };
      logger.error(`[ReportService] Export error [${format.toUpperCase()}]: ${errorTelemetry.message}`, errorTelemetry);
      throw new Error(`Export Failed: ${errorTelemetry.message}`);
    }
  },
};

export default ReportService;

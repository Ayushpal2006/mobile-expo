/**
 * Orion POS Mobile Expo - POS Service Facade (Delegates to domain services)
 */

import ProductService from './product.service';
import CustomerService from './customer.service';
import SalesService from './sales.service';
import DashboardService from './dashboard.service';
import SettingsService from './settings.service';
import PurchaseService from './purchase.service';
import ReportService from './report.service';

export const PosService = {
  getDashboardData: DashboardService.getDashboardData,
  getProducts: ProductService.getProducts,
  getByBarcode: ProductService.getByBarcode,
  createProduct: ProductService.createProduct,
  updateProduct: ProductService.updateProduct,
  getCustomers: CustomerService.getCustomers,
  createCustomer: CustomerService.createCustomer,
  getCustomerInvoices: CustomerService.getCustomerInvoices,
  processCheckout: SalesService.processCheckout,
  getTodaySales: SalesService.getTodaySales,
  getSaleById: SalesService.getSaleById,
  getPurchases: PurchaseService.getPurchases,
  createPurchase: PurchaseService.createPurchase,
  getReportsData: ReportService.getReportsData,
  getSettings: SettingsService.getSettings,
  updateSettings: SettingsService.updateSettings,
};

export default PosService;

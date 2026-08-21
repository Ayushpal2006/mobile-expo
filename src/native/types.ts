/**
 * Orion POS Mobile Expo - Hardware Abstraction Interfaces
 */

export type HardwareStatus = 'READY' | 'NOT_INITIALIZED' | 'NOT_DETECTED' | 'UNSUPPORTED';
export type PrinterStatus = 'READY' | 'NOT_AVAILABLE' | 'NOT_CONNECTED' | 'PAPER_OUT' | 'BUSY' | 'ERROR' | 'UNSUPPORTED';
export type PrinterType = 'BUILT_IN' | 'BLUETOOTH' | 'USB' | 'NETWORK' | 'AUTOREPLYPRINT' | 'MOCK';

export interface HardwareCapabilities {
  manufacturer: string;
  model: string;
  device: string;
  brand: string;
  sdkVersion: number;
  isPOSHardware: boolean;
  hasCamera: boolean;
  hasUsbHost: boolean;
  hasBluetooth: boolean;
  printerStatus: HardwareStatus;
  scannerStatus: HardwareStatus;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptPrintData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  website?: string;
  upiId?: string;
  invoiceNumber: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  status?: string;
  footerText?: string;
  qrData?: string;
  paperWidth?: '58mm' | '80mm';
}


export interface ReceiptPayload {
  invoiceNumber?: string;
  storeName?: string;
  formattedText?: string;
  data?: ReceiptPrintData;
  [key: string]: any;
}

export interface PrintResult {
  success: boolean;
  status: PrinterStatus;
  error?: string;
  bytesPrinted?: number;
  formattedText?: string;
}

export interface IPrinterDriver {
  type: PrinterType;
  name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<PrinterStatus>;
  printReceipt(payload: ReceiptPayload): Promise<PrintResult>;
}

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  connected: boolean;
}

export interface UsbDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  connected: boolean;
}

export interface PermissionStatus {
  camera: boolean;
  bluetooth: boolean;
  location: boolean;
}

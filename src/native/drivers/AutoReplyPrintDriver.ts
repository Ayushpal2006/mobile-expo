/**
 * Apka Bill POS - AutoReplyPrint Enterprise Hardware Driver
 *
 * Implements IPrinterDriver via the native AutoReplyPrint Android SDK.
 * Supports Bluetooth SPP, Bluetooth BLE, USB, and Network (TCP/IP) 55mm/58mm/80mm thermal receipt printers.
 */

import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult, ReceiptPrintData } from '../types';
import AutoReplyPrintNative, { DiscoveredPrinter } from '../../../modules/autoreplyprint';
import ReceiptFormatter from '../utils/ReceiptFormatter';
import logger from '../../utils/logger';

export class AutoReplyPrintDriver implements IPrinterDriver {
  type: PrinterType = 'BLUETOOTH';
  name = 'AutoReplyPrint Native Thermal Driver';

  private connectedAddress: string | null = null;
  private connectionType: 'BLUETOOTH' | 'BLE' | 'USB' | 'NETWORK' = 'BLUETOOTH';
  private paperWidth: '58mm' | '80mm' = '58mm';
  private isConnected: boolean = false;

  setTargetPrinter(address: string, type: 'BLUETOOTH' | 'BLE' | 'USB' | 'NETWORK' = 'BLUETOOTH', paperWidth: '58mm' | '80mm' = '58mm') {
    this.connectedAddress = address;
    this.connectionType = type;
    this.paperWidth = paperWidth;
  }

  isAvailableSync(): boolean {
    return AutoReplyPrintNative.isAvailable();
  }

  async isAvailable(): Promise<boolean> {
    return AutoReplyPrintNative.isAvailable();
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!AutoReplyPrintNative.isAvailable()) {
      return 'UNSUPPORTED';
    }

    if (!this.connectedAddress) {
      return 'NOT_CONNECTED';
    }

    try {
      const nativeStatus = await AutoReplyPrintNative.getPrinterStatus();
      if (nativeStatus.noPaper) return 'PAPER_OUT';
      if (nativeStatus.coverUp) return 'ERROR';
      if (nativeStatus.status === 'READY') return 'READY';
      if (nativeStatus.status === 'NOT_CONNECTED') return 'NOT_CONNECTED';
      return 'READY';
    } catch {
      return 'NOT_CONNECTED';
    }
  }

  /**
   * Connect to target printer via native SDK if not already connected
   */
  async ensureConnected(): Promise<boolean> {
    if (!this.connectedAddress) {
      throw new Error('PRINTER_NOT_FOUND: No printer address configured.');
    }

    try {
      const res = await AutoReplyPrintNative.connectPrinter(this.connectionType, this.connectedAddress, 9100);
      this.isConnected = res.connected;
      return this.isConnected;
    } catch (err: any) {
      logger.warn(`[AutoReplyPrintDriver] Connection attempt to ${this.connectedAddress} failed:`, err.message);
      this.isConnected = false;
      throw new Error(`CONNECTION_FAILED: Could not connect to printer (${this.connectedAddress}).`);
    }
  }

  /**
   * Disconnect active printer handle
   */
  async disconnect(): Promise<void> {
    try {
      await AutoReplyPrintNative.disconnectPrinter();
      this.isConnected = false;
    } catch {}
  }

  /**
   * Prints complete structured POS receipt with item list, totals, GST, and QR code
   */
  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    if (!AutoReplyPrintNative.isAvailable()) {
      // Fallback for development / mock environments
      const formatted = ReceiptFormatter.formatReceipt(payload);
      logger.info(`[AutoReplyPrintDriver -> Fallback Console] ${formatted}`);
      return {
        success: true,
        status: 'READY',
        bytesPrinted: formatted.length,
        formattedText: formatted,
      };
    }

    if (!this.connectedAddress) {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'PRINTER_NOT_FOUND: Please select and configure a printer in Settings.',
      };
    }

    try {
      // 1. Ensure connection
      await this.ensureConnected();

      // 2. Print via Native POS SDK
      if (payload.data) {
        const nativeRes = await AutoReplyPrintNative.printReceipt(payload.data, this.paperWidth);
        return {
          success: nativeRes.success,
          status: nativeRes.printed ? 'READY' : 'ERROR',
          bytesPrinted: 500,
          formattedText: ReceiptFormatter.formatText(payload.data, this.paperWidth),
        };
      } else {
        const text = ReceiptFormatter.formatReceipt(payload);
        const ok = await AutoReplyPrintNative.printText(text + '\n\n\n');
        return {
          success: ok,
          status: ok ? 'READY' : 'ERROR',
          bytesPrinted: text.length,
          formattedText: text,
        };
      }
    } catch (err: any) {
      logger.warn('[AutoReplyPrintDriver] Print execution error:', err.message);
      return {
        success: false,
        status: 'ERROR',
        error: err.message || 'PRINT_FAILED: Printer communication error.',
      };
    }
  }

  /**
   * Real hardware self-test print ticket
   */
  async testPrint(type: string, address: string, paperWidth: '58mm' | '80mm' = '58mm'): Promise<PrintResult> {
    if (!AutoReplyPrintNative.isAvailable()) {
      return {
        success: true,
        status: 'READY',
        bytesPrinted: 100,
        formattedText: 'Self-Test Ticket: Mock Success',
      };
    }

    try {
      const res = await AutoReplyPrintNative.testPrint(type, address, paperWidth);
      return {
        success: res.success,
        status: res.printed ? 'READY' : 'ERROR',
        bytesPrinted: 150,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'ERROR',
        error: err.message || 'TEST_PRINT_FAILED',
      };
    }
  }

  /**
   * Discover nearby printers using native AutoReplyPrint SDK
   */
  async scanPrinters(type: 'BLUETOOTH' | 'BLE' | 'USB' | 'NETWORK' = 'BLUETOOTH'): Promise<DiscoveredPrinter[]> {
    if (!AutoReplyPrintNative.isAvailable()) {
      return [];
    }

    switch (type) {
      case 'BLUETOOTH':
        return await AutoReplyPrintNative.discoverBluetoothPrinters(8000);
      case 'BLE':
        return await AutoReplyPrintNative.discoverBlePrinters(10000);
      case 'USB':
        return await AutoReplyPrintNative.discoverUsbPrinters();
      case 'NETWORK':
        return await AutoReplyPrintNative.discoverNetworkPrinters(3000);
      default:
        return await AutoReplyPrintNative.discoverBluetoothPrinters(8000);
    }
  }
}

export const autoReplyPrintDriver = new AutoReplyPrintDriver();
export default AutoReplyPrintDriver;

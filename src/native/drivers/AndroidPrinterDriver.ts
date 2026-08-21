/**
 * Orion POS Mobile Expo - Native Android Built-in POS Thermal Printer Driver
 *
 * Connects to Sunmi/iMin AIDL native bridge if present.
 * If unlinked, truthfully reports isAvailable: false and status: UNSUPPORTED.
 */

import { NativeModules, Platform } from 'react-native';
import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import ReceiptFormatter from '../utils/ReceiptFormatter';

const { PrinterModule } = NativeModules;

export class AndroidPrinterDriver implements IPrinterDriver {
  type: PrinterType = 'BUILT_IN';
  name = 'Embedded Android POS Printer';

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!PrinterModule) return false;
    try {
      return await PrinterModule.isAvailable();
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    if (Platform.OS !== 'android' || !PrinterModule) return 'UNSUPPORTED';
    try {
      const statusStr = await PrinterModule.getStatus();
      return (statusStr as PrinterStatus) || 'UNSUPPORTED';
    } catch {
      return 'NOT_CONNECTED';
    }
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const formatted = ReceiptFormatter.formatReceipt(payload);

    if (Platform.OS !== 'android' || !PrinterModule) {
      return {
        success: false,
        status: 'UNSUPPORTED',
        error: 'HARDWARE_UNAVAILABLE: Built-in Android POS printer module is not linked on this device.',
      };
    }

    try {
      await PrinterModule.printText(formatted);
      return { success: true, status: 'READY', bytesPrinted: formatted.length, formattedText: formatted };
    } catch (err: any) {
      return {
        success: false,
        status: 'ERROR',
        error: err?.message || 'Native thermal printer execution failed',
      };
    }
  }
}

export default AndroidPrinterDriver;

/**
 * AutoReplyPrint Native Module TypeScript Bridge
 *
 * Implements safe, defensive native module resolution for Expo SDK 54.
 * Top-level evaluation NEVER throws, ensuring the application bundle loads
 * cleanly across Expo Go, Standalone APK, Simulators, and Web environments.
 */

import { ReceiptPrintData } from '../../src/native/types';

export interface DiscoveredPrinter {
  id: string;
  name: string;
  address: string;
  type: 'BLUETOOTH' | 'BLE' | 'USB' | 'NETWORK';
  connectionType: string;
  mac?: string;
}

export interface NativePrinterStatus {
  status: 'READY' | 'PAPER_OUT' | 'COVER_OPEN' | 'NOT_CONNECTED' | 'ERROR';
  connected: boolean;
  rawStatus?: number;
  noPaper?: boolean;
  coverUp?: boolean;
  message?: string;
  error?: string;
}

// Lazy native module reference — resolved on-demand without top-level side effects
let cachedNativeModule: any = undefined;

function getNativeModule(): any {
  if (cachedNativeModule !== undefined) {
    return cachedNativeModule;
  }

  try {
    // Dynamic / optional module resolution to prevent startup crash if module is absent
    const expoModules = require('expo-modules-core');
    if (typeof expoModules.requireOptionalNativeModule === 'function') {
      cachedNativeModule = expoModules.requireOptionalNativeModule('AutoReplyPrint') || null;
    } else if (typeof expoModules.requireNativeModule === 'function') {
      try {
        cachedNativeModule = expoModules.requireNativeModule('AutoReplyPrint') || null;
      } catch {
        cachedNativeModule = null;
      }
    } else {
      cachedNativeModule = null;
    }
  } catch {
    cachedNativeModule = null;
  }

  return cachedNativeModule;
}

export const AutoReplyPrintNative = {
  isAvailable(): boolean {
    try {
      return Boolean(getNativeModule());
    } catch {
      return false;
    }
  },

  async discoverBluetoothPrinters(timeoutMs: number = 10000): Promise<DiscoveredPrinter[]> {
    const mod = getNativeModule();
    if (!mod) return [];
    try {
      return await mod.discoverBluetoothPrinters(timeoutMs);
    } catch (err: any) {
      console.warn('[AutoReplyPrintNative] discoverBluetoothPrinters error:', err?.message || err);
      return [];
    }
  },

  async discoverBlePrinters(timeoutMs: number = 15000): Promise<DiscoveredPrinter[]> {
    const mod = getNativeModule();
    if (!mod) return [];
    try {
      return await mod.discoverBlePrinters(timeoutMs);
    } catch (err: any) {
      console.warn('[AutoReplyPrintNative] discoverBlePrinters error:', err?.message || err);
      return [];
    }
  },

  async discoverUsbPrinters(): Promise<DiscoveredPrinter[]> {
    const mod = getNativeModule();
    if (!mod) return [];
    try {
      return await mod.discoverUsbPrinters();
    } catch (err: any) {
      console.warn('[AutoReplyPrintNative] discoverUsbPrinters error:', err?.message || err);
      return [];
    }
  },

  async discoverNetworkPrinters(timeoutMs: number = 3000): Promise<DiscoveredPrinter[]> {
    const mod = getNativeModule();
    if (!mod) return [];
    try {
      return await mod.discoverNetworkPrinters(timeoutMs);
    } catch (err: any) {
      console.warn('[AutoReplyPrintNative] discoverNetworkPrinters error:', err?.message || err);
      return [];
    }
  },

  async connectPrinter(type: string, address: string, port: number = 9100): Promise<{ success: boolean; connected: boolean }> {
    const mod = getNativeModule();
    if (!mod) {
      return { success: false, connected: false };
    }
    try {
      return await mod.connectPrinter(type, address, port);
    } catch (err: any) {
      return { success: false, connected: false };
    }
  },

  async disconnectPrinter(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) return true;
    try {
      return await mod.disconnectPrinter();
    } catch {
      return true;
    }
  },

  async getPrinterStatus(): Promise<NativePrinterStatus> {
    const mod = getNativeModule();
    if (!mod) return { status: 'NOT_CONNECTED', connected: false };
    try {
      return await mod.getPrinterStatus();
    } catch {
      return { status: 'NOT_CONNECTED', connected: false };
    }
  },

  async printText(text: string): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) {
      return false;
    }
    try {
      return await mod.printText(text);
    } catch {
      return false;
    }
  },

  async printQRCode(data: string, size: number = 3): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) {
      return false;
    }
    try {
      return await mod.printQRCode(data, size);
    } catch {
      return false;
    }
  },

  async printBarcode(data: string, barcodeType: number = 73): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) {
      return false;
    }
    try {
      return await mod.printBarcode(data, barcodeType);
    } catch {
      return false;
    }
  },

  async printReceipt(receipt: ReceiptPrintData, paperWidth: '58mm' | '80mm' = '58mm'): Promise<any> {
    const mod = getNativeModule();
    if (!mod) {
      return { success: false, printed: false, error: 'AutoReplyPrint native module is not available on this device.' };
    }
    try {
      return await mod.printReceipt(JSON.stringify(receipt), paperWidth);
    } catch (err: any) {
      return { success: false, printed: false, error: err?.message || 'Print failed.' };
    }
  },

  async cutPaper(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) return false;
    try {
      return await mod.cutPaper();
    } catch {
      return false;
    }
  },

  async feedAndCutPaper(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod) return false;
    try {
      return await mod.feedAndCutPaper();
    } catch {
      return false;
    }
  },

  async testPrint(type: string, address: string, paperWidth: '58mm' | '80mm' = '58mm'): Promise<any> {
    const mod = getNativeModule();
    if (!mod) {
      return { success: false, printed: false, error: 'AutoReplyPrint native module is not available on this device.' };
    }
    try {
      return await mod.testPrint(type, address, paperWidth);
    } catch (err: any) {
      return { success: false, printed: false, error: err?.message || 'Test print failed.' };
    }
  },
};

export default AutoReplyPrintNative;

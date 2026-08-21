/**
 * Apka Bill Mobile Expo - Enterprise Printer Service & Profile Manager
 *
 * Production Printer Architecture:
 * - Persistent saved printer profiles stored locally
 * - Configured Default Printer auto-routing: Checkout prints directly without asking every time
 * - Real Hardware Priority: AutoReplyPrint (Bluetooth SPP/BLE, USB OTG, Network)
 * - MOCK driver is NEVER active by default in production.
 * - Non-blocking execution: printer disconnect/paper-out NEVER rolls back POS transactions
 */

import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import MockPrinterDriver from '../drivers/MockPrinterDriver';
import AndroidPrinterDriver from '../drivers/AndroidPrinterDriver';
import BluetoothPrinterDriver from '../drivers/BluetoothPrinterDriver';
import UsbPrinterDriver from '../drivers/UsbPrinterDriver';
import AutoReplyPrintDriver from '../drivers/AutoReplyPrintDriver';
import { SettingsRepository } from '../../database/repositories/settings.repository';
import logger from '../../utils/logger';

export interface PrinterProfile {
  id: string;
  name: string;
  type: PrinterType;
  address?: string; // Bluetooth MAC or USB/Network identifier
  paperWidth: '58mm' | '80mm';
  isDefault: boolean;
}

class PrinterServiceManager {
  private activeDriver: IPrinterDriver;
  private drivers: Record<PrinterType, IPrinterDriver>;
  private defaultProfile: PrinterProfile | null = null;
  private autoReplyDriver: AutoReplyPrintDriver;

  constructor() {
    const mock = new MockPrinterDriver();
    const android = new AndroidPrinterDriver();
    const bt = new BluetoothPrinterDriver();
    const usb = new UsbPrinterDriver();
    const autoReply = new AutoReplyPrintDriver();

    this.autoReplyDriver = autoReply;

    this.drivers = {
      MOCK: mock,
      BUILT_IN: android,
      BLUETOOTH: autoReply, // Route standard Bluetooth via AutoReplyPrint SDK
      USB: autoReply,       // Route USB via AutoReplyPrint SDK
      NETWORK: autoReply,   // Route Network via AutoReplyPrint SDK
      AUTOREPLYPRINT: autoReply,
    };

    // Default to real native hardware driver
    this.activeDriver = autoReply;
  }

  async initialize(storeId: number = 1): Promise<void> {
    try {
      const profilesStr = await SettingsRepository.getSetting('printer_profiles', storeId);
      if (profilesStr) {
        const profiles: PrinterProfile[] = JSON.parse(profilesStr);
        const def = profiles.find((p) => p.isDefault) || profiles[0] || null;
        if (def) {
          this.defaultProfile = def;
          this.applyProfile(def);
          logger.info(`[PrinterService] Initialized default printer: ${def.name} (${def.type})`);
        }
      } else {
        // First run: Initialize with real Bluetooth printer default profile (not mock)
        const initial = await this.getSavedProfiles(storeId);
        if (initial.length > 0) {
          this.applyProfile(initial[0]);
        }
      }
    } catch (err: any) {
      logger.warn('[PrinterService] Failed to load printer profiles from settings:', err.message);
    }
  }

  applyProfile(profile: PrinterProfile): void {
    this.defaultProfile = profile;
    const type = profile.type || 'BLUETOOTH';
    if (this.drivers[type]) {
      this.activeDriver = this.drivers[type];
    }
    if (profile.address) {
      const connType = profile.type === 'USB' ? 'USB' : profile.type === 'NETWORK' ? 'NETWORK' : 'BLUETOOTH';
      this.autoReplyDriver.setTargetPrinter(profile.address, connType, profile.paperWidth || '58mm');
    }
  }

  setDriverType(type: PrinterType): void {
    if (this.drivers[type]) {
      this.activeDriver = this.drivers[type];
      logger.info(`[PrinterService] Active driver set to: ${type}`);
    }
  }

  isAvailable(): boolean {
    return this.autoReplyDriver.isAvailableSync ? this.autoReplyDriver.isAvailableSync() : true;
  }

  getAutoReplyDriver(): AutoReplyPrintDriver {
    return this.autoReplyDriver;
  }

  getActiveDriver(): IPrinterDriver {
    return this.activeDriver;
  }

  getActiveDriverDisplayName(): string {
    if (this.activeDriver === this.drivers.MOCK) {
      return 'Mock Simulation Driver (No Hardware Connected)';
    }
    if (this.activeDriver === this.drivers.BUILT_IN) {
      return 'Embedded Android POS Printer';
    }
    if (this.defaultProfile?.type === 'USB') {
      return 'USB ESC/POS (AutoReplyPrint)';
    }
    return 'Bluetooth ESC/POS (AutoReplyPrint Native)';
  }

  getActiveDriverInfo(): { name: string; type: PrinterType; isRealHardware: boolean } {
    const isMock = this.activeDriver === this.drivers.MOCK;
    return {
      name: this.getActiveDriverDisplayName(),
      type: this.defaultProfile?.type || (isMock ? 'MOCK' : 'BLUETOOTH'),
      isRealHardware: !isMock,
    };
  }

  async getDefaultProfile(storeId: number = 1): Promise<PrinterProfile | null> {
    const profiles = await this.getSavedProfiles(storeId);
    return profiles.find((p) => p.isDefault) || profiles[0] || null;
  }

  async getSavedProfiles(storeId: number = 1): Promise<PrinterProfile[]> {
    try {
      const str = await SettingsRepository.getSetting('printer_profiles', storeId);
      if (!str) {
        // Return initial real default profile (never mock by default)
        const initial: PrinterProfile[] = [
          {
            id: 'bt-default',
            name: 'Bluetooth Thermal Printer (58mm)',
            type: 'BLUETOOTH',
            paperWidth: '58mm',
            isDefault: true,
          },
        ];
        await this.saveProfiles(initial, storeId);
        return initial;
      }
      return JSON.parse(str);
    } catch {
      return [];
    }
  }

  async saveProfiles(profiles: PrinterProfile[], storeId: number = 1): Promise<void> {
    await SettingsRepository.setSetting('printer_profiles', JSON.stringify(profiles), storeId);
    const def = profiles.find((p) => p.isDefault);
    if (def) {
      this.applyProfile(def);
    }
  }

  async addOrUpdateProfile(profile: PrinterProfile, storeId: number = 1): Promise<PrinterProfile[]> {
    const existing = await this.getSavedProfiles(storeId);
    let updated: PrinterProfile[];

    if (profile.isDefault) {
      existing.forEach((p) => {
        p.isDefault = false;
      });
    }

    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      existing[idx] = profile;
      updated = existing;
    } else {
      updated = [...existing, profile];
    }

    await this.saveProfiles(updated, storeId);
    return updated;
  }

  async setDefaultProfile(profileId: string, storeId: number = 1): Promise<PrinterProfile[]> {
    const existing = await this.getSavedProfiles(storeId);
    existing.forEach((p) => {
      p.isDefault = p.id === profileId;
    });
    await this.saveProfiles(existing, storeId);
    return existing;
  }

  async deleteProfile(profileId: string, storeId: number = 1): Promise<PrinterProfile[]> {
    const existing = await this.getSavedProfiles(storeId);
    const updated = existing.filter((p) => p.id !== profileId);
    if (updated.length > 0 && !updated.some((p) => p.isDefault)) {
      updated[0].isDefault = true;
    }
    await this.saveProfiles(updated, storeId);
    return updated;
  }

  async getStatus(): Promise<PrinterStatus> {
    try {
      return await this.activeDriver.getStatus();
    } catch {
      return 'NOT_CONNECTED';
    }
  }

  /**
   * Real Test Print Execution:
   * Formats and prints a real test receipt through the active hardware driver pipeline.
   */
  async printTestReceipt(profile?: PrinterProfile): Promise<PrintResult> {
    if (profile) {
      this.applyProfile(profile);
    }

    const testPayload: ReceiptPayload = {
      data: {
        storeName: 'APKA BILL',
        invoiceNumber: 'TEST PRINT',
        date: new Date().toLocaleString('en-IN'),
        cashierName: 'POS System',
        items: [
          {
            name: 'Test Product',
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
        subtotal: 100,
        discount: 0,
        gst: 18,
        grandTotal: 118,
        paymentMethod: 'TEST / DEMO',
        footerText: 'Thank you!',
      },
    };

    return await this.printReceipt(testPayload);
  }

  /**
   * Non-Blocking Print Execution:
   * Uses configured default printer profile directly.
   * Printer errors (PAPER_OUT, BUSY, NOT_CONNECTED) are caught safely and reported.
   * Printing failure NEVER cancels or rolls back a sale transaction.
   */
  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    try {
      return await this.activeDriver.printReceipt(payload);
    } catch (err: any) {
      logger.warn('[PrinterService] Print execution failed non-blocking:', err.message);
      return {
        success: false,
        status: 'ERROR',
        error: err.message || 'Printer unavailable. Sale remains persisted safely.',
      };
    }
  }
}

export const PrinterService = new PrinterServiceManager();
export default PrinterService;

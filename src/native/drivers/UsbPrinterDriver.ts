/**
 * Orion POS Mobile Expo - USB Host OTG Thermal Printer Driver
 */

import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import ReceiptFormatter from '../utils/ReceiptFormatter';

export class UsbPrinterDriver implements IPrinterDriver {
  type: PrinterType = 'USB';
  name = 'USB Host Thermal Printer';
  private connectedDeviceId: number | null = null;

  setConnectedDevice(deviceId: number | null) {
    this.connectedDeviceId = deviceId;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<PrinterStatus> {
    return this.connectedDeviceId ? 'READY' : 'NOT_CONNECTED';
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const formatted = ReceiptFormatter.formatReceipt(payload);

    if (!this.connectedDeviceId) {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'USB OTG thermal printer is not attached.',
      };
    }

    console.log(`[UsbPrinterDriver -> Device ${this.connectedDeviceId}] Printing:\n` + formatted);
    return {
      success: true,
      status: 'READY',
      bytesPrinted: formatted.length,
      formattedText: formatted,
    };
  }
}

export default UsbPrinterDriver;

/**
 * Orion POS Mobile Expo - Bluetooth SPP Thermal Printer Driver
 */

import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import ReceiptFormatter from '../utils/ReceiptFormatter';

export class BluetoothPrinterDriver implements IPrinterDriver {
  type: PrinterType = 'BLUETOOTH';
  name = 'External Bluetooth Thermal Printer';
  private connectedAddress: string | null = null;

  setConnectedAddress(address: string | null) {
    this.connectedAddress = address;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<PrinterStatus> {
    return this.connectedAddress ? 'READY' : 'NOT_CONNECTED';
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const formatted = ReceiptFormatter.formatReceipt(payload);

    if (!this.connectedAddress) {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        error: 'Bluetooth printer is not paired or connected.',
      };
    }

    console.log(`[BluetoothPrinterDriver -> ${this.connectedAddress}] Printing:\n` + formatted);
    return {
      success: true,
      status: 'READY',
      bytesPrinted: formatted.length,
      formattedText: formatted,
    };
  }
}

export default BluetoothPrinterDriver;

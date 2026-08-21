/**
 * Orion POS Mobile Expo - Simulated Mock Printer Driver (Expo Go / Emulator)
 */

import { IPrinterDriver, PrinterType, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import ReceiptFormatter from '../utils/ReceiptFormatter';

export class MockPrinterDriver implements IPrinterDriver {
  type: PrinterType = 'MOCK';
  name = 'Simulated POS Printer (Mock)';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<PrinterStatus> {
    return 'READY';
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const formatted = ReceiptFormatter.formatReceipt(payload);
    console.log('[MockPrinterDriver] Receipt Printed Successfully:\n' + formatted);

    return {
      success: true,
      status: 'READY',
      bytesPrinted: formatted.length,
      formattedText: formatted,
    };
  }
}

export default MockPrinterDriver;

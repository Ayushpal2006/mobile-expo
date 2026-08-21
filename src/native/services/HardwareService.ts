/**
 * Orion POS Mobile Expo - Hardware Diagnostics Service
 */

import { Platform } from 'react-native';
import { HardwareCapabilities } from '../types';

export const HardwareService = {
  async getCapabilities(): Promise<HardwareCapabilities> {
    const isAndroid = Platform.OS === 'android';

    return {
      manufacturer: isAndroid ? 'Android OEM' : 'Apple',
      model: isAndroid ? 'POS Terminal / Phone' : 'iOS Device',
      device: Platform.OS,
      brand: isAndroid ? 'Generic / Sunmi' : 'Apple',
      sdkVersion: typeof Platform.Version === 'number' ? Platform.Version : 33,
      isPOSHardware: isAndroid,
      hasCamera: true,
      hasUsbHost: isAndroid,
      hasBluetooth: true,
      printerStatus: 'READY',
      scannerStatus: 'READY',
    };
  },
};

export default HardwareService;

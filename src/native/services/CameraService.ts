/**
 * Orion POS Mobile Expo - Expo Camera Barcode Scanner State Manager
 */

import PermissionService from './PermissionService';

export const CameraService = {
  async ensurePermission(): Promise<boolean> {
    const status = await PermissionService.getPermissions();
    if (status.camera) return true;
    return await PermissionService.requestCameraPermission();
  },
};

export default CameraService;

/**
 * Orion POS Mobile Expo - Native Permissions Service
 */

import { Camera } from 'expo-camera';
import { PermissionStatus } from '../types';

export const PermissionService = {
  async getPermissions(): Promise<PermissionStatus> {
    try {
      const cameraPerm = await Camera.getCameraPermissionsAsync();
      return {
        camera: cameraPerm.granted,
        bluetooth: true,
        location: true,
      };
    } catch {
      return { camera: false, bluetooth: false, location: false };
    }
  },

  async requestCameraPermission(): Promise<boolean> {
    try {
      const perm = await Camera.requestCameraPermissionsAsync();
      return perm.granted;
    } catch {
      return false;
    }
  },
};

export default PermissionService;

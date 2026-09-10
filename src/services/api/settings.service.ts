/**
 * Orion POS Mobile Expo - Settings Domain Service
 */

import { SettingsRepository } from '../../database/repositories/settings.repository';
import { OutboxRepository } from '../../database/repositories/outbox.repository';
import { apiClient } from './client';
import { SyncEngine } from './sync.service';
import { StoreSettings } from '../../types';
import logger from '../../utils/logger';

export const SettingsService = {
  async getSettings(storeId: number = 1): Promise<StoreSettings> {
    // 1. Return fast local cached settings
    const local = await SettingsRepository.getAllSettings(storeId);

    // 2. Refresh from backend in background if online
    try {
      const res = await apiClient.get<any>('/api/settings');
      const serverSettings = res.data?.data || res.data;
      if (serverSettings && typeof serverSettings === 'object') {
        await SettingsRepository.saveAllSettings(serverSettings, storeId, false);
        return await SettingsRepository.getAllSettings(storeId);
      }
    } catch (err: any) {
      logger.info('[SettingsService] Background settings fetch notice:', err.message);
    }

    return local;
  },

  async updateSettings(settings: Partial<StoreSettings>, storeId: number = 1): Promise<StoreSettings> {
    // 1. Commit locally and enqueue outbox event
    await SettingsRepository.saveAllSettings(settings, storeId, true);

    // 2. Attempt immediate background sync
    SyncEngine.syncNow(storeId).catch(() => {});

    return SettingsRepository.getAllSettings(storeId);
  },
};

export default SettingsService;



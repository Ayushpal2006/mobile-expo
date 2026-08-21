/**
 * Orion POS Mobile Expo - Settings Domain Service
 */

import { SettingsRepository } from '../../database/repositories/settings.repository';
import { OutboxRepository } from '../../database/repositories/outbox.repository';
import { apiClient } from './client';
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
        await SettingsRepository.saveAllSettings(serverSettings, storeId);
        return await SettingsRepository.getAllSettings(storeId);
      }
    } catch (err: any) {
      logger.info('[SettingsService] Background settings fetch notice:', err.message);
    }

    return local;
  },

  async updateSettings(settings: Partial<StoreSettings>, storeId: number = 1): Promise<StoreSettings> {
    // 1. Commit locally first
    await SettingsRepository.saveAllSettings(settings, storeId);

    // 2. Record outbox event for sync resilience
    const mutationId = `MUT-SETTINGS-${Date.now()}`;
    const outboxId = await OutboxRepository.insertEvent({
      entity_type: 'settings',
      entity_id: String(storeId),
      operation: 'UPDATE',
      payload: JSON.stringify(settings),
      store_id: storeId,
    });

    // 3. Attempt immediate optimistic upload if online
    try {
      await apiClient.put('/api/settings', settings);
      await OutboxRepository.markStatus(outboxId, 'SYNCED');
      logger.info('[SettingsService] Settings uploaded to server successfully.');
    } catch (err: any) {
      logger.info('[SettingsService] Online settings push deferred to outbox worker:', err.message);
    }

    return SettingsRepository.getAllSettings(storeId);
  },
};

export default SettingsService;



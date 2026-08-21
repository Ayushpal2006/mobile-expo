/**
 * Orion POS Mobile Expo - Settings Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import SettingsService from '../services/api/settings.service';
import { StoreSettings, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useSettings(): QueryState<StoreSettings> & {
  updateSettings: (s: Partial<StoreSettings>) => Promise<StoreSettings>;
} {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (options?: { force?: boolean }): Promise<StoreSettings | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const settings = await SettingsService.getSettings(storeId);
      setData(settings);
      return settings;
    } catch (err: any) {
      logger.error('[useSettings] Fetch error:', err);
      setError(err.message || 'Failed to load store settings');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (settings: Partial<StoreSettings>): Promise<StoreSettings> => {
    const updated = await SettingsService.updateSettings(settings, storeId);
    await fetchSettings({ force: true });
    return updated;
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchSettings,
    updateSettings,
  };
}

export default useSettings;


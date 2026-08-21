/**
 * Orion POS Mobile Expo - Dashboard Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import DashboardService from '../services/api/dashboard.service';
import { DashboardData, QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useDashboard(): QueryState<DashboardData> {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (options?: { force?: boolean }): Promise<DashboardData | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const res = await DashboardService.getDashboardData(storeId);
      setData(res);
      return res;
    } catch (err: any) {
      logger.error('[useDashboard] Fetch error:', err);
      setError(err.message || 'Failed to load dashboard KPIs');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchDashboard,
  };
}

export default useDashboard;


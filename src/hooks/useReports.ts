/**
 * Orion POS Mobile Expo - Reports Query Hook
 */

import { useState, useEffect, useCallback } from 'react';
import ReportService, { DetailedReportData } from '../services/api/report.service';
import { QueryState } from '../types';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

export function useReports(
  filter: 'today' | 'yesterday' | '7days' | 'month' | 'custom' = 'today',
  customStart?: string,
  customEnd?: string
): QueryState<DetailedReportData> {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<DetailedReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (options?: { force?: boolean }): Promise<DetailedReportData | null> => {
    if (options?.force) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    try {
      const res = await ReportService.getReportsData(filter, storeId, customStart, customEnd);
      setData(res);
      return res;
    } catch (err: any) {
      logger.error('[useReports] Fetch error:', err);
      setError(err.message || 'Failed to load report analytics');
      return null;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter, storeId, customStart, customEnd]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchReports,
  };
}

export default useReports;



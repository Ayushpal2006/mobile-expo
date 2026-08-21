/**
 * Orion POS Mobile Expo - useExpenses Hook
 */

import { useState, useEffect, useCallback } from 'react';
import ExpenseService from '../services/api/expense.service';
import { Expense } from '../types';
import { useAuth } from '../context/AuthContext';

export function useExpenses() {
  const { store } = useAuth();
  const storeId = store?.id || 1;

  const [data, setData] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        if (options?.force) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);
        const list = await ExpenseService.getExpenses(storeId);
        setData(list);
        return list;
      } catch (err: any) {
        setError(err.message || 'Failed to load expenses');
        return null;
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const createExpense = async (payload: Partial<Expense>) => {
    const created = await ExpenseService.createExpense(payload, storeId);
    await fetchExpenses({ force: true });
    return created;
  };

  const deleteExpense = async (id: number) => {
    await ExpenseService.deleteExpense(id, storeId);
    await fetchExpenses({ force: true });
  };

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: fetchExpenses,
    createExpense,
    deleteExpense,
  };
}

export default useExpenses;

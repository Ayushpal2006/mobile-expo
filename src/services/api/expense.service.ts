/**
 * Orion POS Mobile Expo - Expense Service
 */

import ExpenseRepository from '../../database/repositories/expense.repository';
import { apiClient, extractApiPayload } from './client';
import { SyncEngine } from './sync.service';
import { Expense } from '../../types';

export const ExpenseService = {
  async getExpenses(storeId: number = 1): Promise<Expense[]> {
    const local = await ExpenseRepository.getAll(storeId);
    if (local.length > 0) {
      return local;
    }

    try {
      const res = await apiClient.get<any>('/api/expenses');
      const payload = extractApiPayload(res);
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.expenses) ? payload.expenses : []);
      for (const e of list) {
        if (!e || typeof e !== 'object') continue;
        await ExpenseRepository.create(e, storeId);
      }
      return await ExpenseRepository.getAll(storeId);
    } catch {
      return local;
    }
  },

  async getExpensesByDateRange(startDate: string, endDate: string, storeId: number = 1): Promise<Expense[]> {
    return ExpenseRepository.getByDateRange(startDate, endDate, storeId);
  },

  async createExpense(expenseData: Partial<Expense>, storeId: number = 1): Promise<Expense> {
    const saved = await ExpenseRepository.create(expenseData, storeId);
    SyncEngine.syncNow(storeId).catch(() => {});
    return saved;
  },

  async deleteExpense(id: number, storeId: number = 1): Promise<void> {
    await ExpenseRepository.delete(id, storeId);
    SyncEngine.syncNow(storeId).catch(() => {});
  },
};

export default ExpenseService;

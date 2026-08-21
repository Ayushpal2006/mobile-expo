/**
 * Orion POS Mobile Expo - Expense Service
 */

import ExpenseRepository from '../../database/repositories/expense.repository';
import { Expense } from '../../types';

export const ExpenseService = {
  async getExpenses(storeId: number = 1): Promise<Expense[]> {
    return ExpenseRepository.getAll(storeId);
  },

  async getExpensesByDateRange(startDate: string, endDate: string, storeId: number = 1): Promise<Expense[]> {
    return ExpenseRepository.getByDateRange(startDate, endDate, storeId);
  },

  async createExpense(expenseData: Partial<Expense>, storeId: number = 1): Promise<Expense> {
    return ExpenseRepository.create(expenseData, storeId);
  },

  async deleteExpense(id: number, storeId: number = 1): Promise<void> {
    return ExpenseRepository.delete(id, storeId);
  },
};

export default ExpenseService;

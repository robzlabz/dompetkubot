import { IBudgetService } from '../interfaces/services.js';
import { IBudgetRepository, IExpenseRepository } from '../interfaces/repositories.js';
import { IBudget } from '../interfaces/index.js';

export interface BudgetStatus {
  budget: IBudget | null;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  alertType: '80_PERCENT' | '100_PERCENT';
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  message: string;
}

export class BudgetService implements IBudgetService {
  constructor(
    private budgetRepository: IBudgetRepository,
    private expenseRepository: IExpenseRepository
  ) {}

  async createBudget(userId: string, budgetData: {
    categoryId: string;
    amount: number;
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    startDate: Date;
    endDate: Date;
  }): Promise<IBudget> {
    // Check if there's an existing active budget for this category
    const existingBudget = await this.budgetRepository.findActiveByUserIdAndCategory(
      userId,
      budgetData.categoryId
    );

    if (existingBudget) {
      // Update the existing budget instead of creating a new one
      return this.updateBudget(existingBudget.id, userId, {
        amount: budgetData.amount,
        period: budgetData.period,
        startDate: budgetData.startDate,
        endDate: budgetData.endDate,
      });
    }

    return this.budgetRepository.create({
      userId,
      ...budgetData,
    });
  }

  async getUserBudgets(userId: string): Promise<IBudget[]> {
    return this.budgetRepository.findByUserId(userId);
  }

  async updateBudget(budgetId: string, userId: string, updates: Partial<IBudget>): Promise<IBudget> {
    // Verify the budget belongs to the user
    const existingBudget = await this.budgetRepository.findById(budgetId);
    if (!existingBudget || existingBudget.userId !== userId) {
      throw new Error('Budget not found or access denied');
    }

    return this.budgetRepository.update(budgetId, updates);
  }

  async deleteBudget(budgetId: string, userId: string): Promise<void> {
    // Verify the budget belongs to the user
    const existingBudget = await this.budgetRepository.findById(budgetId);
    if (!existingBudget || existingBudget.userId !== userId) {
      throw new Error('Budget not found or access denied');
    }

    await this.budgetRepository.delete(budgetId);
  }

  async checkBudgetStatus(userId: string, categoryId: string): Promise<BudgetStatus> {
    const budget = await this.budgetRepository.findActiveByUserIdAndCategory(userId, categoryId);
    
    if (!budget) {
      return {
        budget: null,
        spent: 0,
        remaining: 0,
        percentage: 0,
      };
    }

    // Calculate total spent in the budget period
    const spent = await this.expenseRepository.getTotalByUserIdAndPeriod(
      userId,
      budget.startDate,
      budget.endDate
    );

    const remaining = Math.max(0, budget.amount - spent);
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    return {
      budget,
      spent,
      remaining,
      percentage,
    };
  }

  async getAllBudgetStatuses(userId: string): Promise<BudgetStatus[]> {
    const budgets = await this.budgetRepository.findByUserId(userId);
    const statuses: BudgetStatus[] = [];

    for (const budget of budgets) {
      const status = await this.checkBudgetStatus(userId, budget.categoryId);
      statuses.push(status);
    }

    return statuses;
  }

  async checkBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    const budgetStatuses = await this.getAllBudgetStatuses(userId);
    const alerts: BudgetAlert[] = [];

    for (const status of budgetStatuses) {
      if (!status.budget) continue;

      // 80% threshold alert
      if (status.percentage >= 80 && status.percentage < 100) {
        alerts.push({
          budgetId: status.budget.id,
          categoryName: status.budget.categoryId, // This should be resolved to category name in a real implementation
          alertType: '80_PERCENT',
          budgetAmount: status.budget.amount,
          spentAmount: status.spent,
          percentage: status.percentage,
          message: `Peringatan: Anda telah menggunakan ${status.percentage.toFixed(1)}% dari budget kategori ini. Sisa budget: Rp ${this.formatCurrency(status.remaining)}`,
        });
      }

      // 100% threshold alert
      if (status.percentage >= 100) {
        const overspent = status.spent - status.budget.amount;
        alerts.push({
          budgetId: status.budget.id,
          categoryName: status.budget.categoryId, // This should be resolved to category name in a real implementation
          alertType: '100_PERCENT',
          budgetAmount: status.budget.amount,
          spentAmount: status.spent,
          percentage: status.percentage,
          message: `Alert: Budget kategori ini telah terlampaui! Anda telah melebihi budget sebesar Rp ${this.formatCurrency(overspent)}`,
        });
      }
    }

    return alerts;
  }

  async setBudgetForCategory(
    userId: string,
    categoryId: string,
    amount: number,
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'MONTHLY'
  ): Promise<IBudget> {
    const { startDate, endDate } = this.calculatePeriodDates(period);

    return this.createBudget(userId, {
      categoryId,
      amount,
      period,
      startDate,
      endDate,
    });
  }

  async getBudgetStatusForCategory(userId: string, categoryId: string): Promise<BudgetStatus> {
    return this.checkBudgetStatus(userId, categoryId);
  }

  private calculatePeriodDates(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);

    switch (period) {
      case 'DAILY':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'WEEKLY':
        // Start from Monday
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(now.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'MONTHLY':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(0); // Last day of current month
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'YEARLY':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate, endDate };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
import { IExpenseRepository, IIncomeRepository, ICategoryRepository, IBudgetRepository } from '../interfaces/repositories.js';
import { IExpense, IIncome, ICategory, IBudget } from '../interfaces/index.js';

export interface SpendingSummary {
  period: {
    startDate: Date;
    endDate: Date;
    type: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  };
  totalExpenses: number;
  totalIncome: number;
  netAmount: number;
  expensesByCategory: CategorySummary[];
  incomesByCategory: CategorySummary[];
  itemizedBreakdown?: ItemizedBreakdown[];
  topExpenses: ExpenseSummary[];
  expenseCount: number;
  incomeCount: number;
  averageExpense: number;
  averageIncome: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  count: number;
  percentage: number;
  averageAmount: number;
}

export interface ItemizedBreakdown {
  expenseId: string;
  description: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  date: Date;
}

export interface ExpenseSummary {
  id: string;
  description: string;
  amount: number;
  categoryName: string;
  date: Date;
  hasItems: boolean;
}

export interface BudgetStatusReport {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: 'UNDER_BUDGET' | 'WARNING' | 'OVER_BUDGET';
  alertMessage: string;
}

export interface MonthlyReport {
  month: number;
  year: number;
  summary: SpendingSummary;
  budgetStatus: BudgetStatusReport[];
  insights: {
    topSpendingCategory: string;
    biggestExpense: ExpenseSummary;
    savingsRate: number;
    comparisonToPreviousMonth: {
      expenseChange: number;
      incomeChange: number;
      expenseChangePercentage: number;
      incomeChangePercentage: number;
    };
  };
}

export interface WeeklyReport {
  weekStartDate: Date;
  weekEndDate: Date;
  summary: SpendingSummary;
  dailyBreakdown: Array<{
    date: Date;
    totalExpenses: number;
    totalIncome: number;
    transactionCount: number;
  }>;
}

export class ReportingService {
  constructor(
    private expenseRepository: IExpenseRepository,
    private incomeRepository: IIncomeRepository,
    private categoryRepository: ICategoryRepository,
    private budgetRepository: IBudgetRepository
  ) {}

  /**
   * Generate monthly spending summary with category breakdown
   */
  async generateMonthlySummary(userId: string, year: number, month: number): Promise<SpendingSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.generateSpendingSummary(userId, startDate, endDate, 'MONTHLY');
  }

  /**
   * Generate weekly spending summary
   */
  async generateWeeklySummary(userId: string, weekStartDate: Date): Promise<SpendingSummary> {
    const startDate = new Date(weekStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return this.generateSpendingSummary(userId, startDate, endDate, 'WEEKLY');
  }

  /**
   * Generate yearly spending summary
   */
  async generateYearlySummary(userId: string, year: number): Promise<SpendingSummary> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    return this.generateSpendingSummary(userId, startDate, endDate, 'YEARLY');
  }

  /**
   * Generate comprehensive monthly report with budget status
   */
  async generateMonthlyReport(userId: string, year: number, month: number): Promise<MonthlyReport> {
    const summary = await this.generateMonthlySummary(userId, year, month);
    const budgetStatus = await this.getBudgetStatusReport(userId);
    
    // Get previous month data for comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const previousSummary = await this.generateMonthlySummary(userId, prevYear, prevMonth);

    const insights = {
      topSpendingCategory: summary.expensesByCategory.length > 0 
        ? summary.expensesByCategory[0].categoryName 
        : 'Tidak ada pengeluaran',
      biggestExpense: summary.topExpenses.length > 0 
        ? summary.topExpenses[0] 
        : {
            id: '',
            description: 'Tidak ada pengeluaran',
            amount: 0,
            categoryName: '',
            date: new Date(),
            hasItems: false
          },
      savingsRate: summary.totalIncome > 0 
        ? ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 
        : 0,
      comparisonToPreviousMonth: {
        expenseChange: summary.totalExpenses - previousSummary.totalExpenses,
        incomeChange: summary.totalIncome - previousSummary.totalIncome,
        expenseChangePercentage: previousSummary.totalExpenses > 0 
          ? ((summary.totalExpenses - previousSummary.totalExpenses) / previousSummary.totalExpenses) * 100 
          : 0,
        incomeChangePercentage: previousSummary.totalIncome > 0 
          ? ((summary.totalIncome - previousSummary.totalIncome) / previousSummary.totalIncome) * 100 
          : 0
      }
    };

    return {
      month,
      year,
      summary,
      budgetStatus,
      insights
    };
  }

  /**
   * Generate weekly report with daily breakdown
   */
  async generateWeeklyReport(userId: string, weekStartDate: Date): Promise<WeeklyReport> {
    const summary = await this.generateWeeklySummary(userId, weekStartDate);
    
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayExpenses = await this.expenseRepository.getTotalByUserIdAndPeriod(userId, date, dayEnd);
      const dayIncome = await this.incomeRepository.getTotalByUserIdAndPeriod(userId, date, dayEnd);
      
      const expenses = await this.expenseRepository.findByUserIdAndDateRange(userId, date, dayEnd);
      const incomes = await this.incomeRepository.findByUserIdAndDateRange(userId, date, dayEnd);
      
      dailyBreakdown.push({
        date,
        totalExpenses: dayExpenses,
        totalIncome: dayIncome,
        transactionCount: expenses.length + incomes.length
      });
    }

    return {
      weekStartDate,
      weekEndDate: new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000),
      summary,
      dailyBreakdown
    };
  }

  /**
   * Get budget status report for all user budgets
   */
  async getBudgetStatusReport(userId: string): Promise<BudgetStatusReport[]> {
    const budgets = await this.budgetRepository.findByUserId(userId);
    const budgetStatuses: BudgetStatusReport[] = [];

    for (const budget of budgets) {
      const category = await this.categoryRepository.findById(budget.categoryId);
      const spentAmount = await this.expenseRepository.getTotalByUserIdAndPeriod(
        userId,
        budget.startDate,
        budget.endDate
      );

      const remainingAmount = Math.max(0, budget.amount - spentAmount);
      const percentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0;

      let status: 'UNDER_BUDGET' | 'WARNING' | 'OVER_BUDGET';
      let alertMessage: string;

      if (percentage >= 100) {
        status = 'OVER_BUDGET';
        const overspent = spentAmount - budget.amount;
        alertMessage = `Budget terlampaui sebesar ${this.formatCurrency(overspent)}!`;
      } else if (percentage >= 80) {
        status = 'WARNING';
        alertMessage = `Peringatan: ${percentage.toFixed(1)}% budget telah terpakai. Sisa ${this.formatCurrency(remainingAmount)}.`;
      } else {
        status = 'UNDER_BUDGET';
        alertMessage = `Budget aman. Sisa ${this.formatCurrency(remainingAmount)} (${(100 - percentage).toFixed(1)}%).`;
      }

      budgetStatuses.push({
        categoryId: budget.categoryId,
        categoryName: category?.name || 'Kategori Tidak Diketahui',
        budgetAmount: budget.amount,
        spentAmount,
        remainingAmount,
        percentage,
        status,
        alertMessage
      });
    }

    return budgetStatuses.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Generate spending summary for a given period
   */
  private async generateSpendingSummary(
    userId: string, 
    startDate: Date, 
    endDate: Date, 
    type: 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  ): Promise<SpendingSummary> {
    // Get all expenses and incomes for the period
    const expenses = await this.expenseRepository.findByUserIdAndDateRange(userId, startDate, endDate);
    const incomes = await this.incomeRepository.findByUserIdAndDateRange(userId, startDate, endDate);

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const netAmount = totalIncome - totalExpenses;

    // Group expenses by category
    const expensesByCategory = await this.groupTransactionsByCategory(expenses, 'EXPENSE', totalExpenses);
    const incomesByCategory = await this.groupTransactionsByCategory(incomes, 'INCOME', totalIncome);

    // Get itemized breakdown for expenses with items
    const itemizedBreakdown = expenses
      .filter(expense => expense.items && expense.items.length > 0)
      .map(expense => ({
        expenseId: expense.id,
        description: expense.description,
        totalAmount: expense.amount,
        items: expense.items!.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        })),
        date: expense.createdAt
      }));

    // Get top expenses
    const topExpenses = await this.getTopExpenses(expenses);

    return {
      period: {
        startDate,
        endDate,
        type
      },
      totalExpenses,
      totalIncome,
      netAmount,
      expensesByCategory,
      incomesByCategory,
      itemizedBreakdown,
      topExpenses,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
      averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
      averageIncome: incomes.length > 0 ? totalIncome / incomes.length : 0
    };
  }

  /**
   * Group transactions by category with statistics
   */
  private async groupTransactionsByCategory(
    transactions: (IExpense | IIncome)[],
    type: 'EXPENSE' | 'INCOME',
    totalAmount: number
  ): Promise<CategorySummary[]> {
    const categoryMap = new Map<string, { totalAmount: number; count: number; name: string }>();

    for (const transaction of transactions) {
      const categoryId = transaction.categoryId;
      const existing = categoryMap.get(categoryId);

      if (existing) {
        existing.totalAmount += transaction.amount;
        existing.count += 1;
      } else {
        const category = await this.categoryRepository.findById(categoryId);
        categoryMap.set(categoryId, {
          totalAmount: transaction.amount,
          count: 1,
          name: category?.name || 'Kategori Tidak Diketahui'
        });
      }
    }

    return Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        totalAmount: data.totalAmount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
        averageAmount: data.count > 0 ? data.totalAmount / data.count : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Get top expenses with category information
   */
  private async getTopExpenses(expenses: IExpense[]): Promise<ExpenseSummary[]> {
    const sortedExpenses = expenses
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const topExpenses: ExpenseSummary[] = [];

    for (const expense of sortedExpenses) {
      const category = await this.categoryRepository.findById(expense.categoryId);
      
      topExpenses.push({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        categoryName: category?.name || 'Kategori Tidak Diketahui',
        date: expense.createdAt,
        hasItems: Boolean(expense.items && expense.items.length > 0)
      });
    }

    return topExpenses;
  }

  /**
   * Format currency in Indonesian Rupiah
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Get spending trends over multiple periods
   */
  async getSpendingTrends(userId: string, months: number = 6): Promise<Array<{
    month: number;
    year: number;
    totalExpenses: number;
    totalIncome: number;
    netAmount: number;
    topCategory: string;
  }>> {
    const trends = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const summary = await this.generateMonthlySummary(userId, year, month);
      
      trends.push({
        month,
        year,
        totalExpenses: summary.totalExpenses,
        totalIncome: summary.totalIncome,
        netAmount: summary.netAmount,
        topCategory: summary.expensesByCategory.length > 0 
          ? summary.expensesByCategory[0].categoryName 
          : 'Tidak ada'
      });
    }

    return trends;
  }

  /**
   * Get category performance comparison
   */
  async getCategoryComparison(userId: string, categoryId: string, months: number = 3): Promise<Array<{
    month: number;
    year: number;
    amount: number;
    transactionCount: number;
    averageAmount: number;
  }>> {
    const comparison = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const expenses = await this.expenseRepository.findByUserIdAndDateRange(userId, startDate, endDate);
      const categoryExpenses = expenses.filter(expense => expense.categoryId === categoryId);
      
      const totalAmount = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const transactionCount = categoryExpenses.length;
      const averageAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;

      comparison.push({
        month,
        year,
        amount: totalAmount,
        transactionCount,
        averageAmount
      });
    }

    return comparison;
  }
}
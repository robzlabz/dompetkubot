import { IUser, IExpense, IIncome, ICategory, IBudget, IWallet, IConversation } from './index.js';

// Service interfaces that define business logic boundaries
export interface IUserService {
  getUserByTelegramId(telegramId: string): Promise<IUser | null>;
  createUser(telegramId: string, userData: Partial<IUser>): Promise<IUser>;
  updateUserPreferences(userId: string, preferences: { language?: string; timezone?: string }): Promise<IUser>;
  initializeUserDefaults(userId: string): Promise<void>;
}

export interface IExpenseService {
  createExpense(userId: string, expenseData: {
    amount: number;
    description: string;
    categoryId: string;
    calculationExpression?: string;
    receiptImageUrl?: string;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<IExpense>;
  getUserExpenses(userId: string, limit?: number, offset?: number): Promise<IExpense[]>;
  getExpensesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<IExpense[]>;
  updateExpense(expenseId: string, userId: string, updates: Partial<IExpense>): Promise<IExpense>;
  deleteExpense(expenseId: string, userId: string): Promise<void>;
  getTotalExpensesByPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}

export interface IIncomeService {
  createIncome(userId: string, incomeData: {
    amount: number;
    description: string;
    categoryId: string;
  }): Promise<IIncome>;
  getUserIncomes(userId: string, limit?: number, offset?: number): Promise<IIncome[]>;
  getIncomesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<IIncome[]>;
  updateIncome(incomeId: string, userId: string, updates: Partial<IIncome>): Promise<IIncome>;
  deleteIncome(incomeId: string, userId: string): Promise<void>;
  getTotalIncomesByPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}

export interface ICategoryService {
  getUserCategories(userId: string): Promise<ICategory[]>;
  createCategory(userId: string, categoryData: {
    name: string;
    type: 'EXPENSE' | 'INCOME';
  }): Promise<ICategory>;
  updateCategory(categoryId: string, userId: string, updates: Partial<ICategory>): Promise<ICategory>;
  deleteCategory(categoryId: string, userId: string): Promise<void>;
  getDefaultCategories(): Promise<ICategory[]>;
  findOrCreateCategory(userId: string, categoryName: string, type: 'EXPENSE' | 'INCOME'): Promise<ICategory>;
}

export interface IBudgetService {
  createBudget(userId: string, budgetData: {
    categoryId: string;
    amount: number;
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    startDate: Date;
    endDate: Date;
  }): Promise<IBudget>;
  getUserBudgets(userId: string): Promise<IBudget[]>;
  updateBudget(budgetId: string, userId: string, updates: Partial<IBudget>): Promise<IBudget>;
  deleteBudget(budgetId: string, userId: string): Promise<void>;
  checkBudgetStatus(userId: string, categoryId: string): Promise<{
    budget: IBudget | null;
    spent: number;
    remaining: number;
    percentage: number;
  }>;
}

export interface IWalletService {
  getUserWallet(userId: string): Promise<IWallet>;
  updateWalletBalance(userId: string, newBalance: number): Promise<IWallet>;
  addToWallet(userId: string, amount: number): Promise<IWallet>;
  subtractFromWallet(userId: string, amount: number): Promise<IWallet>;
  addBalance(userId: string, amount: number): Promise<IWallet>;
  deductCoins(userId: string, amount: number): Promise<IWallet>;
  addCoins(userId: string, amount: number): Promise<IWallet>;
  checkSufficientBalance(userId: string, requiredCoins: number): Promise<boolean>;
  getBalance(userId: string): Promise<IWallet>;
  getWalletSummary(userId: string): Promise<{
    balance: number;
    coins: number;
    totalIncome: number;
    totalExpenses: number;
    monthlyIncome: number;
    monthlyExpenses: number;
  }>;
}

export interface IAIService {
  parseExpenseFromText(text: string, language: string): Promise<{
    amount?: number;
    description?: string;
    category?: string;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
    calculationExpression?: string;
  }>;
  parseIncomeFromText(text: string, language: string): Promise<{
    amount?: number;
    description?: string;
    category?: string;
  }>;
  generateFinancialInsights(userId: string, language: string): Promise<string>;
  classifyTransactionCategory(description: string, language: string): Promise<string>;
}

export interface IConversationService {
  startConversation(userId: string, type: 'EXPENSE_ENTRY' | 'INCOME_ENTRY' | 'BUDGET_SETUP' | 'GENERAL_QUERY'): Promise<IConversation>;
  addMessage(conversationId: string, role: 'USER' | 'ASSISTANT' | 'SYSTEM', content: string): Promise<void>;
  getActiveConversation(userId: string): Promise<IConversation | null>;
  completeConversation(conversationId: string): Promise<void>;
  cancelConversation(conversationId: string): Promise<void>;
}
import { IUser, IExpense, IIncome, ICategory, IBudget, IWallet, IVoucher, IConversation } from './index.js';

// Repository interfaces that define data access patterns
export interface IUserRepository {
  findByTelegramId(telegramId: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser>;
  update(id: string, userData: Partial<IUser>): Promise<IUser>;
  delete(id: string): Promise<void>;
}

export interface IExpenseRepository {
  findById(id: string): Promise<IExpense | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<IExpense[]>;
  findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<IExpense[]>;
  create(expenseData: Omit<IExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<IExpense>;
  update(id: string, expenseData: Partial<IExpense>): Promise<IExpense>;
  delete(id: string): Promise<void>;
  getTotalByUserIdAndPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}

export interface IIncomeRepository {
  findById(id: string): Promise<IIncome | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<IIncome[]>;
  findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<IIncome[]>;
  create(incomeData: Omit<IIncome, 'id' | 'createdAt' | 'updatedAt'>): Promise<IIncome>;
  update(id: string, incomeData: Partial<IIncome>): Promise<IIncome>;
  delete(id: string): Promise<void>;
  getTotalByUserIdAndPeriod(userId: string, startDate: Date, endDate: Date): Promise<number>;
}

export interface ICategoryRepository {
  findById(id: string): Promise<ICategory | null>;
  findByUserId(userId: string): Promise<ICategory[]>;
  findDefaultCategories(): Promise<ICategory[]>;
  findByType(type: 'EXPENSE' | 'INCOME', userId?: string): Promise<ICategory[]>;
  findByName(name: string, userId?: string): Promise<ICategory | null>;
  create(categoryData: Omit<ICategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICategory>;
  update(id: string, categoryData: Partial<ICategory>): Promise<ICategory>;
  delete(id: string): Promise<void>;
}

export interface IBudgetRepository {
  findById(id: string): Promise<IBudget | null>;
  findByUserId(userId: string): Promise<IBudget[]>;
  findActiveByUserIdAndCategory(userId: string, categoryId: string): Promise<IBudget | null>;
  create(budgetData: Omit<IBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<IBudget>;
  update(id: string, budgetData: Partial<IBudget>): Promise<IBudget>;
  delete(id: string): Promise<void>;
}

export interface IWalletRepository {
  findByUserId(userId: string): Promise<IWallet | null>;
  create(walletData: Omit<IWallet, 'id' | 'createdAt' | 'updatedAt'>): Promise<IWallet>;
  updateBalance(userId: string, newBalance: number): Promise<IWallet>;
  addToBalance(userId: string, amount: number): Promise<IWallet>;
  subtractFromBalance(userId: string, amount: number): Promise<IWallet>;
  updateCoins(userId: string, newCoins: number): Promise<IWallet>;
  addCoins(userId: string, coins: number): Promise<IWallet>;
  subtractCoins(userId: string, coins: number): Promise<IWallet>;
}

export interface IVoucherRepository {
  findByCode(code: string): Promise<IVoucher | null>;
  findById(id: string): Promise<IVoucher | null>;
  findByUserId(userId: string): Promise<IVoucher[]>;
  create(voucherData: Omit<IVoucher, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVoucher>;
  update(id: string, voucherData: Partial<IVoucher>): Promise<IVoucher>;
  markAsUsed(id: string, userId: string): Promise<IVoucher>;
  delete(id: string): Promise<void>;
}

export interface IConversationRepository {
  findById(id: string): Promise<IConversation | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<IConversation[]>;
  create(conversationData: Omit<IConversation, 'id' | 'createdAt'>): Promise<IConversation>;
  delete(id: string): Promise<void>;
  findRecentByUserId(userId: string, limit?: number): Promise<IConversation[]>;
}
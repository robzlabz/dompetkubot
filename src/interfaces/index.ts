// Core domain interfaces
export interface IUser {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExpense {
  id: string;
  userId: string;
  amount: number;
  description: string;
  categoryId: string;
  calculationExpression?: string;
  receiptImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  items?: IExpenseItem[];
}

export interface IExpenseItem {
  id: string;
  expenseId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IIncome {
  id: string;
  userId: string;
  amount: number;
  description: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  isDefault: boolean;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBudget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet {
  id: string;
  userId: string;
  balance: number;
  coins: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation {
  id: string;
  userId: string;
  message: string;
  response: string;
  messageType: 'TEXT' | 'VOICE' | 'PHOTO';
  toolUsed?: string;
  coinsUsed?: number;
  createdAt: Date;
}

export interface IVoucher {
  id: string;
  code: string;
  type: 'COINS' | 'BALANCE' | 'DISCOUNT';
  value: number;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: Date;
}
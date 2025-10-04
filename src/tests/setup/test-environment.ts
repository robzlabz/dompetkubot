import { PrismaClient } from '@prisma/client';

// Test environment configuration
export const TEST_CONFIG = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/telegram_budget_bot_test',
  TELEGRAM_BOT_TOKEN: 'test_token_123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  OPENAI_API_KEY: 'sk-test-openai-key-for-testing-purposes',
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  OPENAI_MODEL: 'gpt-3.5-turbo',
  LOG_LEVEL: 'error',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

// Set test environment variables
export function setupTestEnvironment() {
  Object.entries(TEST_CONFIG).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  // Reset environment config to pick up new values
  try {
    const { EnvironmentConfig } = require('../../config/environment.js');
    EnvironmentConfig.reset();
  } catch (error) {
    // Ignore if not available
  }
}

// Database utilities for testing
export class TestDatabaseManager {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CONFIG.DATABASE_URL
        }
      }
    });
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async cleanDatabase() {
    // Clean up all tables in reverse dependency order
    await this.prisma.conversation.deleteMany();
    await this.prisma.expenseItem.deleteMany();
    await this.prisma.expense.deleteMany();
    await this.prisma.income.deleteMany();
    await this.prisma.budget.deleteMany();
    await this.prisma.voucher.deleteMany();
    await this.prisma.wallet.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.user.deleteMany();
  }

  async seedTestData() {
    // Create default categories
    const categories = [
      { id: 'makanan-minuman', name: 'Makanan & Minuman', type: 'EXPENSE', isDefault: true },
      { id: 'transportasi', name: 'Transportasi', type: 'EXPENSE', isDefault: true },
      { id: 'tagihan', name: 'Tagihan', type: 'EXPENSE', isDefault: true },
      { id: 'hiburan', name: 'Hiburan', type: 'EXPENSE', isDefault: true },
      { id: 'gaji', name: 'Gaji', type: 'INCOME', isDefault: true },
      { id: 'bonus', name: 'Bonus', type: 'INCOME', isDefault: true },
    ];

    for (const category of categories) {
      await this.prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: category as any
      });
    }
  }

  getPrismaClient() {
    return this.prisma;
  }
}

// Mock data generators
export const TestDataGenerator = {
  createTestUser: (overrides: any = {}) => ({
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    language: 'id',
    timezone: 'Asia/Jakarta',
    ...overrides
  }),

  createTestExpense: (userId: string, overrides: any = {}) => ({
    userId,
    amount: 25000,
    description: 'Test expense',
    categoryId: 'makanan-minuman',
    ...overrides
  }),

  createTestIncome: (userId: string, overrides: any = {}) => ({
    userId,
    amount: 5000000,
    description: 'Test income',
    categoryId: 'gaji',
    ...overrides
  }),

  createTestBudget: (userId: string, overrides: any = {}) => ({
    userId,
    categoryId: 'makanan-minuman',
    amount: 1000000,
    period: 'MONTHLY',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    ...overrides
  }),

  createTestWallet: (userId: string, overrides: any = {}) => ({
    userId,
    balance: 100000,
    coins: 100,
    ...overrides
  })
};

// Test assertion helpers
export const TestAssertions = {
  expectValidResponse: (response: string) => {
    expect(response).toBeTruthy();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  },

  expectSuccessResponse: (response: string) => {
    expect(response).toContain('✅');
    expect(response).toContain('berhasil tercatat!');
    expect(response).toMatch(/`[a-zA-Z0-9]{8}`/); // nanoid format
  },

  expectErrorResponse: (response: string) => {
    expect(response).toContain('❌');
    expect(response.length).toBeGreaterThan(10);
  },

  expectIndonesianCurrency: (response: string, amount: number) => {
    const formattedAmount = amount.toLocaleString('id-ID');
    expect(response).toContain(formattedAmount);
  },

  expectCoinDeduction: (response: string, coins: number) => {
    expect(response).toContain(`${coins} koin`);
  }
};
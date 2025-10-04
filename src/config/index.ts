// Central configuration exports
export { DatabaseConfig } from './database.js';
export { EnvironmentConfig, env, type Environment } from './environment.js';

// Application constants
export const APP_CONFIG = {
  DEFAULT_LANGUAGE: 'id',
  DEFAULT_TIMEZONE: 'Asia/Jakarta',
  DEFAULT_CURRENCY: 'IDR',
  MAX_EXPENSE_ITEMS: 50,
  MAX_CONVERSATION_MESSAGES: 100,
  PAGINATION_LIMIT: 20,
  SUPPORTED_LANGUAGES: ['id', 'en'],
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Default categories for new users
export const DEFAULT_CATEGORIES = {
  EXPENSE: [
    { name: 'Makanan & Minuman', nameEn: 'Food & Drinks' },
    { name: 'Transportasi', nameEn: 'Transportation' },
    { name: 'Belanja', nameEn: 'Shopping' },
    { name: 'Tagihan', nameEn: 'Bills' },
    { name: 'Kesehatan', nameEn: 'Healthcare' },
    { name: 'Hiburan', nameEn: 'Entertainment' },
    { name: 'Pendidikan', nameEn: 'Education' },
    { name: 'Lainnya', nameEn: 'Others' },
  ],
  INCOME: [
    { name: 'Gaji', nameEn: 'Salary' },
    { name: 'Freelance', nameEn: 'Freelance' },
    { name: 'Investasi', nameEn: 'Investment' },
    { name: 'Hadiah', nameEn: 'Gift' },
    { name: 'Lainnya', nameEn: 'Others' },
  ],
} as const;
import { z } from 'zod';
import { IIncomeService } from '../interfaces/services.js';
import { IIncome } from '../interfaces/index.js';
import { IIncomeRepository, ICategoryRepository } from '../interfaces/repositories.js';
import { CalculationService } from './CalculationService.js';

// Validation schemas
const CreateIncomeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category ID is required')
});

const UpdateIncomeSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional()
});

export interface CreateIncomeData {
  userId: string;
  amount: number;
  description: string;
  categoryId: string;
}

export interface IncomeFilters {
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export class IncomeService implements IIncomeService {
  constructor(
    private incomeRepository: IIncomeRepository,
    private categoryRepository: ICategoryRepository,
    private calculationService: CalculationService
  ) {}

  /**
   * Create a new income entry
   */
  async createIncome(userId: string, incomeData: CreateIncomeData): Promise<IIncome> {
    try {
      // Validate input data
      const validatedData = CreateIncomeSchema.parse(incomeData);
      
      // Verify user has access to the category
      const category = await this.categoryRepository.findById(validatedData.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Verify category belongs to user or is default
      if (category.userId && category.userId !== userId) {
        throw new Error('Category not accessible to user');
      }
      
      // Verify category is for income
      if (category.type !== 'INCOME') {
        throw new Error('Category must be of type INCOME');
      }

      // Create the income
      return await this.incomeRepository.create({
        userId,
        amount: validatedData.amount,
        description: validatedData.description,
        categoryId: validatedData.categoryId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Create income from natural language text
   */
  async createIncomeFromText(userId: string, text: string, categoryId?: string): Promise<IIncome> {
    try {
      // Extract amount from text using calculation service
      const numbers = this.calculationService.extractNumbers(text);
      if (numbers.length === 0) {
        throw new Error('No valid amount found in text');
      }

      let amount: number;
      
      if (this.calculationService.isValidExpression(text)) {
        const result = await this.calculationService.calculateExpression(text);
        amount = result.result;
      } else {
        // Use the largest number as amount (most likely to be the income amount)
        amount = Math.max(...numbers);
      }

      // Use provided category or try to find appropriate income category
      let finalCategoryId = categoryId;
      if (!finalCategoryId) {
        finalCategoryId = await this.findBestIncomeCategory(userId, text);
      }

      return await this.createIncome(userId, {
        userId,
        amount,
        description: text,
        categoryId: finalCategoryId
      });
    } catch (error) {
      throw new Error(`Failed to create income from text "${text}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user incomes with optional pagination
   */
  async getUserIncomes(userId: string, limit?: number, offset?: number): Promise<IIncome[]> {
    try {
      return await this.incomeRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to get incomes for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get incomes by date range
   */
  async getIncomesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<IIncome[]> {
    try {
      return await this.incomeRepository.findByUserIdAndDateRange(userId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get incomes by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing income
   */
  async updateIncome(incomeId: string, userId: string, updates: Partial<IIncome>): Promise<IIncome> {
    try {
      // Validate update data
      const validatedUpdates = UpdateIncomeSchema.parse(updates);
      
      // Verify income exists and belongs to user
      const existingIncome = await this.incomeRepository.findById(incomeId);
      if (!existingIncome) {
        throw new Error('Income not found');
      }
      
      if (existingIncome.userId !== userId) {
        throw new Error('Income does not belong to user');
      }

      // If category is being updated, verify it
      if (validatedUpdates.categoryId) {
        const category = await this.categoryRepository.findById(validatedUpdates.categoryId);
        if (!category) {
          throw new Error('Category not found');
        }
        
        if (category.userId && category.userId !== userId) {
          throw new Error('Category not accessible to user');
        }
        
        if (category.type !== 'INCOME') {
          throw new Error('Category must be of type INCOME');
        }
      }

      return await this.incomeRepository.update(incomeId, validatedUpdates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Delete an income
   */
  async deleteIncome(incomeId: string, userId: string): Promise<void> {
    try {
      // Verify income exists and belongs to user
      const existingIncome = await this.incomeRepository.findById(incomeId);
      if (!existingIncome) {
        throw new Error('Income not found');
      }
      
      if (existingIncome.userId !== userId) {
        throw new Error('Income does not belong to user');
      }

      await this.incomeRepository.delete(incomeId);
    } catch (error) {
      throw new Error(`Failed to delete income: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total incomes for a period
   */
  async getTotalIncomesByPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.incomeRepository.getTotalByUserIdAndPeriod(userId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get total incomes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get incomes with advanced filtering
   */
  async getIncomesWithFilters(userId: string, filters: IncomeFilters): Promise<IIncome[]> {
    try {
      const queryFilters: any = { userId };

      if (filters.categoryId) {
        queryFilters.categoryId = filters.categoryId;
      }

      if (filters.startDate || filters.endDate) {
        queryFilters.createdAt = {};
        if (filters.startDate) {
          queryFilters.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          queryFilters.createdAt.lte = filters.endDate;
        }
      }

      if (filters.minAmount || filters.maxAmount) {
        queryFilters.amount = {};
        if (filters.minAmount) {
          queryFilters.amount.gte = filters.minAmount;
        }
        if (filters.maxAmount) {
          queryFilters.amount.lte = filters.maxAmount;
        }
      }

      return await this.incomeRepository.findMany(queryFilters);
    } catch (error) {
      throw new Error(`Failed to get incomes with filters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent incomes for a user
   */
  async getRecentIncomes(userId: string, limit: number = 10): Promise<IIncome[]> {
    try {
      return await this.incomeRepository.findByUserId(userId, limit, 0);
    } catch (error) {
      throw new Error(`Failed to get recent incomes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get income statistics for a user
   */
  async getIncomeStatistics(userId: string, startDate: Date, endDate: Date): Promise<{
    totalAmount: number;
    totalCount: number;
    averageAmount: number;
    categorySummary: Array<{
      categoryId: string;
      categoryName: string;
      totalAmount: number;
      count: number;
    }>;
  }> {
    try {
      const incomes = await this.getIncomesByDateRange(userId, startDate, endDate);
      
      const totalAmount = incomes.reduce((sum, income) => sum + income.amount, 0);
      const totalCount = incomes.length;
      const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

      // Group by category
      const categoryMap = new Map<string, { totalAmount: number; count: number; name: string }>();
      
      for (const income of incomes) {
        const categoryId = income.categoryId;
        const existing = categoryMap.get(categoryId);
        
        if (existing) {
          existing.totalAmount += income.amount;
          existing.count += 1;
        } else {
          // Get category name
          const category = await this.categoryRepository.findById(categoryId);
          categoryMap.set(categoryId, {
            totalAmount: income.amount,
            count: 1,
            name: category?.name || 'Unknown'
          });
        }
      }

      const categorySummary = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        totalAmount: data.totalAmount,
        count: data.count
      }));

      return {
        totalAmount,
        totalCount,
        averageAmount,
        categorySummary
      };
    } catch (error) {
      throw new Error(`Failed to get income statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find the best income category based on text content
   */
  private async findBestIncomeCategory(userId: string, text: string): Promise<string> {
    try {
      const incomeCategories = await this.categoryRepository.findByType('INCOME', userId);
      
      if (incomeCategories.length === 0) {
        throw new Error('No income categories available');
      }

      const textLower = text.toLowerCase();
      
      // Define Indonesian income keywords and their corresponding category patterns
      const categoryKeywords = [
        { keywords: ['gaji', 'salary', 'upah', 'honor'], categoryNames: ['gaji', 'salary', 'penghasilan'] },
        { keywords: ['bonus', 'thr', 'insentif'], categoryNames: ['bonus', 'tunjangan'] },
        { keywords: ['freelance', 'project', 'proyek', 'kontrak'], categoryNames: ['freelance', 'proyek', 'kontrak'] },
        { keywords: ['investasi', 'dividen', 'bunga', 'profit'], categoryNames: ['investasi', 'dividen', 'bunga'] },
        { keywords: ['jual', 'penjualan', 'dagang'], categoryNames: ['penjualan', 'dagang', 'bisnis'] },
        { keywords: ['hadiah', 'gift', 'kado'], categoryNames: ['hadiah', 'gift'] },
        { keywords: ['refund', 'pengembalian', 'cashback'], categoryNames: ['refund', 'pengembalian'] }
      ];

      // Try to match keywords with categories
      for (const { keywords, categoryNames } of categoryKeywords) {
        const hasKeyword = keywords.some(keyword => textLower.includes(keyword));
        if (hasKeyword) {
          // Find matching category
          for (const categoryName of categoryNames) {
            const matchingCategory = incomeCategories.find(cat => 
              cat.name.toLowerCase().includes(categoryName)
            );
            if (matchingCategory) {
              return matchingCategory.id;
            }
          }
        }
      }

      // If no specific match, try to find a general income category
      const generalCategory = incomeCategories.find(cat => 
        cat.name.toLowerCase().includes('umum') || 
        cat.name.toLowerCase().includes('lain') ||
        cat.name.toLowerCase().includes('general') ||
        cat.name.toLowerCase().includes('penghasilan')
      );
      
      if (generalCategory) {
        return generalCategory.id;
      }

      // Default to first available income category
      return incomeCategories[0].id;
    } catch (error) {
      throw new Error(`Failed to find best income category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get monthly income summary
   */
  async getMonthlyIncomeSummary(userId: string, year: number, month: number): Promise<{
    totalIncome: number;
    incomeCount: number;
    averageIncome: number;
    topCategories: Array<{
      categoryName: string;
      amount: number;
      percentage: number;
    }>;
  }> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      const statistics = await this.getIncomeStatistics(userId, startDate, endDate);
      
      // Calculate percentages for categories
      const topCategories = statistics.categorySummary
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5)
        .map(cat => ({
          categoryName: cat.categoryName,
          amount: cat.totalAmount,
          percentage: statistics.totalAmount > 0 ? (cat.totalAmount / statistics.totalAmount) * 100 : 0
        }));

      return {
        totalIncome: statistics.totalAmount,
        incomeCount: statistics.totalCount,
        averageIncome: statistics.averageAmount,
        topCategories
      };
    } catch (error) {
      throw new Error(`Failed to get monthly income summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Categorize income automatically based on description
   */
  async categorizeIncome(userId: string, description: string): Promise<string> {
    try {
      return await this.findBestIncomeCategory(userId, description);
    } catch (error) {
      throw new Error(`Failed to categorize income: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
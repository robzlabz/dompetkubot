import { z } from 'zod';
import { IExpenseService } from '../interfaces/services.js';
import { nanoid } from 'nanoid';
import { IExpense, IExpenseItem } from '../interfaces/index.js';
import { IExpenseRepository, ICategoryRepository } from '../interfaces/repositories.js';
import { CalculationService, CalculationResult } from './CalculationService.js';

// Validation schemas
const CreateExpenseSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  calculationExpression: z.string().optional(),
  receiptImageUrl: z.string().url().optional(),
  items: z.array(z.object({
    name: z.string().min(1, 'Item name is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive')
  })).optional()
});

const UpdateExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  calculationExpression: z.string().optional(),
  receiptImageUrl: z.string().url().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive()
  })).optional()
});

export interface CreateExpenseData {
  userId: string;
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
}

export interface ExpenseFilters {
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  hasItems?: boolean;
}

export class ExpenseService implements IExpenseService {
  constructor(
    private expenseRepository: IExpenseRepository,
    private categoryRepository: ICategoryRepository,
    private calculationService: CalculationService
  ) {}

  /**
   * Create a new expense with automatic calculation support
   */
  async createExpense(userId: string, expenseData: CreateExpenseData): Promise<IExpense> {
    try {
      // Validate input data
      // Include function argument userId in validation to satisfy schema
      const validatedData = CreateExpenseSchema.parse({ ...expenseData, userId });
      
      // Verify user has access to the category
      const category = await this.categoryRepository.findById(validatedData.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Verify category belongs to user or is default
      if (category.userId && category.userId !== userId) {
        throw new Error('Category not accessible to user');
      }
      
      // Verify category is for expenses
      if (category.type !== 'EXPENSE') {
        throw new Error('Category must be of type EXPENSE');
      }

      let finalAmount = validatedData.amount;
      let calculationResult: CalculationResult | null = null;
      let processedItems: IExpenseItem[] | undefined;

      // If calculation expression is provided, calculate the amount
      if (validatedData.calculationExpression) {
        calculationResult = await this.calculationService.calculateExpression(validatedData.calculationExpression);
        finalAmount = calculationResult.result;
        
        // Convert calculation items to expense items if available
        if (calculationResult.items) {
          processedItems = calculationResult.items.map((item, index) => ({
            id: '', // Will be set by database
            expenseId: '', // Will be set by database
            name: item.description || `Item ${index + 1}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.total
          }));
        }
      }

      // If items are provided directly, process them
      if (validatedData.items && validatedData.items.length > 0) {
        processedItems = validatedData.items.map((item, index) => ({
          id: '', // Will be set by database
          expenseId: '', // Will be set by database
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice
        }));
        
        // Recalculate total amount from items if no calculation expression
        if (!validatedData.calculationExpression) {
          finalAmount = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        }
      }

      // Create the expense
      const expenseToCreate = {
        userId,
        expenseId: nanoid(8),
        amount: finalAmount,
        description: validatedData.description,
        categoryId: validatedData.categoryId,
        calculationExpression: validatedData.calculationExpression,
        receiptImageUrl: validatedData.receiptImageUrl,
        items: processedItems
      };

      return await this.expenseRepository.create(expenseToCreate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Create expense from natural language text with calculation
   */
  async createExpenseFromText(userId: string, text: string, categoryId?: string): Promise<IExpense> {
    try {
      // Try to parse quantity and price from text
      const parsedData = await this.calculationService.parseQuantityAndPrice(text);
      
      let amount: number;
      let calculationExpression: string | undefined;
      let items: Array<{ name: string; quantity: number; unitPrice: number; }> | undefined;
      
      if (parsedData) {
        amount = parsedData.totalPrice;
        calculationExpression = text;
        items = [{
          name: parsedData.item || 'Item',
          quantity: parsedData.quantity,
          unitPrice: parsedData.unitPrice
        }];
      } else {
        // Try to extract numbers and calculate
        const numbers = this.calculationService.extractNumbers(text);
        if (numbers.length === 0) {
          throw new Error('No valid amount found in text');
        }
        
        if (this.calculationService.isValidExpression(text)) {
          const result = await this.calculationService.calculateExpression(text);
          amount = result.result;
          calculationExpression = text;
        } else {
          // Use the largest number as amount
          amount = Math.max(...numbers);
        }
      }

      // Use provided category or try to find a default expense category
      let finalCategoryId = categoryId;
      if (!finalCategoryId) {
        const defaultCategories = await this.categoryRepository.findByType('EXPENSE', userId);
        const generalCategory = defaultCategories.find(cat => 
          cat.name.toLowerCase().includes('umum') || 
          cat.name.toLowerCase().includes('lain') ||
          cat.name.toLowerCase().includes('general')
        );
        
        if (generalCategory) {
          finalCategoryId = generalCategory.id;
        } else if (defaultCategories.length > 0) {
          finalCategoryId = defaultCategories[0].id;
        } else {
          throw new Error('No expense category available');
        }
      }

      return await this.createExpense(userId, {
        userId,
        amount,
        description: text,
        categoryId: finalCategoryId,
        calculationExpression,
        items
      });
    } catch (error) {
      throw new Error(`Failed to create expense from text "${text}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user expenses with optional filters
   */
  async getUserExpenses(userId: string, limit?: number, offset?: number): Promise<IExpense[]> {
    try {
      return await this.expenseRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to get expenses for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get expenses by date range
   */
  async getExpensesByDateRange(userId: string, startDate: Date, endDate: Date): Promise<IExpense[]> {
    try {
      return await this.expenseRepository.findByUserIdAndDateRange(userId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get expenses by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing expense
   */
  async updateExpense(expenseId: string, userId: string, updates: Partial<IExpense>): Promise<IExpense> {
    try {
      // Validate update data
      const validatedUpdates = UpdateExpenseSchema.parse(updates);
      
      // Verify expense exists and belongs to user
      console.log({expenseId});
      let existingExpense = await this.expenseRepository.findById(expenseId);
      if (!existingExpense) {
        existingExpense = await this.expenseRepository.findByExpenseId(expenseId);
      }
      if (!existingExpense) {
        throw new Error('Expense not found');
      }
      
      if (existingExpense.userId !== userId) {
        throw new Error('Expense does not belong to user');
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
        
        if (category.type !== 'EXPENSE') {
          throw new Error('Category must be of type EXPENSE');
        }
      }

      // Handle calculation expression updates
      let finalUpdates = { ...validatedUpdates };
      if (validatedUpdates.calculationExpression) {
        const calculationResult = await this.calculationService.calculateExpression(validatedUpdates.calculationExpression);
        finalUpdates.amount = calculationResult.result;
        
        // Update items if calculation provides them
        if (calculationResult.items) {
          finalUpdates.items = calculationResult.items.map((item, index) => ({
            id: '', // Will be handled by repository
            expenseId: expenseId,
            name: item.description || `Item ${index + 1}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.total
          }));
        }
      }

      // If items are updated, recalculate amount
      if (finalUpdates.items && finalUpdates.items.length > 0 && !validatedUpdates.calculationExpression) {
        const itemsWithTotal = finalUpdates.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice
        }));
        finalUpdates.amount = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
        finalUpdates.items = itemsWithTotal;
      }

      return await this.expenseRepository.update(existingExpense.id, finalUpdates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Delete an expense
   */
  async deleteExpense(expenseId: string, userId: string): Promise<void> {
    try {
      // Verify expense exists and belongs to user
      const existingExpense = await this.expenseRepository.findById(expenseId);
      if (!existingExpense) {
        throw new Error('Expense not found');
      }
      
      if (existingExpense.userId !== userId) {
        throw new Error('Expense does not belong to user');
      }

      await this.expenseRepository.delete(expenseId);
    } catch (error) {
      throw new Error(`Failed to delete expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total expenses for a period
   */
  async getTotalExpensesByPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.expenseRepository.getTotalByUserIdAndPeriod(userId, startDate, endDate);
    } catch (error) {
      throw new Error(`Failed to get total expenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get expenses with advanced filtering
   */
  async getExpensesWithFilters(userId: string, filters: ExpenseFilters): Promise<IExpense[]> {
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

      if (filters.hasItems !== undefined) {
        if (filters.hasItems) {
          queryFilters.items = { some: {} };
        } else {
          queryFilters.items = { none: {} };
        }
      }

      return await this.expenseRepository.findMany(queryFilters);
    } catch (error) {
      throw new Error(`Failed to get expenses with filters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent expenses for a user
   */
  async getRecentExpenses(userId: string, limit: number = 10): Promise<IExpense[]> {
    try {
      return await this.expenseRepository.findByUserId(userId, limit, 0);
    } catch (error) {
      throw new Error(`Failed to get recent expenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get expense statistics for a user
   */
  async getExpenseStatistics(userId: string, startDate: Date, endDate: Date): Promise<{
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
      const expenses = await this.getExpensesByDateRange(userId, startDate, endDate);
      
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalCount = expenses.length;
      const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

      // Group by category
      const categoryMap = new Map<string, { totalAmount: number; count: number; name: string }>();
      
      for (const expense of expenses) {
        const categoryId = expense.categoryId;
        const existing = categoryMap.get(categoryId);
        
        if (existing) {
          existing.totalAmount += expense.amount;
          existing.count += 1;
        } else {
          // Get category name
          const category = await this.categoryRepository.findById(categoryId);
          categoryMap.set(categoryId, {
            totalAmount: expense.amount,
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
      throw new Error(`Failed to get expense statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process receipt data into expense
   */
  async createExpenseFromReceipt(userId: string, receiptData: {
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    total: number;
    discount?: number;
    tax?: number;
    merchantName?: string;
    receiptImageUrl?: string;
  }, categoryId?: string): Promise<IExpense> {
    try {
      // Use provided category or find a default one
      let finalCategoryId = categoryId;
      if (!finalCategoryId) {
        const defaultCategories = await this.categoryRepository.findByType('EXPENSE', userId);
        const shoppingCategory = defaultCategories.find(cat => 
          cat.name.toLowerCase().includes('belanja') || 
          cat.name.toLowerCase().includes('shopping') ||
          cat.name.toLowerCase().includes('makanan')
        );
        
        if (shoppingCategory) {
          finalCategoryId = shoppingCategory.id;
        } else if (defaultCategories.length > 0) {
          finalCategoryId = defaultCategories[0].id;
        } else {
          throw new Error('No expense category available');
        }
      }

      const description = receiptData.merchantName 
        ? `Belanja di ${receiptData.merchantName}` 
        : 'Belanja dari struk';

      return await this.createExpense(userId, {
        userId,
        amount: receiptData.total,
        description,
        categoryId: finalCategoryId,
        receiptImageUrl: receiptData.receiptImageUrl,
        items: receiptData.items
      });
    } catch (error) {
      throw new Error(`Failed to create expense from receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
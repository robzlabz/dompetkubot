import { z } from 'zod';
import { ICategoryService } from '../interfaces/services.js';
import { ICategory } from '../interfaces/index.js';
import { ICategoryRepository } from '../interfaces/repositories.js';
import { OpenAIService } from './OpenAIService.js';

// Validation schemas
const CreateCategorySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Category name is required').max(50, 'Category name too long'),
  type: z.enum(['EXPENSE', 'INCOME'], { required_error: 'Category type is required' })
});

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  type: z.enum(['EXPENSE', 'INCOME']).optional()
});

export interface CreateCategoryData {
  userId: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
}

// Default Indonesian categories
const DEFAULT_EXPENSE_CATEGORIES = [
  'Makanan & Minuman',
  'Transportasi',
  'Belanja',
  'Tagihan',
  'Kesehatan',
  'Hiburan',
  'Pendidikan',
  'Pakaian',
  'Rumah Tangga',
  'Komunikasi',
  'Olahraga',
  'Kecantikan',
  'Hadiah',
  'Amal',
  'Lain-lain'
];

const DEFAULT_INCOME_CATEGORIES = [
  'Gaji',
  'Bonus',
  'Freelance',
  'Investasi',
  'Penjualan',
  'Hadiah',
  'Refund',
  'Lain-lain'
];

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private openAIService: OpenAIService
  ) {}

  /**
   * Get all categories for a user (including defaults)
   */
  async getUserCategories(userId: string): Promise<ICategory[]> {
    try {
      return await this.categoryRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new category for a user
   */
  async createCategory(userId: string, categoryData: CreateCategoryData): Promise<ICategory> {
    try {
      // Validate input data
      const validatedData = CreateCategorySchema.parse(categoryData);
      
      // Check if category with same name already exists for user
      const existingCategory = await this.categoryRepository.findByName(validatedData.name, userId);
      if (existingCategory) {
        throw new Error('Category with this name already exists');
      }

      // Create the category
      return await this.categoryRepository.create({
        name: validatedData.name,
        type: validatedData.type,
        isDefault: false,
        userId: userId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, userId: string, updates: Partial<ICategory>): Promise<ICategory> {
    try {
      // Validate update data
      const validatedUpdates = UpdateCategorySchema.parse(updates);
      
      // Verify category exists and belongs to user
      const existingCategory = await this.categoryRepository.findById(categoryId);
      if (!existingCategory) {
        throw new Error('Category not found');
      }
      
      // Only allow updating user's own categories (not defaults)
      if (existingCategory.isDefault || existingCategory.userId !== userId) {
        throw new Error('Cannot update default categories or categories that do not belong to user');
      }

      // Check for name conflicts if name is being updated
      if (validatedUpdates.name && validatedUpdates.name !== existingCategory.name) {
        const conflictingCategory = await this.categoryRepository.findByName(validatedUpdates.name, userId);
        if (conflictingCategory && conflictingCategory.id !== categoryId) {
          throw new Error('Category with this name already exists');
        }
      }

      return await this.categoryRepository.update(categoryId, validatedUpdates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string, userId: string): Promise<void> {
    try {
      // Verify category exists and belongs to user
      const existingCategory = await this.categoryRepository.findById(categoryId);
      if (!existingCategory) {
        throw new Error('Category not found');
      }
      
      // Only allow deleting user's own categories (not defaults)
      if (existingCategory.isDefault || existingCategory.userId !== userId) {
        throw new Error('Cannot delete default categories or categories that do not belong to user');
      }

      await this.categoryRepository.delete(categoryId);
    } catch (error) {
      throw new Error(`Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default categories
   */
  async getDefaultCategories(): Promise<ICategory[]> {
    try {
      return await this.categoryRepository.findDefaultCategories();
    } catch (error) {
      throw new Error(`Failed to get default categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find or create a category by name
   */
  async findOrCreateCategory(userId: string, categoryName: string, type: 'EXPENSE' | 'INCOME'): Promise<ICategory> {
    try {
      // First try to find existing category
      const existingCategory = await this.categoryRepository.findByName(categoryName, userId);
      if (existingCategory && existingCategory.type === type) {
        return existingCategory;
      }

      // Create new category if not found
      return await this.createCategory(userId, {
        userId,
        name: categoryName,
        type
      });
    } catch (error) {
      throw new Error(`Failed to find or create category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize default categories for a new user
   */
  async initializeDefaultCategories(): Promise<void> {
    try {
      // Check if default categories already exist
      const existingDefaults = await this.categoryRepository.findDefaultCategories();
      if (existingDefaults.length > 0) {
        return; // Already initialized
      }

      // Create default expense categories
      for (const categoryName of DEFAULT_EXPENSE_CATEGORIES) {
        await this.categoryRepository.create({
          name: categoryName,
          type: 'EXPENSE',
          isDefault: true,
          userId: undefined
        });
      }

      // Create default income categories
      for (const categoryName of DEFAULT_INCOME_CATEGORIES) {
        await this.categoryRepository.create({
          name: categoryName,
          type: 'INCOME',
          isDefault: true,
          userId: undefined
        });
      }
    } catch (error) {
      throw new Error(`Failed to initialize default categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Automatically categorize a transaction using AI
   */
  async categorizeTransaction(userId: string, description: string, type: 'EXPENSE' | 'INCOME'): Promise<ICategory> {
    try {
      // Get available categories for the user
      const availableCategories = await this.categoryRepository.findByType(type, userId);
      
      if (availableCategories.length === 0) {
        throw new Error(`No ${type.toLowerCase()} categories available`);
      }

      // Use AI to determine the best category
      const categoryName = await this.aiCategorizeTransaction(description, type, availableCategories);
      
      // Find the category by name
      const category = availableCategories.find(cat => 
        cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (category) {
        return category;
      }

      // If AI suggested category doesn't exist, use fallback logic
      return this.fallbackCategorization(description, type, availableCategories);
    } catch (error) {
      // Fallback to rule-based categorization if AI fails
      const availableCategories = await this.categoryRepository.findByType(type, userId);
      return this.fallbackCategorization(description, type, availableCategories);
    }
  }

  /**
   * Use AI to categorize transaction
   */
  private async aiCategorizeTransaction(
    description: string, 
    type: 'EXPENSE' | 'INCOME', 
    availableCategories: ICategory[]
  ): Promise<string> {
    try {
      const categoryNames = availableCategories.map(cat => cat.name).join(', ');
      
      const prompt = `
Kategorikan transaksi berikut dalam Bahasa Indonesia:
Deskripsi: "${description}"
Tipe: ${type === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'}

Kategori yang tersedia: ${categoryNames}

Pilih kategori yang paling sesuai dari daftar di atas. Jawab hanya dengan nama kategori yang tepat.

Contoh:
- "beli kopi" → Makanan & Minuman
- "bayar listrik" → Tagihan  
- "gaji bulanan" → Gaji
- "naik ojek" → Transportasi
`;

      const context = await this.openAIService.getConversationContext('system');
      const response = await this.openAIService.generateResponse(prompt, context);
      
      const suggestedCategory = response.content.trim();
      
      // Validate that the suggested category exists in available categories
      const matchingCategory = availableCategories.find((cat: ICategory) => 
        cat.name.toLowerCase().includes(suggestedCategory.toLowerCase()) ||
        suggestedCategory.toLowerCase().includes(cat.name.toLowerCase())
      );
      
      return matchingCategory ? matchingCategory.name : availableCategories[0]?.name || 'Lain-lain';
    } catch (error) {
      console.error('AI categorization failed:', error);
      // Return first available category as fallback
      return availableCategories[0]?.name;
    }
  }

  /**
   * Fallback rule-based categorization
   */
  private fallbackCategorization(
    description: string, 
    type: 'EXPENSE' | 'INCOME', 
    availableCategories: ICategory[]
  ): ICategory {
    const descLower = description.toLowerCase();
    
    if (type === 'EXPENSE') {
      // Expense categorization rules
      const expenseRules = [
        { keywords: ['makan', 'kopi', 'nasi', 'ayam', 'soto', 'bakso', 'minum', 'jus', 'teh'], category: 'Makanan & Minuman' },
        { keywords: ['ojek', 'grab', 'gojek', 'bus', 'kereta', 'bensin', 'parkir', 'tol'], category: 'Transportasi' },
        { keywords: ['listrik', 'air', 'internet', 'wifi', 'pulsa', 'token', 'pln'], category: 'Tagihan' },
        { keywords: ['baju', 'celana', 'sepatu', 'tas', 'jaket'], category: 'Pakaian' },
        { keywords: ['obat', 'dokter', 'rumah sakit', 'vitamin', 'medical'], category: 'Kesehatan' },
        { keywords: ['nonton', 'bioskop', 'game', 'netflix', 'spotify'], category: 'Hiburan' },
        { keywords: ['buku', 'kursus', 'sekolah', 'kuliah'], category: 'Pendidikan' },
        { keywords: ['sabun', 'shampo', 'deterjen', 'tissue'], category: 'Rumah Tangga' },
        { keywords: ['belanja', 'beli', 'shopping'], category: 'Belanja' }
      ];

      for (const rule of expenseRules) {
        if (rule.keywords.some(keyword => descLower.includes(keyword))) {
          const matchingCategory = availableCategories.find(cat => 
            cat.name.toLowerCase().includes(rule.category.toLowerCase())
          );
          if (matchingCategory) {
            return matchingCategory;
          }
        }
      }
    } else {
      // Income categorization rules
      const incomeRules = [
        { keywords: ['gaji', 'salary', 'upah'], category: 'Gaji' },
        { keywords: ['bonus', 'thr', 'insentif'], category: 'Bonus' },
        { keywords: ['freelance', 'project', 'kontrak'], category: 'Freelance' },
        { keywords: ['jual', 'penjualan', 'dagang'], category: 'Penjualan' },
        { keywords: ['investasi', 'dividen', 'bunga'], category: 'Investasi' },
        { keywords: ['hadiah', 'gift'], category: 'Hadiah' },
        { keywords: ['refund', 'pengembalian'], category: 'Refund' }
      ];

      for (const rule of incomeRules) {
        if (rule.keywords.some(keyword => descLower.includes(keyword))) {
          const matchingCategory = availableCategories.find(cat => 
            cat.name.toLowerCase().includes(rule.category.toLowerCase())
          );
          if (matchingCategory) {
            return matchingCategory;
          }
        }
      }
    }

    // Default to "Lain-lain" or first available category
    const defaultCategory = availableCategories.find(cat => 
      cat.name.toLowerCase().includes('lain') || 
      cat.name.toLowerCase().includes('umum')
    );
    
    if (defaultCategory) {
      return defaultCategory;
    }
    
    if (availableCategories.length === 0) {
      throw new Error('No categories available for fallback');
    }
    
    return availableCategories[0];
  }

  /**
   * Get categories by type
   */
  async getCategoriesByType(type: 'EXPENSE' | 'INCOME', userId?: string): Promise<ICategory[]> {
    try {
      return await this.categoryRepository.findByType(type, userId);
    } catch (error) {
      throw new Error(`Failed to get categories by type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search categories by name
   */
  async searchCategories(userId: string, searchTerm: string): Promise<ICategory[]> {
    try {
      const allCategories = await this.getUserCategories(userId);
      const searchLower = searchTerm.toLowerCase();
      
      return allCategories.filter(category =>
        category.name.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      throw new Error(`Failed to search categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get category usage statistics
   */
  async getCategoryUsageStats(userId: string, startDate: Date, endDate: Date): Promise<Array<{
    categoryId: string;
    categoryName: string;
    type: 'EXPENSE' | 'INCOME';
    transactionCount: number;
    totalAmount: number;
  }>> {
    try {
      // This would require additional repository methods to get transaction counts
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      throw new Error(`Failed to get category usage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Suggest categories based on user's transaction history
   */
  async suggestCategories(userId: string, type: 'EXPENSE' | 'INCOME'): Promise<string[]> {
    try {
      const existingCategories = await this.getCategoriesByType(type, userId);
      const existingNames = existingCategories.map(cat => cat.name.toLowerCase());
      
      const defaultCategories = type === 'EXPENSE' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
      
      // Suggest categories that don't exist yet
      const suggestions = defaultCategories.filter(name => 
        !existingNames.includes(name.toLowerCase())
      );
      
      return suggestions.slice(0, 5); // Return top 5 suggestions
    } catch (error) {
      throw new Error(`Failed to suggest categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk create categories
   */
  async bulkCreateCategories(userId: string, categories: Array<{ name: string; type: 'EXPENSE' | 'INCOME' }>): Promise<ICategory[]> {
    try {
      const createdCategories: ICategory[] = [];
      
      for (const categoryData of categories) {
        try {
          const category = await this.createCategory(userId, {
            userId,
            name: categoryData.name,
            type: categoryData.type
          });
          createdCategories.push(category);
        } catch (error) {
          // Skip categories that already exist or have validation errors
          console.warn(`Failed to create category "${categoryData.name}":`, error);
        }
      }
      
      return createdCategories;
    } catch (error) {
      throw new Error(`Failed to bulk create categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
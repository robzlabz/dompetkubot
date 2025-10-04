import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { ICategoryRepository } from '../interfaces/repositories.js';
import { ICategory } from '../interfaces/index.js';

export class CategoryRepository extends BaseRepository<ICategory, Omit<ICategory, 'id' | 'createdAt' | 'updatedAt'>, Partial<ICategory>> implements ICategoryRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<ICategory | null> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          user: true,
        },
      });

      return category ? this.mapToInterface(category) : null;
    } catch (error) {
      this.handleError(error, `Failed to find category by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<ICategory[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: {
          OR: [
            { userId: userId },
            { isDefault: true, userId: null },
          ],
        },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });

      return categories.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find categories for user: ${userId}`);
      throw error;
    }
  }

  async findDefaultCategories(): Promise<ICategory[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: {
          isDefault: true,
          userId: null,
        },
        orderBy: { name: 'asc' },
      });

      return categories.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find default categories');
      throw error;
    }
  }

  async create(categoryData: Omit<ICategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICategory> {
    try {
      this.validateRequiredFields(categoryData, ['name', 'type']);

      const category = await this.prisma.category.create({
        data: {
          name: categoryData.name,
          type: categoryData.type,
          isDefault: categoryData.isDefault || false,
          userId: categoryData.userId,
        },
      });

      return this.mapToInterface(category);
    } catch (error) {
      this.handleError(error, 'Failed to create category');
      throw error;
    }
  }

  async update(id: string, categoryData: Partial<ICategory>): Promise<ICategory> {
    try {
      const sanitizedData = this.sanitizeData(categoryData);
      
      const category = await this.prisma.category.update({
        where: { id },
        data: sanitizedData,
      });

      return this.mapToInterface(category);
    } catch (error) {
      this.handleError(error, `Failed to update category: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Check if category is being used by expenses or incomes
      const expenseCount = await this.prisma.expense.count({
        where: { categoryId: id },
      });

      const incomeCount = await this.prisma.income.count({
        where: { categoryId: id },
      });

      const budgetCount = await this.prisma.budget.count({
        where: { categoryId: id },
      });

      if (expenseCount > 0 || incomeCount > 0 || budgetCount > 0) {
        throw new Error('Cannot delete category that is being used by transactions or budgets');
      }

      await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete category: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<ICategory[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: filters,
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });

      return categories.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find categories');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.category.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count categories');
      throw error;
    }
  }

  /**
   * Find categories by type (EXPENSE or INCOME)
   */
  async findByType(type: 'EXPENSE' | 'INCOME', userId?: string): Promise<ICategory[]> {
    try {
      const whereClause: any = { type };
      
      if (userId) {
        whereClause.OR = [
          { userId: userId },
          { isDefault: true, userId: null },
        ];
      } else {
        whereClause.isDefault = true;
        whereClause.userId = null;
      }

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });

      return categories.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find categories by type: ${type}`);
      throw error;
    }
  }

  /**
   * Find category by name for a specific user (including defaults)
   */
  async findByName(name: string, userId?: string): Promise<ICategory | null> {
    try {
      const whereClause: any = { 
        name: { equals: name, mode: 'insensitive' } 
      };
      
      if (userId) {
        whereClause.OR = [
          { userId: userId },
          { isDefault: true, userId: null },
        ];
      } else {
        whereClause.isDefault = true;
        whereClause.userId = null;
      }

      const category = await this.prisma.category.findFirst({
        where: whereClause,
        orderBy: { isDefault: 'desc' }, // Prefer user categories over defaults
      });

      return category ? this.mapToInterface(category) : null;
    } catch (error) {
      this.handleError(error, `Failed to find category by name: ${name}`);
      throw error;
    }
  }

  private mapToInterface(category: any): ICategory {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      isDefault: category.isDefault,
      userId: category.userId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
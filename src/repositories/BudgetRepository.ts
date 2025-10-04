import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IBudgetRepository } from '../interfaces/repositories.js';
import { IBudget } from '../interfaces/index.js';

export class BudgetRepository extends BaseRepository<IBudget, Omit<IBudget, 'id' | 'createdAt' | 'updatedAt'>, Partial<IBudget>> implements IBudgetRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<IBudget | null> {
    try {
      const budget = await this.prisma.budget.findUnique({
        where: { id },
        include: {
          category: true,
          user: true,
        },
      });

      return budget ? this.mapToInterface(budget) : null;
    } catch (error) {
      this.handleError(error, `Failed to find budget by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<IBudget[]> {
    try {
      const budgets = await this.prisma.budget.findMany({
        where: { userId },
        include: {
          category: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return budgets.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find budgets for user: ${userId}`);
      throw error;
    }
  }

  async findActiveByUserIdAndCategory(userId: string, categoryId: string): Promise<IBudget | null> {
    try {
      const now = new Date();
      const budget = await this.prisma.budget.findFirst({
        where: {
          userId,
          categoryId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return budget ? this.mapToInterface(budget) : null;
    } catch (error) {
      this.handleError(error, `Failed to find active budget for user ${userId} and category ${categoryId}`);
      throw error;
    }
  }

  async create(budgetData: Omit<IBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<IBudget> {
    try {
      this.validateRequiredFields(budgetData, ['userId', 'categoryId', 'amount', 'period', 'startDate', 'endDate']);

      const budget = await this.prisma.budget.create({
        data: {
          userId: budgetData.userId,
          categoryId: budgetData.categoryId,
          amount: budgetData.amount,
          period: budgetData.period,
          startDate: budgetData.startDate,
          endDate: budgetData.endDate,
        },
        include: {
          category: true,
          user: true,
        },
      });

      return this.mapToInterface(budget);
    } catch (error) {
      this.handleError(error, 'Failed to create budget');
      throw error;
    }
  }

  async update(id: string, budgetData: Partial<IBudget>): Promise<IBudget> {
    try {
      const sanitizedData = this.sanitizeData(budgetData);
      
      const budget = await this.prisma.budget.update({
        where: { id },
        data: sanitizedData,
        include: {
          category: true,
          user: true,
        },
      });

      return this.mapToInterface(budget);
    } catch (error) {
      this.handleError(error, `Failed to update budget: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.budget.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete budget: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IBudget[]> {
    try {
      const budgets = await this.prisma.budget.findMany({
        where: filters,
        include: {
          category: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return budgets.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find budgets');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.budget.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count budgets');
      throw error;
    }
  }

  private mapToInterface(budget: any): IBudget {
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: budget.amount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
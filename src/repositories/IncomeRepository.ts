import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IIncomeRepository } from '../interfaces/repositories.js';
import { IIncome } from '../interfaces/index.js';

export class IncomeRepository extends BaseRepository<IIncome, Omit<IIncome, 'id' | 'createdAt' | 'updatedAt'>, Partial<IIncome>> implements IIncomeRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<IIncome | null> {
    try {
      const income = await this.prisma.income.findUnique({
        where: { id },
        include: {
          category: true,
          user: true,
        },
      });

      return income ? this.mapToInterface(income) : null;
    } catch (error) {
      this.handleError(error, `Failed to find income by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<IIncome[]> {
    try {
      const queryOptions: any = {
        where: { userId },
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      };

      this.applyPagination(queryOptions, limit, offset);

      const incomes = await this.prisma.income.findMany(queryOptions);
      return incomes.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find incomes for user: ${userId}`);
      throw error;
    }
  }

  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<IIncome[]> {
    try {
      const incomes = await this.prisma.income.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return incomes.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find incomes for user ${userId} in date range`);
      throw error;
    }
  }

  async create(incomeData: Omit<IIncome, 'id' | 'createdAt' | 'updatedAt'>): Promise<IIncome> {
    try {
      this.validateRequiredFields(incomeData, ['userId', 'amount', 'description', 'categoryId']);

      const income = await this.prisma.income.create({
        data: {
          userId: incomeData.userId,
          amount: incomeData.amount,
          description: incomeData.description,
          categoryId: incomeData.categoryId,
        },
        include: {
          category: true,
        },
      });

      return this.mapToInterface(income);
    } catch (error) {
      this.handleError(error, 'Failed to create income');
      throw error;
    }
  }

  async update(id: string, incomeData: Partial<IIncome>): Promise<IIncome> {
    try {
      const sanitizedData = this.sanitizeData(incomeData);
      
      const income = await this.prisma.income.update({
        where: { id },
        data: sanitizedData,
        include: {
          category: true,
        },
      });

      return this.mapToInterface(income);
    } catch (error) {
      this.handleError(error, `Failed to update income: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.income.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete income: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IIncome[]> {
    try {
      const incomes = await this.prisma.income.findMany({
        where: filters,
        include: {
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return incomes.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find incomes');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.income.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count incomes');
      throw error;
    }
  }

  async getTotalByUserIdAndPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      const result = await this.prisma.income.aggregate({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          amount: true,
        },
      });

      return result._sum.amount || 0;
    } catch (error) {
      this.handleError(error, `Failed to get total income for user ${userId}`);
      throw error;
    }
  }

  private mapToInterface(income: any): IIncome {
    return {
      id: income.id,
      userId: income.userId,
      amount: income.amount,
      description: income.description,
      categoryId: income.categoryId,
      createdAt: income.createdAt,
      updatedAt: income.updatedAt,
    };
  }
}
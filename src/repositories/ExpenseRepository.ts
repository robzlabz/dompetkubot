import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IExpenseRepository } from '../interfaces/repositories.js';
import { IExpense, IExpenseItem } from '../interfaces/index.js';

export class ExpenseRepository extends BaseRepository<IExpense, Omit<IExpense, 'id' | 'createdAt' | 'updatedAt'>, Partial<IExpense>> implements IExpenseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<IExpense | null> {
    try {
      const expense = await this.prisma.expense.findUnique({
        where: { id },
        include: {
          items: true,
          category: true,
          user: true,
        },
      });

      return expense ? this.mapToInterface(expense) : null;
    } catch (error) {
      this.handleError(error, `Failed to find expense by ID: ${id}`);
      throw error;
    }
  }

  async findByExpenseId(expenseId: string): Promise<IExpense | null> {
    try {
      const expense = await this.prisma.expense.findUnique({
        where: { expenseId },
        include: {
          items: true,
          category: true,
          user: true,
        },
      });

      return expense ? this.mapToInterface(expense) : null;
    } catch (error) {
      this.handleError(error, `Failed to find expense by expenseId: ${expenseId}`);
      throw error;
    }
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<IExpense[]> {
    try {
      const queryOptions: any = {
        where: { userId },
        include: {
          items: true,
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      };

      this.applyPagination(queryOptions, limit, offset);

      const expenses = await this.prisma.expense.findMany(queryOptions);
      return expenses.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find expenses for user: ${userId}`);
      throw error;
    }
  }

  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<IExpense[]> {
    try {
      const expenses = await this.prisma.expense.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: true,
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return expenses.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find expenses for user ${userId} in date range`);
      throw error;
    }
  }

  async create(expenseData: Omit<IExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<IExpense> {
    try {
      this.validateRequiredFields(expenseData, ['userId', 'amount', 'description', 'categoryId']);

      const expense = await this.prisma.expense.create({
        data: {
          userId: expenseData.userId,
          expenseId: (expenseData as any).expenseId,
          amount: expenseData.amount,
          description: expenseData.description,
          categoryId: expenseData.categoryId,
          calculationExpression: expenseData.calculationExpression,
          receiptImageUrl: expenseData.receiptImageUrl,
          items: expenseData.items ? {
            create: expenseData.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            }))
          } : undefined,
        },
        include: {
          items: true,
          category: true,
        },
      });

      return this.mapToInterface(expense);
    } catch (error) {
      this.handleError(error, 'Failed to create expense');
      throw error;
    }
  }

  async update(id: string, expenseData: Partial<IExpense>): Promise<IExpense> {
    try {
      const sanitizedData = this.sanitizeData(expenseData);
      
      // Handle items separately if provided
      const { items, ...updateData } = sanitizedData;

      const expense = await this.prisma.expense.update({
        where: { id },
        data: {
          ...updateData,
          // If items are provided, replace all existing items
          ...(items && {
            items: {
              deleteMany: {},
              create: items.map((item: IExpenseItem) => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              }))
            }
          })
        },
        include: {
          items: true,
          category: true,
        },
      });

      return this.mapToInterface(expense);
    } catch (error) {
      this.handleError(error, `Failed to update expense: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.expense.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete expense: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IExpense[]> {
    try {
      const expenses = await this.prisma.expense.findMany({
        where: filters,
        include: {
          items: true,
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return expenses.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find expenses');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.expense.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count expenses');
      throw error;
    }
  }

  async getTotalByUserIdAndPeriod(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      const result = await this.prisma.expense.aggregate({
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
      this.handleError(error, `Failed to get total expenses for user ${userId}`);
      throw error;
    }
  }

  private mapToInterface(expense: any): IExpense {
    return {
      id: expense.id,
      expenseId: expense.expenseId,
      userId: expense.userId,
      amount: expense.amount,
      description: expense.description,
      categoryId: expense.categoryId,
      calculationExpression: expense.calculationExpression,
      receiptImageUrl: expense.receiptImageUrl,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      items: expense.items?.map((item: any) => ({
        id: item.id,
        expenseId: item.expenseId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };
  }
}
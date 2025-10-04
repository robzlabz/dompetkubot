import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IBudgetService, ICategoryService } from '../../../interfaces/services.js';

const SetBudgetSchema = z.object({
  categoryName: z.string().describe('Name of the category to set budget for'),
  amount: z.number().positive().describe('Budget amount in Indonesian Rupiah'),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('MONTHLY').describe('Budget period'),
});

export class SetBudgetTool extends BaseTool {
  name = 'set_budget';
  description = 'Set or update a budget for a specific category when user mentions setting budget limits. Examples: "budget makanan 1 juta", "atur budget transportasi 500rb per bulan", "budget hiburan 200rb"';
  parameters = SetBudgetSchema;

  constructor(
    private budgetService: IBudgetService,
    private categoryService: ICategoryService
  ) {
    super();
  }

  async execute(params: z.infer<typeof SetBudgetSchema>, userId: string): Promise<ToolResult> {
    try {
      // Find or create category
      const category = await this.categoryService.findOrCreateCategory(
        userId,
        params.categoryName,
        'EXPENSE'
      );

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (params.period) {
        case 'DAILY':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          break;
        case 'WEEKLY':
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear() + 1, 0, 1);
          break;
        case 'MONTHLY':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
      }

      // Create budget
      const budget = await this.budgetService.createBudget(userId, {
        categoryId: category.id,
        amount: params.amount,
        period: params.period,
        startDate,
        endDate,
      });

      return {
        success: true,
        data: {
          ...budget,
          categoryName: category.name,
        },
        message: `Budget set for ${category.name}: Rp ${params.amount.toLocaleString('id-ID')} per ${params.period.toLowerCase()}`,
        metadata: {
          transactionId: budget.id,
        },
      };
    } catch (error) {
      console.error('Error setting budget:', error);
      return {
        success: false,
        message: 'Failed to set budget',
        error: 'BUDGET_CREATION_FAILED',
      };
    }
  }
}
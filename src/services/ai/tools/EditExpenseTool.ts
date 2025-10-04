import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IExpenseService, ICategoryService } from '../../../interfaces/services.js';

const EditExpenseSchema = z.object({
  expenseId: z.string().optional().describe('ID of the expense to edit (if not provided, will edit the most recent expense)'),
  amount: z.number().positive().optional().describe('New amount for the expense'),
  description: z.string().optional().describe('New description for the expense'),
  category: z.string().optional().describe('New category for the expense'),
});

export class EditExpenseTool extends BaseTool {
  name = 'edit_expense';
  description = 'Edit an existing expense when user wants to modify a previous expense. Examples: "ubah pembelian kopi tadi jadi 30rb", "ganti pengeluaran terakhir jadi 50rb"';
  parameters = EditExpenseSchema;

  constructor(
    private expenseService: IExpenseService,
    private categoryService: ICategoryService
  ) {
    super();
  }

  async execute(params: z.infer<typeof EditExpenseSchema>, userId: string): Promise<ToolResult> {
    try {
      let expenseId = params.expenseId;

      // If no expense ID provided, get the most recent expense
      if (!expenseId) {
        const recentExpenses = await this.expenseService.getUserExpenses(userId, 1);
        if (recentExpenses.length === 0) {
          return {
            success: false,
            message: 'No expenses found to edit',
            error: 'NO_EXPENSES_FOUND',
          };
        }
        expenseId = recentExpenses[0].id;
      }

      // Prepare update data
      const updateData: any = {};

      if (params.amount !== undefined) {
        updateData.amount = params.amount;
      }

      if (params.description !== undefined) {
        updateData.description = params.description;
      }

      if (params.category !== undefined) {
        const category = await this.categoryService.findOrCreateCategory(
          userId,
          params.category,
          'EXPENSE'
        );
        updateData.categoryId = category.id;
      }

      // Update expense
      const updatedExpense = await this.expenseService.updateExpense(
        expenseId,
        userId,
        updateData
      );

      return {
        success: true,
        data: updatedExpense,
        message: `Expense updated: ${updatedExpense.description} - Rp ${updatedExpense.amount.toLocaleString('id-ID')}`,
        metadata: {
          transactionId: updatedExpense.id,
        },
      };
    } catch (error) {
      console.error('Error editing expense:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return {
          success: false,
          message: 'Expense not found',
          error: 'EXPENSE_NOT_FOUND',
        };
      }

      return {
        success: false,
        message: 'Failed to edit expense',
        error: 'EXPENSE_EDIT_FAILED',
      };
    }
  }
}
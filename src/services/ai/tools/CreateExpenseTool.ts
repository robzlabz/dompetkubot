import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IExpenseService, ICategoryService } from '../../../interfaces/services.js';
import { OpenAIService } from '../../OpenAIService.js';

const CreateExpenseSchema = z.object({
  amount: z.number().positive().describe('Amount of the expense in Indonesian Rupiah'),
  description: z.string().min(1).describe('Description of the expense in Indonesian'),
  category: z.string().optional().describe('Category name for the expense (optional, will be auto-categorized if not provided)'),
  calculationExpression: z.string().optional().describe('Mathematical expression if the amount was calculated (e.g., "5kg @ 10rb")'),
  items: z.array(z.object({
    name: z.string().describe('Name of the item'),
    quantity: z.number().positive().describe('Quantity of the item'),
    unitPrice: z.number().positive().describe('Price per unit in Rupiah'),
  })).optional().describe('Individual items if this is an itemized expense'),
});

export class CreateExpenseTool extends BaseTool {
  name = 'create_expense';
  description = 'Create a new expense record when user mentions spending money, buying something, or paying for something in Indonesian. Examples: "beli kopi 25rb", "bayar listrik 150000", "belanja groceries 200rb"';
  parameters = CreateExpenseSchema;

  constructor(
    private expenseService: IExpenseService,
    private categoryService: ICategoryService,
    private openAIService: OpenAIService
  ) {
    super();
  }

  async execute(params: z.infer<typeof CreateExpenseSchema>, userId: string): Promise<ToolResult> {
    try {
      // Parse calculation if provided
      let finalAmount = params.amount;
      let calculationExpression = params.calculationExpression;
      let items = params.items;

      // If calculation expression is provided, try to parse it
      if (calculationExpression) {
        const calculation = await this.openAIService.parseCalculation(calculationExpression);
        if (calculation) {
          finalAmount = calculation.result;
          calculationExpression = calculation.expression;
          if (calculation.items) {
            items = calculation.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            }));
          }
        }
      }

      // Auto-categorize if category not provided
      let categoryId: string;
      let chosenCategoryName: string | undefined;
      if (params.category) {
        chosenCategoryName = params.category;
        const category = await this.categoryService.findOrCreateCategory(
          userId,
          params.category,
          'EXPENSE'
        );
        categoryId = category.id;
      } else {
        // Use AI to categorize
        const categoryName = await this.categorizeExpense(params.description);
        chosenCategoryName = categoryName;
        const category = await this.categoryService.findOrCreateCategory(
          userId,
          categoryName,
          'EXPENSE'
        );
        categoryId = category.id;
      }

      // Create expense
      const expense = await this.expenseService.createExpense(userId, {
        amount: finalAmount,
        description: params.description,
        categoryId,
        calculationExpression,
        items: items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      return {
        success: true,
        data: expense,
        message: `Expense created: ${params.description} - Rp ${finalAmount.toLocaleString('id-ID')}`,
        metadata: {
          transactionId: expense.id,
          calculationExpression,
          categoryName: chosenCategoryName,
        },
      };
    } catch (error) {
      console.error('Error creating expense:', error);
      return {
        success: false,
        message: 'Failed to create expense',
        error: 'EXPENSE_CREATION_FAILED',
      };
    }
  }

  private async categorizeExpense(description: string): Promise<string> {
    try {
      const prompt = `
Categorize this Indonesian expense description into one of these categories:
- Makanan (food, drinks, restaurants)
- Transportasi (transport, fuel, parking)
- Belanja (shopping, groceries, household items)
- Tagihan (bills, utilities, subscriptions)
- Hiburan (entertainment, movies, games)
- Kesehatan (health, medicine, doctor)
- Pendidikan (education, books, courses)
- Lainnya (others)

Description: "${description}"

Return only the category name in Indonesian.
`;

      const context = {
        userId: 'system',
        recentMessages: [],
        userPreferences: { language: 'id', timezone: 'Asia/Jakarta' },
      };

      const response = await this.openAIService.generateResponse(prompt, context);
      const category = response.content.trim();

      // Validate category
      const validCategories = [
        'Makanan', 'Transportasi', 'Belanja', 'Tagihan', 
        'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'
      ];

      return validCategories.includes(category) ? category : 'Lainnya';
    } catch (error) {
      console.error('Error categorizing expense:', error);
      return 'Lainnya';
    }
  }
}
import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IIncomeService, ICategoryService } from '../../../interfaces/services.js';
import { OpenAIService } from '../../OpenAIService.js';

const CreateIncomeSchema = z.object({
  amount: z.number().positive().describe('Amount of the income in Indonesian Rupiah'),
  description: z.string().min(1).describe('Description of the income in Indonesian'),
  category: z.string().optional().describe('Category name for the income (optional, will be auto-categorized if not provided)'),
});

export class CreateIncomeTool extends BaseTool {
  name = 'create_income';
  description = 'Create a new income record when user mentions receiving money, salary, bonus, or any income in Indonesian. Examples: "gaji bulan ini 5 juta", "dapat bonus 500rb", "terima uang dari freelance 2 juta"';
  parameters = CreateIncomeSchema;

  constructor(
    private incomeService: IIncomeService,
    private categoryService: ICategoryService,
    private openAIService: OpenAIService
  ) {
    super();
  }

  async execute(params: z.infer<typeof CreateIncomeSchema>, userId: string): Promise<ToolResult> {
    try {
      // Auto-categorize if category not provided
      let categoryId: string;
      if (params.category) {
        const category = await this.categoryService.findOrCreateCategory(
          userId,
          params.category,
          'INCOME'
        );
        categoryId = category.id;
      } else {
        // Use AI to categorize
        const categoryName = await this.categorizeIncome(params.description);
        const category = await this.categoryService.findOrCreateCategory(
          userId,
          categoryName,
          'INCOME'
        );
        categoryId = category.id;
      }

      // Create income (include userId to satisfy service validation)
      const income = await this.incomeService.createIncome(userId, {
        amount: params.amount,
        description: params.description || 'Pendapatan',
        categoryId,
      });

      return {
        success: true,
        data: income,
        message: `Income created: ${params.description} - Rp ${params.amount.toLocaleString('id-ID')}`,
        metadata: {
          transactionId: income.id,
        },
      };
    } catch (error) {
      console.error('Error creating income:', error);
      return {
        success: false,
        message: 'Failed to create income',
        error: 'INCOME_CREATION_FAILED',
      };
    }
  }

  private async categorizeIncome(description: string): Promise<string> {
    try {
      const prompt = `
Categorize this Indonesian income description into one of these categories:
- Gaji (salary, regular income)
- Bonus (bonus, incentives)
- Freelance (freelance work, side jobs)
- Investasi (investment returns, dividends)
- Bisnis (business income, sales)
- Hadiah (gifts, prizes)
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
        'Gaji', 'Bonus', 'Freelance', 'Investasi', 
        'Bisnis', 'Hadiah', 'Lainnya'
      ];

      return validCategories.includes(category) ? category : 'Lainnya';
    } catch (error) {
      console.error('Error categorizing income:', error);
      return 'Lainnya';
    }
  }
}
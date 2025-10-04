import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { ICategoryService } from '../../../interfaces/services.js';

const CategoryManagementSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'list']).describe('Action to perform on categories'),
  categoryName: z.string().optional().describe('Name of the category (required for create, update, delete)'),
  newCategoryName: z.string().optional().describe('New name for the category (for update action)'),
  categoryType: z.enum(['EXPENSE', 'INCOME']).optional().describe('Type of category (required for create)'),
});

export class CategoryManagementTool extends BaseTool {
  name = 'manage_category';
  description = 'Manage categories when user wants to create, update, delete, or list categories. Examples: "buat kategori investasi", "hapus kategori hiburan", "ubah nama kategori", "lihat semua kategori"';
  parameters = CategoryManagementSchema;

  constructor(private categoryService: ICategoryService) {
    super();
  }

  async execute(params: z.infer<typeof CategoryManagementSchema>, userId: string): Promise<ToolResult> {
    try {
      switch (params.action) {
        case 'create':
          return await this.createCategory(userId, params);
        case 'update':
          return await this.updateCategory(userId, params);
        case 'delete':
          return await this.deleteCategory(userId, params);
        case 'list':
          return await this.listCategories(userId);
        default:
          return {
            success: false,
            message: 'Invalid action specified',
            error: 'INVALID_ACTION',
          };
      }
    } catch (error) {
      console.error('Error managing category:', error);
      return {
        success: false,
        message: 'Failed to manage category',
        error: 'CATEGORY_MANAGEMENT_FAILED',
      };
    }
  }

  private async createCategory(
    userId: string,
    params: z.infer<typeof CategoryManagementSchema>
  ): Promise<ToolResult> {
    if (!params.categoryName || !params.categoryType) {
      return {
        success: false,
        message: 'Category name and type are required for creation',
        error: 'MISSING_PARAMETERS',
      };
    }

    const category = await this.categoryService.createCategory(userId, {
      name: params.categoryName,
      type: params.categoryType,
    });

    return {
      success: true,
      data: category,
      message: `Category "${params.categoryName}" created successfully`,
      metadata: {
        action: 'created',
      },
    };
  }

  private async updateCategory(
    userId: string,
    params: z.infer<typeof CategoryManagementSchema>
  ): Promise<ToolResult> {
    if (!params.categoryName || !params.newCategoryName) {
      return {
        success: false,
        message: 'Both current and new category names are required for update',
        error: 'MISSING_PARAMETERS',
      };
    }

    // Find existing category
    const categories = await this.categoryService.getUserCategories(userId);
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === params.categoryName!.toLowerCase()
    );

    if (!existingCategory) {
      return {
        success: false,
        message: `Category "${params.categoryName}" not found`,
        error: 'CATEGORY_NOT_FOUND',
      };
    }

    const updatedCategory = await this.categoryService.updateCategory(
      existingCategory.id,
      userId,
      { name: params.newCategoryName }
    );

    return {
      success: true,
      data: updatedCategory,
      message: `Category renamed from "${params.categoryName}" to "${params.newCategoryName}"`,
      metadata: {
        action: 'updated',
      },
    };
  }

  private async deleteCategory(
    userId: string,
    params: z.infer<typeof CategoryManagementSchema>
  ): Promise<ToolResult> {
    if (!params.categoryName) {
      return {
        success: false,
        message: 'Category name is required for deletion',
        error: 'MISSING_PARAMETERS',
      };
    }

    // Find existing category
    const categories = await this.categoryService.getUserCategories(userId);
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === params.categoryName!.toLowerCase()
    );

    if (!existingCategory) {
      return {
        success: false,
        message: `Category "${params.categoryName}" not found`,
        error: 'CATEGORY_NOT_FOUND',
      };
    }

    // Don't allow deletion of default categories
    if (existingCategory.isDefault) {
      return {
        success: false,
        message: 'Cannot delete default categories',
        error: 'CANNOT_DELETE_DEFAULT',
      };
    }

    await this.categoryService.deleteCategory(existingCategory.id, userId);

    return {
      success: true,
      data: { name: params.categoryName },
      message: `Category "${params.categoryName}" deleted successfully`,
      metadata: {
        action: 'deleted',
      },
    };
  }

  private async listCategories(userId: string): Promise<ToolResult> {
    const categories = await this.categoryService.getUserCategories(userId);
    const defaultCategories = await this.categoryService.getDefaultCategories();

    const allCategories = [...defaultCategories, ...categories];
    
    // Group by type
    const expenseCategories = allCategories.filter(cat => cat.type === 'EXPENSE');
    const incomeCategories = allCategories.filter(cat => cat.type === 'INCOME');

    return {
      success: true,
      data: {
        expenseCategories: expenseCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          isDefault: cat.isDefault,
        })),
        incomeCategories: incomeCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          isDefault: cat.isDefault,
        })),
        total: allCategories.length,
      },
      message: `Found ${allCategories.length} categories (${expenseCategories.length} expense, ${incomeCategories.length} income)`,
      metadata: {
        action: 'listed',
      },
    };
  }
}
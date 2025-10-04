import { ToolRegistry } from './ToolRegistry.js';
import { OpenAIService } from '../OpenAIService.js';
import {
  CreateExpenseTool,
  EditExpenseTool,
  CreateIncomeTool,
  SetBudgetTool,
  AddBalanceTool,
  RedeemVoucherTool,
  CategoryManagementTool,
  GenerateReportTool,
  BudgetStatusTool,
  HelpTool,
} from './tools/index.js';

// Service interfaces (these will be implemented in other tasks)
import {
  IExpenseService,
  IIncomeService,
  ICategoryService,
  IBudgetService,
  IWalletService,
  IVoucherService,
  IReportingService,
} from '../../interfaces/services.js';

export interface ToolFactoryDependencies {
  expenseService: IExpenseService;
  incomeService: IIncomeService;
  categoryService: ICategoryService;
  budgetService: IBudgetService;
  walletService: IWalletService;
  voucherService: IVoucherService;
  reportingService: IReportingService;
  openAIService: OpenAIService;
  helpService?: any; // HelpService - optional for backward compatibility
}

export class ToolFactory {
  /**
   * Initialize and register all AI tools
   */
  static initializeTools(
    toolRegistry: ToolRegistry,
    dependencies: ToolFactoryDependencies
  ): void {
    const {
      expenseService,
      incomeService,
      categoryService,
      budgetService,
      walletService,
      voucherService,
      reportingService,
      openAIService,
      helpService,
    } = dependencies;

    // Register expense-related tools
    toolRegistry.registerTool(
      new CreateExpenseTool(expenseService, categoryService, openAIService)
    );
    
    toolRegistry.registerTool(
      new EditExpenseTool(expenseService, categoryService)
    );

    // Register income tools
    toolRegistry.registerTool(
      new CreateIncomeTool(incomeService, categoryService, openAIService)
    );

    // Register budget tools
    toolRegistry.registerTool(
      new SetBudgetTool(budgetService, categoryService)
    );

    // Register wallet tools
    toolRegistry.registerTool(
      new AddBalanceTool(walletService)
    );

    // Register voucher tools
    toolRegistry.registerTool(
      new RedeemVoucherTool(voucherService, walletService)
    );

    // Register category management tools
    toolRegistry.registerTool(
      new CategoryManagementTool(categoryService)
    );

    // Register reporting tools
    toolRegistry.registerTool(
      new GenerateReportTool(reportingService)
    );

    toolRegistry.registerTool(
      new BudgetStatusTool(reportingService, categoryService)
    );

    // Register help tool if helpService is available
    if (helpService) {
      toolRegistry.registerTool(
        new HelpTool(helpService)
      );
    }
  }

  /**
   * Get list of all available tool names
   */
  static getAvailableToolNames(): string[] {
    return [
      'create_expense',
      'edit_expense',
      'create_income',
      'set_budget',
      'add_balance',
      'redeem_voucher',
      'manage_category',
      'generate_report',
      'check_budget_status',
      'help_tool',
    ];
  }

  /**
   * Get tool descriptions for documentation
   */
  static getToolDescriptions(): Record<string, string> {
    return {
      create_expense: 'Create a new expense record from Indonesian text',
      edit_expense: 'Edit an existing expense record',
      create_income: 'Create a new income record from Indonesian text',
      set_budget: 'Set or update budget for a category',
      add_balance: 'Add balance to user wallet',
      redeem_voucher: 'Redeem a voucher code for rewards',
      manage_category: 'Create, update, delete, or list categories',
      generate_report: 'Generate spending and income reports and summaries',
      check_budget_status: 'Check budget status and spending progress',
      help_tool: 'Provide help and guidance when user input is unclear or user needs assistance',
    };
  }
}
import { nanoid } from 'nanoid';
import { OpenAIService, ConversationContext } from './OpenAIService.js';
import { ToolResult } from './ai/ToolRegistry.js';
import { CurrencyUtils } from '../utils/CurrencyUtils.js';

export interface ResponseFormatOptions {
  includeCalculation?: boolean;
  includeItems?: boolean;
  transactionId?: string;
  personalizedComment?: string;
  showBreakdown?: boolean;
}

export interface FormattedResponse {
  text: string;
  transactionId: string;
  metadata?: {
    hasCalculation?: boolean;
    hasItems?: boolean;
    hasComment?: boolean;
  };
}

/**
 * Service responsible for formatting bot responses according to the Indonesian budget bot format:
 * "[check] berhasil tercatat! `nanoid()` [details] [comment]"
 */
export class ResponseFormatterService {
  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
  }

  /**
   * Format tool execution result into user-friendly response
   */
  async formatToolResponse(
    toolName: string,
    toolResult: ToolResult,
    originalMessage: string,
    context: ConversationContext,
    options: ResponseFormatOptions = {}
  ): Promise<FormattedResponse> {
    if (!toolResult.success) {
      return this.formatErrorResponse(toolResult.error || 'UNKNOWN_ERROR', toolResult.message);
    }

    const transactionId = options.transactionId || nanoid(8);
    
    switch (toolName) {
      case 'create_expense':
        return await this.formatExpenseResponse(toolResult, transactionId, originalMessage, context, options);
      
      case 'create_income':
        return await this.formatIncomeResponse(toolResult, transactionId, originalMessage, context, options);
      
      case 'set_budget':
        return await this.formatBudgetResponse(toolResult, transactionId, options);
      
      case 'add_balance':
        return await this.formatBalanceResponse(toolResult, transactionId, options);
      
      case 'redeem_voucher':
        return await this.formatVoucherResponse(toolResult, transactionId, options);
      
      case 'edit_expense':
        return await this.formatEditExpenseResponse(toolResult, transactionId, options);
      
      case 'manage_category':
        return await this.formatCategoryResponse(toolResult, transactionId, options);
      
      default:
        return this.formatGenericResponse(toolResult, transactionId, options);
    }
  }

  /**
   * Format expense creation response with calculation display and itemized breakdown
   */
  private async formatExpenseResponse(
    toolResult: ToolResult,
    transactionId: string,
    originalMessage: string,
    context: ConversationContext,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const expense = toolResult.data;
    const amount = expense.amount;
    const description = expense.description;
    
    // Generate personalized comment
    const comment = options.personalizedComment || await this.openAIService.generatePersonalizedComment(
      'expense',
      description,
      amount,
      context
    );

    let response = '✅ berhasil tercatat! `' + transactionId + '`';
    
    // Add calculation display if present
    if (toolResult.metadata?.calculationExpression && options.includeCalculation !== false) {
      response += ` ${this.formatCalculationDisplay(
        toolResult.metadata.calculationExpression,
        amount
      )}`;
      
      // Add detailed breakdown for complex calculations
      if ((toolResult.metadata as any)?.calculationResult) {
        response += this.formatCalculationBreakdown((toolResult.metadata as any).calculationResult);
      }
    } else {
      response += ` ${description} ${this.formatCurrency(amount)}`;
    }

    // Add itemized breakdown if present (for receipts)
    const hasItems = expense.items && expense.items.length > 0;
    if (hasItems && options.includeItems !== false) {
      response += this.formatItemizedBreakdown(expense.items);
    }

    // Add personalized comment
    if (comment) {
      response += `\n\n${comment}`;
    }

    return {
      text: response,
      transactionId,
      metadata: {
        hasCalculation: !!toolResult.metadata?.calculationExpression,
        hasItems,
        hasComment: !!comment,
      },
    };
  }

  /**
   * Format income creation response
   */
  private async formatIncomeResponse(
    toolResult: ToolResult,
    transactionId: string,
    originalMessage: string,
    context: ConversationContext,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const income = toolResult.data;
    const amount = income.amount;
    const description = income.description;
    
    // Generate personalized comment
    const comment = options.personalizedComment || await this.openAIService.generatePersonalizedComment(
      'income',
      description,
      amount,
      context
    );

    const response = `✅ berhasil tercatat! \`${transactionId}\` ${description} ${this.formatCurrency(amount)}\n\n${comment}`;

    return {
      text: response,
      transactionId,
      metadata: {
        hasComment: !!comment,
      },
    };
  }

  /**
   * Format budget setting response
   */
  private async formatBudgetResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const budget = toolResult.data;
    const response = `✅ berhasil tercatat! \`${transactionId}\` Budget ${budget.categoryName} ${this.formatCurrency(budget.amount)} per ${budget.period.toLowerCase()}\n\nBudget berhasil diatur! Saya akan beri tahu kalau pengeluaran sudah mendekati batas.`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format balance addition response
   */
  private async formatBalanceResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const wallet = toolResult.data;
    const addedAmount = (toolResult.metadata as any)?.amount || 0;
    const response = `✅ berhasil tercatat! \`${transactionId}\` Saldo ditambah ${this.formatCurrency(addedAmount)}\n\nSaldo sekarang: ${this.formatCurrency(wallet.balance)} | Koin: ${this.formatCoins(wallet.coins)}`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format voucher redemption response
   */
  private async formatVoucherResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const voucher = toolResult.data;
    const benefitText = voucher.type === 'COINS' 
      ? `${this.formatCoins(voucher.value)} koin` 
      : this.formatCurrency(voucher.value);
    
    const response = `✅ berhasil tercatat! \`${transactionId}\` Voucher ${voucher.code} berhasil digunakan!\n\nSelamat! Kamu dapat ${benefitText}`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format expense edit response
   */
  private async formatEditExpenseResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const expense = toolResult.data;
    const response = `✅ berhasil tercatat! \`${transactionId}\` Pengeluaran diubah: ${expense.description} ${this.formatCurrency(expense.amount)}\n\nData berhasil diperbarui!`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format category management response
   */
  private async formatCategoryResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): Promise<FormattedResponse> {
    const action = (toolResult.metadata as any)?.action || 'updated';
    const category = toolResult.data;
    
    const actionText: Record<string, string> = {
      created: 'dibuat',
      updated: 'diperbarui',
      deleted: 'dihapus',
    };
    const actionDisplay = actionText[action] || 'diproses';

    const response = `✅ berhasil tercatat! \`${transactionId}\` Kategori "${category.name}" ${actionDisplay}\n\nKategori berhasil ${actionDisplay}!`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format generic successful response
   */
  private formatGenericResponse(
    toolResult: ToolResult,
    transactionId: string,
    options: ResponseFormatOptions
  ): FormattedResponse {
    const response = `✅ berhasil tercatat! \`${transactionId}\` ${toolResult.message}`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Format error responses in Indonesian
   */
  private formatErrorResponse(errorCode: string, message: string): FormattedResponse {
    const errorMessages: Record<string, string> = {
      INSUFFICIENT_BALANCE: '❌ Saldo koin tidak cukup. Silakan tambah saldo terlebih dahulu.',
      VOUCHER_INVALID: '❌ Kode voucher tidak valid atau sudah kadaluarsa.',
      VOUCHER_ALREADY_USED: '❌ Voucher ini sudah pernah digunakan.',
      CATEGORY_NOT_FOUND: '❌ Kategori tidak ditemukan.',
      EXPENSE_NOT_FOUND: '❌ Pengeluaran tidak ditemukan.',
      VALIDATION_ERROR: '❌ Data yang dimasukkan tidak valid. Silakan periksa kembali.',
      TOOL_NOT_FOUND: '❌ Fitur yang diminta tidak tersedia.',
      EXECUTION_ERROR: '❌ Terjadi kesalahan saat memproses permintaan.',
    };

    const errorText = errorMessages[errorCode] || `❌ ${message}`;

    return {
      text: errorText,
      transactionId: nanoid(8), // Still generate ID for consistency
    };
  }

  /**
   * Format calculation display for mathematical expressions
   * Example: "5kg @ Rp. 10.000 = Rp. 50.000"
   */
  private formatCalculationDisplay(expression: string, result: number): string {
    // Clean up the expression to make it more readable
    const cleanExpression = expression
      .replace(/\*/g, ' × ')
      .replace(/x/gi, ' × ')
      .replace(/@/g, ' @ ')
      .replace(/\s+/g, ' ')
      .trim();

    return `${cleanExpression} = ${this.formatCurrency(result)}`;
  }

  /**
   * Format detailed calculation breakdown for complex expressions
   * Shows step-by-step calculation for multiple items
   */
  private formatCalculationBreakdown(calculationResult: any): string {
    if (!calculationResult?.items || calculationResult.items.length <= 1) {
      return '';
    }

    let breakdown = '\n\nCalculation:';
    calculationResult.items.forEach((item: any, index: number) => {
      const itemDescription = item.description ? ` ${item.description}` : '';
      breakdown += `\n• ${item.quantity}${itemDescription} × ${this.formatCurrency(item.unitPrice)} = ${this.formatCurrency(item.total)}`;
    });

    return breakdown;
  }

  /**
   * Format itemized breakdown for receipts and complex purchases
   */
  private formatItemizedBreakdown(items: any[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    let breakdown = '\n\nItems:';
    items.forEach((item: any) => {
      const unitPrice = this.formatCurrency(item.unitPrice);
      const totalPrice = this.formatCurrency(item.totalPrice);
      breakdown += `\n• ${item.name} ${item.quantity}x @ ${unitPrice} = ${totalPrice}`;
    });

    return breakdown;
  }

  /**
   * Format Indonesian Rupiah currency
   */
  private formatCurrency(amount: number): string {
    return CurrencyUtils.formatRupiah(amount);
  }

  /**
   * Format Indonesian Rupiah currency with readable suffixes
   */
  private formatCurrencyReadable(amount: number): string {
    return CurrencyUtils.formatRupiahReadable(amount);
  }

  /**
   * Format coin amounts (supports float values)
   */
  private formatCoins(coins: number): string {
    return CurrencyUtils.formatCoins(coins);
  }

  /**
   * Format percentage for budget displays
   */
  private formatPercentage(percentage: number): string {
    return CurrencyUtils.formatPercentage(percentage);
  }

  /**
   * Generate a simple success response for basic operations
   */
  async formatSimpleSuccess(
    message: string,
    options: ResponseFormatOptions = {}
  ): Promise<FormattedResponse> {
    const transactionId = options.transactionId || nanoid(8);
    const response = `✅ berhasil tercatat! \`${transactionId}\` ${message}`;

    return {
      text: response,
      transactionId,
    };
  }

  /**
   * Generate a response for operations that don't need transaction tracking
   */
  formatInfoResponse(message: string): string {
    return `ℹ️ ${message}`;
  }

  /**
   * Generate a help response
   */
  formatHelpResponse(helpText: string): string {
    return `💡 ${helpText}`;
  }

  /**
   * Format spending summary response
   */
  formatSpendingSummary(summaryData: {
    period: string;
    totalSpent: number;
    categories: Array<{
      name: string;
      amount: number;
      percentage: number;
    }>;
    budgetStatus?: Array<{
      categoryName: string;
      spent: number;
      budget: number;
      percentage: number;
    }>;
  }): string {
    let response = `📊 **Ringkasan Pengeluaran ${summaryData.period}**\n\n`;
    response += `Total: ${this.formatCurrency(summaryData.totalSpent)}\n\n`;

    // Category breakdown
    if (summaryData.categories.length > 0) {
      response += '**Per Kategori:**\n';
      summaryData.categories.forEach(category => {
        response += `• ${category.name}: ${this.formatCurrency(category.amount)} (${this.formatPercentage(category.percentage)})\n`;
      });
    }

    // Budget status if available
    if (summaryData.budgetStatus && summaryData.budgetStatus.length > 0) {
      response += '\n**Status Budget:**\n';
      summaryData.budgetStatus.forEach(budget => {
        const status = budget.percentage >= 100 ? '🔴' : budget.percentage >= 80 ? '🟡' : '🟢';
        response += `${status} ${budget.categoryName}: ${this.formatCurrency(budget.spent)} / ${this.formatCurrency(budget.budget)} (${this.formatPercentage(budget.percentage)})\n`;
      });
    }

    return response;
  }

  /**
   * Format itemized purchase breakdown for complex receipts
   */
  formatReceiptBreakdown(receiptData: {
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      discount?: number;
    }>;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    merchantName?: string;
  }): string {
    let response = '';

    if (receiptData.merchantName) {
      response += `📄 **${receiptData.merchantName}**\n\n`;
    }

    response += '**Items:**\n';
    receiptData.items.forEach(item => {
      let itemLine = `• ${item.name} ${item.quantity}x @ ${this.formatCurrency(item.unitPrice)}`;
      
      if (item.discount && item.discount > 0) {
        itemLine += ` (-${this.formatCurrency(item.discount)})`;
      }
      
      itemLine += ` = ${this.formatCurrency(item.totalPrice)}\n`;
      response += itemLine;
    });

    response += `\nSubtotal: ${this.formatCurrency(receiptData.subtotal)}`;
    
    if (receiptData.discount && receiptData.discount > 0) {
      response += `\nDiscount: -${this.formatCurrency(receiptData.discount)}`;
    }
    
    if (receiptData.tax && receiptData.tax > 0) {
      response += `\nTax: ${this.formatCurrency(receiptData.tax)}`;
    }
    
    response += `\n**Total: ${this.formatCurrency(receiptData.total)}**`;

    return response;
  }

  /**
   * Format budget alert messages
   */
  formatBudgetAlert(alertData: {
    categoryName: string;
    spent: number;
    budget: number;
    percentage: number;
    alertType: '80_percent' | '100_percent' | 'exceeded';
  }): string {
    const { categoryName, spent, budget, percentage, alertType } = alertData;
    
    let emoji = '⚠️';
    let message = '';
    
    switch (alertType) {
      case '80_percent':
        emoji = '🟡';
        message = `Hati-hati! Pengeluaran ${categoryName} sudah mencapai ${this.formatPercentage(percentage)} dari budget.`;
        break;
      case '100_percent':
        emoji = '🔴';
        message = `Budget ${categoryName} sudah habis! Pengeluaran mencapai ${this.formatPercentage(percentage)} dari budget.`;
        break;
      case 'exceeded':
        emoji = '🚨';
        message = `Budget ${categoryName} sudah terlampaui! Pengeluaran ${this.formatPercentage(percentage)} dari budget.`;
        break;
    }
    
    return `${emoji} **Budget Alert**\n\n${message}\n\nPengeluaran: ${this.formatCurrency(spent)}\nBudget: ${this.formatCurrency(budget)}`;
  }
}
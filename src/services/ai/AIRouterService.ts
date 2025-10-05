import { OpenAIService, ConversationContext, AIResponse, ToolCall } from '../OpenAIService.js';
import { ToolRegistry, ToolResult } from './ToolRegistry.js';
import { IConversationRepository } from '../../interfaces/repositories.js';
import { nanoid } from 'nanoid';

export interface RouteResult {
  toolCall?: ToolCall;
  response: string;
  requiresToolExecution: boolean;
  metadata?: {
    confidence?: number;
    alternativeTools?: string[];
    tokensIn?: number;
    tokensOut?: number;
  };
}

export interface ResponseFormatOptions {
  includeCalculation?: boolean;
  includeItems?: boolean;
  transactionId?: string;
  personalizedComment?: string;
}

export class AIRouterService {
  private openAIService: OpenAIService;
  private toolRegistry: ToolRegistry;
  private conversationRepo: IConversationRepository;

  constructor(
    openAIService: OpenAIService,
    toolRegistry: ToolRegistry,
    conversationRepo: IConversationRepository
  ) {
    this.openAIService = openAIService;
    this.toolRegistry = toolRegistry;
    this.conversationRepo = conversationRepo;
  }

  /**
   * Route a message to appropriate tools and generate response
   */
  async routeMessage(
    message: string,
    userId: string
  ): Promise<RouteResult> {
    try {
      // Get conversation context
      const context = await this.openAIService.getConversationContext(userId);

      // Get available tools
      const tools = this.toolRegistry.getOpenAITools();

      // Generate AI response with tool calls
      const aiResponse = await this.openAIService.generateResponse(
        message,
        context,
        tools
      );


      // If AI wants to use a tool
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const toolCall = aiResponse.toolCalls[0]; // Use first tool call

        try {
          // Parse tool parameters
          const parameters = JSON.parse(toolCall?.function.arguments || '{}');

          // Heuristics for Indonesian timeframe phrases and invalid enum coercion
          if (toolCall?.function?.name === 'generate_report') {
            const input = message.toLowerCase();
            const now = new Date();
            const allowed = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

            // Normalize invalid or missing reportType
            if (!parameters.reportType || !allowed.includes(parameters.reportType)) {
              if (/\bkemarin\b/.test(input)) {
                parameters.reportType = 'DAILY';
                parameters.date = this.toISODate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
              } else if (/(hari ini|today)/.test(input)) {
                parameters.reportType = 'DAILY';
                parameters.date = this.toISODate(now);
              } else if (/(minggu ini|pekan ini)/.test(input)) {
                parameters.reportType = 'WEEKLY';
                const monday = this.getWeekStart(now);
                parameters.weekStartDate = this.toISODate(monday);
              } else if (/(bulan ini|bulan sekarang)/.test(input)) {
                parameters.reportType = 'MONTHLY';
                parameters.month = now.getMonth() + 1;
                parameters.year = now.getFullYear();
              } else if (/(tahun ini)/.test(input)) {
                parameters.reportType = 'YEARLY';
                parameters.year = now.getFullYear();
              } else if (/(beli|belanja|pengeluaran|spending|expense)/.test(input)) {
                // Default to monthly spending overview when intent mentions purchases/expenses
                parameters.reportType = 'MONTHLY';
                parameters.month = now.getMonth() + 1;
                parameters.year = now.getFullYear();
              } else {
                // Safe fallback
                parameters.reportType = 'MONTHLY';
                parameters.month = now.getMonth() + 1;
                parameters.year = now.getFullYear();
              }
            }
          }

          // Guard: prevent accidental expense creation for messages without amounts
          if (toolCall?.function?.name === 'create_expense') {
            const hasAmountParam = typeof parameters?.amount === 'number' && parameters.amount > 0;
            const containsNumericHint = /(?:\d|rp\.?|idr|rb|ribu|jt|juta|k)/i.test(message);
            if (!hasAmountParam && !containsNumericHint) {
              const guardedResponse = this.getFallbackResponse(message);
              return {
                response: guardedResponse,
                requiresToolExecution: false,
                metadata: { 
                  confidence: 0.5,
                  tokensIn: aiResponse.usage?.promptTokens,
                  tokensOut: aiResponse.usage?.completionTokens,
                },
              };
            }
          }

          // Execute the tool
          const toolResult = await this.toolRegistry.executeTool(
            toolCall?.function.name || '',
            parameters,
            userId
          );

          // Generate formatted response
          const formattedResponse = await this.formatToolResponse(
            toolCall?.function.name || '',
            toolResult,
            message,
            context
          );

          return {
            toolCall,
            response: formattedResponse,
            requiresToolExecution: true,
            metadata: {
              confidence: 0.9, // High confidence when tool is called
              tokensIn: aiResponse.usage?.promptTokens,
              tokensOut: aiResponse.usage?.completionTokens,
            },
          };
        } catch (error) {
          console.error('Error executing tool:', error);
          const errorResponse = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.';
          return {
            response: errorResponse,
            requiresToolExecution: false,
          };
        }
      }

      // No tool needed - check if we should provide help
      if (!aiResponse.content || aiResponse.content.length < 10) {
        // AI response is too short or empty, try help tool
        try {
          const helpResult = await this.toolRegistry.executeTool(
            'help_tool',
            { query: message },
            userId
          );

          if (helpResult.success && helpResult.message) {
            return {
              response: helpResult.message,
              requiresToolExecution: false,
              metadata: {
                confidence: 0.6, // Medium confidence for help responses
                tokensIn: aiResponse.usage?.promptTokens,
                tokensOut: aiResponse.usage?.completionTokens,
              },
            };
          }
        } catch (helpError) {
          console.error('Error using help tool:', helpError);
        }
      }

      // Return AI response or fallback
      const response = aiResponse.content || this.getFallbackResponse(message);
      return {
        response,
        requiresToolExecution: false,
        metadata: {
          confidence: aiResponse.content ? 0.7 : 0.4, // Lower confidence for fallback
          tokensIn: aiResponse.usage?.promptTokens,
          tokensOut: aiResponse.usage?.completionTokens,
        },
      };
    } catch (error) {
      console.error('Error in AI routing:', error);
      // Try to provide helpful fallback based on user input
      const fallbackResponse = this.getFallbackResponse(message);
      return {
        response: fallbackResponse,
        requiresToolExecution: false,
        metadata: {
          confidence: 0.3, // Low confidence for error fallbacks
        },
      };
    }
  }

  /**
   * Format tool execution result into user-friendly response
   */
  private async formatToolResponse(
    toolName: string,
    toolResult: ToolResult,
    originalMessage: string,
    context: ConversationContext
  ): Promise<string> {
    if (!toolResult.success) {
      return this.formatErrorResponse(toolResult.error || 'UNKNOWN_ERROR', toolResult.message);
    }

    const transactionId = nanoid(8);

    switch (toolName) {
      case 'create_expense': {
        const txId = (toolResult.data && (toolResult.data as any).expenseId) ? (toolResult.data as any).expenseId : transactionId;
        return await this.formatExpenseResponse(toolResult, txId, originalMessage, context);
      }

      case 'create_income':
        return await this.formatIncomeResponse(toolResult, transactionId, originalMessage, context);

      case 'set_budget':
        return await this.formatBudgetResponse(toolResult, transactionId);

      case 'add_balance':
        return await this.formatBalanceResponse(toolResult, transactionId);

      case 'redeem_voucher':
        return await this.formatVoucherResponse(toolResult, transactionId);

      case 'edit_expense': {
        const txId = (toolResult.data && (toolResult.data as any).expenseId) ? (toolResult.data as any).expenseId : transactionId;
        return await this.formatEditExpenseResponse(toolResult, txId);
      }

      case 'manage_category':
        return await this.formatCategoryResponse(toolResult, transactionId);

      case 'generate_report':
        // For reports, return the tool’s formatted message directly
        return toolResult.message || 'Laporan berhasil dibuat.';

      case 'check_budget_status':
        return toolResult.message || 'Status budget berhasil ditampilkan.';

      default:
        return `✅ berhasil tercatat! \`${transactionId}\` ${toolResult.message}`;
    }
  }

  /**
   * Format expense creation response
   */
  private async formatExpenseResponse(
    toolResult: ToolResult,
    transactionId: string,
    originalMessage: string,
    context: ConversationContext
  ): Promise<string> {
    const expense = toolResult.data;
    const amount = expense.amount;
    const description = expense.description;
    const categoryName = (expense?.category?.name) || ((toolResult.metadata as any)?.categoryName);

    // Generate personalized comment
    const comment = await this.openAIService.generatePersonalizedComment(
      'expense',
      description,
      amount,
      context
    );

    // Build response to match requested template
    let response = `✅ berhasil tercatat!\n`;
    response += `id transaksi: \`${transactionId}\``;
    if (categoryName) {
      response += `\nkategori: ${categoryName}`;
    }

    response += `\n\n`;

    // If items exist, list each as "Rp. total - name", else single line "Rp. amount - description"
    if (expense.items && expense.items.length > 0) {
      const totals = expense.items.map((item: any) => {
        const total = (typeof item.totalPrice === 'number' && !isNaN(item.totalPrice))
          ? item.totalPrice
          : (item.quantity || 0) * (item.unitPrice || 0);
        return Math.max(0, total);
      });
      const itemsSum = totals.reduce((s: number, v: number) => s + v, 0);
      const isConsistent = itemsSum > 0 && amount > 0
        ? Math.abs(itemsSum - amount) / Math.max(itemsSum, amount) <= 0.1
        : itemsSum > 0;

      if (isConsistent) {
        expense.items.forEach((item: any, idx: number) => {
          const total = totals[idx];
          const name = (item.name && !/^item\s*\d+$/i.test(item.name)) ? item.name : description;
          response += `Rp. ${total.toLocaleString('id-ID')} - ${name}\n`;
        });
      } else {
        response += `Rp. ${amount.toLocaleString('id-ID')} - ${description}`;
      }
    } else {
      response += `Rp. ${amount.toLocaleString('id-ID')} - ${description}`;
    }

    // Add personalized short comment
    if (comment) {
      response += `\n\n"${comment}"`;
    }

    return response;
  }

  // Helper: Get Monday of current week
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun - 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Monday as start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Helper: Format date as YYYY-MM-DD
  private toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Format income creation response
   */
  private async formatIncomeResponse(
    toolResult: ToolResult,
    transactionId: string,
    originalMessage: string,
    context: ConversationContext
  ): Promise<string> {
    const income = toolResult.data;
    const amount = income.amount;
    const description = income.description;

    // Generate personalized comment
    const comment = await this.openAIService.generatePersonalizedComment(
      'income',
      description,
      amount,
      context
    );

    return `✅ berhasil tercatat! \`${transactionId}\` ${description} Rp ${amount.toLocaleString('id-ID')}\n\n${comment}`;
  }

  /**
   * Format budget setting response
   */
  private async formatBudgetResponse(
    toolResult: ToolResult,
    transactionId: string
  ): Promise<string> {
    const budget = toolResult.data;
    return `✅ berhasil tercatat! \`${transactionId}\` Budget ${budget.categoryName} Rp ${budget.amount.toLocaleString('id-ID')} per ${budget.period.toLowerCase()}\n\nBudget berhasil diatur! Saya akan beri tahu kalau pengeluaran sudah mendekati batas.`;
  }

  /**
   * Format balance addition response
   */
  private async formatBalanceResponse(
    toolResult: ToolResult,
    transactionId: string
  ): Promise<string> {
    const wallet = toolResult.data;
    return `✅ berhasil tercatat! \`${transactionId}\` Saldo ditambah Rp ${toolResult.metadata?.amount?.toLocaleString('id-ID')}\n\nSaldo sekarang: Rp ${wallet.balance.toLocaleString('id-ID')} | Koin: ${wallet.coins}`;
  }

  /**
   * Format voucher redemption response
   */
  private async formatVoucherResponse(
    toolResult: ToolResult,
    transactionId: string
  ): Promise<string> {
    const voucher = toolResult.data;
    return `✅ berhasil tercatat! \`${transactionId}\` Voucher ${voucher.code} berhasil digunakan!\n\nSelamat! Kamu dapat ${voucher.type === 'COINS' ? `${voucher.value} koin` : `Rp ${voucher.value.toLocaleString('id-ID')}`}`;
  }

  /**
   * Format expense edit response
   */
  private async formatEditExpenseResponse(
    toolResult: ToolResult,
    transactionId: string
  ): Promise<string> {
    const expense = toolResult.data;
    return `✅ berhasil tercatat! \`${transactionId}\` Pengeluaran diubah: ${expense.description} Rp ${expense.amount.toLocaleString('id-ID')}\n\nData berhasil diperbarui!`;
  }

  /**
   * Format category management response
   */
  private async formatCategoryResponse(
    toolResult: ToolResult,
    transactionId: string
  ): Promise<string> {
    const action = toolResult.metadata?.action || 'updated';
    const category = toolResult.data;

    const actionText: Record<string, string> = {
      created: 'dibuat',
      updated: 'diperbarui',
      deleted: 'dihapus',
    };

    return `✅ berhasil tercatat! \`${transactionId}\` Kategori "${category.name}" ${actionText[action] || 'diproses'}\n\nKategori berhasil ${actionText[action] || 'diproses'}!`;
  }

  /**
   * Format error responses in Indonesian
   */
  private formatErrorResponse(errorCode: string, message: string): string {
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

    return errorMessages[errorCode] || `❌ ${message}`;
  }

  /**
   * Store conversation in database
   */
  private async storeConversation(
    userId: string,
    message: string,
    role: 'user' | 'assistant',
    tokensIn?: number,
    tokensOut?: number
  ): Promise<void> {
    try {
      await this.conversationRepo.create({
        userId,
        message,
        response: role === 'assistant' ? message : '',
        messageType: 'TEXT',
        toolUsed: undefined,
        coinsUsed: undefined,
        tokensIn,
        tokensOut,
      });
    } catch (error) {
      console.error('Error storing conversation:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get routing suggestions for unclear input
   */
  async getRoutingSuggestions(message: string): Promise<string[]> {
    const suggestions = [
      'Coba katakan "beli kopi 25rb" untuk mencatat pengeluaran',
      'Katakan "gaji 5 juta" untuk mencatat pemasukan',
      'Katakan "budget makanan 1 juta" untuk mengatur budget',
      'Katakan "tambah saldo 50rb" untuk menambah saldo',
      'Katakan "pakai voucher ABC123" untuk menggunakan voucher',
    ];

    // Return random suggestions
    return suggestions.slice(0, 3);
  }

  /**
   * Generate fallback response for unclear or failed input
   */
  private getFallbackResponse(message: string): string {
    const input = message.toLowerCase();

    // Provide contextual fallback based on detected intent
    if (input.includes('beli') || input.includes('bayar') || input.includes('byr')) {
      return `🤔 **Sepertinya Anda ingin mencatat pengeluaran...**\n\n💡 **Coba format ini:**\n• "beli kopi 25rb"\n• "bayar listrik 150000"\n• "belanja groceries 5kg ayam @ 12rb"\n\nKetik /help pengeluaran untuk panduan lengkap.`;
    }

    if (input.includes('gaji') || input.includes('bonus') || input.includes('dapat')) {
      return `🤔 **Sepertinya Anda ingin mencatat pemasukan...**\n\n💡 **Coba format ini:**\n• "gaji bulan ini 5 juta"\n• "dapat bonus 500rb"\n• "freelance project 2 juta"\n\nKetik /help pemasukan untuk panduan lengkap.`;
    }

    if (input.includes('budget') || input.includes('anggaran')) {
      return `🤔 **Sepertinya Anda ingin mengatur budget...**\n\n💡 **Coba format ini:**\n• "budget makanan 1 juta"\n• "budget transportasi 500rb"\n• "status budget" - untuk cek budget\n\nKetik /help budget untuk panduan lengkap.`;
    }

    if (input.includes('laporan') || input.includes('ringkasan')) {
      return `🤔 **Sepertinya Anda ingin melihat laporan...**\n\n💡 **Coba format ini:**\n• "laporan bulan ini"\n• "ringkasan minggu ini"\n• "pengeluaran hari ini"\n\nKetik /help laporan untuk panduan lengkap.`;
    }

    if (input.includes('saldo') || input.includes('koin')) {
      return `🤔 **Sepertinya Anda ingin mengecek atau menambah saldo...**\n\n💡 **Coba format ini:**\n• "saldo koin" - cek saldo\n• "tambah saldo 50rb" - top up\n• "berapa koin saya"\n\nKetik /help koin untuk panduan lengkap.`;
    }

    // General fallback
    return `🤖 **Hmm, saya tidak mengerti...**\n\nBisa dijelaskan dengan cara lain?\n\n💡 **Contoh yang bisa saya pahami:**\n• "beli kopi 25rb" - catat pengeluaran\n• "gaji 5 juta" - catat pemasukan\n• "budget makanan 1 juta" - atur budget\n• "laporan bulan ini" - lihat ringkasan\n\nKetik /help untuk panduan lengkap.`;
  }
}

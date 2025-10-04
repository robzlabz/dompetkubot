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
      
      // Store user message in conversation history
      await this.storeConversation(userId, message, 'user');

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
          const parameters = JSON.parse(toolCall.function.arguments);
          
          // Execute the tool
          const toolResult = await this.toolRegistry.executeTool(
            toolCall.function.name,
            parameters,
            userId
          );

          // Generate formatted response
          const formattedResponse = await this.formatToolResponse(
            toolCall.function.name,
            toolResult,
            message,
            context
          );

          // Store assistant response
          await this.storeConversation(userId, formattedResponse, 'assistant');

          return {
            toolCall,
            response: formattedResponse,
            requiresToolExecution: true,
            metadata: {
              confidence: 0.9, // High confidence when tool is called
            },
          };
        } catch (error) {
          console.error('Error executing tool:', error);
          
          const errorResponse = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.';
          await this.storeConversation(userId, errorResponse, 'assistant');
          
          return {
            response: errorResponse,
            requiresToolExecution: false,
          };
        }
      }

      // No tool needed, return AI response
      const response = aiResponse.content || 'Maaf, saya tidak mengerti. Bisa dijelaskan lagi?';
      await this.storeConversation(userId, response, 'assistant');

      return {
        response,
        requiresToolExecution: false,
        metadata: {
          confidence: 0.7, // Lower confidence for general responses
        },
      };
    } catch (error) {
      console.error('Error in AI routing:', error);
      
      const fallbackResponse = 'Maaf, sistem sedang mengalami gangguan. Silakan coba lagi nanti.';
      await this.storeConversation(userId, fallbackResponse, 'assistant');
      
      return {
        response: fallbackResponse,
        requiresToolExecution: false,
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
      case 'create_expense':
        return await this.formatExpenseResponse(toolResult, transactionId, originalMessage, context);
      
      case 'create_income':
        return await this.formatIncomeResponse(toolResult, transactionId, originalMessage, context);
      
      case 'set_budget':
        return await this.formatBudgetResponse(toolResult, transactionId);
      
      case 'add_balance':
        return await this.formatBalanceResponse(toolResult, transactionId);
      
      case 'redeem_voucher':
        return await this.formatVoucherResponse(toolResult, transactionId);
      
      case 'edit_expense':
        return await this.formatEditExpenseResponse(toolResult, transactionId);
      
      case 'manage_category':
        return await this.formatCategoryResponse(toolResult, transactionId);
      
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
    
    // Generate personalized comment
    const comment = await this.openAIService.generatePersonalizedComment(
      'expense',
      description,
      amount,
      context
    );

    let response = `✅ berhasil tercatat! \`${transactionId}\``;
    
    // Add calculation if present
    if (toolResult.metadata?.calculationExpression) {
      response += ` ${toolResult.metadata.calculationExpression} = Rp ${amount.toLocaleString('id-ID')}`;
    } else {
      response += ` ${description} Rp ${amount.toLocaleString('id-ID')}`;
    }

    // Add items breakdown if present
    if (expense.items && expense.items.length > 0) {
      response += '\n\nItems:';
      expense.items.forEach((item: any) => {
        response += `\n• ${item.name} ${item.quantity}x @ Rp ${item.unitPrice.toLocaleString('id-ID')} = Rp ${item.totalPrice.toLocaleString('id-ID')}`;
      });
    }

    // Add personalized comment
    response += `\n\n${comment}`;

    return response;
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
    
    const actionText = {
      created: 'dibuat',
      updated: 'diperbarui',
      deleted: 'dihapus',
    }[action] || 'diproses';

    return `✅ berhasil tercatat! \`${transactionId}\` Kategori "${category.name}" ${actionText}\n\nKategori berhasil ${actionText}!`;
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
    role: 'user' | 'assistant'
  ): Promise<void> {
    try {
      await this.conversationRepo.create({
        userId,
        message,
        response: role === 'assistant' ? message : '',
        messageType: 'TEXT',
        toolUsed: undefined,
        coinsUsed: undefined,
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
}
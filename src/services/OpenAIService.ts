import OpenAI from 'openai';
import { env } from '../config/environment.js';
import { IConversationRepository } from '../interfaces/repositories.js';
import { z } from 'zod';
import { color } from 'bun';

// Types for OpenAI service
export interface ConversationContext {
  userId: string;
  recentMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  userPreferences?: {
    language: string;
    timezone: string;
  };
}

export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Error types for OpenAI service
export class OpenAIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

export class OpenAIService {
  private client: OpenAI;
  private conversationRepo: IConversationRepository;
  private readonly maxContextMessages = 10;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(conversationRepo: IConversationRepository) {
    this.conversationRepo = conversationRepo;

    // Initialize OpenAI client with configurable endpoint
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  /**
   * Get conversation context for a user
   */
  async getConversationContext(userId: string): Promise<ConversationContext> {
    try {
      const recentConversations = await this.conversationRepo.findRecentByUserId(
        userId,
        this.maxContextMessages
      );

      const recentMessages = recentConversations.flatMap(conv => [
        {
          role: 'assistant' as const,
          content: conv.response,
          timestamp: conv.createdAt,
        },
        {
          role: 'user' as const,
          content: conv.message,
          timestamp: conv.createdAt,
        },
      ]);

      return {
        userId,
        recentMessages,
        userPreferences: {
          language: 'id', // Indonesian by default
          timezone: 'Asia/Jakarta',
        },
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return {
        userId,
        recentMessages: [],
        userPreferences: {
          language: 'id',
          timezone: 'Asia/Jakarta',
        },
      };
    }
  }

  /**
   * Generate AI response with conversation context
   */
  async generateResponse(
    message: string,
    context: ConversationContext,
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  ): Promise<AIResponse> {
    try {
      const messages = this.buildMessages(message, context);

      console.dir({messages}, {depth:null,colors:true})

      const completion = await this.callOpenAIWithRetry({
        model: env.OPENAI_MODEL,
        messages,
        tools,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new OpenAIServiceError('No response from OpenAI', 'NO_RESPONSE');
      }

      const toolCalls = choice.message.tool_calls?.map(call => ({
        id: call.id,
        type: call.type,
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      })) as ToolCall[] | undefined;

      return {
        content: choice.message.content || '',
        toolCalls,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof OpenAIServiceError) {
        throw error;
      }

      console.error('Error generating AI response:', error);
      throw new OpenAIServiceError(
        'Failed to generate AI response',
        'GENERATION_FAILED',
        error as Error
      );
    }
  }

  /**
   * Parse mathematical expressions from Indonesian text
   */
  async parseCalculation(text: string): Promise<{
    expression: string;
    result: number;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  } | null> {
    try {
      const prompt = `
Parse this Indonesian text for mathematical calculations and return a JSON object:
Text: "${text}"

Look for patterns like:
- "5kg @ 10rb" (5 × 10,000)
- "3 buah @ 2500" (3 × 2,500)
- "ayam 2kg, perkilonya 15rb" (2 × 15,000)

Return JSON with:
{
  "expression": "readable calculation",
  "result": number,
  "items": [{"name": "item", "quantity": number, "unitPrice": number, "total": number}]
}

Return null if no calculations found.
`;

      const completion = await this.callOpenAIWithRetry({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = completion.choices[0]?.message.content;
      if (!content) return null;

      try {
        const parsed = JSON.parse(content);
        return parsed === null ? null : parsed;
      } catch {
        return null;
      }
    } catch (error) {
      console.error('Error parsing calculation:', error);
      return null;
    }
  }

  /**
   * Generate personalized comment in Bahasa Indonesia
   */
  async generatePersonalizedComment(
    transactionType: 'expense' | 'income',
    description: string,
    amount: number,
    context: ConversationContext
  ): Promise<string> {
    try {
      const prompt = `
Generate a short, friendly comment in Bahasa Indonesia for this transaction:
Type: ${transactionType}
Description: ${description}
Amount: Rp ${amount.toLocaleString('id-ID')}

Make it personal, casual, and engaging. Examples:
- "wah belanja daging nih, mau masak apa?"
- "kopi lagi? kamu suka banget ngopi pagi hari ya"
- "mantap dapat bonus! jangan lupa sisihkan buat nabung"

Keep it under 50 characters and sound natural in Indonesian.
`;

      const completion = await this.callOpenAIWithRetry({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 100,
      });

      return completion.choices[0]?.message.content?.trim() || 'Transaksi berhasil dicatat!';
    } catch (error) {
      console.error('Error generating personalized comment:', error);
      return 'Transaksi berhasil dicatat!';
    }
  }

  /**
   * Build messages array for OpenAI API
   */
  private buildMessages(
    currentMessage: string,
    context: ConversationContext
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'system',
      content: `You are a helpful Indonesian financial assistant bot. You help users manage their expenses, income, budgets, and financial goals in Bahasa Indonesia.

Key guidelines:
- Always respond in Bahasa Indonesia
- Be friendly, casual, and helpful
- Help users track expenses, income, set budgets, and manage their wallet
- Use tools when users want to perform financial actions
- Understand Indonesian number formats (rb = ribu/thousand, jt = juta/million, k = ribu)
- Parse mathematical expressions like "5kg @ 10rb" as 5 × 10,000 = 50,000

Current user timezone: ${context.userPreferences?.timezone || 'Asia/Jakarta'}
Current user language: ${context.userPreferences?.language || 'id'}
Current timestamp: ${new Date().toISOString()}
`,
    };

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [systemMessage];

    // Add recent conversation history
    context.recentMessages
      // .slice(-5) // Last 5 messages for context
      .forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });

    // Add current message
    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Call OpenAI API with retry logic
   */
  private async callOpenAIWithRetry(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.dir({params}, {depth:null,colors:true})
        const response = await this.client.chat.completions.create(params);
        // Ensure we always return a ChatCompletion, not a stream
        if ('choices' in response) {
          return response as OpenAI.Chat.Completions.ChatCompletion;
        }
        // If a stream is returned unexpectedly, throw an error
        throw new OpenAIServiceError('Received stream instead of ChatCompletion', 'UNEXPECTED_STREAM');
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          if (error.status === 401 || error.status === 403) {
            throw new OpenAIServiceError(
              'Authentication failed',
              'AUTH_FAILED',
              error
            );
          }
          if (error.status === 400) {
            throw new OpenAIServiceError(
              'Invalid request',
              'INVALID_REQUEST',
              error
            );
          }
        }

        if (attempt === this.maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    throw new OpenAIServiceError(
      'Failed to call OpenAI after retries',
      'MAX_RETRIES_EXCEEDED',
      lastError!
    );
  }

  /**
   * Health check for OpenAI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return !!completion.choices[0]?.message.content;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }
}
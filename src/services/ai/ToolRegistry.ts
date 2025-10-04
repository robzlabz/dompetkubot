import { z } from 'zod';
import OpenAI from 'openai';

// Base tool interface
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  execute(params: any, userId: string): Promise<ToolResult>;
  toOpenAITool(): OpenAI.Chat.Completions.ChatCompletionTool;
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
  metadata?: {
    coinsUsed?: number;
    transactionId?: string;
    calculationExpression?: string;
  };
}

// Tool execution context
export interface ToolContext {
  userId: string;
  messageId?: string;
  chatId?: string;
  timestamp: Date;
}

// Abstract base tool class
export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodSchema<any>;

  abstract execute(params: any, userId: string): Promise<ToolResult>;

  toOpenAITool(): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.zodToJsonSchema(this.parameters),
      },
    };
  }

  protected zodToJsonSchema(schema: z.ZodSchema<any>): any {
    // Convert Zod schema to JSON Schema format for OpenAI
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToJsonSchema(value as z.ZodSchema<any>);
        
        // Check if field is required (not optional)
        if (!(value as any).isOptional()) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    if (schema instanceof z.ZodString) {
      return { type: 'string' };
    }

    if (schema instanceof z.ZodNumber) {
      return { type: 'number' };
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJsonSchema(schema.element),
      };
    }

    if (schema instanceof z.ZodOptional) {
      return this.zodToJsonSchema(schema.unwrap());
    }

    // Default fallback
    return { type: 'string' };
  }
}

// Tool registry class
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | null {
    return this.tools.get(name) || null;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools as OpenAI function definitions
   */
  getOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return this.getAllTools().map(tool => tool.toOpenAITool());
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    toolName: string,
    parameters: any,
    userId: string
  ): Promise<ToolResult> {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        message: `Tool '${toolName}' not found`,
        error: 'TOOL_NOT_FOUND',
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.parameters.parse(parameters);
      
      // Execute tool
      return await tool.execute(validatedParams, userId);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: 'Invalid parameters provided',
          error: 'VALIDATION_ERROR',
          data: error.errors,
        };
      }

      return {
        success: false,
        message: 'Tool execution failed',
        error: 'EXECUTION_ERROR',
      };
    }
  }

  /**
   * Get tool names for debugging
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
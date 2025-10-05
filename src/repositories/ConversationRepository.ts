import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IConversationRepository } from '../interfaces/repositories.js';
import { IConversation } from '../interfaces/index.js';

export class ConversationRepository extends BaseRepository<IConversation, Omit<IConversation, 'id' | 'createdAt'>, Partial<IConversation>> implements IConversationRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<IConversation | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        include: {
          user: true,
        },
      });

      return conversation ? this.mapToInterface(conversation) : null;
    } catch (error) {
      this.handleError(error, `Failed to find conversation by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<IConversation[]> {
    try {
      const queryOptions: any = {
        where: { userId },
        orderBy: { createdAt: 'desc' },
      };

      this.applyPagination(queryOptions, limit, offset);

      const conversations = await this.prisma.conversation.findMany(queryOptions);
      return conversations.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find conversations for user: ${userId}`);
      throw error;
    }
  }

  async findRecentByUserId(userId: string, limit: number = 10): Promise<IConversation[]> {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return conversations.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find recent conversations for user: ${userId}`);
      throw error;
    }
  }

  async create(conversationData: Omit<IConversation, 'id' | 'createdAt'>): Promise<IConversation> {
    try {
      // Validate required fields (response can be empty string initially)
      this.validateRequiredFields(conversationData, ['userId', 'message', 'messageType']);
      
      // Validate response exists (but can be empty)
      if (conversationData.response === undefined || conversationData.response === null) {
        throw new Error('Response field is required (can be empty string)');
      }

      const conversation = await this.prisma.conversation.create({
        data: {
          userId: conversationData.userId,
          message: conversationData.message,
          response: conversationData.response,
          messageType: conversationData.messageType,
          toolUsed: conversationData.toolUsed,
          coinsUsed: conversationData.coinsUsed,
          tokensIn: conversationData.tokensIn,
          tokensOut: conversationData.tokensOut,
        },
      });

      return this.mapToInterface(conversation);
    } catch (error) {
      this.handleError(error, 'Failed to create conversation');
      throw error;
    }
  }

  async update(id: string, conversationData: Partial<IConversation>): Promise<IConversation> {
    try {
      const sanitizedData = this.sanitizeData(conversationData);
      
      const conversation = await this.prisma.conversation.update({
        where: { id },
        data: sanitizedData,
      });

      return this.mapToInterface(conversation);
    } catch (error) {
      this.handleError(error, `Failed to update conversation: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.conversation.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete conversation: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IConversation[]> {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
      });

      return conversations.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find conversations');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.conversation.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count conversations');
      throw error;
    }
  }

  /**
   * Delete old conversations for a user (keep only recent N conversations)
   */
  async cleanupOldConversations(userId: string, keepCount: number = 100): Promise<void> {
    try {
      // Get the IDs of conversations to keep
      const conversationsToKeep = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: keepCount,
        select: { id: true },
      });

      const keepIds = conversationsToKeep.map(c => c.id);

      // Delete conversations not in the keep list
      if (keepIds.length > 0) {
        await this.prisma.conversation.deleteMany({
          where: {
            userId,
            id: {
              notIn: keepIds,
            },
          },
        });
      }
    } catch (error) {
      this.handleError(error, `Failed to cleanup old conversations for user: ${userId}`);
      throw error;
    }
  }

  /**
   * Get conversation context for AI (recent conversations formatted for context)
   */
  async getContextForAI(userId: string, limit: number = 5): Promise<string> {
    try {
      const conversations = await this.findRecentByUserId(userId, limit);
      
      return conversations
        .reverse() // Show oldest first for context
        .map(conv => `User: ${conv.message}\nAssistant: ${conv.response}`)
        .join('\n\n');
    } catch (error) {
      this.handleError(error, `Failed to get AI context for user: ${userId}`);
      return '';
    }
  }

  private mapToInterface(conversation: any): IConversation {
    return {
      id: conversation.id,
      userId: conversation.userId,
      message: conversation.message,
      response: conversation.response,
      messageType: conversation.messageType,
      toolUsed: conversation.toolUsed,
      coinsUsed: conversation.coinsUsed,
      tokensIn: conversation.tokensIn,
      tokensOut: conversation.tokensOut,
      createdAt: conversation.createdAt,
    };
  }
}
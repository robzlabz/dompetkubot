import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IUserRepository } from '../interfaces/repositories.js';
import { IUser } from '../interfaces/index.js';

export class UserRepository extends BaseRepository<IUser, Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>, Partial<IUser>> implements IUserRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByTelegramId(telegramId: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      return user ? this.mapToInterface(user) : null;
    } catch (error) {
      this.handleError(error, `Failed to find user by Telegram ID: ${telegramId}`);
      throw error;
    }
  }

  async findById(id: string): Promise<IUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      return user ? this.mapToInterface(user) : null;
    } catch (error) {
      this.handleError(error, `Failed to find user by ID: ${id}`);
      throw error;
    }
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    try {
      this.validateRequiredFields(userData, ['telegramId', 'language', 'timezone']);

      const user = await this.prisma.user.create({
        data: {
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          language: userData.language,
          timezone: userData.timezone,
        },
      });

      return this.mapToInterface(user);
    } catch (error) {
      this.handleError(error, 'Failed to create user');
      throw error;
    }
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      const sanitizedData = this.sanitizeData(userData);
      
      const user = await this.prisma.user.update({
        where: { id },
        data: sanitizedData,
      });

      return this.mapToInterface(user);
    } catch (error) {
      this.handleError(error, `Failed to update user: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete user: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IUser[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
      });

      return users.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find users');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count users');
      throw error;
    }
  }

  private mapToInterface(user: any): IUser {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
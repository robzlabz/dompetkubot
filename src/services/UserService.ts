import { z } from 'zod';
import { IUserService } from '../interfaces/services.js';
import { IUser } from '../interfaces/index.js';
import { IUserRepository, IWalletRepository } from '../interfaces/repositories.js';
import { CategoryService } from './CategoryService.js';

// Validation schemas
const CreateUserSchema = z.object({
  telegramId: z.string().min(1, 'Telegram ID is required'),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  language: z.string().default('id'),
  timezone: z.string().default('Asia/Jakarta')
});

const UpdateUserPreferencesSchema = z.object({
  language: z.string().min(1).optional(),
  timezone: z.string().min(1).optional()
});

export interface CreateUserData {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  timezone?: string;
}

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private walletRepository: IWalletRepository,
    private categoryService: CategoryService
  ) {}

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string): Promise<IUser | null> {
    try {
      return await this.userRepository.findByTelegramId(telegramId);
    } catch (error) {
      throw new Error(`Failed to get user by Telegram ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new user with registration on first interaction
   */
  async createUser(telegramId: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      // Validate input data
      const validatedData = CreateUserSchema.parse({
        telegramId,
        ...userData
      });

      // Check if user already exists
      const existingUser = await this.userRepository.findByTelegramId(telegramId);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create the user
      const user = await this.userRepository.create({
        telegramId: validatedData.telegramId,
        username: validatedData.username,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        language: validatedData.language,
        timezone: validatedData.timezone
      });

      // Initialize user defaults (wallet and categories)
      await this.initializeUserDefaults(user.id);

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Register or get existing user (used for authentication on first interaction)
   */
  async registerOrGetUser(telegramId: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      // Try to get existing user first
      const existingUser = await this.getUserByTelegramId(telegramId);
      if (existingUser) {
        return existingUser;
      }

      // Create new user if doesn't exist
      return await this.createUser(telegramId, userData);
    } catch (error) {
      throw new Error(`Failed to register or get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user preferences (language, timezone)
   */
  async updateUserPreferences(userId: string, preferences: { language?: string; timezone?: string }): Promise<IUser> {
    try {
      // Validate preferences
      const validatedPreferences = UpdateUserPreferencesSchema.parse(preferences);

      // Verify user exists
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Update user preferences
      return await this.userRepository.update(userId, validatedPreferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Initialize default settings for a new user
   */
  async initializeUserDefaults(userId: string): Promise<void> {
    try {
      // Initialize user wallet with default balance and coins
      const existingWallet = await this.walletRepository.findByUserId(userId);
      if (!existingWallet) {
        await this.walletRepository.create({
          userId,
          balance: 0,
          coins: 5.0 // Give new users 5 coins to try premium features
        });
      }

      // Ensure default categories are initialized (system-wide)
      await this.categoryService.initializeDefaultCategories();

    } catch (error) {
      throw new Error(`Failed to initialize user defaults: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify Telegram ID matches the user
   */
  async verifyTelegramId(userId: string, telegramId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      return user?.telegramId === telegramId;
    } catch (error) {
      console.error('Error verifying Telegram ID:', error);
      return false;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      return await this.userRepository.findById(userId);
    } catch (error) {
      throw new Error(`Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(userId: string, updates: Partial<IUser>): Promise<IUser> {
    try {
      // Verify user exists
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Only allow updating certain fields
      const allowedUpdates = {
        username: updates.username,
        firstName: updates.firstName,
        lastName: updates.lastName,
        language: updates.language,
        timezone: updates.timezone
      };

      // Remove undefined values
      const sanitizedUpdates = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
      );

      if (Object.keys(sanitizedUpdates).length === 0) {
        return existingUser; // No updates to apply
      }

      return await this.userRepository.update(userId, sanitizedUpdates);
    } catch (error) {
      throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user and all associated data
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // Verify user exists
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Delete user (cascade should handle related data)
      await this.userRepository.delete(userId);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalExpenses: number;
    totalIncome: number;
    categoriesUsed: number;
    transactionsCount: number;
    joinedDate: Date;
    lastActivity: Date;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // For now, return basic stats
      // In a full implementation, this would query expense/income repositories
      return {
        totalExpenses: 0,
        totalIncome: 0,
        categoriesUsed: 0,
        transactionsCount: 0,
        joinedDate: user.createdAt,
        lastActivity: user.updatedAt
      };
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user is new (registered recently)
   */
  async isNewUser(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return false;
      }

      // Consider user new if registered within last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return user.createdAt > oneDayAgo;
    } catch (error) {
      console.error('Error checking if user is new:', error);
      return false;
    }
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(userId: string): Promise<string> {
    try {
      const user = await this.userRepository.findById(userId);
      return user?.language || 'id'; // Default to Indonesian
    } catch (error) {
      console.error('Error getting user language:', error);
      return 'id'; // Default fallback
    }
  }

  /**
   * Get user's timezone
   */
  async getUserTimezone(userId: string): Promise<string> {
    try {
      const user = await this.userRepository.findById(userId);
      return user?.timezone || 'Asia/Jakarta'; // Default to Jakarta timezone
    } catch (error) {
      console.error('Error getting user timezone:', error);
      return 'Asia/Jakarta'; // Default fallback
    }
  }

  /**
   * Search users (admin function)
   */
  async searchUsers(query: string, limit: number = 10): Promise<IUser[]> {
    try {
      // This would require additional repository methods for searching
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      throw new Error(`Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user count (admin function)
   */
  async getUserCount(): Promise<number> {
    try {
      return await this.userRepository.count();
    } catch (error) {
      throw new Error(`Failed to get user count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
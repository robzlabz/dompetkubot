import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IWalletRepository } from '../interfaces/repositories.js';
import { IWallet } from '../interfaces/index.js';

export class WalletRepository extends BaseRepository<IWallet, Omit<IWallet, 'id' | 'createdAt' | 'updatedAt'>, Partial<IWallet>> implements IWalletRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: string): Promise<IWallet | null> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { id },
        include: {
          user: true,
        },
      });

      return wallet ? this.mapToInterface(wallet) : null;
    } catch (error) {
      this.handleError(error, `Failed to find wallet by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<IWallet | null> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
        include: {
          user: true,
        },
      });

      return wallet ? this.mapToInterface(wallet) : null;
    } catch (error) {
      this.handleError(error, `Failed to find wallet for user: ${userId}`);
      throw error;
    }
  }

  async create(walletData: Omit<IWallet, 'id' | 'createdAt' | 'updatedAt'>): Promise<IWallet> {
    try {
      this.validateRequiredFields(walletData, ['userId']);

      const wallet = await this.prisma.wallet.create({
        data: {
          userId: walletData.userId,
          balance: walletData.balance || 0,
          coins: walletData.coins || 0,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, 'Failed to create wallet');
      throw error;
    }
  }

  async update(id: string, walletData: Partial<IWallet>): Promise<IWallet> {
    try {
      const sanitizedData = this.sanitizeData(walletData);
      
      const wallet = await this.prisma.wallet.update({
        where: { id },
        data: sanitizedData,
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to update wallet: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.wallet.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete wallet: ${id}`);
      throw error;
    }
  }

  async updateBalance(userId: string, newBalance: number): Promise<IWallet> {
    try {
      const wallet = await this.prisma.wallet.upsert({
        where: { userId },
        update: { balance: newBalance },
        create: {
          userId,
          balance: newBalance,
          coins: 0,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to update balance for user: ${userId}`);
      throw error;
    }
  }

  async addToBalance(userId: string, amount: number): Promise<IWallet> {
    try {
      const wallet = await this.prisma.wallet.upsert({
        where: { userId },
        update: {
          balance: {
            increment: amount,
          },
        },
        create: {
          userId,
          balance: amount,
          coins: 0,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to add balance for user: ${userId}`);
      throw error;
    }
  }

  async subtractFromBalance(userId: string, amount: number): Promise<IWallet> {
    try {
      // First check if wallet exists and has sufficient balance
      const existingWallet = await this.findByUserId(userId);
      if (!existingWallet) {
        throw new Error('Wallet not found');
      }

      if (existingWallet.balance < amount) {
        throw new Error('Insufficient balance');
      }

      const wallet = await this.prisma.wallet.update({
        where: { userId },
        data: {
          balance: {
            decrement: amount,
          },
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to subtract balance for user: ${userId}`);
      throw error;
    }
  }

  async updateCoins(userId: string, newCoins: number): Promise<IWallet> {
    try {
      const wallet = await this.prisma.wallet.upsert({
        where: { userId },
        update: { coins: newCoins },
        create: {
          userId,
          balance: 0,
          coins: newCoins,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to update coins for user: ${userId}`);
      throw error;
    }
  }

  async addCoins(userId: string, coins: number): Promise<IWallet> {
    try {
      const wallet = await this.prisma.wallet.upsert({
        where: { userId },
        update: {
          coins: {
            increment: coins,
          },
        },
        create: {
          userId,
          balance: 0,
          coins: coins,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to add coins for user: ${userId}`);
      throw error;
    }
  }

  async subtractCoins(userId: string, coins: number): Promise<IWallet> {
    try {
      // First check if wallet exists and has sufficient coins
      const existingWallet = await this.findByUserId(userId);
      if (!existingWallet) {
        throw new Error('Wallet not found');
      }

      if (existingWallet.coins < coins) {
        throw new Error('Insufficient coins');
      }

      const wallet = await this.prisma.wallet.update({
        where: { userId },
        data: {
          coins: {
            decrement: coins,
          },
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(wallet);
    } catch (error) {
      this.handleError(error, `Failed to subtract coins for user: ${userId}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IWallet[]> {
    try {
      const wallets = await this.prisma.wallet.findMany({
        where: filters,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return wallets.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find wallets');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.wallet.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count wallets');
      throw error;
    }
  }

  private mapToInterface(wallet: any): IWallet {
    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      coins: wallet.coins,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
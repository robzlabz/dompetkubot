import { IWalletService } from '../interfaces/services.js';
import { IWalletRepository, IExpenseRepository, IIncomeRepository } from '../interfaces/repositories.js';
import { IWallet } from '../interfaces/index.js';

export interface WalletSummary {
  balance: number;
  coins: number;
  totalIncome: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

export interface CoinTransaction {
  userId: string;
  amount: number;
  type: 'DEDUCTION' | 'ADDITION';
  reason: string;
  timestamp: Date;
}

export class WalletService implements IWalletService {
  // Coin costs for premium features
  private static readonly COIN_COSTS = {
    VOICE_PROCESSING: 0.5,
    OCR_PROCESSING: 1.0,
    AI_CATEGORIZATION: 0.1,
    RECEIPT_ANALYSIS: 1.5,
  };

  // Balance to coins conversion rate (1000 IDR = 1 coin)
  private static readonly BALANCE_TO_COINS_RATE = 1000;

  constructor(
    private walletRepository: IWalletRepository,
    private expenseRepository: IExpenseRepository,
    private incomeRepository: IIncomeRepository
  ) {}

  async getUserWallet(userId: string): Promise<IWallet> {
    let wallet = await this.walletRepository.findByUserId(userId);
    
    if (!wallet) {
      // Create a new wallet for the user
      wallet = await this.walletRepository.create({
        userId,
        balance: 0,
        coins: 0,
      });
    }

    return wallet;
  }

  async updateWalletBalance(userId: string, newBalance: number): Promise<IWallet> {
    if (newBalance < 0) {
      throw new Error('Balance cannot be negative');
    }

    return this.walletRepository.updateBalance(userId, newBalance);
  }

  async addToWallet(userId: string, amount: number): Promise<IWallet> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return this.walletRepository.addToBalance(userId, amount);
  }

  async subtractFromWallet(userId: string, amount: number): Promise<IWallet> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getUserWallet(userId);
    if (wallet.balance < amount) {
      throw new Error(`Insufficient balance. Current balance: Rp ${this.formatCurrency(wallet.balance)}, Required: Rp ${this.formatCurrency(amount)}`);
    }

    return this.walletRepository.subtractFromBalance(userId, amount);
  }

  async addBalance(userId: string, amount: number): Promise<IWallet> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Convert balance to coins (1000 IDR = 1 coin)
    const coinsToAdd = amount / WalletService.BALANCE_TO_COINS_RATE;

    // Add both balance and coins
    const updatedWallet = await this.walletRepository.addToBalance(userId, amount);
    return this.walletRepository.addCoins(userId, coinsToAdd);
  }

  async deductCoins(userId: string, amount: number): Promise<IWallet> {
    if (amount <= 0) {
      throw new Error('Coin amount must be positive');
    }

    const wallet = await this.getUserWallet(userId);
    if (wallet.coins < amount) {
      throw new Error(`Insufficient coins. Current coins: ${wallet.coins.toFixed(2)}, Required: ${amount.toFixed(2)}`);
    }

    return this.walletRepository.subtractCoins(userId, amount);
  }

  async addCoins(userId: string, amount: number): Promise<IWallet> {
    if (amount <= 0) {
      throw new Error('Coin amount must be positive');
    }

    return this.walletRepository.addCoins(userId, amount);
  }

  async checkSufficientBalance(userId: string, requiredCoins: number): Promise<boolean> {
    const wallet = await this.getUserWallet(userId);
    return wallet.coins >= requiredCoins;
  }

  async getBalance(userId: string): Promise<IWallet> {
    return this.getUserWallet(userId);
  }

  async getWalletSummary(userId: string): Promise<WalletSummary> {
    const wallet = await this.getUserWallet(userId);
    
    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfAllTime = new Date(0);

    // Get totals
    const totalIncome = await this.incomeRepository.getTotalByUserIdAndPeriod(userId, startOfAllTime, now);
    const totalExpenses = await this.expenseRepository.getTotalByUserIdAndPeriod(userId, startOfAllTime, now);
    const monthlyIncome = await this.incomeRepository.getTotalByUserIdAndPeriod(userId, startOfMonth, endOfMonth);
    const monthlyExpenses = await this.expenseRepository.getTotalByUserIdAndPeriod(userId, startOfMonth, endOfMonth);

    return {
      balance: wallet.balance,
      coins: wallet.coins,
      totalIncome,
      totalExpenses,
      monthlyIncome,
      monthlyExpenses,
    };
  }

  // Premium feature coin deduction methods
  async deductCoinsForVoiceProcessing(userId: string): Promise<IWallet> {
    return this.deductCoinsWithReason(
      userId,
      WalletService.COIN_COSTS.VOICE_PROCESSING,
      'Voice message processing'
    );
  }

  async deductCoinsForOCRProcessing(userId: string): Promise<IWallet> {
    return this.deductCoinsWithReason(
      userId,
      WalletService.COIN_COSTS.OCR_PROCESSING,
      'Receipt OCR processing'
    );
  }

  async deductCoinsForReceiptAnalysis(userId: string): Promise<IWallet> {
    return this.deductCoinsWithReason(
      userId,
      WalletService.COIN_COSTS.RECEIPT_ANALYSIS,
      'Receipt analysis and itemization'
    );
  }

  async deductCoinsForAICategorization(userId: string): Promise<IWallet> {
    return this.deductCoinsWithReason(
      userId,
      WalletService.COIN_COSTS.AI_CATEGORIZATION,
      'AI-powered categorization'
    );
  }

  // Check if user has sufficient coins for specific features
  async canUseVoiceProcessing(userId: string): Promise<boolean> {
    return this.checkSufficientBalance(userId, WalletService.COIN_COSTS.VOICE_PROCESSING);
  }

  async canUseOCRProcessing(userId: string): Promise<boolean> {
    return this.checkSufficientBalance(userId, WalletService.COIN_COSTS.OCR_PROCESSING);
  }

  async canUseReceiptAnalysis(userId: string): Promise<boolean> {
    return this.checkSufficientBalance(userId, WalletService.COIN_COSTS.RECEIPT_ANALYSIS);
  }

  async canUseAICategorization(userId: string): Promise<boolean> {
    return this.checkSufficientBalance(userId, WalletService.COIN_COSTS.AI_CATEGORIZATION);
  }

  // Get coin costs for features
  static getCoinCosts() {
    return { ...WalletService.COIN_COSTS };
  }

  static getBalanceToCoinsRate(): number {
    return WalletService.BALANCE_TO_COINS_RATE;
  }

  private async deductCoinsWithReason(userId: string, amount: number, reason: string): Promise<IWallet> {
    const wallet = await this.getUserWallet(userId);
    
    if (wallet.coins < amount) {
      const requiredBalance = (amount - wallet.coins) * WalletService.BALANCE_TO_COINS_RATE;
      throw new Error(
        `Insufficient coins for ${reason}. ` +
        `Current coins: ${wallet.coins.toFixed(2)}, Required: ${amount.toFixed(2)}. ` +
        `Please add at least Rp ${this.formatCurrency(requiredBalance)} to your balance.`
      );
    }

    return this.deductCoins(userId, amount);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
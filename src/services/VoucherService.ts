import { IVoucher } from '../interfaces/index.js';
import { IVoucherRepository } from '../interfaces/repositories.js';
import { IWalletService } from '../interfaces/services.js';

export interface VoucherRedemption {
  voucher: IVoucher;
  success: boolean;
  message: string;
  benefitApplied: {
    type: 'COINS' | 'BALANCE' | 'DISCOUNT';
    value: number;
  };
}

export interface IVoucherService {
  redeemVoucher(code: string, userId: string): Promise<VoucherRedemption>;
  validateVoucher(code: string): Promise<IVoucher | null>;
  markVoucherAsUsed(voucherId: string, userId: string): Promise<void>;
  getUserVouchers(userId: string): Promise<IVoucher[]>;
  createVoucher(voucherData: {
    code: string;
    type: 'COINS' | 'BALANCE' | 'DISCOUNT';
    value: number;
    expiresAt?: Date;
  }): Promise<IVoucher>;
}

export class VoucherService implements IVoucherService {
  constructor(
    private voucherRepository: IVoucherRepository,
    private walletService: IWalletService
  ) {}

  async redeemVoucher(code: string, userId: string): Promise<VoucherRedemption> {
    // Validate the voucher
    const voucher = await this.validateVoucher(code);
    
    if (!voucher) {
      throw new Error('Voucher tidak ditemukan atau tidak valid');
    }

    if (voucher.isUsed) {
      throw new Error('Voucher sudah pernah digunakan');
    }

    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      throw new Error('Voucher sudah kadaluarsa');
    }

    try {
      // Apply the voucher benefit based on type
      let benefitApplied: VoucherRedemption['benefitApplied'];

      switch (voucher.type) {
        case 'COINS':
          await this.walletService.addCoins(userId, voucher.value);
          benefitApplied = { type: 'COINS', value: voucher.value };
          break;

        case 'BALANCE':
          await this.walletService.addToWallet(userId, voucher.value);
          benefitApplied = { type: 'BALANCE', value: voucher.value };
          break;

        case 'DISCOUNT':
          // For discount vouchers, we just mark them as used
          // The discount will be applied during transaction processing
          benefitApplied = { type: 'DISCOUNT', value: voucher.value };
          break;

        default:
          throw new Error('Tipe voucher tidak dikenal');
      }

      // Mark voucher as used
      await this.markVoucherAsUsed(voucher.id, userId);

      const updatedVoucher = await this.voucherRepository.findById(voucher.id);
      if (!updatedVoucher) {
        throw new Error('Gagal memperbarui status voucher');
      }

      return {
        voucher: updatedVoucher,
        success: true,
        message: this.generateSuccessMessage(voucher.type, voucher.value),
        benefitApplied,
      };

    } catch (error) {
      throw new Error(`Gagal menukarkan voucher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateVoucher(code: string): Promise<IVoucher | null> {
    if (!code || code.trim().length === 0) {
      return null;
    }

    const voucher = await this.voucherRepository.findByCode(code.trim().toUpperCase());
    
    if (!voucher) {
      return null;
    }

    // Check if voucher is expired
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      return null;
    }

    return voucher;
  }

  async markVoucherAsUsed(voucherId: string, userId: string): Promise<void> {
    await this.voucherRepository.markAsUsed(voucherId, userId);
  }

  async getUserVouchers(userId: string): Promise<IVoucher[]> {
    return this.voucherRepository.findByUserId(userId);
  }

  async createVoucher(voucherData: {
    code: string;
    type: 'COINS' | 'BALANCE' | 'DISCOUNT';
    value: number;
    expiresAt?: Date;
  }): Promise<IVoucher> {
    // Check if voucher code already exists
    const existingVoucher = await this.voucherRepository.findByCode(voucherData.code.toUpperCase());
    if (existingVoucher) {
      throw new Error('Kode voucher sudah ada');
    }

    if (voucherData.value <= 0) {
      throw new Error('Nilai voucher harus lebih dari 0');
    }

    return this.voucherRepository.create({
      code: voucherData.code.toUpperCase(),
      type: voucherData.type,
      value: voucherData.value,
      isUsed: false,
      expiresAt: voucherData.expiresAt,
    });
  }

  async getVoucherByCode(code: string): Promise<IVoucher | null> {
    return this.voucherRepository.findByCode(code.trim().toUpperCase());
  }

  async isVoucherValid(code: string): Promise<boolean> {
    const voucher = await this.validateVoucher(code);
    return voucher !== null;
  }

  async getVoucherStats(): Promise<{
    totalVouchers: number;
    usedVouchers: number;
    expiredVouchers: number;
    activeVouchers: number;
  }> {
    // This would require additional repository methods to get counts
    // For now, we'll return a basic implementation
    return {
      totalVouchers: 0,
      usedVouchers: 0,
      expiredVouchers: 0,
      activeVouchers: 0,
    };
  }

  private generateSuccessMessage(type: 'COINS' | 'BALANCE' | 'DISCOUNT', value: number): string {
    switch (type) {
      case 'COINS':
        return `Selamat! Anda mendapat ${value.toFixed(2)} coins dari voucher ini.`;
      
      case 'BALANCE':
        return `Selamat! Saldo Anda bertambah ${this.formatCurrency(value)} dari voucher ini.`;
      
      case 'DISCOUNT':
        return `Selamat! Anda mendapat diskon ${value}% yang dapat digunakan untuk transaksi berikutnya.`;
      
      default:
        return 'Voucher berhasil ditukarkan!';
    }
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
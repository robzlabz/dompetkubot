import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IVoucherService, IWalletService } from '../../../interfaces/services.js';

const RedeemVoucherSchema = z.object({
  voucherCode: z.string().min(1).describe('Voucher code to redeem'),
});

export class RedeemVoucherTool extends BaseTool {
  name = 'redeem_voucher';
  description = 'Redeem a voucher code when user mentions using or redeeming a voucher. Examples: "pakai voucher ABC123", "redeem kode BONUS50", "gunakan voucher WELCOME"';
  parameters = RedeemVoucherSchema;

  constructor(
    private voucherService: IVoucherService,
    private walletService: IWalletService
  ) {
    super();
  }

  async execute(params: z.infer<typeof RedeemVoucherSchema>, userId: string): Promise<ToolResult> {
    try {
      // Validate voucher
      const voucher = await this.voucherService.validateVoucher(params.voucherCode);
      
      if (!voucher) {
        return {
          success: false,
          message: 'Voucher code is invalid or expired',
          error: 'VOUCHER_INVALID',
        };
      }

      if (voucher.isUsed) {
        return {
          success: false,
          message: 'Voucher has already been used',
          error: 'VOUCHER_ALREADY_USED',
        };
      }

      // Check if voucher is expired
      if (voucher.expiresAt && voucher.expiresAt < new Date()) {
        return {
          success: false,
          message: 'Voucher has expired',
          error: 'VOUCHER_EXPIRED',
        };
      }

      // Redeem voucher
      const redemption = await this.voucherService.redeemVoucher(params.voucherCode, userId);

      // Apply voucher benefits based on type
      let wallet;
      switch (voucher.type) {
        case 'COINS':
          wallet = await this.walletService.addCoins(userId, voucher.value);
          break;
        case 'BALANCE':
          wallet = await this.walletService.addBalance(userId, voucher.value);
          break;
        case 'DISCOUNT':
          // For discount vouchers, we just mark as redeemed
          // The discount will be applied during transactions
          wallet = await this.walletService.getUserWallet(userId);
          break;
        default:
          wallet = await this.walletService.getUserWallet(userId);
      }

      return {
        success: true,
        data: {
          ...voucher,
          wallet,
        },
        message: `Voucher ${params.voucherCode} redeemed successfully`,
        metadata: {
          transactionId: voucher.id,
        },
      };
    } catch (error) {
      console.error('Error redeeming voucher:', error);
      return {
        success: false,
        message: 'Failed to redeem voucher',
        error: 'VOUCHER_REDEMPTION_FAILED',
      };
    }
  }
}
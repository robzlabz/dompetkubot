import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IWalletService } from '../../../interfaces/services.js';

const AddBalanceSchema = z.object({
  amount: z.number().positive().describe('Amount to add to balance in Indonesian Rupiah'),
});

export class AddBalanceTool extends BaseTool {
  name = 'add_balance';
  description = 'Add balance to user wallet when user mentions adding money or topping up balance. Examples: "tambah saldo 50rb", "top up 100000", "isi saldo 25rb"';
  parameters = AddBalanceSchema;

  constructor(private walletService: IWalletService) {
    super();
  }

  async execute(params: z.infer<typeof AddBalanceSchema>, userId: string): Promise<ToolResult> {
    try {
      // Add balance to wallet
      const wallet = await this.walletService.addBalance(userId, params.amount);

      // Convert balance to coins (1000 Rupiah = 1 coin)
      const coinsAdded = Math.floor(params.amount / 1000);
      if (coinsAdded > 0) {
        await this.walletService.addCoins(userId, coinsAdded);
      }

      return {
        success: true,
        data: wallet,
        message: `Balance added: Rp ${params.amount.toLocaleString('id-ID')}`,
        metadata: {
          amount: params.amount,
          coinsAdded,
        },
      };
    } catch (error) {
      console.error('Error adding balance:', error);
      return {
        success: false,
        message: 'Failed to add balance',
        error: 'BALANCE_ADD_FAILED',
      };
    }
  }
}
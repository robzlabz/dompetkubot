import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IReportingService, ICategoryService } from '../../../interfaces/services.js';

const BudgetStatusSchema = z.object({
  categoryName: z.string().optional().describe('Specific category name to check budget status for (optional - if not provided, shows all budgets)'),
});

export class BudgetStatusTool extends BaseTool {
  name = 'check_budget_status';
  description = 'Check budget status and spending progress when user asks about budget status, spending limits, or budget alerts. Examples: "cek budget", "status budget makanan", "sudah berapa persen budget bulan ini", "budget alert"';
  parameters = BudgetStatusSchema;

  constructor(
    private reportingService: IReportingService,
    private categoryService: ICategoryService
  ) {
    super();
  }

  async execute(params: z.infer<typeof BudgetStatusSchema>, userId: string): Promise<ToolResult> {
    try {
      let budgetStatuses = await this.reportingService.getBudgetStatusReport(userId);

      // Filter by category if specified
      if (params.categoryName) {
        budgetStatuses = budgetStatuses.filter(status => 
          status.categoryName.toLowerCase().includes(params.categoryName!.toLowerCase())
        );

        if (budgetStatuses.length === 0) {
          return {
            success: true,
            data: [],
            message: `Tidak ada budget yang ditemukan untuk kategori "${params.categoryName}". Mungkin belum ada budget yang diatur untuk kategori ini?`,
            metadata: {
              categorySearched: params.categoryName,
            },
          };
        }
      }

      if (budgetStatuses.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Belum ada budget yang diatur. Gunakan perintah seperti "budget makanan 1 juta" untuk mengatur budget kategori.',
          metadata: {
            totalBudgets: 0,
          },
        };
      }

      // Format budget status for Indonesian users
      const formattedStatus = this.formatBudgetStatusForUser(budgetStatuses);

      // Count alerts
      const alerts = budgetStatuses.filter(status => status.status !== 'UNDER_BUDGET');
      const overBudgetCount = budgetStatuses.filter(status => status.status === 'OVER_BUDGET').length;
      const warningCount = budgetStatuses.filter(status => status.status === 'WARNING').length;

      return {
        success: true,
        data: budgetStatuses,
        message: formattedStatus,
        metadata: {
          totalBudgets: budgetStatuses.length,
          alertCount: alerts.length,
          overBudgetCount,
          warningCount,
          hasAlerts: alerts.length > 0,
        },
      };
    } catch (error) {
      console.error('Error checking budget status:', error);
      return {
        success: false,
        message: 'Gagal mengecek status budget. Silakan coba lagi.',
        error: 'BUDGET_STATUS_CHECK_FAILED',
      };
    }
  }

  private formatBudgetStatusForUser(budgetStatuses: any[]): string {
    let formatted = '🎯 **Status Budget Anda**\n\n';

    // Group by status
    const overBudget = budgetStatuses.filter(b => b.status === 'OVER_BUDGET');
    const warning = budgetStatuses.filter(b => b.status === 'WARNING');
    const underBudget = budgetStatuses.filter(b => b.status === 'UNDER_BUDGET');

    // Show over budget first (most critical)
    if (overBudget.length > 0) {
      formatted += '🚨 **Budget Terlampaui:**\n';
      overBudget.forEach(budget => {
        const overspent = budget.spentAmount - budget.budgetAmount;
        formatted += `• ${budget.categoryName}: ${budget.percentage.toFixed(1)}% `;
        formatted += `(${this.formatCurrency(budget.spentAmount)}/${this.formatCurrency(budget.budgetAmount)}) `;
        formatted += `- Lebih ${this.formatCurrency(overspent)}\n`;
      });
      formatted += '\n';
    }

    // Show warnings
    if (warning.length > 0) {
      formatted += '⚠️ **Peringatan Budget (>80%):**\n';
      warning.forEach(budget => {
        formatted += `• ${budget.categoryName}: ${budget.percentage.toFixed(1)}% `;
        formatted += `(${this.formatCurrency(budget.spentAmount)}/${this.formatCurrency(budget.budgetAmount)}) `;
        formatted += `- Sisa ${this.formatCurrency(budget.remainingAmount)}\n`;
      });
      formatted += '\n';
    }

    // Show under budget (safe)
    if (underBudget.length > 0) {
      formatted += '✅ **Budget Aman:**\n';
      underBudget.forEach(budget => {
        formatted += `• ${budget.categoryName}: ${budget.percentage.toFixed(1)}% `;
        formatted += `(${this.formatCurrency(budget.spentAmount)}/${this.formatCurrency(budget.budgetAmount)}) `;
        formatted += `- Sisa ${this.formatCurrency(budget.remainingAmount)}\n`;
      });
      formatted += '\n';
    }

    // Add summary
    const totalBudget = budgetStatuses.reduce((sum, b) => sum + b.budgetAmount, 0);
    const totalSpent = budgetStatuses.reduce((sum, b) => sum + b.spentAmount, 0);
    const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    formatted += `📊 **Ringkasan Total:**\n`;
    formatted += `• Total Budget: ${this.formatCurrency(totalBudget)}\n`;
    formatted += `• Total Terpakai: ${this.formatCurrency(totalSpent)} (${overallPercentage.toFixed(1)}%)\n`;
    formatted += `• Sisa Total: ${this.formatCurrency(Math.max(0, totalBudget - totalSpent))}\n`;

    // Add recommendations
    if (overBudget.length > 0) {
      formatted += '\n💡 **Saran:** Pertimbangkan untuk mengurangi pengeluaran di kategori yang terlampaui atau sesuaikan budget Anda.';
    } else if (warning.length > 0) {
      formatted += '\n💡 **Saran:** Hati-hati dengan pengeluaran di kategori yang mendekati limit budget.';
    } else {
      formatted += '\n💡 **Bagus!** Semua budget masih dalam batas aman. Pertahankan pola pengeluaran ini.';
    }

    return formatted;
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
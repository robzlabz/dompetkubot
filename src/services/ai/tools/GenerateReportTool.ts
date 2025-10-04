import { z } from 'zod';
import { BaseTool, ToolResult } from '../ToolRegistry.js';
import { IReportingService } from '../../../interfaces/services.js';

const GenerateReportSchema = z.object({
  reportType: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY']).describe('Type of report to generate'),
  year: z.number().int().min(2020).max(2030).optional().describe('Year for the report (required for monthly/yearly reports)'),
  month: z.number().int().min(1).max(12).optional().describe('Month for monthly report (1-12)'),
  weekStartDate: z.string().optional().describe('Start date for weekly report in YYYY-MM-DD format'),
});

export class GenerateReportTool extends BaseTool {
  name = 'generate_report';
  description = 'Generate spending and income reports when user asks for summaries, reports, or financial overviews. Examples: "laporan bulan ini", "ringkasan pengeluaran minggu ini", "report keuangan tahun 2024", "summary spending oktober"';
  parameters = GenerateReportSchema;

  constructor(private reportingService: IReportingService) {
    super();
  }

  async execute(params: z.infer<typeof GenerateReportSchema>, userId: string): Promise<ToolResult> {
    try {
      let report: any;
      let reportTitle: string;

      switch (params.reportType) {
        case 'MONTHLY':
          if (!params.year || !params.month) {
            const now = new Date();
            params.year = now.getFullYear();
            params.month = now.getMonth() + 1;
          }
          
          report = await this.reportingService.generateMonthlyReport(userId, params.year, params.month);
          reportTitle = `Laporan Bulanan ${this.getMonthName(params.month)} ${params.year}`;
          break;

        case 'WEEKLY':
          let weekStart: Date;
          if (params.weekStartDate) {
            weekStart = new Date(params.weekStartDate);
          } else {
            const now = new Date();
            const dayOfWeek = now.getDay();
            weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          }
          
          report = await this.reportingService.generateWeeklyReport(userId, weekStart);
          reportTitle = `Laporan Mingguan ${weekStart.toLocaleDateString('id-ID')} - ${report.weekEndDate.toLocaleDateString('id-ID')}`;
          break;

        case 'YEARLY':
          if (!params.year) {
            params.year = new Date().getFullYear();
          }
          
          report = await this.reportingService.generateYearlySummary(userId, params.year);
          reportTitle = `Laporan Tahunan ${params.year}`;
          break;

        default:
          throw new Error('Invalid report type');
      }

      // Format the report for Indonesian users
      const formattedReport = this.formatReportForUser(report, reportTitle, params.reportType);

      return {
        success: true,
        data: report,
        message: formattedReport,
        metadata: {
          reportType: params.reportType,
          period: params.reportType === 'MONTHLY' ? `${params.year}-${params.month}` : 
                  params.reportType === 'YEARLY' ? `${params.year}` : 
                  'current_week',
        },
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        success: false,
        message: 'Gagal membuat laporan. Silakan coba lagi.',
        error: 'REPORT_GENERATION_FAILED',
      };
    }
  }

  private formatReportForUser(report: any, title: string, type: string): string {
    let formatted = `📊 **${title}**\n\n`;

    if (type === 'MONTHLY' && report.summary) {
      const summary = report.summary;
      
      formatted += `💰 **Ringkasan Keuangan:**\n`;
      formatted += `• Total Pengeluaran: ${this.formatCurrency(summary.totalExpenses)}\n`;
      formatted += `• Total Pemasukan: ${this.formatCurrency(summary.totalIncome)}\n`;
      formatted += `• Saldo Bersih: ${this.formatCurrency(summary.netAmount)}\n`;
      formatted += `• Jumlah Transaksi: ${summary.expenseCount + summary.incomeCount}\n\n`;

      if (summary.expensesByCategory.length > 0) {
        formatted += `📈 **Pengeluaran per Kategori:**\n`;
        summary.expensesByCategory.slice(0, 5).forEach((cat: any, index: number) => {
          formatted += `${index + 1}. ${cat.categoryName}: ${this.formatCurrency(cat.totalAmount)} (${cat.percentage.toFixed(1)}%)\n`;
        });
        formatted += '\n';
      }

      if (report.insights) {
        const insights = report.insights;
        formatted += `🔍 **Insights:**\n`;
        formatted += `• Kategori terbesar: ${insights.topSpendingCategory}\n`;
        formatted += `• Tingkat tabungan: ${insights.savingsRate.toFixed(1)}%\n`;
        
        if (insights.comparisonToPreviousMonth.expenseChange !== 0) {
          const change = insights.comparisonToPreviousMonth.expenseChange;
          const changePercent = insights.comparisonToPreviousMonth.expenseChangePercentage;
          const trend = change > 0 ? '📈 naik' : '📉 turun';
          formatted += `• Perubahan pengeluaran: ${trend} ${this.formatCurrency(Math.abs(change))} (${Math.abs(changePercent).toFixed(1)}%)\n`;
        }
        formatted += '\n';
      }

      if (report.budgetStatus && report.budgetStatus.length > 0) {
        formatted += `🎯 **Status Budget:**\n`;
        report.budgetStatus.slice(0, 3).forEach((budget: any) => {
          const statusIcon = budget.status === 'OVER_BUDGET' ? '🚨' : 
                           budget.status === 'WARNING' ? '⚠️' : '✅';
          formatted += `${statusIcon} ${budget.categoryName}: ${budget.percentage.toFixed(1)}% (${this.formatCurrency(budget.spentAmount)}/${this.formatCurrency(budget.budgetAmount)})\n`;
        });
      }

    } else if (type === 'WEEKLY' && report.summary) {
      const summary = report.summary;
      
      formatted += `💰 **Ringkasan Mingguan:**\n`;
      formatted += `• Total Pengeluaran: ${this.formatCurrency(summary.totalExpenses)}\n`;
      formatted += `• Total Pemasukan: ${this.formatCurrency(summary.totalIncome)}\n`;
      formatted += `• Saldo Bersih: ${this.formatCurrency(summary.netAmount)}\n\n`;

      if (report.dailyBreakdown) {
        formatted += `📅 **Breakdown Harian:**\n`;
        report.dailyBreakdown.forEach((day: any) => {
          const dayName = day.date.toLocaleDateString('id-ID', { weekday: 'short' });
          formatted += `• ${dayName}: ${this.formatCurrency(day.totalExpenses)} (${day.transactionCount} transaksi)\n`;
        });
      }

    } else if (type === 'YEARLY') {
      formatted += `💰 **Ringkasan Tahunan:**\n`;
      formatted += `• Total Pengeluaran: ${this.formatCurrency(report.totalExpenses)}\n`;
      formatted += `• Total Pemasukan: ${this.formatCurrency(report.totalIncome)}\n`;
      formatted += `• Saldo Bersih: ${this.formatCurrency(report.netAmount)}\n`;
      formatted += `• Rata-rata Pengeluaran Bulanan: ${this.formatCurrency(report.totalExpenses / 12)}\n`;
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

  private getMonthName(month: number): string {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || 'Unknown';
  }
}
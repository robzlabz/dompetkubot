import logger from "@/services/logger";
import { prisma } from "@/services/prisma";
import { createOrUpdateUser } from "@/services/UserService";
import { getRandomThinkingMessage } from "@/utils/thinkingTemplates";

// Minimal, explicit context type for GramIO command handlers
type CommandCtx = {
  chat: { id: number | string; firstName?: string; lastName?: string };
  send: (text: string) => Promise<{ id: number }>;
  editMessageText: (
    text: string,
    options: { parse_mode?: string; message_id: number }
  ) => Promise<any>;
};

export const today = async (ctx: CommandCtx) => {
    const chatId = String(ctx.chat.id);
    const thinkingText = getRandomThinkingMessage();
    const thinkingMsg = await ctx.send(thinkingText);

    const user = await createOrUpdateUser({
        telegramId: chatId,
        language: "id",
        firstName: ctx.chat.firstName || "User",
        lastName: ctx.chat.lastName || "",
    });

    try {
        // Rentang hari ini (lokal)
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        // Ambil pengeluaran dan pemasukan
        const expenses = await prisma.expense.findMany({
            where: { userId: user.id, createdAt: { gte: start, lte: end } },
            include: { category: true },
            orderBy: { createdAt: "asc" },
        });
        const incomes = await prisma.income.findMany({
            where: { userId: user.id, createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: "asc" },
        });

        // Util format Rupiah
        const fmt = (n: number) => `Rp. ${new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(n)))}`;

        // Ringkas baris
        const expenseLines = expenses
            .map((e) => `- ${e.expenseId}, ${fmt(e.amount)}, ${e.category?.name ?? "-"}, ${e.description ?? "-"}`)
            .join("\n");
        const incomeLines = incomes
            .map((i) => `- ${i.incomeId}, ${fmt(i.amount)}, ${i.description ?? "-"}`)
            .join("\n");

        const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
        const diff = totalIncome - totalExpense;

        // Cari kategori pengeluaran terbesar hari ini (opsional untuk saran)
        const topCategory = (() => {
            const map = new Map<string, number>();
            for (const e of expenses) {
                const key = e.category?.name ?? "(tanpa kategori)";
                map.set(key, (map.get(key) || 0) + (e.amount || 0));
            }
            let best: { name: string; amount: number } | null = null;
            for (const [name, amount] of map.entries()) {
                if (!best || amount > best.amount) best = { name, amount };
            }
            return best;
        })();

        // Saran singkat
        let suggestion = "Catatan rapi! Teruskan kebiasaan mencatat harian.";
        if (totalExpense === 0 && totalIncome === 0) {
            suggestion = "Belum ada transaksi hari ini. Coba catat belanja kecil atau pemasukan.";
        } else if (diff < 0) {
            suggestion = `Defisit hari ini. Pertimbangkan kurangi pengeluaran${topCategory ? ` (terutama ${topCategory.name}: ${fmt(topCategory.amount)})` : ""}.`;
        } else if (diff > 0) {
            suggestion = "Surplus hari ini. Bagus! Sisihkan sebagian ke tabungan atau dana darurat.";
        } else {
            suggestion = "Seimbang. Pertahankan, dan evaluasi kebutuhan sebelum belanja.";
        }

        const output = [
            "*pengeluaran*",
            expenseLines || "Tidak ada transaksi hari ini.",
            "",
            `total ${fmt(totalExpense)}`,
            "",
            "*pendapatan*",
            incomeLines || "Tidak ada transaksi hari ini.",
            "",
            `total ${fmt(totalIncome)}`,
            "",
            "perbandingan pendapatan vs pengeluaran",
            `Pendapatan: ${fmt(totalIncome)} | Pengeluaran: ${fmt(totalExpense)} | Selisih: ${fmt(diff)} ${diff >= 0 ? "(surplus)" : "(defisit)"}`,
            "",
            "suggestion",
            suggestion,
        ].join("\n");

        return ctx.editMessageText(output, { parse_mode: "Markdown", message_id: thinkingMsg.id });
    } catch (err: any) {
        logger.error({ chatId, error: err?.message || err }, "Inline /today failed");
        return ctx.editMessageText("Maaf, terjadi kesalahan saat mengambil data hari ini.", { parse_mode: "Markdown", message_id: thinkingMsg.id });
    }
};
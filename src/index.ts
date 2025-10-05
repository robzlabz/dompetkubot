import { nanoid } from "nanoid";
import { bot } from "./services/telegramBot";
import { openai } from "./services/openai";
import { expenseTools } from "./tools/expense";
import { incomeTools } from "./tools/income";
import { createExpense, readExpense, updateExpense, deleteExpense, createExpenseMany } from "./services/ExpenseService";
import { createIncome, readIncome, updateIncome, deleteIncome } from "./services/IncomeService";
import { Hooks } from "gramio";
import { prisma } from "./services/prisma";
import { createConversation, coversationByUser, updateCOnversation } from "./services/ConversationService";
import { MessageType, MessageRole } from "@prisma/client";
import logger from "./services/logger";
import { formatRupiah } from "./utils/money";

// Environment validation
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `
Kamu adalah asisten pencatatan keuangan Telegram.

Tugasmu:
- Pahami pesan pengguna dalam bahasa alami (misal: "beli kopi 20 ribu", "gaji masuk 5 juta").
- Tentukan apakah pesan itu pengeluaran (expense) atau pemasukan (income).
- Tentukan kategori umum (makanan, transportasi, gaji, hiburan, dll).
- Gunakan tool call untuk melakukan CRUD expense bila diperlukan:
  - create_expense: membuat pengeluaran. Field: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array objek {name, quantity, unitPrice}).
  - create_expense_many: membuat pengeluaran dengan banyak item sekaligus; total diambil dari penjumlahan harga item. Field: telegramId (string), description (string), categoryId (string|null), categoryName (string|null), items (array objek {name, price, quantity}).
  - read_expense: membaca pengeluaran. Field: telegramId (string|null), expenseId (string|null), limit (number|null).
  - update_expense: memperbarui pengeluaran. Field: expenseId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array objek {name, quantity, unitPrice}).
  - delete_expense: menghapus pengeluaran. Field: expenseId (string).
 - Gunakan tool call untuk melakukan CRUD income bila diperlukan:
   - create_income: membuat pemasukan. Field: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null).
   - read_income: membaca pemasukan. Field: telegramId (string|null), incomeId (string|null), limit (number|null).
   - update_income: memperbarui pemasukan. Field: incomeId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null).
   - delete_income: menghapus pemasukan. Field: incomeId (string).
- Jawab dengan bahasa santai dan mudah dipahami.
- Jika masih ada yang belum dipahami, tanyakan kembali ke user.
`;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment variables");
}
if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables");
}

bot.command("start", (ctx: any) => {
    return ctx.send(
      "Halo! Aku Dompetku Bot. Kirim teks pembelian seperti: 'beli ayam 5kg, perkilonya 10rb' atau '3x5000' dan aku hitung totalnya."
    );
  })
  .onStart(({ info }) => {
    console.log(`✨ Bot @${info.username} telah berjalan.`);
  })
  .on("message", async (ctx) => {
    const text = ctx.text;
    if (!text) return;

    // Chat logging: log incoming chat
    logger.info({ chatId: ctx.chat.id, text }, "Incoming chat message");

    ctx.sendChatAction("typing");

    const chatId = String(ctx.chat.id);

    // Dapatkan atau buat user berdasarkan telegramId
    let user = await prisma.user.findUnique({ where: { telegramId: chatId } });
    if (!user) {
      user = await prisma.user.create({ data: { telegramId: chatId, language: "id" } });
    }

    // Ambil history conversation untuk context
    const history = await coversationByUser({ userId: user.id, limit: 20 });
    const historyMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const c = history[i];
      if (!c) continue;
      if (c.role === "USER" && c.message) historyMessages.push({ role: "user", content: c.message });
      if (c.role === "ASSISTANT" && c.message) historyMessages.push({ role: "assistant", content: c.message });
    }

    // Buat conversation untuk transaksi ini (response dikosongkan dulu)
    const conv = await createConversation({
      userId: user.id,
      message: text,
      role: MessageRole.USER,
      messageType: MessageType.TEXT,
      toolUsed: null,
      coinsUsed: null,
      tokensIn: null,
      tokensOut: null,
    });

    // Agent loop dengan maksimal 10 langkah tool call
    let messages: Array<any> = [
      { role: "system", content: SYSTEM_PROMPT.trim() },
      ...historyMessages,
      { role: "user", content: text },
    ];

    let tokensIn = 0;
    let tokensOut = 0;
    let lastToolUsed: string | null = null;

    for (let step = 0; step < 10; step++) {
      try {
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          tools: [...expenseTools, ...incomeTools] as any,
          messages,
        });

        tokensIn += completion.usage?.prompt_tokens ?? 0;
        tokensOut += completion.usage?.completion_tokens ?? 0;

        const assistantMsg = completion.choices?.[0]?.message;
        if (!assistantMsg) {
          break;
        }

        // Jika ada tool call, jalankan lalu teruskan loop
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          messages.push(assistantMsg);
          let summaryText: string | null = null;

          for (const toolCall of assistantMsg.tool_calls) {
            const name = toolCall.function?.name;
            let argsObj: Record<string, unknown> = {};
            try {
              argsObj = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
            } catch (e) {
              // Jika argumen invalid, lanjut dengan pesan error ke tool
              const errorMsg = { ok: false, error: "Argumen tidak valid" };
              logger.warn({ tool: name, error: errorMsg }, "Tool call argument parse error");
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(errorMsg) });
              continue;
            }

            let result: any;
            try {
              if (name === "create_expense") {
                lastToolUsed = "create_expense";
                result = await createExpense({ ...argsObj, telegramId: chatId } as any);
                if (result?.ok) {
                  const expenseId = result.expenseId;
                  const amount = Number(result.amount || 0);
                  const comment = String((argsObj as any).description || "");
                  summaryText = `✅ berhasil di catat\ntransaksi: ${expenseId}\n\ntotal keluar ${formatRupiah(amount)}\n\n${comment}`.trim();
                }
              } else if (name === "create_expense_many") {
                lastToolUsed = "create_expense_many";
                result = await createExpenseMany({ ...argsObj, telegramId: chatId } as any);
                if (result?.ok) {
                  const expenseId = result.expenseId;
                  const amount = Number(result.amount || 0);
                  const comment = String((argsObj as any).description || "");
                  summaryText = `✅ berhasil di catat\ntransaksi: ${expenseId}\n\ntotal keluar ${formatRupiah(amount)}\n\n${comment}`.trim();
                }
              } else if (name === "read_expense") {
                lastToolUsed = "read_expense";
                result = await readExpense({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "update_expense") {
                lastToolUsed = "update_expense";
                result = await updateExpense(argsObj as any);
                if (result?.ok) {
                  const expenseId = String(result.expenseId);
                  const updated = await prisma.expense.findUnique({ where: { expenseId } });
                  const amount = Number(updated?.amount || 0);
                  const comment = String(updated?.description || "");
                  summaryText = `✅ berhasil di edit\ntransaksi: ${expenseId}\n\ntotal diubah ${formatRupiah(amount)}\n\n${comment}`.trim();
                }
              } else if (name === "delete_expense") {
                lastToolUsed = "delete_expense";
                const expenseId = String((argsObj as any).expenseId || "");
                const existing = expenseId ? await prisma.expense.findUnique({ where: { expenseId } }) : null;
                result = await deleteExpense(argsObj as any);
                if (result?.ok) {
                  const comment = String(existing?.description || "");
                  // Untuk hapus, tampilkan total diubah Rp. 0
                  summaryText = `✅ berhasil di hapus\ntransaksi: ${result.expenseId}\n\ntotal diubah ${formatRupiah(0)}\n\n${comment}`.trim();
                }
              } else if (name === "create_income") {
                lastToolUsed = "create_income";
                result = await createIncome({ ...argsObj, telegramId: chatId } as any);
                if (result?.ok) {
                  const incomeId = result.incomeId;
                  const amount = Number(result.amount || 0);
                  const comment = String((argsObj as any).description || "");
                  summaryText = `✅ berhasil di catat\npemasukan: ${incomeId}\n\ntotal masuk ${formatRupiah(amount)}\n\n${comment}`.trim();
                }
              } else if (name === "read_income") {
                lastToolUsed = "read_income";
                result = await readIncome({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "update_income") {
                lastToolUsed = "update_income";
                result = await updateIncome(argsObj as any);
                if (result?.ok) {
                  const incomeId = String(result.incomeId);
                  const updated = await prisma.income.findUnique({ where: { incomeId } });
                  const amount = Number(updated?.amount || 0);
                  const comment = String(updated?.description || "");
                  summaryText = `✅ berhasil di edit\npemasukan: ${incomeId}\n\ntotal diubah ${formatRupiah(amount)}\n\n${comment}`.trim();
                }
              } else if (name === "delete_income") {
                lastToolUsed = "delete_income";
                const incomeId = String((argsObj as any).incomeId || "");
                const existing = incomeId ? await prisma.income.findUnique({ where: { incomeId } }) : null;
                result = await deleteIncome(argsObj as any);
                if (result?.ok) {
                  const comment = String(existing?.description || "");
                  summaryText = `✅ berhasil di hapus\npemasukan: ${result.incomeId}\n\ntotal diubah ${formatRupiah(0)}\n\n${comment}`.trim();
                }
              } else {
                result = { ok: false, error: "Perintah tidak dikenal" };
              }

              // Tool call logging: log tool execution result
              logger.info({ tool: name, args: argsObj, result }, "Tool call executed");
            } catch (toolErr: any) {
              logger.error({ tool: name, args: argsObj, error: toolErr?.message || toolErr }, "Tool call failed");
              result = { ok: false, error: "Tool call gagal" };
            }

            messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });

            // Catat percakapan dengan role TOOL untuk setiap eksekusi tool
            try {
              await createConversation({
                userId: user.id,
                message: JSON.stringify({ tool: name, args: argsObj, result }),
                role: MessageRole.TOOL,
                messageType: MessageType.TEXT,
                toolUsed: name ?? null,
                coinsUsed: null,
                tokensIn: null,
                tokensOut: null,
              });
            } catch (logErr: any) {
              logger.warn({ tool: name, error: logErr?.message || logErr }, "Failed to log TOOL conversation");
            }
          }

          // Jika kita sudah punya ringkasan untuk user, kirimkan sekarang
          if (summaryText) {
            await updateCOnversation({
              id: conv.id,
              toolUsed: lastToolUsed ?? null,
              tokensIn,
              tokensOut,
            });
            await createConversation({
              userId: user.id,
              message: summaryText,
              role: MessageRole.ASSISTANT,
              messageType: MessageType.TEXT,
              toolUsed: lastToolUsed ?? null,
              coinsUsed: null,
              tokensIn: null,
              tokensOut: null,
            });
            logger.info({ chatId, response: summaryText }, "Tool summary response sent");
            return ctx.send(summaryText);
          }

          // lanjut ke iterasi berikutnya
          continue;
        }

        // Tidak ada tool call, anggap ini respons final untuk user
        const finalText = assistantMsg.content ?? "Maaf, aku belum bisa memahami.";
        await updateCOnversation({
          id: conv.id,
          toolUsed: lastToolUsed ?? null,
          tokensIn,
          tokensOut,
        });
        await createConversation({
          userId: user.id,
          message: finalText,
          role: MessageRole.ASSISTANT,
          messageType: MessageType.TEXT,
          toolUsed: lastToolUsed ?? null,
          coinsUsed: null,
          tokensIn: null,
          tokensOut: null,
        });

        // Chat logging: log AI final response
        logger.info({ chatId, response: finalText, tokensIn, tokensOut }, "AI response sent");

        return ctx.send(finalText, { parse_mode: "Markdown" });
      } catch (err: any) {
        // Jika error, update conversation dan kirim pesan gagal
        await updateCOnversation({
          id: conv.id,
          toolUsed: lastToolUsed ?? null,
          tokensIn,
          tokensOut,
        });
        await createConversation({
          userId: user.id,
          message: "Terjadi kesalahan saat memproses pesan.",
          role: MessageRole.ASSISTANT,
          messageType: MessageType.TEXT,
          toolUsed: lastToolUsed ?? null,
          coinsUsed: null,
          tokensIn: null,
          tokensOut: null,
        });
        logger.error({ chatId, error: err?.message || err }, "Agent loop error");
        return ctx.send("Maaf, terjadi kesalahan. Coba lagi ya.");
      }
    }

    // Jika mencapai batas loop tanpa respons final, tutup percakapan dengan pesan default
    await updateCOnversation({
      id: conv.id,
      toolUsed: lastToolUsed ?? null,
      tokensIn,
      tokensOut,
    });
    await createConversation({
      userId: user.id,
      message: "Kita hentikan dulu ya, batas langkah AI tercapai.",
      role: MessageRole.ASSISTANT,
      messageType: MessageType.TEXT,
      toolUsed: lastToolUsed ?? null,
      coinsUsed: null,
      tokensIn: null,
      tokensOut: null,
    });
    logger.warn({ chatId, tokensIn, tokensOut }, "Agent loop reached max iterations");
    return ctx.send("Kita hentikan dulu ya, batas langkah AI tercapai.");
  });

bot.start();
// Hentikan impor command berbasis slash agar fokus pada natural language
// import "./commands/expense";
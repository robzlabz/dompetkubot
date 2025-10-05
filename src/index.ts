import { bot } from "./services/telegramBot";
import { openai, transcribeFromBuffer } from "./services/openai";
import { expenseTools } from "./tools/expense";
import { incomeTools } from "./tools/income";
import { memoryTools } from "./tools/memory";
import { finalTools } from "./tools/final";
import { createExpense, readExpense, updateExpense, deleteExpense, createExpenseMany } from "./services/ExpenseService";
import { createIncome, readIncome, updateIncome, deleteIncome } from "./services/IncomeService";
import { getMemory as getUserMemory, saveMemory as saveUserMemory, deleteMemory as deleteUserMemory } from "./services/MemoryService";
import { prisma } from "./services/prisma";
import { createConversation, coversationByUser, updateConversation } from "./services/ConversationService";
import { MessageType, MessageRole } from "@prisma/client";
import logger from "./services/logger";
import { formatRupiah, toNumber } from "./utils/money";
import { formatFriendlyExpenseMessage } from "./utils/friendlyMessage";
import { getRandomThinkingMessage, getToolProgressText, getToolDoneText } from "./utils/thinkingTemplates";

// Environment validation
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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
 - Gunakan tool call untuk Memory/Preset System:
   - save_memory: simpan atau perbarui preset item (key, price, unit).
   - get_memory: ambil preset item berdasarkan key.
 - delete_memory: hapus preset item berdasarkan key.
 - Gunakan tool call untuk mengirim pesan final:
   - send_final_message: kirim pesan final ke user dan akhiri alur. Field: text (string). Tool ini HARUS dipanggil di langkah TERAKHIR bila kamu ingin menutup jawaban melalui tool.
 - Catatan: Kamu boleh menggunakan beberapa tool call secara berurutan (multi-step) dalam satu percakapan untuk menyelesaikan tugas.
   Contoh:
   - get_memory → cek unit dan hitung total → create_expense
   - read_expense → update_expense (edit transaksi yang baru)
   - save_memory → create_expense_many (pakai preset harga untuk beberapa item)
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
    let text: string | null = ctx.text ?? null;
    let isVoice = false;
    try {
      if (!text && ctx.voice) {
        isVoice = true;
        // Prefer GramIO context.download() per docs: https://gramio.dev/files/download
        let buffer: ArrayBuffer | null = null;
        buffer = await ctx.download();

        if (buffer) {
          text = await transcribeFromBuffer(buffer, "id");
          // response
          // saya mendengar: ${text}
          ctx.send(`Saya mendengar: ${text}`);
        }
      }
    } catch (e: any) {
      logger.error({ chatId: ctx.chat.id, error: e?.message || e }, "Voice transcription failed");
      return ctx.send("Maaf, aku tidak bisa memproses voice note ini.");
    }

    if (!text) return;

    // Chat logging: log incoming chat
    logger.info({ chatId: ctx.chat.id, text }, "Incoming chat message");

    ctx.sendChatAction("typing");

    // Kirim placeholder "berpikir" agar user tahu bot sedang proses
    const thinkingText = getRandomThinkingMessage();
    const thinkingMsg = await ctx.send(thinkingText);
    

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
      messageType: isVoice ? MessageType.VOICE : MessageType.TEXT,
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
          tools: [...expenseTools, ...incomeTools, ...memoryTools, ...finalTools] as any,
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
          let lastToolUsed: string | null = null;

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
              // Update pesan placeholder agar user tahu tool yang sedang dipakai
              try {
                await ctx.editMessageText(getToolProgressText(name), { message_id: thinkingMsg.id });
              } catch (e: any) {
                logger.warn({ chatId, error: e?.message || e }, "Failed to edit thinking message (progress)");
              }
              if (name === "create_expense") {
                lastToolUsed = "create_expense";
                result = await createExpense({ ...argsObj, telegramId: chatId } as any);
                if (result?.ok) {
                  const expenseId = result.expenseId;
                  const amount = Number(result.amount || 0);
                  const comment = String((argsObj as any).description || "");
                  const created = await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } });
                  summaryText = formatFriendlyExpenseMessage("create", { categoryName: created?.category?.name, amount, description: created?.description ?? comment, date: created?.createdAt ?? new Date() });
                }
              } else if (name === "create_expense_many") {
                lastToolUsed = "create_expense_many";
                result = await createExpenseMany({ ...argsObj, telegramId: chatId } as any);
                if (result?.ok) {
                  const expenseId = result.expenseId;
                  const amount = Number(result.amount || 0);
                  const comment = String((argsObj as any).description || "");
                  const created = await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } });
                  summaryText = formatFriendlyExpenseMessage("create", { categoryName: created?.category?.name, amount, description: created?.description ?? comment, date: created?.createdAt ?? new Date() });
                }
              } else if (name === "read_expense") {
                lastToolUsed = "read_expense";
                result = await readExpense({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "save_memory") {
                lastToolUsed = "save_memory";
                const key = String((argsObj as any).key || "").trim();
                const price = toNumber((argsObj as any).price) ?? 0;
                const unit = String((argsObj as any).unit || "").trim();
                if (!key || !unit) {
                  result = { ok: false, error: "Key dan unit wajib diisi" };
                } else {
                  result = await saveUserMemory(user.id, key, { price, unit });
                  if ((result as any)?.ok) {
                    const pretty = formatRupiah(price);
                    summaryText = `💾 Disimpan!\n📦 Item: ${key}\n💰 Harga: ${pretty}\n⚖️ Satuan: ${unit}\n✅ Sekarang aku ingat ya! 😉`;
                  }
                }
              } else if (name === "get_memory") {
                lastToolUsed = "get_memory";
                const key = String((argsObj as any).key || "").trim();
                const item = key ? await getUserMemory(user.id, key) : null;
                if (item) {
                  result = { ok: true, key, price: item.price, unit: item.unit };
                } else {
                  result = { ok: false, error: "Data tidak ditemukan" };
                }
                // Jangan kirim summaryText agar loop bisa lanjut memakai data ini
              } else if (name === "delete_memory") {
                lastToolUsed = "delete_memory";
                const key = String((argsObj as any).key || "").trim();
                result = key ? await deleteUserMemory(user.id, key) : { ok: false, error: "Key wajib diisi" };
                if ((result as any)?.ok) {
                  summaryText = `🗑️ Oke, data ${key} sudah aku hapus dari memory.\nKalau mau, kita bisa simpan lagi versi terbaru nanti ✨`;
                }
              } else if (name === "update_expense") {
                lastToolUsed = "update_expense";
                result = await updateExpense(argsObj as any);
                if (result?.ok) {
                  const expenseId = String(result.expenseId);
                  const updated = await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } });
                  const amount = Number(updated?.amount || 0);
                  const comment = String(updated?.description || "");
                  summaryText = formatFriendlyExpenseMessage("update", { categoryName: updated?.category?.name, amount, description: comment, date: new Date() });
                }
              } else if (name === "delete_expense") {
                lastToolUsed = "delete_expense";
                const expenseId = String((argsObj as any).expenseId || "");
                const existing = expenseId ? await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } }) : null;
                result = await deleteExpense(argsObj as any);
                if (result?.ok) {
                  const comment = String(existing?.description || "");
                  summaryText = formatFriendlyExpenseMessage("delete", { categoryName: existing?.category?.name, amount: Number(existing?.amount || 0), description: comment, date: existing?.createdAt ?? new Date() });
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
              } else if (name === "send_final_message") {
                lastToolUsed = "send_final_message";
                const text = String((argsObj as any).text || "");
                result = { ok: true };
                summaryText = text || "";
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

          // // Jika kita sudah punya ringkasan untuk user, kirimkan sekarang
          // if (summaryText) {
          //   // Update placeholder jadi selesai

          //   try {
          //     await ctx.editMessageText(getToolDoneText(lastToolUsed || "AI POPO"));
          //   } catch (e: any) {
          //     logger.warn({ chatId, error: e?.message || e }, "Failed to edit thinking message (done)");
          //   }

          //   await updateConversation({
          //     id: conv.id,
          //     toolUsed: lastToolUsed ?? null,
          //     tokensIn,
          //     tokensOut,
          //   });
          //   await createConversation({
          //     userId: user.id,
          //     message: summaryText,
          //     role: MessageRole.ASSISTANT,
          //     messageType: MessageType.TEXT,
          //     toolUsed: lastToolUsed ?? null,
          //     coinsUsed: null,
          //     tokensIn: null,
          //     tokensOut: null,
          //   });
          //   logger.info({ chatId, response: summaryText }, "Tool summary response sent");
          //   return ctx.send(summaryText, { parse_mode: "Markdown" });
          // }

          // lanjut ke iterasi berikutnya
          continue;
        }

        // Tidak ada tool call, anggap ini respons final untuk user
        const finalText = assistantMsg.content ?? "Maaf, aku belum bisa memahami.";
        try {
          await ctx.editMessageText(getToolDoneText(lastToolUsed || "ini dia hasilnya...."),{ message_id: thinkingMsg.id });
        } catch (e: any) {
          logger.warn({ chatId, error: e?.message || e }, "Failed to edit thinking message (final)");
        }
        await updateConversation({
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

        return ctx.editMessageText(finalText, { parse_mode: "Markdown", message_id: thinkingMsg.id });
      } catch (err: any) {
        // Jika error, update conversation dan kirim pesan gagal
        await updateConversation({
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
    await updateConversation({
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
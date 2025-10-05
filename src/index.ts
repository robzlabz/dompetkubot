import { bot } from "./services/telegramBot";
import { openai, transcribeFromBuffer } from "./services/openai";
import { readReceiptData } from "./services/ReceiptService";
import { expenseTools } from "./tools/expense";
import { incomeTools } from "./tools/income";
import { memoryTools } from "./tools/memory";
import { finalTools } from "./tools/final";
import { createExpense, readExpense, updateExpense, deleteExpense, createExpenseMany, readExpenseRange, readExpenseTotal } from "./services/ExpenseService";
import { createIncome, readIncome, updateIncome, deleteIncome } from "./services/IncomeService";
import { getMemory as getUserMemory, saveMemory as saveUserMemory, deleteMemory as deleteUserMemory, saveMemoryMany } from "./services/MemoryService";
import { prisma } from "./services/prisma";
import { createConversation, coversationByUser, updateConversation } from "./services/ConversationService";
import { MessageType, MessageRole } from "@prisma/client";
import logger from "./services/logger";
import { toNumber } from "./utils/money";
import { getRandomThinkingMessage, getToolProgressText } from "./utils/thinkingTemplates";
import { format } from "path";

// Environment validation
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `
Kamu adalah asisten pencatatan keuangan Telegram.

Tugasmu:
1. Pahami pesan pengguna dalam bahasa alami (misal: "beli kopi 20 ribu", "gaji masuk 5 juta").
2. Tentukan apakah pesan itu pengeluaran (expense) atau pemasukan (income).
3. Tentukan kategori umum (makanan, transportasi, gaji, hiburan, dll).

Gunakan tool call secara berurutan (multi-step) untuk menyelesaikan tugas:
- Selalu cek memory terlebih dahulu dengan get_memory sebelum membuat transaksi.
- Gunakan save_memory untuk menyimpan preset item (key, price, unit) yang diinput pengguna. Informasi ini sangat penting untuk menghitung total pengeluaran dan pemasukan.
- Contoh urutan optimal:
  - get_memory → cek unit dan hitung total → create_expense
  - save_memory → create_expense_many (pakai preset harga untuk beberapa item)
  - read_expense → update_expense (edit transaksi yang baru)

Tool call untuk CRUD expense:
- create_expense: membuat pengeluaran. Field: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array objek {name, quantity, unitPrice}).
- create_expense_many: membuat pengeluaran dengan banyak item sekaligus; total diambil dari penjumlahan harga item. Field: telegramId (string), description (string), categoryId (string|null), categoryName (string|null), items (array objek {name, price, quantity}).
- read_expense: membaca pengeluaran. Field: telegramId (string|null), expenseId (string|null), limit (number|null).
- read_expense_range: membaca pengeluaran dalam rentang tanggal. Field: telegramId (string), dateStart (string), dateEnd (string), limit (number|null).
- read_expense_total: mendapatkan total pengeluaran berdasarkan periode. Field: telegramId (string), range ("today"|"this_week"|"this_month"|"custom"), dateStart (string|null), dateEnd (string|null), groupBy ("none"|"category").
- update_expense: memperbarui pengeluaran. Field: expenseId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array objek {name, quantity, unitPrice}).
- delete_expense: menghapus pengeluaran. Field: expenseId (string).

Tool call untuk Memory/Preset System:
- save_memory: simpan atau perbarui preset item (key, price, unit).
- save_memory_many: simpan atau perbarui banyak preset sekaligus (items: [{key, price, unit}]).
- get_memory: ambil preset item berdasarkan key.
- delete_memory: hapus preset item berdasarkan key.

Tool call untuk CRUD income:
- create_income: membuat pemasukan. Field: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null).
- read_income: membaca pemasukan. Field: telegramId (string|null), incomeId (string|null), limit (number|null).
- update_income: memperbarui pemasukan. Field: incomeId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null).
- delete_income: menghapus pemasukan. Field: incomeId (string).

Jawab dengan bahasa santai dan mudah dipahami. harus user frienly, cute dan penuh emosional (emoji juga diijinkan)
contoh balasan
（｡•̀ᴗ-）✧ Transaksi masuk, bos!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Jumlah   : <rp total>\n🕒 Hari ini : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting>,
🍀 Oke, udah aku masukin ya~\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Total    : <rp total>\n🕒 Sekarang : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 💪,
🧃 Catatan baru sudah mendarat!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💸 Nominal  : <rp total>\n🕒 Waktu    : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> ✨,
🎯 Transaksi berhasil dicatat!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Jumlah   : <rp total>\n🕒 Waktu    : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 📊,
💫 Data baru tersimpan!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💸 Nominal  : <rp total>\n🕒 Tanggal  : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🏦,
🚀 Transaksi baru siap meluncur!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Nominal  : <rp total>\n🕒 Waktu    : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🌟,
🌈 Tambahan catatan keuangan!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Jumlah   : <rp total>\n🕒 <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🌱,
⚡ Catatan keuangan terbaru!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💸 Nominal  : <rp total>\n🕒 Hari ini : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 📈,
🎉 Transaksi berhasil ditambahkan!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Total    : <rp total>\n🕒 Tanggal  : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 📅,
✨ Data keuangan baru tercatat!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Jumlah   : <rp total>\n🕒 Waktu    : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 💼,
🌟 Tambahan pengeluaran tercatat!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💸 Nominal  : <rp total>\n🕒 <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🌿,
🎊 Catatan transaksi baru masuk!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Jumlah   : <rp total>\n🕒 Sekarang : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 👀,
🚗 Transaksi baru berjalan!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Nominal  : <rp total>\n🕒 <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🔄,
💡 Informasi keuangan terbaru!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💰 Total    : <rp total>\n🕒 Tanggal  : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 📊,
🌺 Catatan pengeluaran baru!\n\n🌟 ID Transaksi: \`<id transaction>\`\n📂 Kategori : <response category>>\n💸 Jumlah   : <rp total>\n🕒 Waktu    : <datetime 22 juni 2025, jam 17.30>\n\n <detail item transaksi dalam list>\n\n<roasting> 🎯,


Jika masih ada yang belum dipahami, tanyakan kembali ke user.
`;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment variables");
}
if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables");
}

bot.command("start", (ctx: any) => {
  return ctx.send(
    `Halo! 👋 Aku Dompetku Bot, asisten keuanganmu yang siap bantu catat pengeluaran & pemasukan!

📝 Cara pakai:
• Kirim: "beli kopi 25k" → otomatis tercatat
• Kirim: "3x5000" → total 15rb langsung masuk
• Kirim: "gaji 5 juta" → catat pemasukan
• Atau voice note juga bisa! 🎤

💡 Tips:
• Gunakan preset: "simpan harga kopi 25k per gelas" → lain kali cukup "2 kopi"
• Lihat history: "lihat pengeluaran" atau "lihat pemasukan"
• Edit/hapus: "ubah transaksi <id>" atau "hapus transaksi <id>"

Ayo mulai catat keuanganmu sekarang! 💪✨`
  );
})
  .onStart(({ info }) => {
    console.log(`✨ Bot @${info.username} telah berjalan.`);
  })
  .command("today", async (ctx) => {
    const chatId = ctx.chat.id;
    const thinkingText = getRandomThinkingMessage();
    const thinkingMsg = await ctx.send(thinkingText);

    let user = await prisma.user.findUnique({ where: { telegramId: String(chatId) } });
    if (!user) {
      user = await prisma.user.create({ data: { telegramId: String(chatId), language: "id" } });
    }

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
  })
  .on("message", async (ctx) => {
    let text: string | null = ctx.text ?? null;

    // if start with /, ignore
    if (text?.startsWith("/")) {
      return;
    }

    ctx.sendChatAction("typing");

    let isVoice = false;
    let isImage = false;
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

    if (!text && ctx.photo) {
      isImage = true;
      // Prefer GramIO context.download() per docs: https://gramio.dev/files/download
      let buffer: ArrayBuffer | null = null;
      buffer = await ctx.download();

      if (buffer) {
        text = await readReceiptData(buffer, "id");
        logger.info({ chatId: ctx.chat.id, text }, "Incoming image message");
      }
    }

    if (!text) return;

    // Chat logging: log incoming chat
    logger.info({ chatId: ctx.chat.id, text }, "Incoming chat message");


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
      messageType: isVoice ? MessageType.VOICE : isImage ? MessageType.PHOTO : MessageType.TEXT,
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
    let toolsUsed: string[] = [];

    for (let step = 0; step < 10; step++) {
      console.log("===>>> step", step);
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
          ctx.editMessageText(getToolProgressText(assistantMsg.tool_calls[0]?.function.name || "thinking...."), { parse_mode: "Markdown", message_id: thinkingMsg.id });

          messages.push(assistantMsg);

          for (const toolCall of assistantMsg.tool_calls) {
            const name = toolCall.function?.name;
            if (name) toolsUsed.push(name as string);
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
                result = await createExpense({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "create_expense_many") {
                result = await createExpenseMany({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "read_expense") {
                result = await readExpense({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "read_expense_range") {
                const dateStart = String((argsObj as any).dateStart || "");
                const dateEnd = String((argsObj as any).dateEnd || "");
                const limit = (argsObj as any).limit ?? null;
                if (!dateStart || !dateEnd) {
                  result = { ok: false, error: "dateStart dan dateEnd wajib diisi" };
                } else {
                  result = await readExpenseRange({ telegramId: chatId, dateStart, dateEnd, limit } as any);
                }
              } else if (name === "read_expense_total") {
                const range = String((argsObj as any).range || "today");
                const dateStart = (argsObj as any).dateStart ?? null;
                const dateEnd = (argsObj as any).dateEnd ?? null;
                const groupBy = String((argsObj as any).groupBy || "none");
                result = await readExpenseTotal({ telegramId: chatId, range, dateStart, dateEnd, groupBy } as any);
              } else if (name === "save_memory") {
                const key = String((argsObj as any).key || "").trim();
                const price = toNumber((argsObj as any).price) ?? 0;
                const unit = String((argsObj as any).unit || "").trim();
                if (!key || !unit) {
                  result = { ok: false, error: "Key dan unit wajib diisi" };
                } else {
                  result = await saveUserMemory(user.id, key, { price, unit });
                }
              } else if (name === "get_memory") {
                const key = String((argsObj as any).key || "").trim();
                const item = key ? await getUserMemory(user.id, key) : null;
                if (item) {
                  result = { ok: true, key, price: item.price, unit: item.unit };
                } else {
                  result = { ok: false, error: "Data tidak ditemukan" };
                }
              } else if (name === "delete_memory") {
                const key = String((argsObj as any).key || "").trim();
                result = key ? await deleteUserMemory(user.id, key) : { ok: false, error: "Key wajib diisi" };
              } else if (name === "save_memory_many") {
                const items = Array.isArray((argsObj as any).items) ? ((argsObj as any).items as any[]) : [];
                const normalized = items
                  .map((it) => ({
                    key: String(it?.key || "").trim(),
                    price: toNumber(it?.price) ?? 0,
                    unit: String(it?.unit || "").trim(),
                  }))
                  .filter((it) => it.key && it.unit);
                result = await saveMemoryMany(user.id, normalized as any);
              } else if (name === "update_expense") {
                result = await updateExpense(argsObj as any);
              } else if (name === "delete_expense") {
                const expenseId = String((argsObj as any).expenseId || "");
                const existing = expenseId ? await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } }) : null;
                result = existing ? await deleteExpense(argsObj as any) : { ok: false, error: "Data tidak ditemukan" };
              } else if (name === "create_income") {
                result = await createIncome({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "read_income") {
                result = await readIncome({ ...argsObj, telegramId: chatId } as any);
              } else if (name === "update_income") {
                result = await updateIncome(argsObj as any);
              } else if (name === "delete_income") {
                const incomeId = String((argsObj as any).incomeId || "");
                const existing = incomeId ? await prisma.income.findUnique({ where: { incomeId } }) : null;
                result = existing ? await deleteIncome(argsObj as any) : { ok: false, error: "Data tidak ditemukan" };
              } else {
                result = { ok: false, error: "Perintah tidak dikenal" };
              }
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

          continue;
        }

        // Tidak ada tool call, anggap ini respons final untuk user
        const finalText = assistantMsg.content ?? "Maaf, aku belum bisa memahami.";
        const usedStrFinal = toolsUsed.length ? toolsUsed.join(",") : null;
        await updateConversation({
          id: conv.id,
          toolUsed: usedStrFinal,
          tokensIn,
          tokensOut,
        });
        await createConversation({
          userId: user.id,
          message: finalText,
          role: MessageRole.ASSISTANT,
          messageType: MessageType.TEXT,
          toolUsed: usedStrFinal,
          coinsUsed: null,
          tokensIn: null,
          tokensOut: null,
        });

        // Chat logging: log AI final response
        logger.info({ chatId, response: finalText, tokensIn, tokensOut }, "AI response sent");

        return ctx.editMessageText(finalText, { parse_mode: "Markdown", message_id: thinkingMsg.id });
      } catch (err: any) {
        // Jika error, update conversation dan kirim pesan gagal
        const usedStrErr = toolsUsed.length ? toolsUsed.join(",") : null;
        await updateConversation({
          id: conv.id,
          toolUsed: usedStrErr,
          tokensIn,
          tokensOut,
        });
        await createConversation({
          userId: user.id,
          message: "Terjadi kesalahan saat memproses pesan.",
          role: MessageRole.ASSISTANT,
          messageType: MessageType.TEXT,
          toolUsed: usedStrErr,
          coinsUsed: null,
          tokensIn: null,
          tokensOut: null,
        });
        logger.error({ chatId, error: err?.message || err }, "Agent loop error");
        return ctx.send("Maaf, terjadi kesalahan. Coba lagi ya.");
      }
    }

    // Jika mencapai batas loop tanpa respons final, tutup percakapan dengan pesan default
    const usedStrMax = toolsUsed.length ? toolsUsed.join(",") : null;
    await updateConversation({
      id: conv.id,
      toolUsed: usedStrMax,
      tokensIn,
      tokensOut,
    });
    await createConversation({
      userId: user.id,
      message: "Kita hentikan dulu ya, batas langkah AI tercapai.",
      role: MessageRole.ASSISTANT,
      messageType: MessageType.TEXT,
      toolUsed: usedStrMax,
      coinsUsed: null,
      tokensIn: null,
      tokensOut: null,
    });
    logger.warn({ chatId, tokensIn, tokensOut }, "Agent loop reached max iterations");
    return ctx.send("Kita hentikan dulu ya, batas langkah AI tercapai.");
  });

bot.start();
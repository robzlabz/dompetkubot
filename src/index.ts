import { nanoid } from "nanoid";
import { bot } from "./services/telegramBot";
import { openai } from "./services/openai";
import { expenseTools } from "./tools/expense";
import { createExpense, readExpense, updateExpense, deleteExpense } from "./services/ExpenseService";
import { Hooks } from "gramio";
import { prisma } from "./services/prisma";
import { createConversation, coversationByUser, updateCOnversation } from "./services/ConversationService";
import { MessageType } from "@prisma/client";

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
  - read_expense: membaca pengeluaran. Field: telegramId (string|null), expenseId (string|null), limit (number|null).
  - update_expense: memperbarui pengeluaran. Field: expenseId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array objek {name, quantity, unitPrice}).
  - delete_expense: menghapus pengeluaran. Field: expenseId (string).
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
      if (c.message) historyMessages.push({ role: "user", content: c.message });
      if (c.response) historyMessages.push({ role: "assistant", content: c.response });
    }

    // Buat conversation untuk transaksi ini (response dikosongkan dulu)
    const conv = await createConversation({
      userId: user.id,
      message: text,
      response: "",
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
          tools: expenseTools as any,
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

          for (const toolCall of assistantMsg.tool_calls) {
            const name = toolCall.function?.name;
            let argsObj: Record<string, unknown> = {};
            try {
              argsObj = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
            } catch (e) {
              // Jika argumen invalid, lanjut dengan pesan error ke tool
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ ok: false, error: "Argumen tidak valid" }) });
              continue;
            }

            let result: unknown;
            if (name === "create_expense") {
              lastToolUsed = "create_expense";
              result = await createExpense({ ...argsObj, telegramId: chatId } as any);
            } else if (name === "read_expense") {
              lastToolUsed = "read_expense";
              result = await readExpense({ ...argsObj, telegramId: chatId } as any);
            } else if (name === "update_expense") {
              lastToolUsed = "update_expense";
              result = await updateExpense(argsObj as any);
            } else if (name === "delete_expense") {
              lastToolUsed = "delete_expense";
              result = await deleteExpense(argsObj as any);
            } else {
              result = { ok: false, error: "Perintah tidak dikenal" };
            }

            messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
          }

          // lanjut ke iterasi berikutnya
          continue;
        }

        // Tidak ada tool call, anggap ini respons final untuk user
        const finalText = assistantMsg.content ?? "Maaf, aku belum bisa memahami.";
        await updateCOnversation({
          id: conv.id,
          response: finalText,
          toolUsed: lastToolUsed ?? null,
          tokensIn,
          tokensOut,
        });
        return ctx.send(finalText);
      } catch (err) {
        // Jika error, update conversation dan kirim pesan gagal
        await updateCOnversation({
          id: conv.id,
          response: "Terjadi kesalahan saat memproses pesan.",
          toolUsed: lastToolUsed ?? null,
          tokensIn,
          tokensOut,
        });
        return ctx.send("Maaf, terjadi kesalahan. Coba lagi ya.");
      }
    }

    // Jika mencapai batas loop tanpa respons final, tutup percakapan dengan pesan default
    await updateCOnversation({
      id: conv.id,
      response: "Kita hentikan dulu ya, batas langkah AI tercapai.",
      toolUsed: lastToolUsed ?? null,
      tokensIn,
      tokensOut,
    });
    return ctx.send("Kita hentikan dulu ya, batas langkah AI tercapai.");
  });

bot.start();
// Hentikan impor command berbasis slash agar fokus pada natural language
// import "./commands/expense";
import { bot } from "./services/telegramBot";
import { openai, transcribeFromBuffer } from "./services/openai";
import { readReceiptData } from "./services/ReceiptService";
import { expenseTools } from "./tools/expense";
import { incomeTools } from "./tools/income";
import { memoryTools } from "./tools/memory";
import { finalTools } from "./tools/final";
import { categoryTools } from "./tools/category";
import { createExpense, readExpense, updateExpense, deleteExpense, createExpenseMany, readExpenseRange, readExpenseTotal } from "./services/ExpenseService";
import { createIncome, readIncome, updateIncome, deleteIncome } from "./services/IncomeService";
import { getMemory as getUserMemory, saveMemory as saveUserMemory, deleteMemory as deleteUserMemory, saveMemoryMany } from "./services/MemoryService";
import { prisma } from "./services/prisma";
import { createConversation, coversationByUser, updateConversation } from "./services/ConversationService";
import { MessageType, MessageRole } from "@prisma/client";
import logger from "./services/logger";
import { toNumber } from "./utils/money";
import { getRandomThinkingMessage, getToolProgressText } from "./utils/thinkingTemplates";
import { today } from "./command/today";
import { createOrUpdateUser } from "./services/UserService";
import { createCategory as createUserCategory, getCategoryList, seedDefaultCategoriesByTelegramId } from "./services/CategoryService";

// Helper untuk aman mengedit teks dengan fallback jika Markdown gagal
async function safeEditMarkdown(ctx: any, text: string, messageId: number) {
  try {
    return await ctx.editMessageText(text, { parse_mode: "Markdown", message_id: messageId });
  } catch (e) {
    try {
      return await ctx.editMessageText(text, { message_id: messageId });
    } catch (e2) {
      // Jika tetap gagal, kirim pesan baru sebagai fallback terakhir
      return await ctx.send(text);
    }
  }
}

// Environment validation
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `
You are a Telegram finance-tracking assistant.

Your tasks:
1. Understand user messages in natural language (e.g., "bought coffee for 20k", "salary came in 5 million").
2. Determine whether the message is an expense or income.
3. Determine the general category (food, transportation, salary, entertainment, etc.).

Use tool calls sequentially (multi-step) to complete the task:
- Always check memory first with get_memory before creating a transaction.
- Use save_memory to store preset items (key, price, unit) entered by the user. This info is crucial for calculating total expenses and income.
- Optimal sequence examples:
  - get_memory → check unit and calculate total → create_expense
  - save_memory → create_expense_many (use preset prices for multiple items)
  - read_expense → update_expense (edit the latest transaction)

Tool calls for CRUD expense:
- create_expense: create an expense. Fields: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array of objects {name, quantity, unitPrice}).
- create_expense_many: create an expense with multiple items at once; total is taken from summing item prices. Fields: telegramId (string), description (string), categoryId (string|null), categoryName (string|null), items (array of objects {name, price, quantity}).
- read_expense: read expenses. Fields: telegramId (string|null), expenseId (string|null), limit (number|null).
- read_expense_range: read expenses within a date range. Fields: telegramId (string), dateStart (string), dateEnd (string), limit (number|null).
- read_expense_total: get total expenses by period. Fields: telegramId (string), range ("today"|"this_week"|"this_month"|"custom"), dateStart (string|null), dateEnd (string|null), groupBy ("none"|"category").
- update_expense: update an expense. Fields: expenseId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null), items (array of objects {name, quantity, unitPrice}).
- delete_expense: delete an expense. Field: expenseId (string).

Tool calls for Memory/Preset System:
- save_memory: save or update a preset item (key, price, unit).
- save_memory_many: save or update multiple presets at once (items: [{key, price, unit}]).
- get_memory: retrieve a preset item by key.
- delete_memory: delete a preset item by key.

Tool calls for CRUD income:
- create_income: create an income. Fields: telegramId (string), description (string), amount (string|number|null), categoryId (string|null), categoryName (string|null).
- read_income: read incomes. Fields: telegramId (string|null), incomeId (string|null), limit (number|null).
- update_income: update an income. Fields: incomeId (string), description (string|null), amount (string|number|null), categoryId (string|null), categoryName (string|null).
- delete_income: delete an income. Field: incomeId (string).

Reply in a casual and easy-to-understand manner. Must be user-friendly, cute, and full of emotion (emojis allowed).
Example replies:
（｡•̀ᴗ-）✧ Transaction recorded, boss!\n\n🌟 Transaction ID: \`<id transaction>\`\n📂 Category : <response category>>\n💰 Amount   : <rp total>\n🕒 Today    : <datetime 22 June 2025, 5:30 PM>\n\n <transaction item details in list>\n\n<roasting>,
🍀 Okay, I've logged it for you~\n\n🌟 Transaction ID: \`<id transaction>\`\n📂 Category : <response category>>\n💰 Total    : <rp total>\n🕒 Now      : <datetime 22 June 2025, 5:30 PM>\n\n <transaction item details in list>\n\n<roasting> 💪,

List Category of transaction must be
{categoryList}

If something is still unclear, ask the user again.

NOTE:
- Today is {day} {date} {time} WIB
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
    await today(ctx as any);
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

    // add time to text in Asia/Jakarta
    const now = new Date();
    const tz = new Intl.DateTimeFormat("id", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const yyyy = tz.find(p => p.type === "year")!.value;
    const mm = tz.find(p => p.type === "month")!.value;
    const dd = tz.find(p => p.type === "day")!.value;
    const hh = tz.find(p => p.type === "hour")!.value;
    const ii = tz.find(p => p.type === "minute")!.value;

    // Kirim placeholder "berpikir" agar user tahu bot sedang proses
    const thinkingText = getRandomThinkingMessage();
    const thinkingMsg = await ctx.send(thinkingText);

    const chatId = String(ctx.chat.id);

    // Dapatkan atau buat user berdasarkan telegramId
    const user = await createOrUpdateUser({
      telegramId: chatId,
      language: "id",
      firstName: ctx.chat.firstName || "User",
      lastName: ctx.chat.lastName || "",
    });

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
    });

    const categoryList = await getCategoryList(user.id);

    // Agent loop dengan maksimal 10 langkah tool call
    let messages: Array<any> = [
      { role: "system", content: SYSTEM_PROMPT.trim().replace("{day}", now.toLocaleString("id-ID", { weekday: "long" })).replace("{date}", `${dd}/${mm}/${yyyy}`).replace("{time}", `${hh}:${ii}`).replace("{categoryList}", categoryList.join(", ")) },
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
          tools: [...expenseTools, ...incomeTools, ...memoryTools, ...categoryTools, ...finalTools] as any,
          messages,
        });

        tokensIn += completion.usage?.prompt_tokens ?? 0;
        tokensOut += completion.usage?.completion_tokens ?? 0;

        const assistantMsg = completion.choices?.[0]?.message;
        if (!assistantMsg) {
          logger.warn({ step }, "Empty assistant message");
          break;
        }

        // Jika ada tool call, jalankan lalu teruskan loop
        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          await safeEditMarkdown(ctx, getToolProgressText(assistantMsg.tool_calls[0]?.function.name || "thinking...."), thinkingMsg.id);

          messages.push(assistantMsg);

          for (const toolCall of assistantMsg.tool_calls) {
            // Catat tool call dengan role TOOL
            const name = toolCall.function?.name;
            
            if (!name) {
              logger.warn({ step, toolCall }, "Empty tool call name");
              continue;
            }
            
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
              switch (name) {
                case "create_expense":
                  result = await createExpense({ ...argsObj, telegramId: chatId } as any);
                  break;
                case "create_expense_many":
                  result = await createExpenseMany({ ...argsObj, telegramId: chatId } as any);
                  break;
                case "read_expense":
                  result = await readExpense({ ...argsObj, telegramId: chatId } as any);
                  break;
                case "read_expense_range": {
                  const dateStart = String((argsObj as any).dateStart || "");
                  const dateEnd = String((argsObj as any).dateEnd || "");
                  const limit = (argsObj as any).limit ?? null;
                  if (!dateStart || !dateEnd) {
                    result = { ok: false, error: "dateStart dan dateEnd wajib diisi" };
                  } else {
                    result = await readExpenseRange({ telegramId: chatId, dateStart, dateEnd, limit } as any);
                  }
                  break;
                }
                case "read_expense_total": {
                  const range = String((argsObj as any).range || "today");
                  const dateStart = (argsObj as any).dateStart ?? null;
                  const dateEnd = (argsObj as any).dateEnd ?? null;
                  const groupBy = String((argsObj as any).groupBy || "none");
                  result = await readExpenseTotal({ telegramId: chatId, range, dateStart, dateEnd, groupBy } as any);
                  break;
                }
                case "save_memory": {
                  const key = String((argsObj as any).key || "").trim();
                  const price = toNumber((argsObj as any).price) ?? 0;
                  const unit = String((argsObj as any).unit || "").trim();
                  if (!key || !unit) {
                    result = { ok: false, error: "Key dan unit wajib diisi" };
                  } else {
                    result = await saveUserMemory(user.id, key, { price, unit });
                  }
                  break;
                }
                case "get_memory": {
                  const key = String((argsObj as any).key || "").trim();
                  const item = key ? await getUserMemory(user.id, key) : null;
                  if (item) {
                    result = { ok: true, key, price: item.price, unit: item.unit };
                  } else {
                    result = { ok: false, error: "Data tidak ditemukan" };
                  }
                  break;
                }
                case "delete_memory": {
                  const key = String((argsObj as any).key || "").trim();
                  result = key ? await deleteUserMemory(user.id, key) : { ok: false, error: "Key wajib diisi" };
                  break;
                }
                case "save_memory_many": {
                  const items = Array.isArray((argsObj as any).items) ? ((argsObj as any).items as any[]) : [];
                  const normalized = items
                    .map((it) => ({
                      key: String(it?.key || "").trim(),
                      price: toNumber(it?.price) ?? 0,
                      unit: String(it?.unit || "").trim(),
                    }))
                    .filter((it) => it.key && it.unit);
                  result = await saveMemoryMany(user.id, normalized as any);
                  break;
                }
                case "update_expense":
                  result = await updateExpense(argsObj as any);
                  break;
                case "delete_expense": {
                  const expenseId = String((argsObj as any).expenseId || "");
                  const existing = expenseId ? await prisma.expense.findUnique({ where: { expenseId }, include: { category: true } }) : null;
                  result = existing ? await deleteExpense(argsObj as any) : { ok: false, error: "Data tidak ditemukan" };
                  break;
                }
                case "create_income":
                  result = await createIncome({ ...argsObj, telegramId: chatId } as any);
                  break;
                case "read_income":
                  result = await readIncome({ ...argsObj, telegramId: chatId } as any);
                  break;
                case "update_income":
                  result = await updateIncome(argsObj as any);
                  break;
                case "delete_income": {
                  const incomeId = String((argsObj as any).incomeId || "");
                  const existing = incomeId ? await prisma.income.findUnique({ where: { incomeId } }) : null;
                  result = existing ? await deleteIncome(argsObj as any) : { ok: false, error: "Data tidak ditemukan" };
                  break;
                }
                case "create_category": {
                  const nameCat = String((argsObj as any).name || "").trim();
                  const typeCat = String((argsObj as any).type || "").trim();
                  const parentCategoryIdRaw = (argsObj as any).parentCategoryId ?? null;
                  const parentCategoryId = parentCategoryIdRaw == null ? null : Number(parentCategoryIdRaw);
                  const parentCategoryName = (argsObj as any).parentCategoryName ?? null;
                  const isDefault = (argsObj as any).isDefault ?? null;
                  if (!nameCat || (typeCat !== "INCOME" && typeCat !== "EXPENSE")) {
                    result = { ok: false, error: "Nama dan tipe kategori wajib" };
                  } else {
                    result = await createUserCategory({ telegramId: chatId, name: nameCat, type: typeCat as any, parentCategoryId, parentCategoryName, isDefault: !!isDefault });
                  }
                  break;
                }
                case "seed_default_categories":
                  result = await seedDefaultCategoriesByTelegramId(chatId);
                  break;
                default:
                  result = { ok: false, error: "Perintah tidak dikenal" };
              }
              logger.info({ tool: name, args: argsObj, result }, "Tool call executed");
            } catch (toolErr: any) {
              logger.error({ tool: name, args: argsObj, error: toolErr?.message || toolErr }, "Tool call failed");
              result = { ok: false, error: "Tool call gagal" };
            }

            messages.push({ role: "assistant", tool_call_id: toolCall.id, content: JSON.stringify(result) });

            logger.info({ tool: name, args: argsObj, result }, "Tool call executed");
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

        return await safeEditMarkdown(ctx, finalText, thinkingMsg.id);
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
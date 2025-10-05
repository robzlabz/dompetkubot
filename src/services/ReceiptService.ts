import { openai } from "./openai";

const OPENAI_MODEL_VISION = process.env.OPENAI_MODEL_VISION || "gpt-4o-mini";

// Membaca data struk dari gambar (ArrayBuffer) dan mengembalikan teks ringkas berbahasa Indonesia.
// Jika gambar bukan struk, tangani dengan sopan dan berikan saran ke user.
export async function readReceiptData(buffer: ArrayBuffer, locale: string = "id"): Promise<string> {
  try {
    const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const systemPrompt =
      locale === "id"
        ? "Kamu adalah asisten yang mengekstrak item dari foto struk belanja. Jika gambar bukan struk, jelaskan dengan sopan dan minta user mengirim struk atau tulis detail transaksi. Jawab dalam bahasa Indonesia."
        : "You are an assistant that extracts items from a shopping receipt image. If the image is not a receipt, respond politely and ask the user to send a receipt or type the transaction details. Respond in the user's language.";

    const userInstruction =
      locale === "id"
        ? "Baca struk berikut dan kembalikan daftar item ringkas:\n- Format: nama | qty | harga per unit | total\n- Gunakan angka IDR tanpa pemisah untuk harga (contoh: 12000)\n- Sertakan total keseluruhan di akhir sebagai 'TOTAL: <angka>'\n- Jika bukan struk, katakan dengan sopan dan sarankan langkah selanjutnya."
        : "Read the receipt and return a concise item list:\n- Format: name | qty | unit price | total\n- Use plain numbers for prices (e.g., 12000)\n- Include the grand total at the end as 'TOTAL: <number>'\n- If not a receipt, politely say so and suggest next steps.";

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_VISION,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userInstruction },
            { type: "image_url", image_url: { url: dataUrl } },
          ] as any,
        },
      ],
    });

    const text: string = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (text) return text;
    return locale === "id"
      ? "Aku tidak bisa membaca gambar ini. Coba kirim foto struk yang lebih jelas atau tuliskan detail transaksi ya."
      : "I couldn't read this image. Please send a clearer receipt photo or type the transaction details.";
  } catch (e: any) {
    return locale === "id"
      ? "Maaf, aku belum bisa membaca struk dari gambar ini. Coba kirim foto struk yang lebih jelas atau tuliskan detail transaksi ya."
      : "Sorry, I couldn't read the receipt from this image. Please send a clearer photo or type the transaction details.";
  }
}
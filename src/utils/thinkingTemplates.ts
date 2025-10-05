const templates = [
  "⏳ Lagi mikir bentar ya…",
  "🧠 Aku proses dulu, sabar ya ✨",
  "🤔 Hmm, aku hitung-hitung dulu nih…",
  "🔎 Sedang menganalisis pesanmu…",
  "🪄 Lagi diolah biar rapi…",
  "📚 Aku cek data dan kategorinya dulu ya…",
  "⚙️ Mesin otak jalan, tunggu sebentar…",
  "🧩 Nyusun langkah terbaik dulu…",
  "📈 Aku susun perhitungan dan ringkasannya…",
  "💡 Sebentar… aku cari jawaban paling tepat!",
];

export function getRandomThinkingMessage(): string {
  const i = Math.floor(Math.random() * templates.length);
  return templates[i] ?? "⏳ Lagi mikir bentar ya…";
}

export function getToolProgressText(toolName: string): string {
  return `🛠️ Menjalankan tool: ${toolName}…`;
}

export function getToolDoneText(toolName: string): string {
  return `✅ Selesai menjalankan: ${toolName}`;
}
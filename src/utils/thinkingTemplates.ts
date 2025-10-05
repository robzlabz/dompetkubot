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

const toolProgressTemplates = [
  "⏳ Menjalankan tool: ${toolName}…",
  "⏳ Proses tool ${toolName} dimulai…",
  "⏳ Sedang menjalankan ${toolName}…",
  "🔄 Tool ${toolName} sedang aktif…",
  "🚀 Memulai eksekusi ${toolName}…",
  "⚙️ Menginisialisasi ${toolName}…",
  "🔧 Menyalakan mesin ${toolName}…",
  "📡 Menghubungkan ke ${toolName}…",
  "🧪 Menjalankan skrip ${toolName}…",
  "📥 Memuat modul ${toolName}…",
  "🕒 Tool ${toolName} sedang berjalan…",
  "🔍 Memvalidasi ${toolName}…",
  "📊 Memproses data via ${toolName}…",
  "🧩 Menyusun instruksi untuk ${toolName}…",
  "🛠️ Menyiapkan parameter ${toolName}…",
  "📡 Sinkronisasi dengan ${toolName}…",
  "🔑 Mengautentikasi ${toolName}…",
  "📤 Mengirim perintah ke ${toolName}…",
  "🔄 Loop eksekusi ${toolName} dimulai…",
  "⚡ Mempercepat proses ${toolName}…",
];

export function getToolProgressText(toolName: string): string {
  const i = Math.floor(Math.random() * toolProgressTemplates.length);
  return toolProgressTemplates[i]?.replace("${toolName}", toolName) ?? `⏳ Menjalankan tool: ${toolName}…`;
}

export function getToolDoneText(toolName: string): string {
  return `✅ Selesai menjalankan: ${toolName}`;
}
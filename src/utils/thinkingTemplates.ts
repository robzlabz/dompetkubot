const templates = [
  "⏳ Sabar yaa, otakku lagi loading kaya modem 56k…",
  "🧠 CPU otakku panas, lagi di-remaster pake kipas angin…",
  "🤔 Aku kalkulasi pake jari biar gak salah, sebentar…",
  "🔎 Ngubek-ngubek data kayak ngubek gorengan di pasar…",
  "🪄 Lagi diolah biar se-boom-boomnya, tunggu part 2…",
  "📚 Aku cek dompet & celana dalammu dulu ya (data maksudnya)…",
  "⚙️ Mesin otakku kaya Vespa tua, di-tendang dulu baru jalan…",
  "🧩 Nyusun strategi kayak nyusun LEGO kaki 3 pagi-pagi…",
  "📈 Aku bikin grafiknya pake MSPaint biar aesthetic…",
  "💡 Sebentar… lagi nyalain lampu ide pake genset!",
  "🐌 Otakku kaya keong, lagi nelan daun biar sehat…",
  "🍳 Lagi menggoreng data biar garing kayak keripuk…",
  "🕵️‍♂️ Aku sedang stalking data, biar kenal dulu…",
  "🎪 Otakku lagi latihan sirkus, sebentar lagi naik sepeda…",
  "🧃 Lagi nyeduh otak pake kopi instant biar cepat…",
  "🦥 Mode siput aktif, loadingnya pelan tapi pasti…",
  "🪴 Sedang menyirami data biar tumbuh besar…",
  "🧼 Aku cuci data dulu biar bersih dari hoaks…",
  "🎧 Otakku lagi remix lagu, nanti keluar mashup jawaban…",
  "🛌 Dataku masih tidur, sebentar lagi dibangunin…",
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
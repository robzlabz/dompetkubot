import { formatRupiah } from "./money";

type Action = "create" | "update" | "delete";

type Options = {
  categoryName?: string | null;
  amount?: number | null;
  description?: string | null;
  date?: Date | null;
};

function formatDate(idDate: Date): { d: string; t: string } {
  const d = idDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const t = idDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return { d, t };
}

export function formatFriendlyExpenseMessage(action: Action, opts: Options): string {
  const cat = (opts.categoryName || "Lainnya").trim();
  const amt = typeof opts.amount === "number" ? opts.amount : 0;
  const rp = formatRupiah(amt);
  const desc = (opts.description || "").trim();
  const descLine = desc ? `\n📝 Catatan : ${desc}` : "";
  const { d, t } = formatDate(opts.date || new Date());

  const createTemplates = [
    `（｡•̀ᴗ-）✧ Transaksi masuk, bos!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Hari ini : ${d} (${t})${descLine}\n\n🧾 Dompet udah update, jangan khawatir 😆`,
    `🍀 Oke, udah aku masukin ya~\n\n📂 Kategori : ${cat}\n💰 Total    : ${rp}\n🕒 Sekarang : ${d} (${t})${descLine}\n\nLangkah kecil, keuangan besar! 💪`,
    `🧃 Catatan baru sudah mendarat!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nGas terus kelola finansialmu ✨`,
    `🎯 Transaksi berhasil dicatat!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nDompetmu makin transparan! 📊`,
    `💫 Data baru tersimpan!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 Tanggal  : ${d} (${t})${descLine}\n\nSemangat nabung terus yaa! 🏦`,
    `🚀 Transaksi baru siap meluncur!\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nAyo nabung makin rajin! 🌟`,
    `🌈 Tambahan catatan keuangan!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 ${d} (${t})${descLine}\n\nDompet makin berkembang! 🌱`,
    `⚡ Catatan keuangan terbaru!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 Hari ini : ${d} (${t})${descLine}\n\nTerus pantau pengeluaranmu! 📈`,
    `🎉 Transaksi berhasil ditambahkan!\n\n📂 Kategori : ${cat}\n💰 Total    : ${rp}\n🕒 Tanggal  : ${d} (${t})${descLine}\n\nKeuanganmu makin teratur! 📅`,
    `✨ Data keuangan baru tercatat!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nSemangat kelola uangmu! 💼`,
    `🌟 Tambahan pengeluaran tercatat!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 ${d} (${t})${descLine}\n\nLangkah kecil menuju keuangan sehat! 🌿`,
    `🎊 Catatan transaksi baru masuk!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Sekarang : ${d} (${t})${descLine}\n\nDompetmu siap diawasi! 👀`,
    `🚗 Transaksi baru berjalan!\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 ${d} (${t})${descLine}\n\nTerus awasi arus kasmu! 🔄`,
    `💡 Informasi keuangan terbaru!\n\n📂 Kategori : ${cat}\n💰 Total    : ${rp}\n🕒 Tanggal  : ${d} (${t})${descLine}\n\nPantau terus keuangannmu! 📊`,
    `🌺 Catatan pengeluaran baru!\n\n📂 Kategori : ${cat}\n💸 Jumlah   : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nKeuangan makin terkontrol! 🎯`,
  ];

  const updateTemplates = [
    `🔧 Udah aku edit, rapih sekarang!\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 Update   : ${d} (${t})${descLine}\n\nMantap lanjut! 🚀`,
    `🪄 Perubahan berhasil disimpan~\n\n📂 Kategori : ${cat}\n💸 Total    : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nDompet makin teratur 😊`,
    `✨ Edit sukses!\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 ${d} (${t})${descLine}\n\nTerus jaga ritme keuanganmu! 🌱`,
    `📝 Data berhasil diperbarui!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Update   : ${d} (${t})${descLine}\n\nRevisi dompet selesai! ✅`,
    `🔄 Perubahan tersimpan!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 Waktu    : ${d} (${t})${descLine}\n\nCatatanmu kini lebih akurat! 📈`,
  ];

  const deleteTemplates = [
    `🗑️ Oke, transaksi sudah aku hapus.\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 Tanggal  : ${d}${descLine}\n\nDompet aman terkendali! 💼`,
    `👋 Transaksi dihapus, beres!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 ${d}${descLine}\n\nTenang, catatanmu tetap aman ✨`,
    `🌬️ Bye-bye transaksi!\n\n📂 Kategori : ${cat}\n💰 Nominal  : ${rp}\n🕒 ${d}${descLine}\n\nKalau salah input, tinggal tambah lagi ya 😉`,
    `🧹 Data sudah dibersihkan!\n\n📂 Kategori : ${cat}\n💰 Jumlah   : ${rp}\n🕒 Tanggal  : ${d}${descLine}\n\nDompet kini lebih ringan! 🍃`,
    `💨 Transaksi hilang ditelan waktu!\n\n📂 Kategori : ${cat}\n💸 Nominal  : ${rp}\n🕒 ${d}${descLine}\n\nYang penting pelajaran tetap ada! 📚`,
  ];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (action === "create") return pick(createTemplates) as string;
  if (action === "update") return pick(updateTemplates) as string;
  return pick(deleteTemplates) as string;
}

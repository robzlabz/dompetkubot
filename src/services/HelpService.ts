import { IUser } from '../interfaces/index.js';

export interface HelpContent {
    title: string;
    content: string;
    examples?: string[];
}

export interface GuidedSetupStep {
    step: number;
    title: string;
    description: string;
    prompt: string;
    validation?: (input: string) => { valid: boolean; error?: string };
    nextStep?: number;
}

export class HelpService {
    private helpTopics: Map<string, HelpContent> = new Map();
    private guidedSetupSteps: GuidedSetupStep[] = [];

    constructor() {
        this.initializeHelpContent();
        this.initializeGuidedSetup();
    }

    private initializeHelpContent(): void {
        // Main help content
        this.helpTopics.set('main', {
            title: '📖 Panduan Budget Bot',
            content: `Selamat datang di Budget Bot! Saya akan membantu Anda mengelola keuangan dengan mudah menggunakan bahasa Indonesia.

✨ **Fitur Utama:**
• 💬 Chat natural dalam Bahasa Indonesia
• 🎤 Pesan suara (premium - 0.5 koin)
• 📸 Scan struk belanja (premium - 1 koin)
• 📊 Laporan keuangan otomatis
• 🎯 Pengaturan budget dan alert
• 🏷️ Kategorisasi otomatis dengan AI

🚀 **Mulai dengan mengetik:**
• "beli kopi 25rb" - catat pengeluaran
• "gaji 5 juta" - catat pemasukan
• "budget makanan 1 juta" - atur budget
• "laporan bulan ini" - lihat ringkasan

Ketik /help [topik] untuk bantuan spesifik:
• /help pengeluaran
• /help pemasukan
• /help budget
• /help laporan
• /help koin
• /help voucher
• /help privasi`
        });

        // Expense help
        this.helpTopics.set('pengeluaran', {
            title: '💸 Cara Mencatat Pengeluaran',
            content: `Anda bisa mencatat pengeluaran dengan berbagai cara:

**Format Sederhana:**
• "beli kopi 25rb"
• "bayar listrik 150000"
• "makan siang 35000"

**Dengan Perhitungan:**
• "beli ayam 5kg @ 12rb" (5 × 12.000 = 60.000)
• "beli permen 10 @ 500" (10 × 500 = 5.000)
• "belanja groceries 3kg beras @ 15rb"

**Fitur Premium:**
• 🎤 Kirim pesan suara: "beli cilok 2rb"
• 📸 Foto struk: Upload foto untuk input otomatis

**Edit Pengeluaran:**
• "ubah pembelian kopi tadi jadi 30rb"
• "edit transaksi terakhir"`,
            examples: [
                'beli kopi 25rb',
                'bayar listrik 150000',
                'belanja groceries 5kg ayam @ 12rb',
                'makan siang di warteg 35000'
            ]
        });

        // Income help
        this.helpTopics.set('pemasukan', {
            title: '💰 Cara Mencatat Pemasukan',
            content: `Catat semua pemasukan Anda dengan mudah:

**Format Pemasukan:**
• "gaji bulan ini 5 juta"
• "dapat bonus 500rb"
• "freelance project 2 juta"
• "jual barang 150000"

**Kategori Otomatis:**
Sistem akan otomatis mengkategorikan pemasukan Anda:
• Gaji → Kategori "Gaji"
• Bonus → Kategori "Bonus"
• Freelance → Kategori "Freelance"
• Investasi → Kategori "Investasi"`,
            examples: [
                'gaji bulan ini 5 juta',
                'dapat bonus 500rb',
                'freelance project 2 juta',
                'jual laptop bekas 3 juta'
            ]
        });

        // Budget help
        this.helpTopics.set('budget', {
            title: '🎯 Mengatur Budget',
            content: `Kelola budget Anda untuk kontrol keuangan yang lebih baik:

**Mengatur Budget:**
• "budget makanan 1 juta"
• "budget transportasi 500rb"
• "budget hiburan 300000"

**Cek Status Budget:**
• "status budget"
• "budget makanan berapa"
• "sisa budget transportasi"

**Alert Otomatis:**
• Peringatan saat mencapai 80% budget
• Alert saat melebihi 100% budget
• Notifikasi harian untuk kategori yang hampir habis

**Tips Budget:**
• Mulai dengan kategori utama: makanan, transportasi, tagihan
• Sesuaikan budget berdasarkan penghasilan
• Review budget setiap bulan`,
            examples: [
                'budget makanan 1 juta',
                'budget transportasi 500rb',
                'status budget',
                'sisa budget makanan'
            ]
        });

        // Reports help
        this.helpTopics.set('laporan', {
            title: '📊 Laporan Keuangan',
            content: `Dapatkan insight keuangan dengan laporan otomatis:

**Jenis Laporan:**
• "laporan bulan ini" - ringkasan bulanan
• "laporan minggu ini" - ringkasan mingguan
• "ringkasan hari ini" - transaksi hari ini
• "laporan kategori makanan" - detail per kategori

**Isi Laporan:**
• Total pengeluaran dan pemasukan
• Breakdown per kategori
• Persentase dari budget
• Item-item detail (jika ada)
• Trend pengeluaran

**Format Laporan:**
• Grafik visual (dalam teks)
• Mata uang Rupiah
• Bahasa Indonesia
• Komentar AI yang personal`,
            examples: [
                'laporan bulan ini',
                'ringkasan minggu ini',
                'laporan kategori makanan',
                'pengeluaran hari ini'
            ]
        });

        // Coins help
        this.helpTopics.set('koin', {
            title: '🪙 Sistem Koin',
            content: `Gunakan koin untuk fitur premium:

**Cara Menambah Koin:**
• "tambah saldo 50rb" - beli koin
• "top up 100000" - isi ulang saldo
• Redeem voucher gratis

**Penggunaan Koin:**
• 🎤 Pesan suara: 0.5 koin
• 📸 Scan struk: 1 koin
• Fitur AI premium: bervariasi

**Cek Saldo:**
• "saldo koin"
• "berapa koin saya"
• "cek balance"

**Konversi:**
• 1.000 Rupiah = 1 koin
• Minimum top up: 10.000 Rupiah (10 koin)
• Koin tidak expired

**Refund:**
• Koin dikembalikan jika proses gagal
• Otomatis refund dalam 1 menit`,
            examples: [
                'tambah saldo 50rb',
                'saldo koin',
                'top up 100000',
                'berapa koin saya'
            ]
        });

        // Voucher help
        this.helpTopics.set('voucher', {
            title: '🎫 Sistem Voucher',
            content: `Redeem voucher untuk mendapat benefit:

**Cara Redeem:**
• "pakai voucher ABC123"
• "redeem WELCOME2024"
• "klaim voucher NEWUSER"

**Jenis Voucher:**
• 🪙 Koin gratis
• 💰 Saldo bonus
• 🎁 Diskon top up

**Status Voucher:**
• ✅ Valid dan belum dipakai
• ❌ Sudah dipakai
• ⏰ Expired
• 🚫 Tidak valid

**Voucher Khusus:**
• NEWUSER: 5 koin gratis untuk pengguna baru
• MONTHLY: Voucher bulanan untuk pengguna aktif
• REFERRAL: Bonus untuk mengajak teman`,
            examples: [
                'pakai voucher WELCOME2024',
                'redeem NEWUSER',
                'klaim voucher ABC123'
            ]
        });

        // Privacy help
        this.helpTopics.set('privasi', {
            title: '🔒 Privasi & Keamanan',
            content: `Keamanan data Anda adalah prioritas utama:

**Perlindungan Data:**
• Enkripsi AES-256 untuk data sensitif
• ID Telegram diverifikasi setiap akses
• Data tidak dibagikan ke pihak ketiga

**Kontrol Privasi:**
• /deletedata - Hapus semua data
• /exportdata - Unduh data Anda
• /deleteconversations - Hapus riwayat chat
• /privacy - Info lengkap privasi

**Retensi Data:**
• Percakapan: Untuk meningkatkan layanan
• Data keuangan: Sampai Anda menghapusnya
• Data sementara: Auto-delete 30 hari

**Hak Anda:**
• Akses data kapan saja
• Edit atau hapus data
• Ekspor dalam format JSON
• Keluar dari layanan sepenuhnya`,
            examples: [
                '/deletedata',
                '/exportdata',
                '/deleteconversations',
                '/privacy'
            ]
        });
    }

    private initializeGuidedSetup(): void {
        this.guidedSetupSteps = [
            {
                step: 1,
                title: 'Selamat Datang! 🎉',
                description: 'Mari kita setup akun Budget Bot Anda',
                prompt: `Halo! Saya akan membantu Anda setup Budget Bot dalam beberapa langkah mudah.

**Langkah 1: Kategori Default**
Saya akan menambahkan kategori-kategori umum untuk Anda:
• Makanan & Minuman
• Transportasi
• Tagihan & Utilitas
• Hiburan
• Belanja
• Kesehatan
• Pendidikan

Apakah Anda ingin menambah kategori khusus? (ketik nama kategori atau "lanjut" untuk melanjutkan)`,
                validation: (input: string) => ({ valid: true }),
                nextStep: 2
            },
            {
                step: 2,
                title: 'Budget Bulanan 💰',
                description: 'Atur budget untuk kategori utama',
                prompt: `**Langkah 2: Budget Bulanan**

Sekarang mari atur budget bulanan Anda. Ini akan membantu mengontrol pengeluaran.

Contoh format:
• "budget makanan 1 juta"
• "budget transportasi 500rb"
• "budget hiburan 300000"

Mulai dengan kategori "Makanan & Minuman". Berapa budget bulanan Anda untuk makanan?
(ketik jumlah atau "skip" untuk lewati)`,
                validation: (input: string) => {
                    if (input.toLowerCase() === 'skip') return { valid: true };
                    const amount = this.extractAmount(input);
                    if (amount === null) {
                        return { valid: false, error: 'Format tidak valid. Contoh: "1 juta" atau "500000"' };
                    }
                    return { valid: true };
                },
                nextStep: 3
            },
            {
                step: 3,
                title: 'Koin Gratis! 🪙',
                description: 'Dapatkan koin gratis untuk memulai',
                prompt: `**Langkah 3: Koin Gratis!**

🎁 Selamat! Anda mendapat 5 koin gratis sebagai bonus pengguna baru!

**Kegunaan Koin:**
• 🎤 Pesan suara: 0.5 koin
• 📸 Scan struk: 1 koin

**Cara Menambah Koin:**
• "tambah saldo 50rb" (50 koin)
• Redeem voucher gratis
• Bonus aktivitas bulanan

Koin Anda: 5 🪙

Ketik "selesai" untuk menyelesaikan setup, atau "bantuan" untuk tips penggunaan.`,
                validation: (input: string) => ({ valid: true }),
                nextStep: 4
            },
            {
                step: 4,
                title: 'Setup Selesai! ✅',
                description: 'Akun Anda siap digunakan',
                prompt: `**🎉 Setup Selesai!**

Akun Budget Bot Anda sudah siap digunakan!

**Mulai Sekarang:**
• "beli kopi 25rb" - catat pengeluaran pertama
• "gaji 5 juta" - catat pemasukan
• "laporan bulan ini" - lihat ringkasan

**Bantuan:**
• /help - panduan lengkap
• /help pengeluaran - cara catat pengeluaran
• /help koin - info sistem koin

Selamat mengelola keuangan dengan Budget Bot! 🚀`,
                validation: (input: string) => ({ valid: true })
            }
        ];
    }

    getHelpContent(topic?: string): HelpContent {
        const key = topic?.toLowerCase() || 'main';
        return this.helpTopics.get(key) || this.helpTopics.get('main')!;
    }

    getAvailableTopics(): string[] {
        return Array.from(this.helpTopics.keys()).filter(key => key !== 'main');
    }

    getGuidedSetupStep(step: number): GuidedSetupStep | null {
        return this.guidedSetupSteps.find(s => s.step === step) || null;
    }

    getNextSetupStep(currentStep: number): GuidedSetupStep | null {
        const current = this.getGuidedSetupStep(currentStep);
        if (!current || !current.nextStep) return null;
        return this.getGuidedSetupStep(current.nextStep);
    }

    isSetupComplete(step: number): boolean {
        return step >= this.guidedSetupSteps.length;
    }

    generateWelcomeMessage(user: { firstName?: string; isNewUser: boolean }): string {
        const firstName = user.firstName || 'Teman';
        
        if (user.isNewUser) {
            return `🎉 **Halo ${firstName}, selamat datang di Budget Bot!**

Saya adalah asisten keuangan pribadi yang akan membantu Anda mengelola pengeluaran dan pemasukan dengan mudah menggunakan bahasa Indonesia.

🎁 **Bonus untuk pengguna baru:**
• 5 koin gratis untuk mencoba fitur premium!
• Setup otomatis kategori dan budget

✨ **Fitur utama:**
• 💬 Chat natural dalam Bahasa Indonesia
• 🎤 Pesan suara (premium - 0.5 koin)
• 📸 Scan struk belanja (premium - 1 koin)
• 📊 Laporan keuangan otomatis
• 🎯 Pengaturan budget dan alert
• 🏷️ Kategorisasi otomatis dengan AI

🚀 **Pilih cara memulai:**
• Ketik "setup" untuk panduan lengkap
• Atau langsung coba: "beli kopi 25rb"

Ketik /help untuk panduan lengkap!`;
        } else {
            return `👋 **Selamat datang kembali, ${firstName}!**

Saya siap membantu Anda mengelola keuangan hari ini.

✨ **Fitur yang tersedia:**
• 💬 Chat natural dalam Bahasa Indonesia
• 🎤 Pesan suara (premium - 0.5 koin)
• 📸 Scan struk belanja (premium - 1 koin)
• 📊 Laporan keuangan otomatis
• 🎯 Pengaturan budget dan alert
• 🏷️ Kategorisasi otomatis dengan AI

🚀 **Mulai dengan mengetik transaksi Anda atau:**
• "laporan bulan ini" - lihat ringkasan keuangan
• "saldo koin" - cek saldo koin Anda
• "status budget" - cek status budget

Ketik /help untuk panduan lengkap!`;
        }
    }

    generateHelpSuggestions(userInput: string): string[] {
        const input = userInput.toLowerCase();
        const suggestions: string[] = [];

        // Analyze user input and provide contextual suggestions
        if (input.includes('pengeluaran') || input.includes('beli') || input.includes('bayar')) {
            suggestions.push('Coba format: "beli kopi 25rb" atau "bayar listrik 150000"');
            suggestions.push('Untuk perhitungan: "beli ayam 5kg @ 12rb"');
            suggestions.push('Ketik /help pengeluaran untuk panduan lengkap');
        }

        if (input.includes('pemasukan') || input.includes('gaji') || input.includes('bonus')) {
            suggestions.push('Coba format: "gaji bulan ini 5 juta" atau "dapat bonus 500rb"');
            suggestions.push('Ketik /help pemasukan untuk panduan lengkap');
        }

        if (input.includes('budget') || input.includes('anggaran')) {
            suggestions.push('Coba format: "budget makanan 1 juta"');
            suggestions.push('Untuk cek status: "status budget"');
            suggestions.push('Ketik /help budget untuk panduan lengkap');
        }

        if (input.includes('laporan') || input.includes('ringkasan') || input.includes('report')) {
            suggestions.push('Coba: "laporan bulan ini" atau "ringkasan minggu ini"');
            suggestions.push('Ketik /help laporan untuk panduan lengkap');
        }

        if (input.includes('koin') || input.includes('saldo') || input.includes('balance')) {
            suggestions.push('Coba: "saldo koin" atau "tambah saldo 50rb"');
            suggestions.push('Ketik /help koin untuk info sistem koin');
        }

        if (input.includes('voucher') || input.includes('redeem') || input.includes('klaim')) {
            suggestions.push('Coba: "pakai voucher ABC123"');
            suggestions.push('Ketik /help voucher untuk info voucher');
        }

        // Default suggestions if no specific context
        if (suggestions.length === 0) {
            suggestions.push('Coba: "beli kopi 25rb" untuk mencatat pengeluaran');
            suggestions.push('Atau: "gaji 5 juta" untuk mencatat pemasukan');
            suggestions.push('Ketik /help untuk panduan lengkap');
        }

        return suggestions;
    }

    private extractAmount(text: string): number | null {
        // Extract amount from Indonesian text
        const cleanText = text.toLowerCase().replace(/[^\d\s]/g, ' ');
        
        // Handle "juta", "ribu", "rb", "k" suffixes
        if (text.includes('juta')) {
            const match = text.match(/(\d+(?:\.\d+)?)\s*juta/);
            if (match) return parseFloat(match[1]) * 1000000;
        }
        
        if (text.includes('ribu') || text.includes('rb')) {
            const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ribu|rb)/);
            if (match) return parseFloat(match[1]) * 1000;
        }
        
        if (text.includes('k')) {
            const match = text.match(/(\d+(?:\.\d+)?)\s*k/);
            if (match) return parseFloat(match[1]) * 1000;
        }
        
        // Direct number
        const match = cleanText.match(/\d+/);
        if (match) return parseInt(match[0]);
        
        return null;
    }
}
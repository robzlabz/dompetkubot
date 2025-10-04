export enum ErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    VOUCHER_INVALID = 'VOUCHER_INVALID',
    VOUCHER_ALREADY_USED = 'VOUCHER_ALREADY_USED',
    CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
    EXPENSE_NOT_FOUND = 'EXPENSE_NOT_FOUND',
    INCOME_NOT_FOUND = 'INCOME_NOT_FOUND',
    BUDGET_NOT_FOUND = 'BUDGET_NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
    OCR_PROCESSING_ERROR = 'OCR_PROCESSING_ERROR',
    STT_PROCESSING_ERROR = 'STT_PROCESSING_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INVALID_INPUT_FORMAT = 'INVALID_INPUT_FORMAT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
    type: ErrorType;
    message: string;
    details?: any;
    originalError?: Error;
    timestamp: Date;
    userId?: string;
    context?: Record<string, any>;
}

export interface ErrorResponse {
    success: false;
    error: AppError;
    userMessage: string;
    suggestions?: string[];
    helpTopic?: string;
}

export class ErrorHandlingService {
    private errorMessages: Map<ErrorType, (error: AppError) => string> = new Map();
    private fallbackResponses: string[] = [];

    constructor() {
        this.initializeErrorMessages();
        this.initializeFallbackResponses();
    }

    private initializeErrorMessages(): void {
        // Validation errors
        this.errorMessages.set(ErrorType.VALIDATION_ERROR, (error) => {
            const field = error.details?.field || 'input';
            return `❌ **Format tidak valid**\n\nMohon periksa ${field} Anda dan coba lagi.\n\n💡 **Contoh format yang benar:**\n• "beli kopi 25rb"\n• "gaji 5 juta"\n• "budget makanan 1 juta"`;
        });

        this.errorMessages.set(ErrorType.INVALID_INPUT_FORMAT, (error) => {
            return `❌ **Format input tidak dikenali**\n\nSaya tidak bisa memahami format yang Anda gunakan.\n\n💡 **Coba format ini:**\n• "beli [item] [harga]" - untuk pengeluaran\n• "gaji [jumlah]" - untuk pemasukan\n• "budget [kategori] [jumlah]" - untuk budget\n\nKetik /help untuk panduan lengkap.`;
        });

        // Balance and coin errors
        this.errorMessages.set(ErrorType.INSUFFICIENT_BALANCE, (error) => {
            const required = error.details?.required || 'beberapa';
            const current = error.details?.current || 0;
            return `❌ **Saldo koin tidak cukup**\n\nDibutuhkan: ${required} koin\nSaldo Anda: ${current} koin\n\n💰 **Cara menambah koin:**\n• "tambah saldo 50rb" (50 koin)\n• "top up 100000" (100 koin)\n• Redeem voucher gratis\n\nKetik /help koin untuk info lengkap.`;
        });

        // Voucher errors
        this.errorMessages.set(ErrorType.VOUCHER_INVALID, (error) => {
            const code = error.details?.code || 'voucher';
            return `❌ **Voucher tidak valid**\n\nKode "${code}" tidak ditemukan atau sudah tidak berlaku.\n\n🎫 **Tips voucher:**\n• Pastikan kode ditulis dengan benar\n• Periksa tanggal expired\n• Coba voucher: NEWUSER (untuk pengguna baru)\n\nKetik /help voucher untuk info lengkap.`;
        });

        this.errorMessages.set(ErrorType.VOUCHER_ALREADY_USED, (error) => {
            const code = error.details?.code || 'voucher';
            return `❌ **Voucher sudah digunakan**\n\nKode "${code}" sudah pernah Anda gunakan sebelumnya.\n\n🎫 **Voucher lainnya:**\n• Cek voucher bulanan terbaru\n• Follow update untuk voucher baru\n• Ajak teman untuk voucher referral`;
        });

        // Data not found errors
        this.errorMessages.set(ErrorType.EXPENSE_NOT_FOUND, (error) => {
            return `❌ **Pengeluaran tidak ditemukan**\n\nTransaksi yang Anda maksud tidak ditemukan.\n\n📝 **Coba ini:**\n• "laporan hari ini" - lihat transaksi hari ini\n• "pengeluaran terakhir" - lihat transaksi terbaru\n• Pastikan Anda sudah mencatat pengeluaran`;
        });

        this.errorMessages.set(ErrorType.INCOME_NOT_FOUND, (error) => {
            return `❌ **Pemasukan tidak ditemukan**\n\nData pemasukan yang Anda maksud tidak ditemukan.\n\n📝 **Coba ini:**\n• "laporan hari ini" - lihat transaksi hari ini\n• "pemasukan terakhir" - lihat pemasukan terbaru\n• Pastikan Anda sudah mencatat pemasukan`;
        });

        this.errorMessages.set(ErrorType.CATEGORY_NOT_FOUND, (error) => {
            const category = error.details?.category || 'kategori';
            return `❌ **Kategori tidak ditemukan**\n\nKategori "${category}" tidak ada dalam sistem.\n\n🏷️ **Solusi:**\n• "buat kategori ${category}" - buat kategori baru\n• "daftar kategori" - lihat kategori yang ada\n• Gunakan kategori default seperti "makanan", "transportasi"`;
        });

        this.errorMessages.set(ErrorType.BUDGET_NOT_FOUND, (error) => {
            const category = error.details?.category || 'kategori';
            return `❌ **Budget tidak ditemukan**\n\nBelum ada budget untuk kategori "${category}".\n\n🎯 **Cara mengatur budget:**\n• "budget ${category} 1 juta"\n• "budget makanan 500rb"\n• "status budget" - lihat semua budget`;
        });

        // Service errors
        this.errorMessages.set(ErrorType.AI_SERVICE_ERROR, (error) => {
            return `🤖 **Layanan AI sedang bermasalah**\n\nMaaf, sistem AI sedang mengalami gangguan.\n\n🔄 **Coba lagi:**\n• Tunggu beberapa saat dan coba lagi\n• Gunakan format yang lebih sederhana\n• Ketik /help untuk panduan manual\n\nJika masalah berlanjut, hubungi admin.`;
        });

        this.errorMessages.set(ErrorType.OCR_PROCESSING_ERROR, (error) => {
            return `📸 **Gagal memproses foto struk**\n\nMaaf, tidak bisa membaca struk dari foto Anda.\n\n📋 **Tips foto struk:**\n• Pastikan foto jelas dan tidak blur\n• Cahaya cukup terang\n• Struk tidak terlipat atau rusak\n• Format struk standar Indonesia\n\n💰 Koin telah dikembalikan ke akun Anda.`;
        });

        this.errorMessages.set(ErrorType.STT_PROCESSING_ERROR, (error) => {
            return `🎤 **Gagal memproses pesan suara**\n\nMaaf, tidak bisa mendengar pesan suara Anda dengan jelas.\n\n🗣️ **Tips pesan suara:**\n• Bicara dengan jelas dan tidak terlalu cepat\n• Hindari suara bising di latar belakang\n• Durasi maksimal 60 detik\n• Gunakan bahasa Indonesia\n\n💰 Koin telah dikembalikan ke akun Anda.`;
        });

        // System errors
        this.errorMessages.set(ErrorType.DATABASE_ERROR, (error) => {
            return `💾 **Masalah database**\n\nMaaf, terjadi masalah saat menyimpan data.\n\n🔄 **Solusi:**\n• Coba lagi dalam beberapa saat\n• Data Anda aman, tidak hilang\n• Jika masalah berlanjut, hubungi admin\n\nTerima kasih atas kesabaran Anda.`;
        });

        this.errorMessages.set(ErrorType.NETWORK_ERROR, (error) => {
            return `🌐 **Masalah koneksi**\n\nMaaf, terjadi masalah koneksi jaringan.\n\n📶 **Coba ini:**\n• Periksa koneksi internet Anda\n• Tunggu beberapa saat dan coba lagi\n• Restart aplikasi Telegram\n\nData Anda aman dan tersimpan.`;
        });

        this.errorMessages.set(ErrorType.RATE_LIMIT_EXCEEDED, (error) => {
            const resetTime = error.details?.resetTime || '1 menit';
            return `⏱️ **Terlalu banyak permintaan**\n\nAnda telah mencapai batas maksimal permintaan.\n\n⏳ **Tunggu ${resetTime} lagi**\n\nIni untuk menjaga kualitas layanan untuk semua pengguna.\nTerima kasih atas pengertian Anda.`;
        });

        // Authentication errors
        this.errorMessages.set(ErrorType.AUTHENTICATION_ERROR, (error) => {
            return `🔐 **Masalah autentikasi**\n\nMaaf, terjadi masalah saat memverifikasi akun Anda.\n\n🔄 **Solusi:**\n• Ketik /start untuk memulai ulang\n• Restart aplikasi Telegram\n• Jika masalah berlanjut, hubungi admin\n\nData Anda tetap aman.`;
        });

        this.errorMessages.set(ErrorType.PERMISSION_DENIED, (error) => {
            return `🚫 **Akses ditolak**\n\nAnda tidak memiliki izin untuk melakukan tindakan ini.\n\n👤 **Kemungkinan penyebab:**\n• Akun belum terverifikasi\n• Fitur khusus pengguna premium\n• Batasan akses grup\n\nHubungi admin jika Anda yakin ini adalah kesalahan.`;
        });

        // Unknown error
        this.errorMessages.set(ErrorType.UNKNOWN_ERROR, (error) => {
            return `❓ **Terjadi kesalahan tidak terduga**\n\nMaaf, terjadi kesalahan yang tidak diketahui.\n\n🔄 **Coba ini:**\n• Tunggu beberapa saat dan coba lagi\n• Ketik /start untuk memulai ulang\n• Gunakan format yang lebih sederhana\n\nJika masalah berlanjut, hubungi admin dengan kode error: ${error.details?.errorId || 'UNKNOWN'}`;
        });
    }

    private initializeFallbackResponses(): void {
        this.fallbackResponses = [
            `🤖 **Hmm, saya tidak mengerti...**\n\nBisa dijelaskan dengan cara lain?\n\n💡 **Contoh yang bisa saya pahami:**\n• "beli kopi 25rb"\n• "gaji 5 juta"\n• "budget makanan 1 juta"\n\nKetik /help untuk panduan lengkap.`,
            
            `🧐 **Sepertinya ada yang kurang jelas...**\n\nCoba gunakan format yang lebih sederhana?\n\n📝 **Format yang mudah:**\n• Pengeluaran: "beli [item] [harga]"\n• Pemasukan: "gaji [jumlah]"\n• Budget: "budget [kategori] [jumlah]"\n\nKetik /help untuk bantuan.`,
            
            `🤔 **Saya belum paham maksud Anda...**\n\nBisa diulang dengan kata-kata yang berbeda?\n\n✨ **Tips:**\n• Gunakan bahasa Indonesia yang sederhana\n• Sebutkan angka dengan jelas (25rb, 5 juta)\n• Satu perintah dalam satu pesan\n\nKetik /help untuk panduan.`,
            
            `😅 **Maaf, saya masih belajar...**\n\nBisa bantu saya memahami dengan format yang lebih jelas?\n\n🎯 **Yang bisa saya bantu:**\n• Catat pengeluaran dan pemasukan\n• Atur budget dan lihat laporan\n• Kelola koin dan redeem voucher\n\nKetik /help untuk melihat semua fitur.`
        ];
    }

    createError(
        type: ErrorType,
        message: string,
        details?: any,
        originalError?: Error,
        userId?: string,
        context?: Record<string, any>
    ): AppError {
        return {
            type,
            message,
            details,
            originalError,
            timestamp: new Date(),
            userId,
            context
        };
    }

    formatErrorResponse(error: AppError): ErrorResponse {
        const messageFormatter = this.errorMessages.get(error.type);
        const userMessage = messageFormatter ? messageFormatter(error) : this.getDefaultErrorMessage(error);
        
        const suggestions = this.generateSuggestions(error);
        const helpTopic = this.getRelevantHelpTopic(error);

        return {
            success: false,
            error,
            userMessage,
            suggestions,
            helpTopic
        };
    }

    private getDefaultErrorMessage(error: AppError): string {
        return `❌ **Terjadi kesalahan**\n\n${error.message}\n\n🔄 Silakan coba lagi atau ketik /help untuk bantuan.`;
    }

    private generateSuggestions(error: AppError): string[] {
        const suggestions: string[] = [];

        switch (error.type) {
            case ErrorType.VALIDATION_ERROR:
            case ErrorType.INVALID_INPUT_FORMAT:
                suggestions.push('Coba format: "beli kopi 25rb"');
                suggestions.push('Atau: "gaji 5 juta"');
                suggestions.push('Ketik /help untuk panduan lengkap');
                break;

            case ErrorType.INSUFFICIENT_BALANCE:
                suggestions.push('Ketik "tambah saldo 50rb"');
                suggestions.push('Atau redeem voucher gratis');
                suggestions.push('Ketik /help koin untuk info lengkap');
                break;

            case ErrorType.VOUCHER_INVALID:
            case ErrorType.VOUCHER_ALREADY_USED:
                suggestions.push('Coba voucher: NEWUSER');
                suggestions.push('Ketik /help voucher untuk info voucher');
                break;

            case ErrorType.AI_SERVICE_ERROR:
                suggestions.push('Tunggu beberapa saat dan coba lagi');
                suggestions.push('Gunakan format yang lebih sederhana');
                suggestions.push('Ketik /help untuk panduan manual');
                break;

            case ErrorType.OCR_PROCESSING_ERROR:
                suggestions.push('Pastikan foto struk jelas dan terang');
                suggestions.push('Coba foto ulang dengan pencahayaan yang baik');
                suggestions.push('Atau input manual: "beli groceries 150rb"');
                break;

            case ErrorType.STT_PROCESSING_ERROR:
                suggestions.push('Bicara lebih jelas dan pelan');
                suggestions.push('Hindari suara bising di latar belakang');
                suggestions.push('Atau ketik manual: "beli kopi 25rb"');
                break;

            default:
                suggestions.push('Coba lagi dalam beberapa saat');
                suggestions.push('Ketik /start untuk memulai ulang');
                suggestions.push('Ketik /help untuk bantuan');
        }

        return suggestions;
    }

    private getRelevantHelpTopic(error: AppError): string | undefined {
        switch (error.type) {
            case ErrorType.VALIDATION_ERROR:
            case ErrorType.INVALID_INPUT_FORMAT:
                if (error.context?.intent === 'expense') return 'pengeluaran';
                if (error.context?.intent === 'income') return 'pemasukan';
                if (error.context?.intent === 'budget') return 'budget';
                return 'main';

            case ErrorType.INSUFFICIENT_BALANCE:
                return 'koin';

            case ErrorType.VOUCHER_INVALID:
            case ErrorType.VOUCHER_ALREADY_USED:
                return 'voucher';

            case ErrorType.CATEGORY_NOT_FOUND:
            case ErrorType.BUDGET_NOT_FOUND:
                return 'budget';

            case ErrorType.OCR_PROCESSING_ERROR:
            case ErrorType.STT_PROCESSING_ERROR:
                return 'koin';

            default:
                return 'main';
        }
    }

    getFallbackResponse(userInput?: string): string {
        // Select a random fallback response
        const randomIndex = Math.floor(Math.random() * this.fallbackResponses.length);
        let response = this.fallbackResponses[randomIndex];

        // Add contextual suggestions based on user input
        if (userInput) {
            const suggestions = this.generateContextualSuggestions(userInput);
            if (suggestions.length > 0) {
                response += `\n\n💡 **Mungkin maksud Anda:**\n${suggestions.slice(0, 3).map(s => `• ${s}`).join('\n')}`;
            }
        }

        return response;
    }

    private generateContextualSuggestions(userInput: string): string[] {
        const input = userInput.toLowerCase();
        const suggestions: string[] = [];

        // Detect potential intent and suggest corrections
        if (input.includes('beli') || input.includes('bayar') || input.includes('byr')) {
            suggestions.push('"beli kopi 25rb" - untuk pengeluaran');
            suggestions.push('"bayar listrik 150000" - untuk tagihan');
        }

        if (input.includes('gaji') || input.includes('bonus') || input.includes('dapat')) {
            suggestions.push('"gaji bulan ini 5 juta" - untuk pemasukan');
            suggestions.push('"dapat bonus 500rb" - untuk bonus');
        }

        if (input.includes('budget') || input.includes('anggaran')) {
            suggestions.push('"budget makanan 1 juta" - untuk mengatur budget');
            suggestions.push('"status budget" - untuk cek budget');
        }

        if (input.includes('laporan') || input.includes('ringkasan')) {
            suggestions.push('"laporan bulan ini" - untuk melihat ringkasan');
            suggestions.push('"ringkasan minggu ini" - untuk laporan mingguan');
        }

        if (input.includes('saldo') || input.includes('koin')) {
            suggestions.push('"saldo koin" - untuk cek saldo');
            suggestions.push('"tambah saldo 50rb" - untuk top up');
        }

        // If no specific suggestions, provide general ones
        if (suggestions.length === 0) {
            suggestions.push('"beli kopi 25rb" - catat pengeluaran');
            suggestions.push('"gaji 5 juta" - catat pemasukan');
            suggestions.push('"laporan bulan ini" - lihat ringkasan');
        }

        return suggestions;
    }

    logError(error: AppError): void {
        const logEntry = {
            timestamp: error.timestamp.toISOString(),
            type: error.type,
            message: error.message,
            userId: error.userId,
            details: error.details,
            context: error.context,
            stack: error.originalError?.stack
        };

        console.error('[ERROR]', JSON.stringify(logEntry, null, 2));

        // In production, you might want to send this to a logging service
        // like Winston, Sentry, or CloudWatch
    }

    isRetryableError(error: AppError): boolean {
        const retryableErrors = [
            ErrorType.NETWORK_ERROR,
            ErrorType.DATABASE_ERROR,
            ErrorType.EXTERNAL_SERVICE_ERROR,
            ErrorType.AI_SERVICE_ERROR
        ];

        return retryableErrors.includes(error.type);
    }

    shouldRefundCoins(error: AppError): boolean {
        const refundableErrors = [
            ErrorType.OCR_PROCESSING_ERROR,
            ErrorType.STT_PROCESSING_ERROR,
            ErrorType.AI_SERVICE_ERROR,
            ErrorType.EXTERNAL_SERVICE_ERROR,
            ErrorType.DATABASE_ERROR
        ];

        return refundableErrors.includes(error.type);
    }
}
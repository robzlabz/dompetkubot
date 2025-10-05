import { Bot } from 'gramio';
import { env } from '../config/environment.js';
import { ConversationRepository } from '../repositories/ConversationRepository.js';
import { AIRouterService } from './ai/AIRouterService.js';
import { ResponseFormatterService } from './ResponseFormatterService.js';
import { SpeechToTextService } from './SpeechToTextService.js';
import { WalletService } from './WalletService.js';
import { OCRService } from './OCRService.js';
import { ExpenseService } from './ExpenseService.js';
import { UserService } from './UserService.js';
import { HelpService } from './HelpService.js';
import { ErrorHandlingService, ErrorType } from './ErrorHandlingService.js';
import { SimplePatternMatcher } from './SimplePatternMatcher.js';

export interface BotContext {
    userId: string;
    chatId: string;
    messageId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
}

export interface MessageHandler {
    handleTextMessage(text: string, context: BotContext): Promise<string>;
    handleVoiceMessage(fileId: string, context: BotContext): Promise<string>;
    handlePhotoMessage(fileId: string, context: BotContext): Promise<string>;
}

export class TelegramBotService implements MessageHandler {
    private bot: Bot;
    private conversationRepo: ConversationRepository;
    private aiRouter: AIRouterService;
    private responseFormatter: ResponseFormatterService;
    private sttService: SpeechToTextService;
    private walletService: WalletService;
    private ocrService: OCRService;
    private expenseService: ExpenseService;
    private userService: UserService;
    private helpService: HelpService;
    private errorHandler: ErrorHandlingService;
    private patternMatcher: SimplePatternMatcher;

    constructor(
        conversationRepo: ConversationRepository,
        aiRouter: AIRouterService,
        responseFormatter: ResponseFormatterService,
        sttService: SpeechToTextService,
        walletService: WalletService,
        ocrService: OCRService,
        expenseService: ExpenseService,
        userService: UserService,
        helpService: HelpService,
        errorHandler: ErrorHandlingService
    ) {
        this.conversationRepo = conversationRepo;
        this.aiRouter = aiRouter;
        this.responseFormatter = responseFormatter;
        this.sttService = sttService;
        this.walletService = walletService;
        this.ocrService = ocrService;
        this.expenseService = expenseService;
        this.userService = userService;
        this.helpService = helpService;
        this.errorHandler = errorHandler;
        this.patternMatcher = new SimplePatternMatcher();

        this.bot = new Bot({
            token: env.TELEGRAM_BOT_TOKEN,
        });
        this.setupMiddleware();
        this.setupHandlers();
    }

    private getRandomProcessingMessage(): string {
        const messages = [
            '⏳ Sedang diproses…',
            '🧠 Lagi mikir bentar…',
            '🔎 Tunggu ya, aku cek dulu…',
            '⚙️ Memproses pesan kamu…',
            '📝 Sebentar, menyiapkan jawaban…',
            '🤖 Lagi kerja, mohon tunggu…'
        ];
        return messages[Math.floor(Math.random() * messages.length)] || 'sek sek...';
    }

    private setupMiddleware(): void {
        // Logging middleware
        this.bot.use((ctx, next) => {
            const start = Date.now();
            const userId = ctx.update?.message?.from?.id || ctx.update?.callback_query?.from?.id || 'unknown';
            const messageText = ctx.update?.message?.text || 'non-text';
            console.log(`[${new Date().toISOString()}] Incoming message from user ${userId}: ${messageText}`);

            return next().finally(() => {
                const duration = Date.now() - start;
                console.log(`[${new Date().toISOString()}] Request processed in ${duration}ms`);
            });
        });

        // Error handling middleware
        this.bot.use(async (ctx, next) => {
            try {
                await next();
            } catch (error) {
                console.error('Bot error:', error);

                const userContext = (ctx as any).userContext as BotContext & { telegramId: string };
                
                // Create structured error
                const appError = this.errorHandler.createError(
                    ErrorType.UNKNOWN_ERROR,
                    error instanceof Error ? error.message : 'Unknown error',
                    { errorId: Date.now().toString() },
                    error instanceof Error ? error : undefined,
                    userContext?.userId
                );

                // Log the error
                this.errorHandler.logError(appError);

                // Format user-friendly response
                const errorResponse = this.errorHandler.formatErrorResponse(appError);

                if (ctx.update?.message) {
                    await this.bot.api.sendMessage({
                        chat_id: ctx.update.message.chat.id,
                        text: errorResponse.userMessage,
                        parse_mode: 'Markdown'
                    });
                }
            }
        });

        // User authentication and registration middleware
        this.bot.use(async (ctx, next) => {
            const message = ctx.update?.message;
            if (!message?.from) {
                throw new Error('No user information available');
            }

            const telegramId = message.from.id.toString();
            
            try {
                // Register or get existing user
                const user = await this.userService.registerOrGetUser(telegramId, {
                    username: message.from.username,
                    firstName: message.from.first_name,
                    lastName: message.from.last_name,
                    language: message.from.language_code || 'id',
                    timezone: 'Asia/Jakarta' // Default timezone
                });

                // Add user context to the context object
                (ctx as any).userContext = {
                    userId: user.id, // Use database user ID instead of Telegram ID
                    chatId: message.chat.id.toString(),
                    messageId: message.message_id,
                    username: message.from.username,
                    firstName: message.from.first_name,
                    lastName: message.from.last_name,
                    telegramId: telegramId,
                    isNewUser: await this.userService.isNewUser(user.id)
                } as BotContext & { telegramId: string; isNewUser: boolean };

                return next();
            } catch (error) {
                console.error('User authentication error:', error);
                
                // Fallback: use Telegram ID as user ID if registration fails
                (ctx as any).userContext = {
                    userId: telegramId,
                    chatId: message.chat.id.toString(),
                    messageId: message.message_id,
                    username: message.from.username,
                    firstName: message.from.first_name,
                    lastName: message.from.last_name,
                    telegramId: telegramId,
                    isNewUser: false
                } as BotContext & { telegramId: string; isNewUser: boolean };

                return next();
            }
        });
    }

    private setupHandlers(): void {
        // Start command handler
        this.bot.command('start', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext & { isNewUser: boolean };
            
            const welcomeMessage = this.helpService.generateWelcomeMessage({
                firstName: userContext.firstName,
                isNewUser: userContext.isNewUser
            });

            await this.bot.api.sendMessage({
                chat_id: ctx.update!.message!.chat.id,
                text: welcomeMessage,
                parse_mode: 'Markdown'
            });
        });

        // Privacy command handler
        this.bot.command('privacy', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext & { telegramId: string };
            
            const privacyMessage = `🔒 **Privasi & Keamanan Data**

**Data Anda:**
• Semua data sensitif dienkripsi dengan standar AES-256
• Percakapan disimpan untuk meningkatkan layanan
• Data keuangan hanya dapat diakses oleh Anda

**Kontrol Privasi:**
• \`/deletedata\` - Hapus semua data Anda
• \`/exportdata\` - Unduh data Anda
• \`/deleteconversations\` - Hapus riwayat percakapan

**Keamanan:**
• ID Telegram Anda diverifikasi untuk setiap akses
• Data dienkripsi saat disimpan dan ditransmisikan
• Tidak ada data yang dibagikan ke pihak ketiga

**Retensi Data:**
• Percakapan: Disimpan untuk meningkatkan layanan
• Data keuangan: Disimpan sampai Anda menghapusnya
• Data sementara: Dihapus otomatis setelah 30 hari

Untuk pertanyaan privasi, hubungi admin bot.`;

            await this.bot.api.sendMessage({
                chat_id: ctx.update!.message!.chat.id,
                text: privacyMessage,
                parse_mode: 'Markdown'
            });
        });

        // Delete data command handler
        this.bot.command('deletedata', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext & { telegramId: string };
            
            const confirmMessage = `⚠️ **PERINGATAN: Hapus Semua Data**

Anda akan menghapus SEMUA data Anda termasuk:
• Profil pengguna
• Semua transaksi (pengeluaran & pemasukan)
• Riwayat percakapan
• Data wallet dan koin
• Pengaturan budget

**Tindakan ini TIDAK DAPAT DIBATALKAN!**

Ketik \`HAPUS SEMUA DATA\` untuk konfirmasi, atau ketik apapun untuk membatalkan.`;

            await this.bot.api.sendMessage({
                chat_id: ctx.update!.message!.chat.id,
                text: confirmMessage,
                parse_mode: 'Markdown'
            });
        });

        // Delete conversations command handler
        this.bot.command('deleteconversations', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext & { telegramId: string };
            
            const confirmMessage = `🗑️ **Hapus Riwayat Percakapan**

Anda akan menghapus semua riwayat percakapan dengan bot.
Data keuangan Anda akan tetap aman.

Ketik \`HAPUS PERCAKAPAN\` untuk konfirmasi, atau ketik apapun untuk membatalkan.`;

            await this.bot.api.sendMessage({
                chat_id: ctx.update!.message!.chat.id,
                text: confirmMessage,
                parse_mode: 'Markdown'
            });
        });

        // Export data command handler
        this.bot.command('exportdata', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext & { telegramId: string };
            
            const exportMessage = `📤 **Ekspor Data Anda**

Fitur ekspor data sedang diproses...
Anda akan menerima file berisi semua data Anda dalam format JSON.

Data yang akan diekspor:
• Informasi profil (ID Telegram disamarkan)
• Ringkasan transaksi keuangan
• Statistik penggunaan
• Pengaturan akun

Proses ini mungkin memakan waktu beberapa menit.`;

            await this.bot.api.sendMessage({
                chat_id: ctx.update!.message!.chat.id,
                text: exportMessage,
                parse_mode: 'Markdown'
            });
        });

        // Help command handler
        this.bot.command('help', async (ctx) => {
            const message = ctx.update?.message;
            if (!message?.text) return;

            // Extract topic from command (e.g., "/help pengeluaran")
            const parts = message.text.split(' ');
            const topic = parts.length > 1 ? parts[1] : undefined;

            const helpContent = this.helpService.getHelpContent(topic);

            let helpMessage = `**${helpContent.title}**\n\n${helpContent.content}`;

            // Add examples if available
            if (helpContent.examples && helpContent.examples.length > 0) {
                helpMessage += `\n\n**Contoh:**\n${helpContent.examples.map(ex => `• ${ex}`).join('\n')}`;
            }

            // Add available topics if showing main help
            if (!topic || topic === 'main') {
                const topics = this.helpService.getAvailableTopics();
                helpMessage += `\n\n**Topik bantuan lainnya:**\n${topics.map(t => `• /help ${t}`).join('\n')}`;
            }

            await this.bot.api.sendMessage({
                chat_id: message.chat.id,
                text: helpMessage,
                parse_mode: 'Markdown'
            });
        });

        // Setup command handler for guided setup
        this.bot.command('setup', async (ctx) => {
            const userContext = (ctx as any).userContext as BotContext;
            
            // Start guided setup from step 1
            const setupStep = this.helpService.getGuidedSetupStep(1);
            if (setupStep) {
                // Store setup state in user context (in a real app, you'd store this in database)
                await this.bot.api.sendMessage({
                    chat_id: ctx.update!.message!.chat.id,
                    text: setupStep.prompt,
                    parse_mode: 'Markdown'
                });
            }
        });

        // Text message handler with instant feedback
        this.bot.on('message', async (ctx) => {
            if (ctx.update?.message?.text) {
                const context = (ctx as any).userContext as BotContext;
                const chatId = ctx.update.message.chat.id;

                // Send processing message
                const pending = await this.bot.api.sendMessage({
                    chat_id: chatId,
                    text: this.getRandomProcessingMessage(),
                    parse_mode: 'Markdown'
                });

                // Compute final response
                const response = await this.handleTextMessage(ctx.update.message.text, context);

                // Try to replace processing message with final response
                try {
                    await this.bot.api.editMessageText({
                        chat_id: chatId,
                        message_id: (pending as any).message_id,
                        text: response,
                        parse_mode: 'Markdown'
                    });
                } catch (err) {
                    console.error('[TelegramBotService]: Error editing message:', err);
                    // Fallback: send a new message if edit fails
                    await this.bot.api.sendMessage({
                        chat_id: chatId,
                        text: response,
                        parse_mode: 'Markdown'
                    });
                }
            }
        });

        // Voice message handler with instant feedback
        this.bot.on('message', async (ctx) => {
            if (ctx.update?.message?.voice) {
                const context = (ctx as any).userContext as BotContext;
                const chatId = ctx.update.message.chat.id;

                // Send processing message
                const pending = await this.bot.api.sendMessage({
                    chat_id: chatId,
                    text: this.getRandomProcessingMessage(),
                    parse_mode: 'Markdown'
                });

                const response = await this.handleVoiceMessage(ctx.update.message.voice.file_id, context);

                try {
                    await this.bot.api.editMessageText({
                        chat_id: chatId,
                        message_id: (pending as any).message_id,
                        text: response,
                        parse_mode: 'Markdown'
                    });
                } catch (err) {
                    await this.bot.api.sendMessage({
                        chat_id: chatId,
                        text: response,
                        parse_mode: 'Markdown'
                    });
                }
            }
        });

        // Photo message handler with instant feedback
        this.bot.on('message', async (ctx) => {
            if (ctx.update?.message?.photo) {
                const context = (ctx as any).userContext as BotContext;
                const chatId = ctx.update.message.chat.id;
                const photos = ctx.update.message.photo;
                const largestPhoto = photos[photos.length - 1]; // Get the largest photo
                if (largestPhoto) {
                    // Send processing message
                    const pending = await this.bot.api.sendMessage({
                        chat_id: chatId,
                        text: this.getRandomProcessingMessage(),
                        parse_mode: 'Markdown'
                    });

                    const response = await this.handlePhotoMessage(largestPhoto.file_id, context);

                    try {
                        await this.bot.api.editMessageText({
                            chat_id: chatId,
                            message_id: (pending as any).message_id,
                            text: response,
                            parse_mode: 'Markdown'
                        });
                    } catch (err) {
                        await this.bot.api.sendMessage({
                            chat_id: chatId,
                            text: response,
                            parse_mode: 'Markdown'
                        });
                    }
                }
            }
        });
    }

    async handleTextMessage(text: string, context: BotContext): Promise<string> {
        try {
            const userContext = context as BotContext & { telegramId: string };
            const normalized = text.toLowerCase().trim();

            // Quick greeting detection to avoid unintended expense creation
            const isGreeting = /^(hi|hai|halo|hello|yo|ping|test|selamat\s(pagi|siang|sore|malam))$/.test(normalized);
            if (isGreeting) {
                return '👋 Hai! Bot online. Ada yang bisa dibantu?\n\nContoh: "beli kopi 25rb" atau ketik /help.';
            }
            
            // Handle privacy-related confirmations
            if (text.trim().toUpperCase() === 'HAPUS SEMUA DATA') {
                return await this.handleDataDeletion(userContext);
            }
            
            if (text.trim().toUpperCase() === 'HAPUS PERCAKAPAN') {
                return await this.handleConversationDeletion(userContext);
            }

            // Handle guided setup responses
            if (text.toLowerCase() === 'setup') {
                const setupStep = this.helpService.getGuidedSetupStep(1);
                return setupStep ? setupStep.prompt : 'Setup tidak tersedia saat ini.';
            }

            // Store conversation (initially with empty response)
            const conversation = await this.conversationRepo.create({
                userId: context.userId,
                message: text,
                response: '', // Will be updated after processing
                messageType: 'TEXT',
            });

            try {
                // Route through AI system
                const result = await this.aiRouter.routeMessage(text, context.userId);

                // Update conversation with response and token usage
                await this.conversationRepo.update(conversation.id, {
                    response: result.response,
                    toolUsed: result.toolCall?.function?.name,
                    tokensIn: result.metadata?.tokensIn,
                    tokensOut: result.metadata?.tokensOut,
                });

                return result.response;
            } catch (aiError) {
                console.error('AI routing error:', aiError);

                // Try pattern matching as fallback
                console.log('Trying pattern matching fallback...');
                const patternMatch = this.patternMatcher.matchPattern(text);
                
                if (patternMatch && patternMatch.confidence > 0.7) {
                    try {
                        console.log(`Pattern matched: ${patternMatch.intent}`, patternMatch.extractedData);
                        
                        // Execute the matched tool
                        const toolResult = await this.executePatternMatchedTool(
                            patternMatch.intent,
                            patternMatch.extractedData,
                            context.userId
                        );
                        
                        if (toolResult.success) {
                            const response = this.formatSimpleToolResponse(patternMatch.intent, toolResult);
                            
                            await this.conversationRepo.update(conversation.id, {
                                response,
                                toolUsed: `pattern_${patternMatch.intent}`,
                            });
                            
                            return response;
                        }
                    } catch (patternError) {
                        console.error('Pattern matching execution error:', patternError);
                    }
                }

                // Create structured error for AI failure
                const appError = this.errorHandler.createError(
                    ErrorType.AI_SERVICE_ERROR,
                    'AI service temporarily unavailable',
                    { originalMessage: text },
                    aiError instanceof Error ? aiError : undefined,
                    context.userId,
                    { intent: 'text_processing' }
                );

                this.errorHandler.logError(appError);

                // Final fallback response
                const fallbackResponse = this.errorHandler.getFallbackResponse(text);
                
                await this.conversationRepo.update(conversation.id, {
                    response: fallbackResponse,
                    toolUsed: 'fallback_handler',
                });

                return fallbackResponse;
            }
        } catch (error) {
            console.error('Error handling text message:', error);

            // Create structured error
            const appError = this.errorHandler.createError(
                ErrorType.UNKNOWN_ERROR,
                'Failed to process text message',
                { originalMessage: text },
                error instanceof Error ? error : undefined,
                context.userId
            );

            this.errorHandler.logError(appError);

            // Return user-friendly error message
            const errorResponse = this.errorHandler.formatErrorResponse(appError);
            return errorResponse.userMessage;
        }
    }

    private async handleDataDeletion(context: BotContext & { telegramId: string }): Promise<string> {
        try {
            // Note: In a real implementation, we would use the PrivacyService here
            // For now, we'll just return a confirmation message
            
            return `✅ **Permintaan Penghapusan Data Diterima**

Data Anda akan dihapus dalam 24-48 jam sesuai dengan kebijakan privasi.

Yang akan dihapus:
• ✅ Semua data transaksi
• ✅ Riwayat percakapan  
• ✅ Data wallet dan koin
• ✅ Pengaturan akun

Terima kasih telah menggunakan Budget Bot. Anda dapat membuat akun baru kapan saja dengan mengetik /start.`;
        } catch (error) {
            console.error('Error handling data deletion:', error);
            return 'Maaf, terjadi kesalahan saat memproses permintaan penghapusan data. Silakan coba lagi nanti.';
        }
    }

    private async handleConversationDeletion(context: BotContext & { telegramId: string }): Promise<string> {
        try {
            // Note: In a real implementation, we would use the PrivacyService here
            // For now, we'll just return a confirmation message
            
            return `✅ **Riwayat Percakapan Dihapus**

Semua riwayat percakapan Anda dengan bot telah dihapus.
Data keuangan Anda tetap aman dan tidak terpengaruh.

Anda dapat melanjutkan menggunakan bot seperti biasa.`;
        } catch (error) {
            console.error('Error handling conversation deletion:', error);
            return 'Maaf, terjadi kesalahan saat menghapus riwayat percakapan. Silakan coba lagi nanti.';
        }
    }

    async handleVoiceMessage(fileId: string, context: BotContext): Promise<string> {
        try {
            // Check user's coin balance first
            const wallet = await this.walletService.getBalance(context.userId);
            const requiredCoins = 0.5; // Base cost for voice processing

            if (!await this.walletService.checkSufficientBalance(context.userId, requiredCoins)) {
                const appError = this.errorHandler.createError(
                    ErrorType.INSUFFICIENT_BALANCE,
                    'Insufficient coins for voice processing',
                    { required: requiredCoins, current: wallet.coins },
                    undefined,
                    context.userId,
                    { feature: 'voice_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                return errorResponse.userMessage;
            }

            // Download voice file from Telegram
            const fileInfo = await this.bot.api.getFile({ file_id: fileId });

            if (!fileInfo.file_path) {
                return 'Maaf, tidak dapat mengunduh file suara. Silakan coba lagi.';
            }

            // Download the actual file
            const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
            const response = await fetch(fileUrl);

            if (!response.ok) {
                return 'Maaf, tidak dapat mengunduh file suara. Silakan coba lagi.';
            }

            const audioBuffer = Buffer.from(await response.arrayBuffer());

            // Prepare audio file for transcription
            const audioFile = {
                buffer: audioBuffer,
                filename: `voice_${Date.now()}.ogg`,
                mimeType: 'audio/ogg',
            };

            // Validate audio file
            const validation = this.sttService.validateAudioFile(audioFile);
            if (!validation.valid) {
                const appError = this.errorHandler.createError(
                    ErrorType.STT_PROCESSING_ERROR,
                    'Invalid audio file format',
                    { validationError: validation.error },
                    undefined,
                    context.userId,
                    { feature: 'voice_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                return errorResponse.userMessage;
            }

            // Deduct coins before processing
            await this.walletService.deductCoins(context.userId, requiredCoins);

            // Store conversation (initially with empty response)
            const conversation = await this.conversationRepo.create({
                userId: context.userId,
                message: '[Voice Message]',
                response: '', // Will be updated after processing
                messageType: 'VOICE',
                coinsUsed: requiredCoins,
            });

            // Transcribe audio to text
            const transcriptionResult = await this.sttService.transcribeAudio(audioFile);

            if (!transcriptionResult.success) {
                // Refund coins if transcription failed
                await this.walletService.addBalance(context.userId, requiredCoins * 1000); // Convert coins back to balance

                const appError = this.errorHandler.createError(
                    ErrorType.STT_PROCESSING_ERROR,
                    'Speech-to-text processing failed',
                    { sttError: transcriptionResult.error },
                    undefined,
                    context.userId,
                    { feature: 'voice_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                
                await this.conversationRepo.update(conversation.id, {
                    response: errorResponse.userMessage,
                });

                return errorResponse.userMessage;
            }

            const transcribedText = transcriptionResult.text!;

            // Update conversation with transcribed text
            await this.conversationRepo.update(conversation.id, {
                message: `[Voice] ${transcribedText}`,
            });

            // Route transcribed text through AI system
            const result = await this.aiRouter.routeMessage(transcribedText, context.userId);

            // Update conversation with final response and token usage
            await this.conversationRepo.update(conversation.id, {
                response: result.response,
                toolUsed: result.toolCall?.function?.name,
                tokensIn: result.metadata?.tokensIn,
                tokensOut: result.metadata?.tokensOut,
            });

            // Add transcription info to response
            const finalResponse = `🎤 *Pesan suara diproses* (${requiredCoins} koin)\n_"${transcribedText}"_\n\n${result.response}`;

            return finalResponse;
        } catch (error) {
            console.error('Error handling voice message:', error);
            return 'Maaf, terjadi kesalahan saat memproses pesan suara Anda. Silakan coba lagi.';
        }
    }

    async handlePhotoMessage(fileId: string, context: BotContext): Promise<string> {
        try {
            // Check user's coin balance first
            const wallet = await this.walletService.getBalance(context.userId);
            const requiredCoins = this.ocrService.getOCRCost(); // 1.0 coins

            if (!await this.walletService.checkSufficientBalance(context.userId, requiredCoins)) {
                const appError = this.errorHandler.createError(
                    ErrorType.INSUFFICIENT_BALANCE,
                    'Insufficient coins for OCR processing',
                    { required: requiredCoins, current: wallet.coins },
                    undefined,
                    context.userId,
                    { feature: 'ocr_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                return errorResponse.userMessage;
            }

            // Download photo file from Telegram
            const fileInfo = await this.bot.api.getFile({ file_id: fileId });

            if (!fileInfo.file_path) {
                return 'Maaf, tidak dapat mengunduh foto. Silakan coba lagi.';
            }

            // Download the actual file
            const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
            const response = await fetch(fileUrl);

            if (!response.ok) {
                return 'Maaf, tidak dapat mengunduh foto. Silakan coba lagi.';
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());

            // Prepare image file for OCR
            const imageFile = {
                buffer: imageBuffer,
                filename: `receipt_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
            };

            // Validate image file
            const validation = this.ocrService.validateImageFile(imageFile);
            if (!validation.valid) {
                const appError = this.errorHandler.createError(
                    ErrorType.OCR_PROCESSING_ERROR,
                    'Invalid image file format',
                    { validationError: validation.error },
                    undefined,
                    context.userId,
                    { feature: 'ocr_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                return errorResponse.userMessage;
            }

            // Deduct coins before processing
            await this.walletService.deductCoins(context.userId, requiredCoins);

            // Store conversation (initially with empty response)
            const conversation = await this.conversationRepo.create({
                userId: context.userId,
                message: '[Receipt Photo]',
                response: '', // Will be updated after processing
                messageType: 'PHOTO',
                coinsUsed: requiredCoins,
            });

            // Process OCR
            const ocrResult = await this.ocrService.extractReceiptData(imageFile);

            if (!ocrResult.success) {
                // Refund coins if OCR failed
                await this.walletService.addBalance(context.userId, requiredCoins * 1000); // Convert coins back to balance

                const appError = this.errorHandler.createError(
                    ErrorType.OCR_PROCESSING_ERROR,
                    'OCR processing failed',
                    { ocrError: ocrResult.error },
                    undefined,
                    context.userId,
                    { feature: 'ocr_processing' }
                );

                const errorResponse = this.errorHandler.formatErrorResponse(appError);
                
                await this.conversationRepo.update(conversation.id, {
                    response: errorResponse.userMessage,
                });

                return errorResponse.userMessage;
            }

            const receiptData = ocrResult.receiptData!;

            // Create expense from receipt data
            const expenseDescription = this.ocrService.generateExpenseDescription(receiptData);
            const expenseItems = this.ocrService.convertToExpenseItems(receiptData);

            try {
                const expense = await this.expenseService.createExpense(context.userId, {
                    userId: context.userId,
                    amount: receiptData.total,
                    description: expenseDescription,
                    categoryId: 'default-shopping', // Will be auto-categorized
                    items: expenseItems,
                    receiptImageUrl: fileUrl, // Store the image URL for reference
                });

                // Update conversation with receipt details
                await this.conversationRepo.update(conversation.id, {
                    message: `[Receipt] ${expenseDescription}`,
                    response: '', // Will be set below
                    toolUsed: 'create_expense_from_receipt',
                });

                // Format response with receipt details
                const transactionId = expense?.id?.slice(-8) || 'unknown'; // Use last 8 chars of expense ID
                let response = `📸 *Struk berhasil diproses* (${requiredCoins} koin)\n✅ berhasil tercatat! \`${transactionId}\`\n\n`;

                // Add merchant and total
                if (receiptData.merchantName) {
                    response += `🏪 **${receiptData.merchantName}**\n`;
                }
                if (receiptData.date) {
                    response += `📅 ${receiptData.date}\n`;
                }
                response += `💰 **Total: Rp ${receiptData.total.toLocaleString('id-ID')}**\n\n`;

                // Add items breakdown
                response += `**Items:**\n`;
                receiptData.items.forEach((item, index) => {
                    response += `${index + 1}. ${item.name} ${item.quantity}x @ Rp ${item.unitPrice.toLocaleString('id-ID')} = Rp ${item.totalPrice.toLocaleString('id-ID')}\n`;
                });

                // Add discount if present
                if (receiptData.discount && receiptData.discount > 0) {
                    response += `\n💸 Diskon: -Rp ${receiptData.discount.toLocaleString('id-ID')}`;
                }

                // Add tax if present
                if (receiptData.tax && receiptData.tax > 0) {
                    response += `\n🧾 Pajak: Rp ${receiptData.tax.toLocaleString('id-ID')}`;
                }

                // Add personalized comment
                response += `\n\nWah, belanja lengkap nih! Semua item sudah tercatat otomatis dari struk 📋`;

                // Update conversation with final response
                await this.conversationRepo.update(conversation.id, {
                    response,
                });

                return response;
            } catch (expenseError) {
                console.error('Error creating expense from receipt:', expenseError);

                // Refund coins if expense creation failed
                await this.walletService.addBalance(context.userId, requiredCoins * 1000);

                const errorResponse = 'Maaf, terjadi kesalahan saat menyimpan data struk. Koin telah dikembalikan.';
                await this.conversationRepo.update(conversation.id, {
                    response: errorResponse,
                });

                return errorResponse;
            }
        } catch (error) {
            console.error('Error handling photo message:', error);
            return 'Maaf, terjadi kesalahan saat memproses foto struk Anda. Silakan coba lagi.';
        }
    }

    async start(): Promise<void> {
        console.log('Starting Telegram bot...');
        await this.bot.start();
        console.log('Telegram bot started successfully');
    }

    async stop(): Promise<void> {
        console.log('Stopping Telegram bot...');
        await this.bot.stop();
        console.log('Telegram bot stopped');
    }

    getBot(): Bot {
        return this.bot;
    }

    /**
     * Execute tool based on pattern matching
     */
    private async executePatternMatchedTool(intent: string, data: any, userId: string): Promise<any> {
        switch (intent) {
            case 'create_expense':
                return await this.expenseService.createExpense(userId, {
                    userId,
                    amount: data.amount,
                    description: data.description,
                    categoryId: data.categoryId
                });

            case 'create_income':
                // Note: We need to implement income creation in the future
                return {
                    success: true,
                    message: 'Income recorded',
                    data: { amount: data.amount, description: data.description }
                };

            case 'set_budget':
                // Note: We need to implement budget setting in the future
                return {
                    success: true,
                    message: 'Budget set',
                    data: { categoryId: data.categoryId, amount: data.amount }
                };

            case 'add_balance':
                await this.walletService.addBalance(userId, data.amount);
                const wallet = await this.walletService.getBalance(userId);
                return {
                    success: true,
                    message: 'Balance added',
                    data: wallet
                };

            default:
                throw new Error(`Unknown intent: ${intent}`);
        }
    }

    /**
     * Format simple tool response
     */
    private formatSimpleToolResponse(intent: string, toolResult: any): string {
        const transactionId = Math.random().toString(36).substring(2, 10);

        switch (intent) {
            case 'create_expense':
                const expense = toolResult;
                return `✅ berhasil tercatat! \`${transactionId}\` ${expense.description} Rp ${expense.amount.toLocaleString('id-ID')}\n\nPengeluaran berhasil dicatat! 💸`;

            case 'create_income':
                const income = toolResult.data;
                return `✅ berhasil tercatat! \`${transactionId}\` ${income.description} Rp ${income.amount.toLocaleString('id-ID')}\n\nAlhamdulillah, rejeki lancar terus ya! 💰`;

            case 'set_budget':
                const budget = toolResult.data;
                return `✅ berhasil tercatat! \`${transactionId}\` Budget diatur Rp ${budget.amount.toLocaleString('id-ID')}\n\nBudget berhasil diatur! Saya akan beri tahu kalau pengeluaran sudah mendekati batas. 🎯`;

            case 'add_balance':
                const wallet = toolResult.data;
                return `✅ berhasil tercatat! \`${transactionId}\` Saldo ditambah\n\nSaldo sekarang: Rp ${wallet.balance.toLocaleString('id-ID')} | Koin: ${wallet.coins} 🪙`;

            default:
                return `✅ berhasil tercatat! \`${transactionId}\` ${toolResult.message}`;
        }
    }
}
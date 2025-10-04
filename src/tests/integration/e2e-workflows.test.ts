import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { TelegramBotService, BotContext } from '../../services/TelegramBotService.js';
import { ConversationRepository } from '../../repositories/ConversationRepository.js';
import { AIRouterService } from '../../services/ai/AIRouterService.js';
import { ResponseFormatterService } from '../../services/ResponseFormatterService.js';
import { OpenAIService } from '../../services/OpenAIService.js';
import { ToolRegistry } from '../../services/ai/ToolRegistry.js';
import { SpeechToTextService } from '../../services/SpeechToTextService.js';
import { OCRService } from '../../services/OCRService.js';
import { WalletService } from '../../services/WalletService.js';
import { ExpenseService } from '../../services/ExpenseService.js';
import { CalculationService } from '../../services/CalculationService.js';
import { WalletRepository } from '../../repositories/WalletRepository.js';
import { ExpenseRepository } from '../../repositories/ExpenseRepository.js';
import { IncomeRepository } from '../../repositories/IncomeRepository.js';
import { CategoryRepository } from '../../repositories/CategoryRepository.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import { UserService } from '../../services/UserService.js';
import { CategoryService } from '../../services/CategoryService.js';
import { EncryptionService } from '../../services/EncryptionService.js';
import { PrivacyService } from '../../services/PrivacyService.js';
import { HelpService } from '../../services/HelpService.js';
import { ErrorHandlingService } from '../../services/ErrorHandlingService.js';

// Mock external services
const mockOpenAIService = {
  generateResponse: async (message: string, context: any, tools: any[]) => {
    // Mock AI responses based on message content
    if (message.includes('beli kopi') || message.includes('bayar')) {
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'create_expense',
            arguments: JSON.stringify({
              amount: 25000,
              description: 'beli kopi',
              categoryId: 'makanan-minuman'
            })
          }
        }]
      };
    }
    
    if (message.includes('gaji') || message.includes('bonus')) {
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'create_income',
            arguments: JSON.stringify({
              amount: 5000000,
              description: 'gaji bulanan',
              categoryId: 'gaji'
            })
          }
        }]
      };
    }
    
    if (message.includes('budget')) {
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'set_budget',
            arguments: JSON.stringify({
              categoryId: 'makanan-minuman',
              amount: 1000000,
              period: 'MONTHLY'
            })
          }
        }]
      };
    }
    
    if (message.includes('tambah saldo')) {
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'add_balance',
            arguments: JSON.stringify({
              amount: 50000
            })
          }
        }]
      };
    }
    
    return { content: 'Saya tidak mengerti permintaan Anda.' };
  },
  
  generatePersonalizedComment: async (type: string, description: string, amount: number, context: any) => {
    const comments = {
      expense: 'Pengeluaran berhasil dicatat!',
      income: 'Pemasukan berhasil dicatat!'
    };
    return comments[type as keyof typeof comments] || 'Berhasil dicatat!';
  },
  
  getConversationContext: async (userId: string) => ({
    userId,
    recentMessages: [],
    userPreferences: {}
  })
};

const mockSTTService = {
  transcribeAudio: async (audioFile: any) => ({
    success: true,
    text: 'beli kopi dua puluh lima ribu',
    confidence: 0.95
  }),
  
  validateAudioFile: (audioFile: any) => ({
    valid: true,
    error: null
  })
};

const mockOCRService = {
  extractReceiptData: async (imageFile: any) => ({
    success: true,
    receiptData: {
      items: [
        { name: 'Kopi Americano', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
        { name: 'Croissant', quantity: 1, unitPrice: 15000, totalPrice: 15000 }
      ],
      total: 40000,
      discount: 0,
      tax: 0,
      merchantName: 'Coffee Shop',
      date: new Date()
    }
  }),
  
  validateImageFile: (imageFile: any) => ({
    valid: true,
    error: null
  }),
  
  getOCRCost: () => 1.0,
  
  generateExpenseDescription: (receiptData: any) => 
    `Belanja di ${receiptData.merchantName}`,
    
  convertToExpenseItems: (receiptData: any) => receiptData.items
};

describe('End-to-End Workflow Integration Tests', () => {
  let prisma: PrismaClient;
  let botService: TelegramBotService;
  let testUserId: string;
  let testContext: BotContext;

  beforeAll(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/telegram_budget_bot_test'
        }
      }
    });

    await prisma.$connect();

    // Initialize repositories
    const conversationRepo = new ConversationRepository(prisma);
    const walletRepo = new WalletRepository(prisma);
    const expenseRepo = new ExpenseRepository(prisma);
    const incomeRepo = new IncomeRepository(prisma);
    const categoryRepo = new CategoryRepository(prisma);
    const userRepo = new UserRepository(prisma);

    // Initialize services with mocked external dependencies
    const toolRegistry = new ToolRegistry();
    const aiRouter = new AIRouterService(mockOpenAIService as any, toolRegistry, conversationRepo);
    const responseFormatter = new ResponseFormatterService(mockOpenAIService as any);
    const calculationService = new CalculationService();
    const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
    const expenseService = new ExpenseService(expenseRepo, categoryRepo, calculationService);
    const encryptionService = new EncryptionService();
    const categoryService = new CategoryService(categoryRepo, mockOpenAIService as any);
    const userService = new UserService(userRepo, walletRepo, categoryService);
    const privacyService = new PrivacyService(userRepo, expenseRepo, incomeRepo, conversationRepo, walletRepo, encryptionService);
    const helpService = new HelpService();
    const errorHandler = new ErrorHandlingService();

    // Initialize bot service with mocked external services
    botService = new TelegramBotService(
      conversationRepo,
      aiRouter,
      responseFormatter,
      mockSTTService as any,
      walletService,
      mockOCRService as any,
      expenseService,
      userService,
      helpService,
      errorHandler
    );

    // Create test user
    const testUser = await userService.registerOrGetUser('123456789', {
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      language: 'id',
      timezone: 'Asia/Jakarta'
    });

    testUserId = testUser.id;
    testContext = {
      userId: testUserId,
      chatId: '123456789',
      messageId: 1,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User'
    };

    // Add initial balance for testing premium features
    await walletService.addBalance(testUserId, 100000); // 100k balance = 100 coins
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.conversation.deleteMany({ where: { userId: testUserId } });
    await prisma.expense.deleteMany({ where: { userId: testUserId } });
    await prisma.income.deleteMany({ where: { userId: testUserId } });
    await prisma.budget.deleteMany({ where: { userId: testUserId } });
    await prisma.wallet.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up conversations before each test
    await prisma.conversation.deleteMany({ where: { userId: testUserId } });
  });

  describe('Text Message Processing Workflow', () => {
    test('should process expense creation from natural language', async () => {
      const response = await botService.handleTextMessage('beli kopi 25 ribu', testContext);
      
      expect(response).toContain('✅ berhasil tercatat!');
      expect(response).toContain('25.000');
      expect(response).toContain('kopi');
      
      // Verify expense was created in database
      const expenses = await prisma.expense.findMany({ where: { userId: testUserId } });
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(25000);
      expect(expenses[0].description).toContain('kopi');
    });

    test('should process income creation from natural language', async () => {
      const response = await botService.handleTextMessage('gaji bulan ini 5 juta', testContext);
      
      expect(response).toContain('✅ berhasil tercatat!');
      expect(response).toContain('5.000.000');
      expect(response).toContain('gaji');
      
      // Verify income was created in database
      const incomes = await prisma.income.findMany({ where: { userId: testUserId } });
      expect(incomes).toHaveLength(1);
      expect(incomes[0].amount).toBe(5000000);
      expect(incomes[0].description).toContain('gaji');
    });

    test('should process budget setting from natural language', async () => {
      const response = await botService.handleTextMessage('budget makanan 1 juta', testContext);
      
      expect(response).toContain('✅ berhasil tercatat!');
      expect(response).toContain('1.000.000');
      expect(response).toContain('Budget');
      
      // Verify budget was created in database
      const budgets = await prisma.budget.findMany({ where: { userId: testUserId } });
      expect(budgets).toHaveLength(1);
      expect(budgets[0].amount).toBe(1000000);
    });

    test('should process balance addition from natural language', async () => {
      const response = await botService.handleTextMessage('tambah saldo 50 ribu', testContext);
      
      expect(response).toContain('✅ berhasil tercatat!');
      expect(response).toContain('50.000');
      expect(response).toContain('Saldo');
      
      // Verify wallet balance was updated
      const wallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      expect(wallet).toBeTruthy();
      expect(wallet!.balance).toBeGreaterThan(100000); // Initial + added
    });

    test('should handle unclear input with helpful suggestions', async () => {
      const response = await botService.handleTextMessage('aku mau beli sesuatu', testContext);
      
      expect(response).toContain('🤔');
      expect(response).toContain('Coba format ini');
      expect(response).toContain('beli kopi 25rb');
    });
  });

  describe('Voice Message Processing Workflow', () => {
    test('should process voice message with coin deduction', async () => {
      const initialWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      const initialCoins = initialWallet?.coins || 0;
      
      const response = await botService.handleVoiceMessage('mock_voice_file_id', testContext);
      
      expect(response).toContain('🎤 *Pesan suara diproses*');
      expect(response).toContain('0.5 koin');
      expect(response).toContain('beli kopi dua puluh lima ribu');
      expect(response).toContain('✅ berhasil tercatat!');
      
      // Verify coin deduction
      const updatedWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      expect(updatedWallet!.coins).toBe(initialCoins - 0.5);
      
      // Verify conversation was stored with voice type
      const conversations = await prisma.conversation.findMany({ 
        where: { userId: testUserId, messageType: 'VOICE' } 
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].coinsUsed).toBe(0.5);
    });

    test('should handle insufficient coins for voice processing', async () => {
      // Reduce user's coins to insufficient amount
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { coins: 0.1 } // Less than required 0.5
      });
      
      const response = await botService.handleVoiceMessage('mock_voice_file_id', testContext);
      
      expect(response).toContain('❌');
      expect(response).toContain('Saldo koin tidak cukup');
      expect(response).toContain('tambah saldo');
    });
  });

  describe('Photo/Receipt Processing Workflow', () => {
    test('should process receipt photo with coin deduction', async () => {
      // Ensure user has enough coins
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { coins: 10 }
      });
      
      const initialWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      const initialCoins = initialWallet?.coins || 0;
      
      const response = await botService.handlePhotoMessage('mock_photo_file_id', testContext);
      
      expect(response).toContain('📸 *Struk berhasil diproses*');
      expect(response).toContain('1 koin');
      expect(response).toContain('Coffee Shop');
      expect(response).toContain('40.000');
      expect(response).toContain('Items:');
      expect(response).toContain('Kopi Americano');
      expect(response).toContain('Croissant');
      
      // Verify coin deduction
      const updatedWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      expect(updatedWallet!.coins).toBe(initialCoins - 1.0);
      
      // Verify expense was created with items
      const expenses = await prisma.expense.findMany({ 
        where: { userId: testUserId },
        include: { items: true }
      });
      const receiptExpense = expenses.find(e => e.description.includes('Coffee Shop'));
      expect(receiptExpense).toBeTruthy();
      expect(receiptExpense!.amount).toBe(40000);
      expect(receiptExpense!.items).toHaveLength(2);
      
      // Verify conversation was stored with photo type
      const conversations = await prisma.conversation.findMany({ 
        where: { userId: testUserId, messageType: 'PHOTO' } 
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0].coinsUsed).toBe(1.0);
    });

    test('should handle insufficient coins for OCR processing', async () => {
      // Reduce user's coins to insufficient amount
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { coins: 0.5 } // Less than required 1.0
      });
      
      const response = await botService.handlePhotoMessage('mock_photo_file_id', testContext);
      
      expect(response).toContain('❌');
      expect(response).toContain('Saldo koin tidak cukup');
      expect(response).toContain('tambah saldo');
    });
  });

  describe('AI Routing and Response Formatting', () => {
    test('should route messages correctly through AI system', async () => {
      const testCases = [
        { input: 'beli nasi gudeg 15rb', expectedTool: 'create_expense' },
        { input: 'dapat freelance 2 juta', expectedTool: 'create_income' },
        { input: 'budget transportasi 500rb', expectedTool: 'set_budget' },
        { input: 'top up saldo 100rb', expectedTool: 'add_balance' }
      ];

      for (const testCase of testCases) {
        const response = await botService.handleTextMessage(testCase.input, testContext);
        
        expect(response).toContain('✅ berhasil tercatat!');
        expect(response).toMatch(/`[a-zA-Z0-9]{8}`/); // nanoid format
        
        // Verify conversation was stored with correct tool
        const conversations = await prisma.conversation.findMany({ 
          where: { 
            userId: testUserId,
            message: testCase.input
          } 
        });
        expect(conversations).toHaveLength(1);
        expect(conversations[0].toolUsed).toBe(testCase.expectedTool);
      }
    });

    test('should format responses with proper Indonesian localization', async () => {
      const response = await botService.handleTextMessage('beli bakso 20000', testContext);
      
      // Check Indonesian number formatting
      expect(response).toContain('20.000');
      
      // Check Indonesian language usage
      expect(response).toContain('berhasil tercatat');
      
      // Check proper currency formatting
      expect(response).toMatch(/Rp\s*20\.000/);
    });

    test('should include calculation expressions in responses', async () => {
      const response = await botService.handleTextMessage('beli ayam 2kg @ 15rb', testContext);
      
      expect(response).toContain('✅ berhasil tercatat!');
      expect(response).toContain('30.000'); // 2 * 15000
      
      // Should show calculation
      expect(response).toMatch(/2.*15.*30\.000/);
    });
  });

  describe('Conversation Context and History', () => {
    test('should store and retrieve conversation history', async () => {
      // Send multiple messages
      await botService.handleTextMessage('beli kopi 25rb', testContext);
      await botService.handleTextMessage('beli roti 10rb', testContext);
      await botService.handleTextMessage('gaji 5 juta', testContext);
      
      // Verify all conversations are stored
      const conversations = await prisma.conversation.findMany({ 
        where: { userId: testUserId },
        orderBy: { createdAt: 'asc' }
      });
      
      expect(conversations).toHaveLength(3);
      expect(conversations[0].message).toContain('kopi');
      expect(conversations[1].message).toContain('roti');
      expect(conversations[2].message).toContain('gaji');
      
      // All should have responses
      conversations.forEach(conv => {
        expect(conv.response).toBeTruthy();
        expect(conv.response).toContain('berhasil tercatat');
      });
    });

    test('should maintain conversation context for better responses', async () => {
      // This test verifies that conversation history is accessible
      // In a real implementation, the AI would use this context for better responses
      
      await botService.handleTextMessage('beli kopi 25rb', testContext);
      
      const conversations = await prisma.conversation.findMany({ 
        where: { userId: testUserId } 
      });
      
      expect(conversations).toHaveLength(1);
      expect(conversations[0].userId).toBe(testUserId);
      expect(conversations[0].messageType).toBe('TEXT');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle AI service failures gracefully', async () => {
      // Mock AI service to throw error
      const originalGenerateResponse = mockOpenAIService.generateResponse;
      mockOpenAIService.generateResponse = async () => {
        throw new Error('AI service unavailable');
      };
      
      const response = await botService.handleTextMessage('beli kopi 25rb', testContext);
      
      expect(response).toContain('🤔');
      expect(response).toContain('Coba format ini');
      expect(response).toContain('beli kopi 25rb');
      
      // Restore original function
      mockOpenAIService.generateResponse = originalGenerateResponse;
    });

    test('should provide helpful fallbacks for unclear input', async () => {
      const unclearInputs = [
        'asdfghjkl',
        'hello world',
        'aku bingung',
        '???'
      ];

      for (const input of unclearInputs) {
        const response = await botService.handleTextMessage(input, testContext);
        
        expect(response).toContain('🤔');
        expect(response).toContain('Coba format ini');
        expect(response).toContain('/help');
      }
    });

    test('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we verify that the system doesn't crash on invalid data
      
      const response = await botService.handleTextMessage('', testContext);
      
      // Should not crash and provide helpful response
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
    });
  });

  describe('Multi-Modal Integration', () => {
    test('should handle mixed input types in sequence', async () => {
      // Ensure user has enough coins
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { coins: 10 }
      });
      
      // Text message
      const textResponse = await botService.handleTextMessage('beli kopi 25rb', testContext);
      expect(textResponse).toContain('✅ berhasil tercatat!');
      
      // Voice message
      const voiceResponse = await botService.handleVoiceMessage('mock_voice_file_id', testContext);
      expect(voiceResponse).toContain('🎤 *Pesan suara diproses*');
      
      // Photo message
      const photoResponse = await botService.handlePhotoMessage('mock_photo_file_id', testContext);
      expect(photoResponse).toContain('📸 *Struk berhasil diproses*');
      
      // Verify all conversations are stored with correct types
      const conversations = await prisma.conversation.findMany({ 
        where: { userId: testUserId },
        orderBy: { createdAt: 'asc' }
      });
      
      expect(conversations).toHaveLength(3);
      expect(conversations[0].messageType).toBe('TEXT');
      expect(conversations[1].messageType).toBe('VOICE');
      expect(conversations[2].messageType).toBe('PHOTO');
    });
  });

  describe('Balance and Coin Management Integration', () => {
    test('should track coin usage across different features', async () => {
      // Start with known balance
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { coins: 5.0 }
      });
      
      const initialWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      const initialCoins = initialWallet!.coins;
      
      // Use voice feature (0.5 coins)
      await botService.handleVoiceMessage('mock_voice_file_id', testContext);
      
      // Use OCR feature (1.0 coins)
      await botService.handlePhotoMessage('mock_photo_file_id', testContext);
      
      // Check final balance
      const finalWallet = await prisma.wallet.findUnique({ where: { userId: testUserId } });
      expect(finalWallet!.coins).toBe(initialCoins - 1.5); // 0.5 + 1.0
      
      // Verify coin usage is tracked in conversations
      const conversations = await prisma.conversation.findMany({ 
        where: { 
          userId: testUserId,
          coinsUsed: { not: null }
        } 
      });
      
      expect(conversations).toHaveLength(2);
      const totalCoinsUsed = conversations.reduce((sum, conv) => sum + (conv.coinsUsed || 0), 0);
      expect(totalCoinsUsed).toBe(1.5);
    });
  });
});
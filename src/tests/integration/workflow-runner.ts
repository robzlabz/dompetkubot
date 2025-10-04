#!/usr/bin/env bun

/**
 * Comprehensive End-to-End Workflow Test Runner
 * 
 * This script tests all major user workflows to ensure complete integration:
 * 1. Text message processing with AI routing
 * 2. Voice message processing with STT and coin deduction
 * 3. Photo/receipt processing with OCR and coin deduction
 * 4. Multi-modal input handling
 * 5. Conversation context and history
 * 6. Error handling and recovery
 * 7. Balance and coin management
 */

import { setupTestEnvironment, TestDatabaseManager, TestDataGenerator } from '../setup/test-environment.js';
import { TelegramBotService, BotContext } from '../../services/TelegramBotService.js';
import { ConversationRepository } from '../../repositories/ConversationRepository.js';
import { AIRouterService } from '../../services/ai/AIRouterService.js';
import { ResponseFormatterService } from '../../services/ResponseFormatterService.js';
import { ToolRegistry } from '../../services/ai/ToolRegistry.js';
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

// Mock services for testing
const createMockOpenAIService = () => ({
  generateResponse: async (message: string, context: any, tools: any[]) => {
    console.log(`[MOCK AI] Processing: "${message}"`);
    
    // Simulate AI routing based on message content
    if (message.includes('beli') || message.includes('bayar') || message.includes('belanja')) {
      const amount = extractAmount(message) || 25000;
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'create_expense',
            arguments: JSON.stringify({
              amount,
              description: message,
              categoryId: 'makanan-minuman'
            })
          }
        }]
      };
    }
    
    if (message.includes('gaji') || message.includes('bonus') || message.includes('dapat')) {
      const amount = extractAmount(message) || 5000000;
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'create_income',
            arguments: JSON.stringify({
              amount,
              description: message,
              categoryId: 'gaji'
            })
          }
        }]
      };
    }
    
    if (message.includes('budget') || message.includes('anggaran')) {
      const amount = extractAmount(message) || 1000000;
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'set_budget',
            arguments: JSON.stringify({
              categoryId: 'makanan-minuman',
              amount,
              period: 'MONTHLY'
            })
          }
        }]
      };
    }
    
    if (message.includes('tambah saldo') || message.includes('top up')) {
      const amount = extractAmount(message) || 50000;
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'add_balance',
            arguments: JSON.stringify({ amount })
          }
        }]
      };
    }
    
    if (message.includes('voucher') || message.includes('kode')) {
      return {
        content: '',
        toolCalls: [{
          function: {
            name: 'redeem_voucher',
            arguments: JSON.stringify({
              code: 'TEST123'
            })
          }
        }]
      };
    }
    
    return { content: 'Maaf, saya tidak mengerti permintaan Anda. Silakan coba lagi.' };
  },
  
  generatePersonalizedComment: async (type: string, description: string, amount: number) => {
    const comments = {
      expense: `Wah, ${description.toLowerCase()}! Semoga enak ya 😊`,
      income: `Alhamdulillah, rejeki lancar terus ya! 💰`,
      budget: `Budget sudah diatur, jangan lupa dipantau ya! 📊`,
      balance: `Saldo bertambah, siap untuk transaksi premium! 🚀`
    };
    return comments[type as keyof typeof comments] || 'Berhasil dicatat! 👍';
  },
  
  getConversationContext: async (userId: string) => ({
    userId,
    recentMessages: [],
    userPreferences: {}
  })
});

const createMockSTTService = () => ({
  transcribeAudio: async (audioFile: any) => {
    console.log('[MOCK STT] Processing audio file...');
    return {
      success: true,
      text: 'beli kopi dua puluh lima ribu',
      confidence: 0.95
    };
  },
  
  validateAudioFile: (audioFile: any) => ({
    valid: true,
    error: null
  })
});

const createMockOCRService = () => ({
  extractReceiptData: async (imageFile: any) => {
    console.log('[MOCK OCR] Processing receipt image...');
    return {
      success: true,
      receiptData: {
        items: [
          { name: 'Kopi Americano', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
          { name: 'Croissant', quantity: 1, unitPrice: 15000, totalPrice: 15000 }
        ],
        total: 40000,
        discount: 0,
        tax: 0,
        merchantName: 'Coffee Shop Test',
        date: new Date()
      }
    };
  },
  
  validateImageFile: (imageFile: any) => ({
    valid: true,
    error: null
  }),
  
  getOCRCost: () => 1.0,
  
  generateExpenseDescription: (receiptData: any) => 
    `Belanja di ${receiptData.merchantName}`,
    
  convertToExpenseItems: (receiptData: any) => receiptData.items
});

// Helper function to extract amount from text
function extractAmount(text: string): number | null {
  const patterns = [
    /(\d+)\s*(?:ribu|rb)/i,
    /(\d+)\s*(?:juta|jt)/i,
    /(\d+(?:\.\d+)?)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1]);
      if (text.includes('ribu') || text.includes('rb')) {
        return num * 1000;
      } else if (text.includes('juta') || text.includes('jt')) {
        return num * 1000000;
      } else {
        return num;
      }
    }
  }
  
  return null;
}

class WorkflowTestRunner {
  private dbManager: TestDatabaseManager;
  private botService!: TelegramBotService;
  private testUserId!: string;
  private testContext!: BotContext;

  constructor() {
    this.dbManager = new TestDatabaseManager();
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    
    // Setup environment
    setupTestEnvironment();
    
    // Connect to database
    await this.dbManager.connect();
    await this.dbManager.cleanDatabase();
    await this.dbManager.seedTestData();
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Initialize repositories
    const conversationRepo = new ConversationRepository(prisma);
    const walletRepo = new WalletRepository(prisma);
    const expenseRepo = new ExpenseRepository(prisma);
    const incomeRepo = new IncomeRepository(prisma);
    const categoryRepo = new CategoryRepository(prisma);
    const userRepo = new UserRepository(prisma);

    // Initialize services with mocks
    const mockOpenAI = createMockOpenAIService();
    const mockSTT = createMockSTTService();
    const mockOCR = createMockOCRService();
    
    const toolRegistry = new ToolRegistry();
    const aiRouter = new AIRouterService(mockOpenAI as any, toolRegistry, conversationRepo);
    const responseFormatter = new ResponseFormatterService(mockOpenAI as any);
    const calculationService = new CalculationService();
    const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
    const expenseService = new ExpenseService(expenseRepo, categoryRepo, calculationService);
    const encryptionService = new EncryptionService();
    const categoryService = new CategoryService(categoryRepo, mockOpenAI as any);
    const userService = new UserService(userRepo, walletRepo, categoryService);
    const privacyService = new PrivacyService(userRepo, expenseRepo, incomeRepo, conversationRepo, walletRepo, encryptionService);
    const helpService = new HelpService();
    const errorHandler = new ErrorHandlingService();

    // Initialize bot service
    this.botService = new TelegramBotService(
      conversationRepo,
      aiRouter,
      responseFormatter,
      mockSTT as any,
      walletService,
      mockOCR as any,
      expenseService,
      userService,
      helpService,
      errorHandler
    );

    // Create test user
    const testUser = await userService.registerOrGetUser('123456789', 
      TestDataGenerator.createTestUser()
    );

    this.testUserId = testUser.id;
    this.testContext = {
      userId: this.testUserId,
      chatId: '123456789',
      messageId: 1,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User'
    };

    // Add initial balance
    await walletService.addBalance(this.testUserId, 100000); // 100k balance = 100 coins
    
    console.log('✅ Test environment setup complete');
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    await this.dbManager.cleanDatabase();
    await this.dbManager.disconnect();
    console.log('✅ Cleanup complete');
  }

  async runAllWorkflows() {
    console.log('\n🚀 Starting comprehensive workflow tests...\n');

    const results = {
      passed: 0,
      failed: 0,
      errors: [] as string[]
    };

    const workflows = [
      { name: 'Text Message Processing', fn: () => this.testTextMessageWorkflow() },
      { name: 'Voice Message Processing', fn: () => this.testVoiceMessageWorkflow() },
      { name: 'Photo/Receipt Processing', fn: () => this.testPhotoMessageWorkflow() },
      { name: 'AI Routing and Response Formatting', fn: () => this.testAIRoutingWorkflow() },
      { name: 'Multi-Modal Integration', fn: () => this.testMultiModalWorkflow() },
      { name: 'Conversation Context', fn: () => this.testConversationContextWorkflow() },
      { name: 'Balance and Coin Management', fn: () => this.testBalanceManagementWorkflow() },
      { name: 'Error Handling', fn: () => this.testErrorHandlingWorkflow() }
    ];

    for (const workflow of workflows) {
      try {
        console.log(`📋 Testing: ${workflow.name}`);
        await workflow.fn();
        console.log(`✅ ${workflow.name}: PASSED\n`);
        results.passed++;
      } catch (error) {
        console.error(`❌ ${workflow.name}: FAILED`);
        console.error(`   Error: ${error}\n`);
        results.failed++;
        results.errors.push(`${workflow.name}: ${error}`);
      }
    }

    return results;
  }

  async testTextMessageWorkflow() {
    console.log('  🔤 Testing text message processing...');
    
    const testCases = [
      { input: 'beli kopi 25 ribu', expectedAmount: 25000, type: 'expense' },
      { input: 'gaji bulan ini 5 juta', expectedAmount: 5000000, type: 'income' },
      { input: 'budget makanan 1 juta', expectedAmount: 1000000, type: 'budget' },
      { input: 'tambah saldo 50 ribu', expectedAmount: 50000, type: 'balance' }
    ];

    for (const testCase of testCases) {
      const response = await this.botService.handleTextMessage(testCase.input, this.testContext);
      
      if (!response.includes('✅ berhasil tercatat!')) {
        throw new Error(`Expected success response for "${testCase.input}", got: ${response}`);
      }
      
      if (!response.includes(testCase.expectedAmount.toLocaleString('id-ID'))) {
        throw new Error(`Expected amount ${testCase.expectedAmount} in response for "${testCase.input}"`);
      }
      
      console.log(`    ✓ ${testCase.input} -> Success`);
    }
  }

  async testVoiceMessageWorkflow() {
    console.log('  🎤 Testing voice message processing...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Ensure user has enough coins
    await prisma.wallet.update({
      where: { userId: this.testUserId },
      data: { coins: 10 }
    });
    
    const initialWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    const initialCoins = initialWallet!.coins;
    
    const response = await this.botService.handleVoiceMessage('mock_voice_file_id', this.testContext);
    
    if (!response.includes('🎤 *Pesan suara diproses*')) {
      throw new Error(`Expected voice processing indicator, got: ${response}`);
    }
    
    if (!response.includes('0.5 koin')) {
      throw new Error(`Expected coin deduction indicator, got: ${response}`);
    }
    
    // Verify coin deduction
    const updatedWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    if (updatedWallet!.coins !== initialCoins - 0.5) {
      throw new Error(`Expected coin deduction of 0.5, actual: ${initialCoins - updatedWallet!.coins}`);
    }
    
    console.log('    ✓ Voice message processed with coin deduction');
  }

  async testPhotoMessageWorkflow() {
    console.log('  📸 Testing photo/receipt processing...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Ensure user has enough coins
    await prisma.wallet.update({
      where: { userId: this.testUserId },
      data: { coins: 10 }
    });
    
    const initialWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    const initialCoins = initialWallet!.coins;
    
    const response = await this.botService.handlePhotoMessage('mock_photo_file_id', this.testContext);
    
    if (!response.includes('📸 *Struk berhasil diproses*')) {
      throw new Error(`Expected receipt processing indicator, got: ${response}`);
    }
    
    if (!response.includes('1 koin')) {
      throw new Error(`Expected coin deduction indicator, got: ${response}`);
    }
    
    if (!response.includes('Coffee Shop Test')) {
      throw new Error(`Expected merchant name in response, got: ${response}`);
    }
    
    // Verify coin deduction
    const updatedWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    if (updatedWallet!.coins !== initialCoins - 1.0) {
      throw new Error(`Expected coin deduction of 1.0, actual: ${initialCoins - updatedWallet!.coins}`);
    }
    
    console.log('    ✓ Receipt processed with coin deduction and itemization');
  }

  async testAIRoutingWorkflow() {
    console.log('  🤖 Testing AI routing and response formatting...');
    
    const testCases = [
      { input: 'beli nasi gudeg 15rb', expectedKeywords: ['nasi gudeg', '15.000'] },
      { input: 'dapat freelance 2 juta', expectedKeywords: ['freelance', '2.000.000'] },
      { input: 'budget transportasi 500rb', expectedKeywords: ['transportasi', '500.000'] }
    ];

    for (const testCase of testCases) {
      const response = await this.botService.handleTextMessage(testCase.input, this.testContext);
      
      if (!response.includes('✅ berhasil tercatat!')) {
        throw new Error(`Expected success response for "${testCase.input}"`);
      }
      
      // Check for nanoid format
      if (!response.match(/`[a-zA-Z0-9]{8}`/)) {
        throw new Error(`Expected nanoid format in response for "${testCase.input}"`);
      }
      
      // Check for expected keywords
      for (const keyword of testCase.expectedKeywords) {
        if (!response.includes(keyword)) {
          throw new Error(`Expected keyword "${keyword}" in response for "${testCase.input}"`);
        }
      }
      
      console.log(`    ✓ ${testCase.input} -> Properly routed and formatted`);
    }
  }

  async testMultiModalWorkflow() {
    console.log('  🔄 Testing multi-modal integration...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Ensure user has enough coins
    await prisma.wallet.update({
      where: { userId: this.testUserId },
      data: { coins: 10 }
    });
    
    // Clear previous conversations
    await prisma.conversation.deleteMany({ where: { userId: this.testUserId } });
    
    // Test sequence: Text -> Voice -> Photo
    await this.botService.handleTextMessage('beli kopi 25rb', this.testContext);
    await this.botService.handleVoiceMessage('mock_voice_file_id', this.testContext);
    await this.botService.handlePhotoMessage('mock_photo_file_id', this.testContext);
    
    // Verify all conversations are stored with correct types
    const conversations = await prisma.conversation.findMany({ 
      where: { userId: this.testUserId },
      orderBy: { createdAt: 'asc' }
    });
    
    if (conversations.length !== 3) {
      throw new Error(`Expected 3 conversations, got ${conversations.length}`);
    }
    
    const expectedTypes = ['TEXT', 'VOICE', 'PHOTO'];
    for (let i = 0; i < 3; i++) {
      if (conversations[i].messageType !== expectedTypes[i]) {
        throw new Error(`Expected message type ${expectedTypes[i]}, got ${conversations[i].messageType}`);
      }
    }
    
    console.log('    ✓ Multi-modal sequence processed correctly');
  }

  async testConversationContextWorkflow() {
    console.log('  💬 Testing conversation context and history...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Clear previous conversations
    await prisma.conversation.deleteMany({ where: { userId: this.testUserId } });
    
    // Send multiple messages
    const messages = [
      'beli kopi 25rb',
      'beli roti 10rb', 
      'gaji 5 juta'
    ];
    
    for (const message of messages) {
      await this.botService.handleTextMessage(message, this.testContext);
    }
    
    // Verify all conversations are stored
    const conversations = await prisma.conversation.findMany({ 
      where: { userId: this.testUserId },
      orderBy: { createdAt: 'asc' }
    });
    
    if (conversations.length !== messages.length) {
      throw new Error(`Expected ${messages.length} conversations, got ${conversations.length}`);
    }
    
    // Verify all have responses
    for (const conv of conversations) {
      if (!conv.response || !conv.response.includes('berhasil tercatat')) {
        throw new Error(`Expected valid response for conversation: ${conv.message}`);
      }
    }
    
    console.log('    ✓ Conversation history maintained correctly');
  }

  async testBalanceManagementWorkflow() {
    console.log('  💰 Testing balance and coin management...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Start with known balance
    await prisma.wallet.update({
      where: { userId: this.testUserId },
      data: { coins: 5.0 }
    });
    
    const initialWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    const initialCoins = initialWallet!.coins;
    
    // Use voice feature (0.5 coins)
    await this.botService.handleVoiceMessage('mock_voice_file_id', this.testContext);
    
    // Use OCR feature (1.0 coins)
    await this.botService.handlePhotoMessage('mock_photo_file_id', this.testContext);
    
    // Check final balance
    const finalWallet = await prisma.wallet.findUnique({ where: { userId: this.testUserId } });
    const expectedCoins = initialCoins - 1.5; // 0.5 + 1.0
    
    if (Math.abs(finalWallet!.coins - expectedCoins) > 0.01) {
      throw new Error(`Expected ${expectedCoins} coins, got ${finalWallet!.coins}`);
    }
    
    console.log('    ✓ Coin deduction tracked correctly across features');
  }

  async testErrorHandlingWorkflow() {
    console.log('  ⚠️  Testing error handling and recovery...');
    
    const prisma = this.dbManager.getPrismaClient();
    
    // Test insufficient coins
    await prisma.wallet.update({
      where: { userId: this.testUserId },
      data: { coins: 0.1 } // Less than required
    });
    
    const response = await this.botService.handleVoiceMessage('mock_voice_file_id', this.testContext);
    
    if (!response.includes('❌')) {
      throw new Error(`Expected error indicator for insufficient coins, got: ${response}`);
    }
    
    if (!response.includes('Saldo koin tidak cukup')) {
      throw new Error(`Expected insufficient balance message, got: ${response}`);
    }
    
    // Test unclear input
    const unclearResponse = await this.botService.handleTextMessage('asdfghjkl', this.testContext);
    
    if (!unclearResponse.includes('🤔')) {
      throw new Error(`Expected confusion indicator for unclear input, got: ${unclearResponse}`);
    }
    
    if (!unclearResponse.includes('Coba format ini')) {
      throw new Error(`Expected helpful suggestion for unclear input, got: ${unclearResponse}`);
    }
    
    console.log('    ✓ Error handling provides helpful feedback');
  }
}

// Main execution
async function main() {
  const runner = new WorkflowTestRunner();
  
  try {
    await runner.setup();
    const results = await runner.runAllWorkflows();
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    await runner.cleanup();
    
    if (results.failed > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 All workflows completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Test runner failed:', error);
    await runner.cleanup();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { WorkflowTestRunner };
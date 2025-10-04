#!/usr/bin/env bun

/**
 * Quick Integration Verification Script
 * 
 * This script performs a quick verification of all major components
 * to ensure they are properly integrated and working together.
 */

import { setupTestEnvironment } from '../setup/test-environment.js';
import { PrismaClient } from '@prisma/client';

// Import all major services to verify they can be instantiated
import { ConversationRepository } from '../../repositories/ConversationRepository.js';
import { WalletRepository } from '../../repositories/WalletRepository.js';
import { ExpenseRepository } from '../../repositories/ExpenseRepository.js';
import { IncomeRepository } from '../../repositories/IncomeRepository.js';
import { CategoryRepository } from '../../repositories/CategoryRepository.js';
import { UserRepository } from '../../repositories/UserRepository.js';

import { WalletService } from '../../services/WalletService.js';
import { ExpenseService } from '../../services/ExpenseService.js';
import { CalculationService } from '../../services/CalculationService.js';
import { UserService } from '../../services/UserService.js';
import { CategoryService } from '../../services/CategoryService.js';
import { EncryptionService } from '../../services/EncryptionService.js';
import { HelpService } from '../../services/HelpService.js';
import { ErrorHandlingService } from '../../services/ErrorHandlingService.js';
import { ResponseFormatterService } from '../../services/ResponseFormatterService.js';

import { ToolRegistry } from '../../services/ai/ToolRegistry.js';
import { AIRouterService } from '../../services/ai/AIRouterService.js';

interface VerificationResult {
  component: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration?: number;
}

class IntegrationVerifier {
  private results: VerificationResult[] = [];
  private prisma!: PrismaClient;

  async verify(): Promise<VerificationResult[]> {
    console.log('🔍 Starting integration verification...\n');

    // Setup test environment
    setupTestEnvironment();

    await this.verifyDatabaseConnection();
    await this.verifyRepositories();
    await this.verifyServices();
    await this.verifyAIComponents();
    await this.verifyEndToEndFlow();

    return this.results;
  }

  private async verifyDatabaseConnection() {
    await this.runVerification('Database Connection', async () => {
      this.prisma = new PrismaClient();
      await this.prisma.$connect();
      
      // Test basic query
      await this.prisma.user.findMany({ take: 1 });
      
      console.log('  ✓ Database connection established');
    });
  }

  private async verifyRepositories() {
    await this.runVerification('Repository Layer', async () => {
      // Instantiate all repositories
      const conversationRepo = new ConversationRepository(this.prisma);
      const walletRepo = new WalletRepository(this.prisma);
      const expenseRepo = new ExpenseRepository(this.prisma);
      const incomeRepo = new IncomeRepository(this.prisma);
      const categoryRepo = new CategoryRepository(this.prisma);
      const userRepo = new UserRepository(this.prisma);

      // Test basic repository operations
      const categories = await categoryRepo.findMany({ where: { isDefault: true } });
      
      console.log(`  ✓ All repositories instantiated successfully`);
      console.log(`  ✓ Found ${categories.length} default categories`);
    });
  }

  private async verifyServices() {
    await this.runVerification('Service Layer', async () => {
      // Create repositories
      const conversationRepo = new ConversationRepository(this.prisma);
      const walletRepo = new WalletRepository(this.prisma);
      const expenseRepo = new ExpenseRepository(this.prisma);
      const incomeRepo = new IncomeRepository(this.prisma);
      const categoryRepo = new CategoryRepository(this.prisma);
      const userRepo = new UserRepository(this.prisma);

      // Mock OpenAI service for testing
      const mockOpenAI = {
        generateResponse: async () => ({ content: 'test' }),
        generatePersonalizedComment: async () => 'test comment',
        getConversationContext: async () => ({ userId: 'test', recentMessages: [], userPreferences: {} })
      };

      // Instantiate all services
      const calculationService = new CalculationService();
      const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
      const expenseService = new ExpenseService(expenseRepo, categoryRepo, calculationService);
      const encryptionService = new EncryptionService();
      const categoryService = new CategoryService(categoryRepo, mockOpenAI as any);
      const userService = new UserService(userRepo, walletRepo, categoryService);
      const helpService = new HelpService();
      const errorHandler = new ErrorHandlingService();
      const responseFormatter = new ResponseFormatterService(mockOpenAI as any);

      // Test calculation service
      const calculation = calculationService.parseExpression('5 * 10000');
      if (calculation.result !== 50000) {
        throw new Error(`Expected 50000, got ${calculation.result}`);
      }

      // Test help service
      const helpContent = helpService.getHelpContent('pengeluaran');
      if (!helpContent.title || !helpContent.content) {
        throw new Error('Help service not returning proper content');
      }

      console.log('  ✓ All services instantiated successfully');
      console.log('  ✓ Calculation service working');
      console.log('  ✓ Help service working');
    });
  }

  private async verifyAIComponents() {
    await this.runVerification('AI Components', async () => {
      const conversationRepo = new ConversationRepository(this.prisma);
      
      // Mock OpenAI service
      const mockOpenAI = {
        generateResponse: async (message: string) => {
          if (message.includes('beli')) {
            return {
              content: '',
              toolCalls: [{
                function: {
                  name: 'create_expense',
                  arguments: JSON.stringify({ amount: 25000, description: 'test expense' })
                }
              }]
            };
          }
          return { content: 'I do not understand' };
        },
        generatePersonalizedComment: async () => 'Great job!',
        getConversationContext: async (userId: string) => ({ 
          userId, 
          recentMessages: [], 
          userPreferences: {} 
        })
      };

      // Test tool registry
      const toolRegistry = new ToolRegistry();
      const tools = toolRegistry.getOpenAITools();
      
      if (tools.length === 0) {
        throw new Error('No tools registered in ToolRegistry');
      }

      // Test AI router
      const aiRouter = new AIRouterService(mockOpenAI as any, toolRegistry, conversationRepo);
      
      console.log(`  ✓ Tool registry has ${tools.length} tools`);
      console.log('  ✓ AI router instantiated successfully');
    });
  }

  private async verifyEndToEndFlow() {
    await this.runVerification('End-to-End Flow', async () => {
      // Create a test user
      const userRepo = new UserRepository(this.prisma);
      const walletRepo = new WalletRepository(this.prisma);
      const categoryRepo = new CategoryRepository(this.prisma);
      
      const mockOpenAI = {
        generateResponse: async () => ({ content: 'test' }),
        generatePersonalizedComment: async () => 'test comment',
        getConversationContext: async () => ({ userId: 'test', recentMessages: [], userPreferences: {} })
      };
      
      const categoryService = new CategoryService(categoryRepo, mockOpenAI as any);
      const userService = new UserService(userRepo, walletRepo, categoryService);

      // Register a test user
      const testUser = await userService.registerOrGetUser('test_telegram_id', {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'id',
        timezone: 'Asia/Jakarta'
      });

      if (!testUser.id) {
        throw new Error('Failed to create test user');
      }

      // Test wallet creation
      const expenseRepo = new ExpenseRepository(this.prisma);
      const incomeRepo = new IncomeRepository(this.prisma);
      const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
      
      await walletService.addBalance(testUser.id, 50000);
      const wallet = await walletService.getBalance(testUser.id);
      
      if (wallet.balance < 50000) {
        throw new Error(`Expected balance >= 50000, got ${wallet.balance}`);
      }

      // Clean up test user
      await this.prisma.wallet.deleteMany({ where: { userId: testUser.id } });
      await this.prisma.user.delete({ where: { id: testUser.id } });

      console.log('  ✓ User registration flow working');
      console.log('  ✓ Wallet operations working');
      console.log('  ✓ End-to-end flow verified');
    });
  }

  private async runVerification(componentName: string, verificationFn: () => Promise<void>) {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Verifying ${componentName}...`);
      await verificationFn();
      
      const duration = Date.now() - startTime;
      this.results.push({
        component: componentName,
        status: 'PASS',
        duration
      });
      
      console.log(`✅ ${componentName}: PASS (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        component: componentName,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      
      console.error(`❌ ${componentName}: FAIL (${duration}ms)`);
      console.error(`   Error: ${error}\n`);
    }
  }

  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}

async function main() {
  const verifier = new IntegrationVerifier();
  
  try {
    const results = await verifier.verify();
    
    console.log('📊 Verification Summary:');
    console.log('========================');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Components:');
      results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  • ${r.component}: ${r.error}`));
    }
    
    await verifier.cleanup();
    
    if (failed > 0) {
      console.log('\n💥 Integration verification failed!');
      process.exit(1);
    } else {
      console.log('\n🎉 All components integrated successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Verification failed:', error);
    await verifier.cleanup();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { IntegrationVerifier };
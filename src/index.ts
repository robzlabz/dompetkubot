#!/usr/bin/env bun
import { DatabaseConfig, env } from './config/index.js';
import { TelegramBotService } from './services/TelegramBotService.js';
import { ConversationRepository } from './repositories/ConversationRepository.js';
import { AIRouterService } from './services/ai/AIRouterService.js';
import { ResponseFormatterService } from './services/ResponseFormatterService.js';
import { OpenAIService } from './services/OpenAIService.js';
import { ToolRegistry } from './services/ai/ToolRegistry.js';
import { SpeechToTextService } from './services/SpeechToTextService.js';
import { OCRService } from './services/OCRService.js';
import { WalletService } from './services/WalletService.js';
import { ExpenseService } from './services/ExpenseService.js';
import { CalculationService } from './services/CalculationService.js';
import { WalletRepository } from './repositories/WalletRepository.js';
import { ExpenseRepository } from './repositories/ExpenseRepository.js';
import { IncomeRepository } from './repositories/IncomeRepository.js';
import { CategoryRepository } from './repositories/CategoryRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { UserService } from './services/UserService.js';
import { CategoryService } from './services/CategoryService.js';
import { EncryptionService } from './services/EncryptionService.js';
import { PrivacyService } from './services/PrivacyService.js';
import { HelpService } from './services/HelpService.js';
import { ErrorHandlingService } from './services/ErrorHandlingService.js';
import { PrismaClient } from '@prisma/client';

let botService: TelegramBotService | null = null;
let prisma: PrismaClient | null = null;

async function main() {
  try {
    console.log('Starting Telegram Budget Bot...');

    // Connect to database
    await DatabaseConfig.connect();
    console.log('Database connected successfully');

    // Initialize Prisma client
    prisma = new PrismaClient();
    await prisma.$connect();

    // Initialize repositories
    const conversationRepo = new ConversationRepository(prisma);
    const walletRepo = new WalletRepository(prisma);
    const expenseRepo = new ExpenseRepository(prisma);
    const incomeRepo = new IncomeRepository(prisma);
    const categoryRepo = new CategoryRepository(prisma);
    const userRepo = new UserRepository(prisma);

    // Initialize services
    const openAIService = new OpenAIService(conversationRepo);
    const toolRegistry = new ToolRegistry();
    const aiRouter = new AIRouterService(openAIService, toolRegistry, conversationRepo);
    const responseFormatter = new ResponseFormatterService(openAIService);
    const sttService = new SpeechToTextService();
    const ocrService = new OCRService();
    const calculationService = new CalculationService();
    const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
    const expenseService = new ExpenseService(expenseRepo, categoryRepo, calculationService);
    const encryptionService = new EncryptionService();
    const categoryService = new CategoryService(categoryRepo, openAIService);
    const userService = new UserService(userRepo, walletRepo, categoryService);
    const privacyService = new PrivacyService(userRepo, expenseRepo, incomeRepo, conversationRepo, walletRepo, encryptionService);
    const helpService = new HelpService();
    const errorHandler = new ErrorHandlingService();

    // Initialize bot service
    botService = new TelegramBotService(
      conversationRepo,
      aiRouter,
      responseFormatter,
      sttService,
      walletService,
      ocrService,
      expenseService,
      userService,
      helpService,
      errorHandler
    );

    // Start the bot
    await botService.start();

    console.log('Bot configuration loaded');
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Port: ${env.PORT}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      if (botService) {
        await botService.stop();
      }
      
      if (prisma) {
        await prisma.$disconnect();
      }
      
      await DatabaseConfig.disconnect();
      console.log('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('Telegram Budget Bot started successfully');

  } catch (error) {
    console.error('Failed to start application:', error);
    
    if (botService) {
      try {
        await botService.stop();
      } catch (stopError) {
        console.error('Error stopping bot:', stopError);
      }
    }
    
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (prismaError) {
        console.error('Error disconnecting Prisma:', prismaError);
      }
    }
    
    try {
      await DatabaseConfig.disconnect();
    } catch (dbError) {
      console.error('Error disconnecting database:', dbError);
    }
    
    process.exit(1);
  }
}

main();
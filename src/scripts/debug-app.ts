#!/usr/bin/env bun

/**
 * Debug Application Startup
 * 
 * This script helps debug why the application hangs during startup
 */

import { PrismaClient } from '@prisma/client';

console.log('🔍 Debugging application startup...\n');

async function debugStartup() {
  try {
    console.log('1. Checking environment variables...');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');

    console.log('\n2. Testing database connection...');
    const prisma = new PrismaClient({
      log: ['error', 'warn', 'info'],
    });

    console.log('   Connecting to database...');
    await prisma.$connect();
    console.log('   ✅ Database connected successfully');

    console.log('   Testing simple query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Query successful:', result);

    console.log('\n3. Testing service imports...');
    
    console.log('   Importing CalculationService...');
    const { CalculationService } = await import('../services/CalculationService.js');
    const calcService = new CalculationService();
    console.log('   ✅ CalculationService imported');

    console.log('   Importing HelpService...');
    const { HelpService } = await import('../services/HelpService.js');
    const helpService = new HelpService();
    console.log('   ✅ HelpService imported');

    console.log('   Importing ErrorHandlingService...');
    const { ErrorHandlingService } = await import('../services/ErrorHandlingService.js');
    const errorService = new ErrorHandlingService();
    console.log('   ✅ ErrorHandlingService imported');

    console.log('\n4. Testing external service imports...');
    
    try {
      console.log('   Importing OpenAIService...');
      const { OpenAIService } = await import('../services/OpenAIService.js');
      console.log('   ✅ OpenAIService imported (but not instantiated)');
    } catch (error) {
      console.log('   ⚠️  OpenAIService import issue:', error);
    }

    try {
      console.log('   Importing SpeechToTextService...');
      const { SpeechToTextService } = await import('../services/SpeechToTextService.js');
      console.log('   ✅ SpeechToTextService imported (but not instantiated)');
    } catch (error) {
      console.log('   ⚠️  SpeechToTextService import issue:', error);
    }

    try {
      console.log('   Importing OCRService...');
      const { OCRService } = await import('../services/OCRService.js');
      console.log('   ✅ OCRService imported (but not instantiated)');
    } catch (error) {
      console.log('   ⚠️  OCRService import issue:', error);
    }

    console.log('\n5. Testing repository imports...');
    
    const { ConversationRepository } = await import('../repositories/ConversationRepository.js');
    const conversationRepo = new ConversationRepository(prisma);
    console.log('   ✅ ConversationRepository created');

    const { WalletRepository } = await import('../repositories/WalletRepository.js');
    const walletRepo = new WalletRepository(prisma);
    console.log('   ✅ WalletRepository created');

    console.log('\n6. Testing Telegram bot import...');
    try {
      const { TelegramBotService } = await import('../services/TelegramBotService.js');
      console.log('   ✅ TelegramBotService imported (but not instantiated)');
    } catch (error) {
      console.log('   ❌ TelegramBotService import failed:', error);
    }

    await prisma.$disconnect();
    console.log('\n🎉 All basic components can be imported successfully!');
    console.log('\n💡 The issue might be in service instantiation or bot startup.');

  } catch (error) {
    console.error('\n❌ Debug failed at step:', error);
    console.error('Error details:', error);
  }
}

debugStartup();
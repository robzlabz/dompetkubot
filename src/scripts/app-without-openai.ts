#!/usr/bin/env bun

/**
 * Application without OpenAI Service
 * 
 * Test if OpenAI service is causing the hang
 */

import { PrismaClient } from '@prisma/client';

console.log('🚀 Starting app without OpenAI service...\n');

async function startAppWithoutOpenAI() {
  try {
    console.log('1. Setting up database...');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('   ✅ Database connected');

    console.log('\n2. Importing repositories...');
    const { ConversationRepository } = await import('../repositories/ConversationRepository.js');
    const { WalletRepository } = await import('../repositories/WalletRepository.js');
    const { ExpenseRepository } = await import('../repositories/ExpenseRepository.js');
    const { IncomeRepository } = await import('../repositories/IncomeRepository.js');
    const { CategoryRepository } = await import('../repositories/CategoryRepository.js');
    const { UserRepository } = await import('../repositories/UserRepository.js');

    const conversationRepo = new ConversationRepository(prisma);
    const walletRepo = new WalletRepository(prisma);
    const expenseRepo = new ExpenseRepository(prisma);
    const incomeRepo = new IncomeRepository(prisma);
    const categoryRepo = new CategoryRepository(prisma);
    const userRepo = new UserRepository(prisma);
    console.log('   ✅ Repositories created');

    console.log('\n3. Importing basic services...');
    const { CalculationService } = await import('../services/CalculationService.js');
    const { HelpService } = await import('../services/HelpService.js');
    const { ErrorHandlingService } = await import('../services/ErrorHandlingService.js');
    const { EncryptionService } = await import('../services/EncryptionService.js');

    const calculationService = new CalculationService();
    const helpService = new HelpService();
    const errorHandler = new ErrorHandlingService();
    const encryptionService = new EncryptionService();
    console.log('   ✅ Basic services created');

    console.log('\n4. Importing business services...');
    const { WalletService } = await import('../services/WalletService.js');
    const { ExpenseService } = await import('../services/ExpenseService.js');

    const walletService = new WalletService(walletRepo, expenseRepo, incomeRepo);
    const expenseService = new ExpenseService(expenseRepo, categoryRepo, calculationService);
    console.log('   ✅ Business services created');

    console.log('\n5. Testing Telegram bot without AI...');
    const { Bot } = await import('gramio');
    const bot = new Bot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
    });

    // Simple handlers without AI
    bot.command('start', async (ctx) => {
      const welcome = helpService.generateWelcomeMessage({
        firstName: ctx.update?.message?.from?.first_name,
        isNewUser: true
      });
      await ctx.reply(welcome);
    });

    bot.command('help', async (ctx) => {
      const help = helpService.getHelpContent();
      await ctx.reply(help.content);
    });

    bot.on('message', async (ctx) => {
      if (ctx.update?.message?.text) {
        const text = ctx.update.message.text;
        
        // Simple calculation test
        if (text.includes('*') || text.includes('ribu') || text.includes('juta')) {
          try {
            const result = await calculationService.calculateExpression(text);
            await ctx.reply(`Hasil: ${result.result.toLocaleString('id-ID')}`);
          } catch (error) {
            await ctx.reply('Maaf, tidak bisa menghitung ekspresi tersebut.');
          }
        } else {
          await ctx.reply('Bot berjalan tanpa AI. Coba kirim perhitungan seperti "5 * 10000" atau "25 ribu"');
        }
      }
    });

    console.log('   ✅ Bot handlers set up');

    console.log('\n6. Starting bot...');
    await bot.start();
    console.log('   ✅ Bot started successfully!');

    console.log('\n🎉 App running without OpenAI service!');
    console.log('Try: /start, /help, or send calculations like "25 ribu"');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await bot.stop();
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ App without OpenAI failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

startAppWithoutOpenAI();
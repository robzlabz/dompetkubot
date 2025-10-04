#!/usr/bin/env bun

/**
 * Simplified Main Application
 * 
 * Minimal version to identify the hanging issue
 */

import { PrismaClient } from '@prisma/client';

console.log('🚀 Starting Telegram Budget Bot (Simplified)...\n');

async function main() {
  let prisma: PrismaClient | null = null;
  let bot: any = null;

  try {
    console.log('1. Environment check...');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN required');
    console.log('   ✅ Environment variables OK');

    console.log('\n2. Database setup...');
    prisma = new PrismaClient();
    
    // Add timeout to connection
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('   ✅ Database connected');

    console.log('\n3. Import basic services...');
    const { CalculationService } = await import('./services/CalculationService.js');
    const { HelpService } = await import('./services/HelpService.js');
    const { ErrorHandlingService } = await import('./services/ErrorHandlingService.js');
    
    const calcService = new CalculationService();
    const helpService = new HelpService();
    const errorService = new ErrorHandlingService();
    console.log('   ✅ Basic services loaded');

    console.log('\n4. Setup Telegram bot...');
    const { Bot } = await import('gramio');
    bot = new Bot({
      token: process.env.TELEGRAM_BOT_TOKEN,
    });

    // Bot handlers
    bot.command('start', async (ctx: any) => {
      const welcome = helpService.generateWelcomeMessage({
        firstName: ctx.update?.message?.from?.first_name || 'User',
        isNewUser: true
      });
      await ctx.reply(welcome);
    });

    bot.command('help', async (ctx: any) => {
      const help = helpService.getHelpContent();
      await ctx.reply(`${help.title}\n\n${help.content}`);
    });

    bot.command('calc', async (ctx: any) => {
      const args = ctx.update?.message?.text?.split(' ').slice(1).join(' ');
      if (!args) {
        await ctx.reply('Contoh: /calc 5 * 10000 atau /calc 25 ribu');
        return;
      }

      try {
        const result = await calcService.calculateExpression(args);
        await ctx.reply(`💰 ${args} = Rp ${result.result.toLocaleString('id-ID')}`);
      } catch (error) {
        await ctx.reply('❌ Tidak bisa menghitung ekspresi tersebut. Coba: /calc 25 ribu');
      }
    });

    bot.on('message', async (ctx: any) => {
      if (ctx.update?.message?.text && !ctx.update.message.text.startsWith('/')) {
        const text = ctx.update.message.text;
        
        if (text.toLowerCase().includes('halo') || text.toLowerCase().includes('hai')) {
          await ctx.reply('Halo! 👋 Saya Budget Bot. Ketik /help untuk bantuan atau /calc 25ribu untuk test.');
        } else if (calcService.isValidExpression(text)) {
          try {
            const result = await calcService.calculateExpression(text);
            await ctx.reply(`💰 ${text} = Rp ${result.result.toLocaleString('id-ID')}`);
          } catch (error) {
            await ctx.reply('❌ Maaf, tidak bisa menghitung. Coba format lain.');
          }
        } else {
          await ctx.reply(`📝 Pesan: "${text}"\n\nBot berjalan normal! Coba /help atau kirim perhitungan seperti "25 ribu"`);
        }
      }
    });

    console.log('   ✅ Bot handlers configured');

    console.log('\n5. Starting bot...');
    await bot.start();
    console.log('   ✅ Bot started successfully!');

    console.log('\n🎉 Telegram Budget Bot is running!');
    console.log('Commands: /start, /help, /calc 25ribu');
    console.log('Or send: "halo", "25 ribu", "5 * 10000"');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down...`);
      
      if (bot) {
        try {
          await bot.stop();
          console.log('✅ Bot stopped');
        } catch (error) {
          console.error('❌ Error stopping bot:', error);
        }
      }
      
      if (prisma) {
        try {
          await prisma.$disconnect();
          console.log('✅ Database disconnected');
        } catch (error) {
          console.error('❌ Error disconnecting database:', error);
        }
      }
      
      console.log('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('\n❌ Application failed to start:', error);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    if (bot) {
      try {
        await bot.stop();
      } catch (stopError) {
        console.error('Error stopping bot:', stopError);
      }
    }
    
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting database:', disconnectError);
      }
    }
    
    process.exit(1);
  }
}

main();
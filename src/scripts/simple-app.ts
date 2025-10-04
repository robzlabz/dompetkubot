#!/usr/bin/env bun

/**
 * Simplified Application Startup
 * 
 * This script starts the app with minimal dependencies to isolate the issue
 */

console.log('🚀 Starting simplified Telegram Budget Bot...\n');

async function startSimpleApp() {
  try {
    console.log('1. Loading environment...');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
    console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing');

    console.log('\n2. Testing database with timeout...');
    
    // Test database connection with timeout
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const dbPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    
    await Promise.race([dbPromise, timeoutPromise]);
    console.log('   ✅ Database connected');

    // Test simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ Database query works');

    console.log('\n3. Testing Telegram bot...');
    
    // Import and test bot
    const { Bot } = await import('gramio');
    const bot = new Bot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
    });

    console.log('   ✅ Bot instance created');

    // Add simple handler
    bot.command('start', async (ctx) => {
      await ctx.reply('Bot is working! 🎉');
    });

    bot.on('message', async (ctx) => {
      if (ctx.update?.message?.text) {
        await ctx.reply(`Echo: ${ctx.update.message.text}`);
      }
    });

    console.log('   ✅ Bot handlers added');

    // Start bot
    console.log('   Starting bot...');
    await bot.start();
    console.log('   ✅ Bot started successfully!');

    console.log('\n🎉 Simplified bot is running!');
    console.log('Try sending /start to your bot');

    // Keep alive
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await bot.stop();
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Simplified app failed:', error);
    process.exit(1);
  }
}

startSimpleApp();
#!/usr/bin/env bun

/**
 * Application with Direct Environment Access
 * 
 * Bypass environment config to test if that's causing the hang
 */

import { PrismaClient } from '@prisma/client';

console.log('🚀 Starting app with direct environment access...\n');

async function startAppDirectEnv() {
  try {
    console.log('1. Checking environment directly...');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
    console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing');
    console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Missing');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    console.log('\n2. Setting up database with direct connection...');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    
    await prisma.$connect();
    console.log('   ✅ Database connected');

    // Test query
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM categories`;
    console.log('   ✅ Database query successful:', result);

    console.log('\n3. Setting up Telegram bot...');
    const { Bot } = await import('gramio');
    const bot = new Bot({
      token: process.env.TELEGRAM_BOT_TOKEN,
    });

    // Simple handlers
    bot.command('start', async (ctx) => {
      await ctx.reply('🎉 Bot berhasil jalan!\n\nBot ini adalah Telegram Budget Bot yang membantu mengelola keuangan Anda.');
    });

    bot.command('test', async (ctx) => {
      const categories = await prisma.category.findMany({ take: 5 });
      const categoryList = categories.map(c => `• ${c.name}`).join('\n');
      await ctx.reply(`📋 Kategori tersedia:\n${categoryList}`);
    });

    bot.on('message', async (ctx) => {
      if (ctx.update?.message?.text && !ctx.update.message.text.startsWith('/')) {
        const text = ctx.update.message.text;
        
        // Simple response
        if (text.toLowerCase().includes('halo') || text.toLowerCase().includes('hai')) {
          await ctx.reply('Halo! Bot sudah berjalan dengan baik. Ketik /start untuk memulai.');
        } else if (text.includes('ribu') || text.includes('rb')) {
          // Simple number parsing
          const match = text.match(/(\d+)\s*(?:ribu|rb)/i);
          if (match) {
            const amount = parseInt(match[1]) * 1000;
            await ctx.reply(`💰 ${match[1]} ribu = Rp ${amount.toLocaleString('id-ID')}`);
          }
        } else {
          await ctx.reply(`Echo: ${text}\n\nBot berjalan normal. Coba ketik "25 ribu" atau /test`);
        }
      }
    });

    console.log('   ✅ Bot handlers configured');

    console.log('\n4. Starting bot...');
    await bot.start();
    console.log('   ✅ Bot started successfully!');

    console.log('\n🎉 App running with direct environment access!');
    console.log('Commands: /start, /test');
    console.log('Try: "halo", "25 ribu"');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await bot.stop();
      await prisma.$disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ App with direct env failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

startAppDirectEnv();
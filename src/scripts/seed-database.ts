#!/usr/bin/env bun

/**
 * Database Seeding Script
 * 
 * This script seeds the database with default categories and initial data
 * required for the Telegram Budget Bot to function properly.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create default expense categories
    const expenseCategories = [
      { id: 'makanan-minuman', name: 'Makanan & Minuman', type: 'EXPENSE' as const },
      { id: 'transportasi', name: 'Transportasi', type: 'EXPENSE' as const },
      { id: 'tagihan', name: 'Tagihan & Utilitas', type: 'EXPENSE' as const },
      { id: 'hiburan', name: 'Hiburan', type: 'EXPENSE' as const },
      { id: 'belanja', name: 'Belanja', type: 'EXPENSE' as const },
      { id: 'kesehatan', name: 'Kesehatan', type: 'EXPENSE' as const },
      { id: 'pendidikan', name: 'Pendidikan', type: 'EXPENSE' as const },
      { id: 'lainnya', name: 'Lainnya', type: 'EXPENSE' as const }
    ];

    // Create default income categories
    const incomeCategories = [
      { id: 'gaji', name: 'Gaji', type: 'INCOME' as const },
      { id: 'bonus', name: 'Bonus', type: 'INCOME' as const },
      { id: 'freelance', name: 'Freelance', type: 'INCOME' as const },
      { id: 'investasi', name: 'Investasi', type: 'INCOME' as const },
      { id: 'bisnis', name: 'Bisnis', type: 'INCOME' as const },
      { id: 'hadiah', name: 'Hadiah', type: 'INCOME' as const },
      { id: 'lainnya-income', name: 'Lainnya', type: 'INCOME' as const }
    ];

    // Seed expense categories
    console.log('📝 Creating default expense categories...');
    for (const category of expenseCategories) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: {
          ...category,
          isDefault: true
        }
      });
      console.log(`  ✓ ${category.name}`);
    }

    // Seed income categories
    console.log('💰 Creating default income categories...');
    for (const category of incomeCategories) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: {
          ...category,
          isDefault: true
        }
      });
      console.log(`  ✓ ${category.name}`);
    }

    // Create some sample vouchers
    console.log('🎫 Creating sample vouchers...');
    const vouchers = [
      {
        code: 'WELCOME2024',
        type: 'COINS' as const,
        value: 5,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      {
        code: 'NEWUSER',
        type: 'COINS' as const,
        value: 10,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
      },
      {
        code: 'BONUS100',
        type: 'BALANCE' as const,
        value: 100000,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
      }
    ];

    for (const voucher of vouchers) {
      await prisma.voucher.upsert({
        where: { code: voucher.code },
        update: {},
        create: voucher
      });
      console.log(`  ✓ ${voucher.code} (${voucher.type}: ${voucher.value})`);
    }

    // Verify database connection and data
    console.log('🔍 Verifying database setup...');
    
    const categoryCount = await prisma.category.count();
    const voucherCount = await prisma.voucher.count();
    
    console.log(`  ✓ Categories created: ${categoryCount}`);
    console.log(`  ✓ Vouchers created: ${voucherCount}`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Database Summary:');
    console.log(`   • ${expenseCategories.length} expense categories`);
    console.log(`   • ${incomeCategories.length} income categories`);
    console.log(`   • ${vouchers.length} sample vouchers`);
    console.log('   • Database schema fully migrated');
    console.log('   • Prisma client generated');
    
    console.log('\n🚀 The Telegram Budget Bot database is ready!');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if called directly
if (import.meta.main) {
  seedDatabase();
}

export { seedDatabase };
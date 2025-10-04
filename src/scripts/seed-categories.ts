#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('🌱 Seeding database with categories and vouchers...');

try {
  // Default expense categories
  const expenseCategories = [
    { id: 'makanan-minuman', name: 'Makanan & Minuman' },
    { id: 'transportasi', name: 'Transportasi' },
    { id: 'tagihan', name: 'Tagihan & Utilitas' },
    { id: 'hiburan', name: 'Hiburan' },
    { id: 'belanja', name: 'Belanja' },
    { id: 'kesehatan', name: 'Kesehatan' },
    { id: 'pendidikan', name: 'Pendidikan' },
    { id: 'lainnya', name: 'Lainnya' }
  ];

  // Default income categories
  const incomeCategories = [
    { id: 'gaji', name: 'Gaji' },
    { id: 'bonus', name: 'Bonus' },
    { id: 'freelance', name: 'Freelance' },
    { id: 'investasi', name: 'Investasi' },
    { id: 'bisnis', name: 'Bisnis' },
    { id: 'hadiah', name: 'Hadiah' },
    { id: 'lainnya-income', name: 'Lainnya' }
  ];

  console.log('📝 Creating expense categories...');
  for (const cat of expenseCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        type: 'EXPENSE',
        isDefault: true
      }
    });
    console.log(`  ✓ ${cat.name}`);
  }

  console.log('💰 Creating income categories...');
  for (const cat of incomeCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        type: 'INCOME',
        isDefault: true
      }
    });
    console.log(`  ✓ ${cat.name}`);
  }

  console.log('🎫 Creating sample vouchers...');
  const vouchers = [
    { code: 'WELCOME2024', type: 'COINS', value: 5 },
    { code: 'NEWUSER', type: 'COINS', value: 10 },
    { code: 'BONUS100', type: 'BALANCE', value: 100000 }
  ];

  for (const voucher of vouchers) {
    await prisma.voucher.upsert({
      where: { code: voucher.code },
      update: {},
      create: {
        code: voucher.code,
        type: voucher.type as any,
        value: voucher.value,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    });
    console.log(`  ✓ ${voucher.code} (${voucher.type}: ${voucher.value})`);
  }

  // Summary
  const categoryCount = await prisma.category.count();
  const voucherCount = await prisma.voucher.count();
  
  console.log('\n✅ Database seeding completed!');
  console.log(`📊 Summary:`);
  console.log(`   • ${categoryCount} categories created`);
  console.log(`   • ${voucherCount} vouchers created`);
  console.log('🚀 Telegram Budget Bot database is ready!');

} catch (error) {
  console.error('❌ Seeding failed:', error);
} finally {
  await prisma.$disconnect();
}
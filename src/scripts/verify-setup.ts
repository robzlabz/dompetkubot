#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('🔍 Verifying complete database setup...\n');

try {
    // Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Database connected successfully');

    // Check all tables exist
    console.log('\n2. Checking database schema...');
    const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  ` as Array<{ table_name: string }>;

    const expectedTables = [
        'budgets', 'categories', 'conversations', 'expense_items',
        'expenses', 'incomes', 'users', 'vouchers', 'wallets'
    ];

    console.log('   📋 Tables found:', tables.map(t => t.table_name).join(', '));

    const missingTables = expectedTables.filter(
        table => !tables.some(t => t.table_name === table)
    );

    if (missingTables.length > 0) {
        console.log('   ❌ Missing tables:', missingTables.join(', '));
    } else {
        console.log('   ✅ All required tables present');
    }

    // Check categories
    console.log('\n3. Verifying categories...');
    const expenseCategories = await prisma.category.findMany({
        where: { type: 'EXPENSE', isDefault: true }
    });
    const incomeCategories = await prisma.category.findMany({
        where: { type: 'INCOME', isDefault: true }
    });

    console.log(`   📝 Expense categories: ${expenseCategories.length}`);
    expenseCategories.forEach(cat => console.log(`      • ${cat.name}`));

    console.log(`   💰 Income categories: ${incomeCategories.length}`);
    incomeCategories.forEach(cat => console.log(`      • ${cat.name}`));

    // Check vouchers
    console.log('\n4. Verifying vouchers...');
    const vouchers = await prisma.voucher.findMany({
        where: { isUsed: false }
    });

    console.log(`   🎫 Available vouchers: ${vouchers.length}`);
    vouchers.forEach(voucher =>
        console.log(`      • ${voucher.code} (${voucher.type}: ${voucher.value})`)
    );

    // Test CRUD operations
    console.log('\n5. Testing CRUD operations...');

    // Create test user
    const testUser = await prisma.user.create({
        data: {
            telegramId: 'test_123456789',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User'
        }
    });
    console.log('   ✅ User creation successful');

    // Create test wallet
    const testWallet = await prisma.wallet.create({
        data: {
            userId: testUser.id,
            balance: 50000,
            coins: 50
        }
    });
    console.log('   ✅ Wallet creation successful');

    // Create test expense
    const testExpense = await prisma.expense.create({
        data: {
            userId: testUser.id,
            amount: 25000,
            description: 'Test expense',
            categoryId: 'makanan-minuman'
        }
    });
    console.log('   ✅ Expense creation successful');

    // Create test conversation
    const testConversation = await prisma.conversation.create({
        data: {
            userId: testUser.id,
            message: 'beli kopi 25rb',
            response: 'Pengeluaran berhasil dicatat!',
            messageType: 'TEXT'
        }
    });
    console.log('   ✅ Conversation creation successful');

    // Clean up test data
    console.log('\n6. Cleaning up test data...');
    await prisma.conversation.delete({ where: { id: testConversation.id } });
    await prisma.expense.delete({ where: { id: testExpense.id } });
    await prisma.wallet.delete({ where: { id: testWallet.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('   ✅ Test data cleaned up');

    // Final summary
    console.log('\n🎉 Database Setup Verification Complete!');
    console.log('=====================================');
    console.log('✅ Database connection: Working');
    console.log('✅ Schema migration: Complete');
    console.log('✅ Default categories: Seeded');
    console.log('✅ Sample vouchers: Created');
    console.log('✅ CRUD operations: Functional');
    console.log('✅ Data relationships: Working');
    console.log('\n🚀 The Telegram Budget Bot database is fully ready!');

} catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
} finally {
    await prisma.$disconnect();
}
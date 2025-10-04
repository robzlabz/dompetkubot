#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';

async function debugDatabase() {
  console.log('🔍 Debugging database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('1. Attempting to connect...');
    await prisma.$connect();
    console.log('✅ Connected successfully');
    
    console.log('2. Testing simple query...');
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log('✅ Query result:', result);
    
    console.log('3. Checking categories table...');
    const categoryCount = await prisma.category.count();
    console.log('✅ Category count:', categoryCount);
    
    console.log('4. Creating a test category...');
    const testCategory = await prisma.category.create({
      data: {
        id: 'test-category',
        name: 'Test Category',
        type: 'EXPENSE',
        isDefault: false
      }
    });
    console.log('✅ Test category created:', testCategory);
    
    console.log('5. Cleaning up test category...');
    await prisma.category.delete({
      where: { id: 'test-category' }
    });
    console.log('✅ Test category deleted');
    
    console.log('🎉 Database is working perfectly!');
    
  } catch (error) {
    console.error('❌ Database error:', error);
    
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

debugDatabase();
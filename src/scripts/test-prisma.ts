#!/usr/bin/env bun

/**
 * Test Prisma Connection with Timeout
 */

import { PrismaClient } from '@prisma/client';

console.log('🔍 Testing Prisma connection with timeout...\n');

async function testPrismaWithTimeout() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Attempting connection with 10 second timeout...');
    
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ Connected successfully');
    
    console.log('Testing query...');
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log('✅ Query result:', result);
    
    await prisma.$disconnect();
    console.log('✅ Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Prisma test failed:', error);
    
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('❌ Disconnect error:', disconnectError);
    }
  }
}

testPrismaWithTimeout();
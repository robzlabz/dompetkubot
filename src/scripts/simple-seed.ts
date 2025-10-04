#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('🌱 Simple database seeding...');

try {
  // Create one test category
  const category = await prisma.category.create({
    data: {
      id: 'makanan-minuman',
      name: 'Makanan & Minuman',
      type: 'EXPENSE',
      isDefault: true
    }
  });
  
  console.log('✅ Category created:', category);
  
  // Count categories
  const count = await prisma.category.count();
  console.log('✅ Total categories:', count);
  
} catch (error) {
  console.error('❌ Error:', error);
} finally {
  await prisma.$disconnect();
  console.log('🔌 Disconnected');
}
#!/usr/bin/env bun

/**
 * Debug AI Routing System
 */

import { PrismaClient } from '@prisma/client';

console.log('🔍 Debugging AI Routing System...\n');

async function debugAIRouting() {
  try {
    console.log('1. Setting up database...');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('   ✅ Database connected');

    console.log('\n2. Testing ToolRegistry...');
    const { ToolRegistry } = await import('../services/ai/ToolRegistry.js');
    const toolRegistry = new ToolRegistry();
    
    const tools = toolRegistry.getOpenAITools();
    console.log(`   ✅ Tool registry loaded with ${tools.length} tools`);
    
    if (tools.length > 0) {
      console.log('   📋 Available tools:');
      tools.forEach(tool => {
        console.log(`      • ${tool.function.name}: ${tool.function.description}`);
      });
    } else {
      console.log('   ❌ No tools found in registry!');
    }

    console.log('\n3. Testing OpenAI Service...');
    const { ConversationRepository } = await import('../repositories/ConversationRepository.js');
    const conversationRepo = new ConversationRepository(prisma);
    
    try {
      const { OpenAIService } = await import('../services/OpenAIService.js');
      const openAIService = new OpenAIService(conversationRepo);
      console.log('   ✅ OpenAI service created');
      
      // Test getting conversation context
      const context = await openAIService.getConversationContext('test-user');
      console.log('   ✅ Conversation context retrieved:', {
        userId: context.userId,
        messageCount: context.recentMessages.length
      });
      
    } catch (error) {
      console.log('   ❌ OpenAI service error:', error.message);
    }

    console.log('\n4. Testing AI Router...');
    try {
      const { AIRouterService } = await import('../services/ai/AIRouterService.js');
      const { OpenAIService } = await import('../services/OpenAIService.js');
      
      const openAIService = new OpenAIService(conversationRepo);
      const aiRouter = new AIRouterService(openAIService, toolRegistry, conversationRepo);
      console.log('   ✅ AI Router created');
      
      // Test simple routing
      console.log('   Testing message routing...');
      const testMessages = [
        'beli kopi 25rb',
        'gaji 5 juta',
        'budget makanan 1 juta'
      ];
      
      for (const message of testMessages) {
        try {
          console.log(`   Testing: "${message}"`);
          const result = await aiRouter.routeMessage(message, 'test-user');
          console.log(`      ✅ Response: ${result.response.substring(0, 100)}...`);
          console.log(`      Tool used: ${result.toolCall?.function?.name || 'none'}`);
        } catch (routeError) {
          console.log(`      ❌ Routing failed: ${routeError.message}`);
        }
      }
      
    } catch (error) {
      console.log('   ❌ AI Router error:', error.message);
    }

    console.log('\n5. Testing individual tools...');
    try {
      // Test expense tool
      const expenseResult = await toolRegistry.executeTool('create_expense', {
        amount: 25000,
        description: 'Test expense',
        categoryId: 'makanan-minuman'
      }, 'test-user');
      
      console.log('   ✅ Expense tool result:', expenseResult.success ? 'Success' : 'Failed');
      
    } catch (toolError) {
      console.log('   ❌ Tool execution error:', toolError.message);
    }

    await prisma.$disconnect();
    console.log('\n🎯 AI Routing Debug Complete');

  } catch (error) {
    console.error('\n❌ Debug failed:', error);
    console.error('Stack:', error.stack);
  }
}

debugAIRouting();
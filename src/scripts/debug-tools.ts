#!/usr/bin/env bun

/**
 * Debug Tools Registration
 */

import { ToolRegistry } from '../services/ai/ToolRegistry.js';

console.log('🔧 Testing Tools Registration...\n');

async function testToolsRegistration() {
  try {
    const toolRegistry = new ToolRegistry();
    
    console.log('1. Testing manual tool registration...');
    
    // Try to create a simple tool manually
    const { CreateExpenseTool } = await import('../services/ai/tools/CreateExpenseTool.js');
    
    // Create mock services
    const mockExpenseService = {
      createExpense: async () => ({ id: 'test', amount: 25000, description: 'test' })
    };
    
    const mockCategoryService = {
      findByName: async () => ({ id: 'test-cat', name: 'Test' })
    };
    
    const mockOpenAIService = {
      generatePersonalizedComment: async () => 'Test comment'
    };
    
    console.log('2. Creating CreateExpenseTool...');
    const expenseTool = new CreateExpenseTool(
      mockExpenseService as any,
      mockCategoryService as any,
      mockOpenAIService as any
    );
    
    console.log('   ✅ Tool created');
    console.log('   📋 Tool name:', expenseTool.name);
    console.log('   📝 Tool description:', expenseTool.description);
    
    console.log('3. Testing toOpenAITool method...');
    try {
      const openAITool = expenseTool.toOpenAITool();
      console.log('   ✅ toOpenAITool works');
      console.log('   🔧 Function name:', openAITool.function.name);
    } catch (error) {
      console.log('   ❌ toOpenAITool failed:', error.message);
    }
    
    console.log('4. Registering tool...');
    toolRegistry.registerTool(expenseTool);
    
    const tools = toolRegistry.getAllTools();
    console.log(`   ✅ Tools registered: ${tools.length}`);
    
    console.log('5. Testing getOpenAITools...');
    try {
      const openAITools = toolRegistry.getOpenAITools();
      console.log(`   ✅ OpenAI tools: ${openAITools.length}`);
      
      if (openAITools.length > 0) {
        console.log('   📋 First tool:', openAITools[0].function.name);
      }
    } catch (error) {
      console.log('   ❌ getOpenAITools failed:', error.message);
      console.log('   🔍 Tool types:', tools.map(t => typeof t));
      console.log('   🔍 Tool methods:', tools.map(t => Object.getOwnPropertyNames(Object.getPrototypeOf(t))));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testToolsRegistration();
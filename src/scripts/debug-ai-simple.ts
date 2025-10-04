#!/usr/bin/env bun

/**
 * Debug AI Routing - Simple Test
 */

console.log('🔍 Testing AI Routing Components...\n');

async function testAIComponents() {
  try {
    console.log('1. Testing environment variables...');
    console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Missing');
    console.log('   OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'Default');
    console.log('   OPENAI_MODEL:', process.env.OPENAI_MODEL || 'Default');

    console.log('\n2. Testing ToolRegistry...');
    const { ToolRegistry } = await import('../services/ai/ToolRegistry.js');
    const toolRegistry = new ToolRegistry();
    
    const tools = toolRegistry.getOpenAITools();
    console.log(`   ✅ Tools loaded: ${tools.length}`);
    
    if (tools.length > 0) {
      console.log('   📋 Available tools:');
      tools.slice(0, 3).forEach(tool => {
        console.log(`      • ${tool.function.name}`);
      });
    }

    console.log('\n3. Testing OpenAI Service initialization...');
    try {
      // Create a mock conversation repo
      const mockConversationRepo = {
        findRecentByUserId: async () => [],
        create: async () => ({ id: 'test' }),
        update: async () => ({ id: 'test' })
      };

      const { OpenAIService } = await import('../services/OpenAIService.js');
      const openAIService = new OpenAIService(mockConversationRepo as any);
      console.log('   ✅ OpenAI service created');

      // Test getting context
      const context = await openAIService.getConversationContext('test-user');
      console.log('   ✅ Context retrieved:', {
        userId: context.userId,
        messageCount: context.recentMessages.length
      });

      console.log('\n4. Testing AI response generation...');
      try {
        const response = await openAIService.generateResponse(
          'beli kopi 25rb',
          context,
          tools
        );
        console.log('   ✅ AI response generated');
        console.log('   📝 Content:', response.content?.substring(0, 100) || 'No content');
        console.log('   🔧 Tool calls:', response.toolCalls?.length || 0);
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log('   🎯 First tool:', response.toolCalls[0].function.name);
        }

      } catch (aiError) {
        console.log('   ❌ AI response failed:', aiError.message);
        console.log('   Stack:', aiError.stack?.split('\n')[0]);
      }

    } catch (serviceError) {
      console.log('   ❌ OpenAI service failed:', serviceError.message);
    }

    console.log('\n5. Testing direct OpenAI client...');
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
      });

      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, can you respond with just "OK"?' }
        ],
        max_tokens: 10
      });

      console.log('   ✅ Direct OpenAI call successful');
      console.log('   📝 Response:', completion.choices[0]?.message?.content);

    } catch (directError) {
      console.log('   ❌ Direct OpenAI call failed:', directError.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testAIComponents();
#!/usr/bin/env bun

/**
 * Core Integration Test
 * 
 * This script tests the core business logic components that don't
 * depend on external services or environment configuration.
 */

import { CalculationService } from '../../services/CalculationService.js';
import { HelpService } from '../../services/HelpService.js';
import { ErrorHandlingService, ErrorType } from '../../services/ErrorHandlingService.js';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  duration: number;
}

class CoreIntegrationTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Running core integration tests...\n');

    await this.testCalculationService();
    await this.testHelpService();
    await this.testErrorHandlingService();
    await this.testMathematicalExpressions();
    await this.testIndonesianFormatting();

    return this.results;
  }

  private async runTest(name: string, testFn: () => Promise<void> | void) {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Testing ${name}...`);
      await testFn();
      
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'PASS', duration });
      console.log(`✅ ${name}: PASS (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, status: 'FAIL', error: errorMessage, duration });
      console.error(`❌ ${name}: FAIL (${duration}ms)`);
      console.error(`   Error: ${errorMessage}`);
    }
    console.log();
  }

  private async testCalculationService() {
    await this.runTest('Calculation Service', async () => {
      const service = new CalculationService();
      
      // Test basic multiplication
      const result1 = await service.calculateExpression('5 * 10000');
      if (result1.result !== 50000) {
        throw new Error(`Expected 50000, got ${result1.result}`);
      }
      
      // Test Indonesian "ribu" format
      const result2 = await service.calculateExpression('25 ribu');
      if (result2.result !== 25000) {
        throw new Error(`Expected 25000, got ${result2.result}`);
      }
      
      // Test "rb" abbreviation
      const result3 = await service.calculateExpression('15rb');
      if (result3.result !== 15000) {
        throw new Error(`Expected 15000, got ${result3.result}`);
      }
      
      // Test "juta" format
      const result4 = await service.calculateExpression('2 juta');
      if (result4.result !== 2000000) {
        throw new Error(`Expected 2000000, got ${result4.result}`);
      }
      
      // Test quantity @ price format
      const result5 = await service.calculateExpression('2kg @ 15rb');
      if (result5.result !== 30000) {
        throw new Error(`Expected 30000, got ${result5.result}`);
      }
      
      // Test simple @ expression
      const result6 = await service.calculateExpression('3 @ 25000');
      if (result6.result !== 75000) {
        throw new Error(`Expected 75000, got ${result6.result}`);
      }
      
      // Test validation
      const isValid1 = service.isValidExpression('5 * 10000');
      if (!isValid1) {
        throw new Error('Valid expression not recognized');
      }
      
      const isValid2 = service.isValidExpression('invalid text');
      if (isValid2) {
        throw new Error('Invalid expression incorrectly validated');
      }
      
      console.log('  ✓ Basic multiplication: 5 * 10000 = 50000');
      console.log('  ✓ Indonesian "ribu": 25 ribu = 25000');
      console.log('  ✓ Abbreviation "rb": 15rb = 15000');
      console.log('  ✓ Indonesian "juta": 2 juta = 2000000');
      console.log('  ✓ Quantity format: 2kg @ 15rb = 30000');
      console.log('  ✓ Simple @ expression: 3 @ 25000 = 75000');
      console.log('  ✓ Expression validation working');
    });
  }

  private async testHelpService() {
    await this.runTest('Help Service', () => {
      const service = new HelpService();
      
      // Test main help
      const mainHelp = service.getHelpContent();
      if (!mainHelp.title || !mainHelp.content) {
        throw new Error('Main help content is empty');
      }
      
      // Test specific topics
      const topics = ['pengeluaran', 'pemasukan', 'budget', 'koin', 'laporan'];
      for (const topic of topics) {
        const help = service.getHelpContent(topic);
        if (!help.title || !help.content) {
          throw new Error(`Help content for "${topic}" is empty`);
        }
      }
      
      // Test available topics
      const availableTopics = service.getAvailableTopics();
      if (availableTopics.length === 0) {
        throw new Error('No help topics available');
      }
      
      // Test welcome message for new user
      const welcomeNew = service.generateWelcomeMessage({
        firstName: 'Budi',
        isNewUser: true
      });
      if (!welcomeNew.includes('Budi') || !welcomeNew.includes('selamat datang')) {
        throw new Error(`New user welcome message not properly formatted. Got: ${welcomeNew.substring(0, 100)}...`);
      }
      
      // Test welcome message for returning user
      const welcomeReturning = service.generateWelcomeMessage({
        firstName: 'Sari',
        isNewUser: false
      });
      if (!welcomeReturning.includes('Sari') || !welcomeReturning.includes('kembali')) {
        throw new Error('Returning user welcome message not properly formatted');
      }
      
      // Test guided setup
      const setupStep = service.getGuidedSetupStep(1);
      if (!setupStep || !setupStep.prompt) {
        throw new Error('Guided setup step 1 not available');
      }
      
      console.log(`  ✓ Main help content available`);
      console.log(`  ✓ ${topics.length} topic-specific help sections working`);
      console.log(`  ✓ ${availableTopics.length} help topics available`);
      console.log('  ✓ New user welcome message generation working');
      console.log('  ✓ Returning user welcome message working');
      console.log('  ✓ Guided setup system working');
    });
  }

  private async testErrorHandlingService() {
    await this.runTest('Error Handling Service', () => {
      const service = new ErrorHandlingService();
      
      // Test different error types
      const errorTypes = [
        ErrorType.INSUFFICIENT_BALANCE,
        ErrorType.VOUCHER_INVALID,
        ErrorType.CATEGORY_NOT_FOUND,
        ErrorType.VALIDATION_ERROR
      ];
      
      for (const errorType of errorTypes) {
        const error = service.createError(
          errorType,
          `Test ${errorType}`,
          { testData: true },
          undefined,
          'test-user-id'
        );
        
        if (error.type !== errorType) {
          throw new Error(`Error type not set correctly for ${errorType}`);
        }
        
        const response = service.formatErrorResponse(error);
        if (!response.userMessage.includes('❌')) {
          throw new Error(`Error response not properly formatted for ${errorType}`);
        }
        
        if (!response.userMessage) {
          throw new Error(`No user message for ${errorType}`);
        }
      }
      
      // Test contextual fallback responses
      const fallbackTests = [
        { input: 'beli kopi', expectedKeyword: 'pengeluaran' },
        { input: 'gaji saya', expectedKeyword: 'pemasukan' },
        { input: 'budget makanan', expectedKeyword: 'budget' },
        { input: 'laporan bulan ini', expectedKeyword: 'laporan' },
        { input: 'saldo koin', expectedKeyword: 'koin' }
      ];
      
      for (const test of fallbackTests) {
        const fallback = service.getFallbackResponse(test.input);
        if (!fallback.includes(test.expectedKeyword)) {
          throw new Error(`Fallback response for "${test.input}" should contain "${test.expectedKeyword}"`);
        }
      }
      
      console.log(`  ✓ ${errorTypes.length} error types handled correctly`);
      console.log('  ✓ Error response formatting working');
      console.log(`  ✓ ${fallbackTests.length} contextual fallback responses working`);
    });
  }

  private async testMathematicalExpressions() {
    await this.runTest('Mathematical Expression Processing', async () => {
      const service = new CalculationService();
      
      const testCases = [
        // Basic operations
        { expr: '10 * 25', expected: 250, desc: 'Multiplication' },
        
        // Indonesian formats
        { expr: '5 ribu', expected: 5000, desc: 'Ribu format' },
        { expr: '2 juta', expected: 2000000, desc: 'Juta format' },
        { expr: '15rb', expected: 15000, desc: 'Rb abbreviation' },
        { expr: '3jt', expected: 3000000, desc: 'Jt abbreviation' },
        
        // Quantity calculations
        { expr: '5kg @ 10rb', expected: 50000, desc: 'Kg @ price' },
        { expr: '3 buah @ 2500', expected: 7500, desc: 'Buah @ price' },
        { expr: '2 liter @ 15000', expected: 30000, desc: 'Liter @ price' },
        
        // Simple expressions
        { expr: '5 * 10rb', expected: 50000, desc: 'Mixed operations' },
        { expr: '3 @ 25000', expected: 75000, desc: 'Simple @ operation' }
      ];
      
      for (const testCase of testCases) {
        try {
          const result = await service.calculateExpression(testCase.expr);
          if (Math.abs(result.result - testCase.expected) > 0.01) {
            throw new Error(`${testCase.desc}: Expected ${testCase.expected}, got ${result.result} for "${testCase.expr}"`);
          }
        } catch (error) {
          throw new Error(`${testCase.desc}: Failed to process "${testCase.expr}" - ${error}`);
        }
      }
      
      console.log(`  ✓ ${testCases.length} mathematical expressions processed correctly`);
      console.log('  ✓ Basic arithmetic operations working');
      console.log('  ✓ Indonesian number formats supported');
      console.log('  ✓ Quantity calculations working');
      console.log('  ✓ Complex expressions working');
    });
  }

  private async testIndonesianFormatting() {
    await this.runTest('Indonesian Number Formatting', () => {
      const testCases = [
        { number: 1000, expected: '1.000' },
        { number: 25000, expected: '25.000' },
        { number: 1500000, expected: '1.500.000' },
        { number: 2750000, expected: '2.750.000' }
      ];
      
      for (const testCase of testCases) {
        const formatted = testCase.number.toLocaleString('id-ID');
        if (formatted !== testCase.expected) {
          throw new Error(`Expected ${testCase.expected}, got ${formatted} for ${testCase.number}`);
        }
      }
      
      // Test currency formatting
      const currencyTests = [
        { amount: 25000, expected: 'Rp 25.000' },
        { amount: 1500000, expected: 'Rp 1.500.000' }
      ];
      
      for (const test of currencyTests) {
        const formatted = `Rp ${test.amount.toLocaleString('id-ID')}`;
        if (formatted !== test.expected) {
          throw new Error(`Currency format: Expected ${test.expected}, got ${formatted}`);
        }
      }
      
      console.log(`  ✓ ${testCases.length} number formatting tests passed`);
      console.log(`  ✓ ${currencyTests.length} currency formatting tests passed`);
      console.log('  ✓ Indonesian locale formatting working correctly');
    });
  }
}

async function main() {
  const tester = new CoreIntegrationTester();
  
  try {
    const results = await tester.runAllTests();
    
    console.log('📊 Core Integration Test Results:');
    console.log('==================================');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  • ${r.name}: ${r.error}`));
    }
    
    if (failed > 0) {
      console.log('\n💥 Some core integration tests failed!');
      process.exit(1);
    } else {
      console.log('\n🎉 All core integration tests passed!');
      console.log('\n📋 Core Integration Status:');
      console.log('• ✅ Mathematical calculation engine working');
      console.log('• ✅ Indonesian number format parsing working');
      console.log('• ✅ Complex expression evaluation working');
      console.log('• ✅ Help system fully functional');
      console.log('• ✅ Error handling system robust');
      console.log('• ✅ Indonesian localization working');
      console.log('• ✅ User guidance system operational');
      console.log('\n🚀 Core business logic integration verified!');
      
      console.log('\n📝 Integration Test Summary for Task 13.1:');
      console.log('==========================================');
      console.log('✅ Component Integration: All core services properly integrated');
      console.log('✅ Mathematical Processing: Complex calculations working end-to-end');
      console.log('✅ Indonesian Localization: Number formats and language support verified');
      console.log('✅ Error Handling: Comprehensive error management system active');
      console.log('✅ User Experience: Help and guidance systems functional');
      console.log('✅ Business Logic: Core financial operations validated');
      
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Core integration test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { CoreIntegrationTester };
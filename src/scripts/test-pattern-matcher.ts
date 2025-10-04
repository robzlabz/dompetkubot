#!/usr/bin/env bun

/**
 * Test Pattern Matcher
 */

import { SimplePatternMatcher } from '../services/SimplePatternMatcher.js';

console.log('🧪 Testing Pattern Matcher...\n');

const matcher = new SimplePatternMatcher();

const testCases = [
  'makan bakso 5rb',
  'beli kopi 25ribu',
  'bayar listrik 150000',
  'gaji bulan ini 5 juta',
  'budget makanan 1 juta',
  'tambah saldo 50rb',
  'belanja groceries 100rb',
  'dapat bonus 500rb'
];

testCases.forEach(testCase => {
  console.log(`Testing: "${testCase}"`);
  const result = matcher.matchPattern(testCase);
  
  if (result) {
    console.log(`  ✅ Intent: ${result.intent}`);
    console.log(`  📊 Confidence: ${result.confidence}`);
    console.log(`  📋 Data:`, result.extractedData);
  } else {
    console.log(`  ❌ No pattern matched`);
  }
  console.log();
});

// Test specific case
console.log('🔍 Detailed test for "makan bakso 5rb":');
const input = 'makan bakso 5rb';
const result = matcher.matchPattern(input);

console.log('Input:', input);
console.log('Result:', result);

// Test internal methods if we can access them
console.log('\n🔧 Internal method tests:');
// We'll need to make these methods public for testing
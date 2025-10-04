import { z } from 'zod';

// Validation schemas for calculation inputs
const CalculationExpressionSchema = z.string().min(1, 'Expression cannot be empty');

export interface CalculationResult {
  result: number;
  expression: string;
  breakdown?: string;
  items?: Array<{
    quantity: number;
    unitPrice: number;
    total: number;
    description?: string;
  }>;
}

export interface ParsedExpression {
  quantity: number;
  unitPrice: number;
  description?: string;
  operator: 'multiply' | 'add' | 'subtract';
}

export class CalculationService {
  /**
   * Parse and calculate mathematical expressions in Indonesian format
   * Supports formats like:
   * - "5kg @ 10rb" -> 5 * 10000 = 50000
   * - "3 x 2500" -> 3 * 2500 = 7500
   * - "10 kali 1500" -> 10 * 1500 = 15000
   * - "2 @ 5000 + 3 @ 3000" -> (2 * 5000) + (3 * 3000) = 19000
   */
  async calculateExpression(expression: string): Promise<CalculationResult> {
    try {
      // Validate input
      CalculationExpressionSchema.parse(expression);
      
      const normalizedExpression = this.normalizeExpression(expression);
      const parsedExpressions = this.parseExpression(normalizedExpression);
      
      let total = 0;
      const items: CalculationResult['items'] = [];
      const breakdownParts: string[] = [];
      
      for (const parsed of parsedExpressions) {
        const itemTotal = parsed.quantity * parsed.unitPrice;
        total += itemTotal;
        
        items.push({
          quantity: parsed.quantity,
          unitPrice: parsed.unitPrice,
          total: itemTotal,
          description: parsed.description || undefined
        });
        
        breakdownParts.push(`${parsed.quantity} × ${this.formatRupiah(parsed.unitPrice)} = ${this.formatRupiah(itemTotal)}`);
      }
      
      return {
        result: total,
        expression: expression,
        breakdown: breakdownParts.join(' + '),
        items: items
      };
    } catch (error) {
      throw new Error(`Failed to calculate expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize Indonesian expressions to a standard format
   */
  private normalizeExpression(expression: string): string {
    let normalized = expression.toLowerCase().trim();
    
    // Replace Indonesian number formats
    normalized = this.normalizeIndonesianNumbers(normalized);
    
    // Replace Indonesian operators with standard symbols
    normalized = normalized.replace(/\s*@\s*/g, ' * ');
    normalized = normalized.replace(/\s*x\s*/g, ' * ');
    normalized = normalized.replace(/\s*kali\s*/g, ' * ');
    normalized = normalized.replace(/\s*per\s*/g, ' * ');
    normalized = normalized.replace(/\s*perkg\s*/g, ' * ');
    normalized = normalized.replace(/\s*perkilo\s*/g, ' * ');
    
    // Handle units (kg, gram, liter, etc.)
    normalized = normalized.replace(/(\d+)\s*(kg|kilo|kilogram)/g, '$1');
    normalized = normalized.replace(/(\d+)\s*(gr|gram)/g, '$1');
    normalized = normalized.replace(/(\d+)\s*(ltr|liter)/g, '$1');
    normalized = normalized.replace(/(\d+)\s*(pcs|pieces|buah)/g, '$1');
    
    return normalized;
  }

  /**
   * Convert Indonesian number formats to standard numbers
   */
  private normalizeIndonesianNumbers(text: string): string {
    let normalized = text;
    
    // Handle "rb" (ribu = thousand)
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*rb/g, (match, num) => {
      return num ? (parseFloat(num) * 1000).toString() : match;
    });
    
    // Handle "jt" or "juta" (million)
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*(?:jt|juta)/g, (match, num) => {
      return num ? (parseFloat(num) * 1000000).toString() : match;
    });
    
    // Handle "ribu"
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*ribu/g, (match, num) => {
      return num ? (parseFloat(num) * 1000).toString() : match;
    });
    
    // Handle Indonesian decimal separator (comma to dot)
    normalized = normalized.replace(/(\d+),(\d+)/g, '$1.$2');
    
    // Remove dots used as thousand separators (but keep decimal dots)
    normalized = normalized.replace(/(\d+)\.(\d{3})(?!\d)/g, '$1$2');
    
    return normalized;
  }

  /**
   * Parse normalized expression into calculation components
   */
  private parseExpression(expression: string): ParsedExpression[] {
    const expressions: ParsedExpression[] = [];
    
    // Split by addition/subtraction while preserving operators
    const parts = expression.split(/(\s*\+\s*|\s*-\s*)/);
    
    for (let i = 0; i < parts.length; i += 2) {
      const part = parts[i]?.trim();
      if (!part) continue;
      
      // Parse multiplication expressions
      const multiplyMatch = part.match(/(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)/);
      if (multiplyMatch && multiplyMatch[1] && multiplyMatch[2]) {
        expressions.push({
          quantity: parseFloat(multiplyMatch[1]),
          unitPrice: parseFloat(multiplyMatch[2]),
          operator: 'multiply'
        });
      } else {
        // Single number
        const numberMatch = part.match(/(\d+(?:\.\d+)?)/);
        if (numberMatch && numberMatch[1]) {
          expressions.push({
            quantity: 1,
            unitPrice: parseFloat(numberMatch[1]),
            operator: 'multiply'
          });
        }
      }
    }
    
    return expressions;
  }

  /**
   * Format number as Indonesian Rupiah
   */
  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Extract quantity and unit price from Indonesian text
   * Examples:
   * - "5 kg ayam @ 25rb" -> { quantity: 5, unitPrice: 25000, unit: "kg", item: "ayam" }
   * - "3 botol air @ 5000" -> { quantity: 3, unitPrice: 5000, unit: "botol", item: "air" }
   */
  async parseQuantityAndPrice(text: string): Promise<{
    quantity: number;
    unitPrice: number;
    unit?: string;
    item?: string;
    totalPrice: number;
  } | null> {
    try {
      const normalized = this.normalizeExpression(text);
      
      // Pattern to match: quantity [unit] item @ price
      const patterns = [
        /(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|gr|gram|ltr|liter|botol|pcs|buah|pack)?\s*([a-zA-Z\s]+?)?\s*@\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(kg|kilo|kilogram|gr|gram|ltr|liter|botol|pcs|buah|pack)?\s*([a-zA-Z\s]+?)?\s*(?:x|kali|\*)\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*([a-zA-Z\s]+?)?\s*@\s*(\d+(?:\.\d+)?)/
      ];
      
      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match && match[1] && match[match.length - 1]) {
          const quantity = parseFloat(match[1]);
          const unit = match[2] && typeof match[2] === 'string' ? match[2].trim() : undefined;
          const item = match[3] && typeof match[3] === 'string' ? match[3].trim() : undefined;
          const lastMatch = match[match.length - 1];
          const unitPrice = lastMatch ? parseFloat(lastMatch) : 0;
          
          return {
            quantity,
            unitPrice,
            unit,
            item,
            totalPrice: quantity * unitPrice
          };
        }
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to parse quantity and price from "${text}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if a string contains a valid mathematical expression
   */
  isValidExpression(expression: string): boolean {
    try {
      const normalized = this.normalizeExpression(expression);
      const hasNumbers = /\d/.test(normalized);
      const hasOperators = /[\*\+\-@x]/.test(expression.toLowerCase()) || /kali|per/.test(expression.toLowerCase());
      
      return hasNumbers && (hasOperators || /\d+\s*rb|\d+\s*ribu|\d+\s*jt|\d+\s*juta/.test(expression.toLowerCase()));
    } catch {
      return false;
    }
  }

  /**
   * Extract all numbers from Indonesian text
   */
  extractNumbers(text: string): number[] {
    const normalized = this.normalizeIndonesianNumbers(text.toLowerCase());
    const numberMatches = normalized.match(/\d+(?:\.\d+)?/g);
    
    return numberMatches ? numberMatches.map(num => parseFloat(num)) : [];
  }

  /**
   * Calculate simple total from array of numbers
   */
  calculateTotal(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  /**
   * Format calculation result for display in Indonesian
   */
  formatCalculationResult(result: CalculationResult): string {
    if (result.items && result.items.length > 1) {
      return `${result.breakdown || ''} = ${this.formatRupiah(result.result)}`;
    } else if (result.items && result.items.length === 1) {
      const item = result.items[0];
      if (item) {
        return `${item.quantity} × ${this.formatRupiah(item.unitPrice)} = ${this.formatRupiah(result.result)}`;
      }
    }
    return this.formatRupiah(result.result);
  }
}
/**
 * Simple Pattern Matcher
 * 
 * Fallback system when AI routing fails
 */

export interface PatternMatch {
  intent: string;
  confidence: number;
  extractedData: any;
}

export class SimplePatternMatcher {
  
  /**
   * Match user input against simple patterns
   */
  matchPattern(text: string): PatternMatch | null {
    const input = text.toLowerCase().trim();
    
    // Expense patterns
    if (this.isExpensePattern(input)) {
      const data = this.extractExpenseData(input);
      if (data) {
        return {
          intent: 'create_expense',
          confidence: 0.8,
          extractedData: data
        };
      }
    }
    
    // Income patterns
    if (this.isIncomePattern(input)) {
      const data = this.extractIncomeData(input);
      if (data) {
        return {
          intent: 'create_income',
          confidence: 0.8,
          extractedData: data
        };
      }
    }
    
    // Budget patterns
    if (this.isBudgetPattern(input)) {
      const data = this.extractBudgetData(input);
      if (data) {
        return {
          intent: 'set_budget',
          confidence: 0.8,
          extractedData: data
        };
      }
    }
    
    // Balance patterns
    if (this.isBalancePattern(input)) {
      const data = this.extractBalanceData(input);
      if (data) {
        return {
          intent: 'add_balance',
          confidence: 0.8,
          extractedData: data
        };
      }
    }
    
    return null;
  }
  
  private isExpensePattern(input: string): boolean {
    const expenseKeywords = ['beli', 'bayar', 'byr', 'belanja', 'makan', 'minum', 'transport'];
    return expenseKeywords.some(keyword => input.includes(keyword));
  }
  
  private isIncomePattern(input: string): boolean {
    const incomeKeywords = ['gaji', 'bonus', 'dapat', 'terima', 'freelance', 'jual'];
    return incomeKeywords.some(keyword => input.includes(keyword));
  }
  
  private isBudgetPattern(input: string): boolean {
    return input.includes('budget') || input.includes('anggaran');
  }
  
  private isBalancePattern(input: string): boolean {
    return (input.includes('tambah') && input.includes('saldo')) || 
           (input.includes('top') && input.includes('up'));
  }
  
  private extractExpenseData(input: string): any {
    // Extract amount
    const amount = this.extractAmount(input);
    if (!amount) return null;
    
    // Extract description
    const description = this.extractDescription(input, ['beli', 'bayar', 'byr']);
    
    return {
      amount,
      description: description || input,
      categoryId: this.guessCategory(input, 'expense')
    };
  }
  
  private extractIncomeData(input: string): any {
    const amount = this.extractAmount(input);
    if (!amount) return null;
    
    const description = this.extractDescription(input, ['gaji', 'bonus', 'dapat', 'terima']);
    
    return {
      amount,
      description: description || input,
      categoryId: this.guessCategory(input, 'income')
    };
  }
  
  private extractBudgetData(input: string): any {
    const amount = this.extractAmount(input);
    if (!amount) return null;
    
    // Extract category from budget command
    const categoryMatch = input.match(/budget\s+(\w+)/);
    const category = categoryMatch ? categoryMatch[1] : 'lainnya';
    
    return {
      categoryId: this.mapCategoryName(category),
      amount,
      period: 'MONTHLY'
    };
  }
  
  private extractBalanceData(input: string): any {
    const amount = this.extractAmount(input);
    if (!amount) return null;
    
    return { amount };
  }
  
  private extractAmount(text: string): number | null {
    // Handle Indonesian number formats
    const patterns = [
      /(\d+(?:\.\d+)?)\s*juta/i,
      /(\d+(?:\.\d+)?)\s*jt/i,
      /(\d+(?:\.\d+)?)\s*ribu/i,
      /(\d+(?:\.\d+)?)\s*rb/i,
      /(\d+(?:\.\d+)?)\s*k/i,
      /(\d+(?:[.,]\d+)?)/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseFloat(match[1].replace(',', '.'));
        
        if (text.includes('juta') || text.includes('jt')) {
          return num * 1000000;
        } else if (text.includes('ribu') || text.includes('rb') || text.includes('k')) {
          return num * 1000;
        } else {
          return num;
        }
      }
    }
    
    return null;
  }
  
  private extractDescription(input: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}\\s+(.+?)(?:\\s+\\d|$)`, 'i');
      const match = input.match(regex);
      if (match) {
        return `${keyword} ${match[1].trim()}`;
      }
    }
    return null;
  }
  
  private guessCategory(input: string, type: 'expense' | 'income'): string {
    if (type === 'expense') {
      if (input.includes('makan') || input.includes('minum') || input.includes('kopi') || input.includes('nasi')) {
        return 'makanan-minuman';
      }
      if (input.includes('transport') || input.includes('ojek') || input.includes('bus')) {
        return 'transportasi';
      }
      if (input.includes('listrik') || input.includes('air') || input.includes('tagihan')) {
        return 'tagihan';
      }
      if (input.includes('belanja') || input.includes('beli')) {
        return 'belanja';
      }
      return 'lainnya';
    } else {
      if (input.includes('gaji')) return 'gaji';
      if (input.includes('bonus')) return 'bonus';
      if (input.includes('freelance')) return 'freelance';
      return 'lainnya-income';
    }
  }
  
  private mapCategoryName(name: string): string {
    const mapping: Record<string, string> = {
      'makanan': 'makanan-minuman',
      'makan': 'makanan-minuman',
      'minum': 'makanan-minuman',
      'transport': 'transportasi',
      'transportasi': 'transportasi',
      'tagihan': 'tagihan',
      'listrik': 'tagihan',
      'hiburan': 'hiburan',
      'belanja': 'belanja',
      'kesehatan': 'kesehatan',
      'pendidikan': 'pendidikan'
    };
    
    return mapping[name.toLowerCase()] || 'lainnya';
  }
}
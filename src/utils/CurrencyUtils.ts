/**
 * Utility class for formatting Indonesian Rupiah currency
 * Provides consistent currency formatting across the application
 */
export class CurrencyUtils {
    /**
     * Format number as Indonesian Rupiah with standard formatting
     */
    static formatRupiah(amount: number): string {
        return `Rp ${amount.toLocaleString('id-ID')}`;
    }

    /**
     * Format Indonesian Rupiah with readable suffixes for large amounts
     * Examples:
     * - 1500000 -> "Rp 1,5 juta"
     * - 25000 -> "Rp 25 ribu"
     * - 500 -> "Rp 500"
     */
    static formatRupiahReadable(amount: number): string {
        if (amount >= 1000000000) {
            // Billions
            const billions = amount / 1000000000;
            if (billions % 1 === 0) {
                return `Rp ${billions.toLocaleString('id-ID')} miliar`;
            } else {
                return `Rp ${billions.toFixed(1).replace('.', ',')} miliar`;
            }
        } else if (amount >= 1000000) {
            // Millions
            const millions = amount / 1000000;
            if (millions % 1 === 0) {
                return `Rp ${millions.toLocaleString('id-ID')} juta`;
            } else {
                return `Rp ${millions.toFixed(1).replace('.', ',')} juta`;
            }
        } else if (amount >= 1000) {
            // Thousands
            const thousands = amount / 1000;
            if (thousands % 1 === 0) {
                return `Rp ${thousands.toLocaleString('id-ID')} ribu`;
            } else {
                return `Rp ${thousands.toFixed(1).replace('.', ',')} ribu`;
            }
        } else {
            return `Rp ${amount.toLocaleString('id-ID')}`;
        }
    }

    /**
     * Format currency for display in calculations
     * Uses dot as decimal separator for consistency with calculations
     */
    static formatForCalculation(amount: number): string {
        return `Rp ${amount.toLocaleString('id-ID')}`;
    }

    /**
     * Parse Indonesian currency text to number
     * Handles formats like "25rb", "1.5jt", "Rp 50.000"
     */
    static parseRupiah(text: string): number | null {
        try {
            let normalized = text.toLowerCase().trim();

            // Remove "Rp" prefix
            normalized = normalized.replace(/^rp\s*/i, '');

            // Handle "rb" (ribu = thousand)
            if (normalized.includes('rb') || normalized.includes('ribu')) {
                const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)/);
                if (match && match[1]) {
                    const num = parseFloat(match[1].replace(',', '.'));
                    return num * 1000;
                }
            }

            // Handle "jt" or "juta" (million)
            if (normalized.includes('jt') || normalized.includes('juta')) {
                const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/);
                if (match && match[1]) {
                    const num = parseFloat(match[1].replace(',', '.'));
                    return num * 1000000;
                }
            }

            // Handle "miliar" (billion)
            if (normalized.includes('miliar')) {
                const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*miliar/);
                if (match && match[1]) {
                    const num = parseFloat(match[1].replace(',', '.'));
                    return num * 1000000000;
                }
            }

            // Handle regular numbers with dots as thousand separators
            normalized = normalized.replace(/\./g, '');
            normalized = normalized.replace(/,/g, '.');

            const num = parseFloat(normalized);
            return isNaN(num) ? null : num;
        } catch {
            return null;
        }
    }

    /**
     * Format percentage for budget displays
     */
    static formatPercentage(percentage: number, decimals: number = 0): string {
        return `${percentage.toFixed(decimals)}%`;
    }

    /**
     * Format coin amounts (supports float values)
     */
    static formatCoins(coins: number): string {
        // Format with up to 1 decimal place, but remove .0 if whole number
        return coins % 1 === 0 ? coins.toString() : coins.toFixed(1);
    }

    /**
     * Check if a string contains currency information
     */
    static containsCurrency(text: string): boolean {
        const currencyPatterns = [
            /\d+\s*(?:rb|ribu)/i,
            /\d+\s*(?:jt|juta)/i,
            /\d+\s*miliar/i,
            /rp\s*\d+/i,
            /\d+\s*rupiah/i,
        ];

        return currencyPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Extract all currency amounts from text
     */
    static extractCurrencyAmounts(text: string): number[] {
        const amounts: number[] = [];

        // Find all potential currency patterns
        const patterns = [
            /(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)/gi,
            /(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/gi,
            /(\d+(?:[.,]\d+)?)\s*miliar/gi,
            /rp\s*(\d+(?:[.,]\d+)?)/gi,
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const parsed = this.parseRupiah(match[0]);
                if (parsed !== null) {
                    amounts.push(parsed);
                }
            }
        });

        return amounts;
    }

    /**
     * Compare two currency amounts with tolerance for floating point precision
     */
    static isEqual(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
        return Math.abs(amount1 - amount2) < tolerance;
    }

    /**
     * Round currency amount to nearest rupiah (no decimal places)
     */
    static roundToRupiah(amount: number): number {
        return Math.round(amount);
    }

    /**
     * Calculate percentage of budget used
     */
    static calculateBudgetPercentage(spent: number, budget: number): number {
        if (budget === 0) return 0;
        return (spent / budget) * 100;
    }

    /**
     * Format budget status with appropriate emoji and color coding
     */
    static formatBudgetStatus(spent: number, budget: number): {
        percentage: number;
        status: 'safe' | 'warning' | 'danger' | 'exceeded';
        emoji: string;
        message: string;
    } {
        const percentage = this.calculateBudgetPercentage(spent, budget);

        if (percentage < 80) {
            return {
                percentage,
                status: 'safe',
                emoji: '🟢',
                message: 'Budget aman'
            };
        } else if (percentage < 100) {
            return {
                percentage,
                status: 'warning',
                emoji: '🟡',
                message: 'Mendekati batas budget'
            };
        } else if (percentage === 100) {
            return {
                percentage,
                status: 'danger',
                emoji: '🔴',
                message: 'Budget habis'
            };
        } else {
            return {
                percentage,
                status: 'exceeded',
                emoji: '🚨',
                message: 'Budget terlampaui'
            };
        }
    }
}
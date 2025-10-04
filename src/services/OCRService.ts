import { env } from '../config/environment.js';
import OpenAI from 'openai';

export interface OCRResult {
  success: boolean;
  receiptData?: ReceiptData;
  error?: string;
  confidence?: number;
}

export interface ReceiptData {
  merchantName?: string;
  date?: string;
  items: ReceiptItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  rawText?: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface ImageFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export class OCRService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  /**
   * Extract receipt data from image using OpenAI Vision API
   */
  async extractReceiptData(imageFile: ImageFile): Promise<OCRResult> {
    try {
      console.log(`Processing receipt image: ${imageFile.filename} (${imageFile.buffer.length} bytes)`);

      // Convert buffer to base64
      const base64Image = imageFile.buffer.toString('base64');
      const dataUrl = `data:${imageFile.mimeType};base64,${base64Image}`;

      // Use OpenAI Vision API to analyze the receipt
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this Indonesian receipt/shopping bill and extract the following information in JSON format:

{
  "merchantName": "store name",
  "date": "YYYY-MM-DD format if available",
  "items": [
    {
      "name": "item name in Indonesian",
      "quantity": number,
      "unitPrice": number (in IDR),
      "totalPrice": number (in IDR)
    }
  ],
  "subtotal": number (in IDR, if available),
  "discount": number (in IDR, if available),
  "tax": number (in IDR, if available),
  "total": number (in IDR),
  "paymentMethod": "cash/card/etc if available"
}

Rules:
- Extract all visible items with their quantities and prices
- Convert all prices to Indonesian Rupiah (IDR) numbers without currency symbols
- If quantity is not specified, assume 1
- If unit price is not clear, calculate from total price / quantity
- Include discounts as positive numbers
- Be accurate with numbers and item names
- Use Indonesian item names as they appear on the receipt
- If text is unclear, make reasonable assumptions based on context

Return only the JSON object, no additional text.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        return {
          success: false,
          error: 'No content received from OCR analysis',
        };
      }

      // Parse the JSON response
      let receiptData: ReceiptData;
      try {
        // Clean the response to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        receiptData = JSON.parse(jsonMatch[0]);
        receiptData.rawText = content;
      } catch (parseError) {
        console.error('Failed to parse OCR JSON response:', parseError);
        return {
          success: false,
          error: 'Failed to parse receipt data from image',
        };
      }

      // Validate the extracted data
      const validation = this.validateReceiptData(receiptData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      console.log(`OCR extraction successful: ${receiptData.items.length} items, total: Rp ${receiptData.total.toLocaleString('id-ID')}`);

      return {
        success: true,
        receiptData,
        confidence: 0.85, // Estimated confidence for GPT-4 Vision
      };
    } catch (error) {
      console.error('OCR processing error:', error);
      
      let errorMessage = 'Failed to process receipt image';
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded for image processing';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Image processing quota exceeded';
        } else if (error.message.includes('invalid')) {
          errorMessage = 'Invalid image format or content';
        } else if (error.message.includes('content_policy')) {
          errorMessage = 'Image content not suitable for processing';
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate extracted receipt data
   */
  private validateReceiptData(data: ReceiptData): { valid: boolean; error?: string } {
    if (!data.items || data.items.length === 0) {
      return {
        valid: false,
        error: 'No items found in receipt',
      };
    }

    if (!data.total || data.total <= 0) {
      return {
        valid: false,
        error: 'Invalid total amount',
      };
    }

    // Validate each item
    for (const item of data.items) {
      if (!item.name || item.name.trim() === '') {
        return {
          valid: false,
          error: 'Item name is required',
        };
      }

      if (!item.quantity || item.quantity <= 0) {
        return {
          valid: false,
          error: `Invalid quantity for item: ${item.name}`,
        };
      }

      if (!item.unitPrice || item.unitPrice <= 0) {
        return {
          valid: false,
          error: `Invalid unit price for item: ${item.name}`,
        };
      }

      if (!item.totalPrice || item.totalPrice <= 0) {
        return {
          valid: false,
          error: `Invalid total price for item: ${item.name}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if image format is supported
   */
  isSupportedFormat(mimeType: string): boolean {
    const supportedFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    return supportedFormats.includes(mimeType);
  }

  /**
   * Get estimated cost for OCR processing (in coins)
   */
  getOCRCost(): number {
    // Fixed cost: 1 coin per receipt scan
    return 1.0;
  }

  /**
   * Validate image file before processing
   */
  validateImageFile(imageFile: ImageFile): { valid: boolean; error?: string } {
    // Check file size (max 20MB for Vision API)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (imageFile.buffer.length > maxSize) {
      return {
        valid: false,
        error: 'Image file too large (max 20MB)',
      };
    }

    // Check if format is supported
    if (!this.isSupportedFormat(imageFile.mimeType)) {
      return {
        valid: false,
        error: `Unsupported image format: ${imageFile.mimeType}`,
      };
    }

    // Check minimum file size (avoid empty files)
    if (imageFile.buffer.length < 1024) {
      return {
        valid: false,
        error: 'Image file too small',
      };
    }

    return { valid: true };
  }

  /**
   * Generate expense description from receipt data
   */
  generateExpenseDescription(receiptData: ReceiptData): string {
    const merchantName = receiptData.merchantName || 'Belanja';
    const itemCount = receiptData.items.length;
    
    if (itemCount === 1) {
      return `${merchantName} - ${receiptData.items[0]?.name || 'item'}`;
    } else {
      return `${merchantName} - ${itemCount} items`;
    }
  }

  /**
   * Convert receipt data to expense items format
   */
  convertToExpenseItems(receiptData: ReceiptData): Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> {
    return receiptData.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));
  }
}
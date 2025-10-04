import crypto from 'crypto';
import { env } from '../config/environment.js';

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  tag: string;
}

export interface EncryptionResult {
  success: boolean;
  data?: EncryptedData;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  data?: string;
  error?: string;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor() {
    // Get encryption key from environment or generate one
    const keyString = env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.encryptionKey = Buffer.from(keyString, 'hex');
    
    if (this.encryptionKey.length !== this.keyLength) {
      throw new Error('Invalid encryption key length. Must be 32 bytes (64 hex characters)');
    }
  }

  /**
   * Generate a new encryption key (for setup purposes)
   */
  private generateEncryptionKey(): string {
    const key = crypto.randomBytes(this.keyLength);
    console.warn('Generated new encryption key. Add this to your environment variables:');
    console.warn(`ENCRYPTION_KEY=${key.toString('hex')}`);
    return key.toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): EncryptionResult {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        return {
          success: false,
          error: 'Invalid input: plaintext must be a non-empty string'
        };
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipherGCM(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();

      return {
        success: true,
        data: {
          encryptedData: encrypted,
          iv: iv.toString('hex'),
          tag: tag.toString('hex')
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): DecryptionResult {
    try {
      if (!encryptedData || !encryptedData.encryptedData || !encryptedData.iv || !encryptedData.tag) {
        return {
          success: false,
          error: 'Invalid encrypted data format'
        };
      }

      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipherGCM(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        success: true,
        data: decrypted
      };
    } catch (error) {
      return {
        success: false,
        error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Encrypt sensitive fields in an object
   */
  encryptFields<T extends Record<string, any>>(
    data: T, 
    fieldsToEncrypt: (keyof T)[]
  ): { success: boolean; data?: T; error?: string } {
    try {
      const result = { ...data };
      
      for (const field of fieldsToEncrypt) {
        const value = data[field];
        if (value !== null && value !== undefined && typeof value === 'string') {
          const encryptionResult = this.encrypt(value);
          if (!encryptionResult.success) {
            return {
              success: false,
              error: `Failed to encrypt field ${String(field)}: ${encryptionResult.error}`
            };
          }
          result[field] = encryptionResult.data as any;
        }
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: `Field encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Decrypt sensitive fields in an object
   */
  decryptFields<T extends Record<string, any>>(
    data: T, 
    fieldsToDecrypt: (keyof T)[]
  ): { success: boolean; data?: T; error?: string } {
    try {
      const result = { ...data };
      
      for (const field of fieldsToDecrypt) {
        const value = data[field];
        if (value && typeof value === 'object' && 'encryptedData' in value) {
          const decryptionResult = this.decrypt(value as EncryptedData);
          if (!decryptionResult.success) {
            return {
              success: false,
              error: `Failed to decrypt field ${String(field)}: ${decryptionResult.error}`
            };
          }
          result[field] = decryptionResult.data as any;
        }
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: `Field decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Hash sensitive data (one-way, for verification purposes)
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      if (!salt || !hash) {
        return false;
      }
      
      const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
      return hash === verifyHash.toString('hex');
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(buffer: Buffer): void {
    if (buffer && Buffer.isBuffer(buffer)) {
      crypto.randomFillSync(buffer);
      buffer.fill(0);
    }
  }

  /**
   * Create anonymized version of sensitive data
   */
  anonymize(data: string, preserveLength: boolean = true): string {
    if (!data || typeof data !== 'string') {
      return '';
    }

    if (preserveLength) {
      return '*'.repeat(data.length);
    } else {
      return '***';
    }
  }

  /**
   * Mask sensitive data (show only first and last characters)
   */
  maskSensitiveData(data: string, visibleChars: number = 2): string {
    if (!data || typeof data !== 'string') {
      return '';
    }

    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(data.length - visibleChars * 2);
    
    return `${start}${middle}${end}`;
  }

  /**
   * Validate encryption key format
   */
  static validateEncryptionKey(key: string): boolean {
    try {
      const buffer = Buffer.from(key, 'hex');
      return buffer.length === 32; // 256 bits
    } catch {
      return false;
    }
  }

  /**
   * Generate new encryption key for setup
   */
  static generateNewEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
import { PrismaClient } from '@prisma/client';

/**
 * Generic base repository providing common CRUD operations
 * Implements error handling and transaction support
 */
export abstract class BaseRepository<T, CreateData, UpdateData> {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Find a record by ID
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * Create a new record
   */
  abstract create(data: CreateData): Promise<T>;

  /**
   * Update an existing record
   */
  abstract update(id: string, data: UpdateData): Promise<T>;

  /**
   * Delete a record by ID
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Find multiple records with optional filters
   */
  abstract findMany(filters?: any): Promise<T[]>;

  /**
   * Execute operations within a transaction
   */
  async executeTransaction<R>(
    operations: (prisma: any) => Promise<R>
  ): Promise<R> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        return await operations(tx);
      });
    } catch (error) {
      this.handleError(error, 'Transaction failed');
      throw error;
    }
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    try {
      const record = await this.findById(id);
      return record !== null;
    } catch (error) {
      this.handleError(error, `Failed to check existence for ID: ${id}`);
      return false;
    }
  }

  /**
   * Count records with optional filters
   */
  abstract count(filters?: any): Promise<number>;

  /**
   * Handle repository errors with consistent logging and error transformation
   */
  protected handleError(error: any, context: string): void {
    console.error(`Repository Error [${context}]:`, {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Transform Prisma errors to more user-friendly errors
    if (error.code === 'P2002') {
      throw new Error('A record with this data already exists');
    }
    
    if (error.code === 'P2025') {
      throw new Error('Record not found');
    }
    
    if (error.code === 'P2003') {
      throw new Error('Foreign key constraint failed');
    }
    
    if (error.code === 'P2014') {
      throw new Error('Invalid data provided');
    }

    // Re-throw the original error if it's not a known Prisma error
    if (!error.code?.startsWith('P')) {
      throw error;
    }
  }

  /**
   * Validate required fields before operations
   */
  protected validateRequiredFields(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Sanitize data by removing undefined values
   */
  protected sanitizeData(data: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Apply pagination to query options
   */
  protected applyPagination(options: any, limit?: number, offset?: number): any {
    if (limit !== undefined) {
      options.take = Math.min(limit, 100); // Max 100 records per query
    }
    
    if (offset !== undefined) {
      options.skip = Math.max(0, offset);
    }
    
    return options;
  }

  /**
   * Apply date range filtering
   */
  protected applyDateRange(
    filters: any, 
    dateField: string, 
    startDate?: Date, 
    endDate?: Date
  ): any {
    if (startDate || endDate) {
      filters[dateField] = {};
      
      if (startDate) {
        filters[dateField].gte = startDate;
      }
      
      if (endDate) {
        filters[dateField].lte = endDate;
      }
    }
    
    return filters;
  }
}
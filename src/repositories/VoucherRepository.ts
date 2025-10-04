import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IVoucherRepository } from '../interfaces/repositories.js';
import { IVoucher } from '../interfaces/index.js';

export class VoucherRepository extends BaseRepository<IVoucher, Omit<IVoucher, 'id' | 'createdAt' | 'updatedAt'>, Partial<IVoucher>> implements IVoucherRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByCode(code: string): Promise<IVoucher | null> {
    try {
      const voucher = await this.prisma.voucher.findUnique({
        where: { code },
        include: {
          user: true,
        },
      });

      return voucher ? this.mapToInterface(voucher) : null;
    } catch (error) {
      this.handleError(error, `Failed to find voucher by code: ${code}`);
      throw error;
    }
  }

  async findById(id: string): Promise<IVoucher | null> {
    try {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id },
        include: {
          user: true,
        },
      });

      return voucher ? this.mapToInterface(voucher) : null;
    } catch (error) {
      this.handleError(error, `Failed to find voucher by ID: ${id}`);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<IVoucher[]> {
    try {
      const vouchers = await this.prisma.voucher.findMany({
        where: { usedBy: userId },
        include: {
          user: true,
        },
        orderBy: { usedAt: 'desc' },
      });

      return vouchers.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, `Failed to find vouchers for user: ${userId}`);
      throw error;
    }
  }

  async create(voucherData: Omit<IVoucher, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVoucher> {
    try {
      this.validateRequiredFields(voucherData, ['code', 'type', 'value']);

      const voucher = await this.prisma.voucher.create({
        data: {
          code: voucherData.code,
          type: voucherData.type,
          value: voucherData.value,
          isUsed: voucherData.isUsed || false,
          usedBy: voucherData.usedBy,
          usedAt: voucherData.usedAt,
          expiresAt: voucherData.expiresAt,
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(voucher);
    } catch (error) {
      this.handleError(error, 'Failed to create voucher');
      throw error;
    }
  }

  async update(id: string, voucherData: Partial<IVoucher>): Promise<IVoucher> {
    try {
      const sanitizedData = this.sanitizeData(voucherData);

      const voucher = await this.prisma.voucher.update({
        where: { id },
        data: sanitizedData,
        include: {
          user: true,
        },
      });

      return this.mapToInterface(voucher);
    } catch (error) {
      this.handleError(error, `Failed to update voucher: ${id}`);
      throw error;
    }
  }

  async markAsUsed(id: string, userId: string): Promise<IVoucher> {
    try {
      const voucher = await this.prisma.voucher.update({
        where: { id },
        data: {
          isUsed: true,
          usedBy: userId,
          usedAt: new Date(),
        },
        include: {
          user: true,
        },
      });

      return this.mapToInterface(voucher);
    } catch (error) {
      this.handleError(error, `Failed to mark voucher as used: ${id}`);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.voucher.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, `Failed to delete voucher: ${id}`);
      throw error;
    }
  }

  async findMany(filters?: any): Promise<IVoucher[]> {
    try {
      const vouchers = await this.prisma.voucher.findMany({
        where: filters,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return vouchers.map(this.mapToInterface);
    } catch (error) {
      this.handleError(error, 'Failed to find vouchers');
      throw error;
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      return await this.prisma.voucher.count({
        where: filters,
      });
    } catch (error) {
      this.handleError(error, 'Failed to count vouchers');
      throw error;
    }
  }

  private mapToInterface(voucher: any): IVoucher {
    return {
      id: voucher.id,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      isUsed: voucher.isUsed,
      usedBy: voucher.usedBy,
      usedAt: voucher.usedAt,
      expiresAt: voucher.expiresAt,
      createdAt: voucher.createdAt,
      updatedAt: voucher.updatedAt,
    };
  }
}
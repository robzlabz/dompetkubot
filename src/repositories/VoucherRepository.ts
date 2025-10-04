import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './BaseRepository.js';
import { IVoucherRepository } from '../interfaces/repositories.js';
import { IVoucher } from '../interfaces/index.js';

export class VoucherRepository extends BaseRepository<IVoucher, Omit<IVoucher, 'id' | 'createdAt' | 'updatedAt'>, Partial<IVoucher>> implements IVoucherRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByCode(code: string): Promise<IVoucher | null> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { code },
      include: {
        user: true,
      },
    });

    return voucher ? this.mapToInterface(voucher) : null;
  }

  async findById(id: string): Promise<IVoucher | null> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    return voucher ? this.mapToInterface(voucher) : null;
  }

  async findByUserId(userId: string): Promise<IVoucher[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { usedBy: userId },
      include: {
        user: true,
      },
      orderBy: { usedAt: 'desc' },
    });

    return vouchers.map(this.mapToInterface);
  }

  async create(voucherData: Omit<IVoucher, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVoucher> {
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
  }

  async update(id: string, voucherData: Partial<IVoucher>): Promise<IVoucher> {
    const voucher = await this.prisma.voucher.update({
      where: { id },
      data: {
        ...(voucherData.type !== undefined && { type: voucherData.type }),
        ...(voucherData.value !== undefined && { value: voucherData.value }),
        ...(voucherData.isUsed !== undefined && { isUsed: voucherData.isUsed }),
        ...(voucherData.usedBy !== undefined && { usedBy: voucherData.usedBy }),
        ...(voucherData.usedAt !== undefined && { usedAt: voucherData.usedAt }),
        ...(voucherData.expiresAt !== undefined && { expiresAt: voucherData.expiresAt }),
      },
      include: {
        user: true,
      },
    });

    return this.mapToInterface(voucher);
  }

  async markAsUsed(id: string, userId: string): Promise<IVoucher> {
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
  }

  async delete(id: string): Promise<void> {
    await this.prisma.voucher.delete({
      where: { id },
    });
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
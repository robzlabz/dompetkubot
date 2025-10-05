import { prisma } from "./prisma";
import { nanoid } from "nanoid";
import { toNumber } from "../utils/money";
import type { Prisma, User, Income, Category } from "../../prisma/src/generated";

type CreateIncomeArgs = {
  telegramId: string;
  categoryId?: number | null;
  categoryName?: string | null;
  amount?: number | string | null;
  description?: string | null;
};

type ReadIncomeArgs = {
  incomeId?: string | null;
  telegramId?: string | null;
  limit?: number | null;
};

type UpdateIncomeArgs = {
  incomeId: string;
  description?: string | null;
  amount?: number | string | null;
  categoryId?: number | null;
  categoryName?: string | null;
};

type DeleteIncomeArgs = {
  incomeId: string;
};

type ServiceOk<T> = { ok: true } & T;
type ServiceErr = { ok: false; error: string };

async function getOrCreateUserByTelegramId(telegramId: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;
  return prisma.user.create({ data: { telegramId, language: "id" } });
}

async function resolveIncomeCategory({ userId, categoryId, categoryName }: { userId: number; categoryId?: number | null; categoryName?: string | null; }): Promise<Category> {
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (cat) return cat;
  }
  const name = (categoryName || "Gaji").trim();
  const existing = await prisma.category.findFirst({ where: { userId, name, type: "INCOME" } });
  if (existing) return existing as Category;
  return prisma.category.create({ data: { userId, name, type: "INCOME" } });
}

export async function createIncome(args: CreateIncomeArgs): Promise<ServiceOk<{ incomeId: string; amount: number }> | ServiceErr> {
  const telegramId: string = String(args.telegramId);
  const user = await getOrCreateUserByTelegramId(telegramId);
  const category = await resolveIncomeCategory({ userId: user.id, categoryId: args.categoryId ?? null, categoryName: args.categoryName ?? null });

  const amountNum = toNumber(args.amount) ?? 0;
  const incomeId = nanoid(10);

  const created = await prisma.income.create({
    data: {
      incomeId,
      userId: user.id,
      amount: amountNum,
      description: String(args.description ?? ""),
      categoryId: category.id,
    },
  });

  return { ok: true, incomeId, amount: created.amount };
}

export async function readIncome(args: ReadIncomeArgs): Promise<ServiceOk<{ data: (Income & { category: Category }) | Array<Income & { category: Category }> | null }> | ServiceErr> {
  if (args.incomeId) {
    const inc = await prisma.income.findUnique({ where: { incomeId: String(args.incomeId) }, include: { category: true, user: true } as any });
    return { ok: true, data: inc as any };
  }
  const telegramId: string | null = args.telegramId ? String(args.telegramId) : null;
  const limit: number = typeof args.limit === "number" && args.limit > 0 ? args.limit : 10;
  if (!telegramId) return { ok: false, error: "Missing telegramId for listing." };
  const user = await getOrCreateUserByTelegramId(telegramId);
  const list = await prisma.income.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit, include: { category: true } });
  return { ok: true, data: list as any };
}

export async function updateIncome(args: UpdateIncomeArgs): Promise<ServiceOk<{ incomeId: string }> | ServiceErr> {
  const incomeId: string = String(args.incomeId);
  const existing = await prisma.income.findUnique({ where: { incomeId } });
  if (!existing) return { ok: false, error: "Income not found" };

  const updateData: Partial<Pick<Income, "description" | "amount" | "categoryId">> = {};
  if (args.description !== undefined && args.description !== null) updateData.description = String(args.description);
  if (args.amount !== undefined && args.amount !== null) {
    const num = toNumber(args.amount);
    if (num !== null) updateData.amount = num;
  }

  if (args.categoryId || args.categoryName) {
    const user = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (user) {
      const category = await resolveIncomeCategory({ userId: user.id, categoryId: args.categoryId ?? null, categoryName: args.categoryName ?? null });
      updateData.categoryId = category.id;
    }
  }

  await prisma.income.update({ where: { incomeId }, data: updateData });
  return { ok: true, incomeId };
}

export async function deleteIncome(args: DeleteIncomeArgs): Promise<ServiceOk<{ incomeId: string }> | ServiceErr> {
  const incomeId: string = String(args.incomeId);
  const existing = await prisma.income.findUnique({ where: { incomeId } });
  if (!existing) return { ok: false, error: "Income not found" };
  await prisma.income.delete({ where: { incomeId } });
  return { ok: true, incomeId };
}
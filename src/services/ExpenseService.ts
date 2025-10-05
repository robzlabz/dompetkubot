import { prisma } from "./prisma";
import { nanoid } from "nanoid";
import { toNumber } from "../utils/money";
import type { Prisma, User, Expense, ExpenseItem, Category } from "@prisma/client";

// Define explicit argument and return types to avoid any
type ExpenseItemArg = {
  name: string;
  quantity: number | string;
  unitPrice: number | string;
};

type CreateExpenseArgs = {
  telegramId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  amount?: number | string | null;
  description?: string | null;
  items?: ExpenseItemArg[];
};

type ReadExpenseArgs = {
  expenseId?: string | null;
  telegramId?: string | null;
  limit?: number | null;
};

type UpdateExpenseArgs = {
  expenseId: string;
  description?: string | null;
  amount?: number | string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  items?: ExpenseItemArg[];
};

type DeleteExpenseArgs = {
  expenseId: string;
};

type ExpenseWithRelations = Expense & { items: ExpenseItem[]; category: Category; user?: User };

type ServiceOk<T> = { ok: true } & T;

type ServiceErr = { ok: false; error: string };

// Helper: get or create user by telegramId
async function getOrCreateUserByTelegramId(telegramId: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;
  return prisma.user.create({ data: { telegramId, language: "id" } });
}

// Helper: resolve category by id or name; create if not exists
async function resolveCategory({ userId, categoryId, categoryName }: { userId: string; categoryId?: string | null; categoryName?: string | null; }): Promise<Category> {
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (cat) return cat;
  }
  const name = (categoryName || "Lainnya").trim();
  const existing = await prisma.category.findFirst({ where: { userId, name } });
  if (existing) return existing as Category;
  return prisma.category.create({ data: { userId, name, type: "EXPENSE" } });
}

export async function createExpense(args: CreateExpenseArgs): Promise<ServiceOk<{ expenseId: string; amount: number; itemsCount: number }> | ServiceErr> {
  const telegramId: string = String(args.telegramId);
  const user = await getOrCreateUserByTelegramId(telegramId);
  const category = await resolveCategory({ userId: user.id, categoryId: args.categoryId ?? null, categoryName: args.categoryName ?? null });

  const amountNum = toNumber(args.amount);
  let itemsInput: Array<{ name: string; quantity: number; unitPrice: number }> = [];
  if (Array.isArray(args.items)) {
    itemsInput = args.items
      .map((it: ExpenseItemArg) => {
        const qty = toNumber(it.quantity);
        const unit = toNumber(it.unitPrice);
        return { name: String(it.name), quantity: Math.max(0, Math.floor(qty ?? 0)), unitPrice: Math.max(0, unit ?? 0) };
      })
      .filter((it: { name: string; quantity: number; unitPrice: number }) => it.name && it.quantity > 0 && it.unitPrice >= 0);
  }

  const calculatedTotal = itemsInput.length > 0 ? itemsInput.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0) : null;
  const finalAmount = amountNum ?? calculatedTotal ?? 0;

  const expenseId = nanoid(10);
  const expense = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.expense.create({
      data: {
        expenseId,
        userId: user.id,
        amount: finalAmount,
        description: String(args.description ?? ""),
        categoryId: category.id,
        calculationExpression: itemsInput.length > 0 ? itemsInput.map((it) => `${it.quantity}x${it.unitPrice}`).join(" + ") : undefined,
      },
    });

    if (itemsInput.length > 0) {
      await tx.expenseItem.createMany({
        data: itemsInput.map((it) => ({ expenseId: created.id, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.quantity * it.unitPrice })),
      });
    }

    return created;
  });

  return { ok: true, expenseId, amount: finalAmount, itemsCount: itemsInput.length };
}

// Create many expense items under a single expense; total amount = sum of item prices
type CreateExpenseManyArgs = {
  telegramId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  description?: string | null;
  items: Array<{ name: string; price: number | string; quantity?: number | string | null }>;
};

export async function createExpenseMany(args: CreateExpenseManyArgs): Promise<ServiceOk<{ expenseId: string; amount: number; itemsCount: number }> | ServiceErr> {
  const telegramId: string = String(args.telegramId);
  const user = await getOrCreateUserByTelegramId(telegramId);
  const category = await resolveCategory({ userId: user.id, categoryId: args.categoryId ?? null, categoryName: args.categoryName ?? null });

  if (!Array.isArray(args.items) || args.items.length === 0) {
    return { ok: false, error: "Items are required" };
  }

  const itemsInput = args.items
    .map((it) => {
      const qty = toNumber(it.quantity ?? 1) ?? 1;
      const unit = toNumber(it.price) ?? 0;
      return { name: String(it.name), quantity: Math.max(1, Math.floor(qty)), unitPrice: Math.max(0, unit) };
    })
    .filter((it) => it.name && it.quantity > 0 && it.unitPrice >= 0);

  const finalAmount = itemsInput.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

  const expenseId = nanoid(10);
  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdExpense = await tx.expense.create({
      data: {
        expenseId,
        userId: user.id,
        amount: finalAmount,
        description: String(args.description ?? ""),
        categoryId: category.id,
        calculationExpression: itemsInput.map((it) => `${it.quantity}x${it.unitPrice}`).join(" + "),
      },
    });

    if (itemsInput.length > 0) {
      await tx.expenseItem.createMany({
        data: itemsInput.map((it) => ({
          expenseId: createdExpense.id,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.quantity * it.unitPrice,
        })),
      });
    }

    return createdExpense;
  });

  return { ok: true, expenseId, amount: finalAmount, itemsCount: itemsInput.length };
}

export async function readExpense(args: ReadExpenseArgs): Promise<ServiceOk<{ data: ExpenseWithRelations | ExpenseWithRelations[] | null }> | ServiceErr> {
  if (args.expenseId) {
    const e = await prisma.expense.findUnique({ where: { expenseId: String(args.expenseId) }, include: { items: true, category: true, user: true } });
    return { ok: true, data: e as ExpenseWithRelations | null };
  }
  const telegramId: string | null = args.telegramId ? String(args.telegramId) : null;
  const limit: number = typeof args.limit === "number" && args.limit > 0 ? args.limit : 10;
  if (!telegramId) return { ok: false, error: "Missing telegramId for listing." };
  const user = await getOrCreateUserByTelegramId(telegramId);
  const list = await prisma.expense.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit, include: { items: true, category: true } });
  return { ok: true, data: list as ExpenseWithRelations[] };
}

export async function updateExpense(args: UpdateExpenseArgs): Promise<ServiceOk<{ expenseId: string }> | ServiceErr> {
  const expenseId: string = String(args.expenseId);
  const existing = await prisma.expense.findUnique({ where: { expenseId } });
  if (!existing) return { ok: false, error: "Expense not found" };

  const updateData: Partial<Pick<Expense, "description" | "amount" | "categoryId">> = {};
  if (args.description !== undefined && args.description !== null) updateData.description = String(args.description);
  if (args.amount !== undefined && args.amount !== null) {
    const num = toNumber(args.amount);
    if (num !== null) updateData.amount = num;
  }

  if (args.categoryId || args.categoryName) {
    const user = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (user) {
      const category = await resolveCategory({ userId: user.id, categoryId: args.categoryId ?? null, categoryName: args.categoryName ?? null });
      updateData.categoryId = category.id;
    }
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const u = await tx.expense.update({ where: { expenseId }, data: updateData });

    if (Array.isArray(args.items)) {
      await tx.expenseItem.deleteMany({ where: { expenseId: u.id } });
      const itemsInput: { name: string; quantity: number; unitPrice: number }[] = args.items
        .map((it: ExpenseItemArg) => {
          const qty = toNumber(it.quantity);
          const unit = toNumber(it.unitPrice);
          return { name: String(it.name), quantity: Math.max(0, Math.floor(qty ?? 0)), unitPrice: Math.max(0, unit ?? 0) };
        })
        .filter((it: { name: string; quantity: number; unitPrice: number }) => it.name && it.quantity > 0 && it.unitPrice >= 0);

      if (itemsInput.length > 0) {
        await tx.expenseItem.createMany({ data: itemsInput.map((it) => ({ expenseId: u.id, name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, totalPrice: it.quantity * it.unitPrice })) });
        const newTotal = itemsInput.reduce((acc: number, it) => acc + it.quantity * it.unitPrice, 0);
        await tx.expense.update({ where: { id: u.id }, data: { amount: updateData.amount ?? newTotal, calculationExpression: itemsInput.map((it) => `${it.quantity}x${it.unitPrice}`).join(" + ") } });
      }
    }

    return u;
  });

  return { ok: true, expenseId };
}

export async function deleteExpense(args: DeleteExpenseArgs): Promise<ServiceOk<{ expenseId: string }> | ServiceErr> {
  const expenseId: string = String(args.expenseId);
  const existing = await prisma.expense.findUnique({ where: { expenseId } });
  if (!existing) return { ok: false, error: "Expense not found" };
  await prisma.expense.delete({ where: { id: existing.id } });
  return { ok: true, expenseId };
}
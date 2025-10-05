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
  categoryId?: number | null;
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
  categoryId?: number | null;
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
async function resolveCategory({ userId, categoryId, categoryName }: { userId: number; categoryId?: number | null; categoryName?: string | null; }): Promise<Category> {
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
  categoryId?: number | null;
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

// New: read expenses by date range
type ReadExpenseRangeArgs = {
  telegramId: string;
  dateStart: string; // ISO string or yyyy-mm-dd
  dateEnd: string;   // ISO string or yyyy-mm-dd
  limit?: number | null;
};

export async function readExpenseRange(
  args: ReadExpenseRangeArgs
): Promise<ServiceOk<{ data: ExpenseWithRelations[] }> | ServiceErr> {
  const telegramId = String(args.telegramId);
  const user = await getOrCreateUserByTelegramId(telegramId);

  const start = new Date(args.dateStart);
  const end = new Date(args.dateEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date range" };
  }

  // Normalize end to end-of-day if start/end are date-only strings
  if (args.dateEnd.length <= 10) {
    end.setHours(23, 59, 59, 999);
  }
  const list = await prisma.expense.findMany({
    where: { userId: user.id, createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
    take: typeof args.limit === "number" && args.limit > 0 ? args.limit : undefined,
    include: { items: true, category: true },
  });
  return { ok: true, data: list as ExpenseWithRelations[] };
}

// New: read total expenses within a range (today/this_week/this_month/custom)
type ReadExpenseTotalArgs = {
  telegramId: string;
  range?: "today" | "this_week" | "this_month" | "custom";
  dateStart?: string | null;
  dateEnd?: string | null;
  groupBy?: "category" | "none";
};

function computeRange(range?: string, dateStart?: string | null, dateEnd?: string | null) {
  const now = new Date();
  let start: Date;
  let end: Date;
  const r = range || "today";
  if (r === "custom" && dateStart && dateEnd) {
    start = new Date(dateStart);
    end = new Date(dateEnd);
  } else if (r === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (r === "this_week") {
    const d = new Date(now);
    const day = d.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Monday=0
    start = new Date(d);
    start.setDate(d.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    // today
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

export async function readExpenseTotal(
  args: ReadExpenseTotalArgs
): Promise<
  ServiceOk<{
    range: { start: string; end: string };
    total: number;
    count: number;
    breakdown?: Array<{ categoryId: string; categoryName: string; total: number; count: number }>;
  }> | ServiceErr
> {
  const telegramId = String(args.telegramId);
  const user = await getOrCreateUserByTelegramId(telegramId);
  const { start, end } = computeRange(args.range, args.dateStart, args.dateEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid date range" };
  }

  const agg = await prisma.expense.aggregate({
    where: { userId: user.id, createdAt: { gte: start, lte: end } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const result: {
    range: { start: string; end: string };
    total: number;
    count: number;
    breakdown?: Array<{ categoryId: number; categoryName: string; total: number; count: number }>;
  } = {
    range: { start: start.toISOString(), end: end.toISOString() },
    total: agg._sum.amount ?? 0,
    count: (agg._count as any)?._all ?? 0,
  };

  if ((args.groupBy || "none") === "category") {
    const groups = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: { userId: user.id, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const catIds = groups.map((g) => g.categoryId);
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } } });
    const nameMap = new Map<number, string>(cats.map((c) => [c.id, c.name]));
    result.breakdown = groups.map((g) => ({
      categoryId: g.categoryId,
      categoryName: nameMap.get(g.categoryId) || "(tidak diketahui)",
      total: g._sum.amount ?? 0,
      count: (g._count as any)?._all ?? 0,
    }));
  }

  return { ok: true, ...result } as any;
}
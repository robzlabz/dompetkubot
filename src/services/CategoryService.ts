import { prisma } from "./prisma";
import logger from "./logger";
import { CategoryType } from "@prisma/client";
import { createOrUpdateUser } from "./UserService";

export type CreateCategoryParams = {
  telegramId?: string;
  userId?: number;
  name: string;
  type: CategoryType;
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  isDefault?: boolean;
};

export async function createCategory(params: CreateCategoryParams) {
  const { telegramId, userId: inputUserId, name, type, parentCategoryId, parentCategoryName, isDefault } = params;

  let userId = inputUserId ?? null;
  if (!userId && telegramId) {
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      const created = await createOrUpdateUser({ telegramId, language: "id", firstName: "User", lastName: "" });
      userId = created.id;
    } else {
      userId = user.id;
    }
  }
  if (!userId) throw new Error("userId atau telegramId wajib");

  // Resolve parent category
  let parentId: number | null = parentCategoryId ?? null;
  if (!parentId && parentCategoryName) {
    const parent = await prisma.category.findFirst({ where: { userId, name: parentCategoryName, type } });
    if (parent) parentId = parent.id;
  }

  // Prevent duplicate by unique constraint
  const existing = await prisma.category.findFirst({ where: { userId, name, type, parentId } });
  if (existing) {
    logger.info({ userId, name, type, parentId }, "Category already exists");
    return existing;
  }

  const created = await prisma.category.create({
    data: { userId, name, type, isDefault: !!isDefault, parentId },
  });
  logger.info({ userId, name, type, parentId, id: created.id }, "Category created");
  return created;
}

export async function seedDefaultCategories(userId: number) {
  const count = await prisma.category.count({ where: { userId } });
  if (count > 0) {
    return { ok: true, seeded: false };
  }

  // Root categories
  const incomeRoot = await prisma.category.create({
    data: { userId, name: "Pendapatan", type: CategoryType.INCOME, isDefault: true },
  });
  const expenseRoot = await prisma.category.create({
    data: { userId, name: "Pengeluaran", type: CategoryType.EXPENSE, isDefault: true },
  });

  // Income groups and leaves
  const incomeGroups: Record<string, string[]> = {
    "Gaji": ["Gaji pokok", "Tunjangan", "Lembur"],
    "Bonus/Insentif": ["Bonus tahunan", "THR", "Komisi"],
    "Usaha/Sampingan": ["Penjualan", "Freelance", "Jasa"],
    "Investasi": ["Dividen", "Bunga", "Capital gain"],
    "Lain-lain": ["Hadiah", "Refund", "Pemasukan tak terduga"],
  };

  for (const [groupName, leaves] of Object.entries(incomeGroups)) {
    const group = await prisma.category.create({
      data: { userId, name: groupName, type: CategoryType.INCOME, isDefault: true, parentId: incomeRoot.id },
    });
    for (const leaf of leaves) {
      await prisma.category.create({
        data: { userId, name: leaf, type: CategoryType.INCOME, isDefault: true, parentId: group.id },
      });
    }
  }

  // Expense groups and leaves
  const expenseGroups: Record<string, string[] | Record<string, string[]>> = {
    "Makan & Belanja Harian": ["Makan luar", "Cemilan", "Belanja dapur"],
    "Transportasi": ["BBM", "Parkir", "Ojol/Taxi", "Tol", "Servis kendaraan"],
    "Tagihan Rutin": ["Listrik", "Air", "Internet", "Pulsa/Kuota"],
    "Hunian": ["Sewa/KPR", "Iuran/Keamanan", "Perawatan rumah", "Alat kebersihan"],
    "Kesehatan": ["Obat", "Dokter", "Vitamin", "Asuransi kesehatan"],
    "Pendidikan": ["Sekolah/Kursus", "Buku/Alat tulis", "Workshop"],
    "Lifestyle": ["Hiburan", "Streaming", "Olahraga", "Hobi"],
    "Belanja Pribadi": ["Pakaian", "Kosmetik/Perawatan", "Aksesori", "Gadget kecil"],
    "Keuangan": ["Cicilan", "Kartu kredit", "Biaya bank", "Dana darurat"],
    "Zakat/Donasi": ["Zakat", "Sedekah", "Sumbangan"],
    "Tabungan/Investasi": ["Tabungan", "Reksa dana", "Emas", "Kripto"],
    "Opsional": {
      "Keluarga": ["Keperluan anak", "Orangtua", "Acara keluarga"],
      "Kerja": ["Alat kerja", "Perjalanan dinas", "Makan siang kantor"],
      "Hewan Peliharaan": ["Makanan", "Perawatan", "Dokter hewan"],
    },
  };

  for (const [groupName, config] of Object.entries(expenseGroups)) {
    const group = await prisma.category.create({
      data: { userId, name: groupName, type: CategoryType.EXPENSE, isDefault: true, parentId: expenseRoot.id },
    });
    if (Array.isArray(config)) {
      for (const leaf of config) {
        await prisma.category.create({
          data: { userId, name: leaf, type: CategoryType.EXPENSE, isDefault: true, parentId: group.id },
        });
      }
    } else {
      for (const [subGroupName, leaves] of Object.entries(config)) {
        const subGroup = await prisma.category.create({
          data: { userId, name: subGroupName, type: CategoryType.EXPENSE, isDefault: true, parentId: group.id },
        });
        for (const leaf of leaves) {
          await prisma.category.create({
            data: { userId, name: leaf, type: CategoryType.EXPENSE, isDefault: true, parentId: subGroup.id },
          });
        }
      }
    }
  }

  logger.info({ userId }, "Seeded default categories");
  return { ok: true, seeded: true };
}

export async function seedDefaultCategoriesByTelegramId(telegramId: string) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  const ensured = user ?? (await createOrUpdateUser({ telegramId, language: "id", firstName: "User", lastName: "" }));
  return seedDefaultCategories(ensured.id);
}

export async function getCategoryList(userId: number) {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return categories.map((c) => c.name);
}
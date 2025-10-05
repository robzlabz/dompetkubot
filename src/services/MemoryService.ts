import { prisma } from "./prisma";

export type MemoryItem = {
  price: number;
  unit: string;
  [key: string]: any;
};

type MemoryData = Record<string, MemoryItem>;

export async function getMemory(userId: string, key: string): Promise<MemoryItem | null> {
  const memory = await prisma.userMemory.findUnique({ where: { userId } });
  const data = (memory?.data ?? {}) as MemoryData;
  return data[key] || null;
}

export async function saveMemory(userId: string, key: string, data: MemoryItem): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.userMemory.create({ data: { userId, data: { [key]: data } } });
    return { ok: true };
  }

  const merged: MemoryData = { ...(existing.data as MemoryData), [key]: data };
  await prisma.userMemory.update({ where: { userId }, data: { data: merged } });
  return { ok: true };
}

export async function deleteMemory(userId: string, key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  const data = (existing?.data ?? {}) as MemoryData;
  if (!data[key]) {
    return { ok: false, error: "Item tidak ditemukan" };
  }
  delete data[key];
  await prisma.userMemory.update({ where: { userId }, data: { data } });
  return { ok: true };
}
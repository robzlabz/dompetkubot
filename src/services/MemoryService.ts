import { prisma } from "./prisma";

export type MemoryItem = {
  price: number;
  unit: string;
  [key: string]: any;
};

type MemoryData = Record<string, MemoryItem>;

export async function getMemory(userId: number, key: string): Promise<MemoryItem | null> {
  const memory = await prisma.userMemory.findUnique({ where: { userId } });
  const data = (memory?.data ?? {}) as MemoryData;
  return data[key] || null;
}

export async function saveMemory(userId: number, key: string, data: MemoryItem): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.userMemory.create({ data: { userId, data: { [key]: data } } });
    return { ok: true };
  }

  const merged: MemoryData = { ...(existing.data as MemoryData), [key]: data };
  await prisma.userMemory.update({ where: { userId }, data: { data: merged } });
  return { ok: true };
}

export async function saveMemoryMany(
  userId: number,
  items: Array<{ key: string; price: number; unit: string }>
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  if (!items || items.length === 0) {
    return { ok: false, error: "Tidak ada item untuk disimpan" };
  }
  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  const current: MemoryData = (existing?.data ?? {}) as MemoryData;
  const updated: MemoryData = { ...current };
  let saved = 0;
  for (const it of items) {
    const key = String(it.key || "").trim();
    const unit = String(it.unit || "").trim();
    const price = Number(it.price || 0);
    if (!key || !unit) continue;
    updated[key] = { price, unit };
    saved += 1;
  }
  if (!existing) {
    await prisma.userMemory.create({ data: { userId, data: updated } });
  } else {
    await prisma.userMemory.update({ where: { userId }, data: { data: updated } });
  }
  return { ok: true, saved };
}

export async function deleteMemory(userId:  number, key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.userMemory.findUnique({ where: { userId } });
  const data = (existing?.data ?? {}) as MemoryData;
  if (!data[key]) {
    return { ok: false, error: "Item tidak ditemukan" };
  }
  delete data[key];
  await prisma.userMemory.update({ where: { userId }, data: { data } });
  return { ok: true };
}
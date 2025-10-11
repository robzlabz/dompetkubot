export function formatRupiah(amount: number): string {
  const formatter = new Intl.NumberFormat("id-ID");
  return `Rp. ${formatter.format(Math.round(amount))}`;
}

export function parseAmountToken(token: string): number | null {
  const cleaned = token.toLowerCase().replace(/\./g, "").trim();
  const rbMatch = cleaned.match(/^(\d+)(rb|ribu)$/);
  if (rbMatch) {
    const base = Number(rbMatch[1]);
    return base * 1000;
  }
  const plainNumMatch = cleaned.match(/^(\d{1,3}(?:\d{3})+|\d+)$/);
  if (plainNumMatch) {
    return Number(plainNumMatch[1]);
  }
  return null;
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const trimmed = String(value).trim().toLowerCase();
  const parsed = parseAmountToken(trimmed);
  if (parsed !== null) return parsed;
  const n = Number(trimmed.replace(/,/g, "."));
  return isNaN(n) ? null : n;
}
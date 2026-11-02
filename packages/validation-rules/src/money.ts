/** Parse an EDI monetary string into integer cents. Returns null if not a plain amount. */
export function toCents(value: string | undefined): number | null {
  if (value === undefined) return null;
  const s = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number.parseInt(whole!, 10) * 100 + Number.parseInt(frac.padEnd(2, "0"), 10);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}
